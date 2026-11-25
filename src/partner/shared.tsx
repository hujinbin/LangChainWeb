import React, { useEffect, useRef, useState, type ReactNode } from 'react';

export interface PartnerSession {
  user: { id: string; role: number; nickname?: string; siteId?: string };
  site: { siteId: string; name: string };
}

export function checkedSession(session: PartnerSession): PartnerSession {
  if (!session?.site?.siteId || !session.user || ![80, 90].includes(session.user.role)) {
    throw new Error('后台会话数据不完整，请重新登录。');
  }
  return session;
}

export class PartnerApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求未完成，请重试。';
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, signal }: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/partner/api/' + path, {
      method, signal, mode: 'same-origin', redirect: 'error', credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('连接失败，请检查网络后重试。');
  }
  if (response.status === 401 && !['session', 'login'].includes(path)) {
    window.dispatchEvent(new Event('partner-session-expired'));
  }
  let result: { code: number; msg?: string; data: T };
  try { result = await response.json(); }
  catch { throw new PartnerApiError('后台暂时无法响应，请稍后重试。', response.status); }
  if (!result || !response.ok || result.code !== 200) {
    throw new PartnerApiError(result?.msg || '请求未完成，请重试。', response.status);
  }
  return result.data;
}

export function number(value: unknown, digits = 3) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(Number(value) || 0);
}
export function dateTime(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return '—';
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toLocaleString('zh-CN', { hour12: false }) : '—';
}
export function roleName(role: number) {
  return ({ 100: '平台管理员', 90: '站点管理员', 80: '站点运营' } as Record<number, string>)[role] || '站点成员';
}

export function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <><p className="error" role="alert">{message}</p>{onRetry && <button className="button" onClick={onRetry}>重新读取</button>}</>;
}

export function Table({ headers, rows, empty = '暂无数据' }: { headers: string[]; rows: ReactNode[][]; empty?: string }) {
  return <div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((cells, i) => <tr key={i}>{cells.map((cell, col) => <td key={headers[col]}>{cell}</td>)}</tr>) :
      <tr><td className="empty-row" colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={ref} id="dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="关闭弹窗" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}

export function notify(message: string) {
  window.dispatchEvent(new CustomEvent('partner-notice', { detail: message }));
}

export function Notifications() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let timeout: number;
    function show(event: Event) {
      window.clearTimeout(timeout);
      setMessage((event as CustomEvent<string>).detail);
      timeout = window.setTimeout(() => setMessage(''), 3800);
    }
    window.addEventListener('partner-notice', show);
    return () => { window.removeEventListener('partner-notice', show); window.clearTimeout(timeout); };
  }, []);
  return <div id="notifications" role="status" aria-live="polite">{message}</div>;
}
