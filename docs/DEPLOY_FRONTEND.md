# 前端自助部署指南

本仓库开源用户工作台和[代理商后台前端](../src/partner/)。静态页面随同一前端构建发布，登录、授权及数据读写由官方或自有服务提供。

## 1. 部署方式

已有静态网关时，首次在仓库根目录运行 `npm ci` 安装依赖。此后每次发布运行 `npm run build`，即可将生成的 `build/` 整体交给网关。

### 1.1 Docker（推荐）

```bash
cp .env.docker.example .env
# 修改 .env 里的 API_UPSTREAM / PARTNER_UPSTREAM / BRAND_NAME
docker compose up -d --build
```

首次启动后检查服务健康状态与配置。

```bash
docker compose ps
curl -fsS http://localhost/healthz
curl -fsS http://localhost/config.js
```

通过已登记的站点域名打开首页，从导航进入「用量总览」「API 文档」或「代理商后台」。`/docs` 与 `/api-reference/openapi.yaml` 可直接浏览。`/partner/` 由本地静态服务器提供页面，浏览器通过同源 `/partner/api/` 连接代理商服务。首次开通由平台管理员在总后台登记域名并给本站账号分配代理商管理员或运营角色。

同一份 Dockerfile 支持 `linux/amd64` 和 `linux/arm64`。可在本机只生成 OCI 文件进行检查：

```bash
docker buildx build --platform linux/amd64,linux/arm64 --output type=oci,dest=langchainweb.oci .
```


### 1.2 本地构建静态资源

```bash
npm run build
```

将 `build/` 的全部内容放在网关的静态站点根目录。工作台位于 `/`，API 文档位于 `/docs`，代理商后台使用 `build/partner/` 对应的 `/partner/`。将公开 `/api/` 与 `/outputs/` 转发至业务后端，将 `/partner/api/` 和 `/partner/healthz` 转发至代理商服务并保留原始 Host（含端口）。客户域名应屏蔽 `/api/admin/` 与 `/api/partner-internal/`。为前端路由配置 SPA fallback 到 `index.html`。

## 2. 运行时配置

容器启动脚本会把环境变量写入 `/config.js`，页面加载时读取 `window.__JUE_CONFIG__`。修改 Compose 环境变量后执行 `docker compose up -d --no-build --force-recreate`，让新容器读取配置。

| 环境变量 | 说明 | 默认 |
| --- | --- | --- |
| `PUBLIC_API_BASE_URL` | 浏览器访问的 API 根地址；留空使用同源 `/api` | 空 |
| `API_UPSTREAM` | 服务端源站地址，包含协议和可选端口，路径留空 | `https://jue.leheavengame.com` |
| `PARTNER_UPSTREAM` | 代理商服务入口，只接收 `/partner/api/` 和 `/partner/healthz` | `https://jue.leheavengame.com` |
| `SITE_ID` | 固定站点标识；留空时后端按域名识别 | 空 |
| `PARTNER_PATH` | 同域后台入口，可设为跳转至 `/partner/` 的本地别名 | `/partner/` |
| `WEB_BIND` / `WEB_PORT` | 宿主机监听地址与端口 | `0.0.0.0` / `80` |
| `PUBLIC_SCHEME` | 外部访问协议，在前置代理终止 TLS 时设为 `https` | 容器接收的请求协议 |
| `BRAND_NAME` | 首屏品牌名兜底，最终以后端站点配置为准 | 空 |
| `LOGO_URL` / `FAVICON_URL` | 首屏品牌图片兜底 | 空 |
| `DEFAULT_THEME` | `auto` / `light` / `dark` | `auto` |
| `HELP_URL` | 帮助中心地址 | 空 |
| `QQ_GROUP` | 交流群号 | 空 |

> 只允许公开字段。API Secret、数据库口令、JWT 私钥禁止写入前端配置。

## 3. 域名与站点

1. 先部署前端，确认 `http://服务器IP` 可访问。
2. 首个域名由平台管理员登记。代理商管理员可登录已有域名，在「站点设置」中维护其他绑定域名。
3. 把域名 A/AAAA 记录解析到当前服务器。
4. 代理商后台位于 `https://你的域名/partner/`。旧书签 `/admin/` 在客户域名跳转到此处。

未登记域名访问时，前端会展示可读提示；站点停用时展示维护提示，不会白屏。

## 4. HTTPS

方案一：云厂商证书 + Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    ssl_certificate     /etc/nginx/cert/example.com.pem;
    ssl_certificate_key /etc/nginx/cert/example.com.key;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

方案二：Caddy

```caddy
example.com {
    reverse_proxy 127.0.0.1:8080
}
```

`docker-compose.yml` 默认把宿主机 80 映射到容器 8080。若外层已有 Nginx/Caddy，在 `.env` 配置 `WEB_BIND=127.0.0.1`、`WEB_PORT=8080`、`PUBLIC_SCHEME=https`，上述代理即可通过回环端口转发。

## 5. 切换后端

官方模式沿用示例的 API 源站。将部署域名登记到站点后，Nginx 向上游透传原站点的 Host。官方部署需在官方网关把 `/partner/api/` 和 `/partner/healthz` 挂到独立代理商服务。前端镜像默认指向该网关；使用其他运营方时，将 `PARTNER_UPSTREAM` 换成对方提供的代理商服务源站。平台总后台由管理员从平台管理域名访问。

自有后端需要按[前端兼容契约](./open-api/OPEN_API.md)实现页面接口。假设自有后端在同一宿主机的 3000 端口运行，并可从 Docker 网桥访问，设置如下。

```dotenv
PUBLIC_API_BASE_URL=
API_UPSTREAM=http://host.docker.internal:3000
PARTNER_UPSTREAM=http://host.docker.internal:4200
```

此时浏览器继续请求同域 `/api/*`，Nginx 从前端构建提供代理商页面，把 `/partner/api/*` 与 `/partner/healthz` 转发至代理商服务，其余公开业务 API 发往核心服务。上游需接受部署域名的 Host，HTTPS 源站证书需与 `API_UPSTREAM` 或 `PARTNER_UPSTREAM` 指定的主机名匹配。使用私有 CA 时，将服务端信任的 CA 证书包以只读方式挂载到 `/etc/ssl/certs/ca-certificates.crt`。

浏览器也可跨域直接连接 API。在 `PUBLIC_API_BASE_URL` 填写源站 URL，并在该后端为站点配置 CORS 来源、`token`、`Authorization` 与 `X-Site-Id`。页面资源和同域后台仍使用 Nginx 的源站配置。生产环境建议使用 HTTPS。

## 6. 升级

```bash
git pull
docker compose up -d --build
```

镜像内静态资源带内容 hash，可长期缓存；`/config.js` 与 `index.html` 不缓存，升级后刷新即生效。

## 7. 排错

| 现象 | 排查 |
| --- | --- |
| 页面白屏 | 检查 `/config.js` 是否可访问；浏览器控制台是否有语法错误 |
| 登录 401/400 | 检查 `token` 请求头是否被反代丢弃；后端是否允许当前域名 |
| 接口 404 | 检查源站是否形如 `https://api.example.com`，确认上游提供原始 `/api/*` 路径 |
| 代理商页面打开后接口返回 502 | 检查 `PARTNER_UPSTREAM` 能否从前端容器访问，并请求对应服务的 `/partner/healthz` |
| 提示域名未登记 | 由平台管理员登记首个域名，或从已有域名登录代理商后台添加新域名 |
| 跨域错误 | 使用同源 `/api` 反代，或配置后端 CORS 白名单 |
