import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { normalizePublishingDraft } from '../../src/publishing/draft';
import { deliver, sendChunk } from '../lib/delivery';
import { createDraft } from '../lib/store';
import { isStudioUrl } from '../lib/studio';
import { installSourceFileReceiver, importKey } from '../lib/source-files';

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function importDraft(sender: Browser.runtime.MessageSender, requestId: string, value: unknown) {
  if (!sender.url || sender.tab?.id === undefined || sender.frameId !== 0 || !isStudioUrl(sender.url) ||
      (sender.tab.url && new URL(sender.tab.url).origin !== new URL(sender.url).origin) || !requestIdPattern.test(requestId)) {
    throw new Error('仅可从已允许的织流工作台导入。');
  }
  const normalized = normalizePublishingDraft(value, sender.url);
  const key = importKey(sender, requestId);
  if (!key) throw new Error('草稿来源无效');
  const { id } = await createDraft(normalized, key);
  return { ok: true, id };
}

export default defineBackground(() => {
  installSourceFileReceiver();
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== browser.runtime.id || !message || typeof message !== 'object') return;
    let action: Promise<unknown>;
    switch (message.type) {
      case 'zhiflow:source-ready':
        respond({ ok: Boolean(importKey(sender, message.requestId)) });
        return;
      case 'zhiflow:import':
        action = importDraft(sender, message.requestId, message.draft);
        break;
      case 'publishing:deliver':
        if (sender.url !== browser.runtime.getURL('/popup.html')) return;
        action = deliver(message).then(data => ({ ok: true, data }));
        break;
      case 'publishing:media-chunk':
        action = sendChunk(sender, message.transferId, message.fileId, message.offset);
        break;
      default: return;
    }
    action.then(respond, error => respond({ ok: false, error: error instanceof Error ? error.message : '操作未完成。' }));
    return true;
  });
});
