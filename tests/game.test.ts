import { describe, expect, it } from 'vitest';
import { evaluate, rollJackpot, winTier, PAYTABLE, type Grid, type SymbolId } from '../shared/game.ts';

/** Builds a grid from 3 row strings of 5 space-separated symbols (top row first). */
function grid(...rows: string[]): Grid {
  const cells = rows.map((r) => r.split(/\s+/) as SymbolId[]);
  return Array.from({ length: 5 }, (_, reel) => cells.map((row) => row[reel]));
}

describe('evaluate', () => {
  it('pays 5 of a kind on the middle line', () => {
    const g = grid('L1 L2 L3 L4 H1', 'H4 H4 H4 H4 H4', 'L2 L3 L4 H1 L1');
    const r = evaluate(g, 100);
    const middle = r.lineWins.find((w) => w.line === 0)!;
    expect(middle).toMatchObject({ symbol: 'H4', count: 5, win: PAYTABLE.H4[2] * 5 });
  });

  it('substitutes wilds and stops at the first non-matching symbol', () => {
    const g = grid('L1 L2 L3 L4 H1', 'H2 W H2 L1 H2', 'L2 L3 L4 H1 L1');
    const middle = evaluate(g, 20).lineWins.find((w) => w.line === 0)!;
    expect(middle).toMatchObject({ symbol: 'H2', count: 3, win: PAYTABLE.H2[0] });
  });

  it('pays a wild line when it beats the substituted symbol', () => {
    const g = grid('L1 L2 L3 L4 H1', 'W W W L1 H2', 'L2 L3 L4 H1 L1');
    const middle = evaluate(g, 20).lineWins.find((w) => w.line === 0)!;
    expect(middle).toMatchObject({ symbol: 'W', count: 3, win: PAYTABLE.W[0] });
  });

  it('does not pay fewer than 3 matching symbols', () => {
    const g = grid('L1 L2 L3 L4 H1', 'H1 H1 L2 H1 H1', 'L2 L3 L4 H1 L1');
    expect(evaluate(g, 20).lineWins.find((w) => w.line === 0)).toBeUndefined();
  });

  it('pays scatters anywhere and awards free spins', () => {
    const g = grid('S L2 L3 L4 H1', 'L1 H2 S H3 L2', 'L2 L3 L4 H1 S');
    const r = evaluate(g, 100);
    expect(r.scatterCount).toBe(3);
    expect(r.scatterWin).toBe(300);
    expect(r.freeSpinsAwarded).toBe(10);
  });

  it('applies the free spin multiplier', () => {
    const g = grid('L1 L2 L3 L4 H1', 'H4 H4 H4 L1 L2', 'L2 L3 L4 H1 L1');
    const single = evaluate(g, 20).totalWin;
    expect(evaluate(g, 20, 2).totalWin).toBe(single * 2);
  });
});

describe('rollJackpot', () => {
  it('returns the highest tier hit', () => {
    expect(rollJackpot(() => 0, 100)).toBe('grand');
    expect(rollJackpot((n) => n - 1, 100)).toBeNull();
  });
});

describe('winTier', () => {
  it('classifies wins by bet multiple', () => {
    expect(winTier(0, 100)).toBe('none');
    expect(winTier(100, 100)).toBe('nice');
    expect(winTier(500, 100)).toBe('big');
    expect(winTier(1500, 100)).toBe('mega');
    expect(winTier(5000, 100)).toBe('epic');
  });
});
