# 织流 AI（ZhiFlow）

AI 工作流可视化编排工具。通过自然语言生成工作流，在画布上连接文本、图片与视频模型，配置节点参数并查看执行结果。

- 在线访问：https://langchain.leheavengame.com/
- 代码仓库：https://github.com/hujinbin/LangChainWeb
- 技术栈：React、React Flow、Zustand、Axios、Create React App。
- 访客可编排并保存本地草稿；登录后可同步和运行工作流。模型调用依赖后端服务与账号权限。

## 本地开发

```sh
npm ci
npm run dev
```

参考 `.env.example` 配置开发代理或 API 域名。默认开发地址为 `http://localhost:3000`。

```sh
npm test -- --watchAll=false
npm run build
npm run check:seo
```