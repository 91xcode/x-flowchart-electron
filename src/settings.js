const Store = require('electron-store');
const store = new Store();

// API 类型定义
const API_TYPES = {
  local: {
    name: '本地模型 (Ollama)',
    fields: [
      { name: 'url', label: 'API URL', type: 'text', placeholder: 'http://localhost:11434/api/generate' },
      { name: 'model', label: '模型名称', type: 'text', placeholder: 'mistral:7b' }
    ]
  },
  openai: {
    name: 'OpenAI',
    fields: [
      { name: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.openai.com/v1/chat/completions' },
      { name: 'key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { name: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-3.5-turbo' }
    ]
  },
  azure: {
    name: 'Azure OpenAI',
    fields: [
      { name: 'url', label: 'API URL', type: 'text', placeholder: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment-name/chat/completions' },
      { name: 'key', label: 'API Key', type: 'password', placeholder: 'your-azure-api-key' },
      { name: 'model', label: '模型名称', type: 'text', placeholder: 'gpt-35-turbo' },
      { name: 'apiVersion', label: 'API 版本', type: 'text', placeholder: '2023-05-15' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    fields: [
      { name: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.anthropic.com/v1/messages' },
      { name: 'key', label: 'API Key', type: 'password', placeholder: 'your-anthropic-api-key' },
      { name: 'model', label: '模型名称', type: 'text', placeholder: 'claude-2.1' }
    ]
  }
};

// 当前编辑的配置
let currentEditingConfig = null;

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
  loadConfigurations();
  setupEventListeners();
});

// 加载所有配置
function loadConfigurations() {
  const configList = document.querySelector('.config-list');
  configList.innerHTML = '';
  
  const configs = store.get('configurations') || [];
  
  configs.forEach(config => {
    const card = createConfigCard(config);
    configList.appendChild(card);
  });
}

// 创建配置卡片
function createConfigCard(config) {
  const card = document.createElement('div');
  card.className = 'config-card';
  
  card.innerHTML = `
    <div class="config-header">
      <h3 class="config-title">${config.name}</h3>
      <div class="config-actions">
        <button class="action-button use-config" data-id="${config.id}">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </button>
        <button class="action-button edit-config" data-id="${config.id}">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
        <button class="action-button delete-config" data-id="${config.id}">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="config-details">
      <div class="detail-item">
        <span class="detail-label">API 类型:</span>
        <span>${API_TYPES[config.apiType].name}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">API URL:</span>
        <span>${config.url}</span>
      </div>
    </div>
  `;
  
  return card;
}

// 设置事件监听器
function setupEventListeners() {
  const addButton = document.getElementById('add-config');
  const modal = document.getElementById('config-modal');
  const closeModal = document.getElementById('close-modal');
  const configForm = document.getElementById('config-form');
  const apiTypeSelect = document.getElementById('api-type');
  
  addButton.addEventListener('click', () => {
    currentEditingConfig = null;
    document.getElementById('modal-title').textContent = '添加新配置';
    configForm.reset();
    updateConfigFields(apiTypeSelect.value);
    modal.style.display = 'block';
  });
  
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  apiTypeSelect.addEventListener('change', (e) => {
    updateConfigFields(e.target.value);
  });
  
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveConfiguration();
  });
  
  // 编辑和删除按钮的事件委托
  document.querySelector('.config-list').addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    
    const configId = button.dataset.id;
    if (button.classList.contains('use-config')) {
      const success = await window.electronAPI.useConfiguration(configId);
      if (success) {
        alert('配置已应用');
      }
    } else if (button.classList.contains('edit-config')) {
      editConfiguration(configId);
    } else if (button.classList.contains('delete-config')) {
      deleteConfiguration(configId);
    }
  });
  
  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// 更新配置字段
function updateConfigFields(apiType) {
  const configFields = document.getElementById('config-fields');
  configFields.innerHTML = '';
  
  API_TYPES[apiType].fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label for="${field.name}">${field.label}:</label>
      <input type="${field.type}" id="${field.name}" name="${field.name}"
             placeholder="${field.placeholder}" required>
    `;
    configFields.appendChild(div);
  });
}

// 保存配置
function saveConfiguration() {
  const formData = new FormData(document.getElementById('config-form'));
  const config = {
    id: currentEditingConfig ? currentEditingConfig.id : Date.now().toString(),
    name: formData.get('config-name'),
    apiType: formData.get('api-type'),
  };
  
  // 添加 API 类型特定的字段
  API_TYPES[config.apiType].fields.forEach(field => {
    config[field.name] = formData.get(field.name);
  });
  
  // 获取现有配置
  const configs = store.get('configurations') || [];
  
  if (currentEditingConfig) {
    // 更新现有配置
    const index = configs.findIndex(c => c.id === currentEditingConfig.id);
    if (index !== -1) {
      configs[index] = config;
    }
  } else {
    // 添加新配置
    configs.push(config);
  }
  
  // 保存配置
  store.set('configurations', configs);
  
  // 重新加载配置列表
  loadConfigurations();
  
  // 关闭模态框
  document.getElementById('config-modal').style.display = 'none';
}

// 编辑配置
function editConfiguration(configId) {
  const configs = store.get('configurations') || [];
  const config = configs.find(c => c.id === configId);
  if (!config) return;
  
  currentEditingConfig = config;
  
  document.getElementById('modal-title').textContent = '编辑配置';
  document.getElementById('config-name').value = config.name;
  document.getElementById('api-type').value = config.apiType;
  
  updateConfigFields(config.apiType);
  
  // 填充字段值
  API_TYPES[config.apiType].fields.forEach(field => {
    document.getElementById(field.name).value = config[field.name] || '';
  });
  
  document.getElementById('config-modal').style.display = 'block';
}

// 删除配置
function deleteConfiguration(configId) {
  if (!confirm('确定要删除这个配置吗？')) return;
  
  const configs = store.get('configurations') || [];
  const newConfigs = configs.filter(c => c.id !== configId);
  store.set('configurations', newConfigs);
  
  loadConfigurations();
} 