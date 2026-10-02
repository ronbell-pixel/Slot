import { useEffect, useState, type CSSProperties } from 'react';
import type { PlayerState, PlayerSummary } from '../../../shared/api.ts';
import { api } from '../api.ts';
import { Avatar } from '../components/common.tsx';
import { Ambient } from '../components/Ambient.tsx';
import { sfx } from '../engine/sound.ts';

export const AVATARS = ['😎', '🤠', '🦄', '🐯', '🦊', '🐼', '🐸', '👽', '🤖', '🦖', '🐙', '🦁', '🐵', '🧙', '🥷', '👑', '🌵', '🍀', '🔥', '⚡', '🎸', '🏈', '⛳', '🎯'];
export const COLORS = ['#ff4fa3', '#ff6b35', '#ffd23f', '#3ddc84', '#00d4c8', '#29b6ff', '#7c4dff', '#c061ff', '#ff5252', '#a0a0b8'];

export function Login({ onJoin }: { onJoin: (p: PlayerState) => void }) {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .players()
      .then((list) => {
        setPlayers(list);
        if (list.length === 0) setCreating(true);
      })
      .catch(() => {
        setPlayers([]);
        setCreating(true);
      });
  }, []);

  const join = async (n: string, a: string, c: string) => {
    sfx.click();
    setBusy(true);
    setError('');
    try {
      onJoin(await api.join(n, a, c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
      setBusy(false);
    }
  };

  const nameTaken = players?.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  return (
    <div className="screen login">
      <Ambient emojis={['🎰', '💰', '⭐', '🍒', '💎', '🪙']} enabled />
      <div className="login-card">
        <h1 className="logo">
          <span>SLOT</span>
          <span>PARTY</span>
        </h1>
        <p className="tagline">Spin with friends. Chase the GRAND. 🎰</p>

        {!creating && players && (
          <>
            <h2>Who's playing?</h2>
            <div className="player-list">
              {players.map((p) => (
                <button key={p.id} className="player-pick" style={{ '--c': p.color } as CSSProperties} onClick={() => join(p.name, p.avatar, p.color)} disabled={busy}>
                  <Avatar player={p} size={56} />
                  <span>{p.name}</span>
                </button>
              ))}
              <button className="player-pick new" onClick={() => setCreating(true)}>
                <span className="avatar plus">＋</span>
                <span>New player</span>
              </button>
            </div>
          </>
        )}

        {creating && (
          <form
            className="new-player"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void join(name, avatar, color);
            }}
          >
            <h2>What's your name?</h2>
            <div className="name-row">
              <Avatar player={{ avatar, color }} size={64} />
              <input autoFocus maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" />
            </div>
            {nameTaken && <p className="hint">That name exists — you'll continue as them.</p>}
            <div className="picker-label">Pick an avatar</div>
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button type="button" key={a} className={a === avatar ? 'on' : ''} onClick={() => setAvatar(a)}>
                  {a}
                </button>
              ))}
            </div>
            <div className="picker-label">Pick a color</div>
            <div className="color-row">
              {COLORS.map((c) => (
                <button type="button" key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
            <button className="btn primary big" disabled={!name.trim() || busy}>
              Let's play! 🎰
            </button>
            {players && players.length > 0 && (
              <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
                ← Back to player list
              </button>
            )}
          </form>
        )}
        {error && <p className="error">{error}</p>}
        <p className="fineprint">Play money only. Credits have no cash value.</p>
      </div>
    </div>
  );
}
