const Store = require('electron-store');

// 创建一个新的存储实例
const store = new Store({
  name: 'configurations', // 配置文件的名称
  defaults: {
    configurations: [] // 默认为空数组
  }
});

module.exports = Store; 