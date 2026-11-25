import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { maxSourceImage, maxSourceTransfer, normalizePublishingDraft, publisherChannel } from '../../src/publishing/draft';
import { sendSourceFile } from '../lib/source-sender';
import { isStudioUrl } from '../lib/studio';

export default defineContentScript({
  matches: ['https://langchain.leheavengame.com/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  runAt: 'document_start',
  main(ctx) {
    if (window.top !== window || !isStudioUrl(location.href)) return;
    let click = 0;
    const pending = new Map<string, { until: number; imported: boolean; urls: Set<string> }>();
    ctx.addEventListener(document, 'click', (e: MouseEvent) => {
      if (e.isTrusted && e.composedPath().some(el => el instanceof Element && el.matches('button[data-zhiflow-publish]'))) click = Date.now();
    }, { capture: true });
    ctx.addEventListener(window, 'message', async (e: MessageEvent) => {
      const m = e.data;
      if (e.source !== window || e.origin !== location.origin || m?.channel !== publisherChannel || m.from !== 'studio' ||
          typeof m.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(m.requestId)) return;
      function reply(ok: boolean, error?: string) {
        window.postMessage({ channel: publisherChannel, from: 'extension', type: m.type, requestId: m.requestId, url: m.url, ok, error }, location.origin);
      }
      if (m.type === 'hello' && Date.now() - click < 2500) {
        click = 0;
        for (const [id, transfer] of pending) if (transfer.until < Date.now()) pending.delete(id);
        if (pending.size >= 8 || pending.has(m.requestId)) { reply(false, '请等待当前草稿导入完成'); return; }
        pending.set(m.requestId, { until: Date.now() + 600000, imported: false, urls: new Set() });
        reply(true);
        return;
      }
      const current = pending.get(m.requestId);
      if (!current || current.until < Date.now()) return;
      try {
        if (m.type === 'finish') { pending.delete(m.requestId); return; }
        if (m.type === 'import' && !current.imported) {
          current.imported = true;
          const draft = normalizePublishingDraft(m.draft, location.href);
          const result = await browser.runtime.sendMessage({ type: 'zhiflow:import', requestId: m.requestId, draft });
          if (!result?.ok) throw new Error(result?.error || '草稿导入失败');
          if (!pending.has(m.requestId)) return;
          current.urls = new Set([...draft.images, draft.cover, draft.video].filter((url): url is string => !!url));
          reply(true);
        } else if (m.type === 'file' && current.urls.delete(m.url)) {
          if (!(m.blob instanceof Blob) || !m.blob.size || m.blob.size > (m.blob.type.startsWith('image/') ? maxSourceImage : maxSourceTransfer)) throw new Error('素材无效');
          await sendSourceFile(m.requestId, m.url, m.blob);
          reply(true);
        }
      } catch (error) { reply(false, error instanceof Error ? error.message : '导入失败'); }
    });
  },
});
