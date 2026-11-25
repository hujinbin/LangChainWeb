import { api, html, roleName, errorBox } from './ui.js';
import { usage } from './usage.js';
import { site, members, audits } from './site.js';
import { keys } from './keys.js';

const pages = {
  overview: { name: '站点概况', icon: '▦', group: '工作台', render: usage },
  usage: { name: '用量分析', icon: '∿', group: '工作台', render: usage },
  members: { name: '站点成员', icon: '♙', group: '站点管理', render: members },
  site: { name: '站点设置', icon: '⚙', group: '站点管理', render: site },
  keys: { name: 'API 密钥', icon: '⚿', group: '开发接入', render: keys },
  audits: { name: '调用审计', icon: '≡', group: '开发接入', render: audits },
};
const app = document.querySelector('#app');
const brand = '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>';
let session = null,
  checking = null,
  controller = null;
const route = () => location.hash.slice(1).replace(/^\/+/, '').toLowerCase();
function closeDialog() {
  const dialog = document.querySelector('#dialog');
  if (dialog.open) dialog.close();
}
function setSession(data) {
  session = data;
  if (session && (!session.user || !session.site)) throw new Error('后台会话数据不完整，请重新登录。');
}
function login(message = '') {
  controller?.abort();
  closeDialog();
  session = null;
  document.title = '代理商登录 · 织流';
  app.innerHTML =
    '<main class="login-page"><div class="login-layout"><section class="login-aside"><div class="brand">' +
    brand +
    '<b>织流</b></div><div class="login-intro"><h1>站点管理中心</h1><p>管理站点成员、查看运行用量，<br>为开发者配置接入凭证。</p></div>' +
    '<div class="login-pattern" aria-hidden="true"><i></i><i></i><i></i></div><a href="/">返回工作台 ↗</a></section>' +
    '<section class="login-form-panel"><div><h2>代理商登录</h2><p>使用本站授权的管理账号继续。</p></div><form class="login-form">' +
    '<label class="field"><span>手机号</span><input name="mobile" type="tel" inputmode="tel" autocomplete="username" placeholder="请输入手机号" required maxlength="32"></label>' +
    '<label class="field"><span>密码</span><input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required maxlength="256"></label>' +
    '<p class="error" role="alert"' +
    (message ? '' : ' hidden') +
    '>' +
    html(message) +
    '</p><button class="button primary">登录后台 <span aria-hidden="true">→</span></button>' +
    '</form><a href="/docs">查看 API 文档 ↗</a></section></div></main>';
  const form = app.querySelector('form');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const alert = form.querySelector('[role=alert]'),
      button = form.querySelector('button');
    alert.hidden = true;
    button.disabled = true;
    button.textContent = '正在登录…';
    try {
      setSession(
        await api('login', {
          method: 'POST',
          body: { mobile: form.elements.mobile.value.trim(), password: form.elements.password.value },
        })
      );
      form.reset();
      openPage();
    } catch (error) {
      alert.textContent = error.message;
      alert.hidden = false;
      button.disabled = false;
      button.textContent = '登录后台 →';
    }
  };
}
function shell(page) {
  const { user, site } = session;
  const nav = Object.entries(pages).filter(([id]) => id !== 'keys' || Number(user.role) >= 90);
  const groups = [...new Set(nav.map(([, view]) => view.group))];
  app.innerHTML =
    '<div class="layout"><button class="scrim" tabindex="-1" aria-label="关闭导航" hidden></button>' +
    '<aside class="sidebar" aria-label="站点导航"><a class="brand" href="#overview">' +
    brand +
    '<span><b>织流</b><small>代理商后台</small></span></a>' +
    '<div class="site-badge"><span class="site-initial">' +
    html((site.name || '站').slice(0, 1)) +
    '</span><div><b>' +
    html(site.name) +
    '</b><small>' +
    html(site.siteId) +
    '</small></div></div>' +
    '<nav>' +
    groups
      .map(
        (group) =>
          '<div class="nav-group"><p>' +
          group +
          '</p>' +
          nav
            .filter(([, view]) => view.group === group)
            .map(
              ([id, view]) =>
                '<a href="#' +
                id +
                '"' +
                (id === page ? ' aria-current="page"' : '') +
                '><i aria-hidden="true">' +
                view.icon +
                '</i>' +
                view.name +
                '</a>'
            )
            .join('') +
          '</div>'
      )
      .join('') +
    '</nav><div class="side-bottom"><a href="/docs"><i aria-hidden="true">▤</i>API 文档 <span>↗</span></a><a href="/"><i aria-hidden="true">⌂</i>返回工作台 <span>↗</span></a></div>' +
    '<div class="account"><span class="avatar">' +
    html((user.nickname || '管').slice(0, 1)) +
    '</span><div><b>' +
    html(user.nickname || '管理账号') +
    '</b><small>' +
    html(roleName(user.role)) +
    '</small></div><button class="icon-button" data-logout title="退出登录" aria-label="退出登录">⇥</button></div></aside>' +
    '<div class="workspace"><header class="topbar"><button class="icon-button mobile-toggle" aria-label="打开导航" aria-expanded="false">☰</button><div>代理商后台 <span>/</span> <b>' +
    html(pages[page].name) +
    '</b></div><a href="/docs">API 文档 ↗</a></header><main class="content" tabindex="-1"><p class="loading" role="status">正在读取' +
    pages[page].name +
    '…</p></main></div></div>';
  const layout = app.querySelector('.layout'),
    menu = app.querySelector('.mobile-toggle'),
    scrim = app.querySelector('.scrim');
  function toggle(open) {
    layout.classList.toggle('menu-open', open);
    scrim.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
    if (open) app.querySelector('nav a')?.focus();
    else menu.focus();
  }
  menu.onclick = () => toggle(!layout.classList.contains('menu-open'));
  scrim.onclick = () => toggle(false);
  layout.onkeydown = (event) => {
    if (event.key === 'Escape' && layout.classList.contains('menu-open')) toggle(false);
  };
  for (const link of app.querySelectorAll('nav a'))
    link.onclick = () => {
      if (layout.classList.contains('menu-open')) toggle(false);
    };
  const out = app.querySelector('[data-logout]');
  out.onclick = async () => {
    out.disabled = true;
    try {
      await api('logout', { method: 'POST', body: {} });
      history.replaceState(null, '', '#/login');
      login();
    } catch (error) {
      out.disabled = false;
      document.querySelector('#notifications').textContent = error.message;
    }
  };
  return app.querySelector('main');
}
async function openPage() {
  if (!session) return;
  const page = Object.hasOwn(pages, route()) ? route() : 'overview';
  if (route() !== page) history.replaceState(null, '', '#' + page);
  controller?.abort();
  closeDialog();
  controller = new AbortController();
  const { signal } = controller;
  const main = shell(page);
  document.title = pages[page].name + ' · 代理商后台';
  try {
    await pages[page].render(main, {
      page,
      session,
      signal,
      onSiteChange: (name) => {
        if (!session) return;
        session.site.name = name;
        app.querySelector('.site-badge b').textContent = name;
        app.querySelector('.site-initial').textContent = (name || '站').slice(0, 1);
      },
    });
  } catch (error) {
    if (signal.aborted) return;
    main.innerHTML = errorBox(error.message) + '<button class="button">重新读取</button>';
    main.querySelector('button').onclick = openPage;
  }
}
async function start() {
  if (checking) return;
  checking = api('session');
  try {
    setSession(await checking);
    await openPage();
  } catch (error) {
    if (error.status === 401) login();
    else if (!error.status || [404, 502, 503, 504].includes(error.status))
      login('暂时无法连接代理商服务。请稍后重试，或联系站点管理员检查接口配置。');
    else {
      app.innerHTML =
        '<main class="initial"><h1>站点后台暂时无法打开</h1>' +
        errorBox(error.message) +
        '<button class="button">重试</button> <a href="/">返回工作台</a></main>';
      app.querySelector('button').onclick = start;
    }
  } finally {
    checking = null;
  }
}
window.addEventListener('hashchange', () => {
  if (session) openPage();
});
window.addEventListener('partner-session-expired', () => login('登录已过期，请重新登录。'));
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    closeDialog();
    start();
  }
});
start();
