// 在所有 require 之前设置环境变量
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 'false';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const started = require('electron-squirrel-startup');
const axios = require('axios');
const logger = require('./utils/logger');

// 在创建窗口前禁用功能
app.commandLine.appendSwitch('disable-features', 'AutofillUsernamePrefixSuggestion');
app.commandLine.appendSwitch('disable-features', 'AutofillShowTypePredictions');
app.commandLine.appendSwitch('disable-features', 'AutofillShowManualFallbackForTypePrefix');
app.commandLine.appendSwitch('disable-features', 'Autofill');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: process.env.NODE_ENV === 'development',
    },
    autoHideMenuBar: true,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 只在开发环境打开 DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
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

// 处理流程图生成请求
ipcMain.handle('generate-flowchart', async (event, { prompt, isVertical }) => {
  try {
    logger.info('开始生成流程图', { prompt, isVertical });

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "mistral:7b",
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

    logger.debug('收到 AI 响应', { response: response.data });

    let mermaidCode = response.data.response;
    
    // 如果响应中没有 graph 方向设置，添加它
    const graphDirection = isVertical ? 'TD' : 'LR';
    if (!mermaidCode.includes(`graph ${graphDirection}`)) {
      mermaidCode = `graph ${graphDirection}\n` + mermaidCode;
    }
    
    // 清理可能的多余引号和格式
    mermaidCode = mermaidCode.replace(/```mermaid/g, '')
      .replace(/```/g, '')
      .trim();
    
    logger.info('生成流程图完成', { mermaidCode });
    return mermaidCode;
  } catch (error) {
    logger.error('生成流程图失败', {
      error: {
        message: error.message,
        stack: error.stack
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
