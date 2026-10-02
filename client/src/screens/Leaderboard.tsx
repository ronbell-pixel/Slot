import { useEffect, useState } from 'react';
import type { HallOfFameRow, LeaderboardRow } from '../../../shared/api.ts';
import { JACKPOTS } from '../../../shared/game.ts';
import { getTheme } from '../../../shared/themes.ts';
import { api } from '../api.ts';
import { Avatar } from '../components/common.tsx';
import { fmt, timeAgo } from '../format.ts';

type Tab = 'balance' | 'biggestWin' | 'won' | 'spins' | 'jackpots' | 'fame';

const TABS: [Tab, string][] = [
  ['balance', '💰 Richest'],
  ['biggestWin', '💥 Biggest win'],
  ['won', '🪙 Most won'],
  ['spins', '🎰 Most spins'],
  ['jackpots', '🏆 Jackpots'],
  ['fame', '⭐ Hall of Fame'],
];

export function Leaderboard({ myId, onViewPlayer }: { myId: number; onViewPlayer: (id: number) => void }) {
  const [tab, setTab] = useState<Tab>('balance');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [fame, setFame] = useState<HallOfFameRow[] | null>(null);

  useEffect(() => {
    api.leaderboard().then(setRows, () => setRows([]));
    api.hallOfFame().then(setFame, () => setFame([]));
  }, []);

  const sorted = tab === 'fame' || !rows ? [] : [...rows].sort((a, b) => b[tab] - a[tab]);

  return (
    <div className="leaders-page">
      <h1>Leaderboard</h1>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab !== 'fame' && (
        <ol className="board">
          {!rows && <li className="loading">Loading…</li>}
          {sorted.map((r, i) => (
            <li key={r.id} className={`board-row${r.id === myId ? ' me' : ''} place-${i + 1}`} onClick={() => onViewPlayer(r.id)}>
              <span className="place">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <Avatar player={r} size={44} />
              <span className="board-name">{r.name}</span>
              <span className="board-value">{fmt(r[tab as Exclude<Tab, 'fame'>])}</span>
            </li>
          ))}
        </ol>
      )}

      {tab === 'fame' && (
        <div className="fame">
          {fame && fame.length === 0 && <p className="muted">No jackpots yet. Who'll be first?</p>}
          {fame?.map((f) => (
            <div key={f.id} className={`fame-card jp-${f.tier}`}>
              <div className="fame-tier">{JACKPOTS[f.tier].label}</div>
              <div className="fame-amount">{fmt(f.amount)}</div>
              <div className="fame-who">
                <Avatar player={f.player} size={28} /> {f.player.name}
              </div>
              <div className="fame-meta">
                {getTheme(f.theme).icon} {getTheme(f.theme).name} · {timeAgo(f.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
