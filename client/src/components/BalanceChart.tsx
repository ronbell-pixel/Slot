import { useMemo, useRef, useState } from 'react';
import { compact, fmt } from '../format.ts';

const W = 640;
const H = 220;
const PAD = { l: 56, r: 12, t: 12, b: 24 };

/** Single-series balance-over-time line with a crosshair tooltip. */
export function BalanceChart({ points }: { points: { t: number; balance: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { path, area, xs, ys, ticks } = useMemo(() => {
    const vals = points.map((p) => p.balance);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = max - min || 1;
    const n = Math.max(points.length - 1, 1);
    const xs = points.map((_, i) => PAD.l + (i / n) * (W - PAD.l - PAD.r));
    const ys = vals.map((v) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b));
    const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join('');
    const base = H - PAD.b;
    const area = `${path}L${xs[xs.length - 1]},${base}L${xs[0]},${base}Z`;
    const ticks = [0, 0.5, 1].map((f) => ({ y: PAD.t + (1 - f) * (H - PAD.t - PAD.b), v: min + f * span }));
    return { path, area, xs, ys, ticks };
  }, [points]);

  if (points.length < 2) return <p className="muted">Spin a few times to see your balance chart.</p>;

  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    xs.forEach((px, i) => {
      if (Math.abs(px - x) < Math.abs(xs[best] - x)) best = i;
    });
    setHover(best);
  };

  return (
    <div className="chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Balance over time">
        <defs>
          <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} className="grid" />
            <text x={PAD.l - 8} y={t.y} className="axis" textAnchor="end" dominantBaseline="middle">
              {compact(t.v)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#bal-fill)" />
        <path d={path} className="line" />
        {hover !== null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
            <circle cx={xs[hover]} cy={ys[hover]} r="5" className="dot" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(xs[hover] / W) * 100}%` }}>
          <b>{fmt(points[hover].balance)}</b>
          <span>{new Date(points[hover].t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}
