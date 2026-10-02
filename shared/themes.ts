import type { SymbolId } from './game.ts';

export type ThemeId = 'beach' | 'politics' | 'marines' | 'kings' | 'cards' | 'fame';

export type ThemeEffect = 'wave' | 'balloons' | 'jet' | 'crown' | 'cards' | 'flash';

export interface ThemeSymbol {
  glyph: string;
  label: string;
  /** Card-style text symbols (10, J, Q…) render as lettering instead of emoji. */
  text?: boolean;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  subtitle: string;
  icon: string;
  colors: {
    bg: string; // CSS background for the whole screen
    accent: string;
    accent2: string;
    frame: string; // machine frame gradient
    glow: string;
    tile: string; // reel window background
  };
  symbols: Record<SymbolId, ThemeSymbol>;
  ambient: string[]; // floating background particles
  celebrate: string[]; // emoji thrown in during celebrations
  effect: ThemeEffect;
  epicText: string;
  /** Base pitches (Hz) for the synthesized win jingles. */
  scale: number[];
}

const PENTA_MAJOR = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export const THEMES: ThemeDef[] = [
  {
    id: 'beach',
    name: 'Beach Paradise',
    subtitle: 'Sun, surf & sandy jackpots',
    icon: '🏝️',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 0%, #ffd27a 0%, #ff8f6b 28%, #2bb3c9 62%, #0b4f7a 100%)',
      accent: '#ffd23f',
      accent2: '#00d4c8',
      frame: 'linear-gradient(160deg, #ffe08a, #ff9f68 40%, #19a7b8)',
      glow: '#ffe066',
      tile: 'linear-gradient(180deg, #e9fbff 0%, #bff0f5 100%)',
    },
    symbols: {
      L1: { glyph: '🐚', label: 'Seashell' },
      L2: { glyph: '🩴', label: 'Flip-flops' },
      L3: { glyph: '🏐', label: 'Beach ball' },
      L4: { glyph: '🦀', label: 'Crab' },
      H1: { glyph: '🍹', label: 'Cocktail' },
      H2: { glyph: '🏄', label: 'Surfer' },
      H3: { glyph: '🌴', label: 'Palm tree' },
      H4: { glyph: '☀️', label: 'Sun' },
      W: { glyph: '🌊', label: 'Wild wave' },
      S: { glyph: '🏝️', label: 'Island bonus' },
    },
    ambient: ['🫧', '✨', '🐠', '🫧'],
    celebrate: ['🌊', '🐚', '🍹', '☀️', '🐠'],
    effect: 'wave',
    epicText: 'TIDAL WAVE!',
    scale: PENTA_MAJOR,
  },
  {
    id: 'politics',
    name: 'Campaign Trail',
    subtitle: 'Every spin counts!',
    icon: '🗳️',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 0%, #2d4bd8 0%, #1b2a7a 45%, #0d1238 100%)',
      accent: '#ff3b4f',
      accent2: '#ffffff',
      frame: 'linear-gradient(160deg, #ff3b4f, #ffffff 50%, #3157ff)',
      glow: '#ff6b7a',
      tile: 'linear-gradient(180deg, #ffffff 0%, #e4e9ff 100%)',
    },
    symbols: {
      L1: { glyph: '📣', label: 'Megaphone' },
      L2: { glyph: '🎤', label: 'Microphone' },
      L3: { glyph: '📜', label: 'Bill' },
      L4: { glyph: '⚖️', label: 'Justice' },
      H1: { glyph: '🐴', label: 'Donkey' },
      H2: { glyph: '🐘', label: 'Elephant' },
      H3: { glyph: '🏛️', label: 'Capitol' },
      H4: { glyph: '🦅', label: 'Eagle' },
      W: { glyph: '⭐', label: 'Wild star' },
      S: { glyph: '🗳️', label: 'Ballot bonus' },
    },
    ambient: ['⭐', '🎈', '✨', '🎈'],
    celebrate: ['🎈', '🎉', '⭐', '🗳️', '🎊'],
    effect: 'balloons',
    epicText: 'LANDSLIDE!',
    scale: [440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51],
  },
  {
    id: 'marines',
    name: 'Semper Fi',
    subtitle: 'Oorah! Hit the beachhead',
    icon: '🎖️',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 0%, #6b7a3a 0%, #3b4a24 45%, #161d0e 100%)',
      accent: '#d4af37',
      accent2: '#c0392b',
      frame: 'linear-gradient(160deg, #b9a36a, #5c6b32 45%, #2e3a1a)',
      glow: '#f5d76e',
      tile: 'linear-gradient(180deg, #f4efe0 0%, #d9d1b5 100%)',
    },
    symbols: {
      L1: { glyph: '🥾', label: 'Boots' },
      L2: { glyph: '🧭', label: 'Compass' },
      L3: { glyph: '🪖', label: 'Helmet' },
      L4: { glyph: '⚓', label: 'Anchor' },
      H1: { glyph: '🎖️', label: 'Medal' },
      H2: { glyph: '🚁', label: 'Helicopter' },
      H3: { glyph: '🐕', label: 'Devil Dog' },
      H4: { glyph: '🦅', label: 'Eagle' },
      W: { glyph: '⭐', label: 'Wild star' },
      S: { glyph: '🎺', label: 'Bugle bonus' },
    },
    ambient: ['✨', '⭐', '✨'],
    celebrate: ['⭐', '🎖️', '🦅', '✨'],
    effect: 'jet',
    epicText: 'OORAH!',
    scale: [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66],
  },
  {
    id: 'kings',
    name: 'Royal Court',
    subtitle: 'Fortune favors the crown',
    icon: '👑',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 0%, #a01535 0%, #5e0b2a 45%, #22041a 100%)',
      accent: '#ffd700',
      accent2: '#9b59ff',
      frame: 'linear-gradient(160deg, #fff1a8, #d4a017 40%, #7a4c00)',
      glow: '#ffe25a',
      tile: 'linear-gradient(180deg, #fff8e6 0%, #f3dfae 100%)',
    },
    symbols: {
      L1: { glyph: '🍷', label: 'Goblet' },
      L2: { glyph: '🛡️', label: 'Shield' },
      L3: { glyph: '⚔️', label: 'Swords' },
      L4: { glyph: '🏰', label: 'Castle' },
      H1: { glyph: '🦁', label: 'Lion' },
      H2: { glyph: '🐉', label: 'Dragon' },
      H3: { glyph: '👸', label: 'Queen' },
      H4: { glyph: '🤴', label: 'King' },
      W: { glyph: '👑', label: 'Wild crown' },
      S: { glyph: '💎', label: 'Treasure bonus' },
    },
    ambient: ['✨', '💫', '✨'],
    celebrate: ['👑', '💎', '✨', '🪙'],
    effect: 'crown',
    epicText: 'LONG LIVE THE KING!',
    scale: [349.23, 440.0, 523.25, 698.46, 880.0, 1046.5],
  },
  {
    id: 'cards',
    name: 'High Stakes',
    subtitle: 'Ace high, sky high',
    icon: '🃏',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 20%, #1f9d55 0%, #0d5c30 50%, #052a16 100%)',
      accent: '#ffcf40',
      accent2: '#e53935',
      frame: 'linear-gradient(160deg, #f7e7a1, #b8892b 45%, #3b2a0a)',
      glow: '#ffe17a',
      tile: 'linear-gradient(180deg, #ffffff 0%, #eef2ea 100%)',
    },
    symbols: {
      L1: { glyph: '10♠', label: 'Ten', text: true },
      L2: { glyph: 'J♥', label: 'Jack', text: true },
      L3: { glyph: 'Q♣', label: 'Queen', text: true },
      L4: { glyph: 'K♦', label: 'King', text: true },
      H1: { glyph: 'A♠', label: 'Ace', text: true },
      H2: { glyph: '🎲', label: 'Dice' },
      H3: { glyph: '💰', label: 'Money bag' },
      H4: { glyph: '🃏', label: 'Joker' },
      W: { glyph: '🌟', label: 'Wild' },
      S: { glyph: '🎰', label: 'Slot bonus' },
    },
    ambient: ['♠️', '♥️', '♣️', '♦️'],
    celebrate: ['♠️', '♥️', '♣️', '♦️', '💰'],
    effect: 'cards',
    epicText: 'ROYAL FLUSH!',
    scale: [440.0, 523.25, 659.25, 783.99, 880.0, 1046.5],
  },
  {
    id: 'fame',
    name: 'Walk of Fame',
    subtitle: 'Your name in lights',
    icon: '🌟',
    colors: {
      bg: 'radial-gradient(ellipse at 50% 0%, #c2185b 0%, #4a0e4e 45%, #12021a 100%)',
      accent: '#ffd700',
      accent2: '#ff4fa3',
      frame: 'linear-gradient(160deg, #ffe9a8, #ff4fa3 50%, #6a1b9a)',
      glow: '#ff9ad5',
      tile: 'linear-gradient(180deg, #fff5fb 0%, #f7d6ea 100%)',
    },
    symbols: {
      L1: { glyph: '🎬', label: 'Clapperboard' },
      L2: { glyph: '📸', label: 'Paparazzi' },
      L3: { glyph: '🕶️', label: 'Shades' },
      L4: { glyph: '🎤', label: 'Mic' },
      H1: { glyph: '🎸', label: 'Rock Star' },
      H2: { glyph: '💃', label: 'Diva' },
      H3: { glyph: '🎩', label: 'Tycoon' },
      H4: { glyph: '🏆', label: 'Golden statue' },
      W: { glyph: '⭐', label: 'Wild star' },
      S: { glyph: '🎟️', label: 'Premiere bonus' },
    },
    ambient: ['✨', '⭐', '💫'],
    celebrate: ['⭐', '📸', '🏆', '💫', '✨'],
    effect: 'flash',
    epicText: 'SUPERSTAR!',
    scale: PENTA_MAJOR,
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
