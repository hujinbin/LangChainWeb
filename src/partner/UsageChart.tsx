import { useEffect, useRef } from 'react';
import { compact, type Metric, type UsageDay } from './usageData';

function draw(canvas: HTMLCanvasElement, rows: UsageDay[], metric: Metric) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);

  const left = 43, right = width - 15, top = 15, bottom = height - 29;
  const values = rows.map((row) => row[metric]);
  const ceiling = Math.ceil(Math.max(1, ...values) / 4) * 4;
  const x = (index: number) => rows.length === 1
    ? (left + right) / 2
    : left + ((right - left) * index) / Math.max(1, rows.length - 1);
  const y = (value: number) => bottom - ((bottom - top) * value) / ceiling;
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#657471';
  ctx.textAlign = 'right';
  ctx.strokeStyle = '#e5eae8';
  for (let line = 0; line <= 4; line++) {
    const value = (ceiling * line) / 4;
    ctx.fillText(compact(value), left - 8, y(value) + 4);
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.stroke();
  }
  if (!rows.length) return;
  ctx.textAlign = 'center';
  const labels = Math.min(rows.length, width < 420 ? 4 : 7);
  for (let n = 0; n < labels; n++) {
    const index = Math.round((n * (rows.length - 1)) / Math.max(1, labels - 1));
    ctx.fillText(rows[index].date.slice(5), x(index), height - 7);
  }

  ctx.beginPath();
  ctx.moveTo(x(0), y(values[0]));
  for (let index = 1; index < values.length; index++) ctx.lineTo(x(index), y(values[index]));
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#12836d';
  ctx.stroke();
  ctx.lineTo(x(values.length - 1), bottom);
  ctx.lineTo(x(0), bottom);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, 'rgba(41, 172, 142, .24)');
  gradient.addColorStop(1, 'rgba(41, 172, 142, .015)');
  ctx.fillStyle = gradient;
  ctx.fill();
  if (rows.length <= 31) {
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;
    values.forEach((value, index) => {
      ctx.beginPath();
      ctx.arc(x(index), y(value), 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
  }
}

export default function UsageChart({ rows, metric, caption }: { rows: UsageDay[]; metric: Metric; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => draw(canvas, rows, metric);
    redraw();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', redraw);
      return () => window.removeEventListener('resize', redraw);
    }
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [rows, metric]);
  return <canvas ref={canvasRef} className="chart" role="img" aria-label={caption} />;
}
