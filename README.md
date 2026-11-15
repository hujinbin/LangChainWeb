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

## 网站名称与 SEO

“织流”表示把节点、模型和创作步骤编织成工作流，英文名为 ZhiFlow。仓库名称保留 LangChainWeb，产品名称统一为织流 AI。

品牌和站点元数据集中在 `src/config/site.js`。开发启动及生产构建前，`scripts/seo.cjs` 自动更新 HTML 标题、描述、canonical、Open Graph / Twitter 分享信息、WebSite / WebApplication 结构化数据、应用清单、robots.txt 和 sitemap.xml。分享图片为 `public/social-preview.png`，矢量源文件与品牌图标位于同一目录。

首页 HTML 包含可直接读取的产品介绍，应用加载后替换为工作台；内容与工作台提供的功能一致。站点地图只包含公开首页。登录页、个人工作流、编辑器和执行记录使用 `noindex`，不把账号内容当作公开搜索页面。robots.txt 不屏蔽这些页面，以便爬虫读取 noindex。

生产构建还会输出登录、工作流列表、执行列表的静态 HTML，以及 `app.html` 和 `404.html`。部署时为这些页面配置对应的静态文件路由，保留已有 API 代理和 HTTPS 配置；动态工作流地址应使用 `app.html`，未知地址应返回 HTTP 404，避免所有地址都返回可索引的首页。

部署后检查首页源码、分享图、`/robots.txt`、`/sitemap.xml`，以及深层地址的 `X-Robots-Tag` 与 404 状态。再通过站点已验证的搜索平台提交 sitemap；本地修改和构建不会自动发布，也不会自动完成收录。
