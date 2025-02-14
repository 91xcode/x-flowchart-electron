document.addEventListener('DOMContentLoaded', () => {
  // 初始化 Mermaid
  mermaid.initialize({ startOnLoad: true });

  const promptTextarea = document.getElementById('prompt');
  const generateButton = document.getElementById('generate');
  const diagramDiv = document.getElementById('diagram');
  const directionToggle = document.getElementById('direction-toggle');

  // 存储最后一次生成的代码
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

  // 监听方向切换
  directionToggle.addEventListener('change', () => {
    lastGeneratedCode = updateDirection(lastGeneratedCode, directionToggle.checked);
  });

  generateButton.addEventListener('click', async () => {
    const prompt = promptTextarea.value;
    if (!prompt) return;

    try {
      generateButton.disabled = true;
      const isVertical = directionToggle.checked;
      
      const mermaidCode = await window.electronAPI.generateFlowchart(prompt, isVertical);
      lastGeneratedCode = mermaidCode; // 保存生成的代码
      
      // 显示流程图
      updateDirection(mermaidCode, isVertical);
    } catch (error) {
      console.error('Error:', error);
      // 通过 IPC 发送错误信息给主进程记录
      window.electronAPI.logError('渲染流程图失败', error.message);
      diagramDiv.innerHTML = `<p class="error">生成流程图时出错: ${error.message}</p>`;
      lastGeneratedCode = ''; // 清除保存的代码
    } finally {
      generateButton.disabled = false;
    }
  });
}); 