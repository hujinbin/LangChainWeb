import type { MediaDescriptor, MediaRole } from './protocol';

const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
};
const sizeLimit = (role: MediaRole) => (role === 'video' ? 512 : 32) * 1024 ** 2;

export type ReadChunk = (fileId: string, offset: number) => Promise<{ ok: true; base64: string; done: boolean } | { ok: false; error: string }>;

export async function readLocalFile(info: MediaDescriptor, readChunk: ReadChunk): Promise<File> {
  if (!Number.isSafeInteger(info.size) || info.size <= 0 || info.size > sizeLimit(info.role)) throw new Error('所选文件大小超出限制。');
  const parts: ArrayBuffer[] = [];
  let offset = 0;
  while (offset < info.size) {
    const reply = await readChunk(info.id, offset);
    if (!reply.ok) throw new Error(reply.error);
    if (!reply.base64 || reply.base64.length > Math.ceil(192 * 1024 / 3) * 4) throw new Error('媒体分块无效。');
    const binary = atob(reply.base64);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    offset += bytes.byteLength;
    if (offset > info.size || reply.done !== (offset === info.size)) throw new Error('媒体文件未完整传输。');
    parts.push(bytes.buffer);
  }
  return new File(parts, info.name, { type: info.type });
}

export async function readRemoteFile(address: string, role: MediaRole): Promise<File> {
  let url: URL;
  try { url = new URL(address); } catch { throw new Error('素材链接无效。'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('素材需使用可公开访问的 HTTPS 地址。');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url.href, {
      mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error('素材读取失败，请从本地选择文件。');
    const type = (response.headers.get('content-type')?.split(';')[0] || '').trim().toLowerCase();
    if (!mimeExtensions[type] || !type.startsWith(role === 'video' ? 'video/' : 'image/')) {
      throw new Error('链接返回的文件类型与素材不符，请从本地选择文件。');
    }
    const max = sizeLimit(role);
    if (Number(response.headers.get('content-length')) > max) throw new Error('素材文件过大。');
    const reader = response.body.getReader();
    const parts: ArrayBuffer[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error('素材文件过大。');
      parts.push(new Uint8Array(value).buffer);
    }
    if (!size) throw new Error('素材文件为空。');
    let name = url.pathname.split('/').pop() || role;
    try { name = decodeURIComponent(name); } catch { name = role; }
    name = name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 140) || role;
    if (!name.includes('.')) name += '.' + mimeExtensions[type];
    return new File(parts, name, { type });
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('无法直接读取素材，可能是跨域限制或连接超时；请从本地选择文件。');
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
