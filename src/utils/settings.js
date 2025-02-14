const Store = require('electron-store');

// API 类型定义
const API_CONFIGS = {
  local: {
    name: '本地模型 (Ollama)',
    fields: [
      { id: 'url', label: 'API URL', type: 'text', placeholder: 'http://localhost:11434/api/generate' },
      { id: 'model', label: '模型名称', type: 'text', placeholder: 'mistral:7b' }
    ]
  },
  openai: {
    name: 'OpenAI',
    fields: [
      { id: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.openai.com/v1/chat/completions' },
      { id: 'key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { id: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-3.5-turbo' }
    ]
  },
  azure: {
    name: 'Azure OpenAI',
    fields: [
      { id: 'url', label: 'API URL', type: 'text', placeholder: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment-name/chat/completions' },
      { id: 'key', label: 'API Key', type: 'password', placeholder: 'your-azure-api-key' },
      { id: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-35-turbo' },
      { id: 'apiVersion', label: 'API 版本', type: 'text', placeholder: '2023-05-15' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    fields: [
      { id: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.anthropic.com/v1/messages' },
      { id: 'key', label: 'API Key', type: 'password', placeholder: 'your-anthropic-api-key' },
      { id: 'model', label: '模型名称', type: 'text', placeholder: 'claude-2.1' }
    ]
  },
  deepseek: {
    name: 'Deepseek',
    fields: [
      { id: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.deepseek.com/v1/chat/completions' },
      { id: 'key', label: 'API Key', type: 'password', placeholder: 'your-deepseek-api-key' },
      { id: 'model', label: '模型名称', type: 'text', placeholder: 'deepseek-chat' }
    ]
  }
};

// 创建默认配置
const createDefaultSettings = () => {
  // 基础配置
  const settings = {
    apiType: 'local'
  };

  // 为每个 API 类型创建配置
  Object.entries(API_CONFIGS).forEach(([key, config]) => {
    settings[key] = {};
    config.fields.forEach(field => {
      settings[key][field.id] = field.placeholder || '';
    });
  });

  return settings;
};

const store = new Store({ 
  defaults: createDefaultSettings(),
  clearInvalidConfig: true
});

const settings = {
  store: {
    get: () => store.store,
    set: (value) => {
      // 确保设置包含所有必要的默认值
      const defaults = createDefaultSettings();
      const newSettings = {
        ...defaults,
        ...value,
        // 确保每个 API 类型的配置都完整
        ...Object.keys(API_CONFIGS).reduce((acc, key) => {
          acc[key] = { ...defaults[key], ...value[key] };
          return acc;
        }, {})
      };
      store.set(newSettings);
      return store.store;
    }
  },
  API_CONFIGS
};

// 初始化时确保配置正确
const initialSettings = settings.store.get();
if (!initialSettings.local?.url) {
  // 如果没有正确的配置，重置为默认值
  settings.store.set(createDefaultSettings());
}

module.exports = settings;