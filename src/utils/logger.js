const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    // 获取应用数据目录
    const userDataPath = app.getPath('userData');
    this.logDir = path.join(userDataPath, 'logs');
    
    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // 设置日志文件路径
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `flowchart-${date}.log`);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
    }
    
    logMessage += '\n----------------------------------------\n';

    fs.appendFileSync(this.logFile, logMessage);
    
    // 在开发环境下同时输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log(logMessage);
    }
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  error(message, error = null) {
    this.log('ERROR', message, error);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      this.log('DEBUG', message, data);
    }
  }
}

module.exports = new Logger(); 