```
1.要点：
做一个小工具 使用AI 画流程图 不使用Typora
首先，生成流程图代码部分可以使用AI，
比如调用OpenAI的API来处理自然语言 或者本地使用ollama部署的模型 访问http://localhost:11434/api/generate，
生成Mermaid或PlantUML代码。然后，渲染部分可以使用现有的库，比如在Web应用中使用Mermaid.js。对于图形界面，可以选择Electron（用于跨平台桌面应用），或者直接构建一个Web应用。


2.默认是本地ollama部署的 模型

3.执行

ollama serve

npm install 

npm start

```