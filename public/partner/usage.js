import { api, html, number, heading, table, modal, notice } from './ui.js';

const metrics = {
  requests: '请求数',
  tokens: 'Token 用量',
  images: '图片张数',
  videoSeconds: '视频秒数',
  points: '消耗积分',
};
const dayMs = 86400000;
const iso = (time) => new Date(time).toISOString().slice(0, 10);
const active = (day) => Object.keys(metrics).some((key) => day[key] > 0);

function calendar(data) {
  if (!data?.from || !data?.to) return [];
  const start = Date.parse(data.from),
    end = Date.parse(data.to);
  const rows = new Map((data.days || []).map((row) => [row.date, row]));
  const days = [];
  for (let time = start; time <= end && days.length < 366; time += dayMs) {
    const date = iso(time);
    days.push({ date, requests: 0, tokens: 0, images: 0, videoSeconds: 0, points: 0, ...rows.get(date) });
  }
  return days;
}
const total = (days, key) => days.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
const compact = (value) =>
  value >= 1000000 ? number(value / 1000000) + 'M' : value >= 1000 ? number(value / 1000) + 'K' : number(value);
const icons = ['✣', '◫', '▷', '↗', '◷'];
function cards(items) {
  return (
    '<div class="metrics">' +
    items
      .map(
        ([title, value], i) =>
          '<article class="metric"><div><span>' +
          html(title) +
          '</span><i aria-hidden="true" class="tone-' +
          i +
          '">' +
          icons[i] +
          '</i></div><strong>' +
          html(value) +
          '</strong></article>'
      )
      .join('') +
    '</div>'
  );
}

function drawChart(canvas, rows, key) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const w = rect.width,
    h = rect.height,
    ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  const x0 = 43,
    x1 = w - 15,
    y0 = h - 29,
    y1 = 15;
  const values = rows.map((row) => Number(row[key]) || 0);
  const max = Math.max(1, ...values);
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (i) => (rows.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / Math.max(1, rows.length - 1));
  const y = (value) => y0 - ((y0 - y1) * value) / ceiling;
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#657471';
  ctx.textAlign = 'right';
  for (let line = 0; line <= 4; line++) {
    const value = (ceiling * line) / 4;
    ctx.fillText(compact(value), x0 - 8, y(value) + 4);
    ctx.beginPath();
    ctx.moveTo(x0, y(value));
    ctx.lineTo(x1, y(value));
    ctx.strokeStyle = '#e5eae8';
    ctx.stroke();
  }
  if (!rows.length) return;
  ctx.textAlign = 'center';
  const count = Math.min(rows.length, w < 420 ? 4 : 7);
  for (let j = 0; j < count; j++) {
    const i = Math.round((j * (rows.length - 1)) / Math.max(1, count - 1));
    ctx.fillText(rows[i].date.slice(5), x(i), h - 7);
  }
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#12836d';
  ctx.stroke();
  ctx.lineTo(x(values.length - 1), y0);
  ctx.lineTo(x(0), y0);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, y1, 0, y0);
  gradient.addColorStop(0, 'rgba(41, 172, 142, .24)');
  gradient.addColorStop(1, 'rgba(41, 172, 142, .015)');
  ctx.fillStyle = gradient;
  ctx.fill();
  if (rows.length <= 31) {
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(v), 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
  }
}

function heatmap(days) {
  if (!days.length) return '';
  const max = Math.max(1, ...days.map((row) => row.requests));
  const pad = (new Date(days[0].date).getUTCDay() + 6) % 7;
  return (
    '<section class="panel heat"><div class="panel-title"><h2>年度活跃度</h2><span>' +
    html(days[0].date + ' — ' + days.at(-1).date) +
    '</span></div><p>过去一年有 <b>' +
    days.filter(active).length +
    '</b> 个活跃日</p>' +
    '<div class="heat-scroll"><div class="heat-grid" aria-hidden="true">' +
    '<i class="pad"></i>'.repeat(pad) +
    days
      .map(
        (row) =>
          '<i data-level="' +
          (active(row) ? Math.min(4, Math.max(1, Math.ceil((4 * row.requests) / max))) : 0) +
          '" title="' +
          html(row.date + ' · ' + number(row.requests) + ' 次请求') +
          '"></i>'
      )
      .join('') +
    '</div></div>' +
    '<div class="heat-legend" aria-hidden="true">少<i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i>多</div></section>'
  );
}

function trendShell(full) {
  return (
    '<section class="panel trend"><div class="panel-title"><h2>用量趋势</h2><span>北京时间</span></div><div class="chart-controls">' +
    '<div class="tabs" aria-label="统计区间">' +
    (full ? [7, 30, 90, 365, 0] : [7, 30])
      .map((n) => '<button data-range="' + n + '">' + (n === 0 ? '自定义' : '近' + n + '天') + '</button>')
      .join('') +
    '</div><label class="inline-field">指标<select data-metric>' +
    Object.entries(metrics)
      .map(([k, v]) => '<option value="' + k + '">' + v + '</option>')
      .join('') +
    '</select></label></div>' +
    '<div class="date-fields" hidden><label>开始日期<input type="date" data-from></label><label>结束日期<input type="date" data-to></label></div>' +
    '<p class="chart-summary"></p><canvas role="img" class="chart" aria-label="每日用量趋势"></canvas></section>'
  );
}

function exportCsv(rows) {
  const columns = ['date', ...Object.keys(metrics)];
  const lines = [
    ['日期', ...Object.values(metrics)].join(','),
    ...rows.map((row) => columns.map((key) => row[key]).join(',')),
  ];
  const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '站点用量-' + rows[0]?.date + '-' + rows.at(-1)?.date + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function bindTrend(main, all, signal, full) {
  let range = 7;
  let rows = [];
  const metric = main.querySelector('[data-metric]'),
    canvas = main.querySelector('canvas');
  const from = main.querySelector('[data-from]'),
    to = main.querySelector('[data-to]');
  for (const input of [from, to]) {
    input.min = all[0]?.date || '';
    input.max = all.at(-1)?.date || '';
  }
  from.value = all.at(-7)?.date || from.min;
  to.value = to.max;
  function draw() {
    rows = range
      ? all.slice(-range)
      : all.filter((row) => from.value && to.value && row.date >= from.value && row.date <= to.value);
    main.querySelector('.date-fields').hidden = Boolean(range);
    for (const button of main.querySelectorAll('[data-range]'))
      button.setAttribute('aria-pressed', String(Number(button.dataset.range) === range));
    const key = metric.value;
    const caption = rows.length
      ? rows[0].date + ' 至 ' + rows.at(-1).date + ' · ' + metrics[key] + '合计 ' + number(total(rows, key))
      : range
      ? '尚无统计数据'
      : '请选择有效的起止日期';
    main.querySelector('.chart-summary').textContent = caption;
    canvas.setAttribute('aria-label', caption);
    drawChart(canvas, rows, key);
    if (!full) return;
    main.querySelector('[data-export]').disabled = !rows.length;
    main.querySelector('#details').innerHTML = table(
      ['日期', ...Object.values(metrics)],
      rows
        .slice()
        .reverse()
        .map((row) => [html(row.date), ...Object.keys(metrics).map((k) => number(row[k]))]),
      '所选区间暂无数据'
    );
  }
  for (const button of main.querySelectorAll('[data-range]'))
    button.onclick = () => {
      range = Number(button.dataset.range);
      draw();
    };
  for (const input of [from, to, metric]) input.onchange = draw;
  const observer = new ResizeObserver(() => drawChart(canvas, rows, metric.value));
  observer.observe(canvas);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  if (full) main.querySelector('[data-export]').onclick = () => exportCsv(rows);
  draw();
}

export async function usage(main, { signal, session, page }) {
  const full = page === 'usage';
  const [data, counts, config] = await Promise.all([
    api('usage', { signal }),
    full ? null : api('overview', { signal }),
    full ? null : api('site', { signal }),
  ]);
  if (signal.aborted) return;
  const days = calendar(data),
    week = days.slice(-7);
  const domain =
    (config?.domains || []).find((host) => host.toLowerCase() === location.hostname.toLowerCase()) ||
    config?.domains?.[0] ||
    location.hostname;
  const profile = full
    ? ''
    : '<section class="site-profile"><div><span class="site-initial">' +
      html((config.name || session.site.name).slice(0, 1)) +
      '</span><div><h2>' +
      html(config.name || session.site.name) +
      '</h2><span>' +
      html(domain) +
      '</span></div><span class="tag ' +
      (config.status === 'disabled' ? 'off">已停用' : 'ok">运行中') +
      '</span></div><div><a class="button" href="/">打开网站 ↗</a>' +
      '<button type="button" class="button" data-copy-site>复制网站链接</button></div></section>';
  main.innerHTML =
    heading(
      full ? '用量分析' : '站点概况',
      full ? '查看本站的资源消耗、活跃度与每日用量。' : '查看站点运营数据与近期资源消耗。',
      full ? '' : '<a class="button" href="#site">站点设置 ↗</a>'
    ) +
    profile +
    (full
      ? cards([
          ['总 Token 消耗', compact(total(days, 'tokens'))],
          ['图片张数', number(total(days, 'images'))],
          ['视频秒数', number(total(days, 'videoSeconds'))],
          ['总请求数', number(total(days, 'requests'))],
          ['活跃天数', number(days.filter(active).length)],
        ])
      : cards([
          ['站点成员', number(counts.userCount)],
          ['工作流', number(counts.workflowCount)],
          ['执行记录', number(counts.executionCount)],
          ['API 密钥', number(counts.keyCount)],
        ])) +
    (full
      ? heatmap(days) +
        trendShell(true) +
        '<section class="panel"><div class="panel-title"><h2>用量明细</h2><button class="button" data-export>导出 CSV</button></div><div id="details"></div></section>'
      : '<div class="overview-grid">' +
        trendShell(false) +
        '<section class="panel week"><div class="panel-title"><h2>近七天用量</h2></div><dl>' +
        Object.entries(metrics)
          .map(([k, v]) => '<div><dt>' + v + '</dt><dd>' + number(total(week, k)) + '</dd></div>')
          .join('') +
        '</dl><a href="#usage">查看用量明细 →</a></section></div>' +
        '<section class="shortcuts"><a href="#members"><span>站点成员</span>查看成员与角色 ↗</a>' +
        (Number(session.user.role) >= 90 ? '<a href="#keys"><span>API 密钥</span>配置接入凭证 ↗</a>' : '') +
        '<a href="/docs"><span>API 文档</span>查阅接口与调用示例 ↗</a></section>');
  bindTrend(main, days, signal, full);
  if (!full)
    main.querySelector('[data-copy-site]').onclick = async () => {
      const url = location.origin;
      try {
        await navigator.clipboard.writeText(url);
        notice('网站链接已复制');
      } catch {
        const dialog = modal(
          '复制网站链接',
          '<label class="field">本站地址<input readonly value="' + html(url) + '"></label>'
        );
        dialog.querySelector('input').select();
      }
    };
}
