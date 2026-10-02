// DOM-based reel engine. Reels are absolutely positioned strips moved with GPU transforms
// in a single requestAnimationFrame loop; React never re-renders while the reels spin.

import { PAYLINES, REELS, ROWS, SCATTER, SYMBOLS, type Grid, type LineWin, type SymbolId } from '../../../shared/game.ts';
import type { ThemeDef } from '../../../shared/themes.ts';

const CELLS = ROWS + 1; // one hidden cell above the window
const FILLER: SymbolId[] = SYMBOLS.flatMap((s) => (s === 'W' || s === 'S' ? [s] : s.startsWith('L') ? [s, s, s] : [s, s]));
const LINE_COLORS = ['#ffd23f', '#ff4fa3', '#00e5ff', '#7cff6b', '#ff8a3d', '#b388ff', '#ffffff', '#ff5252'];

const randomFiller = () => FILLER[Math.floor(Math.random() * FILLER.length)];

export function renderSymbol(el: HTMLElement, theme: ThemeDef, id: SymbolId) {
  const sym = theme.symbols[id];
  const tier = id === 'W' ? 'wild' : id === 'S' ? 'scatter' : id.startsWith('H') ? 'high' : 'low';
  el.className = `cell tier-${tier}${sym.text ? ' text' : ''}`;
  el.dataset.symbol = id;
  const red = sym.text && /[♥♦]/.test(sym.glyph);
  el.innerHTML =
    `<div class="glyph${red ? ' red' : ''}">${sym.glyph}</div>` +
    (id === 'W' ? '<div class="ribbon">WILD</div>' : id === 'S' ? '<div class="ribbon">BONUS</div>' : '');
}

interface Reel {
  window: HTMLElement;
  inner: HTMLElement;
  strip: HTMLElement;
  cells: HTMLElement[];
  symbols: SymbolId[];
  offset: number; // 0..H, how far the strip has moved down past the current alignment
  mode: 'idle' | 'spinning' | 'stopping';
  queue: SymbolId[];
  stop?: { travelled: number; distance: number; duration: number; start: number; target: SymbolId[]; resolve: () => void };
}

export interface LandOptions {
  turbo: boolean;
  onReelStop?: (reel: number, symbols: SymbolId[]) => void;
  onAnticipate?: (reel: number) => void;
}

export class ReelEngine {
  private reels: Reel[] = [];
  private theme: ThemeDef;
  private cellH = 100;
  private speed = 0; // px per second
  private raf = 0;
  private lastT = 0;
  private svg: SVGSVGElement;

  constructor(
    private root: HTMLElement,
    theme: ThemeDef,
    initial: Grid,
  ) {
    this.theme = theme;
    root.innerHTML = '';
    for (let r = 0; r < REELS; r++) {
      const win = document.createElement('div');
      win.className = 'reel';
      const inner = document.createElement('div');
      inner.className = 'reel-inner';
      const strip = document.createElement('div');
      strip.className = 'strip';
      const symbols: SymbolId[] = [randomFiller(), ...initial[r]];
      const cells = symbols.map((s) => {
        const cell = document.createElement('div');
        renderSymbol(cell, theme, s);
        strip.appendChild(cell);
        return cell;
      });
      inner.appendChild(strip);
      win.appendChild(inner);
      root.appendChild(win);
      this.reels.push({ window: win, inner, strip, cells, symbols, offset: 0, mode: 'idle', queue: [] });
    }
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('paylines');
    root.appendChild(this.svg);
    this.measure();
    this.reels.forEach((reel) => this.place(reel));
  }

  setTheme(theme: ThemeDef) {
    this.theme = theme;
    for (const reel of this.reels) reel.cells.forEach((cell, i) => renderSymbol(cell, theme, reel.symbols[i]));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.root.innerHTML = '';
  }

  private measure() {
    this.cellH = this.reels[0]?.window.clientHeight / ROWS || 100;
  }

  private place(reel: Reel) {
    reel.strip.style.transform = `translate3d(0, ${reel.offset - this.cellH}px, 0)`;
  }

  /** Moves a reel down by `delta` px, recycling cells as they leave the window. */
  private advance(reel: Reel, delta: number) {
    reel.offset += delta;
    while (reel.offset >= this.cellH) {
      reel.offset -= this.cellH;
      reel.symbols.pop();
      reel.symbols.unshift(reel.queue.length ? reel.queue.shift()! : randomFiller());
      // Rotate DOM cells: move the bottom cell to the top and re-render it.
      const cell = reel.cells.pop()!;
      reel.cells.unshift(cell);
      reel.strip.prepend(cell);
      renderSymbol(cell, this.theme, reel.symbols[0]);
    }
    this.place(reel);
  }

  /** Starts all reels spinning. They keep spinning until land() is called. */
  start(turbo: boolean) {
    this.clearWins();
    this.measure();
    this.speed = this.cellH * (turbo ? 32 : 24);
    this.reels.forEach((reel, i) => {
      reel.mode = 'spinning';
      reel.queue = [];
      reel.window.classList.remove('anticipate');
      reel.strip.classList.add('blur');
      // A little wind-up kick before the spin.
      reel.inner.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${-this.cellH * 0.18}px)` }, { transform: 'translateY(0)' }],
        { duration: 220, delay: i * 40, easing: 'ease-in-out' },
      );
    });
    this.lastT = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    let active = false;
    for (const reel of this.reels) {
      if (reel.mode === 'spinning') {
        active = true;
        this.advance(reel, this.speed * dt);
      } else if (reel.mode === 'stopping' && reel.stop) {
        active = true;
        const s = reel.stop;
        const t = Math.min(1, (now - s.start) / s.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        // Stay a hair short of the full distance so rounding never triggers an extra shift.
        const target = Math.min(s.distance * eased, s.distance - 0.01);
        this.advance(reel, target - s.travelled);
        s.travelled = target;
        if (t > 0.55) reel.strip.classList.remove('blur');
        if (t >= 1) {
          // Snap exactly onto the target symbols, whatever floating-point drift happened.
          reel.offset = 0;
          reel.queue = [];
          s.target.forEach((sym, row) => {
            if (reel.symbols[row + 1] !== sym) {
              reel.symbols[row + 1] = sym;
              renderSymbol(reel.cells[row + 1], this.theme, sym);
            }
          });
          this.place(reel);
          reel.mode = 'idle';
          reel.stop = undefined;
          reel.inner.animate(
            [
              { transform: 'translateY(0)' },
              { transform: `translateY(${this.cellH * 0.12}px)` },
              { transform: `translateY(${-this.cellH * 0.03}px)` },
              { transform: 'translateY(0)' },
            ],
            { duration: 260, easing: 'ease-out' },
          );
          s.resolve();
        }
      }
    }
    if (active) this.raf = requestAnimationFrame(this.tick);
  };

  /** Lands the reels on `grid` with staggered, overlapping stops. Resolves when every reel has stopped. */
  async land(grid: Grid, opts: LandOptions) {
    const gap = opts.turbo ? 90 : 220;
    const stops: Promise<void>[] = [];
    for (let r = 0; r < REELS; r++) {
      const scattersBefore = grid.slice(0, r).flat().filter((s) => s === SCATTER).length;
      const anticipate = scattersBefore >= 2;
      if (anticipate) {
        // Let the earlier reels settle, then tease the remaining ones.
        await Promise.all(stops);
        this.reels[r].window.classList.add('anticipate');
        opts.onAnticipate?.(r);
        await this.wait(700);
      } else if (r > 0) {
        await this.wait(gap);
      }
      stops.push(
        this.stopReel(r, grid[r], anticipate ? 6 : 1, opts.turbo).then(() => {
          this.reels[r].window.classList.remove('anticipate');
          opts.onReelStop?.(r, grid[r]);
        }),
      );
    }
    await Promise.all(stops);
  }

  private wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private stopReel(r: number, symbols: SymbolId[], extra: number, turbo: boolean) {
    const reel = this.reels[r];
    return new Promise<void>((resolve) => {
      const k = extra;
      reel.queue = [...Array.from({ length: k }, randomFiller), symbols[2], symbols[1], symbols[0], randomFiller()];
      const distance = this.cellH - reel.offset + (k + 3) * this.cellH;
      // Match the cubic ease-out's initial velocity to the current spin speed.
      const duration = Math.max(turbo ? 180 : 320, ((3 * distance) / this.speed) * 1000);
      reel.mode = 'stopping';
      reel.stop = { travelled: 0, distance, duration, start: performance.now(), target: symbols, resolve };
    });
  }

  /** Visible cell element for (reel, row). */
  cell(reel: number, row: number) {
    return this.reels[reel].cells[row + 1];
  }

  cellCenter(reel: number, row: number) {
    const rootRect = this.root.getBoundingClientRect();
    const rect = this.reels[reel].window.getBoundingClientRect();
    return {
      x: rect.left - rootRect.left + rect.width / 2,
      y: rect.top - rootRect.top + (row + 0.5) * (rect.height / ROWS),
      pageX: rect.left + rect.width / 2,
      pageY: rect.top + (row + 0.5) * (rect.height / ROWS),
    };
  }

  showWins(grid: Grid, lineWins: LineWin[], scatterCount: number) {
    this.clearWins();
    const rootRect = this.root.getBoundingClientRect();
    this.svg.setAttribute('viewBox', `0 0 ${rootRect.width} ${rootRect.height}`);

    lineWins.forEach((w, i) => {
      const rows = PAYLINES[w.line];
      for (let r = 0; r < w.count; r++) this.cell(r, rows[r]).classList.add('win');
      const pts = rows.map((row, r) => this.cellCenter(r, row));
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      path.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
      path.setAttribute('stroke', color);
      path.style.animationDelay = `${i * 80}ms`;
      this.svg.appendChild(path);
    });

    if (scatterCount >= 3) {
      grid.forEach((col, r) => col.forEach((s, row) => s === SCATTER && this.cell(r, row).classList.add('win', 'scatter-win')));
    }
    this.root.classList.toggle('has-wins', lineWins.length > 0 || scatterCount >= 3);
  }

  clearWins() {
    this.svg.innerHTML = '';
    this.root.classList.remove('has-wins');
    this.reels.forEach((reel) => reel.cells.forEach((c) => c.classList.remove('win', 'scatter-win')));
  }
}
