import { defineConfig } from 'wxt';
import { platforms } from './lib/platforms';
import { studioOrigins } from './lib/studio-origins';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  vite: () => ({ define: { 'import.meta.env.WXT_STUDIO_ORIGIN': JSON.stringify(process.env.WXT_STUDIO_ORIGIN || '') } }),
  manifest: {
    name: '织流发布助手',
    description: '将织流作品填入已登录的创作页面，检查草稿后手动发布。',
    permissions: ['scripting'],
    optional_host_permissions: [...new Set(platforms.flatMap(p => p.hosts.map(h => 'https://' + h + '/*')))],
    action: { default_title: '织流发布助手' },
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      const bridge = manifest.content_scripts?.find(s => s.js?.includes('content-scripts/studio.js'));
      if (!bridge) throw new Error('Missing studio bridge');
      bridge.matches = [...studioOrigins(process.env.WXT_STUDIO_ORIGIN).map(s => ('https://' + new URL(s).hostname) + '/*'), 'http://localhost/*', 'http://127.0.0.1/*'];
    },
  },
  zip: { artifactTemplate: 'zhiflow-publisher.zip' },
});
