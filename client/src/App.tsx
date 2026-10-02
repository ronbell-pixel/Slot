import { useCallback, useEffect, useState } from 'react';
import type { FeedEvent, PlayerState } from '../../shared/api.ts';
import type { ThemeId } from '../../shared/themes.ts';
import { api, ApiError, storedPlayerId, storePlayerId } from './api.ts';
import { Login } from './screens/Login.tsx';
import { Lobby, feedText } from './screens/Lobby.tsx';
import { Game } from './screens/Game.tsx';
import { Stats } from './screens/Stats.tsx';
import { Leaderboard } from './screens/Leaderboard.tsx';
import { TopNav, type NavTarget } from './components/TopNav.tsx';
import { Ambient } from './components/Ambient.tsx';
import { Avatar } from './components/common.tsx';
import { useSettings } from './settings.ts';
import { fmt } from './format.ts';

type Screen = { name: 'lobby' } | { name: 'game'; theme: ThemeId } | { name: 'stats'; playerId: number } | { name: 'leaders' };

interface Toast {
  id: number;
  event?: FeedEvent;
  error?: string;
}

export default function App() {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'lobby' });
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settings, updateSettings] = useSettings();

  useEffect(() => {
    if (!storedPlayerId()) return setBooting(false);
    api
      .me()
      .then(setPlayer)
      .catch(() => storePlayerId(null))
      .finally(() => setBooting(false));
  }, []);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
  }, []);

  const onError = useCallback(
    (message: string) => {
      pushToast({ error: message });
      if (message === 'Unknown player') {
        storePlayerId(null);
        setPlayer(null);
      }
    },
    [pushToast],
  );

  // Live feed of everyone's big wins.
  useEffect(() => {
    if (!player) return;
    api.feed().then(setFeed, () => {});
    const source = new EventSource('/api/events');
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as FeedEvent;
      setFeed((f) => [event, ...f].slice(0, 50));
      if (event.player.id !== player.id) pushToast({ event });
    };
    return () => source.close();
  }, [player?.id, pushToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = (p: PlayerState) => {
    storePlayerId(p.id);
    setPlayer(p);
    setScreen({ name: 'lobby' });
  };

  const switchPlayer = () => {
    storePlayerId(null);
    setPlayer(null);
  };

  const nav = (t: NavTarget) => {
    if (!player) return;
    if (t === 'stats') setScreen({ name: 'stats', playerId: player.id });
    else setScreen(t === 'leaders' ? { name: 'leaders' } : { name: 'lobby' });
    // Refresh the balance and jackpots whenever we change pages.
    api.me().then(setPlayer, (e) => e instanceof ApiError && e.status === 401 && switchPlayer());
  };

  if (booting) return <div className="screen boot">🎰</div>;

  const toastLayer = (
    <div className="toasts">
      {toasts.map((t) =>
        t.error ? (
          <div key={t.id} className="toast error">
            ⚠️ {t.error}
          </div>
        ) : (
          <div key={t.id} className={`toast kind-${t.event!.kind}`}>
            <Avatar player={t.event!.player} size={36} />
            <div>
              <b>{t.event!.player.name}</b> {feedText(t.event!)}!
              <div className="toast-amount">+{fmt(t.event!.amount)}</div>
            </div>
          </div>
        ),
      )}
    </div>
  );

  if (!player) {
    return (
      <>
        <Login onJoin={join} />
        {toastLayer}
      </>
    );
  }

  if (screen.name === 'game') {
    return (
      <>
        <Game
          themeId={screen.theme}
          player={player}
          setPlayer={setPlayer}
          settings={settings}
          updateSettings={updateSettings}
          onExit={() => nav('lobby')}
          onError={onError}
        />
        {toastLayer}
      </>
    );
  }

  const active: NavTarget = screen.name === 'stats' ? 'stats' : screen.name === 'leaders' ? 'leaders' : 'lobby';

  return (
    <div className="screen app-shell">
      <Ambient emojis={['✨', '🪙', '⭐', '💎']} enabled={!settings.reduceMotion} />
      <TopNav player={player} active={active} onNav={nav} onSwitch={switchPlayer} />
      <main className="page">
        {screen.name === 'lobby' && (
          <Lobby player={player} setPlayer={setPlayer} feed={feed} onPlay={(theme) => setScreen({ name: 'game', theme })} onError={onError} />
        )}
        {screen.name === 'stats' && (
          <Stats playerId={screen.playerId} myId={player.id} onSelect={(id) => setScreen({ name: 'stats', playerId: id })} />
        )}
        {screen.name === 'leaders' && <Leaderboard myId={player.id} onViewPlayer={(id) => setScreen({ name: 'stats', playerId: id })} />}
      </main>
      <footer className="footer">
        <label>
          <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} /> Reduce motion
        </label>
        <span>Play money only — credits have no cash value.</span>
      </footer>
      {toastLayer}
    </div>
  );
}
