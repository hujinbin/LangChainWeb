import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createEditorHandler } from '../lib/fill';
import { readLocalFile } from '../lib/editor-media';
import type { EditorCommand } from '../lib/protocol';
import { platformForUrl } from '../lib/platforms';

export default defineContentScript({
  registration: 'runtime',
  main(ctx) {
    const scope = globalThis as typeof globalThis & { __zhiflowEditorInstalled?: boolean };
    if (scope.__zhiflowEditorInstalled || window.top !== window || !platformForUrl(location.href)) return;
    scope.__zhiflowEditorInstalled = true;
    const handle = createEditorHandler(document, () => location.href, {
      local: (info, command) => readLocalFile(info, (fileId, offset) =>
        browser.runtime.sendMessage({ type: 'publishing:media-chunk', transferId: command.transferId, fileId, offset })),
    });
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
      if (sender.id !== browser.runtime.id || sender.tab) return;
      if (message?.type === 'publishing:ping') {
        respond({ ready: true });
        return;
      }
      if (message?.type !== 'publishing:fill') return;
      handle(message as EditorCommand).then(respond);
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(listener);
      delete scope.__zhiflowEditorInstalled;
    });
  },
});
