import { useEffect, useMemo, useState } from 'react';
import { api, Dialog, ErrorBox, errorMessage, Heading, notify, number, Table, type PartnerSession } from './shared';
import UsageChart from './UsageChart';
import { active, calendar, compact, exportCsv, metrics, total, type Metric, type UsageDay, type UsageReport } from './usageData';

interface OverviewCounts {
  userCount: number;
  workflowCount: number;
  executionCount: number;
  keyCount: number;
}
interface SiteProfile {
  name: string;
  domains: string[];
  status: string;
}
interface DashboardData {
  days: UsageDay[];
  overview: { counts: OverviewCounts; site: SiteProfile } | null;
}
type UsageProps = { overview: boolean; session: PartnerSession };

function Cards({ items }: { items: [string, string][] }) {
  const icons = ['✣', '◫', '▷', '↗', '◷'];
  return <div className="metrics">{items.map(([title, value], index) => (
    <article key={title} className="metric">
      <div><span>{title}</span><i aria-hidden="true" className={'tone-' + index}>{icons[index]}</i></div>
      <strong>{value}</strong>
    </article>
  ))}</div>;
}

function Heatmap({ days }: { days: UsageDay[] }) {
  if (!days.length) return null;
  const max = Math.max(1, ...days.map((day) => day.requests));
  const pad = (new Date(days[0].date).getUTCDay() + 6) % 7;
  return (
    <section className="panel heat">
      <div className="panel-title"><h2>年度活跃度</h2><span>{days[0].date} — {days[days.length - 1].date}</span></div>
      <p>过去一年有 <b>{days.filter(active).length}</b> 个活跃日</p>
      <div className="heat-scroll"><div className="heat-grid" aria-hidden="true">
        {Array.from({ length: pad }, (_, i) => <i className="pad" key={i} />)}
        {days.map((day) => <i key={day.date}
          data-level={active(day) ? Math.min(4, Math.max(1, Math.ceil(4 * day.requests / max))) : 0}
          title={day.date + ' · ' + number(day.requests) + ' 次请求'} />)}
      </div></div>
      <div className="heat-legend" aria-hidden="true">少{[0, 1, 2, 3, 4].map((n) => <i key={n} data-level={n} />)}多</div>
    </section>
  );
}

function Trend({ days, details }: { days: UsageDay[]; details?: boolean }) {
  const first = days[0]?.date || '';
  const last = days[days.length - 1]?.date || '';
  const [range, setRange] = useState(7);
  const [from, setFrom] = useState(days[Math.max(0, days.length - 7)]?.date || '');
  const [to, setTo] = useState(last);
  const [metric, setMetric] = useState<Metric>('requests');
  const selected = useMemo(() => range
    ? days.slice(-range)
    : days.filter((day) => from && to && day.date >= from && day.date <= to), [days, range, from, to]);
  const label = metrics.find(({ key }) => key === metric)?.label;
  const caption = selected.length
    ? selected[0].date + ' 至 ' + selected[selected.length - 1].date + ' · ' + label + '合计 ' + number(total(selected, metric))
    : range ? '尚无统计数据' : '请选择有效的起止日期';

  return <>
    <section className="panel trend">
      <div className="panel-title"><h2>用量趋势</h2><span>北京时间</span></div>
      <div className="chart-controls">
        <div className="tabs" role="group" aria-label="统计区间">
          {(details ? [7, 30, 90, 365, 0] : [7, 30]).map((value) => (
            <button type="button" key={value} data-range={value} aria-pressed={range === value} onClick={() => setRange(value)}>
              {value === 0 ? '自定义' : '近' + value + '天'}
            </button>
          ))}
        </div>
        <label className="inline-field">指标<select data-metric="" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          {metrics.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      {range === 0 && <div className="date-fields">
        <label>开始日期<input data-from="" type="date" min={first} max={last} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>结束日期<input data-to="" type="date" min={first} max={last} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>}
      <p className="chart-summary">{caption}</p>
      <UsageChart rows={selected} metric={metric} caption={caption} />
    </section>
    {details && <section className="panel">
      <div className="panel-title"><h2>用量明细</h2>
        <button type="button" className="button" data-export="" disabled={!selected.length} onClick={() => exportCsv(selected)}>导出 CSV</button>
      </div>
      <div id="details"><Table headers={['日期', ...metrics.map(({ label }) => label)]}
        rows={selected.slice().reverse().map((day) => [day.date, ...metrics.map(({ key }) => number(day[key]))])}
        empty="所选区间暂无数据" /></div>
    </section>}
  </>;
}

function Profile({ site, session }: { site: SiteProfile; session: PartnerSession }) {
  const [copyDialog, setCopyDialog] = useState(false);
  const name = site.name || session.site.name;
  const host = window.location.hostname;
  const domain = site.domains?.find((value) => value.toLowerCase() === host.toLowerCase()) || site.domains?.[0] || host;
  const disabled = site.status === 'disabled';
  async function copySite() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      notify('网站链接已复制');
    } catch {
      setCopyDialog(true);
    }
  }
  return <>
    <section className="site-profile">
      <div><span className="site-initial">{name.slice(0, 1)}</span><div><h2>{name}</h2><span>{domain}</span></div>
        <span className={'tag ' + (disabled ? 'off' : 'ok')}>{disabled ? '已停用' : '运行中'}</span>
      </div>
      <div><a className="button" href="/">打开网站 ↗</a>
        <button type="button" className="button" data-copy-site="" onClick={copySite}>复制网站链接</button>
      </div>
    </section>
    {copyDialog && <Dialog title="复制网站链接" onClose={() => setCopyDialog(false)}>
      <label className="field">本站地址<input readOnly autoFocus value={window.location.origin} onFocus={(e) => e.target.select()} /></label>
    </Dialog>}
  </>;
}

function Overview({ days, counts, site, session }: { days: UsageDay[]; counts: OverviewCounts; site: SiteProfile; session: PartnerSession }) {
  const week = days.slice(-7);
  return <>
    <Heading title="站点概况" description="查看站点运营数据与近期资源消耗。" action={<a className="button" href="#site">站点设置 ↗</a>} />
    <Profile site={site} session={session} />
    <Cards items={[
      ['站点成员', number(counts.userCount)], ['工作流', number(counts.workflowCount)],
      ['执行记录', number(counts.executionCount)], ['API 密钥', number(counts.keyCount)],
    ]} />
    <div className="overview-grid">
      <Trend days={days} />
      <section className="panel week"><div className="panel-title"><h2>近七天用量</h2></div>
        <dl>{metrics.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{number(total(week, key))}</dd></div>)}</dl>
        <a href="#usage">查看用量明细 →</a>
      </section>
    </div>
    <section className="shortcuts"><a href="#members"><span>站点成员</span>查看成员与角色 ↗</a>
      {Number(session.user.role) >= 90 && <a href="#keys"><span>API 密钥</span>配置接入凭证 ↗</a>}
      <a href="/docs"><span>API 文档</span>查阅接口与调用示例 ↗</a>
    </section>
  </>;
}

function Dashboard({ overview, session }: UsageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setError('');
    async function load() {
      const [report, counts, site] = await Promise.all([
        api<UsageReport>('usage', { signal }),
        overview ? api<OverviewCounts>('overview', { signal }) : null,
        overview ? api<SiteProfile>('site', { signal }) : null,
      ]);
      if (!signal.aborted) setData({ days: calendar(report), overview: counts && site ? { counts, site } : null });
    }
    load().catch((e: unknown) => { if (!signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [overview, attempt]);
  if (error) return <ErrorBox message={error} onRetry={() => setAttempt((value) => value + 1)} />;
  if (!data) return <p className="loading" role="status">正在读取{overview ? '站点概况' : '用量分析'}…</p>;
  const { days } = data;
  if (data.overview) return <Overview days={days} {...data.overview} session={session} />;
  return <>
    <Heading title="用量分析" description="查看本站的资源消耗、活跃度与每日用量。" />
    <Cards items={[
      ['总 Token 消耗', compact(total(days, 'tokens'))], ['图片张数', number(total(days, 'images'))],
      ['视频秒数', number(total(days, 'videoSeconds'))], ['总请求数', number(total(days, 'requests'))],
      ['活跃天数', number(days.filter(active).length)],
    ]} />
    <Heatmap days={days} />
    <Trend days={days} details />
  </>;
}

export default function Usage({ overview, session }: UsageProps) {
  return <Dashboard key={JSON.stringify([overview, session.site.siteId, session.user.id])} overview={overview} session={session} />;
}
