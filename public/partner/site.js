import { api, html, number, heading, table, errorBox, inputField, notice, roleName, dateTime } from './ui.js';

const split = (value) =>
  String(value || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const formSection = (title, fields) =>
  '<section class="panel"><div class="panel-title"><h2>' +
  title +
  '</h2></div><div class="form-grid">' +
  fields +
  '</div></section>';

export async function site(main, { signal, session, onSiteChange }) {
  const item = await api('site', { signal });
  if (signal.aborted) return;
  const canWrite = Number(session.user.role) >= 90;
  const text = (label, name, value, max, options) => inputField(label, name, value, { max, ...options });
  const area = (label, name, value, options) => inputField(label, name, value, { type: 'textarea', ...options });
  const info = formSection(
    '站点资料',
    text('站点名称', 'name', item.name, 60, { required: true }) +
      '<label class="field"><span>默认主题</span><select name="theme">' +
      Object.entries({ auto: '跟随系统', light: '浅色', dark: '深色' })
        .map(
          ([k, v]) => '<option value="' + k + '"' + (item.theme === k ? ' selected' : '') + '>' + v + '</option>'
        )
        .join('') +
      '</select></label>' +
      area('绑定域名', 'domains', (item.domains || []).join('\n'), {
        wide: true,
        hint: '每行一个主机名。保存后需将域名解析到本站。',
      }) +
      text('Logo 地址', 'logoUrl', item.logoUrl, 500) +
      text('站点图标地址', 'faviconUrl', item.faviconUrl, 500) +
      '<label class="toggle wide"><input type="checkbox" name="registerEnabled"' +
      (item.registerEnabled !== false ? ' checked' : '') +
      '>允许新用户注册</label>'
  );
  const seo = formSection(
    '搜索展示',
    text('页面标题', 'seoTitle', item.seo?.title, 120) +
      text('关键词', 'keywords', (item.seo?.keywords || []).join('，'), 820, { hint: '多个关键词用逗号分隔。' }) +
      area('页面描述', 'description', item.seo?.description, { wide: true, max: 300 })
  );
  const contact = formSection(
    '联系与公告',
    text('客服 QQ', 'qq', item.contact?.qq, 40) +
      text('客服邮箱', 'email', item.contact?.email, 120, { type: 'email' }) +
      text('微信二维码地址', 'wechatQrUrl', item.contact?.wechatQrUrl, 500, { wide: true }) +
      area('站点公告', 'announcement', item.announcement, { max: 500, wide: true }) +
      text('页脚文字', 'footerText', item.footerText, 300, { wide: true })
  );
  const controls = formSection(
    '创作与模型',
    area('本站隐藏模型', 'disabledModels', (item.disabledModels || []).join('\n'), {
      hint: '每行一个类型和模型标识，例如 text:demo-model。',
    }) +
      area('小说创作限制词', 'novelBlockedTerms', (item.novelBlockedTerms || []).join('\n'), {
        hint: '每行一个词，最多 300 条。',
      })
  );
  main.innerHTML =
    heading('站点设置', canWrite ? '管理站点资料、域名和可见内容。' : '查看当前站点的配置。此账号拥有只读权限。') +
    '<div class="plan"><span>站点 ID <b>' +
    html(item.siteId) +
    '</b></span><span>套餐 <b>' +
    html(item.planName || '未设置') +
    '</b></span>' +
    (item.quotaDescription ? '<span>配额 <b>' + html(item.quotaDescription) + '</b></span>' : '') +
    '</div>' +
    '<form class="site-form"><fieldset' +
    (canWrite ? '' : ' disabled') +
    '>' +
    info +
    seo +
    contact +
    controls +
    '</fieldset>' +
    '<p class="error" role="alert" hidden></p>' +
    (canWrite ? '<footer><button class="button primary">保存站点设置</button></footer>' : '') +
    '</form>';
  if (!canWrite) return;
  const form = main.querySelector('form'),
    alert = form.querySelector('[role=alert]');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    const body = {
      name: fields.name.trim(),
      domains: split(fields.domains),
      logoUrl: fields.logoUrl.trim(),
      faviconUrl: fields.faviconUrl.trim(),
      seo: {
        title: fields.seoTitle,
        description: fields.description,
        keywords: fields.keywords
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      },
      theme: fields.theme,
      announcement: fields.announcement,
      footerText: fields.footerText,
      contact: { qq: fields.qq, email: fields.email, wechatQrUrl: fields.wechatQrUrl },
      registerEnabled: fields.registerEnabled === 'on',
      disabledModels: split(fields.disabledModels),
      novelBlockedTerms: split(fields.novelBlockedTerms),
    };
    const currentHost = location.hostname.toLowerCase();
    if (
      (item.domains || []).includes(currentHost) &&
      !body.domains.map((domain) => domain.toLowerCase()).includes(currentHost) &&
      !window.confirm('移除当前域名后，此地址将无法进入本站。仍要保存吗？')
    )
      return;
    const button = form.querySelector('button');
    button.disabled = true;
    form.querySelector('fieldset').disabled = true;
    alert.hidden = true;
    try {
      const next = await api('site', { method: 'PATCH', body, signal });
      if (!signal.aborted) {
        Object.assign(item, next || body);
        onSiteChange(item.name);
        notice('站点设置已保存');
      }
    } catch (error) {
      if (!signal.aborted) {
        alert.textContent = error.message;
        alert.hidden = false;
      }
    } finally {
      button.disabled = false;
      form.querySelector('fieldset').disabled = false;
    }
  };
}

export async function members(main, { signal }) {
  let page = 1,
    keyword = '',
    sequence = 0;
  main.innerHTML =
    heading('站点成员', '查询当前站点的成员、账号状态和后台角色。') +
    '<section class="panel"><div class="panel-title"><h2>成员列表</h2></div><form class="toolbar"><input aria-label="搜索成员" name="keyword" type="search" placeholder="输入昵称或手机号" maxlength="80"><button class="button">搜索</button></form>' +
    '<div class="results" aria-live="polite"></div><div class="pagination"></div></section>';
  const form = main.querySelector('form'),
    results = main.querySelector('.results'),
    pager = main.querySelector('.pagination');
  async function load() {
    const current = ++sequence;
    results.innerHTML = '<p class="loading" role="status">正在读取成员…</p>';
    pager.replaceChildren();
    try {
      const data = await api('members?' + new URLSearchParams({ page, pageSize: 20, keyword }), { signal });
      if (signal.aborted || current !== sequence) return;
      results.innerHTML = table(
        ['昵称', '手机号', '角色', '账号状态'],
        data.items.map((row) => [
          '<b>' + html(row.nickname || '未设置昵称') + '</b>',
          html(row.mobile || '—'),
          html(roleName(row.role)),
          '<span class="tag ' + (row.state ? 'ok' : 'off') + '">' + (row.state ? '正常' : '已停用') + '</span>',
        ]),
        keyword ? '未找到匹配的成员' : '本站暂无成员'
      );
      pager.innerHTML =
        '<span>共 ' +
        number(data.total) +
        ' 人 · 第 ' +
        page +
        ' 页</span><div><button class="button" data-prev' +
        (page <= 1 ? ' disabled' : '') +
        '>上一页</button><button class="button" data-next' +
        (page * data.pageSize >= data.total ? ' disabled' : '') +
        '>下一页</button></div>';
      pager.querySelector('[data-prev]').onclick = () => {
        page--;
        load();
      };
      pager.querySelector('[data-next]').onclick = () => {
        page++;
        load();
      };
    } catch (error) {
      if (!signal.aborted && current === sequence) results.innerHTML = errorBox(error.message);
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    keyword = form.elements.keyword.value.trim();
    page = 1;
    load();
  };
  await load();
}

export async function audits(main, { signal }) {
  main.innerHTML =
    heading('调用审计', '按密钥追踪开放接口的请求、状态码和耗时。') +
    '<section class="panel"><div class="panel-title"><h2>调用记录</h2></div><form class="toolbar"><input type="search" name="clientId" placeholder="按 Client ID 筛选" aria-label="按 Client ID 筛选">' +
    '<label class="inline-field">条数<select name="limit"><option>50</option><option>100</option><option>200</option></select></label><button class="button">查询</button></form><div class="results"></div></section>';
  const form = main.querySelector('form'),
    area = main.querySelector('.results');
  let sequence = 0;
  async function load() {
    const current = ++sequence;
    area.innerHTML = '<p class="loading" role="status">正在读取审计记录…</p>';
    try {
      const rows = await api(
        'audits?' +
          new URLSearchParams({ clientId: form.elements.clientId.value.trim(), limit: form.elements.limit.value }),
        { signal }
      );
      if (signal.aborted || current !== sequence) return;
      area.innerHTML = table(
        ['时间', '接口', '状态码', '耗时', 'Client ID', '来源 IP', '执行 ID'],
        rows.map((row) => [
          html(dateTime(row.createdAt)),
          '<b>' + html(row.method) + '</b> <code>' + html(row.path) + '</code>',
          '<span class="tag ' + (row.status >= 400 ? 'off' : 'ok') + '">' + html(row.status) + '</span>',
          number(row.durationMs) + ' ms',
          '<code>' + html(row.clientId || '—') + '</code>',
          html(row.ip || '—'),
          '<code>' + html(row.executionId || '—') + '</code>',
        ]),
        '没有匹配的调用记录'
      );
    } catch (error) {
      if (!signal.aborted && current === sequence) area.innerHTML = errorBox(error.message);
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    load();
  };
  await load();
}
