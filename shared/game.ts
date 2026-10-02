// Core slot math shared by the server (authoritative spins), the simulator,
// the tests and the client (paylines, paytable display, win tiers).

export const REELS = 5;
export const ROWS = 3;

export type SymbolId = 'L1' | 'L2' | 'L3' | 'L4' | 'H1' | 'H2' | 'H3' | 'H4' | 'W' | 'S';
export const SYMBOLS: SymbolId[] = ['L1', 'L2', 'L3', 'L4', 'H1', 'H2', 'H3', 'H4', 'W', 'S'];
export const WILD: SymbolId = 'W';
export const SCATTER: SymbolId = 'S';

/** Grid is indexed grid[reel][row]; row 0 is the top row. */
export type Grid = SymbolId[][];

/** Returns a uniformly random integer in [0, n). */
export type Rng = (n: number) => number;

export const BET_LEVELS = [20, 40, 100, 200, 500, 1000] as const;
export const LINE_COUNT = 20;
export const STARTING_BALANCE = 10_000;
export const DAILY_BONUS = 5_000;
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Row index (0 = top) the payline passes through on each reel. */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 2, 2, 2, 0],
];

/** Line pays for 3, 4 and 5 of a kind, as multiples of the line bet (bet / 20). */
export const PAYTABLE: Record<Exclude<SymbolId, 'S'>, [number, number, number]> = {
  L1: [5, 15, 50],
  L2: [5, 15, 65],
  L3: [7, 20, 100],
  L4: [8, 25, 130],
  H1: [20, 65, 260],
  H2: [25, 80, 400],
  H3: [40, 150, 800],
  H4: [65, 325, 1600],
  W: [100, 500, 5000],
};

/** Scatter pays anywhere, as multiples of the total bet, plus free spins. */
export const SCATTER_PAYS: Record<number, number> = { 3: 3, 4: 10, 5: 50 };
export const FREE_SPINS_AWARD: Record<number, number> = { 3: 10, 4: 15, 5: 25 };
export const FREE_SPIN_MULTIPLIER = 2;

/** Relative weight of each symbol on each reel (cells are drawn independently). */
export const REEL_WEIGHTS: Record<SymbolId, number>[] = [
  { L1: 26, L2: 25, L3: 23, L4: 22, H1: 13, H2: 11, H3: 8, H4: 6, W: 0, S: 5 },
  { L1: 26, L2: 25, L3: 23, L4: 22, H1: 13, H2: 11, H3: 8, H4: 6, W: 8, S: 5 },
  { L1: 26, L2: 25, L3: 23, L4: 22, H1: 13, H2: 11, H3: 8, H4: 6, W: 9, S: 5 },
  { L1: 26, L2: 25, L3: 23, L4: 22, H1: 13, H2: 11, H3: 8, H4: 6, W: 8, S: 5 },
  { L1: 26, L2: 25, L3: 23, L4: 22, H1: 13, H2: 11, H3: 8, H4: 6, W: 7, S: 5 },
];

const WEIGHT_TABLES = REEL_WEIGHTS.map((weights) => {
  const entries = SYMBOLS.filter((s) => weights[s] > 0).map((s) => [s, weights[s]] as const);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  return { entries, total };
});

export function drawSymbol(rng: Rng, reel: number): SymbolId {
  const { entries, total } = WEIGHT_TABLES[reel];
  let roll = rng(total);
  for (const [symbol, weight] of entries) {
    if (roll < weight) return symbol;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

export function drawGrid(rng: Rng): Grid {
  return Array.from({ length: REELS }, (_, reel) =>
    Array.from({ length: ROWS }, () => drawSymbol(rng, reel)),
  );
}

export interface LineWin {
  line: number; // index into PAYLINES
  symbol: SymbolId;
  count: number; // 3..5, matched from the leftmost reel
  win: number; // credits, multiplier already applied
}

export interface EvalResult {
  lineWins: LineWin[];
  scatterCount: number;
  scatterWin: number;
  freeSpinsAwarded: number;
  totalWin: number;
}

function linePay(symbol: SymbolId, count: number): number {
  if (count < 3 || symbol === SCATTER) return 0;
  return PAYTABLE[symbol as keyof typeof PAYTABLE][count - 3];
}

/** Evaluates a grid. `multiplier` is applied to every win (free spins use 2x). */
export function evaluate(grid: Grid, bet: number, multiplier = 1): EvalResult {
  const lineBet = bet / LINE_COUNT;
  const lineWins: LineWin[] = [];

  PAYLINES.forEach((rows, line) => {
    const symbols = rows.map((row, reel) => grid[reel][row]);

    let wildRun = 0;
    while (wildRun < REELS && symbols[wildRun] === WILD) wildRun++;

    const target = symbols.find((s) => s !== WILD) ?? WILD;
    let run = 0;
    if (target !== SCATTER) {
      while (run < REELS && (symbols[run] === target || symbols[run] === WILD)) run++;
    }

    const targetPay = linePay(target, run);
    const wildPay = linePay(WILD, wildRun);
    const [symbol, count, pay] =
      wildPay > targetPay ? [WILD, wildRun, wildPay] : [target, run, targetPay];
    if (pay > 0) lineWins.push({ line, symbol, count, win: pay * lineBet * multiplier });
  });

  const scatterCount = grid.flat().filter((s) => s === SCATTER).length;
  const scatterKey = Math.min(scatterCount, 5);
  const scatterWin = (SCATTER_PAYS[scatterKey] ?? 0) * bet * multiplier;
  const freeSpinsAwarded = FREE_SPINS_AWARD[scatterKey] ?? 0;

  const totalWin = Math.round(lineWins.reduce((sum, w) => sum + w.win, 0) + scatterWin);
  return { lineWins, scatterCount, scatterWin, freeSpinsAwarded, totalWin };
}

// ---------------------------------------------------------------------------
// Progressive jackpots — one set of four pools per player.

export type JackpotTier = 'mini' | 'minor' | 'major' | 'grand';
export const JACKPOT_TIERS: JackpotTier[] = ['mini', 'minor', 'major', 'grand'];

export const JACKPOTS: Record<
  JackpotTier,
  { label: string; seed: number; contribution: number; oddsK: number }
> = {
  // Chance per paid spin = bet / oddsK, so bigger bets give proportionally better odds.
  // e.g. GRAND at the max bet of 1,000 is 1 in 25,000 spins.
  mini: { label: 'MINI', seed: 1_000, contribution: 0.004, oddsK: 60_000 },
  minor: { label: 'MINOR', seed: 10_000, contribution: 0.003, oddsK: 600_000 },
  major: { label: 'MAJOR', seed: 100_000, contribution: 0.002, oddsK: 5_000_000 },
  grand: { label: 'GRAND', seed: 1_000_000, contribution: 0.001, oddsK: 25_000_000 },
};

/** Rolls for a jackpot on a paid spin. Returns the highest tier hit, if any. */
export function rollJackpot(rng: Rng, bet: number): JackpotTier | null {
  const scale = 1_000_000_000;
  for (const tier of [...JACKPOT_TIERS].reverse()) {
    const threshold = Math.round((bet / JACKPOTS[tier].oddsK) * scale);
    if (rng(scale) < threshold) return tier;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Celebration tiers, by win as a multiple of the bet.

export type WinTier = 'none' | 'nice' | 'big' | 'mega' | 'epic';

export function winTier(win: number, bet: number): WinTier {
  if (win <= 0) return 'none';
  const x = win / bet;
  if (x >= 50) return 'epic';
  if (x >= 15) return 'mega';
  if (x >= 5) return 'big';
  return 'nice';
}
