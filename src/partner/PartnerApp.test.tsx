import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PartnerApp from './PartnerApp';

const session = { user: { id: '1', role: 80, nickname: '运营' }, site: { siteId: 'demo', name: '演示站' } };
const reply = (status: number, data?: unknown) => Promise.resolve({
  status, ok: status === 200, json: async () => ({ code: status, data }),
} as Response);
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  window.history.replaceState(null, '', '/');
});

test('只读运营从密钥深链登录后保留站点上下文且不请求密钥接口', async () => {
  window.history.replaceState(null, '', '/partner/#keys');
  const request = jest.fn((url: RequestInfo | URL) => {
    if (url === '/partner/api/login') return reply(200, session);
    return reply(401);
  });
  global.fetch = request;
  render(<PartnerApp />);
  expect(await screen.findByRole('heading', { name: '代理商登录' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000000' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: '登录后台' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('只读运营');
  expect(screen.getByText('演示站')).toBeInTheDocument();
  expect(within(screen.getByRole('navigation')).queryByRole('link', { name: 'API 密钥' })).toBeNull();
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/partner/api/session', '/partner/api/login']);
});

test('已恢复的会话在成员请求返回 401 时返回登录页', async () => {
  window.history.replaceState(null, '', '/partner/#members');
  global.fetch = jest.fn(url => url === '/partner/api/session' ? reply(200, session) : reply(401));
  render(<PartnerApp />);
  expect(await screen.findByRole('heading', { name: '代理商登录' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('登录已过期');
});

test('接口离线时登录表单和公开文档仍可打开', async () => {
  global.fetch = jest.fn(() => reply(503));
  render(<PartnerApp />);
  expect(await screen.findByRole('heading', { name: '代理商登录' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /API 文档/ })).toHaveAttribute('href', '/docs');
  await waitFor(() => expect(document.title).toBe('代理商登录 · 织流'));
});
