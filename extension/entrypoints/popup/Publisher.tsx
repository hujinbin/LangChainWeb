import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { platforms, platformForUrl, type Platform } from '../../lib/platforms';
import { readPreferences, writePreferences, type DraftRecord } from '../../lib/store';
import { maySaveDraft, type Attempt, type Reply } from '../../lib/protocol';

interface EditorTab {
  id: number;
  title: string;
  active: boolean;
}
const patterns = (platform: Platform) => platform.hosts.map((host) => 'https://' + host + '/*');
const statusText = {
  filled: '已填充',
  unchanged: '已保留',
  missing: '未找到',
  occupied: '已有内容',
  unsupported: '需手动处理',
  failed: '未完成',
};
const fieldText: Record<string, string> = {
  title: '标题',
  body: '正文',
  tags: '标签',
  image: '图片',
  images: '图片',
  cover: '封面',
  video: '视频',
  save: '草稿',
};

async function findTabs(platform: Platform): Promise<EditorTab[]> {
  const tabs = await browser.tabs.query({ url: patterns(platform), currentWindow: true });
  return tabs.flatMap((tab) =>
    typeof tab.id === 'number' && platformForUrl(tab.url || '')?.id === platform.id
      ? [{ id: tab.id, title: tab.title || tab.url || platform.name, active: Boolean(tab.active) }]
      : []
  );
}
function Results({ attempt }: { attempt: Attempt }) {
  const { result } = attempt;
  const name = platforms.find((platform) => platform.id === attempt.platformId)?.name || attempt.platformId;
  return (
    <section className="result" aria-live="polite">
      <h3>
        {name} · {attempt.action === 'save' ? '保存结果' : '填充结果'}
      </h3>
      {attempt.action === 'save' && <strong>{result.saved ? '平台已确认保存' : '尚未确认保存'}</strong>}
      <p>{result.message}</p>
      {result.fields.length > 0 && (
        <ul>
          {result.fields.map((field, index) => (
            <li key={field.field + index}>
              <strong>{fieldText[field.field] || field.field}</strong>
              <span>{statusText[field.status]}</span>
              {field.message && <small>{field.message}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
interface Props {
  record: DraftRecord;
  dirty: boolean;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}
export default function Publisher({ record, dirty, onRefresh, onError }: Props) {
  const [platformId, setPlatformId] = useState('');
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [target, setTarget] = useState<number>();
  const [granted, setGranted] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const platform = platforms.find((item) => item.id === platformId);
  const prefKey = 'target:' + record.id;
  useEffect(() => {
    let live = true;
    Promise.all([readPreferences<string>(prefKey), readPreferences<boolean>('autoSaveDraft')])
      .then(([saved, auto]) => {
        if (live) {
          setPlatformId(saved || '');
          setAutoSave(auto !== false);
        }
      })
      .catch(onError);
    return () => {
      live = false;
    };
  }, [prefKey, onError]);
  useEffect(() => {
    let live = true;
    setTabs([]);
    setTarget(undefined);
    setGranted(false);
    setNote('');
    setOverwrite(false);
    if (!platform) {
      setLoading(false);
      return;
    }
    setLoading(true);
    async function check(selected: Platform) {
      const authorized = await browser.permissions.contains({ origins: patterns(selected) });
      if (!live) return;
      setGranted(authorized);
      if (!authorized) return;
      const [available, previous] = await Promise.all([
        findTabs(selected),
        readPreferences<number>(prefKey + ':' + selected.id),
      ]);
      if (!live) return;
      setTabs(available);
      setTarget(
        available.find((t) => t.id === previous)?.id ??
          available.find((t) => t.active)?.id ??
          (available.length === 1 ? available[0]?.id : undefined)
      );
    }
    check(platform)
      .catch((error) => {
        if (live) onError(error);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [platform, prefKey, refresh, onError]);
  async function authorize() {
    if (!platform) return;
    try {
      if (await browser.permissions.request({ origins: patterns(platform) })) setRefresh((n) => n + 1);
      else setNote('未授予该平台的访问权限，可再次授权。');
    } catch (error) {
      onError(error);
    }
  }
  async function openPlatform() {
    if (!platform) return;
    try {
      const tab = await browser.tabs.create({ url: platform.editorUrl });
      if (tab.id !== undefined) await writePreferences(prefKey + ':' + platform.id, tab.id);
    } catch (error) {
      onError(error);
    }
  }
  async function dispatch(saveDraft: boolean) {
    if (!platform || !target || busy || dirty) return;
    setBusy(true);
    setNote(saveDraft ? '正在确认平台草稿状态…' : '正在填充目标编辑器…');
    try {
      const reply: Reply<Attempt> = await browser.runtime.sendMessage({
        type: 'publishing:deliver',
        draftId: record.id,
        revision: record.revision,
        platformId: platform.id,
        tabId: target,
        allowOverwrite: overwrite,
        saveDraft,
        autoSaveDraft: autoSave,
      });
      if (!reply?.ok) throw new Error(reply?.error || '未收到编辑器响应，请刷新平台标签后重试。');
      await onRefresh();
      setNote('');
    } catch (error) {
      setNote('');
      onError(error);
    } finally {
      setBusy(false);
    }
  }
  const attempt = record.lastAttempt;
  const canSave = maySaveDraft(attempt, record.revision, target, platformId);
  return (
    <section className="card">
      <h2>发送到平台编辑器</h2>
      <label>
        目标平台
        <select
          value={platform?.id || ''}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value;
            setPlatformId(next);
            void writePreferences(prefKey, next).catch(onError);
          }}
        >
          <option value="">请选择平台</option>
          {platforms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {platform && !loading && !granted && (
        <div className="actions">
          <button className="outline" onClick={() => void authorize()}>
            授权访问{platform.name}
          </button>
        </div>
      )}
      {platform && granted && !loading && (
        <>
          {tabs.length > 0 ? (
            <label>
              当前窗口的目标标签
              <select
                value={target ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const id = Number(e.target.value) || undefined;
                  setTarget(id);
                  setOverwrite(false);
                  void writePreferences(prefKey + ':' + platform.id, id ?? null).catch(onError);
                }}
              >
                <option value="">请选择编辑标签</option>
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted">当前窗口尚未打开{platform.name}。打开平台，登录并进入编辑页面后再填充。</p>
          )}
          <div className="actions">
            <button disabled={busy} onClick={() => void openPlatform()}>
              打开平台入口 ↗
            </button>
            <button disabled={busy} onClick={() => setRefresh((n) => n + 1)}>
              刷新标签
            </button>
          </div>
          {target && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={overwrite}
                  disabled={busy}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                允许替换编辑器中已有的内容
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoSave}
                  disabled={busy}
                  onChange={(e) => {
                    setAutoSave(e.target.checked);
                    void writePreferences('autoSaveDraft', e.target.checked).catch(onError);
                  }}
                />
                填充完整后自动保存草稿
              </label>
              <div className="actions">
                <button className="primary" disabled={busy || dirty} onClick={() => void dispatch(false)}>
                  填充编辑器
                </button>
                <button
                  className="outline"
                  disabled={busy || dirty || !canSave}
                  onClick={() => void dispatch(true)}
                >
                  保存到平台草稿
                </button>
              </div>
            </>
          )}
        </>
      )}
      {note && <p role="status">{note}</p>}
      {attempt && <Results attempt={attempt} />}
    </section>
  );
}
