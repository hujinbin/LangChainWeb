import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Audits, Members, Site } from './Site';
import { api, notify } from './shared';

jest.mock('./shared', () => ({ ...jest.requireActual('./shared'), api: jest.fn(), notify: jest.fn() }));
const request = jest.mocked(api);
const session = { user: { id: 'member', role: 90 }, site: { siteId: 'test', name: '原名称' } };
const site = { ...session.site, domains: [window.location.hostname], registerEnabled: false };

beforeEach(() => jest.resetAllMocks());
afterEach(() => jest.restoreAllMocks());

test('运营可读取站点设置并且所有字段只读', async () => {
  request.mockResolvedValue(site);
  render(<Site session={{ ...session, user: { ...session.user, role: 80 } }} onSiteChange={jest.fn()} />);
  expect(await screen.findByLabelText('站点名称')).toBeDisabled();
  expect(screen.getByLabelText('默认主题')).toBeDisabled();
  expect(screen.getByLabelText('允许新用户注册')).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '保存站点设置' })).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

test('管理员移除当前域名前需确认，保存后使用服务端名称更新导航', async () => {
  request.mockResolvedValueOnce(site).mockResolvedValueOnce({ ...site, domains: ['example.org'], name: '规范名称' });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  const onSiteChange = jest.fn();
  render(<Site session={session} onSiteChange={onSiteChange} />);
  fireEvent.change(await screen.findByLabelText('站点名称'), { target: { value: ' 修改后的名称 ' } });
  fireEvent.change(screen.getByLabelText(/绑定域名/), { target: { value: ' example.org\n ' } });
  fireEvent.change(screen.getByLabelText(/关键词/), { target: { value: '甲,乙， 丙' } });
  fireEvent.click(screen.getByRole('button', { name: '保存站点设置' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '保存站点设置' }));
  await waitFor(() => expect(onSiteChange).toHaveBeenCalledWith('规范名称'));
  expect(request).toHaveBeenLastCalledWith('site', expect.objectContaining({
    method: 'PATCH',
    body: expect.objectContaining({
      name: '修改后的名称', domains: ['example.org'], registerEnabled: false,
      seo: { title: '', description: '', keywords: ['甲', '乙', '丙'] },
    }),
  }));
  expect(screen.getByLabelText('站点名称')).toHaveValue('规范名称');
  expect(notify).toHaveBeenCalledWith('站点设置已保存');
});

test('成员翻页后搜索回到第一页，已取消的响应不会覆盖结果', async () => {
  const member = { nickname: '运营甲', mobile: '123', role: 80, state: 1 };
  const page = { total: 21, pageSize: 20, items: [member] };
  let finishPageTwo = () => {};
  request.mockResolvedValueOnce(page).mockImplementationOnce(() => new Promise(resolve => {
    finishPageTwo = () => resolve({ ...page, items: [{ ...member, nickname: '过期结果' }] });
  })).mockResolvedValueOnce({ ...page, total: 1, items: [{ ...member, nickname: '查询结果' }] });
  render(<Members />);
  await screen.findByText('运营甲');
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('members?page=2&pageSize=20&keyword=', expect.anything()));
  const pageTwoSignal = request.mock.calls[1][1]?.signal;
  fireEvent.change(screen.getByLabelText('搜索成员'), { target: { value: ' 123 ' } });
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  await screen.findByText('查询结果');
  expect(pageTwoSignal?.aborted).toBe(true);
  await act(async () => { finishPageTwo(); });
  expect(screen.queryByText('过期结果')).toBeNull();
  expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  expect(request).toHaveBeenLastCalledWith('members?page=1&pageSize=20&keyword=123', expect.anything());
});

test('审计可按 Client ID 和条数重新查询，失败后按原条件重试', async () => {
  request.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('暂时不可用')).mockResolvedValueOnce([
    { createdAt: '2026-01-01T00:00:00Z', method: 'GET', path: '/demo', status: 429, durationMs: 43, clientId: 'test' },
  ]);
  render(<Audits />);
  await screen.findByText('没有匹配的调用记录');
  fireEvent.change(screen.getByLabelText('按 Client ID 筛选'), { target: { value: ' test ' } });
  fireEvent.change(screen.getByLabelText('条数'), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('暂时不可用');
  fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
  expect(await screen.findByText('429')).toHaveClass('off');
  expect(request).toHaveBeenLastCalledWith('audits?clientId=test&limit=200', expect.anything());
});
