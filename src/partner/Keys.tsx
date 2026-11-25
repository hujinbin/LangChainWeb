import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  api,
  dateTime,
  Dialog,
  ErrorBox,
  errorMessage,
  Heading,
  notify,
  number,
  Table,
} from './shared';

interface PartnerKey {
  id: string;
  name: string;
  clientId: string;
  scopes: string[];
  rateLimitPerMinute: number;
  maxConcurrentRuns: number;
  status: string;
  expiresAt?: string | null;
  ipWhitelist?: string[];
}

interface KeySettings {
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  maxConcurrentRuns: number;
  ipWhitelist: string[];
  expiresAt?: string | null;
  ownerId?: string;
}

interface IssuedSecret {
  clientId: string;
  clientSecret: string;
}

type Change = 'enable' | 'disable' | 'rotate' | 'delete';
type Panel =
  | { kind: 'edit'; row?: PartnerKey }
  | { kind: 'change'; action: Change; row: PartnerKey }
  | { kind: 'secret'; value: IssuedSecret };

const scopeLabels: Record<string, string> = {
  'workflow:read': '查看工作流',
  'workflow:run': '运行工作流',
  'execution:read': '查看执行记录',
  'credits:read': '查看积分',
  'model:read': '查看模型',
};
const changes: Record<Change, { label: string; description: string }> = {
  enable: { label: '启用', description: '启用后，符合访问策略的调用方可继续换取令牌。' },
  disable: { label: '停用', description: '停用后，使用该密钥的接口请求将被拒绝。' },
  rotate: {
    label: '轮换',
    description: '轮换后，旧 Secret 和已签发的令牌都会失效。请及时更新调用方配置。',
  },
  delete: { label: '删除', description: '删除后，持有这组凭证的应用将失去访问权限。' },
};

function localDatetime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

interface Member {
  id: string;
  nickname: string;
  mobile?: string;
  role: number;
  state: boolean | number;
}

function OwnerPicker() {
  const [members, setMembers] = useState<Member[]>([]);
  const [hint, setHint] = useState('默认使用当前管理员的工作流与积分。');
  const [searching, setSearching] = useState(false);
  const query = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function search() {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        keyword: query.current?.value.trim() || '',
        pageSize: '20',
      });
      const result = await api<{ items: Member[] }>('members?' + params, {
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      const available = result.items.filter(
        (member) => member.state && Number(member.role) !== 100,
      );
      setMembers(available);
      setHint(available.length ? '请选择一位成员。' : '没有匹配的已启用成员。');
    } catch (error) {
      if (!request.signal.aborted) setHint(errorMessage(error));
    } finally {
      if (!request.signal.aborted) setSearching(false);
    }
  }

  return (
    <div className="field wide">
      <label htmlFor="partner-key-owner">资源所属成员</label>
      <div className="toolbar">
        <input
          id="partner-key-owner"
          ref={query}
          maxLength={80}
          placeholder="搜索昵称或手机号"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void search();
            }
          }}
        />
        <button type="button" className="button" onClick={search} disabled={searching}>
          查找
        </button>
      </div>
      <select aria-label="选择资源所属成员" name="ownerId">
        <option value="">当前管理员</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.nickname}
            {member.mobile ? ' · ' + member.mobile : ''}
          </option>
        ))}
      </select>
      <small role="status">{hint}</small>
    </div>
  );
}

function KeyEditor({
  row,
  scopes,
  busy,
  error,
  onSave,
  onCancel,
}: {
  row?: PartnerKey;
  scopes: string[];
  busy: boolean;
  error: string;
  onSave: (settings: KeySettings) => void;
  onCancel: () => void;
}) {
  const [validation, setValidation] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selected = fields.getAll('scope').map(String);
    const name = String(fields.get('name') || '').trim();
    if (!name || !selected.length) {
      setValidation(!name ? '请填写密钥名称。' : '至少选择一个允许的操作。');
      return;
    }
    setValidation('');
    const expires = String(fields.get('expires') || '');
    const body: KeySettings = {
      name,
      scopes: selected,
      rateLimitPerMinute: Number(fields.get('rate')),
      maxConcurrentRuns: Number(fields.get('concurrent')),
      ipWhitelist: String(fields.get('ips') || '')
        .split('\n')
        .map((ip) => ip.trim())
        .filter(Boolean),
    };
    const ownerId = fields.get('ownerId');
    if (!row && ownerId) body.ownerId = String(ownerId);
    // Omit an unchanged expiry to preserve its seconds and allow editing an expired key.
    if (!row || localDatetime(row.expiresAt) !== expires)
      body.expiresAt = expires ? new Date(expires).toISOString() : null;
    onSave(body);
  }
  return (
    <form onSubmit={submit}>
      <fieldset className="form-grid" disabled={busy}>
        <label className="field wide">
          <span>密钥名称</span>
          <input name="name" maxLength={60} required defaultValue={row?.name} />
        </label>
        {!row && <OwnerPicker />}
        <fieldset className="permission wide">
          <legend>允许的操作</legend>
          {scopes.map((scope) => (
            <label key={scope}>
              <input
                type="checkbox"
                name="scope"
                value={scope}
                defaultChecked={(row?.scopes ?? ['model:read']).includes(scope)}
              />
              {scopeLabels[scope] || scope}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>每分钟请求上限</span>
          <input
            name="rate"
            type="number"
            required
            min={1}
            max={6000}
            defaultValue={row?.rateLimitPerMinute ?? 60}
          />
        </label>
        <label className="field">
          <span>并发运行上限</span>
          <input
            name="concurrent"
            type="number"
            required
            min={1}
            max={100}
            defaultValue={row?.maxConcurrentRuns ?? 5}
          />
        </label>
        <label className="field wide">
          <span>到期时间</span>
          <input
            name="expires"
            type="datetime-local"
            defaultValue={localDatetime(row?.expiresAt)}
          />
          <small>留空表示长期有效。</small>
        </label>
        <label className="field wide">
          <span>IP 白名单</span>
          <textarea name="ips" rows={3} defaultValue={(row?.ipWhitelist || []).join('\n')} />
          <small>每行一个 IP 或 CIDR 网段。留空允许全部来源。</small>
        </label>
      </fieldset>
      {(validation || error) && <ErrorBox message={validation || error} />}
      <div className="dialog-actions">
        <button type="button" className="button" disabled={busy} onClick={onCancel}>
          取消
        </button>
        <button className="button primary" disabled={busy}>
          {row ? '保存更改' : '创建密钥'}
        </button>
      </div>
    </form>
  );
}

function SecretFields({ secret, onDone }: { secret: IssuedSecret; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.clientSecret);
      notify('Secret 已复制');
    } catch {
      input.current?.focus();
      input.current?.select();
      notify('请使用复制快捷键保存选中的 Secret');
    }
  }
  return (
    <>
      <p>请将 Client Secret 保存到服务端密钥管理工具。关闭后仅能查看掩码。</p>
      <label className="field">
        Client ID
        <input readOnly value={secret.clientId} />
      </label>
      <label className="field">
        Client Secret
        <input
          ref={input}
          readOnly
          autoComplete="off"
          spellCheck={false}
          value={secret.clientSecret}
        />
      </label>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={copy}>
          复制 Secret
        </button>
        <button type="button" className="button primary" onClick={onDone}>
          已保存
        </button>
      </div>
    </>
  );
}

export default function Keys() {
  const [scopes, setScopes] = useState<string[]>([]);
  const [rows, setRows] = useState<PartnerKey[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoadError('');
    Promise.all([
      api<{ scopes: string[] }>('scopes', { signal }),
      api<PartnerKey[]>('keys', { signal }),
    ])
      .then(([allowed, keys]) => {
        if (!signal.aborted) {
          setScopes(allowed.scopes);
          setRows(keys);
        }
      })
      .catch((reason) => {
        if (!signal.aborted) setLoadError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [revision]);

  function open(next: Panel | null) {
    setError('');
    setPanel(next);
  }
  async function save(settings?: KeySettings) {
    if (!panel || panel.kind === 'secret' || mutation.current) return;
    const row = panel.row;
    const action = panel.kind === 'change' ? panel.action : null;
    const path = row ? 'keys/' + encodeURIComponent(row.id) : 'keys';
    const method = action === 'delete' ? 'DELETE' : row ? 'PATCH' : 'POST';
    const body =
      settings ||
      (action === 'rotate'
        ? { rotateSecret: true }
        : action === 'delete'
          ? {}
          : { status: action === 'enable' ? 'active' : 'disabled' });
    const controller = new AbortController();
    mutation.current = controller;
    setError('');
    setSaving(true);
    try {
      const result = await api<IssuedSecret | undefined>(path, {
        method,
        body,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!row || action === 'rotate') {
        if (result?.clientId && result.clientSecret)
          open({
            kind: 'secret',
            value: { clientId: result.clientId, clientSecret: result.clientSecret },
          });
        else {
          open(null);
          notify('密钥已更新，服务未返回接入凭证。请轮换密钥后重新保存。');
        }
      } else {
        open(null);
        notify(action ? '密钥已' + changes[action].label : '密钥配置已保存');
      }
      setRevision((value) => value + 1);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  const cells = (rows || []).map((row) => {
    const active = row.status === 'active';
    const expired = Boolean(row.expiresAt && Date.parse(row.expiresAt) <= Date.now());
    const action = active ? 'disable' : 'enable';
    return [
      <>
        <b>{row.name}</b>
        <small className="sub">
          <code>{row.clientId}</code>
        </small>
      </>,
      <span className={'tag ' + (active && !expired ? 'ok' : 'off')}>
        {active ? (expired ? '已过期' : '启用中') : '已停用'}
      </span>,
      (row.scopes || []).map((scope) => scopeLabels[scope] || scope).join('、'),
      <>
        {number(row.rateLimitPerMinute)} 次/分钟
        <small className="sub">并发 {number(row.maxConcurrentRuns)}</small>
      </>,
      row.expiresAt ? dateTime(row.expiresAt) : '长期',
      <div className="row-actions">
        <button type="button" onClick={() => open({ kind: 'edit', row })}>
          编辑
        </button>
        {([action, 'rotate', 'delete'] as const).map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => open({ kind: 'change', action: item, row })}
          >
            {changes[item].label}
          </button>
        ))}
      </div>,
    ];
  });
  let title = '';
  if (panel?.kind === 'edit') title = panel.row ? '编辑 API 密钥' : '创建 API 密钥';
  if (panel?.kind === 'change') title = changes[panel.action].label + '密钥';
  if (panel?.kind === 'secret') title = '保存接入凭证';
  return (
    <>
      <Heading
        title="API 密钥"
        description="创建访问凭证，管理接口权限、有效期与调用限制。"
        action={
          <button
            type="button"
            className="button primary"
            disabled={!scopes.length}
            onClick={() => open({ kind: 'edit' })}
          >
            ＋ 创建密钥
          </button>
        }
      />
      <section className="panel">
        <div className="panel-title">
          <h2>站点密钥</h2>
          <a href="/docs">接入文档 ↗</a>
        </div>
        {loadError ? (
          <ErrorBox message={loadError} onRetry={() => setRevision((value) => value + 1)} />
        ) : rows === null ? (
          <p className="loading" role="status">
            正在读取密钥…
          </p>
        ) : (
          <Table
            headers={['名称 / Client ID', '状态', '权限', '调用限制', '到期时间', '操作']}
            rows={cells}
            empty="还没有 API 密钥，创建后即可按作用域调用接口。"
          />
        )}
      </section>
      {panel && (
        <Dialog
          title={title}
          onClose={() => {
            if (!mutation.current) open(null);
          }}
        >
          {panel.kind === 'edit' && (
            <KeyEditor
              row={panel.row}
              scopes={scopes}
              busy={saving}
              error={error}
              onSave={save}
              onCancel={() => open(null)}
            />
          )}
          {panel.kind === 'secret' && (
            <SecretFields secret={panel.value} onDone={() => open(null)} />
          )}
          {panel.kind === 'change' && (
            <>
              <p>
                {panel.row.name}（{panel.row.clientId}）
              </p>
              <p>{changes[panel.action].description}</p>
              {error && <ErrorBox message={error} />}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  onClick={() => open(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={'button ' + (panel.action === 'delete' ? 'danger' : 'primary')}
                  disabled={saving}
                  onClick={() => save()}
                >
                  确认{changes[panel.action].label}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
