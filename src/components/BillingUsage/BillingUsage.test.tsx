import { render, screen } from '@testing-library/react';
import BillingUsage from './BillingUsage';
import type { WorkflowBilling } from '../../types/credits';

const billing: WorkflowBilling = {
  pointsCharged: 1.25, inputTokens: 1000, outputTokens: 250,
  totalTokens: 1250, billableTokens: 1250, imageCount: 0,
  estimated: false, status: 'settled', ruleVersion: 'v1',
};

test('任务展示模型返回的输入输出和总 Token 以及实际扣分', () => {
  render(<BillingUsage billing={billing} />);
  expect(screen.getByText('1,250')).toBeInTheDocument();
  expect(screen.getByText('1,000')).toBeInTheDocument();
  expect(screen.getByText('250')).toBeInTheDocument();
  expect(screen.getByText('1.25')).toBeInTheDocument();
  expect(screen.getByText('已结算')).toBeInTheDocument();
});

test('图像折算额度不会冒充模型真实 Token，估算有明确标记', () => {
  const { rerender } = render(<BillingUsage billing={{ ...billing, inputTokens: null, outputTokens: null, totalTokens: null, imageCount: 1, pointsCharged: 7, billableTokens: 7000 }} />);
  expect(screen.getAllByText('未记录')).toHaveLength(3);
  expect(screen.getByText(/本次计费折算 7,000 token/)).toBeInTheDocument();
  expect(screen.getByText(/模型未返回 Token 用量/)).toBeInTheDocument();
  rerender(<BillingUsage billing={{ ...billing, estimated: true }} />);
  expect(screen.getByText('总 Token（估算）')).toBeInTheDocument();
  expect(screen.getByText(/非模型返回的实际统计/)).toBeInTheDocument();
});

test('模拟免扣费和历史未采集分别显示，不伪造历史零消耗', () => {
  const { rerender } = render(<BillingUsage simulated />);
  expect(screen.getByText(/0 token \/ 0 积分/)).toBeInTheDocument();
  rerender(<BillingUsage />);
  expect(screen.getByText('该记录尚未采集消耗数据。')).toBeInTheDocument();
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});
