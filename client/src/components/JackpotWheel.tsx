import { useEffect, useMemo, useState } from 'react';
import { JACKPOTS, type JackpotTier } from '../../../shared/game.ts';
import type { Jackpots } from '../../../shared/api.ts';
import { sfx } from '../engine/sound.ts';
import { compact } from '../format.ts';

const SEGMENTS: JackpotTier[] = ['mini', 'minor', 'mini', 'major', 'mini', 'minor', 'mini', 'grand', 'mini', 'minor', 'mini', 'major'];
const SEG = 360 / SEGMENTS.length;
const COLORS: Record<JackpotTier, [string, string]> = {
  mini: ['#2fd47a', '#0f8a47'],
  minor: ['#29b6ff', '#0d5fa8'],
  major: ['#c061ff', '#6a1fb0'],
  grand: ['#ffe066', '#e08a00'],
};
const SPIN_MS = 5200;

function wedge(i: number, r: number) {
  const a0 = ((i * SEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
  return `M0,0 L${r * Math.cos(a0)},${r * Math.sin(a0)} A${r},${r} 0 0 1 ${r * Math.cos(a1)},${r * Math.sin(a1)} Z`;
}

export function JackpotWheel({ tier, jackpots, onDone }: { tier: JackpotTier; jackpots: Jackpots; onDone: () => void }) {
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState(false);

  const target = useMemo(() => {
    const options = SEGMENTS.map((t, i) => (t === tier ? i : -1)).filter((i) => i >= 0);
    const index = options[Math.floor(Math.random() * options.length)];
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    return 360 * 6 - (index * SEG + SEG / 2) + jitter;
  }, [tier]);

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setRotation(target), 300));
    // Tick each time a segment boundary passes the pointer (inverse of the ease-out-cubic).
    for (let k = 1; k * SEG < target; k++) {
      const t = 1 - Math.cbrt(1 - (k * SEG) / target);
      timers.push(window.setTimeout(() => sfx.wheelTick(), 300 + t * SPIN_MS));
    }
    timers.push(
      window.setTimeout(() => {
        setLanded(true);
        sfx.boom();
      }, 300 + SPIN_MS),
    );
    timers.push(window.setTimeout(onDone, 300 + SPIN_MS + 1300));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="wheel-overlay">
      <div className="wheel-title">JACKPOT BONUS!</div>
      <div className={`wheel-wrap${landed ? ' landed' : ''}`}>
        <div className="wheel-pointer" />
        <svg
          className="wheel"
          viewBox="-110 -110 220 220"
          style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(0.33, 1, 0.68, 1)` }}
        >
          <defs>
            {Object.entries(COLORS).map(([t, [a, b]]) => (
              <radialGradient key={t} id={`wg-${t}`} cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                <stop offset="20%" stopColor={b} />
                <stop offset="100%" stopColor={a} />
              </radialGradient>
            ))}
          </defs>
          <circle r="108" fill="#2a1240" stroke="#ffd23f" strokeWidth="4" />
          {SEGMENTS.map((t, i) => (
            <g key={i}>
              <path d={wedge(i, 100)} fill={`url(#wg-${t})`} stroke="#fff6" strokeWidth="1" />
              <g transform={`rotate(${i * SEG + SEG / 2}) translate(0,-68) rotate(0)`}>
                <text className="wheel-label" textAnchor="middle" dominantBaseline="middle">
                  {JACKPOTS[t].label}
                </text>
                <text className="wheel-amount" y="14" textAnchor="middle" dominantBaseline="middle">
                  {compact(jackpots[t])}
                </text>
              </g>
            </g>
          ))}
          {Array.from({ length: 24 }, (_, i) => (
            <circle key={i} className="wheel-bulb" style={{ animationDelay: `${(i % 2) * 0.3}s` }} cx={104 * Math.cos((i * 15 * Math.PI) / 180)} cy={104 * Math.sin((i * 15 * Math.PI) / 180)} r="3" />
          ))}
          <circle r="20" fill="url(#wg-grand)" stroke="#fff" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="20">
            💰
          </text>
        </svg>
      </div>
    </div>
  );
}
