import { browser, type Browser } from 'wxt/browser';
import { maxSourceImage, maxSourceTransfer } from '../../src/publishing/draft';
import { attachImportedFile, importedDraft } from './store';
import { isStudioUrl } from './studio';

const busy = new Set<string>();
const chunkSize = 192 * 1024;
let reserved = 0;

export function importKey(sender: Browser.runtime.MessageSender | undefined, requestId: string) {
  if (!sender || sender.id !== browser.runtime.id || sender.tab?.id === undefined || sender.frameId !== 0 ||
      !sender.url || !isStudioUrl(sender.url) || typeof requestId !== 'string' || requestId.length !== 36) return;
  return [sender.tab.id, sender.documentId || sender.url, new URL(sender.url).origin, requestId].join('|');
}

export function installSourceFileReceiver() {
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== 'zhiflow-source-file') return;
    let transfer: { key: string; id: string; url: string; mime: string; size: number; parts: ArrayBuffer[]; offset: number } | undefined;
    let ended = false;
    function release() {
      if (transfer) { reserved -= transfer.size; busy.delete(transfer.key); transfer = undefined; }
    }
    port.onDisconnect.addListener(() => { ended = true; release(); });
    port.onMessage.addListener(async m => {
      try {
        if (ended || !m) return;
        if (m.type === 'start' && !transfer) {
          const k = importKey(port.sender, m.requestId);
          const entry = k ? await importedDraft(k) : undefined;
          if (!k || !entry?.importedAt || entry.importedAt + 600000 < Date.now() || ended || transfer || busy.has(k)) {
            throw new Error('素材导入会话已结束');
          }
          const isVideo = entry.draft.video === m.url;
          const isImage = entry.draft.cover === m.url || entry.draft.images.includes(m.url);
          const allowedType = isVideo ? /^video\/(?:mp4|webm|quicktime)$/ : /^image\/(?:png|jpeg|webp|gif|avif)$/;
          if (typeof m.url !== 'string' || (!isVideo && !isImage) || !allowedType.test(m.mime) ||
              !Number.isSafeInteger(m.size) || m.size <= 0 || m.size > (isVideo ? maxSourceTransfer : maxSourceImage) ||
              reserved + m.size > maxSourceTransfer) throw new Error('素材类型或大小不符合要求');
          busy.add(k);
          reserved += m.size;
          transfer = { key: k, id: entry.id, url: m.url, mime: m.mime, size: m.size, offset: 0, parts: [] };
        } else if (m.type === 'chunk' && transfer) {
          if (m.offset !== transfer.offset || typeof m.data !== 'string' || m.data.length > chunkSize * 4 / 3) throw new Error('素材分块无效');
          const raw = atob(m.data);
          if (raw.length !== Math.min(chunkSize, transfer.size - transfer.offset) || !raw.length) throw new Error('素材长度无效');
          transfer.parts.push(Uint8Array.from(raw, ch => ch.charCodeAt(0)).buffer);
          transfer.offset += raw.length;
        } else if (m.type === 'end' && transfer && transfer.offset === transfer.size) {
          ended = true;
          const name = new URL(transfer.url).pathname.split('/').pop() || 'asset';
          await attachImportedFile(transfer.id, transfer.url, new File(transfer.parts, name, { type: transfer.mime }));
          release();
        } else throw new Error('素材传输顺序无效');
        port.postMessage({ ok: true });
      } catch (error) {
        release(); ended = true;
        try { port.postMessage({ ok: false, error: error instanceof Error ? error.message : '素材传送失败' }); } catch { /* closed */ }
      }
    });
  });
}
