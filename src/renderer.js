// 确保 DOM 完全加载后再执行
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 初始化 Mermaid（确保已经加载）
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        }
      });
    } else {
      console.error('Mermaid library not loaded!');
    }

    // 获取所有 DOM 元素
    const promptInput = document.getElementById('prompt');
    if (!promptInput) throw new Error('Cannot find prompt input element');

    const generateButton = document.getElementById('generate');
    if (!generateButton) throw new Error('Cannot find generate button element');

    const exampleButton = document.getElementById('exampleButton');
    if (!exampleButton) throw new Error('Cannot find example button element');

    const diagramDiv = document.getElementById('diagram');
    const directionToggle = document.getElementById('direction-toggle');
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsButton = document.getElementById('close-settings');
    const saveSettingsButton = document.getElementById('save-settings');
    const devToolsButton = document.getElementById('toggle-devtools');
    const apiTypeSelect = document.getElementById('api-type');
    const apiSettings = document.getElementById('api-settings');

    // 初始化变量
    let isGenerating = false;
    let lastGeneratedCode = '';

    // 更新流程图方向
    const updateDirection = (mermaidCode, isVertical) => {
      if (!mermaidCode) return;

      // 替换方向设置
      const newCode = mermaidCode.replace(
        /graph (LR|TD|TB)/,
        `graph ${isVertical ? 'TD' : 'LR'}`
      );

      // 清除之前的图表
      diagramDiv.innerHTML = '';
      
      // 创建新的图表容器
      const newDiv = document.createElement('div');
      newDiv.className = 'mermaid';
      newDiv.textContent = newCode;
      diagramDiv.appendChild(newDiv);
      
      // 重新渲染
      mermaid.init(undefined, '.mermaid');

      return newCode;
    };

    // 生成流程图
    async function generateFlowchart() {
      if (isGenerating) return;
      
      const prompt = promptInput.value.trim();
      if (!prompt) {
        showError('请输入流程描述');
        return;
      }

      try {
        isGenerating = true;
        generateButton.disabled = true;
        generateButton.innerHTML = '<span class="button-icon">🔄</span> 生成中...';

        const mermaidCode = await window.electronAPI.generateFlowchart(prompt, directionToggle.checked);
        lastGeneratedCode = mermaidCode;
        diagramDiv.innerHTML = '<div class="mermaid">' + mermaidCode + '</div>';
        
        // 重新渲染图表
        mermaid.init(undefined, document.querySelector('.mermaid'));
      } catch (error) {
        console.error('生成流程图失败:', error);
        showError('生成失败: ' + error.message);
        window.electronAPI.logError('生成流程图失败', error);
      } finally {
        isGenerating = false;
        generateButton.disabled = false;
        generateButton.innerHTML = '<span class="button-icon">🔄</span> 生成流程图';
      }
    }

    // 事件监听器
    generateButton.addEventListener('click', generateFlowchart);
    promptInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        generateFlowchart();
      }
    });

    // 监听方向切换
    directionToggle.addEventListener('change', () => {
      lastGeneratedCode = updateDirection(lastGeneratedCode, directionToggle.checked);
    });

    // 设置相关函数
    function populateSettings(settings) {
      // 初始化 API 类型选择器
      apiTypeSelect.innerHTML = Object.entries(settings.API_CONFIGS)
        .map(([value, config]) => `<option value="${value}">${config.name}</option>`)
        .join('');
      
      // 设置当前选中的 API 类型
      apiTypeSelect.value = settings.store.store.apiType;
      
      // 生成并显示当前 API 类型的设置面板
      const panel = generateApiSettingsPanel(settings.store.store.apiType, settings.API_CONFIGS);
      apiSettings.innerHTML = '';
      apiSettings.appendChild(panel);
      
      // 填充设置值
      Object.entries(settings.API_CONFIGS).forEach(([type, config]) => {
        config.fields.forEach(field => {
          const input = document.getElementById(`${type}-${field.id}`);
          if (input) {
            input.value = settings.store.store[type]?.[field.id] || '';
          }
        });
      });
    }

    function generateApiSettingsPanel(apiType, apiConfigs) {
      const config = apiConfigs[apiType];
      if (!config) return document.createElement('div');

      const panel = document.createElement('div');
      panel.className = 'form-group';
      panel.id = `${apiType}-settings`;

      panel.innerHTML = config.fields
        .map(field => `
          <label>${field.label}:</label>
          <input type="${field.type}" 
                 id="${apiType}-${field.id}" 
                 placeholder="${field.placeholder}">
        `).join('');

      return panel;
    }

    function getSettingsFromForm() {
      const apiType = apiTypeSelect.value;
      const { API_CONFIGS } = window.electronAPI.getSettings();
      
      return {
        apiType,
        [apiType]: API_CONFIGS[apiType].fields.reduce((acc, field) => {
          acc[field.id] = document.getElementById(`${apiType}-${field.id}`).value;
          return acc;
        }, {})
      };
    }

    // 错误提示函数
    function showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error';
      errorDiv.textContent = message;
      document.querySelector('.input-section').appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }

    // 设置相关事件监听
    settingsButton.addEventListener('click', async () => {
      const settings = await window.electronAPI.getSettings();
      populateSettings(settings);
      settingsModal.style.display = 'block';
    });

    closeSettingsButton.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    saveSettingsButton.addEventListener('click', async () => {
      try {
        const newSettings = getSettingsFromForm();
        await window.electronAPI.saveSettings(newSettings);
        settingsModal.style.display = 'none';
      } catch (error) {
        showError('保存设置失败: ' + error.message);
      }
    });

    // API 类型切换处理
    apiTypeSelect.addEventListener('change', async (e) => {
      const settings = await window.electronAPI.getSettings();
      const panel = generateApiSettingsPanel(e.target.value, settings.API_CONFIGS);
      apiSettings.innerHTML = '';
      apiSettings.appendChild(panel);
    });

    // 开发者工具相关
    devToolsButton.addEventListener('click', async () => {
      const isOpened = await window.electronAPI.toggleDevTools();
      devToolsButton.classList.toggle('active', isOpened);
    });

    // 初始化开发者工具按钮状态
    window.electronAPI.isDevToolsOpened().then(isOpened => {
      devToolsButton.classList.toggle('active', isOpened);
    });

    // 添加示例按钮点击事件处理
    exampleButton.addEventListener('click', async () => {
      try {
        const exampleText = `用户打开系统后，需要先进行身份验证。如果用户已登录，则直接进入主页；如果未登录，则跳转到登录页面，用户输入账号和密码进行验证。

验证成功后，用户可以选择不同的功能模块，例如数据管理、报表查看或系统设置。若用户选择数据管理，可以上传、编辑或删除数据；若选择报表查看，则系统会根据数据生成相应的可视化报告；若进入系统设置，则可以修改个人信息或调整系统参数。

在任何操作过程中，如果出现错误，系统会给出相应的提示。用户完成操作后，可以选择退出系统，结束本次使用。`;
        
        promptInput.value = exampleText;
      } catch (error) {
        console.error('加载示例失败:', error);
        showError('加载示例失败: ' + error.message);
      }
    });
  } catch (error) {
    console.error('Initialization error:', error);
    // 显示错误到界面上
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = '初始化失败: ' + error.message;
    document.body.prepend(errorDiv);
  }
}); 