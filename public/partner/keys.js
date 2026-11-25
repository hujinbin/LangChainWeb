import {
  api,
  html,
  number,
  heading,
  table,
  dateTime,
  errorBox,
  modal,
  modalError,
  inputField,
  notice,
} from './ui.js';

const labels = {
  'workflow:read': '查看工作流',
  'workflow:run': '运行工作流',
  'execution:read': '查看执行记录',
  'credits:read': '查看积分',
  'model:read': '查看模型',
};
const dateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
function secretDialog(data) {
  const d = modal(
    '保存接入凭证',
    '<p>请将 Client Secret 保存到服务端密钥管理工具。关闭后仅能查看掩码。</p>' +
      '<label class="field">Client ID<input readonly value="' +
      html(data.clientId) +
      '"></label>' +
      '<label class="field">Client Secret<input data-secret readonly autocomplete="off" spellcheck="false" value="' +
      html(data.clientSecret) +
      '"></label>' +
      '<div class="dialog-actions"><button class="button" data-copy>复制 Secret</button><button class="button primary" data-done>已保存</button></div>'
  );
  d.querySelector('[data-done]').onclick = () => d.close();
  d.querySelector('[data-copy]').onclick = async () => {
    const input = d.querySelector('[data-secret]');
    try {
      await navigator.clipboard.writeText(input.value);
      notice('Secret 已复制');
    } catch {
      input.focus();
      input.select();
      notice('请使用复制快捷键保存选中的 Secret');
    }
  };
}
function keyLabel(row) {
  if (row.status !== 'active') return ['已停用', 'off'];
  if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) return ['已过期', 'off'];
  return ['启用中', 'ok'];
}

export async function keys(main, { signal, session }) {
  if (Number(session.user.role) < 90) {
    main.innerHTML =
      heading('API 密钥', '当前账号拥有运营权限。密钥由站点管理员管理。') +
      '<a class="button" href="#overview">返回站点概况</a>';
    return;
  }
  const [scopesData, initialKeys] = await Promise.all([api('scopes', { signal }), api('keys', { signal })]);
  if (signal.aborted) return;
  const scopes = scopesData.scopes;
  main.innerHTML =
    heading(
      'API 密钥',
      '创建访问凭证，管理接口权限、有效期与调用限制。',
      '<button type="button" class="button primary" data-new>＋ 创建密钥</button>'
    ) +
    '<section class="panel"><div class="panel-title"><h2>站点密钥</h2><a href="/docs">接入文档 ↗</a></div><div class="results"></div></section>';
  function render(rows) {
    const area = main.querySelector('.results');
    area.innerHTML = table(
      ['名称 / Client ID', '状态', '权限', '调用限制', '到期时间', '操作'],
      rows.map((row, i) => {
        const [status, tone] = keyLabel(row);
        return [
          '<b>' + html(row.name) + '</b><small class="sub"><code>' + html(row.clientId) + '</code></small>',
          '<span class="tag ' + tone + '">' + status + '</span>',
          (row.scopes || []).map((scope) => html(labels[scope] || scope)).join('、'),
          number(row.rateLimitPerMinute) +
            ' 次/分钟<small class="sub">并发 ' +
            number(row.maxConcurrentRuns) +
            '</small>',
          row.expiresAt ? html(dateTime(row.expiresAt)) : '长期',
          '<div class="row-actions">' +
            [
              ['edit', '编辑'],
              ['toggle', row.status === 'active' ? '停用' : '启用'],
              ['rotate', '轮换'],
              ['delete', '删除'],
            ]
              .map(
                ([action, label]) =>
                  '<button type="button" data-row="' + i + '" data-act="' + action + '">' + label + '</button>'
              )
              .join('') +
            '</div>',
        ];
      }),
      '还没有 API 密钥，创建后即可按作用域调用接口。'
    );
    for (const button of area.querySelectorAll('[data-act]'))
      button.onclick = () => {
        const row = rows[Number(button.dataset.row)];
        if (button.dataset.act === 'edit') edit(row);
        else change(row, button.dataset.act);
      };
  }
  async function reload() {
    try {
      const rows = await api('keys', { signal });
      if (!signal.aborted) render(rows);
    } catch (error) {
      if (!signal.aborted)
        main.querySelector('.results').innerHTML =
          errorBox(error.message) + '<a href="#keys" data-reload>重新读取</a>';
    }
    const link = main.querySelector('[data-reload]');
    if (link)
      link.onclick = (event) => {
        event.preventDefault();
        reload();
      };
  }
  function change(row, action) {
    const deleting = action === 'delete',
      rotate = action === 'rotate',
      enabled = row.status !== 'active';
    const label = deleting ? '删除' : rotate ? '轮换' : enabled ? '启用' : '停用';
    const d = modal(
      label + '密钥',
      '<p>' +
        html(row.name) +
        '（' +
        html(row.clientId) +
        '）</p><p>' +
        (deleting
          ? '删除后，持有这组凭证的应用将失去访问权限。'
          : rotate
          ? '轮换后，旧 Secret 和已签发的令牌都会失效。请及时更新调用方配置。'
          : enabled
          ? '启用后，符合访问策略的调用方可继续换取令牌。'
          : '停用后，使用该密钥的接口请求将被拒绝。') +
        '</p><p class="error" role="alert" hidden></p><div class="dialog-actions"><button class="button" data-cancel>取消</button>' +
        '<button class="button ' +
        (deleting ? 'danger' : 'primary') +
        '" data-confirm>确认' +
        label +
        '</button></div>'
    );
    d.querySelector('[data-cancel]').onclick = () => d.close();
    d.querySelector('[data-confirm]').onclick = async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        const data = await api('keys/' + encodeURIComponent(row.id), {
          method: deleting ? 'DELETE' : 'PATCH',
          body: rotate ? { rotateSecret: true } : deleting ? {} : { status: enabled ? 'active' : 'disabled' },
          signal,
        });
        if (signal.aborted) return;
        d.close();
        if (rotate) secretDialog(data);
        else notice('密钥已' + label);
        await reload();
      } catch (error) {
        if (!signal.aborted) {
          modalError(d, error);
          btn.disabled = false;
        }
      }
    };
  }
  function edit(row) {
    const creating = !row;
    const owner = creating
      ? '<div class="field wide"><label for="owner-query">资源所属成员</label><div class="toolbar"><input id="owner-query" maxlength="80" placeholder="搜索昵称或手机号"><button type="button" class="button" data-search>查找</button></div>' +
        '<select aria-label="选择资源所属成员" name="ownerId"><option value="">当前管理员</option></select><small data-member-status>默认使用当前管理员的工作流与积分。</small></div>'
      : '';
    const d = modal(
      creating ? '创建 API 密钥' : '编辑 API 密钥',
      '<form><fieldset class="form-grid">' +
        inputField('密钥名称', 'name', row?.name, { required: true, max: 60, wide: true }) +
        owner +
        '<fieldset class="permission wide"><legend>允许的操作</legend>' +
        scopes
          .map(
            (scope) =>
              '<label><input type="checkbox" name="scope" value="' +
              html(scope) +
              '"' +
              ((row?.scopes || ['model:read']).includes(scope) ? ' checked' : '') +
              '>' +
              html(labels[scope] || scope) +
              '</label>'
          )
          .join('') +
        '</fieldset>' +
        inputField('每分钟请求上限', 'rate', row?.rateLimitPerMinute ?? 60, {
          type: 'number',
          required: true,
          min: 1,
        }) +
        inputField('并发运行上限', 'concurrent', row?.maxConcurrentRuns ?? 5, {
          type: 'number',
          required: true,
          min: 1,
        }) +
        inputField('到期时间', 'expires', dateInput(row?.expiresAt), {
          type: 'datetime-local',
          hint: '留空表示长期有效。',
          wide: true,
        }) +
        inputField('IP 白名单', 'ips', (row?.ipWhitelist || []).join('\n'), {
          type: 'textarea',
          wide: true,
          hint: '每行一个 IP 或 CIDR 网段。留空允许全部来源。',
        }) +
        '</fieldset><p class="error" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="button" data-cancel>取消</button>' +
        '<button class="button primary">' +
        (creating ? '创建密钥' : '保存更改') +
        '</button></div></form>'
    );
    const form = d.querySelector('form');
    form.elements.rate.max = '6000';
    form.elements.concurrent.max = '100';
    d.querySelector('[data-cancel]').onclick = () => d.close();
    if (creating)
      d.querySelector('[data-search]').onclick = async (event) => {
        const btn = event.currentTarget,
          status = d.querySelector('[data-member-status]'),
          select = form.elements.ownerId;
        btn.disabled = true;
        try {
          const result = await api(
            'members?' +
              new URLSearchParams({ keyword: d.querySelector('#owner-query').value.trim(), pageSize: 20 }),
            { signal }
          );
          const available = result.items.filter((user) => user.state && Number(user.role) !== 100);
          select.replaceChildren(
            new Option('当前管理员', ''),
            ...available.map(
              (user) => new Option(user.nickname + (user.mobile ? ' · ' + user.mobile : ''), user.id)
            )
          );
          status.textContent = available.length ? '请选择一位成员。' : '没有匹配的已启用成员。';
        } catch (err) {
          if (!signal.aborted) status.textContent = err.message;
        } finally {
          btn.disabled = false;
        }
      };
    form.onsubmit = async (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      const expires = fields.get('expires');
      const body = {
        name: fields.get('name').trim(),
        scopes: fields.getAll('scope'),
        rateLimitPerMinute: Number(fields.get('rate')),
        maxConcurrentRuns: Number(fields.get('concurrent')),
        expiresAt: expires ? new Date(expires).toISOString() : null,
        ipWhitelist: fields
          .get('ips')
          .split('\n')
          .map((ip) => ip.trim())
          .filter(Boolean),
      };
      if (fields.get('ownerId')) body.ownerId = fields.get('ownerId');
      if (!body.scopes.length) {
        modalError(d, new Error('至少选择一个允许的操作。'));
        return;
      }
      // An already expired key may still be renamed without changing its expiry.
      if (row && dateInput(row.expiresAt) === expires) delete body.expiresAt;
      const button = form.querySelector('button.primary');
      button.disabled = true;
      form.querySelector('fieldset').disabled = true;
      try {
        const data = await api(creating ? 'keys' : 'keys/' + encodeURIComponent(row.id), {
          method: creating ? 'POST' : 'PATCH',
          body,
          signal,
        });
        if (signal.aborted) return;
        d.close();
        if (creating) secretDialog(data);
        else notice('密钥配置已保存');
        await reload();
      } catch (error) {
        if (!signal.aborted) {
          modalError(d, error);
          button.disabled = false;
          form.querySelector('fieldset').disabled = false;
        }
      }
    };
  }
  render(initialKeys);
  main.querySelector('[data-new]').onclick = () => edit(null);
}
