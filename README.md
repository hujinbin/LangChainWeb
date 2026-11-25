# 织流 AI（ZhiFlow）

AI 工作流可视化编排工具。通过自然语言生成工作流，在画布上连接文本、图片与视频模型，配置节点参数并查看执行结果。支持知识库管理，以及云朵漫画、人生副本、小说写作智能体。

- 在线访问：https://langchain.leheavengame.com/
- 代码仓库：https://github.com/hujinbin/LangChainWeb
- 技术栈为 React 19、TypeScript、React Flow、Zustand、Axios、Create React App 5。
- 访客可编排并保存本地草稿；登录后可同步和运行工作流。模型调用依赖后端服务与账号权限。

项目使用严格 TypeScript，源码入口为 `src/App.tsx`，前端开发建议使用 Node.js 22.12+。

## 功能

- 工作流支持对话生成、画布编辑、节点参数配置、保存、执行与结果查看。
- 知识库支持文档导入、索引与检索测试。
- `/agents` 提供云朵漫画、人生副本和小说写作，支持对话设计分镜、手工编辑保存、生成进度、停止任务、逐镜重做和恢复生成。
- 云朵漫画默认采用 4 格、3:4、1K，支持 3～5 格。图片保持无字，4～24 字文案由页面和导出排版，可下载漫画长图 PNG。
- 人生副本默认采用 10 镜 × 12 秒、16:9、720P，最多 20 镜，每镜 4～12 秒。合成保留源音轨，添加标题与字幕，已完成视频可下载 MP4。
- 智能体支持 JSON、Markdown、HTML 与 ZIP 导出，工作流与智能体的模型选项随本站启用目录更新。

- 登录后可在「用量总览」查看个人消费趋势。开放接口文档位于 `/docs`，代理商从同域 `/partner/` 登录独立后台，管理本站配置与 API 密钥、查看成员和用量。

## 浏览器发布助手

智能体目录可按文本、文生图、生视频筛选。打开已完成的工作流结果、漫画、视频或小说章节，点击「发送到发布助手」。草稿保存在当前 Chrome 浏览器，插件源码在 [extension](extension/)。

1. 从本站 `/downloads/zhiflow-publisher.zip` 下载并解压。在 `chrome://extensions` 开启开发者模式，选择「加载已解压的扩展程序」，然后刷新工作台。开发时也可直接加载 `extension/.output/chrome-mv3/`。
2. 在工具栏打开「织流发布助手」，检查标题、正文、标签及素材，选择目标平台并授予该平台的访问权限。
3. 使用已登录的创作者账号进入文章、章节、图文或视频的编辑页，在插件内填充。默认在完整填充后自动保存草稿。查看逐项结果和平台保存回执，最后在平台页面手动确认发布。

插件提供小红书、抖音、微信公众号、微信视频号、百家号、头条号、大鱼号、企鹅号、网易号、知乎、搜狐号、趣头条、番茄小说、晋江文学城、七猫、起点和咪咕的入口。可写字段取决于当前编辑器、账号权限和作品类型。找不到上传框、素材链接受限或没有草稿保存入口时，插件会提示需要手动完成的步骤。

默认接入 `https://langchain.leheavengame.com` 和本机 HTTP 开发站点。自建站点在构建前设置 `WXT_STUDIO_ORIGIN` 为完整 HTTPS 来源（例如 `https://studio.example.com`）。使用 Docker 构建时通过同名 build arg 传入。插件使用浏览器现有登录态，草稿传输在本机完成。

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
| `REACT_APP_PARTNER_PROXY_TARGET` | 独立代理商服务，默认 `http://127.0.0.1:4200` |
| `REACT_APP_API_URL` | 浏览器直接请求的 API 域名，留空使用同源 `/api` |

修改开发代理配置后需重启开发服务。跨域直连时，后端服务需允许前端来源和鉴权请求头。

## 构建与发布

首次在仓库根目录运行 `npm ci` 安装依赖。每次发布只需运行一条构建命令。

```sh
npm run build
```

将 `build/` 的全部内容部署到现有静态网关的站点根目录，即可从 `/` 打开工作台、从 `/partner/` 打开代理商后台、从 `/docs` 阅读 API 文档。静态托管需将前端路由回退到 `index.html`，将公开 `/api/` 与 `/outputs/` 转发到业务后端，将 `/partner/api/` 和 `/partner/healthz` 转发到代理商服务。运行时 `/config.js` 可为同一个构建指定 API 和品牌。

### 可选检查

```sh
npm run typecheck
npm test -- --watchAll=false --runInBand
npm run check:seo
npm run check:proxy
node --import tsx --test extension/tests/editor.test.ts extension/tests/queue-policy.test.ts
```

`typecheck` 检查前端和工具脚本的类型，`check:seo` 检查已生成的 `build/`，`check:proxy` 使用本地测试服务器验证代理转发与流式响应。

## 开源与许可证

- 织流发布助手、用户工作台与[代理商后台前端](./src/partner/)均采用 [MIT](./LICENSE) 许可证。代理商页面的开发与接入见[代理商前端说明](./docs/PARTNER_CONSOLE.md)。业务 API、会话服务和平台总后台由运营方私有部署。
- 部署说明见 [docs/DEPLOY_FRONTEND.md](./docs/DEPLOY_FRONTEND.md)，安全边界见 [SECURITY.md](./SECURITY.md)。
- 运行时配置入口为 `public/config.js`（容器启动时根据环境变量重新生成），优先于构建期环境变量。
- 开放 API 与自有后端兼容契约见 [docs/open-api/OPEN_API.md](./docs/open-api/OPEN_API.md)。

### Docker 部署

```bash
cp .env.docker.example .env
docker compose up -d --build
```

默认代理到官方后端。使用自有后端时，在 `.env` 将 `API_UPSTREAM` 设为自有源站，`PARTNER_UPSTREAM` 指向独立代理商服务。客户站点上的旧 `/admin/` 入口自动转到 `/partner/`。运行 `docker compose up -d --no-build --force-recreate` 应用新配置。镜像支持 Linux amd64 和 arm64。


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
