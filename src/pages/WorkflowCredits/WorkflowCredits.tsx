import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowDownLeft, FiArrowUpRight, FiCreditCard, FiRefreshCw, FiImage, FiType } from 'react-icons/fi';
import { aiWorkflowAPI } from '../../services/api';
import { normalizeError } from '../../types/api';
import type { WorkflowCredits, WorkflowCreditLedger } from '../../types/credits';
import useAuthStore from '../../store/authStore';
import { formatPoints, formatTokens } from '../../components/BillingUsage/BillingUsage';
import './WorkflowCredits.css';

const LEDGER_LABELS: Record<string, string> = {
  recharge: '积分充值', reserve: '调用预留', settle: '结算调整', release: '释放预留',
};
const PAGE_SIZE = 20;

export function creditError(cause: unknown) {
  const message = normalizeError(cause).message;
  return !message || /https?:\/\/|API_KEY|BASE_URL|Mongo|ECONN|Network Error|\bat\s+\S+\s*\(/i.test(message)
    ? '积分信息暂时读取失败，请稍后重试。'
    : message;
}

export default function WorkflowCreditsPage() {
  const { isLoggedIn, token } = useAuthStore();
  const [credits, setCredits] = useState<WorkflowCredits | null>(null);
  const [ledger, setLedger] = useState<WorkflowCreditLedger | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [ledgerError, setLedgerError] = useState('');
  useEffect(() => setPage(1), [token]);

  useEffect(() => {
    const controller = new AbortController();
    setCredits(null);
    setLedger(null);
    setAccountError('');
    setLedgerError('');
    if (!isLoggedIn) { setLoading(false); return; }
    setLoading(true);
    Promise.allSettled([
      aiWorkflowAPI.credits({ signal: controller.signal }),
      aiWorkflowAPI.creditLedger({ page, pageSize: PAGE_SIZE }, { signal: controller.signal }),
    ]).then(([accountResult, ledgerResult]) => {
      if (controller.signal.aborted) return;
      if (accountResult.status === 'fulfilled') setCredits(accountResult.value.data);
      else setAccountError(creditError(accountResult.reason));
      if (ledgerResult.status === 'fulfilled') setLedger(ledgerResult.value.data);
      else setLedgerError(creditError(ledgerResult.reason));
      setLoading(false);
    });
    return () => controller.abort();
  }, [isLoggedIn, token, page, revision]);

  const account = credits?.account;
  const rules = credits?.rules;
  return (
    <main className="page-wrap workflow-credits-page">
      <header className="page-heading">
        <div><span className="eyebrow">WORKFLOW CREDITS</span><h1>工作流积分</h1><p>查看可用额度、每次创作的消耗与计费规则。</p></div>
        {isLoggedIn && <button className="btn btn-default" disabled={loading} onClick={() => setRevision((value) => value + 1)}><FiRefreshCw className={loading ? 'spinning' : ''} /> 刷新余额</button>}
      </header>
      {!isLoggedIn ? (
        <section className="surface empty-state"><span className="empty-state-icon"><FiCreditCard /></span><h3>登录后查看你的工作流积分</h3><p>积分账户与当前登录用户关联，支持查看余额及每次调用的扣费记录。</p><Link to="/login" className="btn btn-primary">去登录</Link></section>
      ) : (
        <>
          {accountError && <div className="notice error" role="alert">{accountError}</div>}
          <section className="credit-account-grid" aria-label="积分账户">
            <div className="credit-balance-card">
              <div><FiCreditCard /><span>可用积分</span></div>
              <strong>{account ? formatPoints(account.balance) : '—'}<small>积分</small></strong>
              <p>{account && account.balance < 0 ? '当前余额不足，请联系管理员补充积分后继续使用。' : '用于工作流中的文本与图片模型调用。'}</p>
              <span className="credit-reserved">预留中 <b>{account ? formatPoints(account.reservedPoints) : '—'}</b> 积分</span>
            </div>
            <div className="surface credit-account-detail">
              <div><span><FiArrowDownLeft /> 累计充值</span><strong>{account ? formatPoints(account.totalRecharged) : '—'}<small>积分</small></strong></div>
              <div><span><FiArrowUpRight /> 累计消耗</span><strong>{account ? formatPoints(account.totalConsumed) : '—'}<small>积分</small></strong></div>
              <p>需要充值时请联系管理员。充值到账后可在下方查看流水。</p>
            </div>
          </section>
          {loading && !credits && <p className="credit-loading" role="status">正在读取积分信息…</p>}
          {rules && <>
            <section className="credit-rules-section" aria-label="积分计费规则">
              <div className="section-heading"><div><h2>清楚每一分，用在何处</h2><p>1 元对应 {formatPoints(rules.pointsPerYuan)} 积分；实际充值由管理员操作。</p></div><span className="section-caption">规则 {rules.version}</span></div>
              <div className="credit-rule-grid">
                <article className="surface credit-rule-card"><span className="credit-rule-icon"><FiType /></span><h3>大模型文本调用</h3><strong>{formatTokens(rules.text.tokensPerPoint)}<small>Token / 积分</small></strong><p>按输入与输出 Token 合计折算；未返回用量时，任务记录会明确标注估算。</p><small>预留输出额度 {formatTokens(rules.text.maxOutputTokens)} Token</small></article>
                <article className="surface credit-rule-card"><span className="credit-rule-icon"><FiImage /></span><h3>图片生成</h3><strong>{formatPoints(rules.image.pointsPerImage)}<small>积分 / 基础图片</small></strong><p>按成功生成的图片张数和尺寸倍数计费，图片折算额度与模型实际 Token 分开展示。</p><div className="credit-size-rates">{Object.entries(rules.image.sizeMultipliers).map(([size, multiplier]) => <span key={size}>{size}<b>×{multiplier}</b></span>)}</div></article>
              </div>
              {rules.notes?.length > 0 && <ul className="credit-rule-notes">{rules.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
            </section>
            {rules.plans?.length > 0 && <section className="credit-plan-section" aria-label="参考月度权益"><div className="section-heading"><div><h2>参考月度权益</h2><p>以下为积分额度参考，当前由管理员人工充值，未开通在线购买或自动月度发放。</p></div></div><div className="credit-plan-grid">{rules.plans.map((plan) => <article className="surface credit-plan-card" key={plan.code}><div><span>{plan.name}</span><p>月价参考 ¥{plan.monthlyPrice} · 双11年价参考 ¥{plan.yearlyPrice}</p></div><strong>{formatPoints(plan.monthlyPoints)}<small>积分 / 月</small></strong></article>)}</div></section>}
          </>}
          <section className="surface credit-ledger" aria-label="积分流水">
            <div className="section-heading"><div><h2>积分流水</h2><p>充值、预留、结算与退回都有记录。</p></div>{ledger && <span className="section-caption">共 {ledger.total} 条</span>}</div>
            {ledgerError ? <div className="notice error" role="alert">{ledgerError}</div> : loading ? <div className="loading-state">正在读取流水…</div> : ledger?.list.length ? <div className="credit-ledger-table-wrap"><table className="credit-ledger-table"><thead><tr><th>时间 / 类型</th><th>积分变动</th><th>变动后可用</th><th>备注 / 关联任务</th></tr></thead><tbody>{ledger.list.map((entry) => <tr key={entry._id}><td><strong>{LEDGER_LABELS[entry.type] || entry.type}</strong><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('zh-CN') : '时间未记录'}</small></td><td className={entry.points > 0 ? 'credit-positive' : ''}>{entry.points > 0 ? '+' : ''}{formatPoints(entry.points)}</td><td>{formatPoints(entry.balanceAfter)}</td><td><span>{entry.remark || '—'}</span>{entry.executionId && <Link to={`/executions/${entry.executionId}`}>查看任务 <FiArrowUpRight /></Link>}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>暂无积分流水</h3><p>充值或运行模型后，记录会出现在这里。</p></div>}
            <div className="pagination"><button className="btn btn-default" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page} 页</span><button className="btn btn-default" disabled={loading || !ledger || page * PAGE_SIZE >= ledger.total} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
          </section>
        </>
      )}
    </main>
  );
}
