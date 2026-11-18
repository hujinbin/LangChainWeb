const fs = require('node:fs');
const path = require('node:path');
const { SITE, getPageMetadata, getStructuredData } = require('./load-site.cjs');

const root = path.resolve(__dirname, '..');
const escape = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function metadata(pathname) {
  const page = getPageMetadata(pathname);
  return `<!-- site-metadata:start -->
    <title>${escape(page.title)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <meta name="robots" content="${page.indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'}" />
    ${page.indexable ? `<link rel="canonical" href="${SITE.url}" />` : ''}
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:site_name" content="${SITE.name}" />
    <meta property="og:title" content="${escape(page.title)}" />
    <meta property="og:description" content="${escape(page.description)}" />
    ${page.indexable ? `<meta property="og:url" content="${SITE.url}" />` : ''}
    <meta property="og:image" content="${SITE.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="织流 AI ZhiFlow，AI 工作流可视化编排工具" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(page.title)}" />
    <meta name="twitter:description" content="${escape(page.description)}" />
    <meta name="twitter:image" content="${SITE.image}" />
    <meta name="twitter:image:alt" content="织流 AI ZhiFlow，AI 工作流可视化编排工具" />
    ${page.indexable ? `<script id="site-schema" type="application/ld+json">${JSON.stringify(getStructuredData()).replace(/</g, '\\u003c')}</script>` : ''}
    <!-- site-metadata:end -->`;
}

function intro(pathname) {
  const page = getPageMetadata(pathname);
  return `<main style="max-width:880px;margin:64px auto;padding:24px;font:16px/1.8 system-ui,sans-serif;color:#173e30">
      <h1>${page.indexable ? `${SITE.name}（${SITE.englishName}）` : escape(page.title)}</h1>
      ${page.indexable ? `<h2>AI 工作流可视化编排工具</h2><p>${escape(SITE.description)}</p>
      <h2>从一个想法开始</h2><p>通过对话生成工作流，在画布上拖拽节点、连接模型并配置参数，保存草稿后继续创作。</p>
      <h2>文本、图片与视频</h2><p>在同一张画布上编排文本、图片与视频模型，查看执行状态和逐节点结果。</p>
      <p><a href="/workflows/new/edit">开始编排工作流</a> · <a href="/login">登录工作台</a></p>` : '<p>请启用 JavaScript 使用工作台。</p><a href="/">返回首页</a>'}
    </main>`;
}

if (process.argv.includes('--build')) {
  const build = path.join(root, 'build');
  const original = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
  // CRA removes HTML comments, so replace the metadata using the stable title
  // and stylesheet/icon boundary in the generated template.
  const replacePage = (pathname) => original
    .replace(/<title>[\s\S]*?(?=<link rel="icon")/, metadata(pathname))
    .replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${intro(pathname)}</div>`);
  for (const [filename, pathname] of [
    ['login/index.html', '/login'], ['workflows/index.html', '/workflows'],
    ['executions/index.html', '/executions'], ['agents/index.html', '/agents'], ['app.html', '/workflows/new/edit'],
    ['404.html', '/not-found'],
  ]) {
    const destination = path.join(build, filename);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, replacePage(pathname));
  }
  console.log('SEO: generated noindex app pages and 404.html.');
} else {
  const publicDir = path.join(root, 'public');
  fs.writeFileSync(path.join(publicDir, 'index.html'), `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${SITE.themeColor}" />
    ${metadata('/')}
    <link rel="icon" type="image/svg+xml" href="%PUBLIC_URL%/brand-mark.svg" />
    <link rel="icon" sizes="32x32" href="%PUBLIC_URL%/favicon.ico" />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
  </head>
  <body>
    <noscript>请启用 JavaScript 使用织流 AI 的工作流画布、模型配置与执行功能。</noscript>
    <div id="root">${intro('/')}</div>
  </body>
</html>
`);
  fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify({
    short_name: SITE.name, name: `${SITE.name} - AI 工作流可视化编排`, description: SITE.description,
    lang: 'zh-CN', id: '/', start_url: '/', scope: '/', display: 'standalone',
    theme_color: SITE.themeColor, background_color: '#f5f7f0',
    icons: [192, 512].map((size) => ({ src: `logo${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
  }, null, 2) + '\n');
  // Keep app routes crawlable so search engines can read their noindex tags.
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE.url}sitemap.xml\n`);
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE.url}</loc></url>\n</urlset>\n`);
  console.log(`SEO: generated public metadata for ${SITE.name}.`);
}
