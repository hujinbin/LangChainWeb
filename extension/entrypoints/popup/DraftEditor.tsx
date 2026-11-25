import { useEffect, useRef, useState } from 'react';
import { normalizePublishingDraft } from '../../../src/publishing/draft';
import type { MediaRole } from '../../lib/protocol';
import { addFiles, removeFile, updateDraft, type DraftRecord } from '../../lib/store';

const roles = { image: '正文图片', cover: '封面', video: '视频' } as const;
const formatSize = (n: number) =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + ' MiB' : Math.ceil(n / 1024) + ' KiB';

interface Props {
  record: DraftRecord;
  onChange: (record: DraftRecord) => void;
  onDirty: (dirty: boolean) => void;
  onError: (error: unknown) => void;
}
function formFields(record: DraftRecord) {
  return {
    title: record.draft.title,
    body: record.draft.body,
    tags: record.draft.tags.join('，'),
    images: record.draft.images.join('\n'),
    cover: record.draft.cover || '',
    video: record.draft.video || '',
  };
}
export default function DraftEditor({ record, onChange, onDirty, onError }: Props) {
  const [fields, setFields] = useState(() => formFields(record));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(record.revision);
  useEffect(() => {
    if (version.current === record.revision) return;
    version.current = record.revision;
    setFields(formFields(record));
    setDirty(false);
    onDirty(false);
  }, [record, onDirty]);
  function edit(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    onDirty(true);
  }
  async function run(action: () => Promise<DraftRecord>) {
    setBusy(true);
    try {
      onChange(await action());
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    const localOnly =
      record.files.length &&
      !fields.title.trim() &&
      !fields.body.trim() &&
      !fields.images.trim() &&
      !fields.cover.trim() &&
      !fields.video.trim();
    const draft = normalizePublishingDraft({
      ...fields,
      title: localOnly ? '素材草稿' : fields.title,
      tags: fields.tags
        .split(/[,，、\n]/u)
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: fields.images
        .split(/\r?\n/u)
        .map((url) => url.trim())
        .filter(Boolean),
    });
    if (localOnly) draft.title = '';
    return updateDraft(record.id, record.revision, draft);
  }
  return (
    <section className="card editor">
      <h2>编辑草稿</h2>
      <fieldset disabled={busy}>
        <label>
          标题
          <input value={fields.title} maxLength={200} onChange={(e) => edit('title', e.target.value)} />
        </label>
        <label>
          正文
          <textarea
            rows={5}
            value={fields.body}
            maxLength={120000}
            onChange={(e) => edit('body', e.target.value)}
          />
        </label>
        <label>
          标签
          <input
            value={fields.tags}
            placeholder="用逗号分隔"
            onChange={(e) => edit('tags', e.target.value)}
          />
        </label>
        <details>
          <summary>素材链接与本地文件{record.files.length ? ' · ' + record.files.length : ''}</summary>
          <label>
            图片链接
            <textarea
              rows={2}
              value={fields.images}
              placeholder="每行一个链接"
              onChange={(e) => edit('images', e.target.value)}
            />
          </label>
          <label>
            封面链接
            <input value={fields.cover} onChange={(e) => edit('cover', e.target.value)} />
          </label>
          <label>
            视频链接
            <input value={fields.video} onChange={(e) => edit('video', e.target.value)} />
          </label>
          <div className="files">
            {(Object.keys(roles) as MediaRole[]).map((role) => (
              <label key={role}>
                选取{roles[role]}
                <input
                  type="file"
                  accept={role === 'video' ? 'video/*' : 'image/*'}
                  multiple={role === 'image'}
                  disabled={dirty}
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files || []);
                    event.currentTarget.value = '';
                    if (files.length) void run(() => addFiles(record.id, record.revision, role, files));
                  }}
                />
              </label>
            ))}
          </div>
          <p className="muted">单张图片最多 32 MiB，视频最多 512 MiB。选取的本地文件会保存到当前草稿。</p>
          {record.files.map((file) => (
            <div className="attachment" key={file.id}>
              <span>
                {roles[file.role]} · {file.name} <small>{formatSize(file.size)}</small>
              </span>
              <button
                disabled={dirty}
                onClick={() => void run(() => removeFile(record.id, record.revision, file.id))}
                aria-label={'移除 ' + file.name}
              >
                移除
              </button>
            </div>
          ))}
        </details>
        <div className="actions">
          <button className="outline" disabled={!dirty} onClick={() => void run(save)}>
            保存本地修改
          </button>
          <span className="muted" role="status">
            {dirty ? '有未保存的修改' : '已保存到本机'}
          </span>
        </div>
      </fieldset>
    </section>
  );
}
