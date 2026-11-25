import apiClient from '../services/api';
import { API_BASE_URL } from '../config/runtime';
import { maxSourceImage, maxSourceTransfer, normalizePublishingDraft, publisherChannel } from './draft';
import type { PublishingDraft } from './draft';

export class PublisherUnavailable extends Error {}

export function privateAssetPath(source: string, studio: string, apiBase: string) {
  const url = new URL(source, studio);
  if (![new URL(studio).origin, new URL(apiBase || '/', studio).origin].includes(url.origin)) return;
  if (url.username || url.password || url.search || url.hash) return;
  if (/^\/api\/(?:aiWorkflow\/assets|aiAgents\/projects\/[\w-]+\/assets)\/[\da-f]{32}\.(?:png|jpe?g|gif|webp|avif|mp4|mov|webm)$/i.test(url.pathname)) return url.pathname;
}

// Public output files on the studio can be read locally even when a creator's
// editor cannot fetch them cross-origin. Only the known API asset paths use auth.
export async function readStudioMedia(url: string, video: boolean, signal: AbortSignal) {
  const path = privateAssetPath(url, window.location.href, API_BASE_URL);
  const address = new URL(url);
  const output = address.origin === window.location.origin && address.pathname.startsWith('/outputs/');
  if (!path && !output) return;
  const limit = video ? maxSourceTransfer : maxSourceImage;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 90000);
  try {
    let blob: Blob;
    if (path) {
      const response = await apiClient.get<Blob>(path, { responseType: 'blob', signal: controller.signal,
        onDownloadProgress: progress => { if (progress.loaded > limit) abort(); } });
      blob = response.data;
    } else {
      const response = await fetch(address.href, { credentials: 'omit', redirect: 'error', signal: controller.signal });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > limit) throw new Error();
      const parts: BlobPart[] = [];
      const reader = response.body.getReader();
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error();
        parts.push(value);
      }
      blob = new Blob(parts, { type: (response.headers.get('content-type') || '').split(';')[0].trim() });
    }
    if (!blob.size || blob.size > limit || !blob.type.startsWith(video ? 'video/' : 'image/')) throw new Error();
    return blob;
  } finally { window.clearTimeout(timer); abort(); signal.removeEventListener('abort', abort); }
}

export async function sendDraft(input: PublishingDraft, signal: AbortSignal): Promise<number> {
  const draft = normalizePublishingDraft(input, window.location.href);
  if (!window.crypto?.randomUUID) throw new PublisherUnavailable();
  const requestId = window.crypto.randomUUID();
  const origin = window.location.origin;
  function message(type: string, data: Record<string, unknown> = {}) {
    window.postMessage({ channel: publisherChannel, from: 'studio', type, requestId, ...data }, origin);
  }
  function exchange(type: string, data: Record<string, unknown>, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      function stop() {
        window.clearTimeout(timer);
        window.removeEventListener('message', reply);
        signal.removeEventListener('abort', abort);
      }
      function abort() { stop(); reject(new DOMException('Cancelled', 'AbortError')); }
      function reply(e: MessageEvent) {
        const m = e.data;
        if (e.source !== window || e.origin !== origin || m?.channel !== publisherChannel || m.from !== 'extension' ||
            m.requestId !== requestId || m.type !== type || (type === 'file' && m.url !== data.url)) return;
        stop();
        if (m.ok === true) resolve();
        else reject(new Error(typeof m.error === 'string' ? m.error : '导入失败'));
      }
      const timer = window.setTimeout(() => {
        stop();
        reject(type === 'hello' ? new PublisherUnavailable() : new Error('插件响应超时'));
      }, timeout);
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      window.addEventListener('message', reply);
      message(type, data);
    });
  }
  await exchange('hello', {}, 1800);
  try {
    await exchange('import', { draft }, 12000);
    let missing = 0;
    const urls = new Set([...draft.images, draft.cover, draft.video]);
    for (const url of urls) {
      if (!url) continue;
      try {
        const blob = await readStudioMedia(url, url === draft.video, signal);
        if (blob) await exchange('file', { url, blob }, 120000);
      } catch (e) {
        if (signal.aborted) throw e;
        missing++;
      }
    }
    return missing;
  } finally { message('finish'); }
}
