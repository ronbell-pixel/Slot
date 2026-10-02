import { useEffect, useState, type CSSProperties } from 'react';
import type { FeedEvent, PlayerState } from '../../../shared/api.ts';
import { DAILY_BONUS, JACKPOTS, type JackpotTier } from '../../../shared/game.ts';
import { THEMES, getTheme, type ThemeId } from '../../../shared/themes.ts';
import { api } from '../api.ts';
import { Avatar, JackpotMeters } from '../components/common.tsx';
import { fx } from '../engine/particles.ts';
import { sfx } from '../engine/sound.ts';
import { fmt, timeAgo } from '../format.ts';

interface Props {
  player: PlayerState;
  setPlayer: (p: PlayerState) => void;
  feed: FeedEvent[];
  onPlay: (theme: ThemeId) => void;
  onError: (m: string) => void;
}

export function Lobby({ player, setPlayer, feed, onPlay, onError }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bonusReady = player.bonusAvailableAt <= now;
  const wait = Math.max(0, player.bonusAvailableAt - now);
  const hh = Math.floor(wait / 3_600_000);
  const mm = Math.floor((wait % 3_600_000) / 60_000);
  const ss = Math.floor((wait % 60_000) / 1000);

  const claim = async (e: React.MouseEvent) => {
    try {
      const p = await api.bonus();
      setPlayer(p);
      sfx.bigWin([523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]);
      fx.coinFountain(e.clientX, e.clientY, 50);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not claim bonus');
    }
  };

  return (
    <div className="lobby">
      <section className="hero">
        <div>
          <h1 className="hello">
            Hey {player.name}! <span className="wave">👋</span>
          </h1>
          <p className="muted">Pick a machine and chase your jackpots.</p>
        </div>
        <div className={`bonus-card${bonusReady ? ' ready' : ''}`}>
          <div className="bonus-icon">🎁</div>
          <div>
            <div className="bonus-title">Daily bonus</div>
            <div className="bonus-sub">{bonusReady ? `${fmt(DAILY_BONUS)} free credits!` : `Next in ${hh}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`}</div>
          </div>
          <button className="btn primary" disabled={!bonusReady} onClick={claim}>
            Claim
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Your jackpots</h2>
        <JackpotMeters jackpots={player.jackpots} />
      </section>

      <div className="lobby-main">
        <section>
          <h2 className="section-title">Choose your machine</h2>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-card theme-${t.id}`}
                style={{ '--bg': t.colors.bg, '--accent': t.colors.accent, '--glow': t.colors.glow, '--frame': t.colors.frame, '--tile': t.colors.tile } as CSSProperties}
                onClick={() => {
                  sfx.click();
                  onPlay(t.id);
                }}
              >
                <div className="tc-icon">{t.icon}</div>
                <div className="tc-reels">
                  {(['H4', 'W', 'H3'] as const).map((s) => (
                    <span key={s} className={t.symbols[s].text ? 'text' : ''}>
                      {t.symbols[s].glyph}
                    </span>
                  ))}
                </div>
                <div className="tc-name">{t.name}</div>
                <div className="tc-sub">{t.subtitle}</div>
                <div className="tc-play">PLAY ▶</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="feed">
          <h2 className="section-title">Live feed</h2>
          {feed.length === 0 && <p className="muted">Big wins and jackpots from everyone show up here.</p>}
          <ul>
            {feed.slice(0, 15).map((e) => (
              <FeedItem key={e.id} event={e} />
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

export function feedText(e: FeedEvent): string {
  if (e.kind === 'jackpot') return `won the ${JACKPOTS[e.tier as JackpotTier].label} jackpot`;
  if (e.kind === 'freespins') return 'won big in free spins';
  return `hit a ${e.tier.toUpperCase()} WIN`;
}

function FeedItem({ event: e }: { event: FeedEvent }) {
  return (
    <li className={`feed-item kind-${e.kind}`}>
      <Avatar player={e.player} size={32} />
      <div>
        <div>
          <b>{e.player.name}</b> {feedText(e)}
        </div>
        <div className="feed-meta">
          <span className="feed-amount">+{fmt(e.amount)}</span> · {getTheme(e.theme).name} · {timeAgo(e.createdAt)}
        </div>
      </div>
    </li>
  );
}
