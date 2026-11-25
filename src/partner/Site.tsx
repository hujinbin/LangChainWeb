import { useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, dateTime, ErrorBox, errorMessage, Heading, notify, number, roleName, Table } from './shared';
import type { PartnerSession } from './shared';

interface SiteConfig {
  siteId: string;
  name: string;
  planName?: string;
  quotaDescription?: string;
  theme?: string;
  domains?: string[];
  logoUrl?: string;
  faviconUrl?: string;
  registerEnabled?: boolean;
  seo?: { title?: string; description?: string; keywords?: string[] };
  contact?: { qq?: string; email?: string; wechatQrUrl?: string };
  announcement?: string;
  footerText?: string;
  disabledModels?: string[];
  novelBlockedTerms?: string[];
}

interface MemberPage {
  items: { nickname?: string; mobile?: string | number; role: number; state: boolean | number }[];
  total: number;
  pageSize: number;
}

interface AuditRecord {
  createdAt: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  clientId?: string;
  ip?: string;
  executionId?: string;
}

type QueryResult<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

function usePartnerQuery<T>(path: string) {
  const [revision, reload] = useReducer((value: number) => value + 1, 0);
  const [response, setResponse] = useState<{ path: string; revision: number; result: QueryResult<T> }>();
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api<T>(path, { signal }).then(
      (data) => {
        if (!signal.aborted) setResponse({ path, revision, result: { status: 'ready', data } });
      },
      (error: unknown) => {
        if (!signal.aborted) setResponse({ path, revision, result: { status: 'error', message: errorMessage(error) } });
      }
    );
    return () => controller.abort();
  }, [path, revision]);
  const result: QueryResult<T> =
    response?.path === path && response.revision === revision ? response.result : { status: 'loading' };
  return { result, reload };
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title"><h2>{title}</h2></div>
      <div className="form-grid">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value?: string;
  type?: 'text' | 'email' | 'textarea';
  max?: number;
  wide?: boolean;
  required?: boolean;
  hint?: string;
}

function Field({ label, name, value, type = 'text', max, wide, required, hint }: FieldProps) {
  const attributes = { name, defaultValue: value || '', maxLength: max, required };
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {type === 'textarea' ? <textarea rows={3} {...attributes} /> : <input type={type} {...attributes} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function fieldValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function siteUpdate(form: FormData) {
  const value = (name: string) => fieldValue(form, name);
  const list = (name: string, separator: RegExp) => value(name).split(separator).map((entry) => entry.trim()).filter(Boolean);
  return {
    name: value('name').trim(),
    domains: list('domains', /\n/),
    logoUrl: value('logoUrl').trim(),
    faviconUrl: value('faviconUrl').trim(),
    seo: { title: value('seoTitle'), description: value('description'), keywords: list('keywords', /[,，]/) },
    theme: value('theme'),
    announcement: value('announcement'),
    footerText: value('footerText'),
    contact: { qq: value('qq'), email: value('email'), wechatQrUrl: value('wechatQrUrl') },
    registerEnabled: form.has('registerEnabled'),
    disabledModels: list('disabledModels', /\n/),
    novelBlockedTerms: list('novelBlockedTerms', /\n/),
  };
}

interface SiteProps {
  session: PartnerSession;
  onSiteChange: (name: string) => void;
}

function SiteForm({ initial, canWrite, onSiteChange }: {
  initial: SiteConfig;
  canWrite: boolean;
  onSiteChange: SiteProps['onSiteChange'];
}) {
  const [item, setItem] = useState(initial);
  const [revision, updateFields] = useReducer((value: number) => value + 1, 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || request.current) return;
    const body = siteUpdate(new FormData(event.currentTarget));
    const host = window.location.hostname.toLowerCase();
    const containsHost = (domains: string[]) => domains.some((domain) => domain.toLowerCase() === host);
    if (containsHost(item.domains || []) && !containsHost(body.domains) &&
      !window.confirm('移除当前域名后，此地址将无法进入本站。仍要保存吗？')) return;

    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await api<Partial<SiteConfig> | null>('site', { method: 'PATCH', body, signal: controller.signal });
      if (controller.signal.aborted) return;
      const next = { ...item, ...body, ...saved };
      setItem(next);
      updateFields();
      onSiteChange(next.name);
      notify('站点设置已保存');
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(errorMessage(error));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <>
      <div className="plan">
        <span>站点 ID <b>{item.siteId}</b></span><span>套餐 <b>{item.planName || '未设置'}</b></span>
        {item.quotaDescription && <span>配额 <b>{item.quotaDescription}</b></span>}
      </div>
      <form className="site-form" onSubmit={save}>
        <fieldset key={revision} disabled={!canWrite || saving}>
          <FormSection title="站点资料">
            <Field label="站点名称" name="name" value={item.name} max={60} required />
            <label className="field">
              <span>默认主题</span>
              <select name="theme" defaultValue={item.theme || 'auto'}>
                <option value="auto">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
              </select>
            </label>
            <Field label="绑定域名" name="domains" type="textarea" value={item.domains?.join('\n')} wide
              hint="每行一个主机名。保存后需将域名解析到本站。" />
            <Field label="Logo 地址" name="logoUrl" value={item.logoUrl} max={500} />
            <Field label="站点图标地址" name="faviconUrl" value={item.faviconUrl} max={500} />
            <label className="toggle wide">
              <input type="checkbox" name="registerEnabled" defaultChecked={item.registerEnabled !== false} />允许新用户注册
            </label>
          </FormSection>
          <FormSection title="搜索展示">
            <Field label="页面标题" name="seoTitle" value={item.seo?.title} max={120} />
            <Field label="关键词" name="keywords" value={item.seo?.keywords?.join('，')} max={820} hint="多个关键词用逗号分隔。" />
            <Field label="页面描述" name="description" type="textarea" value={item.seo?.description} max={300} wide />
          </FormSection>
          <FormSection title="联系与公告">
            <Field label="客服 QQ" name="qq" value={item.contact?.qq} max={40} />
            <Field label="客服邮箱" name="email" type="email" value={item.contact?.email} max={120} />
            <Field label="微信二维码地址" name="wechatQrUrl" value={item.contact?.wechatQrUrl} max={500} wide />
            <Field label="站点公告" name="announcement" type="textarea" value={item.announcement} max={500} wide />
            <Field label="页脚文字" name="footerText" value={item.footerText} max={300} wide />
          </FormSection>
          <FormSection title="创作与模型">
            <Field label="本站隐藏模型" name="disabledModels" type="textarea" value={item.disabledModels?.join('\n')}
              hint="每行一个类型和模型标识，例如 text:demo-model。" />
            <Field label="小说创作限制词" name="novelBlockedTerms" type="textarea" value={item.novelBlockedTerms?.join('\n')}
              hint="每行一个词，最多 300 条。" />
          </FormSection>
        </fieldset>
        {saveError && <ErrorBox message={saveError} />}
        {canWrite && <footer><button className="button primary" disabled={saving}>保存站点设置</button></footer>}
      </form>
    </>
  );
}

function SitePage({ session, onSiteChange }: SiteProps) {
  const { result, reload } = usePartnerQuery<SiteConfig>('site');
  const canWrite = Number(session.user.role) >= 90;
  return (
    <>
      <Heading title="站点设置" description={canWrite ? '管理站点资料、域名和可见内容。' : '查看当前站点的配置。此账号拥有只读权限。'} />
      {result.status === 'loading' && <p className="loading" role="status">正在读取站点设置…</p>}
      {result.status === 'error' && <ErrorBox message={result.message} onRetry={reload} />}
      {result.status === 'ready' && <SiteForm initial={result.data} canWrite={canWrite} onSiteChange={onSiteChange} />}
    </>
  );
}

export function Site(props: SiteProps) {
  return <SitePage key={props.session.site.siteId} {...props} />;
}

export function Members() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '20', keyword });
  const { result, reload } = usePartnerQuery<MemberPage>('members?' + params);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = fieldValue(new FormData(event.currentTarget), 'keyword').trim();
    if (term === keyword && page === 1) reload();
    setKeyword(term);
    setPage(1);
  }

  return (
    <>
      <Heading title="站点成员" description="查询当前站点的成员、账号状态和后台角色。" />
      <section className="panel">
        <div className="panel-title"><h2>成员列表</h2></div>
        <form className="toolbar" onSubmit={search}>
          <input aria-label="搜索成员" name="keyword" type="search" placeholder="输入昵称或手机号" maxLength={80} />
          <button className="button">搜索</button>
        </form>
        <div className="results" aria-live="polite">
          {result.status === 'loading' && <p className="loading" role="status">正在读取成员…</p>}
          {result.status === 'error' && <ErrorBox message={result.message} onRetry={reload} />}
          {result.status === 'ready' && <Table headers={['昵称', '手机号', '角色', '账号状态']}
            empty={keyword ? '未找到匹配的成员' : '本站暂无成员'} rows={result.data.items.map((row) => [
              <b>{row.nickname || '未设置昵称'}</b>, row.mobile || '—', roleName(row.role),
              <span className={'tag ' + (row.state ? 'ok' : 'off')}>{row.state ? '正常' : '已停用'}</span>,
            ])} />}
        </div>
        {result.status === 'ready' && (
          <div className="pagination">
            <span>共 {number(result.data.total)} 人 · 第 {page} 页</span>
            <div>
              <button className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
              <button className="button" disabled={page * result.data.pageSize >= result.data.total} onClick={() => setPage(page + 1)}>下一页</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export function Audits() {
  const [query, setQuery] = useState('clientId=&limit=50');
  const { result, reload } = usePartnerQuery<AuditRecord[]>('audits?' + query);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams({ clientId: fieldValue(form, 'clientId').trim(), limit: fieldValue(form, 'limit') }).toString();
    if (next === query) reload();
    else setQuery(next);
  }

  return (
    <>
      <Heading title="调用审计" description="按密钥追踪开放接口的请求、状态码和耗时。" />
      <section className="panel">
        <div className="panel-title"><h2>调用记录</h2></div>
        <form className="toolbar" onSubmit={search}>
          <input type="search" name="clientId" placeholder="按 Client ID 筛选" aria-label="按 Client ID 筛选" />
          <label className="inline-field">条数<select name="limit" defaultValue="50">
            <option>50</option><option>100</option><option>200</option>
          </select></label>
          <button className="button">查询</button>
        </form>
        <div className="results" aria-live="polite">
          {result.status === 'loading' && <p className="loading" role="status">正在读取审计记录…</p>}
          {result.status === 'error' && <ErrorBox message={result.message} onRetry={reload} />}
          {result.status === 'ready' && <Table headers={['时间', '接口', '状态码', '耗时', 'Client ID', '来源 IP', '执行 ID']}
            empty="没有匹配的调用记录" rows={result.data.map((row) => [
              dateTime(row.createdAt), <><b>{row.method}</b> <code>{row.path}</code></>,
              <span className={'tag ' + (row.status >= 400 ? 'off' : 'ok')}>{row.status}</span>,
              number(row.durationMs) + ' ms', <code>{row.clientId || '—'}</code>, row.ip || '—',
              <code>{row.executionId || '—'}</code>,
            ])} />}
        </div>
      </section>
    </>
  );
}
