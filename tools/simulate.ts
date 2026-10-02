// Monte Carlo simulator for the slot math.
// Usage: npm run simulate -- [spins]   (default 2,000,000)

import {
  drawGrid,
  evaluate,
  FREE_SPIN_MULTIPLIER,
  JACKPOT_TIERS,
  JACKPOTS,
  winTier,
  type Rng,
  type WinTier,
} from '../shared/game.ts';

const spins = Number(process.argv[2] ?? 2_000_000);
const bet = 100;

// Math.random (V8's xorshift128+) is fast and fine for simulation; the server uses crypto RNG.
const rng: Rng = (n) => Math.floor(Math.random() * n);

let wagered = 0;
let baseWon = 0;
let freeWon = 0;
let hits = 0;
let fsTriggers = 0;
let freeSpinsPlayed = 0;
const tiers: Record<WinTier, number> = { none: 0, nice: 0, big: 0, mega: 0, epic: 0 };

for (let i = 0; i < spins; i++) {
  wagered += bet;
  const base = evaluate(drawGrid(rng), bet);
  baseWon += base.totalWin;

  let roundWin = base.totalWin;
  let remaining = base.freeSpinsAwarded;
  if (remaining > 0) fsTriggers++;
  while (remaining > 0) {
    remaining--;
    freeSpinsPlayed++;
    const fs = evaluate(drawGrid(rng), bet, FREE_SPIN_MULTIPLIER);
    freeWon += fs.totalWin;
    roundWin += fs.totalWin;
    remaining += fs.freeSpinsAwarded;
  }

  if (roundWin > 0) hits++;
  tiers[winTier(roundWin, bet)]++;
}

const pct = (n: number) => `${((n / wagered) * 100).toFixed(2)}%`;
const oneIn = (n: number) => (n ? `1 in ${Math.round(spins / n).toLocaleString()}` : 'never');
const jackpotRtp = JACKPOT_TIERS.reduce((sum, t) => sum + JACKPOTS[t].seed / JACKPOTS[t].oddsK, 0);
const contribution = JACKPOT_TIERS.reduce((sum, t) => sum + JACKPOTS[t].contribution, 0);

console.log(`Spins simulated:     ${spins.toLocaleString()} at bet ${bet}`);
console.log(`Base game RTP:       ${pct(baseWon)}`);
console.log(`Free spins RTP:      ${pct(freeWon)}`);
console.log(`Jackpot RTP (seeds): ${(jackpotRtp * 100).toFixed(2)}%  (+ up to ${(contribution * 100).toFixed(1)}% pool growth)`);
console.log(`TOTAL RTP:           ~${(((baseWon + freeWon) / wagered + jackpotRtp + contribution) * 100).toFixed(2)}%`);
console.log(`Hit frequency:       ${oneIn(hits)} (${((hits / spins) * 100).toFixed(1)}%)`);
console.log(`Free spins trigger:  ${oneIn(fsTriggers)}  (avg ${(freeSpinsPlayed / Math.max(fsTriggers, 1)).toFixed(1)} spins)`);
for (const t of ['big', 'mega', 'epic'] as const) console.log(`${t.padEnd(5)} win:           ${oneIn(tiers[t])}`);
for (const t of JACKPOT_TIERS) {
  const odds = Math.round(JACKPOTS[t].oddsK / bet).toLocaleString();
  console.log(`${JACKPOTS[t].label.padEnd(5)} jackpot:       1 in ${odds} at bet ${bet}`);
}
