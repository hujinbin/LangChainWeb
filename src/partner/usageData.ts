import { number } from './shared';

export const metrics = [
  { key: 'requests', label: '请求数' },
  { key: 'tokens', label: 'Token 用量' },
  { key: 'images', label: '图片张数' },
  { key: 'videoSeconds', label: '视频秒数' },
  { key: 'points', label: '消耗积分' },
] as const;

export type Metric = (typeof metrics)[number]['key'];
export type UsageDay = { date: string } & Record<Metric, number>;
export interface UsageReport {
  from: string;
  to: string;
  days?: ({ date: string } & Partial<Record<Metric, number>>)[];
}

export function calendar(report: UsageReport): UsageDay[] {
  if (!report?.from || !report.to) return [];
  const byDate = new Map((report.days ?? []).map((day) => [day.date, day]));
  const days: UsageDay[] = [];
  const end = Date.parse(report.to);
  for (let time = Date.parse(report.from); time <= end && days.length < 366; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const row = byDate.get(date);
    const day: UsageDay = { date, requests: 0, tokens: 0, images: 0, videoSeconds: 0, points: 0 };
    if (row) {
      for (const { key } of metrics) day[key] = Number(row[key]) || 0;
    }
    days.push(day);
  }
  return days;
}

export function active(day: UsageDay) {
  return metrics.some(({ key }) => day[key] > 0);
}

export function total(days: UsageDay[], metric: Metric) {
  return days.reduce((sum, day) => sum + day[metric], 0);
}

export function compact(value: number) {
  if (value >= 1_000_000) return number(value / 1_000_000) + 'M';
  if (value >= 1_000) return number(value / 1_000) + 'K';
  return number(value);
}

export function exportCsv(days: UsageDay[]) {
  if (!days.length) return;
  const lines = [
    ['日期', ...metrics.map(({ label }) => label)],
    ...days.map((day) => [day.date, ...metrics.map(({ key }) => day[key])]),
  ];
  const blob = new Blob(['\ufeff' + lines.map((line) => line.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '站点用量-' + days[0].date + '-' + days[days.length - 1].date + '.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
