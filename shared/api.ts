// Request/response shapes shared by the server and the client.

import type { Grid, JackpotTier, LineWin, WinTier } from './game.ts';

export interface PlayerSummary {
  id: number;
  name: string;
  avatar: string;
  color: string;
}

export type Jackpots = Record<JackpotTier, number>;

export interface PlayerState extends PlayerSummary {
  balance: number;
  freeSpins: number;
  freeSpinBet: number;
  freeSpinTotal: number;
  jackpots: Jackpots;
  bonusAvailableAt: number; // epoch ms; <= now means claimable
}

export interface SpinResponse {
  grid: Grid;
  bet: number;
  lineWins: LineWin[];
  scatterCount: number;
  scatterWin: number;
  totalWin: number; // line + scatter win, not including any jackpot
  winTier: WinTier;
  freeSpin: boolean;
  freeSpinsAwarded: number;
  jackpot: { tier: JackpotTier; amount: number } | null;
  player: PlayerState;
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}

export interface PlayerStats {
  player: PlayerSummary & { balance: number; createdAt: number };
  totals: {
    spins: number;
    wagered: number;
    won: number; // includes jackpots
    net: number;
    returnPct: number;
    winRate: number;
    biggestWin: number;
    biggestWinTheme: string | null;
    biggestWinAt: number | null;
    freeSpinRounds: number;
    favoriteTheme: string | null;
    themesPlayed: number;
    longestWinStreak: number;
    currentWinStreak: number;
  };
  jackpotWins: Record<JackpotTier, number>;
  jackpots: Jackpots;
  balanceHistory: { t: number; balance: number }[];
  recentSpins: {
    id: number;
    theme: string;
    bet: number;
    paid: number;
    win: number;
    jackpotTier: JackpotTier | null;
    freeSpin: boolean;
    createdAt: number;
  }[];
  achievements: Achievement[];
}

export interface LeaderboardRow extends PlayerSummary {
  balance: number;
  spins: number;
  wagered: number;
  won: number;
  biggestWin: number;
  jackpots: number;
}

export interface HallOfFameRow {
  id: number;
  player: PlayerSummary;
  tier: JackpotTier;
  amount: number;
  theme: string;
  createdAt: number;
}

export interface FeedEvent {
  id: number;
  kind: 'win' | 'jackpot' | 'freespins';
  player: PlayerSummary;
  theme: string;
  amount: number;
  tier: WinTier | JackpotTier;
  createdAt: number;
}
