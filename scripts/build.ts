import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildPartner } from './build-partner';
import { writeBuiltPages, writePublicMetadata } from './seo';

async function build() {
  // Both the development server and CRA read their static files from public/.
  require('./build-api-docs.cjs');
  writePublicMetadata();
  if (process.argv.includes('--prepare')) return;

  // CRA clears build/, so generate the additional entry points after it finishes.
  execFileSync(process.execPath, [require.resolve('react-scripts/bin/react-scripts.js'), 'build'], { stdio: 'inherit' });
  await buildPartner();
  writeBuiltPages();
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('请从仓库根目录运行 npm run build');
  execFileSync(process.execPath, [npm, 'run', 'build', '--workspace=@zhiflow/publisher'], { stdio: 'inherit' });
  const downloads = path.resolve('build/downloads');
  mkdirSync(downloads, { recursive: true });
  copyFileSync('extension/.output/zhiflow-publisher.zip', path.join(downloads, 'zhiflow-publisher.zip'));
  console.log('打包完成，可部署 build/ 目录。');
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
