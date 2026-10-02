const nf = new Intl.NumberFormat('en-US');

export const fmt = (n: number) => nf.format(Math.floor(n));

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return fmt(n);
}

export function timeAgo(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(t).toLocaleDateString();
}
