import type { Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

export default function setupProxy(app: Express): void {
  // 开发时由同源代理访问博客 API，避免浏览器跨域并保留工作流长请求。
  const target =
    process.env.REACT_APP_PROXY_TARGET || 'https://jue.leheavengame.com';
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      proxyTimeout: 620000,
      timeout: 620000,
    })
  );
  // 将生成资源目录一并转发，支持后端返回的同源资源路径。
  app.use('/outputs', createProxyMiddleware({ target, changeOrigin: true }));
}
