# 织流 AI（ZhiFlow）

AI 工作流可视化编排工具。通过自然语言生成工作流，在画布上连接文本、图片与视频模型，配置节点参数并查看执行结果。支持知识库管理，以及云朵漫画、人生副本智能体创作。

- 在线访问：https://langchain.leheavengame.com/
- 代码仓库：https://github.com/hujinbin/LangChainWeb
- 技术栈为 React 19、TypeScript、React Flow、Zustand、Axios、Create React App 5。
- 访客可编排并保存本地草稿；登录后可同步和运行工作流。模型调用依赖后端服务与账号权限。

项目使用严格 TypeScript，源码入口为 `src/App.tsx`，前端开发建议使用 Node.js 20+。

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
| `REACT_APP_PROXY_TARGET` | 开发环境的后端 API 代理地址 |
| `REACT_APP_API_URL` | 浏览器直接请求的 API 域名，留空使用同源 `/api` |

修改开发代理配置后需重启开发服务。跨域直连时，后端服务需允许前端来源和鉴权请求头。

## 检查与构建

```sh
npm run typecheck
npm test -- --watchAll=false --runInBand
npm run build
npm run check:seo
npm run check:proxy
```

`typecheck` 同时执行前端和工具脚本的严格类型检查，生产构建也会先执行这两项检查。SEO 脚本与代理配置通过 `tsx` 运行，`tsx` 不替代 `tsc` 类型检查。`check:proxy` 仅使用本地测试服务器验证转发和流式回复，无需访问真实模型。

构建产物位于 `build/`。静态托管需将前端路由回退到 `index.html`，并将 `/api` 转发到后端服务。`REACT_APP_API_URL` 在构建时读取。

## TypeScript 项目结构

| 位置 | 用途 |
| --- | --- |
| `src/**/*.ts`、`src/**/*.tsx` | 页面、组件、接口、状态与业务类型 |
| `tsconfig.json` | 浏览器代码严格类型检查，`strict: true`、`allowJs: false` |
| `scripts/seo.ts`、`scripts/check-seo.ts` | SEO 生成与构建结果检查，共享同一份 TS 站点配置 |
| `scripts/setupProxy.ts` | 开发代理实现 |
| `tsconfig.tools.json` | Node 工具脚本与代理配置的严格类型检查 |

`src/setupProxy.js` 仅保留 CRA 固定文件名要求的加载桥接，代理逻辑全部位于 `scripts/setupProxy.ts`。该入口直接加载受类型检查的 TS 配置，不维护第二份 JavaScript 实现。

## 服务端技术概述

服务端使用 Node.js 与 Koa 提供业务接口，结合 LangChain、LangGraph 完成工作流编排和模型调用。MongoDB 保存项目与任务状态，Zilliz 向量检索支持知识库问答。

图文与视频生成采用统一的模型调用流程，保存分镜和任务状态以支持进度查看与失败恢复。视频使用 FFmpeg 合成多段画面、字幕和源音轨，输出可预览和下载的成片。
