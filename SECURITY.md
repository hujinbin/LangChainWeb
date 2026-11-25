# 安全说明

## 开源范围

用户工作台和 `public/partner/` 下的代理商页面采用 MIT 许可证。业务 API、代理商会话服务与平台管理端由运营方私有部署。

## 运行时配置

`public/config.js` 与容器生成的 `/config.js` 只允许包含公开信息：

- 允许：`apiBaseUrl`、`siteId`、`partnerPath`、品牌名、Logo、主题、帮助地址、交流群号。
- 禁止：API Secret、数据库口令、JWT 私钥、模型 API Key、管理员密码。

工作流用户登录与代理商后台会话独立。代理商页面使用同源 HttpOnly Cookie，开放 API 的 `clientSecret` 保存在调用方服务端。

## 部署建议

- 生产环境使用 HTTPS，证书由部署者自己的 Nginx/Caddy 或云证书服务管理。
- 不要把 `.env`、证书私钥或后端源码打包进前端镜像。
- 定期升级前端镜像，页脚与文档会标注版本信息。
- 发现安全问题时，请通过仓库 Issue 或站点客服渠道私下联系维护者，不要在公开 Issue 中披露可利用细节。
