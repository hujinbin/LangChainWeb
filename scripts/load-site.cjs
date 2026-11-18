const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// SEO 构建直接读取同一份 TypeScript 站点配置，避免维护两份品牌与元数据。
const filename = path.resolve(__dirname, '../src/config/site.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
});
const siteModule = { exports: {} };
new Function('module', 'exports', compiled.outputText)(
  siteModule,
  siteModule.exports
);
module.exports = siteModule.exports;
