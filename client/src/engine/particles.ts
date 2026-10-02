// A small full-screen canvas particle system for coins, confetti, fireworks and emoji.

type Kind = 'coin' | 'confetti' | 'spark' | 'emoji';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  rot: number;
  vr: number;
  life: number;
  maxLife: number;
  color: string;
  emoji?: string;
}

let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;
let last = 0;
let dpr = 1;
const emojiCache = new Map<string, HTMLCanvasElement>();

const CONFETTI = ['#ff4fa3', '#ffd23f', '#00d4c8', '#7c4dff', '#ff6b35', '#3ddc84', '#ffffff'];

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  document.body.appendChild(canvas);
  g = canvas.getContext('2d');
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = window.innerWidth * dpr;
    canvas!.height = window.innerHeight * dpr;
  };
  resize();
  window.addEventListener('resize', resize);
}

function emojiSprite(emoji: string): HTMLCanvasElement {
  let sprite = emojiCache.get(emoji);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 96;
    const c = sprite.getContext('2d')!;
    c.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(emoji, 48, 54);
    emojiCache.set(emoji, sprite);
  }
  return sprite;
}

function add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>) {
  particles.push({
    vx: 0,
    vy: 0,
    gravity: 900,
    drag: 0.4,
    size: 20,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 10,
    life: 0,
    maxLife: 4,
    color: '#ffd23f',
    ...p,
  });
  if (particles.length > 1200) particles.splice(0, particles.length - 1200);
  start();
}

function start() {
  ensureCanvas();
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!g || !canvas) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const h = window.innerHeight;

  particles = particles.filter((p) => {
    p.life += dt;
    p.vy += p.gravity * dt;
    p.vx *= 1 - p.drag * dt;
    p.vy *= 1 - p.drag * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.life > p.maxLife || p.y > h + 80) return false;
    const fade = Math.min(1, (p.maxLife - p.life) / 0.6);
    g!.globalAlpha = Math.max(0, fade);
    draw(g!, p);
    return true;
  });
  g.globalAlpha = 1;

  if (particles.length) requestAnimationFrame(frame);
  else {
    running = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function draw(c: CanvasRenderingContext2D, p: Particle) {
  c.save();
  c.translate(p.x, p.y);
  switch (p.kind) {
    case 'coin': {
      const flip = Math.cos(p.rot * 2);
      const w = p.size * Math.max(0.12, Math.abs(flip));
      const grad = c.createLinearGradient(-w, -p.size, w, p.size);
      grad.addColorStop(0, '#fff6b0');
      grad.addColorStop(0.45, flip > 0 ? '#ffd23f' : '#f0a800');
      grad.addColorStop(1, '#b37400');
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(0, 0, w, p.size, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8a5a00';
      c.lineWidth = Math.max(1, p.size * 0.12);
      c.stroke();
      if (Math.abs(flip) > 0.4) {
        c.fillStyle = 'rgba(138,90,0,0.7)';
        c.font = `bold ${p.size * 1.1}px Rubik, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.scale(Math.abs(flip), 1);
        c.fillText('$', 0, p.size * 0.05);
      }
      break;
    }
    case 'confetti': {
      c.rotate(p.rot);
      c.scale(1, Math.cos(p.rot * 1.7));
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      break;
    }
    case 'spark': {
      const r = p.size * (1 - p.life / p.maxLife) + 0.5;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = p.color;
      c.shadowColor = p.color;
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'emoji': {
      c.rotate(Math.sin(p.rot) * 0.4);
      const s = p.size;
      c.drawImage(emojiSprite(p.emoji!), -s / 2, -s / 2, s, s);
      break;
    }
  }
  c.restore();
}

const W = () => window.innerWidth;
const H = () => window.innerHeight;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export const fx = {
  /** Coins burst upward from a point. */
  coinFountain(x: number, y: number, count = 40, power = 1) {
    for (let i = 0; i < count; i++) {
      add({
        kind: 'coin',
        x,
        y,
        vx: rand(-420, 420) * power,
        vy: rand(-1100, -600) * power,
        size: rand(10, 18),
        vr: rand(2, 8),
        maxLife: 4,
      });
    }
  },
  /** Coins rain down from the top of the screen. */
  coinRain(count = 80, spread = 1.5) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        add({ kind: 'coin', x: rand(0, W()), y: -30, vx: rand(-60, 60), vy: rand(100, 400), size: rand(12, 22), vr: rand(2, 8), gravity: 700, maxLife: 5 });
      }, Math.random() * spread * 1000);
    }
  },
  confetti(count = 150) {
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      add({
        kind: 'confetti',
        x: fromLeft ? -10 : W() + 10,
        y: H() * rand(0.5, 0.9),
        vx: (fromLeft ? 1 : -1) * rand(300, 900),
        vy: rand(-1300, -700),
        gravity: 600,
        drag: 1.2,
        size: rand(8, 14),
        vr: rand(-12, 12),
        color: CONFETTI[i % CONFETTI.length],
        maxLife: 5,
      });
    }
  },
  firework(x = rand(W() * 0.15, W() * 0.85), y = rand(H() * 0.12, H() * 0.45)) {
    const color = CONFETTI[Math.floor(Math.random() * (CONFETTI.length - 1))];
    const n = 70;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const speed = rand(200, 420);
      add({ kind: 'spark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, gravity: 220, drag: 1.4, size: rand(2.5, 4), color, maxLife: rand(1.1, 1.6) });
    }
  },
  fireworks(count = 6, interval = 350) {
    for (let i = 0; i < count; i++) setTimeout(() => fx.firework(), i * interval);
  },
  emojiRain(emojis: string[], count = 30, spread = 2) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        add({ kind: 'emoji', emoji: emojis[i % emojis.length], x: rand(0, W()), y: -40, vx: rand(-40, 40), vy: rand(100, 300), gravity: 400, size: rand(32, 56), vr: rand(1, 4), maxLife: 6 });
      }, Math.random() * spread * 1000);
    }
  },
  emojiBurst(emojis: string[], x: number, y: number, count = 16) {
    for (let i = 0; i < count; i++) {
      add({ kind: 'emoji', emoji: emojis[i % emojis.length], x, y, vx: rand(-500, 500), vy: rand(-900, -400), gravity: 900, size: rand(28, 48), vr: rand(1, 5), maxLife: 3 });
    }
  },
  clear() {
    particles = [];
  },
};
