/*
 * 前端运行时配置。
 *
 * 本地开发直接使用下面的默认值；Docker 部署时容器启动脚本会用环境变量
 * 重新生成同路径文件，因此修改后端地址不需要重新构建镜像。
 *
 * 安全边界：这里只能放公开信息，禁止写入 API Secret、数据库口令、JWT 私钥等。
 */
window.__JUE_CONFIG__ = window.__JUE_CONFIG__ || {
  apiBaseUrl: '',
  siteId: '',
  adminPath: '/admin',
  brandName: '',
  logoUrl: '',
  faviconUrl: '',
  defaultTheme: 'auto',
  helpUrl: '',
  qqGroup: '',
};
