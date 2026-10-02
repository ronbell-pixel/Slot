import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BET_LEVELS, drawGrid, JACKPOTS, JACKPOT_TIERS, LINE_COUNT, PAYTABLE, SCATTER, SCATTER_PAYS, FREE_SPINS_AWARD, type SymbolId } from '../../../shared/game.ts';
import type { PlayerState, SpinResponse } from '../../../shared/api.ts';
import { getTheme, type ThemeId } from '../../../shared/themes.ts';
import { api } from '../api.ts';
import { ReelEngine } from '../engine/reels.ts';
import { fx } from '../engine/particles.ts';
import { isMuted, setMuted, sfx } from '../engine/sound.ts';
import { Celebration, type CelebrationProps } from '../components/Celebration.tsx';
import { JackpotWheel } from '../components/JackpotWheel.tsx';
import { Ambient } from '../components/Ambient.tsx';
import { CountUp, JackpotMeters } from '../components/common.tsx';
import { fmt } from '../format.ts';
import type { Settings } from '../settings.ts';

type Overlay =
  | { type: 'celebration'; props: Omit<CelebrationProps, 'onDone' | 'theme' | 'reduceMotion'> }
  | { type: 'wheel'; tier: NonNullable<SpinResponse['jackpot']>['tier']; jackpots: PlayerState['jackpots'] }
  | null;

const AUTOPLAY_OPTIONS = [0, 10, 25, 50, 100];
const BET_KEY = 'slot-party.bet';

interface Props {
  themeId: ThemeId;
  player: PlayerState;
  setPlayer: (p: PlayerState) => void;
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  onExit: () => void;
  onError: (message: string) => void;
}

export function Game({ themeId, player, setPlayer, settings, updateSettings, onExit, onError }: Props) {
  const theme = getTheme(themeId);
  const reelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReelEngine | null>(null);
  const [bet, setBet] = useState<number>(() => {
    const saved = Number(localStorage.getItem(BET_KEY));
    return (BET_LEVELS as readonly number[]).includes(saved) ? saved : 100;
  });
  const [spinning, setSpinning] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(player.balance);
  const [winShown, setWinShown] = useState(0);
  const [message, setMessage] = useState('Good luck!');
  const [autoplay, setAutoplay] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [shake, setShake] = useState('');
  const overlayDone = useRef<(() => void) | null>(null);
  const playerRef = useRef(player);
  const autoplayRef = useRef(0);
  const stateRef = useRef({ bet, settings });
  stateRef.current = { bet, settings };
  playerRef.current = player;
  autoplayRef.current = autoplay;

  const inFreeSpins = player.freeSpins > 0;

  useEffect(() => {
    if (!reelsRef.current) return;
    const engine = new ReelEngine(reelsRef.current, theme, drawGrid((n) => Math.floor(Math.random() * n)));
    engineRef.current = engine;
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  useEffect(() => {
    try {
      localStorage.setItem(BET_KEY, String(bet));
    } catch {
      // ignore
    }
  }, [bet]);

  useEffect(() => {
    if (!spinning) setDisplayBalance(player.balance);
  }, [player.balance, spinning]);

  const showOverlay = useCallback((o: NonNullable<Overlay>) => {
    return new Promise<void>((resolve) => {
      overlayDone.current = resolve;
      setOverlay(o);
    });
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    const done = overlayDone.current;
    overlayDone.current = null;
    done?.();
  }, []);

  const doShake = (level: string) => {
    if (stateRef.current.settings.reduceMotion) return;
    setShake(level);
    setTimeout(() => setShake(''), 700);
  };

  const spin = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || spinning) return;
    const current = playerRef.current;
    const { bet, settings } = stateRef.current;
    const freeSpin = current.freeSpins > 0;
    if (!freeSpin && current.balance < bet) {
      setMessage('Not enough credits — lower your bet or grab the daily bonus!');
      setAutoplay(0);
      return;
    }

    setSpinning(true);
    setWinShown(0);
    setMessage(freeSpin ? `Free spin ${current.freeSpins} left…` : 'Spinning…');
    if (!freeSpin) setDisplayBalance(current.balance - bet);
    sfx.spin();
    engine.start(settings.turbo);

    let res: SpinResponse;
    try {
      const minSpin = new Promise((r) => setTimeout(r, settings.turbo ? 250 : 650));
      [res] = await Promise.all([api.spin(bet, themeId), minSpin]);
    } catch (err) {
      await engine.land(drawGrid((n) => Math.floor(Math.random() * n)), { turbo: true });
      setSpinning(false);
      setAutoplay(0);
      setDisplayBalance(current.balance);
      onError(err instanceof Error ? err.message : 'Spin failed');
      return;
    }

    let scatterIndex = 0;
    await engine.land(res.grid, {
      turbo: settings.turbo,
      onReelStop: (reel, symbols) => {
        sfx.reelStop(reel);
        symbols.forEach((s) => s === SCATTER && sfx.scatter(scatterIndex++));
      },
      onAnticipate: () => sfx.anticipation(),
    });

    const balanceBeforeWin = res.player.balance - res.totalWin - (res.jackpot?.amount ?? 0);
    let stopAutoplay = false;

    if (res.totalWin > 0) {
      engine.showWins(res.grid, res.lineWins, res.scatterCount);
      setWinShown(res.totalWin);
      setMessage(res.lineWins.length ? `${res.lineWins.length} winning line${res.lineWins.length > 1 ? 's' : ''}${res.freeSpin ? ' (2×)' : ''}!` : 'Scatter win!');
      const rect = reelsRef.current!.getBoundingClientRect();
      if (res.winTier === 'nice') {
        sfx.smallWin(theme.scale);
        fx.coinFountain(rect.left + rect.width / 2, rect.bottom, 14, 0.7);
        setDisplayBalance(balanceBeforeWin + res.totalWin);
      } else {
        await new Promise((r) => setTimeout(r, 500));
        doShake(res.winTier);
        await showOverlay({ type: 'celebration', props: { kind: res.winTier as 'big' | 'mega' | 'epic', amount: res.totalWin } });
        setDisplayBalance(balanceBeforeWin + res.totalWin);
        stopAutoplay = true;
      }
    } else {
      setMessage(res.freeSpin ? 'No win this time' : 'Spin again!');
      setDisplayBalance(balanceBeforeWin);
    }

    if (res.freeSpinsAwarded > 0) {
      await new Promise((r) => setTimeout(r, 600));
      await showOverlay({ type: 'celebration', props: { kind: 'freespins-intro', amount: 0, freeSpins: res.freeSpinsAwarded } });
    }

    if (res.jackpot) {
      const jp = res.jackpot;
      await new Promise((r) => setTimeout(r, 500));
      await showOverlay({ type: 'wheel', tier: jp.tier, jackpots: { ...res.player.jackpots, [jp.tier]: jp.amount } });
      doShake('epic');
      await showOverlay({ type: 'celebration', props: { kind: 'jackpot', amount: jp.amount, jackpotTier: jp.tier } });
      stopAutoplay = true;
    }

    if (res.freeSpin && res.player.freeSpins === 0) {
      await new Promise((r) => setTimeout(r, 400));
      await showOverlay({ type: 'celebration', props: { kind: 'freespins-total', amount: res.player.freeSpinTotal } });
    }

    setDisplayBalance(res.player.balance);
    setPlayer(res.player);
    playerRef.current = res.player;
    setSpinning(false);

    if (stopAutoplay && autoplayRef.current > 0) setAutoplay(0);
  }, [spinning, themeId, theme, onError, setPlayer, showOverlay]);

  // Free spins play automatically; autoplay keeps spinning while it has spins left.
  useEffect(() => {
    if (spinning || overlay) return;
    if (player.freeSpins > 0) {
      const t = setTimeout(spin, 900);
      return () => clearTimeout(t);
    }
    if (autoplay > 0) {
      const t = setTimeout(() => {
        setAutoplay((a) => a - 1);
        void spin();
      }, settings.turbo ? 250 : 600);
      return () => clearTimeout(t);
    }
  }, [spinning, overlay, autoplay, player.freeSpins, spin, settings.turbo]);

  // Space bar spins.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      if (overlay?.type === 'celebration') closeOverlay();
      else if (!overlay) void spin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spin, overlay, closeOverlay]);

  const changeBet = (dir: number) => {
    sfx.click();
    const i = BET_LEVELS.indexOf(bet as (typeof BET_LEVELS)[number]);
    setBet(BET_LEVELS[Math.max(0, Math.min(BET_LEVELS.length - 1, i + dir))]);
  };

  const cycleAutoplay = () => {
    sfx.click();
    const i = AUTOPLAY_OPTIONS.indexOf(autoplay);
    setAutoplay(AUTOPLAY_OPTIONS[(i + 1) % AUTOPLAY_OPTIONS.length] ?? 0);
  };

  const style = {
    '--bg': theme.colors.bg,
    '--accent': theme.colors.accent,
    '--accent2': theme.colors.accent2,
    '--frame': theme.colors.frame,
    '--glow': theme.colors.glow,
    '--tile': theme.colors.tile,
  } as CSSProperties;

  return (
    <div className={`screen game theme-${theme.id}${shake ? ` shake-${shake}` : ''}`} style={style}>
      <Ambient emojis={theme.ambient} enabled={!settings.reduceMotion} />

      <header className="game-top">
        <button className="btn ghost" onClick={onExit} disabled={spinning || inFreeSpins}>
          ← Lobby
        </button>
        <div className="balance-pill">
          <span className="coin-icon" />
          <CountUp value={displayBalance} duration={700} />
        </div>
        <div className="top-actions">
          <button className="btn icon" title="Paytable" onClick={() => setShowPaytable(true)}>
            ℹ️
          </button>
          <button
            className="btn icon"
            title={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <JackpotMeters jackpots={player.jackpots} compact />

      <div className="machine-wrap">
        <div className={`machine${inFreeSpins ? ' free-spins' : ''}`}>
          <div className="marquee">
            <div className="bulbs" />
            <h1 className="machine-title">{theme.name}</h1>
            {inFreeSpins && (
              <div className="fs-banner">
                FREE SPINS · {player.freeSpins} left · 2× · won {fmt(player.freeSpinTotal)}
              </div>
            )}
          </div>
          <div className="reels" ref={reelsRef} />
        </div>
      </div>

      <div className="controls">
        <div className="win-meter">
          <div className="label">{winShown > 0 ? 'WIN' : message}</div>
          {winShown > 0 && <CountUp className="value" value={winShown} duration={900} />}
        </div>
        <div className="control-row">
          <div className="bet-box">
            <button className="btn round" onClick={() => changeBet(-1)} disabled={spinning || inFreeSpins || bet === BET_LEVELS[0]}>
              −
            </button>
            <div className="bet-value">
              <div className="label">BET</div>
              <div className="value">{fmt(inFreeSpins ? player.freeSpinBet : bet)}</div>
            </div>
            <button className="btn round" onClick={() => changeBet(1)} disabled={spinning || inFreeSpins || bet === BET_LEVELS[BET_LEVELS.length - 1]}>
              +
            </button>
          </div>

          <button className={`spin-btn${spinning ? ' spinning' : ''}`} onClick={() => void spin()} disabled={spinning || inFreeSpins || !!overlay} aria-label="Spin">
            <span>{inFreeSpins ? 'FREE' : 'SPIN'}</span>
          </button>

          <div className="toggles">
            <button className={`btn pill${autoplay > 0 ? ' on' : ''}`} onClick={cycleAutoplay} disabled={inFreeSpins}>
              AUTO {autoplay > 0 ? autoplay : ''}
            </button>
            <button className={`btn pill${settings.turbo ? ' on' : ''}`} onClick={() => updateSettings({ turbo: !settings.turbo })}>
              ⚡ TURBO
            </button>
          </div>
        </div>
      </div>

      {overlay?.type === 'celebration' && (
        <Celebration {...overlay.props} theme={theme} reduceMotion={settings.reduceMotion} onDone={closeOverlay} />
      )}
      {overlay?.type === 'wheel' && <JackpotWheel tier={overlay.tier} jackpots={overlay.jackpots} onDone={closeOverlay} />}
      {showPaytable && <Paytable themeId={themeId} bet={bet} onClose={() => setShowPaytable(false)} />}
    </div>
  );
}

function Paytable({ themeId, bet, onClose }: { themeId: ThemeId; bet: number; onClose: () => void }) {
  const theme = getTheme(themeId);
  const lineBet = bet / LINE_COUNT;
  const order: SymbolId[] = ['W', 'H4', 'H3', 'H2', 'H1', 'L4', 'L3', 'L2', 'L1'];
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card paytable" onClick={(e) => e.stopPropagation()}>
        <button className="btn icon close" onClick={onClose}>
          ✕
        </button>
        <h2>Paytable</h2>
        <p className="muted">
          Pays at your current bet of {fmt(bet)} across {LINE_COUNT} lines, left to right.
        </p>
        <div className="pay-grid">
          {order.map((id) => {
            const s = theme.symbols[id];
            const pays = PAYTABLE[id as keyof typeof PAYTABLE];
            return (
              <div key={id} className="pay-row">
                <div className={`pay-sym${s.text ? ' text' : ''}${s.text && /[♥♦]/.test(s.glyph) ? ' red' : ''}`}>{s.glyph}</div>
                <div className="pay-name">{s.label}</div>
                <div className="pay-vals">
                  {[5, 4, 3].map((n) => (
                    <span key={n}>
                      <b>{n}×</b> {fmt(pays[n - 3] * lineBet)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pay-row special">
          <div className="pay-sym">{theme.symbols.W.glyph}</div>
          <div className="pay-name">
            <b>WILD</b> substitutes for every symbol except the bonus.
          </div>
        </div>
        <div className="pay-row special">
          <div className="pay-sym">{theme.symbols.S.glyph}</div>
          <div className="pay-name">
            <b>BONUS</b> pays anywhere: 3 = {fmt(SCATTER_PAYS[3] * bet)}, 4 = {fmt(SCATTER_PAYS[4] * bet)}, 5 = {fmt(SCATTER_PAYS[5] * bet)}, plus {FREE_SPINS_AWARD[3]} / {FREE_SPINS_AWARD[4]} / {FREE_SPINS_AWARD[5]} free spins at 2×.
          </div>
        </div>
        <h3>Your jackpots</h3>
        <p className="muted">Any paid spin can trigger the Jackpot Wheel. Bigger bets mean better odds.</p>
        <div className="jp-odds">
          {[...JACKPOT_TIERS].reverse().map((t) => (
            <div key={t} className={`jp-odd jp-${t}`}>
              <b>{JACKPOTS[t].label}</b> 1 in {fmt(JACKPOTS[t].oddsK / bet)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
