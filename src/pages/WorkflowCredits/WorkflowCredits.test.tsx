import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowCreditsPage from './WorkflowCredits';
import { aiWorkflowAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';

jest.mock('../../services/api', () => ({ aiWorkflowAPI: { credits: jest.fn(), creditLedger: jest.fn() } }));
const api = jest.mocked(aiWorkflowAPI);
const data = {
  account: { balance: 593, reservedPoints: 2, totalRecharged: 600, totalConsumed: 5 },
  rules: {
    version: 'v1', pointsPerYuan: 100, tokensPerPoint: 1000,
    text: { tokensPerPoint: 1000, maxOutputTokens: 8192 },
    image: { pointsPerImage: 7, sizeMultipliers: { '1K': 1, '2K': 2 } },
    plans: [{ code: 'vip', name: 'VIP', monthlyPrice: 39.9, yearlyPrice: 399, monthlyPoints: 600 }],
    notes: ['模拟预览不扣费。'],
  },
};

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ isLoggedIn: true, token: 'test-token' });
  api.credits.mockResolvedValue({ code: 200, data });
  api.creditLedger.mockResolvedValue({ code: 200, data: { list: [{ _id: 'adjustment', type: 'settle', points: 2, balanceAfter: 593, executionId: 'task-1', remark: '返还未使用预留' }], total: 1, page: 1, pageSize: 20 } });
});
afterEach(() => useAuthStore.setState({ isLoggedIn: false, token: '' }));

test('展示已扣预留的可用余额、结算返还并可刷新', async () => {
  render(<MemoryRouter><WorkflowCreditsPage /></MemoryRouter>);
  await screen.findAllByText('593');
  expect(screen.getByText('结算调整')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看任务' })).toHaveAttribute('href', '/executions/task-1');
  expect(screen.getByText(/未开通在线购买或自动月度发放/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新余额' }));
  await waitFor(() => expect(api.credits).toHaveBeenCalledTimes(2));
});

test('流水失败仍显示已取得的真实余额，不把缺失数据补成零', async () => {
  api.creditLedger.mockRejectedValue(new Error('流水暂时不可用'));
  render(<MemoryRouter><WorkflowCreditsPage /></MemoryRouter>);
  await screen.findByText('593');
  expect(screen.getByRole('alert')).toHaveTextContent('流水暂时不可用');
});

test('访客需登录且不请求他人账户', () => {
  useAuthStore.setState({ isLoggedIn: false, token: '' });
  render(<MemoryRouter><WorkflowCreditsPage /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '去登录' })).toBeInTheDocument();
  expect(api.credits).not.toHaveBeenCalled();
});
