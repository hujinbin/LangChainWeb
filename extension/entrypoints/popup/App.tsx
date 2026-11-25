import { useCallback, useEffect, useState } from 'react';
import {
  createDraft,
  deleteDraft,
  listDrafts,
  readPreferences,
  writePreferences,
  type DraftRecord,
} from '../../lib/store';
import DraftEditor from './DraftEditor';
import Publisher from './Publisher';

export default function App() {
  const [records, setRecords] = useState<DraftRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const errorHandler = useCallback((failure: unknown) => {
    setError(failure instanceof Error ? failure.message : '操作未完成，请重试。');
  }, []);
  const refresh = useCallback(async () => {
    const [all, preferred] = await Promise.all([listDrafts(), readPreferences<string>('selected')]);
    setRecords(all);
    setSelected((current) =>
      all.some((r) => r.id === current)
        ? current
        : all.find((r) => r.id === preferred)?.id || all[0]?.id || ''
    );
    setInitialized(true);
  }, []);
  useEffect(() => {
    refresh().catch(errorHandler);
  }, [refresh, errorHandler]);
  useEffect(() => {
    if (dirty) return;
    const channel = new BroadcastChannel('zhiflow-publisher');
    channel.onmessage = () => {
      refresh().catch(errorHandler);
    };
    return () => channel.close();
  }, [dirty, refresh, errorHandler]);
  const record = records.find((item) => item.id === selected);
  function choose(id: string) {
    setSelected(id);
    setDirty(false);
    setError('');
    void writePreferences('selected', id).catch(errorHandler);
  }
  function mayLeave() {
    return !dirty || window.confirm('离开后将放弃尚未保存的修改。继续吗？');
  }
  async function add() {
    if (!mayLeave()) return;
    try {
      const created = await createDraft({ title: '', body: '', tags: [], images: [] });
      await refresh();
      choose(created.id);
    } catch (failure) {
      errorHandler(failure);
    }
  }
  async function remove() {
    if (!record || !window.confirm('删除本机的这份草稿及其本地素材？')) return;
    try {
      await deleteDraft(record.id, record.revision);
      setDirty(false);
      setError('');
      await refresh();
    } catch (failure) {
      errorHandler(failure);
    }
  }
  return (
    <main>
      <header className="mast">
        <span className="mark" aria-hidden="true">
          织
        </span>
        <div>
          <h1>织流发布助手</h1>
          <p>本地草稿队列</p>
        </div>
        <button className="outline" onClick={() => void add()}>
          新建草稿
        </button>
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
          <button
            onClick={() => {
              if (mayLeave()) {
                setDirty(false);
                setReload((n) => n + 1);
                setError('');
                refresh().catch(errorHandler);
              }
            }}
          >
            重新读取
          </button>
        </div>
      )}
      {!initialized && !error && <p role="status">正在读取草稿…</p>}
      {initialized && !record && (
        <div className="card empty">
          <h2>还没有草稿</h2>
          <p>从织流工作台发送草稿，或在此新建。</p>
        </div>
      )}
      {record && (
        <>
          <div className="queue">
            <label>
              草稿队列 · {records.length}
              <select
                value={record.id}
                onChange={(e) => {
                  if (mayLeave()) choose(e.target.value);
                }}
              >
                {records.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.draft.title || item.draft.body.slice(0, 24) || '未命名草稿'}
                  </option>
                ))}
              </select>
            </label>
            <button className="delete" onClick={() => void remove()}>
              删除草稿
            </button>
          </div>
          <DraftEditor
            key={record.id + ':' + reload}
            record={record}
            onDirty={setDirty}
            onError={errorHandler}
            onChange={(updated) => {
              setRecords((all) => all.map((item) => (item.id === updated.id ? updated : item)));
              setDirty(false);
              setError('');
            }}
          />
          <Publisher
            key={record.id}
            record={record}
            dirty={dirty}
            onRefresh={refresh}
            onError={errorHandler}
          />
        </>
      )}
    </main>
  );
}
