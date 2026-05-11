const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 将 /api 转发到后端
  app.use('/api', createProxyMiddleware({ target: 'http://localhost:8000', changeOrigin: true }));
  // 将 /outputs 静态资源目录转发到后端（方便 iframe 预览）
  app.use('/outputs', createProxyMiddleware({ target: 'http://localhost:8000', changeOrigin: true }));
};
