import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowDown, FiBookOpen, FiKey } from 'react-icons/fi';
import apiClient from '../../services/api';
import { PARTNER_PATH } from '../../config/runtime';
import useAuthStore from '../../store/authStore';
import { useLabels } from '../../store/languageStore';
import './Developer.css';

type Metric = 'requests' | 'tokens' | 'images' | 'videoSeconds';
interface Day {
  date: string;
  requests: number;
  tokens: number;
  images: number;
  videoSeconds: number;
  points: number;
}
interface Usage {
  from: string;
  to: string;
  days: Day[];
}
const metrics: Metric[] = ['requests', 'tokens', 'images', 'videoSeconds'];
const zero = { requests: 0, tokens: 0, images: 0, videoSeconds: 0, points: 0 };
const dateString = (value: number) =>
  new Date(value).toISOString().slice(0, 10);
const dayMs = 86400000;

function UsageReport({ usage }: { usage: Usage }) {
  const t = useLabels();
  const labels = {
    requests: t('模型请求数', 'Model requests'),
    tokens: t('Token 消耗', 'Tokens'),
    images: t('图片张数', 'Images'),
    videoSeconds: t('视频秒数', 'Video seconds'),
  };
  const [period, setPeriod] = useState('7');
  const [customFrom, setFrom] = useState(usage.from);
  const [customTo, setTo] = useState(usage.to);
  const [metric, setMetric] = useState<Metric>('requests');
  const indexed = new Map(usage.days.map((row) => [row.date, row]));
  const days: Day[] = [];
  for (
    let time = Date.parse(usage.from);
    time <= Date.parse(usage.to);
    time += dayMs
  ) {
    const date = dateString(time);
    days.push(indexed.get(date) || { date, ...zero });
  }
  const start =
    period === 'custom'
      ? customFrom
      : period === 'month'
        ? usage.to.slice(0, 7) + '-01'
        : dateString(Date.parse(usage.to) - (Number(period) - 1) * dayMs);
  const end = period === 'custom' ? customTo : usage.to;
  const selected = days.filter((row) => row.date >= start && row.date <= end);
  const totals = (key: Metric) => days.reduce((sum, row) => sum + row[key], 0);
  const active = days.filter((row) => row.requests > 0).length;
  const maxRequests = Math.max(1, ...days.map((row) => row.requests));
  const max = Math.max(1, ...selected.map((row) => row[metric]));
  const points = selected.map((row, i) => [
    selected.length === 1
      ? 500
      : 2 + (996 * i) / Math.max(1, selected.length - 1),
    115 - (108 * row[metric]) / max,
  ]);
  const blanks = (new Date(usage.from).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((days.length + blanks) / 7);
  const monthFormat = new Intl.DateTimeFormat(t('zh-CN', 'en-US'), {
    month: 'short',
    timeZone: 'UTC',
  });
  const months = days.flatMap((row, index) => {
    if (!row.date.endsWith('-01')) return [];
    return [
      {
        column: Math.floor((index + blanks) / 7) + 1,
        label: monthFormat.format(new Date(row.date)),
      },
    ];
  });
  function download() {
    const lines = [
      [
        t('日期', 'Date'),
        ...metrics.map((k) => labels[k]),
        t('积分', 'Points'),
      ],
      ...selected.map((row) => [
        row.date,
        ...metrics.map((k) => row[k]),
        row.points,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + lines.map((line) => line.join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usage-' + start + '-' + end + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="usage-stats">
        {(['tokens', 'images', 'videoSeconds', 'requests'] as Metric[]).map(
          (key) => (
            <div className="usage-stat" key={key}>
              <span>{labels[key]}</span>
              <strong>{totals(key).toLocaleString()}</strong>
            </div>
          )
        )}
        <div className="usage-stat">
          <span>{t('活跃天数', 'Active days')}</span>
          <strong>{active}</strong>
        </div>
      </div>
      <section className="usage-panel">
        <div className="usage-heading">
          <h2>{t('近一年活跃度', 'Activity over the last year')}</h2>
          <span className="usage-caption">
            {usage.from} — {usage.to}
          </span>
        </div>
        <div className="activity-scroll">
          <div className="activity-calendar">
            <div
              className="activity-months"
              aria-hidden="true"
              style={{
                gridTemplateColumns: 'repeat(' + weeks + ', minmax(0,1fr))',
              }}
            >
              {months.map((month) => (
                <span key={month.column} style={{ gridColumn: month.column }}>
                  {month.label}
                </span>
              ))}
            </div>
            <div className="activity-weekdays" aria-hidden="true">
              <span>{t('周一', 'Mon')}</span>
              <span>{t('周三', 'Wed')}</span>
              <span>{t('周五', 'Fri')}</span>
            </div>
            <div
              className="activity-grid"
              aria-label={t('每日模型请求', 'Daily model requests')}
            >
              {Array.from({ length: blanks }, (_, i) => (
                <i key={i} />
              ))}
              {days.map((row) => (
                <span
                  key={row.date}
                  title={
                    row.date + ' · ' + row.requests + ' ' + labels.requests
                  }
                  data-level={Math.ceil((4 * row.requests) / maxRequests)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="activity-key" aria-hidden="true">
          {t('少', 'Less')}
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} data-level={level} />
          ))}
          {t('多', 'More')}
        </div>
      </section>
      <section className="usage-panel">
        <div className="usage-heading">
          <h2>{t('用量趋势', 'Usage trend')}</h2>
          <div className="metric-tabs">
            {metrics.map((k) => (
              <button
                key={k}
                aria-pressed={metric === k}
                onClick={() => setMetric(k)}
              >
                {labels[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="usage-periods">
          {[
            ['1', t('今天', 'Today')],
            ['7', t('近7天', '7 days')],
            ['30', t('近30天', '30 days')],
            ['month', t('本月', 'This month')],
            ['custom', t('自定义', 'Custom')],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
            >
              {label}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input
                type="date"
                aria-label={t('开始日期', 'Start date')}
                min={usage.from}
                max={customTo}
                value={customFrom}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                type="date"
                aria-label={t('结束日期', 'End date')}
                min={customFrom}
                max={usage.to}
                value={customTo}
                onChange={(e) => setTo(e.target.value)}
              />
            </>
          )}
        </div>
        {selected.length ? (
          <>
            <span className="usage-caption">
              {labels[metric]} · {t('峰值', 'Peak')}{' '}
              {Math.max(...selected.map((row) => row[metric])).toLocaleString()}
            </span>
            <svg
              className="usage-chart"
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              role="img"
              aria-label={labels[metric] + ' ' + start + ' — ' + end}
            >
              {[8, 44, 80, 115].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="1000"
                  y1={y}
                  y2={y}
                  stroke="var(--border-color)"
                />
              ))}
              <polyline
                points={points.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              {points.length <= 31 &&
                points.map(([x, y], i) => (
                  <circle
                    key={x}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="var(--color-primary)"
                  >
                    <title>
                      {selected[i].date}: {selected[i][metric]}
                    </title>
                  </circle>
                ))}
            </svg>
            <div className="chart-dates">
              <span>{start}</span>
              <span>{end}</span>
            </div>
          </>
        ) : (
          <p>{t('请选择有效的日期范围', 'Choose a valid date range')}</p>
        )}
      </section>
      <section className="usage-panel">
        <div className="usage-heading">
          <h2>{t('用量明细', 'Daily usage')}</h2>
          <button
            className="btn btn-default"
            disabled={!selected.length}
            onClick={download}
          >
            <FiArrowDown /> CSV
          </button>
        </div>
        <p className="usage-caption">
          {t(
            '按上海时间汇总已结算的模型请求。视频按成功提交的生成时长统计。',
            'Settled model requests by Shanghai date. Video seconds count successfully submitted generation jobs.'
          )}
        </p>
        <table>
          <thead>
            <tr>
              <th>{t('日期', 'Date')}</th>
              {metrics.map((k) => (
                <th key={k}>{labels[k]}</th>
              ))}
              <th>{t('积分', 'Points')}</th>
            </tr>
          </thead>
          <tbody>
            {selected
              .filter((row) => row.requests)
              .reverse()
              .map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  {metrics.map((k) => (
                    <td key={k}>{row[k].toLocaleString()}</td>
                  ))}
                  <td>{row.points.toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!selected.some((row) => row.requests) && (
          <p>
            {t('所选时段暂无模型调用。', 'No model requests in this period.')}
          </p>
        )}
      </section>
    </>
  );
}

export default function UsageOverview() {
  const t = useLabels();
  const token = useAuthStore((s) => s.token);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setUsage(null);
    setError('');
    if (token)
      apiClient
        .get('/api/aiWorkflow/usage', { signal: abort.signal })
        .then(({ data }) => {
          if (data.code !== 200 || !Array.isArray(data.data?.days))
            throw Error(data.msg || '用量数据读取失败');
          if (!abort.signal.aborted) setUsage(data.data);
        })
        .catch((err) => {
          if (!abort.signal.aborted) setError(err.message);
        });
    return () => abort.abort();
  }, [token, revision]);
  return (
    <main className="developer-page">
      <header className="developer-title">
        <div>
          <span className="dev-breadcrumb">
            <FiActivity />
            {t('个人控制台', 'Account console')}
          </span>
          <h1>{t('用量总览', 'Usage overview')}</h1>
        </div>
        <div className="dev-actions">
          <Link className="btn btn-default" to="/docs">
            <FiBookOpen /> API {t('文档', 'docs')}
          </Link>
          <a
            className="btn btn-default"
            href={PARTNER_PATH + '#keys'}
          >
            <FiKey />
            {t('API 密钥管理', 'API key management')}
          </a>
        </div>
      </header>
      {!token ? (
        <section className="usage-panel">
          <p>
            {t(
              '登录后可查看当前账号的模型用量。',
              'Sign in to view usage for this account.'
            )}
          </p>
          <Link
            className="btn btn-primary"
            to="/login"
            state={{ from: '/usage' }}
          >
            {t('登录', 'Sign in')}
          </Link>
        </section>
      ) : error ? (
        <section className="usage-panel" role="alert">
          <p>{error}</p>
          <button
            className="btn btn-default"
            onClick={() => setRevision((v) => v + 1)}
          >
            {t('重试', 'Retry')}
          </button>
        </section>
      ) : usage ? (
        <UsageReport usage={usage} />
      ) : (
        <p role="status">{t('正在读取用量…', 'Loading usage…')}</p>
      )}
    </main>
  );
}
