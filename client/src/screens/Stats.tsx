import { useEffect, useState } from 'react';
import type { LeaderboardRow, PlayerStats } from '../../../shared/api.ts';
import { JACKPOTS, JACKPOT_TIERS } from '../../../shared/game.ts';
import { getTheme } from '../../../shared/themes.ts';
import { api } from '../api.ts';
import { Avatar, JackpotMeters } from '../components/common.tsx';
import { BalanceChart } from '../components/BalanceChart.tsx';
import { fmt, timeAgo } from '../format.ts';

export function Stats({ playerId, myId, onSelect }: { playerId: number; myId: number; onSelect: (id: number) => void }) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [players, setPlayers] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setStats(null);
    api.stats(playerId).then(setStats, (e) => setError(e.message));
  }, [playerId]);

  useEffect(() => {
    api.leaderboard().then(setPlayers, () => {});
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <div className="loading">Loading stats…</div>;

  const t = stats.totals;
  const isMe = playerId === myId;
  const cards: [string, string, string?][] = [
    ['Balance', fmt(stats.player.balance)],
    ['Spins', fmt(t.spins)],
    ['Wagered', fmt(t.wagered)],
    ['Won', fmt(t.won)],
    ['Net', `${t.net >= 0 ? '+' : '−'}${fmt(Math.abs(t.net))}`, t.net >= 0 ? 'pos' : 'neg'],
    ['Return', `${t.returnPct.toFixed(1)}%`],
    ['Win rate', `${t.winRate.toFixed(1)}%`],
    ['Biggest win', fmt(t.biggestWin)],
    ['Free spin rounds', fmt(t.freeSpinRounds)],
    ['Longest win streak', fmt(t.longestWinStreak)],
    ['Favorite machine', t.favoriteTheme ?? '—'],
    ['Machines played', `${t.themesPlayed} / 6`],
  ];

  return (
    <div className="stats-page">
      <div className="stats-head">
        <Avatar player={stats.player} size={64} />
        <div>
          <h1>{isMe ? 'My stats' : `${stats.player.name}'s stats`}</h1>
          <p className="muted">Playing since {new Date(stats.player.createdAt).toLocaleDateString()}</p>
        </div>
        {players.length > 1 && (
          <select value={playerId} onChange={(e) => onSelect(Number(e.target.value))} aria-label="View player">
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.avatar} {p.name}
                {p.id === myId ? ' (me)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="stat-cards">
        {cards.map(([label, value, cls]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${cls ?? ''}`}>{value}</div>
          </div>
        ))}
      </div>
      {t.biggestWin > 0 && (
        <p className="muted">
          Biggest win: <b>{fmt(t.biggestWin)}</b> on {t.biggestWinTheme}, {timeAgo(t.biggestWinAt!)}.
        </p>
      )}

      <section className="panel">
        <h2 className="section-title">Balance over time</h2>
        <BalanceChart points={stats.balanceHistory} />
      </section>

      <div className="two-col">
        <section className="panel">
          <h2 className="section-title">Jackpots won</h2>
          <div className="jp-won">
            {[...JACKPOT_TIERS].reverse().map((tier) => (
              <div key={tier} className={`jp-won-item jp-${tier}`}>
                <div className="jp-label">{JACKPOTS[tier].label}</div>
                <div className="jp-count">× {stats.jackpotWins[tier]}</div>
              </div>
            ))}
          </div>
          <h3 className="sub-title">Current jackpot pools</h3>
          <JackpotMeters jackpots={stats.jackpots} compact />
        </section>

        <section className="panel">
          <h2 className="section-title">Achievements</h2>
          <div className="achievements">
            {stats.achievements.map((a) => (
              <div key={a.id} className={`achievement${a.earned ? ' earned' : ''}`} title={a.description}>
                <div className="ach-icon">{a.icon}</div>
                <div>
                  <div className="ach-name">{a.name}</div>
                  <div className="ach-desc">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <h2 className="section-title">Recent spins</h2>
        {stats.recentSpins.length === 0 ? (
          <p className="muted">No spins yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Machine</th>
                  <th className="num">Bet</th>
                  <th className="num">Win</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSpins.slice(0, 40).map((s) => (
                  <tr key={s.id} className={s.win > 0 ? 'won' : ''}>
                    <td>{timeAgo(s.createdAt)}</td>
                    <td>
                      {getTheme(s.theme).icon} {getTheme(s.theme).name}
                    </td>
                    <td className="num">{s.freeSpin ? 'FREE' : fmt(s.bet)}</td>
                    <td className="num">{s.win > 0 ? `+${fmt(s.win)}` : '—'}</td>
                    <td>{s.jackpotTier && <span className={`tag jp-${s.jackpotTier}`}>{JACKPOTS[s.jackpotTier].label}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
