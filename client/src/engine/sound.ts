// All sound is synthesized with the Web Audio API, so there are no audio files to load.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = localStorage.getItem('slot-party.muted') === '1';
} catch {
  // ignore
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('slot-party.muted', value ? '1' : '0');
  } catch {
    // ignore
  }
  if (value && ctx) void ctx.suspend();
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number; // seconds from now
  slideTo?: number;
  attack?: number;
}

function tone({ freq, dur, type = 'sine', vol = 0.3, at = 0, slideTo, attack = 0.005 }: ToneOpts) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur, vol = 0.2, at = 0, from = 800, to = 3000, q = 1 }: { dur: number; vol?: number; at?: number; from?: number; to?: number; q?: number }) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  click() {
    tone({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.15 });
  },
  spin() {
    noise({ dur: 0.35, vol: 0.25, from: 400, to: 2500, q: 0.8 });
    tone({ freq: 220, dur: 0.25, type: 'triangle', vol: 0.12, slideTo: 440 });
  },
  reelStop(index: number) {
    tone({ freq: 140 - index * 6, dur: 0.12, type: 'sine', vol: 0.45, slideTo: 60 });
    noise({ dur: 0.05, vol: 0.15, from: 2000, to: 1200, q: 2 });
  },
  anticipation() {
    tone({ freq: 300, dur: 1.2, type: 'sawtooth', vol: 0.06, slideTo: 900, attack: 0.3 });
  },
  scatter(index: number) {
    tone({ freq: 660 + index * 120, dur: 0.3, type: 'triangle', vol: 0.25 });
    tone({ freq: 1320 + index * 240, dur: 0.25, type: 'sine', vol: 0.1, at: 0.04 });
  },
  smallWin(scale: number[]) {
    [0, 2, 4].forEach((n, i) => tone({ freq: scale[n], dur: 0.22, type: 'triangle', vol: 0.22, at: i * 0.08 }));
  },
  bigWin(scale: number[]) {
    const seq = [0, 1, 2, 3, 4, 5, 4, 5];
    seq.forEach((n, i) => {
      tone({ freq: scale[n], dur: 0.25, type: 'square', vol: 0.09, at: i * 0.09 });
      tone({ freq: scale[n] / 2, dur: 0.25, type: 'triangle', vol: 0.15, at: i * 0.09 });
    });
    chord([scale[0], scale[2], scale[4], scale[5]], 0.75, 1.2);
  },
  fanfare(scale: number[]) {
    const [a, , c, d, e, f] = scale;
    const notes: [number, number][] = [
      [a, 0], [a, 0.15], [a, 0.3], [c, 0.45], [e, 0.75], [d, 1.0], [f, 1.25],
    ];
    notes.forEach(([freq, at]) => {
      tone({ freq, dur: 0.3, type: 'sawtooth', vol: 0.08, at });
      tone({ freq: freq / 2, dur: 0.3, type: 'square', vol: 0.06, at });
    });
    chord([a, c, e, f * 2], 1.6, 2.2);
  },
  coin() {
    const f = 1800 + Math.random() * 1400;
    tone({ freq: f, dur: 0.12, type: 'square', vol: 0.05 });
    tone({ freq: f * 1.5, dur: 0.1, type: 'sine', vol: 0.06, at: 0.05 });
  },
  boom() {
    noise({ dur: 0.6, vol: 0.35, from: 1200, to: 80, q: 0.5 });
    tone({ freq: 90, dur: 0.5, type: 'sine', vol: 0.4, slideTo: 40 });
  },
  wheelTick() {
    tone({ freq: 1200, dur: 0.03, type: 'square', vol: 0.06 });
  },
  freeSpins(scale: number[]) {
    scale.forEach((freq, i) => tone({ freq: freq * 1.5, dur: 0.18, type: 'triangle', vol: 0.18, at: i * 0.06 }));
    chord([scale[0] * 2, scale[2] * 2, scale[4] * 2], 0.4, 0.8);
  },
};

function chord(freqs: number[], at: number, dur: number) {
  freqs.forEach((freq) => {
    tone({ freq, dur, type: 'triangle', vol: 0.12, at, attack: 0.02 });
    tone({ freq: freq * 1.005, dur, type: 'sawtooth', vol: 0.03, at, attack: 0.02 });
  });
}
