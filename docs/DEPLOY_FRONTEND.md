# 前端自助部署指南

本仓库只开源用户端前端。后端与管理端不提供源码，部署后通过官方后端或自有后端提供接口能力。

## 1. 部署方式

### 1.1 Docker（推荐）

```bash
cp .env.docker.example .env
# 修改 .env 里的 API_UPSTREAM / PUBLIC_API_BASE_URL / BRAND_NAME
docker compose up -d --build
```

部署完成后访问 `http://服务器IP`。

### 1.2 本地构建静态资源

```bash
npm ci
npm run build
```

将 `build/` 上传到任意静态托管，并把 `/api` 与 `/admin` 反向代理到后端。必须配置 SPA fallback 到 `index.html`。

## 2. 运行时配置

容器启动脚本会把环境变量写入 `/config.js`，页面加载时读取 `window.__JUE_CONFIG__`。修改配置后重启容器即可，无需重新构建镜像。

| 环境变量 | 说明 | 默认 |
| --- | --- | --- |
| `PUBLIC_API_BASE_URL` | 浏览器访问的 API 根地址；留空使用同源 `/api` | 空 |
| `API_UPSTREAM` | Nginx 将 `/api` 反代到的后端地址 | `http://host.docker.internal:3000` |
| `ADMIN_UPSTREAM` | Nginx 将 `/admin` 反代到的站点后台地址 | 同 `API_UPSTREAM` |
| `SITE_ID` | 固定站点标识；留空时后端按域名识别 | 空 |
| `ADMIN_PATH` | 站点后台路径 | `/admin` |
| `BRAND_NAME` | 首屏品牌名兜底，最终以后端站点配置为准 | 空 |
| `LOGO_URL` / `FAVICON_URL` | 首屏品牌图片兜底 | 空 |
| `DEFAULT_THEME` | `auto` / `light` / `dark` | `auto` |
| `HELP_URL` | 帮助中心地址 | 空 |
| `QQ_GROUP` | 交流群号 | 空 |

> 只允许公开字段。API Secret、数据库口令、JWT 私钥禁止写入前端配置。

## 3. 域名与站点

1. 先部署前端，确认 `http://服务器IP` 可访问。
2. 在站点后台填写要绑定的域名，保存后立即生效，不需要审核或 DNS 校验。
3. 把域名 A/AAAA 记录解析到当前服务器。
4. 站点后台地址默认同域 `https://你的域名/admin`。

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
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

方案二：Caddy

```caddy
example.com {
    reverse_proxy 127.0.0.1:8080
}
```

`docker-compose.yml` 默认把宿主机 80 映射到容器 8080。若外层已有 Nginx/Caddy，可把映射改成 `127.0.0.1:8080:8080`，只在外层暴露 443。

## 5. 切换后端

- 官方后端：`API_UPSTREAM` 指向官方 API 地址。
- 自有后端：`API_UPSTREAM` 指向自己的服务，并按 `docs/open-api/OPEN_API.md` 的“前端兼容契约”实现接口。
- 浏览器跨域直连时设置 `PUBLIC_API_BASE_URL`，并让后端允许站点来源与 `token`、`X-Site-Id` 请求头。

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
| 接口 404 | 检查 `API_UPSTREAM` 是否包含正确路径前缀，确认后端已启动 |
| `/admin` 打不开 | 检查 `ADMIN_UPSTREAM`；确认站点后台在该域名下已启用 |
| 提示域名未登记 | 在站点后台添加当前域名，保存后立即重试 |
| 跨域错误 | 使用同源 `/api` 反代，或配置后端 CORS 白名单 |
