// CRA 固定读取此文件名；代理实现和类型检查均位于 TypeScript 文件。
const { require: requireTypeScript } = require('tsx/cjs/api');
module.exports = requireTypeScript('../scripts/setupProxy.ts', __filename).default;
