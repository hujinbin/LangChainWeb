import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Keys from './Keys';
import { api } from './shared';

jest.mock('./shared', () => ({ ...jest.requireActual('./shared'), api: jest.fn() }));
const request = jest.mocked(api);
const scopes = { scopes: ['model:read', 'workflow:run'] };
const row = {
  id: 'key-1',
  name: '服务接入',
  clientId: 'client-test',
  scopes: ['model:read'],
  status: 'active',
  rateLimitPerMinute: 60,
  maxConcurrentRuns: 5,
  expiresAt: '2020-01-02T03:04:05.678Z',
  ipWhitelist: ['192.0.2.1'],
};

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
});
beforeEach(() => request.mockReset());

test('选择本站成员与权限后创建，保存中的弹框保留一次性凭证，关闭后清理', async () => {
  let resolveCreate!: (value: unknown) => void;
  request
    .mockResolvedValueOnce(scopes)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce({
      items: [
        { id: 'u-1', nickname: '作者', role: 0, state: 1 },
        { id: 'u-2', nickname: '停用成员', role: 0, state: 0 },
        { id: 'u-3', nickname: '平台管理员', role: 100, state: 1 },
      ],
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    )
    .mockResolvedValueOnce(scopes)
    .mockResolvedValueOnce([row]);
  render(<Keys />);
  await screen.findByText(/还没有 API 密钥/);
  const opener = screen.getByRole('button', { name: '＋ 创建密钥' });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog');
  const form = within(dialog);
  fireEvent.change(form.getByLabelText('密钥名称'), { target: { value: '  服务接入  ' } });
  fireEvent.change(form.getByLabelText('资源所属成员'), { target: { value: ' 作者 ' } });
  fireEvent.click(form.getByRole('button', { name: '查找' }));
  await form.findByRole('option', { name: '作者' });
  expect(form.queryByRole('option', { name: '平台管理员' })).toBeNull();
  expect(form.queryByRole('option', { name: '停用成员' })).toBeNull();
  fireEvent.change(form.getByLabelText('选择资源所属成员'), { target: { value: 'u-1' } });
  fireEvent.click(form.getByLabelText('查看模型'));
  fireEvent.click(form.getByRole('button', { name: '创建密钥' }));
  expect(form.getByRole('alert')).toHaveTextContent('至少选择');
  fireEvent.click(form.getByLabelText('运行工作流'));
  fireEvent.change(form.getByLabelText(/IP 白名单/), {
    target: { value: ' 192.0.2.1\n192.0.2.0/24 ' },
  });
  fireEvent.click(form.getByRole('button', { name: '创建密钥' }));
  expect(request).toHaveBeenCalledWith(
    'keys',
    expect.objectContaining({
      method: 'POST',
      body: {
        name: '服务接入',
        scopes: ['workflow:run'],
        ownerId: 'u-1',
        expiresAt: null,
        rateLimitPerMinute: 60,
        maxConcurrentRuns: 5,
        ipWhitelist: ['192.0.2.1', '192.0.2.0/24'],
      },
    }),
  );
  fireEvent.click(form.getByRole('button', { name: '关闭弹窗' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('dialog')).toBe(dialog);
  await act(async () =>
    resolveCreate({ clientId: 'client-test', clientSecret: 'issued-for-this-test' }),
  );
  expect(form.getByLabelText('Client Secret')).toHaveValue('issued-for-this-test');
  fireEvent.click(form.getByRole('button', { name: '已保存' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.innerHTML).not.toContain('issued-for-this-test');
  expect(opener).toHaveFocus();
});

test('编辑保留已过期时间的秒数，轮换与删除需二次确认', async () => {
  request.mockResolvedValueOnce(scopes).mockResolvedValueOnce([row]);
  render(<Keys />);
  await screen.findByText('已过期');
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  const form = within(screen.getByRole('dialog'));
  fireEvent.change(form.getByLabelText('密钥名称'), { target: { value: '新名称' } });
  request
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(scopes)
    .mockResolvedValueOnce([{ ...row, name: '新名称' }]);
  fireEvent.click(form.getByRole('button', { name: '保存更改' }));
  await screen.findByText('新名称');
  const edited = request.mock.calls.find(
    ([path, options]) => path === 'keys/key-1' && options?.method === 'PATCH',
  );
  expect(edited?.[1]?.body).toMatchObject({ name: '新名称' });
  expect(edited?.[1]?.body).not.toHaveProperty('expiresAt');

  fireEvent.click(screen.getByRole('button', { name: '轮换' }));
  request.mockRejectedValueOnce(new Error('轮换未完成'));
  fireEvent.click(screen.getByRole('button', { name: '确认轮换' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('轮换未完成');
  request
    .mockResolvedValueOnce({ clientId: row.clientId, clientSecret: 'rotated-for-this-test' })
    .mockResolvedValueOnce(scopes)
    .mockResolvedValueOnce([row]);
  fireEvent.click(screen.getByRole('button', { name: '确认轮换' }));
  expect(await screen.findByLabelText('Client Secret')).toHaveValue('rotated-for-this-test');
  expect(request).toHaveBeenCalledWith(
    'keys/key-1',
    expect.objectContaining({ method: 'PATCH', body: { rotateSecret: true } }),
  );
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByLabelText('Client Secret')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(request.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0);
  request.mockResolvedValueOnce({}).mockResolvedValueOnce(scopes).mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByText(/还没有 API 密钥/)).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(
    'keys/key-1',
    expect.objectContaining({ method: 'DELETE', body: {} }),
  );
});

test('密钥停用与启用各自发送相应状态', async () => {
  const active = { ...row, expiresAt: null };
  request.mockResolvedValueOnce(scopes).mockResolvedValueOnce([active]);
  render(<Keys />);
  await screen.findByText('启用中');
  for (const [label, status] of [
    ['停用', 'disabled'],
    ['启用', 'active'],
  ]) {
    request
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(scopes)
      .mockResolvedValueOnce([{ ...active, status }]);
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: '确认' + label }));
    await screen.findByText(status === 'active' ? '启用中' : '已停用');
    expect(request).toHaveBeenCalledWith(
      'keys/key-1',
      expect.objectContaining({ method: 'PATCH', body: { status } }),
    );
  }
});
