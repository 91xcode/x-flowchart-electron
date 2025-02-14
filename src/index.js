// 在所有 require 之前设置环境变量
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 'false';

// 开发环境添加热重载
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true
    });
  } catch (_) { console.log('Error hot reloading'); }
}

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const started = require('electron-squirrel-startup');
const axios = require('axios');
const logger = require('./utils/logger');
const settings = require('./utils/settings');

// 记录启动配置
const currentSettings = settings.store.get();
logger.info('应用启动', {
  currentAPI: {
    type: currentSettings.apiType,
    name: settings.API_CONFIGS[currentSettings.apiType].name,
    url: currentSettings[currentSettings.apiType].url,
    model: currentSettings[currentSettings.apiType].model,
    // 不记录敏感信息如 API Key
    hasKey: !!currentSettings[currentSettings.apiType].key,
    ...(currentSettings.apiType === 'azure' ? { 
      apiVersion: currentSettings[currentSettings.apiType].apiVersion 
    } : {})
  },
  availableAPIs: Object.keys(settings.API_CONFIGS).map(key => ({
    type: key,
    name: settings.API_CONFIGS[key].name
  })),
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch
});

// 在创建窗口前禁用功能
app.commandLine.appendSwitch('disable-features', 'AutofillUsernamePrefixSuggestion');
app.commandLine.appendSwitch('disable-features', 'AutofillShowTypePredictions');
app.commandLine.appendSwitch('disable-features', 'AutofillShowManualFallbackForTypePrefix');
app.commandLine.appendSwitch('disable-features', 'Autofill');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      sandbox: false, // 如果遇到权限问题，可以尝试设置为 false
      devTools: true // 允许开发者工具，但默认不打开
    },
    autoHideMenuBar: true,
  });

  // 默认隐藏开发者工具，只在开发环境下打开
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.closeDevTools();
  }

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 添加错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 禁用 macOS 的 TSM 警告
  if (process.platform === 'darwin') {
    process.env.TSM_DISABLE_WARNING = 'true';
  }

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 处理连接语法
const processFlowchartCode = (lines, isVertical) => {
  // 处理连接语法
  lines = lines.map(line => {
    // 标准化箭头
    line = line.replace(/-->/g, ' --> ');
    line = line.replace(/=>/g, ' --> ');
    line = line.replace(/->/g, ' --> ');
    
    // 处理条件分支
    line = line.replace(/\|([^|]+)\|/g, '|"$1"|');
    
    // 确保箭头两边有空格
    line = line.replace(/(\S)(-->)(\S)/g, '$1 --> $3');
    
    return line;
  });

  // 构建最终的图表代码
  const direction = isVertical ? 'TD' : 'LR';
  const styles = [
    'classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px',
    'classDef highlight fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px',
    'classDef decision fill:#fff3e0,stroke:#f57c00,stroke-width:2px'
  ].join('\n');

  // 组装最终代码
  let finalCode = [
    `graph ${direction}`,
    styles,
    ...lines
  ].join('\n');

  // 移除多余的空行
  finalCode = finalCode.replace(/\n{3,}/g, '\n\n');

  // 确保开始和结束节点使用highlight样式
  finalCode = finalCode.replace(/开始"]/g, '开始"]:::highlight');
  finalCode = finalCode.replace(/结束"]/g, '结束"]:::highlight');
  
  // 为判断节点添加decision样式
  finalCode = finalCode.replace(/\{([^}]+)\}/g, (match, content) => {
    return `{${content}}:::decision`;
  });

  return finalCode.trim();
};

// 处理流程图生成请求
ipcMain.handle('generate-flowchart', async (event, { prompt, isVertical }) => {
  let apiType, currentSettings;
  const startTime = new Date().getTime();

  try {
    // 获取当前设置
    currentSettings = settings.store.get();
    apiType = currentSettings.apiType;

    // 记录开始生成的日志，包含 API 信息
    logger.info('开始生成流程图', {
      prompt,
      isVertical,
      apiConfig: {
        type: apiType,
        url: currentSettings[apiType].url,
        model: currentSettings[apiType].model,
        // 不记录敏感信息如 API Key
        hasKey: !!currentSettings[apiType].key,
        ...(apiType === 'azure' ? { apiVersion: currentSettings[apiType].apiVersion } : {})
      }
    });

    // 检查 URL 是否有效
    if (!currentSettings[apiType]?.url) {
      throw new Error(`请先在设置中配置 ${apiType} 的 API URL`);
    }

    // 检查必要的认证信息
    if (apiType !== 'local' && !currentSettings[apiType]?.key) {
      throw new Error(`请先在设置中配置 ${apiType} 的 API Key`);
    }

    let response;
    if (apiType === 'local') {
      const url = currentSettings.local.url.trim();
      if (!url) throw new Error('本地模型 API URL 不能为空');

      response = await axios.post(currentSettings.local.url, {
        model: currentSettings.local.model,
        prompt: `请将以下文本转换为 Mermaid 流程图代码。
        只返回代码，不要其他解释。使用以下格式：
        graph ${isVertical ? 'TD' : 'LR'}
            A[开始] --> B[步骤1]
            B --> C[步骤2]
            C --> D[结束]
        
        需要转换的文本：
        ${prompt}`,
        stream: false
      });
    } else if (apiType === 'openai') {
      const url = currentSettings.openai.url.trim();
      const key = currentSettings.openai.key.trim();
      if (!url) throw new Error('OpenAI API URL 不能为空');
      if (!key) throw new Error('OpenAI API Key 不能为空');

      response = await axios.post(currentSettings.openai.url, {
        model: currentSettings.openai.model,
        messages: [{
          role: 'system',
          content: '你是一个专门生成 Mermaid 流程图代码的助手。只返回代码，不要其他解释。'
        }, {
          role: 'user',
          content: `请将以下文本转换为 Mermaid 流程图代码，使用 graph ${isVertical ? 'TD' : 'LR'} 格式：\n${prompt}`
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${currentSettings.openai.key}`,
          'Content-Type': 'application/json'
        }
      });
    } else if (apiType === 'azure') {
      const url = currentSettings.azure.url.trim();
      const key = currentSettings.azure.key.trim();
      const apiVersion = currentSettings.azure.apiVersion.trim();
      if (!url) throw new Error('Azure API URL 不能为空');
      if (!key) throw new Error('Azure API Key 不能为空');
      if (!apiVersion) throw new Error('Azure API 版本不能为空');

      response = await axios.post(currentSettings.azure.url, {
        model: currentSettings.azure.model,
        messages: [{
          role: 'system',
          content: '你是一个专门生成 Mermaid 流程图代码的助手。只返回代码，不要其他解释。'
        }, {
          role: 'user',
          content: `请将以下文本转换为 Mermaid 流程图代码，使用 graph ${isVertical ? 'TD' : 'LR'} 格式：\n${prompt}`
        }]
      }, {
        headers: {
          'api-key': currentSettings.azure.key,
          'Content-Type': 'application/json',
          'api-version': currentSettings.azure.apiVersion
        }
      });
    } else if (apiType === 'anthropic') {
      const url = currentSettings.anthropic.url.trim();
      const key = currentSettings.anthropic.key.trim();
      if (!url) throw new Error('Anthropic API URL 不能为空');
      if (!key) throw new Error('Anthropic API Key 不能为空');

      response = await axios.post(currentSettings.anthropic.url, {
        model: currentSettings.anthropic.model,
        messages: [{
          role: 'user',
          content: `请将以下文本转换为 Mermaid 流程图代码，使用 graph ${isVertical ? 'TD' : 'LR'} 格式：\n${prompt}`
        }],
        max_tokens: 1000
      }, {
        headers: {
          'x-api-key': currentSettings.anthropic.key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });
    } else if (apiType === 'deepseek') {
      const url = currentSettings.deepseek.url.trim();
      const key = currentSettings.deepseek.key.trim();
      if (!url) throw new Error('Deepseek API URL 不能为空');
      if (!key) throw new Error('Deepseek API Key 不能为空');

      response = await axios.post(currentSettings.deepseek.url, {
        model: currentSettings.deepseek.model,
        messages: [{
          role: 'system',
          content: '你是一个专门生成 Mermaid 流程图代码的助手。只返回代码，不要其他解释。'
        }, {
          role: 'user',
          content: `请将以下文本转换为 Mermaid 流程图代码，使用 graph ${isVertical ? 'TD' : 'LR'} 格式：\n${prompt}`
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${currentSettings.deepseek.key}`,
          'Content-Type': 'application/json'
        }
      });
    }

    let mermaidCode = apiType === 'local' 
      ? response.data.response
      : apiType === 'anthropic'
        ? response.data.content[0].text
        : response.data.choices[0].message.content;
    



        // 如果响应中没有 graph 方向设置，添加它
        const graphDirection = isVertical ? 'TD' : 'LR';
        if (!mermaidCode.includes(`graph ${graphDirection}`)) {
          mermaidCode = `graph ${graphDirection}\n` + mermaidCode;
        }
        
        // 清理可能的多余引号和格式
        mermaidCode = mermaidCode.replace(/```mermaid/g, '')
          .replace(/```/g, '')
          .trim();

    // 记录生成完成的详细信息
    logger.info('生成流程图完成', {
      apiType,
      model: currentSettings[apiType].model,
      promptLength: prompt.length,
      resultLength: mermaidCode.length,
      isVertical,
      mermaidCode,
      executionTime: new Date().getTime() - startTime
    });

    return mermaidCode;
  } catch (error) {
    logger.error('生成流程图失败', {
      error: {
        message: error.message,
        stack: error.stack
      },
      context: {
        apiType: apiType || 'unknown',
        model: currentSettings?.[apiType]?.model || 'unknown',
        url: currentSettings?.[apiType]?.url || 'unknown',
        promptLength: prompt?.length,
        isVertical
      }
    });
    console.error('Error generating flowchart:', error);
    throw error;
  }
});

// 处理渲染进程的错误日志
ipcMain.on('log-error', (event, { message, error }) => {
  logger.error(message, { error });
});

// 处理设置获取
ipcMain.handle('get-settings', () => {
  return {
    store: {
      store: settings.store.get()
    },
    API_CONFIGS: settings.API_CONFIGS
  };
});

// 处理设置保存
ipcMain.handle('save-settings', (event, newSettings) => {
  settings.store.set(newSettings);
  return settings.store.get();
});

// 处理开发者工具的切换
ipcMain.handle('toggle-devtools', () => {
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools();
  }
  return mainWindow.webContents.isDevToolsOpened();
});

// 获取开发者工具的状态
ipcMain.handle('is-devtools-opened', () => {
  return mainWindow.webContents.isDevToolsOpened();
});

// 处理获取示例文本的请求
ipcMain.handle('get-example-text', () => {
  return `1. 用户打开应用
2. 输入用户名和密码
3. 系统验证登录信息
4. 如果验证失败，显示错误信息并返回登录界面
5. 如果验证成功，进入主界面
6. 用户可以查看个人信息
7. 用户完成操作后退出系统`;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
