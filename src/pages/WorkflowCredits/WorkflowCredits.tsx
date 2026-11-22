import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowDownLeft, FiArrowUpRight, FiCreditCard, FiGift, FiMessageSquare, FiRefreshCw, FiImage, FiType, FiX } from 'react-icons/fi';
import { aiWorkflowAPI, WORKFLOW_CREDITS_CHANGED } from '../../services/api';
import { normalizeError } from '../../types/api';
import type { WorkflowCredits, WorkflowCreditLedger } from '../../types/credits';
import useAuthStore from '../../store/authStore';
import { formatPoints, formatTokens } from '../../components/BillingUsage/BillingUsage';
import './WorkflowCredits.css';

const LEDGER_LABELS: Record<string, string> = {
  recharge: '积分充值', reserve: '调用预留', settle: '结算调整', release: '释放预留',
};
const PAGE_SIZE = 20;
const CUSTOMER_SERVICE_QR = `${process.env.PUBLIC_URL}/customer-service-qr.png`;

export function creditError(cause: unknown) {
  const message = normalizeError(cause).message;
  return !message || /https?:\/\/|API_KEY|BASE_URL|Mongo|ECONN|Network Error|\bat\s+\S+\s*\(/i.test(message)
    ? '积分信息暂时读取失败，请稍后重试。'
    : message;
}

function redeemError(cause: unknown) {
  const message = normalizeError(cause).message;
  return !message || /https?:\/\/|ECONN|Network Error|\bat\s+\S+\s*\(/i.test(message)
    ? '兑换失败，请稍后重试。'
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
  const [contactOpen, setContactOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemNotice, setRedeemNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => setPage(1), [token]);
  useEffect(() => {
    if (!contactOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContactOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [contactOpen]);

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

  const redeem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = redeemCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    setRedeemNotice(null);
    try {
      const { data } = await aiWorkflowAPI.redeemCredit(code);
      setRedeemNotice({ type: 'success', text: `兑换成功，${formatPoints(data.points)} 积分已到账。` });
      setRedeemCode('');
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event(WORKFLOW_CREDITS_CHANGED));
    } catch (cause) {
      setRedeemNotice({ type: 'error', text: redeemError(cause) });
    } finally {
      setRedeeming(false);
    }
  };

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
              <p>{account && account.balance < 0 ? '当前余额不足，请联系客服充值后继续使用。' : '用于工作流中的文本与图片模型调用。'}</p>
              <span className="credit-reserved">预留中 <b>{account ? formatPoints(account.reservedPoints) : '—'}</b> 积分</span>
            </div>
            <div className="surface credit-account-detail">
              <div><span><FiArrowDownLeft /> 累计充值</span><strong>{account ? formatPoints(account.totalRecharged) : '—'}<small>积分</small></strong></div>
              <div><span><FiArrowUpRight /> 累计消耗</span><strong>{account ? formatPoints(account.totalConsumed) : '—'}<small>积分</small></strong></div>
              <div className="credit-recharge">
                <p>需要充值时请联系客服，扫码添加后由客服为你补充积分；到账记录可在下方流水查看。</p>
                <button type="button" className="btn btn-primary" onClick={() => setContactOpen(true)}>
                  <FiMessageSquare /> 联系客服充值
                </button>
              </div>
            </div>
          </section>
          <section className="surface credit-redeem-card" aria-label="兑换码兑换积分">
            <div className="credit-redeem-copy">
              <span className="credit-rule-icon"><FiGift /></span>
              <div><h2>兑换码</h2><p>输入兑换码，积分立即到账，可在下方流水查看。</p></div>
            </div>
            <form className="credit-redeem-form" onSubmit={redeem}>
              <input
                className="credit-redeem-input"
                aria-label="兑换码"
                placeholder="ZL-XXXX-XXXX"
                value={redeemCode}
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
                disabled={redeeming}
                onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
              />
              <button type="submit" className="btn btn-primary" disabled={redeeming || !redeemCode.trim()}>
                {redeeming ? '兑换中…' : '立即兑换'}
              </button>
            </form>
            {redeemNotice && <p className={`notice credit-redeem-notice${redeemNotice.type === 'error' ? ' error' : ''}`} role="status">{redeemNotice.text}</p>}
          </section>
          {loading && !credits && <p className="credit-loading" role="status">正在读取积分信息…</p>}
          {rules && <>
            <section className="credit-rules-section" aria-label="积分计费规则">
              <div className="section-heading"><div><h2>清楚每一分，用在何处</h2><p>1 元对应 {formatPoints(rules.pointsPerYuan)} 积分；实际充值请联系客服办理。</p></div><span className="section-caption">规则 {rules.version}</span></div>
              <div className="credit-rule-grid">
                <article className="surface credit-rule-card"><span className="credit-rule-icon"><FiType /></span><h3>大模型文本调用</h3><strong>{formatTokens(rules.text.tokensPerPoint)}<small>Token / 积分</small></strong><p>按输入与输出 Token 合计折算；未返回用量时，任务记录会明确标注估算。</p><small>预留输出额度 {formatTokens(rules.text.maxOutputTokens)} Token</small></article>
                <article className="surface credit-rule-card"><span className="credit-rule-icon"><FiImage /></span><h3>图片生成</h3><strong>{formatPoints(rules.image.pointsPerImage)}<small>积分 / 基础图片</small></strong><p>按成功生成的图片张数和尺寸倍数计费，图片折算额度与模型实际 Token 分开展示。</p><div className="credit-size-rates">{Object.entries(rules.image.sizeMultipliers).map(([size, multiplier]) => <span key={size}>{size}<b>×{multiplier}</b></span>)}</div></article>
              </div>
              {rules.notes?.length > 0 && <ul className="credit-rule-notes">{rules.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
            </section>
            {rules.plans?.length > 0 && <section className="credit-plan-section" aria-label="参考月度权益"><div className="section-heading"><div><h2>参考月度权益</h2><p>以下为积分额度参考，当前由客服人工充值，未开通在线购买或自动月度发放。</p></div></div><div className="credit-plan-grid">{rules.plans.map((plan) => <article className="surface credit-plan-card" key={plan.code}><div><span>{plan.name}</span><p>月价参考 ¥{plan.monthlyPrice} · 双11年价参考 ¥{plan.yearlyPrice}</p></div><strong>{formatPoints(plan.monthlyPoints)}<small>积分 / 月</small></strong></article>)}</div></section>}
          </>}
          <section className="surface credit-ledger" aria-label="积分流水">
            <div className="section-heading"><div><h2>积分流水</h2><p>充值、预留、结算与退回都有记录。</p></div>{ledger && <span className="section-caption">共 {ledger.total} 条</span>}</div>
            {ledgerError ? <div className="notice error" role="alert">{ledgerError}</div> : loading ? <div className="loading-state">正在读取流水…</div> : ledger?.list.length ? <div className="credit-ledger-table-wrap"><table className="credit-ledger-table"><thead><tr><th>时间 / 类型</th><th>积分变动</th><th>变动后可用</th><th>备注 / 关联任务</th></tr></thead><tbody>{ledger.list.map((entry) => <tr key={entry._id}><td><strong>{LEDGER_LABELS[entry.type] || entry.type}</strong><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('zh-CN') : '时间未记录'}</small></td><td className={entry.points > 0 ? 'credit-positive' : ''}>{entry.points > 0 ? '+' : ''}{formatPoints(entry.points)}</td><td>{formatPoints(entry.balanceAfter)}</td><td><span>{entry.remark || '—'}</span>{entry.executionId && <Link to={`/executions/${entry.executionId}`}>查看任务 <FiArrowUpRight /></Link>}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>暂无积分流水</h3><p>充值或运行模型后，记录会出现在这里。</p></div>}
            <div className="pagination"><button className="btn btn-default" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page} 页</span><button className="btn btn-default" disabled={loading || !ledger || page * PAGE_SIZE >= ledger.total} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
          </section>
        </>
      )}
      {contactOpen && (
        <div
          className="credit-service-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContactOpen(false);
          }}
        >
          <section
            className="credit-service-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-service-title"
          >
            <button
              type="button"
              className="btn-icon credit-service-close"
              aria-label="关闭"
              onClick={() => setContactOpen(false)}
            >
              <FiX />
            </button>
            <h2 id="credit-service-title">联系客服充值</h2>
            <p>扫码添加客服微信「流风绾月」，告知登录手机号与充值金额；积分到账后即可继续创作。</p>
            <img className="credit-service-qr" src={CUSTOMER_SERVICE_QR} alt="客服微信二维码" />
            <p className="credit-service-tip">二维码无法识别时，可截图后使用微信扫一扫。</p>
          </section>
        </div>
      )}
    </main>
  );
}
