import express, { type Express } from 'express';
import path from 'node:path';
import { createProxyMiddleware } from 'http-proxy-middleware';

export default function setupProxy(app: Express): void {
  // 开发时由同源代理访问博客 API，避免浏览器跨域并保留工作流长请求。
  const target =
    process.env.REACT_APP_PROXY_TARGET || 'https://jue.leheavengame.com';
  app.use(['/api/admin', '/api/partner-internal'], (_req, res) => { res.sendStatus(404); });
  app.get(['/admin', '/admin.html'], (_req, res) => { res.redirect(302, '/partner/'); });
  app.use('/admin', (_req, res) => { res.sendStatus(404); });

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      onProxyReq(proxyReq, req) {
        if (/^\/api\/user\/(login|register|getCode|getUserInfo|editUserInfo|changePassword)\/?$/.test(req.originalUrl.split('?')[0])) {
          proxyReq.setHeader('X-Workflow-Account', '1');
        }
      },
      proxyTimeout: 620000,
      timeout: 620000,
    })
  );
  app.get(/^\/partner$/, (_req, res) => { res.redirect(308, '/partner/'); });
  app.use(['/partner/api', '/partner/healthz'], createProxyMiddleware({
    target: process.env.REACT_APP_PARTNER_PROXY_TARGET || 'http://127.0.0.1:4200',
    changeOrigin: false,
  }));
  app.use('/partner', express.static(path.resolve(__dirname, '../public/partner'), { fallthrough: false }));
  // 将生成资源目录一并转发，支持后端返回的同源资源路径。
  app.use('/outputs', createProxyMiddleware({ target, changeOrigin: true }));
}
