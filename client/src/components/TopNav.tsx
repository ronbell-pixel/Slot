import type { PlayerState } from '../../../shared/api.ts';
import { Avatar, CountUp } from './common.tsx';

export type NavTarget = 'lobby' | 'stats' | 'leaders';

export function TopNav({ player, active, onNav, onSwitch }: { player: PlayerState; active: NavTarget; onNav: (t: NavTarget) => void; onSwitch: () => void }) {
  const tabs: [NavTarget, string][] = [
    ['lobby', '🎰 Play'],
    ['stats', '📊 My Stats'],
    ['leaders', '🏆 Leaderboard'],
  ];
  return (
    <header className="topnav">
      <div className="logo small" onClick={() => onNav('lobby')}>
        <span>SLOT</span>
        <span>PARTY</span>
      </div>
      <nav>
        {tabs.map(([id, label]) => (
          <button key={id} className={`tab${active === id ? ' on' : ''}`} onClick={() => onNav(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="me">
        <Avatar player={player} size={36} />
        <div className="me-text">
          <div className="me-name">{player.name}</div>
          <div className="me-balance">
            <span className="coin-icon" />
            <CountUp value={player.balance} />
          </div>
        </div>
        <button className="btn ghost tiny" onClick={onSwitch} title="Switch player">
          ⇄
        </button>
      </div>
    </header>
  );
}
