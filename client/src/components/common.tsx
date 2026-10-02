import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { JACKPOT_TIERS, JACKPOTS } from '../../../shared/game.ts';
import type { Jackpots, PlayerSummary } from '../../../shared/api.ts';
import { fmt } from '../format.ts';

/** Animates a number from its previous value to `value`. */
export function useCountUp(value: number, duration = 600): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const shownRef = useRef(value);

  useEffect(() => {
    fromRef.current = shownRef.current;
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (value - from) * (1 - Math.pow(1 - t, 3));
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}

export function CountUp({ value, duration, className }: { value: number; duration?: number; className?: string }) {
  const shown = useCountUp(value, duration);
  return <span className={className}>{fmt(shown)}</span>;
}

export function Avatar({ player, size = 40 }: { player: Pick<PlayerSummary, 'avatar' | 'color'>; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ '--c': player.color, width: size, height: size, fontSize: size * 0.58 } as CSSProperties}
    >
      {player.avatar}
    </span>
  );
}

export function JackpotMeters({ jackpots, compact = false }: { jackpots: Jackpots; compact?: boolean }) {
  return (
    <div className={`jackpots${compact ? ' compact' : ''}`}>
      {[...JACKPOT_TIERS].reverse().map((tier) => (
        <div key={tier} className={`jackpot jp-${tier}`}>
          <div className="jp-label">{JACKPOTS[tier].label}</div>
          <CountUp className="jp-value" value={jackpots[tier]} duration={900} />
        </div>
      ))}
    </div>
  );
}

export function Coin({ amount }: { amount: number }) {
  return (
    <span className="coins">
      <span className="coin-icon" />
      {fmt(amount)}
    </span>
  );
}
