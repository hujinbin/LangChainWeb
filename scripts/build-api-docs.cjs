const fs = require('fs');
const path = require('path');
const markdown = require('markdown-it')({ html: false });
const root = path.join(__dirname, '..');
const source = path.join(root, 'docs/open-api');
const target = path.join(root, 'public/api-reference');
fs.mkdirSync(target, { recursive: true });
for (const [lang, filename] of [
  ['zh', 'OPEN_API.md'],
  ['en', 'OPEN_API.en.md'],
]) {
  const chapters = fs
    .readFileSync(path.join(source, filename), 'utf8')
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/^## /m);
  const ids =
    lang === 'zh'
      ? [
          'overview',
          'keys',
          'token',
          'endpoints',
          'errors',
          'node',
          'python',
          'backend',
          'curl',
        ]
      : [
          'overview',
          'keys',
          'token',
          'endpoints',
          'errors',
          'python',
          'backend',
        ];
  if (ids.length !== chapters.length)
    throw new Error('Update API guide section links for ' + filename);
  const sections = chapters.map((chapter, i) => {
    const newline = chapter.indexOf('\n');
    return {
      id: ids[i],
      title: chapter.slice(0, newline).replace(/^# |^\d+\. /, ''),
      html: markdown.render(chapter.slice(newline + 1)),
    };
  });
  fs.writeFileSync(path.join(target, lang + '.json'), JSON.stringify(sections));
}
fs.copyFileSync(
  path.join(source, 'openapi.yaml'),
  path.join(target, 'openapi.yaml')
);
