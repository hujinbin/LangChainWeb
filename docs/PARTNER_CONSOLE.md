# 代理商后台前端

后台入口为 `/partner/`，API 密钥页可直接访问 `/partner/#keys`。登录页和侧栏都提供工作台与 API 文档入口。页面使用 React 19 和 TypeScript，组件、表单和请求封装在 [src/partner](../src/partner/)，入口为 `index.tsx`。

## 开发和部署

在仓库根目录执行 `npm ci` 和 `npm start`，然后打开 `http://localhost:3000/partner/`。修改 TSX 后刷新开发页面即可读取最新代码。执行 `npm run build` 构建整站，或执行 `npm run build:partner` 单独生成代理商后台。两种方式的代理商静态产物都位于 `build/partner/`。让静态服务器将 `/partner/` 解析为该目录的 `index.html`，并按原路径提供其中的 CSS 和 JavaScript 文件。

仅发布静态文件即可查看登录页。登录和管理操作需要运营方提供代理商 API，或由部署者配置兼容服务。网关应将同源 `/partner/api/*` 转发给该服务，保留请求路径和原始 Host（含非默认端口）。部署变量和上游配置见[前端部署指南](./DEPLOY_FRONTEND.md)。

## 页面读写权限

| 功能 | 站点运营（80） | 站点管理员（90） |
| --- | --- | --- |
| 站点概况、用量趋势和导出、成员查询、调用审计 | 查看 | 查看 |
| 站点资料、域名和其他站点设置 | 查看 | 查看、修改 |
| API 密钥 | 无权限 | 创建、修改、轮换、撤销 |

页面以 `GET /partner/api/session` 恢复当前站点的会话，通过 `POST /partner/api/login` 登录，`POST /partner/api/logout` 退出。浏览器使用同源 Cookie，登录凭据和新创建的 API Secret 均不写入浏览器存储。后端负责校验会话、角色与站点归属。公共前端配置只需接入地址，不应包含服务端凭据。
