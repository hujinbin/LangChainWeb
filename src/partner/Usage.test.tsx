import { fireEvent, render, screen, within } from '@testing-library/react';
import Usage from './Usage';
import { api, type PartnerSession } from './shared';

jest.mock('./shared', () => ({ ...jest.requireActual('./shared'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;
const session: PartnerSession = { site: { siteId: 'default', name: '测试站点' }, user: { id: 'operator', role: 80 } };
const report = {
  from: '2026-02-27', to: '2026-03-07',
  days: [{ date: '2026-02-27', requests: 2 }, { date: '2026-03-01', tokens: 1250, points: 2.5 }],
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === 'usage') return report;
    if (path === 'overview') return { userCount: 4, workflowCount: 3, executionCount: 2, keyCount: 1 };
    if (path === 'site') return { name: '测试站点', domains: ['example.test'], status: 'active' };
    throw new Error('Unknown endpoint');
  });
});

test('filters sparse activity across months and exports the complete selected interval', async () => {
  render(<Usage overview={false} session={session} />);
  await screen.findByRole('heading', { name: '用量分析' });
  expect(mockApi.mock.calls.map(([path]) => path)).toEqual(['usage']);
  expect(screen.getByText('个活跃日', { exact: false })).toHaveTextContent('2 个活跃日');
  expect(screen.getByTitle('2026-03-01 · 0 次请求')).toHaveAttribute('data-level', '1');
  expect(screen.getByRole('img')).toHaveAccessibleName('2026-03-01 至 2026-03-07 · 请求数合计 0');
  fireEvent.click(screen.getByRole('button', { name: '近30天' }));
  expect(screen.getByRole('img')).toHaveAccessibleName('2026-02-27 至 2026-03-07 · 请求数合计 2');
  fireEvent.click(screen.getByRole('button', { name: '自定义' }));
  fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-02-28' } });
  fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-03-01' } });
  fireEvent.change(screen.getByLabelText('指标'), { target: { value: 'tokens' } });
  expect(screen.getByRole('img')).toHaveAccessibleName('2026-02-28 至 2026-03-01 · Token 用量合计 1,250');
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(rows[1]).toHaveTextContent('2026-03-01');
  expect(rows[2]).toHaveTextContent('2026-02-28');

  const createURL = URL.createObjectURL;
  const revokeURL = URL.revokeObjectURL;
  const created = jest.fn((_blob: Blob) => 'blob:usage');
  const clicked = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('站点用量-2026-02-28-2026-03-01.csv');
    expect(this.href).toBe('blob:usage');
  });
  URL.createObjectURL = created;
  URL.revokeObjectURL = jest.fn();
  jest.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole('button', { name: '导出 CSV' }));
    expect(clicked).toHaveBeenCalledTimes(1);
    jest.runOnlyPendingTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:usage');
    jest.useRealTimers();
    const reader = new FileReader();
    const content = new Promise<string>((resolve) => { reader.onload = () => resolve(String(reader.result)); });
    reader.readAsText(created.mock.calls[0][0]);
    expect(await content).toBe('日期,请求数,Token 用量,图片张数,视频秒数,消耗积分\r\n2026-02-28,0,0,0,0,0\r\n2026-03-01,0,1250,0,0,2.5');
  } finally {
    jest.useRealTimers();
    clicked.mockRestore();
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
  }
  fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-02-27' } });
  expect(screen.getByRole('button', { name: '导出 CSV' })).toBeDisabled();
  expect(screen.getByText('所选区间暂无数据')).toBeInTheDocument();
});

test('shows site counts and role-specific shortcuts and aborts obsolete requests on navigation', async () => {
  const view = render(<Usage overview session={session} />);
  await screen.findByRole('heading', { name: '近七天用量' });
  expect(screen.getByText('example.test')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /查看用量明细/ })).toHaveAttribute('href', '#usage');
  expect(screen.getByRole('link', { name: /API 文档/ })).toHaveAttribute('href', '/docs');
  expect(screen.queryByRole('link', { name: /API 密钥/ })).toBeNull();
  const signal = mockApi.mock.calls[0][1]?.signal;
  view.rerender(<Usage overview session={{ ...session, user: { id: 'admin', role: 90 } }} />);
  expect(await screen.findByRole('link', { name: /API 密钥/ })).toHaveAttribute('href', '#keys');
  expect(signal?.aborted).toBe(true);
  view.rerender(<Usage overview={false} session={session} />);
  await screen.findByRole('heading', { name: '用量分析' });
  expect(screen.queryByRole('heading', { name: '近七天用量' })).toBeNull();
});

test('retries a failed report request', async () => {
  mockApi.mockRejectedValueOnce(new Error('网络中断'));
  render(<Usage overview={false} session={session} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('网络中断');
  fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
  expect(await screen.findByRole('heading', { name: '用量明细' })).toBeInTheDocument();
});
