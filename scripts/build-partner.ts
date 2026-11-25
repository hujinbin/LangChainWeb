import path from 'node:path';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/partner');
// CRA loads its TypeScript proxy in a namespaced module loader. Resolve the native binary from the project.
const { build }: typeof import('esbuild') = createRequire(path.join(root, 'package.json'))('esbuild');

export async function compilePartner(production: boolean): Promise<string> {
  const result = await build({
    entryPoints: [path.join(root, 'src/partner/index.tsx')],
    bundle: true,
    write: false,
    minify: production,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    legalComments: 'inline',
    define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
  });
  return result.outputFiles[0].text;
}

export async function buildPartner() {
  const bundle = await compilePartner(true);
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, 'app.js'), bundle),
    ...['index.html', 'console.css'].map(file => copyFile(path.join(root, 'public/partner', file), path.join(output, file))),
  ]);
}
