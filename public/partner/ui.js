export const html = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char])
  );
export const number = (value) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(Number(value) || 0);
export const dateTime = (value) => {
  const time = new Date(value);
  return value && Number.isFinite(time.getTime()) ? time.toLocaleString('zh-CN', { hour12: false }) : '—';
};
export const roleName = (role) => ({ 100: '平台管理员', 90: '站点管理员', 80: '站点运营' }[role] || '站点成员');

export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch('/partner/api/' + path, {
      method,
      signal,
      mode: 'same-origin',
      redirect: 'error',
      credentials: 'same-origin',
      cache: 'no-store',
      headers:
        method === 'GET'
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('连接失败，请检查网络后重试。');
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('后台暂时无法响应，请稍后重试。');
  }
  if (!response.ok || result.code !== 200) {
    if (response.status === 401 && !['session', 'login', 'logout'].includes(path))
      window.dispatchEvent(new Event('partner-session-expired'));
    throw Object.assign(new Error(result.msg || '请求未完成，请重试。'), {
      status: response.status,
      code: result.errorCode,
    });
  }
  return result.data;
}

export function actionButton(label, action, primary = false) {
  return (
    '<button type="button" class="button' +
    (primary ? ' primary' : '') +
    '" data-action="' +
    action +
    '">' +
    html(label) +
    '</button>'
  );
}
export function heading(title, description, action = '') {
  return (
    '<header class="page-heading"><div><h1>' +
    html(title) +
    '</h1><p>' +
    html(description) +
    '</p></div>' +
    action +
    '</header>'
  );
}
export function table(headers, rows, emptyMessage) {
  return (
    '<div class="table-scroll"><table><thead><tr>' +
    headers.map((label) => '<th scope="col">' + html(label) + '</th>').join('') +
    '</tr></thead><tbody>' +
    (rows.length
      ? rows.map((cells) => '<tr>' + cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('')
      : '<tr><td class="empty-row" colspan="' + headers.length + '">' + html(emptyMessage) + '</td></tr>') +
    '</tbody></table></div>'
  );
}
export function errorBox(message) {
  return '<p class="error" role="alert">' + html(message) + '</p>';
}
export function notice(message) {
  const el = document.querySelector('#notifications');
  clearTimeout(notice.timer);
  el.textContent = message;
  notice.timer = setTimeout(() => {
    el.textContent = '';
  }, 3800);
}
export function modal(title, body) {
  const dialog = document.querySelector('#dialog');
  if (dialog.open) dialog.close();
  dialog.innerHTML =
    '<div class="modal-heading"><h2 id="dialog-title">' +
    html(title) +
    '</h2><button type="button" class="icon-button" aria-label="关闭弹窗" data-close>×</button></div>' +
    body;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.onclose = () => {
    if (!dialog.open) dialog.replaceChildren();
  };
  dialog.showModal();
  return dialog;
}
export function modalError(dialog, error) {
  const el = dialog.querySelector('[role=alert]');
  if (el) {
    el.textContent = error.message;
    el.hidden = false;
  }
}
export function inputField(label, name, value = '', options = {}) {
  const { type = 'text', max, min, required, wide, hint } = options;
  const attrs =
    ' name="' +
    name +
    '"' +
    (max ? ' maxlength="' + max + '"' : '') +
    (min !== undefined ? ' min="' + min + '"' : '') +
    (required ? ' required' : '');
  return (
    '<label class="field' +
    (wide ? ' wide' : '') +
    '"><span>' +
    html(label) +
    '</span>' +
    (type === 'textarea'
      ? '<textarea rows="3"' + attrs + '>' + html(value) + '</textarea>'
      : '<input type="' + type + '"' + attrs + ' value="' + html(value) + '">') +
    (hint ? '<small>' + html(hint) + '</small>' : '') +
    '</label>'
  );
}
