# 织流 AI（ZhiFlow）

AI 工作流可视化编排工具。通过自然语言生成工作流，在画布上连接文本、图片与视频模型，配置节点参数并查看执行结果。支持知识库管理，以及云朵漫画、人生副本智能体创作。

- 在线访问：https://langchain.leheavengame.com/
- 代码仓库：https://github.com/hujinbin/LangChainWeb
- 技术栈为 React 19、TypeScript、React Flow、Zustand、Axios、Create React App 5。
- 访客可编排并保存本地草稿；登录后可同步和运行工作流。模型调用依赖后端服务与账号权限。

前端项目位于 `E:\github\LangChainWeb`，业务代码使用严格 TypeScript，源码入口为 `src/App.tsx`。前端开发建议使用 Node.js 20+，Jue 后端的运行目标为 Node.js 16.20.2。

## 功能

- 工作流支持对话生成、画布编辑、节点参数配置、保存、执行与结果查看。
- 知识库支持文档导入、索引与检索测试。
- `/agents` 提供云朵漫画与人生副本，支持对话设计分镜、手工编辑保存、生成进度、停止任务、逐镜重做和恢复生成。
- 云朵漫画默认采用 4 格、3:4、1K，支持 3～5 格。图片保持无字，4～24 字文案由页面和导出排版，可下载漫画长图 PNG。
- 人生副本默认采用 10 镜 × 12 秒、16:9、720P，最多 20 镜，每镜 4～12 秒。合成保留源音轨，添加标题与字幕，已完成视频可下载 MP4。
- 智能体支持 JSON、Markdown、HTML 与 ZIP 导出，模型选项采用后端 Flash 白名单。

## 本地开发

在本仓库根目录执行。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

默认开发地址为 `http://localhost:3000`，智能体入口为 `/agents`。

| 环境变量 | 用途 |
| --- | --- |
| `REACT_APP_PROXY_TARGET` | 开发代理的 Jue 地址，默认 `https://jue.leheavengame.com` |
| `REACT_APP_API_URL` | 浏览器直接请求的 API 域名，留空使用同源 `/api` |

修改开发代理配置后需重启开发服务。跨域直连时，Jue 需允许前端来源和鉴权请求头。

## 检查与构建

```sh
npm run typecheck
npm test -- --watchAll=false --runInBand
npm run build
npm run check:seo
```

构建产物位于 `build/`。静态托管需将前端路由回退到 `index.html`，并将 `/api` 转发到 Jue。`REACT_APP_API_URL` 在构建时读取。CRA 开发代理入口沿用 `src/setupProxy.js`。

## 后端与视频合成

后端代码位于 `E:\gitee\jue`，智能体 API 前缀为 `/api/aiAgents`，沿用 Jue 账号登录令牌。项目、任务、素材引用和视频任务 ID 持久化保存，已完成素材可用于续跑。提交结果未知时，页面会提示核查上游任务，再明确选择重新生成。

人生视频合成需要在 Jue 服务端安装 FFmpeg 和中文字体，配置 `AI_AGENT_FFMPEG_PATH`、`AI_AGENT_FONT_PATH` 与私有素材目录。旁白稿用于字幕和脚本导出，当前无独立 TTS。开启分镜参考图时，视频上游需要公开 HTTPS 图片地址，图片服务仅返回 Base64 时会保留图片并提示处理。

完整 API、环境配置和任务恢复说明见 Jue 仓库的 `docs/ai-workflow/AI_AGENTS.md`，环境模板为其根目录 `.env.agents.example`。
