import { randomInt } from 'node:crypto';
import { db } from './db.ts';
import {
  BET_LEVELS,
  DAILY_BONUS,
  DAILY_BONUS_COOLDOWN_MS,
  drawGrid,
  evaluate,
  FREE_SPIN_MULTIPLIER,
  JACKPOT_TIERS,
  JACKPOTS,
  rollJackpot,
  STARTING_BALANCE,
  winTier,
  type JackpotTier,
  type Rng,
} from '../shared/game.ts';
import { THEME_IDS, getTheme } from '../shared/themes.ts';
import type {
  Achievement,
  FeedEvent,
  HallOfFameRow,
  Jackpots,
  LeaderboardRow,
  PlayerState,
  PlayerStats,
  PlayerSummary,
  SpinResponse,
} from '../shared/api.ts';

const cryptoRng: Rng = (n) => randomInt(n);

// Development aid: with SLOT_DEBUG=1, a spin can request a forced outcome
// ("big" | "mega" | "epic" | "freespins" | "mini" | "minor" | "major" | "grand")
// so celebrations can be tested without waiting for luck. Never enable in production.
const DEBUG = process.env.SLOT_DEBUG === '1';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface PlayerRow {
  id: number;
  name: string;
  avatar: string;
  color: string;
  balance: number;
  free_spins: number;
  free_spin_bet: number;
  free_spin_total: number;
  last_bonus_at: number;
  created_at: number;
  last_seen: number;
}

const q = {
  listPlayers: db.prepare('SELECT id, name, avatar, color FROM players ORDER BY last_seen DESC'),
  playerById: db.prepare<[number], PlayerRow>('SELECT * FROM players WHERE id = ?'),
  playerByName: db.prepare<[string], PlayerRow>('SELECT * FROM players WHERE name = ?'),
  insertPlayer: db.prepare(
    `INSERT INTO players (name, avatar, color, balance, last_bonus_at, created_at, last_seen)
     VALUES (@name, @avatar, @color, @balance, @bonus_at, @now, @now)`,
  ),
  updateProfile: db.prepare('UPDATE players SET avatar = ?, color = ? WHERE id = ?'),
  touch: db.prepare('UPDATE players SET last_seen = ? WHERE id = ?'),
  updateAfterSpin: db.prepare(
    `UPDATE players SET balance = @balance, free_spins = @free_spins, free_spin_bet = @free_spin_bet,
       free_spin_total = @free_spin_total, last_seen = @now WHERE id = @id`,
  ),
  claimBonus: db.prepare('UPDATE players SET balance = balance + ?, last_bonus_at = ? WHERE id = ?'),
  jackpots: db.prepare<[number], { tier: JackpotTier; value: number }>(
    'SELECT tier, value FROM jackpots WHERE player_id = ?',
  ),
  setJackpot: db.prepare(
    `INSERT INTO jackpots (player_id, tier, value) VALUES (?, ?, ?)
     ON CONFLICT(player_id, tier) DO UPDATE SET value = excluded.value`,
  ),
  insertSpin: db.prepare(
    `INSERT INTO spins (player_id, theme, bet, paid, win, jackpot_tier, jackpot_win, free_spin, scatters, grid, balance_after, created_at)
     VALUES (@player_id, @theme, @bet, @paid, @win, @jackpot_tier, @jackpot_win, @free_spin, @scatters, @grid, @balance_after, @created_at)`,
  ),
  insertJackpotWin: db.prepare(
    'INSERT INTO jackpot_wins (player_id, tier, amount, theme, created_at) VALUES (?, ?, ?, ?, ?)',
  ),
};

function summary(p: PlayerRow): PlayerSummary {
  return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
}

function getJackpots(playerId: number): Jackpots {
  const values = Object.fromEntries(JACKPOT_TIERS.map((t) => [t, JACKPOTS[t].seed])) as Jackpots;
  for (const row of q.jackpots.all(playerId)) values[row.tier] = row.value;
  return values;
}

function playerState(p: PlayerRow): PlayerState {
  return {
    ...summary(p),
    balance: p.balance,
    freeSpins: p.free_spins,
    freeSpinBet: p.free_spin_bet,
    freeSpinTotal: p.free_spin_total,
    jackpots: getJackpots(p.id),
    bonusAvailableAt: p.last_bonus_at + DAILY_BONUS_COOLDOWN_MS,
  };
}

function requirePlayer(id: number): PlayerRow {
  const p = q.playerById.get(id);
  if (!p) throw new HttpError(401, 'Unknown player');
  return p;
}

// ---------------------------------------------------------------------------
// Players

export function listPlayers(): PlayerSummary[] {
  return q.listPlayers.all() as PlayerSummary[];
}

export function joinPlayer(input: { name?: unknown; avatar?: unknown; color?: unknown }): PlayerState {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 20) throw new HttpError(400, 'Name must be 1–20 characters');
  const avatar = typeof input.avatar === 'string' && input.avatar.length <= 16 ? input.avatar : '😎';
  const color =
    typeof input.color === 'string' && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : '#ff4fa3';

  const existing = q.playerByName.get(name);
  if (existing) return playerState(existing);

  const now = Date.now();
  // Set last_bonus_at so the first daily bonus is ready immediately.
  const bonusAt = now - DAILY_BONUS_COOLDOWN_MS;
  const info = q.insertPlayer.run({ name, avatar, color, balance: STARTING_BALANCE, bonus_at: bonusAt, now });
  return playerState(requirePlayer(Number(info.lastInsertRowid)));
}

export function getPlayerState(id: number): PlayerState {
  const p = requirePlayer(id);
  q.touch.run(Date.now(), id);
  return playerState(p);
}

export function updateProfile(id: number, input: { avatar?: unknown; color?: unknown }): PlayerState {
  const p = requirePlayer(id);
  const avatar = typeof input.avatar === 'string' && input.avatar.length <= 16 ? input.avatar : p.avatar;
  const color = typeof input.color === 'string' && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : p.color;
  q.updateProfile.run(avatar, color, id);
  return playerState(requirePlayer(id));
}

export function claimDailyBonus(id: number): PlayerState {
  const p = requirePlayer(id);
  const now = Date.now();
  if (now < p.last_bonus_at + DAILY_BONUS_COOLDOWN_MS) throw new HttpError(409, 'Bonus not ready yet');
  q.claimBonus.run(DAILY_BONUS, now, id);
  return playerState(requirePlayer(id));
}

// ---------------------------------------------------------------------------
// Spinning

const feed: FeedEvent[] = [];
let feedId = 0;
type FeedListener = (event: FeedEvent) => void;
const feedListeners = new Set<FeedListener>();

export function onFeed(listener: FeedListener): () => void {
  feedListeners.add(listener);
  return () => feedListeners.delete(listener);
}

export function getFeed(): FeedEvent[] {
  return [...feed].reverse();
}

function publish(event: Omit<FeedEvent, 'id' | 'createdAt'>) {
  const full: FeedEvent = { ...event, id: ++feedId, createdAt: Date.now() };
  feed.push(full);
  if (feed.length > 50) feed.shift();
  for (const listener of feedListeners) listener(full);
}

export const spin = db.transaction((playerId: number, input: { bet?: unknown; theme?: unknown; force?: unknown }): SpinResponse => {
  const p = requirePlayer(playerId);
  const theme = typeof input.theme === 'string' && THEME_IDS.includes(input.theme as never) ? input.theme : 'beach';
  const now = Date.now();
  const freeSpin = p.free_spins > 0;

  let bet: number;
  let balance = p.balance;
  let jackpot: SpinResponse['jackpot'] = null;
  const jackpots = getJackpots(playerId);

  if (freeSpin) {
    bet = p.free_spin_bet;
  } else {
    bet = Number(input.bet);
    if (!BET_LEVELS.includes(bet as never)) throw new HttpError(400, 'Invalid bet');
    if (balance < bet) throw new HttpError(409, 'Not enough credits');
    balance -= bet;

    for (const tier of JACKPOT_TIERS) jackpots[tier] += bet * JACKPOTS[tier].contribution;
    const forcedTier = DEBUG && JACKPOT_TIERS.includes(input.force as JackpotTier) ? (input.force as JackpotTier) : null;
    const hit = forcedTier ?? rollJackpot(cryptoRng, bet);
    if (hit) {
      jackpot = { tier: hit, amount: Math.floor(jackpots[hit]) };
      jackpots[hit] = JACKPOTS[hit].seed;
      q.insertJackpotWin.run(playerId, hit, jackpot.amount, theme, now);
    }
    for (const tier of JACKPOT_TIERS) q.setJackpot.run(playerId, tier, jackpots[tier]);
  }

  const multiplier = freeSpin ? FREE_SPIN_MULTIPLIER : 1;
  let grid = drawGrid(cryptoRng);
  let result = evaluate(grid, bet, multiplier);
  if (DEBUG && typeof input.force === 'string' && !JACKPOT_TIERS.includes(input.force as JackpotTier)) {
    for (let i = 0; i < 5_000_000; i++) {
      const ok = input.force === 'freespins' ? result.freeSpinsAwarded > 0 : winTier(result.totalWin, bet) === input.force;
      if (ok) break;
      grid = drawGrid(cryptoRng);
      result = evaluate(grid, bet, multiplier);
    }
  }
  const jackpotWin = jackpot?.amount ?? 0;
  balance += result.totalWin + jackpotWin;

  let freeSpins = p.free_spins - (freeSpin ? 1 : 0) + result.freeSpinsAwarded;
  let freeSpinBet = p.free_spin_bet;
  let freeSpinTotal = p.free_spin_total;
  if (freeSpin) {
    freeSpinTotal += result.totalWin;
  } else if (result.freeSpinsAwarded > 0) {
    freeSpinBet = bet;
    freeSpinTotal = 0;
  }

  q.insertSpin.run({
    player_id: playerId,
    theme,
    bet,
    paid: freeSpin ? 0 : bet,
    win: result.totalWin,
    jackpot_tier: jackpot?.tier ?? null,
    jackpot_win: jackpotWin,
    free_spin: freeSpin ? 1 : 0,
    scatters: result.scatterCount,
    grid: JSON.stringify(grid),
    balance_after: balance,
    created_at: now,
  });
  q.updateAfterSpin.run({
    id: playerId,
    balance,
    free_spins: freeSpins,
    free_spin_bet: freeSpinBet,
    free_spin_total: freeSpinTotal,
    now,
  });

  const tier = winTier(result.totalWin, bet);
  const who = summary(p);
  if (jackpot) publish({ kind: 'jackpot', player: who, theme, amount: jackpot.amount, tier: jackpot.tier });
  if (tier === 'big' || tier === 'mega' || tier === 'epic') {
    publish({ kind: 'win', player: who, theme, amount: result.totalWin, tier });
  }
  if (freeSpin && freeSpins === 0) {
    const roundTier = winTier(freeSpinTotal, bet);
    if (roundTier !== 'none') publish({ kind: 'freespins', player: who, theme, amount: freeSpinTotal, tier: roundTier });
  }

  return {
    grid,
    bet,
    lineWins: result.lineWins,
    scatterCount: result.scatterCount,
    scatterWin: result.scatterWin,
    totalWin: result.totalWin,
    winTier: tier,
    freeSpin,
    freeSpinsAwarded: result.freeSpinsAwarded,
    jackpot,
    player: playerState(requirePlayer(playerId)),
  };
});

// ---------------------------------------------------------------------------
// Stats

interface SpinRow {
  id: number;
  theme: string;
  bet: number;
  paid: number;
  win: number;
  jackpot_tier: JackpotTier | null;
  jackpot_win: number;
  free_spin: number;
  scatters: number;
  balance_after: number;
  created_at: number;
}

export function getStats(id: number): PlayerStats {
  const p = requirePlayer(id);
  const spins = db
    .prepare<[number], SpinRow>(
      `SELECT id, theme, bet, paid, win, jackpot_tier, jackpot_win, free_spin, scatters, balance_after, created_at
       FROM spins WHERE player_id = ? ORDER BY id`,
    )
    .all(id);

  let wagered = 0;
  let won = 0;
  let wins = 0;
  let biggest: SpinRow | null = null;
  let freeSpinRounds = 0;
  let streak = 0;
  let longestStreak = 0;
  const themeCounts: Record<string, number> = {};
  const jackpotWins = Object.fromEntries(JACKPOT_TIERS.map((t) => [t, 0])) as Record<JackpotTier, number>;

  for (const s of spins) {
    const total = s.win + s.jackpot_win;
    wagered += s.paid;
    won += total;
    if (!s.free_spin && s.scatters >= 3) freeSpinRounds++;
    if (s.jackpot_tier) jackpotWins[s.jackpot_tier]++;
    themeCounts[s.theme] = (themeCounts[s.theme] ?? 0) + 1;
    if (!biggest || total > biggest.win + biggest.jackpot_win) biggest = s;
    if (total > 0) {
      wins++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  const favorite = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const biggestWin = biggest ? biggest.win + biggest.jackpot_win : 0;
  const themesPlayed = Object.keys(themeCounts).length;
  const totalJackpots = Object.values(jackpotWins).reduce((a, b) => a + b, 0);
  const maxBet = spins.reduce((m, s) => Math.max(m, s.bet), 0);
  const minBalance = spins.reduce((m, s) => Math.min(m, s.balance_after), Infinity);

  // Sample the balance history down to ~200 points for the chart.
  const step = Math.max(1, Math.ceil(spins.length / 200));
  const balanceHistory = [{ t: p.created_at, balance: STARTING_BALANCE }];
  for (let i = 0; i < spins.length; i += step) balanceHistory.push({ t: spins[i].created_at, balance: spins[i].balance_after });
  if (spins.length) balanceHistory.push({ t: spins[spins.length - 1].created_at, balance: p.balance });

  const achievement = (aid: string, icon: string, name: string, description: string, earned: boolean): Achievement => ({
    id: aid,
    icon,
    name,
    description,
    earned,
  });

  return {
    player: { ...summary(p), balance: p.balance, createdAt: p.created_at },
    totals: {
      spins: spins.length,
      wagered,
      won,
      net: won - wagered,
      returnPct: wagered ? (won / wagered) * 100 : 0,
      winRate: spins.length ? (wins / spins.length) * 100 : 0,
      biggestWin,
      biggestWinTheme: biggest && biggestWin > 0 ? getTheme(biggest.theme).name : null,
      biggestWinAt: biggest && biggestWin > 0 ? biggest.created_at : null,
      freeSpinRounds,
      favoriteTheme: favorite ? getTheme(favorite).name : null,
      themesPlayed,
      longestWinStreak: longestStreak,
      currentWinStreak: streak,
    },
    jackpotWins,
    jackpots: getJackpots(id),
    balanceHistory,
    recentSpins: spins
      .slice(-100)
      .reverse()
      .map((s) => ({
        id: s.id,
        theme: s.theme,
        bet: s.bet,
        paid: s.paid,
        win: s.win + s.jackpot_win,
        jackpotTier: s.jackpot_tier,
        freeSpin: !!s.free_spin,
        createdAt: s.created_at,
      })),
    achievements: [
      achievement('first-spin', '🎰', 'First Spin', 'Spin the reels for the first time', spins.length >= 1),
      achievement('regular', '🔁', 'Regular', 'Play 500 spins', spins.length >= 500),
      achievement('big-winner', '💥', 'Big Winner', 'Win 15× your bet in a single spin', spins.some((s) => s.win >= s.bet * 15)),
      achievement('epic', '🚀', 'Epic!', 'Win 50× your bet in a single spin', spins.some((s) => s.win >= s.bet * 50)),
      achievement('free-spins', '🎁', 'Bonus Round', 'Trigger free spins', freeSpinRounds >= 1),
      achievement('jackpot', '💰', 'Jackpot Hunter', 'Win any jackpot', totalJackpots >= 1),
      achievement('grand', '🏆', 'GRAND Champion', 'Win the GRAND jackpot', jackpotWins.grand >= 1),
      achievement('explorer', '🗺️', 'Theme Explorer', 'Play all 6 themes', themesPlayed >= THEME_IDS.length),
      achievement('high-roller', '💎', 'High Roller', 'Spin at the max bet', maxBet >= BET_LEVELS[BET_LEVELS.length - 1]),
      achievement('streak', '🔥', 'On Fire', 'Win 5 spins in a row', longestStreak >= 5),
      achievement('millionaire', '🤑', 'Millionaire', 'Reach a balance of 1,000,000', spins.some((s) => s.balance_after >= 1_000_000)),
      achievement('comeback', '🦸', 'Comeback Kid', 'Drop below 1,000 credits, then climb back over 10,000', minBalance < 1_000 && p.balance >= 10_000),
    ],
  };
}

export function getLeaderboard(): LeaderboardRow[] {
  return db
    .prepare(
      `SELECT p.id, p.name, p.avatar, p.color, p.balance,
         COUNT(s.id) AS spins,
         COALESCE(SUM(s.paid), 0) AS wagered,
         COALESCE(SUM(s.win + s.jackpot_win), 0) AS won,
         COALESCE(MAX(s.win + s.jackpot_win), 0) AS biggestWin,
         (SELECT COUNT(*) FROM jackpot_wins j WHERE j.player_id = p.id) AS jackpots
       FROM players p LEFT JOIN spins s ON s.player_id = p.id
       GROUP BY p.id`,
    )
    .all() as LeaderboardRow[];
}

export function getHallOfFame(): HallOfFameRow[] {
  const rows = db
    .prepare(
      `SELECT j.id, j.tier, j.amount, j.theme, j.created_at AS createdAt,
         p.id AS pid, p.name, p.avatar, p.color
       FROM jackpot_wins j JOIN players p ON p.id = j.player_id
       ORDER BY j.id DESC LIMIT 200`,
    )
    .all() as (Omit<HallOfFameRow, 'player'> & { pid: number; name: string; avatar: string; color: string })[];
  return rows.map(({ pid, name, avatar, color, ...rest }) => ({ ...rest, player: { id: pid, name, avatar, color } }));
}
