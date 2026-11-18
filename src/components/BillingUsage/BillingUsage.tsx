import type { WorkflowBilling } from '../../types/credits';
import './BillingUsage.css';

export const formatPoints = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
export const formatTokens = (value: number | null | undefined) =>
  value === null || value === undefined ? '未记录' : value.toLocaleString('zh-CN');

const STATUS_LABELS: Record<WorkflowBilling['status'], string> = {
  settled: '已结算',
  simulated: '模拟免扣费',
  pending: '结算中',
  released: '已释放预留',
};

export function BillingUsageInline({ billing, simulated }: {
  billing?: WorkflowBilling;
  simulated?: boolean;
}) {
  if (simulated) return <span className="billing-inline">模拟 · 0 积分</span>;
  if (!billing) return <span className="billing-inline billing-unrecorded">消耗未记录</span>;
  return (
    <span className="billing-inline">
      {billing.totalTokens === null ? 'Token 未记录' : `${billing.estimated ? '约 ' : ''}${formatTokens(billing.totalTokens)} token`}
      {billing.imageCount > 0 && ` · ${billing.imageCount} 张图`}
      {' · '}{billing.status === 'pending' ? '结算中' : `${formatPoints(billing.pointsCharged)} 积分`}
    </span>
  );
}

export default function BillingUsage({ billing, simulated = false, compact = false }: {
  billing?: WorkflowBilling;
  simulated?: boolean;
  compact?: boolean;
}) {
  if (!billing && !simulated) {
    return <p className="billing-empty">该记录尚未采集消耗数据。</p>;
  }
  if (simulated || billing?.status === 'simulated') {
    return <p className="billing-simulated">模拟预览不调用模型，消耗 0 token / 0 积分。</p>;
  }
  if (!billing) return null;
  return (
    <section className={`billing-usage ${compact ? 'billing-compact' : ''}`} aria-label={compact ? '节点消耗' : '任务消耗'}>
      <div className="billing-usage-heading">
        <strong>{compact ? '节点消耗' : '本次任务消耗'}</strong>
        <span>{STATUS_LABELS[billing.status]}</span>
      </div>
      <dl>
        <div><dt>扣除积分</dt><dd>{formatPoints(billing.pointsCharged)}<small>积分</small></dd></div>
        <div><dt>{billing.estimated ? '总 Token（估算）' : '总 Token'}</dt><dd>{formatTokens(billing.totalTokens)}</dd></div>
        <div><dt>输入 Token{billing.estimated ? '（估算）' : ''}</dt><dd>{formatTokens(billing.inputTokens)}</dd></div>
        <div><dt>输出 Token{billing.estimated ? '（估算）' : ''}</dt><dd>{formatTokens(billing.outputTokens)}</dd></div>
        <div><dt>生成图片</dt><dd>{billing.imageCount}<small>张</small></dd></div>
      </dl>
      {billing.totalTokens === null && <p>模型未返回 Token 用量；图片按张数和尺寸计费。</p>}
      {billing.estimated && <p>部分 Token 用量为估算值，非模型返回的实际统计。</p>}
      {billing.imageCount > 0 && billing.billableTokens > 0 && <p>本次计费折算 {formatTokens(billing.billableTokens)} token，用于积分换算。</p>}
      {billing.ruleVersion && <small className="billing-rule-version">计费规则 {billing.ruleVersion}</small>}
    </section>
  );
}
