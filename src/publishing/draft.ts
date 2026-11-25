/** The public handoff contains content and media references only. */
export interface PublishingDraft {
  title: string;
  body: string;
  tags: string[];
  images: string[];
  cover?: string;
  video?: string;
}

export const publisherChannel = 'zhiflow-publisher-v1';
export const maxSourceImage = 32 * 1024 * 1024;
export const maxSourceTransfer = 128 * 1024 * 1024;

function textField(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(label + '格式或长度不符合要求');
  return value.trim();
}

function list(value: unknown, parse: (item: unknown) => string): string[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('标签和图片各最多支持 30 项');
  return Array.from(new Set(value.map(parse).filter(Boolean)));
}

export function normalizePublishingDraft(value: unknown, baseUrl?: string): PublishingDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('草稿格式无效');
  const item = value as Record<string, unknown>;
  function media(raw: unknown): string {
    const input = textField(raw, 8192, '素材地址');
    if (!input) throw new Error('素材地址为空');
    const url = new URL(input, baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('素材需要 HTTP(S) 地址');
    return url.href;
  }
  const draft: PublishingDraft = {
    title: textField(item.title ?? '', 200, '标题'),
    body: textField(item.body ?? '', 120000, '正文'),
    tags: list(item.tags ?? [], tag => textField(tag, 100, '标签')),
    images: list(item.images ?? [], media),
    ...(item.cover ? { cover: media(item.cover) } : {}),
    ...(item.video ? { video: media(item.video) } : {}),
  };
  if (!draft.body && !draft.title && !draft.images.length && !draft.video && !draft.cover) throw new Error('没有可导入的内容');
  return draft;
}
