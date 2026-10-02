import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { JACKPOTS, type JackpotTier } from '../../../shared/game.ts';
import type { ThemeDef } from '../../../shared/themes.ts';
import { fx } from '../engine/particles.ts';
import { sfx } from '../engine/sound.ts';
import { useCountUp } from './common.tsx';
import { fmt } from '../format.ts';

export type CelebrationKind = 'big' | 'mega' | 'epic' | 'jackpot' | 'freespins-intro' | 'freespins-total';

export interface CelebrationProps {
  kind: CelebrationKind;
  amount: number;
  theme: ThemeDef;
  jackpotTier?: JackpotTier;
  freeSpins?: number;
  reduceMotion: boolean;
  onDone: () => void;
}

const DURATION: Record<CelebrationKind, number> = {
  big: 3800,
  mega: 5200,
  epic: 7000,
  jackpot: 10000,
  'freespins-intro': 3200,
  'freespins-total': 4500,
};

const TITLE: Record<CelebrationKind, string> = {
  big: 'BIG WIN',
  mega: 'MEGA WIN',
  epic: 'EPIC WIN',
  jackpot: 'JACKPOT',
  'freespins-intro': 'FREE SPINS',
  'freespins-total': 'FREE SPINS WIN',
};

export function Celebration({ kind, amount, theme, jackpotTier, freeSpins, reduceMotion, onDone }: CelebrationProps) {
  const [target, setTarget] = useState(0);
  const countDuration = kind === 'jackpot' ? 5500 : kind === 'epic' ? 4500 : kind === 'mega' ? 3200 : 2200;
  const shown = useCountUp(target, countDuration);
  const doneRef = useRef(false);
  const intensity = kind === 'jackpot' ? 4 : kind === 'epic' ? 3 : kind === 'mega' ? 2 : 1;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const startAt = kind === 'jackpot' ? 1400 : 150; // jackpot opens with a lights-out spotlight

    if (kind === 'freespins-intro') {
      sfx.freeSpins(theme.scale);
      fx.emojiBurst([theme.symbols.S.glyph, '✨'], cx, cy, 18);
      fx.confetti(60);
    } else {
      if (kind === 'jackpot') sfx.boom();
      later(startAt, () => {
        setTarget(amount);
        if (kind === 'jackpot') sfx.fanfare(theme.scale);
        else sfx.bigWin(theme.scale);
        fx.coinFountain(cx, cy + 80, 30 * intensity, 1 + intensity * 0.1);
        if (intensity >= 2) fx.coinRain(50 * intensity, 2.5);
        if (intensity >= 3) {
          fx.confetti(120 * (intensity - 2));
          fx.fireworks(4 * (intensity - 1), 380);
          fx.emojiRain(theme.celebrate, 12 * intensity, 3);
        }
        if (kind === 'freespins-total') fx.emojiRain(theme.celebrate, 16, 2);
      });
      // Clinking coins while the meter counts up.
      const clinks = Math.round(countDuration / 120);
      for (let i = 0; i < clinks; i++) later(startAt + i * 120, () => sfx.coin());
      if (intensity >= 3) {
        for (let i = 1; i <= intensity; i++) later(startAt + 1500 * i, () => fx.fireworks(3, 300));
        later(startAt + 2500, () => fx.confetti(100));
      }
    }

    later(DURATION[kind], finish);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    kind === 'jackpot' && jackpotTier
      ? `${JACKPOTS[jackpotTier].label} JACKPOT`
      : kind === 'epic'
        ? theme.epicText
        : TITLE[kind];

  return (
    <div
      className={`celebration cel-${kind}${reduceMotion ? ' calm' : ''}`}
      style={{ '--accent': theme.colors.accent, '--accent2': theme.colors.accent2, '--glow': theme.colors.glow } as CSSProperties}
      onClick={finish}
      role="dialog"
      aria-label={title}
    >
      <div className="cel-backdrop" />
      {kind === 'jackpot' && <div className="spotlight" />}
      <div className="rays" />
      {kind !== 'freespins-intro' && <ThemeEffect effect={theme.effect} intensity={intensity} />}
      <div className="cel-content">
        {kind === 'jackpot' && <div className="jp-badge">💰</div>}
        <div className="cel-title" data-text={title}>
          {title}
        </div>
        {kind === 'freespins-intro' ? (
          <>
            <div className="cel-amount">{freeSpins}</div>
            <div className="cel-sub">spins at 2× — good luck!</div>
          </>
        ) : (
          <div className="cel-amount">{fmt(shown)}</div>
        )}
        <div className="cel-skip">tap to continue</div>
      </div>
    </div>
  );
}

const CARD_FACES = ['A♠', 'K♥', 'Q♦', 'J♣', '10♠', 'A♥', 'K♣', 'Q♠'];

function ThemeEffect({ effect, intensity }: { effect: ThemeDef['effect']; intensity: number }) {
  const n = 6 + intensity * 4;
  switch (effect) {
    case 'wave':
      return (
        <div className="fx-wave">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
            <path d="M0,100 C150,40 300,160 450,100 C600,40 750,160 900,100 C1050,40 1200,160 1350,100 L1350,200 L0,200 Z" />
          </svg>
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="back">
            <path d="M0,120 C150,60 300,180 450,120 C600,60 750,180 900,120 C1050,60 1200,180 1350,120 L1350,200 L0,200 Z" />
          </svg>
        </div>
      );
    case 'balloons':
      return (
        <div className="fx-balloons">
          {Array.from({ length: n * 2 }, (_, i) => (
            <span key={i} style={{ '--i': i, left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.25}s` } as CSSProperties}>
              🎈
            </span>
          ))}
        </div>
      );
    case 'jet':
      return (
        <div className="fx-jets">
          {Array.from({ length: Math.min(4, intensity + 1) }, (_, i) => (
            <div key={i} className="jet" style={{ top: `${15 + i * 18}%`, animationDelay: `${i * 0.5}s` }}>
              <span className="trail" />
              <span className="plane">✈️</span>
            </div>
          ))}
        </div>
      );
    case 'crown':
      return <div className="fx-crown">👑</div>;
    case 'cards':
      return (
        <div className="fx-cards">
          {Array.from({ length: n }, (_, i) => {
            const face = CARD_FACES[i % CARD_FACES.length];
            const angle = -70 + (140 / (n - 1)) * i;
            return (
              <div key={i} className={`card${/[♥♦]/.test(face) ? ' red' : ''}`} style={{ '--a': `${angle}deg`, animationDelay: `${i * 0.06}s` } as CSSProperties}>
                {face}
              </div>
            );
          })}
        </div>
      );
    case 'flash':
      return (
        <div className="fx-flash">
          <div className="flashes" />
          {Array.from({ length: n }, (_, i) => (
            <span key={i} style={{ left: `${(i * 41) % 95}%`, top: `${(i * 29) % 90}%`, animationDelay: `${(i % 6) * 0.3}s` }}>
              📸
            </span>
          ))}
        </div>
      );
  }
}
