import { useMemo, type CSSProperties } from 'react';

/** Slowly drifting theme particles in the background. */
export function Ambient({ emojis, enabled }: { emojis: string[]; enabled: boolean }) {
  const items = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        emoji: emojis[i % emojis.length],
        left: Math.random() * 100,
        size: 14 + Math.random() * 22,
        duration: 14 + Math.random() * 16,
        delay: -Math.random() * 30,
        drift: (Math.random() - 0.5) * 120,
      })),
    [emojis],
  );
  if (!enabled) return null;
  return (
    <div className="ambient" aria-hidden>
      {items.map((it, i) => (
        <span
          key={i}
          style={
            {
              left: `${it.left}%`,
              fontSize: it.size,
              animationDuration: `${it.duration}s`,
              animationDelay: `${it.delay}s`,
              '--drift': `${it.drift}px`,
            } as CSSProperties
          }
        >
          {it.emoji}
        </span>
      ))}
    </div>
  );
}
