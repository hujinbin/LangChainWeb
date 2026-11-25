import { browser } from 'wxt/browser';

class SourceDisconnected extends Error {}

async function transferFile(requestId: string, url: string, blob: Blob) {
  const port = browser.runtime.connect({ name: 'zhiflow-source-file' });
  let closed = false;
  let committing = false;
  port.onDisconnect.addListener(() => { closed = true; });
  function send(payload: unknown, timeout = 20000) {
    return new Promise<void>((resolve, reject) => {
      if (closed) { reject(new SourceDisconnected('素材连接已关闭')); return; }
      function cleanup() {
        clearTimeout(timer);
        port.onMessage.removeListener(reply);
        port.onDisconnect.removeListener(disconnect);
      }
      function disconnect() {
        cleanup();
        reject(committing ? new Error('素材保存回执中断，请在插件内核对') : new SourceDisconnected('素材传送中断'));
      }
      function reply(message: { ok: boolean; error?: string }) {
        cleanup();
        if (message.ok) resolve(); else reject(new Error(message.error || '传送失败'));
      }
      const timer = setTimeout(disconnect, timeout);
      port.onMessage.addListener(reply);
      port.onDisconnect.addListener(disconnect);
      try { port.postMessage(payload); } catch { disconnect(); }
    });
  }
  try {
    await send({ type: 'start', requestId, url, mime: blob.type, size: blob.size }, 5000);
    const chunk = 192 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunk) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + chunk).arrayBuffer());
      let raw = '';
      for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await send({ type: 'chunk', offset, data: btoa(raw) });
    }
    committing = true;
    await send({ type: 'end' });
  } finally { port.disconnect(); }
}

// A port can wake Chrome by itself. The short handshake gives a suspended worker
// time to register listeners, while still letting the port try if its reply is lost.
async function wakeWorker(requestId: string) {
  let timer: number | undefined;
  try {
    const ready = await Promise.race([
      browser.runtime.sendMessage({ type: 'zhiflow:source-ready', requestId }).catch(() => undefined),
      new Promise<undefined>(resolve => { timer = window.setTimeout(resolve, 3000); }),
    ]);
    if (ready?.ok === false) throw new Error('素材导入会话已结束');
  } finally { window.clearTimeout(timer); }
}

export async function sendSourceFile(requestId: string, url: string, blob: Blob) {
  for (let attempt = 0; ; attempt++) {
    try {
      await wakeWorker(requestId);
      await transferFile(requestId, url, blob);
      return;
    } catch (error) {
      if (!(error instanceof SourceDisconnected) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
