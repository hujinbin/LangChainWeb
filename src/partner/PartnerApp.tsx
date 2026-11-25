import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Keys from './Keys';
import { Site, Members, Audits } from './Site';
import Usage from './Usage';
import { api, checkedSession, ErrorBox, errorMessage, Notifications, notify, PartnerApiError, roleName, type PartnerSession } from './shared';

const pages = [
  { id: 'overview', name: '站点概况', icon: '▦', group: '工作台' },
  { id: 'usage', name: '用量分析', icon: '∿', group: '工作台' },
  { id: 'members', name: '站点成员', icon: '♙', group: '站点管理' },
  { id: 'site', name: '站点设置', icon: '⚙', group: '站点管理' },
  { id: 'keys', name: 'API 密钥', icon: '⚿', group: '开发接入' },
  { id: 'audits', name: '调用审计', icon: '≡', group: '开发接入' },
] as const;
const groups = [...new Set(pages.map(page => page.group))];
const currentHash = () => window.location.hash.slice(1).replace(/^\/+/, '').toLowerCase();
function watchHash(update: () => void) {
  window.addEventListener('hashchange', update);
  return () => window.removeEventListener('hashchange', update);
}
function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function Login({ message, onSuccess }: { message?: string; onSuccess: (session: PartnerSession) => void }) {
  const [error, setError] = useState(message || '');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError('');
    try {
      const data = await api<PartnerSession>('login', { method: 'POST', signal: request.signal, body: {
        mobile: String(fields.get('mobile') || '').trim(), password: String(fields.get('password') || ''),
      } });
      if (!request.signal.aborted) onSuccess(checkedSession(data));
    } catch (failure) {
      if (!request.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!request.signal.aborted) setBusy(false);
      pending.current = null;
    }
  }
  return <main className="login-page"><div className="login-layout">
    <section className="login-aside">
      <div className="brand"><BrandMark /><b>织流</b></div>
      <div className="login-intro"><h1>站点管理中心</h1><p>管理站点成员、查看运行用量，<br />为开发者配置接入凭证。</p></div>
      <div className="login-pattern" aria-hidden="true"><i /><i /><i /></div><a href="/">返回工作台 ↗</a>
    </section>
    <section className="login-form-panel">
      <div><h2>代理商登录</h2><p>使用本站授权的管理账号继续。</p></div>
      <form className="login-form" onSubmit={submit}>
        <label className="field"><span>手机号</span><input name="mobile" type="tel" inputMode="tel" autoComplete="username" placeholder="请输入手机号" required maxLength={32} /></label>
        <label className="field"><span>密码</span><input name="password" type="password" autoComplete="current-password" placeholder="请输入密码" required maxLength={256} /></label>
        {error && <ErrorBox message={error} />}
        <button className="button primary" disabled={busy}>{busy ? '正在登录…' : <>登录后台 <span aria-hidden="true">→</span></>}</button>
      </form>
      <a href="/docs">查看 API 文档 ↗</a>
    </section>
  </div></main>;
}

function Workspace({ session, onLogout, onSiteChange }: {
  session: PartnerSession; onLogout: () => void; onSiteChange: (name: string) => void;
}) {
  const hash = useSyncExternalStore(watchHash, currentHash);
  const page = pages.find(item => item.id === hash) || pages[0];
  const { user, site } = session;
  const canManage = user.role === 90;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash !== page.id) window.history.replaceState(null, '', '#' + page.id);
    document.title = page.name + ' · 代理商后台';
  }, [hash, page]);

  function toggleMenu(open: boolean) {
    setMenuOpen(open);
    if (open) nav.current?.querySelector('a')?.focus();
    else menu.current?.focus();
  }
  async function logout() {
    setLoggingOut(true);
    try {
      await api('logout', { method: 'POST' });
      window.history.replaceState(null, '', '#/login');
      onLogout();
    } catch (failure) { notify(errorMessage(failure)); }
    finally { setLoggingOut(false); }
  }

  return <div className={'layout' + (menuOpen ? ' menu-open' : '')} onKeyDown={e => {
    if (e.key === 'Escape' && menuOpen) toggleMenu(false);
  }}>
    <button className="scrim" tabIndex={-1} aria-label="关闭导航" hidden={!menuOpen} onClick={() => toggleMenu(false)} />
    <aside className="sidebar" aria-label="站点导航">
      <a className="brand" href="#overview"><BrandMark /><span><b>织流</b><small>代理商后台</small></span></a>
      <div className="site-badge"><span className="site-initial">{(site.name || '站').slice(0, 1)}</span>
        <div><b>{site.name}</b><small>{site.siteId}</small></div></div>
      <nav ref={nav} id="partner-nav">{groups.map(group => <div className="nav-group" key={group}><p>{group}</p>
        {pages.filter(item => item.group === group && (item.id !== 'keys' || canManage)).map(item =>
          <a key={item.id} href={'#' + item.id} aria-current={item.id === page.id ? 'page' : undefined} onClick={() => {
            if (menuOpen) toggleMenu(false);
          }}><i aria-hidden="true">{item.icon}</i>{item.name}</a>)}
      </div>)}</nav>
      <div className="side-bottom"><a href="/docs"><i aria-hidden="true">▤</i>API 文档 <span>↗</span></a>
        <a href="/"><i aria-hidden="true">⌂</i>返回工作台 <span>↗</span></a></div>
      <div className="account"><span className="avatar">{(user.nickname || '管').slice(0, 1)}</span>
        <div><b>{user.nickname || '管理账号'}</b><small>{roleName(user.role)}</small></div>
        <button className="icon-button" title="退出登录" aria-label="退出登录" data-logout="" onClick={logout} disabled={loggingOut}>⇥</button></div>
    </aside>
    <div className="workspace"><header className="topbar">
      <button ref={menu} className="icon-button mobile-toggle" aria-label="打开导航" aria-controls="partner-nav" aria-expanded={menuOpen} onClick={() => toggleMenu(!menuOpen)}>☰</button>
      <div>代理商后台 <span>/</span> <b>{page.name}</b></div><a href="/docs">API 文档 ↗</a>
    </header>
    <main className="content" tabIndex={-1} key={page.id}>
      {(page.id === 'overview' || page.id === 'usage') && <Usage session={session} overview={page.id === 'overview'} />}
      {page.id === 'site' && <Site session={session} onSiteChange={onSiteChange} />}
      {page.id === 'members' && <Members />}
      {page.id === 'audits' && <Audits />}
      {page.id === 'keys' && (canManage ? <Keys /> : <ErrorBox message="当前账号为只读运营，无法管理 API 密钥。" />)}
    </main></div>
  </div>;
}

type State = { kind: 'loading' } | { kind: 'login'; message?: string } | { kind: 'error'; message: string }
  | { kind: 'ready'; session: PartnerSession };

export default function PartnerApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const restore = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt(n => n + 1);
  }, []);

  useEffect(() => {
    const request = new AbortController();
    async function check() {
      try {
        const data = await api<PartnerSession>('session', { signal: request.signal });
        if (!request.signal.aborted) setState({ kind: 'ready', session: checkedSession(data) });
      } catch (error) {
        if (request.signal.aborted) return;
        const status = error instanceof PartnerApiError ? error.status : 0;
        if (status === 401) setState({ kind: 'login' });
        else if ([0, 404, 502, 503, 504].includes(status)) {
          setState({ kind: 'login', message: '暂时无法连接代理商服务。请稍后重试，或联系站点管理员检查接口配置。' });
        } else setState({ kind: 'error', message: errorMessage(error) });
      }
    }
    void check();
    const expired = () => { request.abort(); setState({ kind: 'login', message: '登录已过期，请重新登录。' }); };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) restore(); };
    window.addEventListener('partner-session-expired', expired);
    window.addEventListener('pageshow', pageshow);
    return () => {
      request.abort();
      window.removeEventListener('partner-session-expired', expired);
      window.removeEventListener('pageshow', pageshow);
    };
  }, [attempt, restore]);
  useEffect(() => {
    if (state.kind !== 'ready') document.title = state.kind === 'login' ? '代理商登录 · 织流' : '代理商后台 · 织流';
  }, [state.kind]);
  return <>
    {state.kind === 'loading' && <main className="initial" role="status">正在连接站点后台…</main>}
    {state.kind === 'login' && <Login message={state.message} onSuccess={session => setState({ kind: 'ready', session })} />}
    {state.kind === 'error' && <main className="initial"><h1>站点后台暂时无法打开</h1><ErrorBox message={state.message} onRetry={restore} /><a href="/">返回工作台</a></main>}
    {state.kind === 'ready' && <Workspace session={state.session} onLogout={() => setState({ kind: 'login' })} onSiteChange={name =>
      setState(previous => previous.kind === 'ready'
        ? { kind: 'ready', session: { ...previous.session, site: { ...previous.session.site, name } } } : previous)
    } />}
    <Notifications />
  </>;
}
