import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../src/config/site';
const directory = path.resolve(__dirname, '../build');
const read = (filename: string): string => fs.readFileSync(path.join(directory, filename), 'utf8');
const home = read('index.html');
assert(home.includes(SITE.title));
assert(home.includes(`<link rel="canonical" href="${SITE.url}"`));
assert(home.includes('index, follow, max-image-preview:large'));
assert(home.includes('<h1>织流 AI（ZhiFlow）</h1>'));
assert(home.includes(SITE.image));
const schemaMatch = home.match(/<script id="site-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert(schemaMatch, '首页缺少结构化数据');
const schema: unknown = JSON.parse(schemaMatch[1]);
assert(schema !== null && typeof schema === 'object' && '@graph' in schema && Array.isArray(schema['@graph']), '首页结构化数据格式不正确');
const graph: unknown[] = schema['@graph'];
const website = graph[0];
assert(website !== null && typeof website === 'object' && 'name' in website && 'url' in website, '首页缺少网站结构化数据');
assert.equal(website.name, SITE.name);
assert.equal(website.url, SITE.url);
for (const file of ['login/index.html', 'workflows/index.html', 'executions/index.html', 'agents/index.html', 'docs/index.html', 'usage/index.html', 'app.html', '404.html']) {
  const html = read(file);
  assert(html.includes('noindex, follow'), `${file}: missing static noindex`);
  assert(!html.includes('rel="canonical"'), `${file}: unexpected homepage canonical`);
  assert(!html.includes('id="site-schema"'), `${file}: unexpected homepage schema`);
  assert(html.includes('<script defer="defer" src="/static/js/'), `${file}: missing app bundle`);
}
assert(read('sitemap.xml').includes(`<loc>${SITE.url}</loc>`));
assert.equal((read('sitemap.xml').match(/<loc>/g) || []).length, 1);
assert(read('robots.txt').includes(`Sitemap: ${SITE.url}sitemap.xml`));
assert(!/Disallow: \/(workflows|executions|login)/.test(read('robots.txt')));
assert.equal(JSON.parse(read('manifest.json')).short_name, SITE.name);
for (const file of ['social-preview.png', 'brand-mark.svg', 'favicon.ico', 'logo192.png', 'logo512.png']) {
  assert(fs.statSync(path.join(directory, file)).size > 0);
}
console.log('SEO verified: static homepage, 8 noindex pages, structured data, sitemap and brand assets.');
