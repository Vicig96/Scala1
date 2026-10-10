// Procedural soundtrack: music + sound effects, synthesised from the same
// timeline as the picture (scene.js CUES / T). Writes a 48 kHz stereo WAV.
import fs from 'node:fs';
import { CUES, T } from './scene.js';
import { rng } from './util.js';

const SR = 48000;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = rng(42);
const white = () => rnd() * 2 - 1;

// ------------------------------------------------------------------ DSP bits
function biquad(type, f, q = 0.707, gainDb = 0) {
  const w = (TAU * Math.min(f, SR * 0.45)) / SR;
  const cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function bq(s, x) {
  const y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
  s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
  return y;
}
function filter(buf, type, f, q) {
  const s = biquad(type, f, q);
  for (let i = 0; i < buf.length; i++) buf[i] = bq(s, buf[i]);
  return buf;
}
// time-varying filter: fAt(t) evaluated every 32 samples
function sweep(buf, type, fAt, q = 1) {
  let s = biquad(type, fAt(0), q);
  for (let i = 0; i < buf.length; i++) {
    if (i % 32 === 0) {
      const ns = biquad(type, fAt(i / SR), q);
      ns.x1 = s.x1; ns.x2 = s.x2; ns.y1 = s.y1; ns.y2 = s.y2;
      s = ns;
    }
    buf[i] = bq(s, buf[i]);
  }
  return buf;
}
const make = (dur) => new Float32Array(Math.max(1, Math.round(dur * SR)));

// oscillator with frequency function fAt(t) and amplitude function aAt(t)
function osc(dur, fAt, aAt, wave = 'sine') {
  const b = make(dur);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = fAt(t);
    ph += f / SR;
    const p = ph - Math.floor(ph);
    let v;
    switch (wave) {
      case 'sine': v = Math.sin(TAU * p); break;
      case 'tri': v = 1 - 4 * Math.abs(p - 0.5); break;
      case 'sq': v = Math.sin(TAU * p) + Math.sin(3 * TAU * p) / 3 + Math.sin(5 * TAU * p) / 5; break;
      case 'saw': { v = 0; for (let k = 1; k <= 12 && k * f < 12000; k++) v += Math.sin(TAU * p * k) / k; v *= 0.6; break; }
      default: v = 0;
    }
    b[i] = v * aAt(t);
  }
  return b;
}
const expEnv = (a, d) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));
const adsr = (a, d, s, len, r) => (t) => {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len) return s;
  return s * Math.max(0, 1 - (t - len) / r);
};
function noise(dur, aAt) {
  const b = make(dur);
  for (let i = 0; i < b.length; i++) b[i] = white() * aAt(i / SR);
  return b;
}
function addInto(dst, src, gain = 1, offset = 0) {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
}
function mixAll(...bufs) {
  const n = Math.max(...bufs.map((b) => b.length));
  const o = new Float32Array(n);
  for (const b of bufs) addInto(o, b);
  return o;
}

// ------------------------------------------------------------------ instruments
function pluck(midi, dur = 1.2, bright = 0.6, decay = 0.995) {
  const f = mtof(midi);
  const N = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp = lp + bright * (white() - lp); line[i] = lp; }
  const b = make(dur);
  let idx = 0;
  for (let i = 0; i < b.length; i++) {
    const nxt = (idx + 1) % N;
    const v = line[idx];
    line[idx] = decay * 0.5 * (v + line[nxt]);
    b[i] = v;
    idx = nxt;
  }
  // soften the attack and release
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] *= Math.min(1, t / 0.002) * Math.min(1, (dur - t) / 0.05);
  }
  return b;
}
function marimba(midi, dur = 0.7, vel = 1) {
  const f = mtof(midi);
  return mixAll(
    osc(dur, () => f, (t) => vel * Math.min(1, t / 0.002) * Math.exp(-t * 7)),
    osc(dur, () => f * 3.93, (t) => vel * 0.28 * Math.min(1, t / 0.001) * Math.exp(-t * 30)),
    osc(dur, () => f * 9.9, (t) => vel * 0.06 * Math.exp(-t * 60)),
  );
}
function bell(midi, dur = 1.6, vel = 1) {
  const f = mtof(midi);
  const b = make(dur);
  let pc = 0, pm = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    pm += (f * 1.41) / SR;
    const idx = 2.2 * Math.exp(-t * 4);
    pc += f / SR;
    b[i] = Math.sin(TAU * pc + idx * Math.sin(TAU * pm)) * vel * Math.min(1, t / 0.002) * Math.exp(-t * 2.6);
  }
  return b;
}
function pad(midis, dur, vel = 1) {
  const parts = [];
  for (const m of midis) {
    for (const det of [-0.08, 0, 0.09]) {
      const f = mtof(m + det);
      parts.push(osc(dur, () => f, adsr(0.35, 0.3, 0.8, dur - 0.5, 0.5), 'saw'));
    }
  }
  const b = mixAll(...parts);
  filter(b, 'lp', 1600, 0.6);
  for (let i = 0; i < b.length; i++) b[i] *= (vel * 0.18) / midis.length;
  return b;
}
function bassNote(midi, dur = 0.45, vel = 1) {
  const f = mtof(midi);
  const b = mixAll(
    osc(dur, () => f, (t) => vel * Math.min(1, t / 0.004) * Math.exp(-t * 5) * Math.min(1, (dur - t) / 0.03), 'tri'),
    osc(dur, () => f * 2, (t) => vel * 0.25 * Math.exp(-t * 12), 'sine'),
  );
  return b;
}
function kick(vel = 1) {
  return osc(0.35, (t) => 45 + 110 * Math.exp(-t * 28), (t) => vel * Math.min(1, t / 0.001) * Math.exp(-t * 10));
}
function hat(vel = 1, len = 0.05) {
  const b = noise(len + 0.02, (t) => vel * Math.exp(-t / (len * 0.35)));
  return filter(b, 'hp', 7500, 0.7);
}
function snare(vel = 1) {
  const n = filter(noise(0.22, (t) => vel * Math.exp(-t * 18)), 'bp', 2200, 0.7);
  const tone = osc(0.15, () => 190, (t) => vel * 0.5 * Math.exp(-t * 25));
  return mixAll(n, tone);
}
function shaker(vel = 1) {
  return filter(noise(0.08, (t) => vel * Math.sin(Math.min(1, t / 0.07) * Math.PI)), 'bp', 6000, 1.2);
}

// ------------------------------------------------------------------ sound effects
const SFX = {
  pop: (o) => mixAll(
    osc(0.12, (t) => 500 * (o.p || 1) * (1 + 4 * t), (t) => Math.min(1, t / 0.003) * Math.exp(-t * 30)),
    filter(noise(0.01, () => 0.4), 'hp', 3000),
  ),
  popnote: (o) => {
    const scale = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
    return mixAll(marimba(scale[((o.k || 1) - 1) % scale.length] + 12, 0.5, 0.7), SFX.pop({ p: 1.6 }));
  },
  love: () => {
    const b = osc(0.6, (t) => 650 + 500 * Math.sin(Math.min(1, t / 0.35) * Math.PI / 2) + 25 * Math.sin(t * 40), (t) => 0.5 * Math.min(1, t / 0.02) * Math.exp(-t * 3.5));
    return mixAll(b, bell(91, 0.8, 0.25), addInto(make(0.9), bell(96, 0.7, 0.2), 1, Math.round(0.12 * SR)));
  },
  draw: () => sweep(noise(0.45, (t) => 0.35 * Math.sin(Math.min(1, t / 0.45) * Math.PI) * (0.7 + 0.3 * Math.sin(t * 70))), 'bp', (t) => 1800 + 2500 * t, 3),
  windup: (o) => osc(0.32, (t) => 220 + 900 * t * t * 3, (t) => 0.25 * (o.v || 1) * Math.min(1, t / 0.02) * (0.6 + 0.4 * Math.sin(t * 90)) * Math.min(1, (0.32 - t) / 0.05), 'tri'),
  whoosh: (o) => sweep(noise(0.42, (t) => (o.v || 1) * Math.sin(Math.min(1, t / 0.42) * Math.PI) ** 1.5), 'bp', (t) => 400 + 3000 * t / 0.42, 1.4),
  slam: (o) => {
    const p = o.p || 1;
    const body = osc(0.32, (t) => (40 + 120 * Math.exp(-t * 22)) * p, (t) => Math.min(1, t / 0.001) * Math.exp(-t * 11));
    const knock = osc(0.12, () => 230 * p, (t) => 0.5 * Math.exp(-t * 40));
    const clk = filter(noise(0.04, (t) => 0.9 * Math.exp(-t * 90)), 'bp', 1800 * p, 0.8);
    const twang = osc(0.5, (t) => 160 * p * (1 + 0.04 * Math.sin(t * 60) * Math.exp(-t * 6)), (t) => 0.22 * Math.exp(-t * 7), 'tri');
    return mixAll(body, knock, clk, twang).map((x) => x * (o.v || 1));
  },
  skid: (o) => {
    const d = o.d || 0.32;
    const b = noise(d, (t) => (o.v || 1) * 0.55 * Math.min(1, t / 0.02) * (1 - t / d) * (0.6 + 0.4 * Math.sin(t * 160)));
    return sweep(b, 'bp', (t) => (2600 - 900 * t / d) * (o.p || 1), 4);
  },
  question: (o) => osc(0.32, (t) => (380 + 300 * Math.min(1, t / 0.25) ** 2) * (o.p || 1), (t) => 0.35 * Math.min(1, t / 0.02) * Math.min(1, (0.32 - t) / 0.06), 'tri'),
  fly: (o) => mixAll(
    sweep(noise(0.42, (t) => 0.4 * Math.sin(Math.min(1, t / 0.42) * Math.PI)), 'bp', (t) => 900 + 3500 * t, 2),
    osc(0.4, (t) => mtof(72 + (o.k || 1) * 2) * (0.8 + 0.5 * t), (t) => 0.12 * Math.sin(Math.min(1, t / 0.4) * Math.PI)),
  ),
  land: (o) => mixAll(bell([84, 86, 88, 91][((o.k || 1) - 1) % 4], 1.2, 0.35), SFX.pop({ p: 1.2 })),
  retract: () => osc(0.16, (t) => 520 - 1800 * t, (t) => 0.3 * Math.min(1, t / 0.005) * Math.exp(-t * 14), 'sine'),
  bonk: () => mixAll(
    osc(0.25, () => 380, (t) => 0.8 * Math.exp(-t * 26)),
    osc(0.25, () => 575, (t) => 0.5 * Math.exp(-t * 30)),
    filter(noise(0.03, (t) => Math.exp(-t * 120)), 'bp', 1200, 1),
    osc(0.75, (t) => 260 * (1 + 0.18 * Math.sin(t * 55) * Math.exp(-t * 3)), (t) => 0.45 * Math.min(1, t / 0.01) * Math.exp(-t * 4), 'tri'),
  ),
  birds: () => {
    const b = make(0.7);
    for (let k = 0; k < 4; k++) {
      const c = osc(0.09, (t) => 2600 + 1400 * Math.sin(t * 70) + k * 120, (t) => 0.12 * Math.sin((t / 0.09) * Math.PI));
      addInto(b, c, 1, Math.round(k * 0.15 * SR));
    }
    return b;
  },
  shake: () => osc(0.3, () => 140, (t) => 0.35 * (0.5 + 0.5 * Math.sin(t * 150)) * Math.sin(Math.min(1, t / 0.3) * Math.PI), 'tri'),
  jump: () => osc(0.22, (t) => 280 + 2200 * t * t * 4, (t) => 0.3 * Math.min(1, t / 0.01) * Math.exp(-t * 6), 'sine'),
  land4: () => mixAll(kick(0.6), filter(noise(0.06, (t) => 0.3 * Math.exp(-t * 60)), 'lp', 1500)),
  stretch: (o) => {
    const d = o.d || 0.35;
    return osc(d, (t) => 180 + 420 * (t / d) + 30 * Math.sin(t * 70), (t) => 0.3 * (o.v || 1) * Math.sin(Math.min(1, t / d) * Math.PI), 'tri');
  },
  zoomIn: () => mixAll(
    osc(0.5, (t) => 260 * Math.pow(5, t / 0.5), (t) => 0.22 * Math.sin(Math.min(1, t / 0.5) * Math.PI), 'tri'),
    sweep(noise(0.5, (t) => 0.4 * Math.sin(Math.min(1, t / 0.5) * Math.PI)), 'bp', (t) => 500 + 5000 * t, 1.2),
  ),
  zoomOut: () => mixAll(
    osc(0.42, (t) => 1300 * Math.pow(0.22, t / 0.42), (t) => 0.22 * Math.sin(Math.min(1, t / 0.42) * Math.PI), 'tri'),
    sweep(noise(0.42, (t) => 0.4 * Math.sin(Math.min(1, t / 0.42) * Math.PI)), 'bp', (t) => 4000 - 7000 * t, 1.2),
  ),
  fwip: (o) => mixAll(
    osc(0.14, (t) => 600 * (o.p || 1) * Math.pow(3.5, t / 0.14), (t) => 0.25 * Math.sin((t / 0.14) * Math.PI)),
    sweep(noise(0.14, (t) => 0.3 * Math.sin((t / 0.14) * Math.PI)), 'bp', (t) => 1500 + 20000 * t, 1.5),
  ),
  tick: (o) => mixAll(
    filter(noise(0.02, (t) => 0.7 * Math.exp(-t * 200)), 'hp', 3000),
    osc(0.06, () => 1800 * (o.p || 1), (t) => 0.25 * Math.exp(-t * 60)),
  ),
  tapestop: () => osc(0.6, (t) => 220 * Math.pow(0.15, t / 0.6), (t) => 0.3 * Math.min(1, t / 0.01) * (1 - t / 0.6), 'saw'),
  stomp: () => mixAll(kick(1), filter(noise(0.12, (t) => 0.5 * Math.exp(-t * 35)), 'lp', 900), osc(0.1, () => 95, (t) => 0.4 * Math.exp(-t * 30))),
  grumble: () => filter(osc(1.0, (t) => 92 + 10 * Math.sin(t * 9), (t) => 0.4 * Math.sin(Math.min(1, t) * Math.PI) * (0.55 + 0.45 * Math.sin(t * 34)), 'saw'), 'lp', 700, 0.9),
  thud: () => mixAll(kick(0.7), filter(noise(0.1, (t) => 0.35 * Math.exp(-t * 40)), 'lp', 700)),
  sad: () => {
    // "wah, wah, waaah"
    const notes = [[0, 67, 0.24], [0.27, 66, 0.24], [0.54, 65, 0.7]];
    const b = make(1.4);
    for (const [st, m, d] of notes) {
      const f = mtof(m - 12);
      const v = osc(d, (t) => f * (1 + (d > 0.5 ? 0.025 * Math.sin(t * 34) * Math.min(1, t / 0.2) : 0)), adsr(0.03, 0.08, 0.8, d - 0.08, 0.08), 'saw');
      sweep(v, 'lp', (t) => 500 + 900 * Math.sin(Math.min(1, t / d) * Math.PI), 2);
      addInto(b, v, 0.55, Math.round(st * SR));
    }
    return b;
  },
  shimmer: () => {
    const b = make(1.0);
    for (let k = 0; k < 6; k++) addInto(b, bell(84 + k * 2 + (k > 2 ? 3 : 0), 0.8, 0.12), 1, Math.round(k * 0.07 * SR));
    return b;
  },
  tailfill: () => {
    const b = make(0.6);
    let t = 0, k = 0;
    while (t < 0.45 && k < 18) {
      addInto(b, SFX.tick({ p: 1 + k * 0.08 }), 0.6, Math.round(t * SR));
      t += 0.09 * Math.pow(0.8, k);
      k++;
    }
    return b;
  },
  merge: (o) => {
    const m = [72, 76, 79, 84, 88][o.k || 0];
    return mixAll(bell(m, 1.5, 0.55), marimba(m - 12, 0.6, 0.4), SFX.fwip({ p: 1 + (o.k || 0) * 0.2 }).map((x) => x * 0.5));
  },
  eqone: () => {
    const b = mixAll(pad([60, 64, 67, 72], 2.2, 1.6), bell(84, 2.0, 0.5), bell(88, 2.0, 0.35), bell(91, 2.0, 0.3));
    return mixAll(b, filter(noise(1.2, (t) => 0.25 * Math.exp(-t * 3)), 'hp', 6000));
  },
  bulb: () => mixAll(bell(96, 1.4, 0.5), bell(103, 1.0, 0.25), SFX.pop({ p: 1.8 })),
  rewind: () => {
    const d = 0.95;
    const b = osc(d, (t) => 650 + 450 * Math.sin(t * 38) + 700 * (t / d), (t) => 0.12 * Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08) * (0.6 + 0.4 * Math.sin(t * 95)), 'tri');
    const n = sweep(noise(d, (t) => 0.12 * Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08)), 'bp', (t) => 1500 + 1000 * Math.sin(t * 38), 2);
    return mixAll(b, n);
  },
  burst: (o) => {
    const k = o.k || 1;
    const m = 79 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26][(k - 1) % 12];
    const glass = filter(noise(0.18, (t) => 0.5 * Math.exp(-t * 28)), 'hp', 4000);
    return mixAll(glass, marimba(m, 0.4, 0.55), osc(0.08, (t) => 120 * Math.exp(-t * 20) + 60, (t) => 0.5 * Math.exp(-t * 30))).map((x) => x * (o.v || 1));
  },
  arrive: () => {
    const chord = mixAll(pad([60, 64, 67, 72, 76], 1.6, 2.2), bell(84, 1.6, 0.4), bell(91, 1.6, 0.3));
    const crash = filter(noise(1.6, (t) => 0.35 * Math.exp(-t * 2.5)), 'hp', 5000);
    return mixAll(chord, crash, kick(0.9));
  },
  zip: (o) => osc(0.16, (t) => 420 * (o.p || 1) * Math.pow(5, t / 0.16), (t) => 0.3 * (o.v || 1) * Math.sin((t / 0.16) * Math.PI), 'tri'),
  snatch: () => mixAll(SFX.pop({ p: 1.4 }), osc(0.2, (t) => 900 + 1800 * t, (t) => 0.18 * Math.sin((t / 0.2) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 200)), 'tri'), filter(noise(0.05, (t) => 0.4 * Math.exp(-t * 60)), 'bp', 3000)),
  scratch: () => {
    const d = 0.32;
    return sweep(noise(d, (t) => 0.5 * Math.sin(Math.min(1, t / d) * Math.PI)), 'bp', (t) => 400 + 2400 * Math.abs(Math.sin(t * 22)), 3);
  },
  cricket: () => {
    const b = make(1.0);
    for (let k = 0; k < 2; k++) {
      const c = osc(0.18, () => 4300, (t) => 0.07 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 45)) * Math.sin((t / 0.18) * Math.PI));
      addInto(b, c, 1, Math.round((0.15 + k * 0.45) * SR));
    }
    return b;
  },
  sting: () => {
    const b = make(1.2);
    addInto(b, mixAll(osc(0.2, (t) => 140 * Math.exp(-t * 3), (t) => 0.5 * Math.exp(-t * 14)), snare(0.25)), 1, 0);
    addInto(b, mixAll(osc(0.2, (t) => 105 * Math.exp(-t * 3), (t) => 0.5 * Math.exp(-t * 14)), snare(0.25)), 1, Math.round(0.16 * SR));
    addInto(b, filter(noise(0.9, (t) => 0.3 * Math.exp(-t * 4)), 'hp', 6500), 1, Math.round(0.34 * SR));
    return b;
  },
  chomp: (o) => mixAll(
    filter(noise(0.1, (t) => 0.55 * Math.exp(-t * 30) * (0.6 + 0.4 * Math.sin(t * 900))), 'bp', 1400 * (o.p || 1), 0.9),
    osc(0.08, () => 120, (t) => 0.4 * Math.exp(-t * 35)),
  ),
  eek: () => osc(0.25, (t) => 1500 + 900 * Math.sin(Math.min(1, t / 0.12) * Math.PI / 2), (t) => 0.2 * Math.min(1, t / 0.01) * Math.min(1, (0.25 - t) / 0.08), 'tri'),
  steam: () => make(0.01),
};

// ------------------------------------------------------------------ reverb (Schroeder)
function reverb(inp, mix = 1, roomScale = 1) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * roomScale * 1.09));
  const aps = [225, 556, 441].map((d) => Math.round(d * 1.09));
  const out = new Float32Array(inp.length);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let idx = 0, lp = 0;
    for (let i = 0; i < inp.length; i++) {
      const y = buf[idx];
      lp = y * 0.75 + lp * 0.25;
      buf[idx] = inp[i] + lp * 0.8;
      out[i] += y / combs.length;
      idx = (idx + 1) % d;
    }
  }
  for (const d of aps) {
    const buf = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const x = out[i];
      const y = buf[idx];
      buf[idx] = x + y * 0.5;
      out[i] = y - x * 0.5;
      idx = (idx + 1) % d;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= mix;
  return out;
}

// ------------------------------------------------------------------ music
// Chord roots per bar (2 s @120bpm)
const CH = {
  C: [48, [60, 64, 67]], Am: [45, [57, 60, 64]], F: [41, [53, 57, 60]], G: [43, [55, 59, 62]],
  Dm: [50, [62, 65, 69]], E: [40, [56, 59, 64]],
};

function musicBus(dur) {
  const n = Math.ceil(dur * SR);
  const M = new Float32Array(n);
  const put = (t, buf, g = 1) => { if (t >= 0) addInto(M, buf, g, Math.round(t * SR)); };

  // --- section A: playful groove 0 .. lensShut (transposes up during the zoom)
  const beat = 0.5;
  const prog = ['C', 'Am', 'F', 'G'];
  const melodyRhythm = [
    [0, 0, 1], [0.75, 2, 0.8], [1.0, 1, 0.9], [1.5, 2, 0.8], [1.75, 0, 0.7],
  ];
  const transpose = (t) => {
    if (t >= T.flurry) return 5;
    let s = 0;
    T.lensSteps.forEach((st, i) => { if (t >= st) s = i + 1; });
    return s;
  };
  const endA = T.lensShut;
  for (let bar = 0; bar * 2 < endA; bar++) {
    const t0 = bar * 2;
    const [root, tri] = CH[prog[bar % 4]];
    // bass: root on 1, fifth on 3, pickup
    for (const [dt, m, v] of [[0, root, 1], [1.0, root + 7, 0.8], [1.5, root + 12, 0.55]]) {
      const t = t0 + dt;
      if (t >= endA) continue;
      put(t, bassNote(m + transpose(t), 0.45, 0.55 * v));
    }
    // marimba melody from chord tones (+12/+24)
    for (const [dt, idx, v] of melodyRhythm) {
      const t = t0 + dt;
      if (t >= endA) continue;
      const m = tri[idx] + 12 + (bar % 2 && idx === 0 ? 12 : 0);
      put(t, marimba(m + transpose(t), 0.6, 0.32 * v));
    }
    // pluck comping on the off-beats
    for (const dt of [0.25, 1.25]) {
      const t = t0 + dt;
      if (t >= endA) continue;
      for (const m of tri) put(t, pluck(m + 12 + transpose(t), 0.35, 0.5, 0.99), 0.07);
    }
    // drums join when he starts running
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      if (t >= endA) continue;
      const on = t >= T.crouch1;
      if (on && b % 2 === 0) put(t, kick(0.5));
      if (on && b % 2 === 1) put(t, snare(0.18));
      put(t + 0.25, hat(on ? 0.16 : 0.07));
      if (t >= T.flurry - 1) put(t + 0.125, hat(0.1));
    }
  }

  // --- reveal: soft pad + arpeggio
  const rv = T.reveal;
  put(rv, pad([57, 60, 64], 1.6, 1.0));
  put(rv + 1.55, pad([53, 57, 60, 65], 1.5, 1.0));
  put(rv + 3.0, pad([55, 59, 62, 67], 1.3, 1.1));
  put(rv + 0.0, bassNote(45, 1.4, 0.4));
  put(rv + 1.55, bassNote(41, 1.4, 0.4));
  put(rv + 3.0, bassNote(43, 1.2, 0.45));
  const arp = [69, 72, 76, 81, 76, 72];
  for (let i = 0; i < 12; i++) put(rv + 0.2 + i * 0.25, marimba(arp[i % arp.length] + (i >= 6 ? -4 : 0), 0.5, 0.12));
  put(T.eqOne, bassNote(36, 1.6, 0.6));
  // playful groove after the light bulb
  for (let i = 0; i < 6; i++) {
    const t = T.bulb + 0.3 + i * 0.25;
    put(t, pluck([72, 76, 79, 84, 79, 76][i], 0.35, 0.6, 0.99), 0.12);
    if (i % 2 === 0) put(t, hat(0.08));
  }

  // --- sprint: driving 16ths
  const sp0 = T.crouch2, sp1 = T.arrive;
  for (let t = sp0; t < sp1; t += 0.2) {
    const i = Math.round((t - sp0) / 0.2);
    put(t, hat(0.13, 0.03));
    if (i % 2 === 0) put(t, kick(0.55));
    put(t, bassNote(i % 4 < 2 ? 36 : 48, 0.18, 0.45));
  }
  // riser
  put(sp0, osc(sp1 - sp0, (t) => 200 * Math.pow(6, t / (sp1 - sp0)), (t) => 0.06 * (t / (sp1 - sp0)), 'saw'));

  // --- arrival flourish
  for (const [dt, m] of [[0.3, 79], [0.45, 84], [0.6, 88]]) put(T.arrive + dt, marimba(m, 0.5, 0.25));

  // --- ending: the groove returns while he eats
  const e0 = T.eatGrab - 0.2;
  const endProg = ['F', 'G', 'C'];
  for (let k = 0; k < 3; k++) {
    const t0 = e0 + k * 1.0;
    if (t0 > T.end - 0.4) break;
    const [root, tri] = CH[endProg[k]];
    put(t0, bassNote(root, 0.45, 0.5));
    put(t0 + 0.5, bassNote(root + 7, 0.4, 0.4));
    for (const [dt, idx] of [[0, 0], [0.25, 1], [0.5, 2], [0.75, 1]]) put(t0 + dt, marimba(tri[idx] + 12, 0.5, 0.2));
    for (const dt of [0, 0.5]) put(t0 + dt + 0.25, hat(0.08));
  }
  put(T.end - 0.75, mixAll(pad([60, 64, 67, 72], 0.8, 0.8), bell(84, 0.8, 0.25)));
  return M;
}

// ducking envelope for the music (sidechain-like dips on big hits)
function duck(t) {
  let g = 1;
  for (const c of CUES) {
    if (!['slam', 'bonk', 'stomp'].includes(c.s)) continue;
    const d = t - c.t;
    if (d >= 0 && d < 0.5) g = Math.min(g, 0.45 + 0.55 * (d / 0.5));
  }
  return g;
}

// ------------------------------------------------------------------ render
export function renderAudio(file, duration) {
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n), Rr = new Float32Array(n);
  const send = new Float32Array(n);

  // music with a tape-stop at the end of section A and silence for the gag
  const music = musicBus(duration + 2);
  const mus = new Float32Array(n);
  // tape-stop: playback rate falls to zero, then silence until the reveal
  const tsA = T.lensShut, tsLen = 0.45;
  let readPos = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let amp = 1;
    if (t < tsA || t >= T.reveal) readPos = i;
    else if (t < tsA + tsLen) {
      const u = (t - tsA) / tsLen;
      readPos += 1 - u;
      amp = Math.sqrt(1 - u);
    } else { mus[i] = 0; continue; }
    const ip = Math.floor(readPos), fr = readPos - ip;
    mus[i] = amp * ((music[ip] || 0) * (1 - fr) + (music[ip + 1] || 0) * fr);
  }
  // music mutes: steal -> just before the ending groove, and during rewind
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let g = duck(t);
    if (t > T.steal - 0.02 && t < T.eatGrab - 0.25) g = 0;
    if (t > T.rewind && t < T.crouch2 - 0.02) g *= 0.15;
    mus[i] *= g * 0.9;
  }
  for (let i = 0; i < n; i++) {
    L[i] += mus[i];
    Rr[i] += mus[i];
    send[i] += mus[i] * 0.35;
  }

  // sound effects
  const panFor = (s) => ({ zip: 0.4, snatch: 0.35, cricket: -0.3, birds: 0.1 }[s] || 0);
  const revFor = (s) => ({ merge: 0.6, eqone: 0.5, bulb: 0.5, land: 0.45, popnote: 0.35, sad: 0.4, shimmer: 0.6, arrive: 0.4, love: 0.4 }[s] ?? 0.15);
  const volFor = (s) => ({ slam: 0.9, stomp: 0.8, whoosh: 0.5, skid: 0.6, pop: 0.45, popnote: 0.5, burst: 0.55, merge: 0.75, tick: 0.5, chomp: 0.7 }[s] ?? 0.6);
  const extra = [{ t: T.steal - 0.01, s: 'scratch' }];
  for (const c of [...CUES, ...extra]) {
    const gen = SFX[c.s];
    if (!gen) continue;
    const buf = gen(c);
    const v = volFor(c.s) * (c.s === 'slam' || c.s === 'burst' ? 1 : c.v || 1);
    const pan = panFor(c.s);
    const gl = v * Math.min(1, 1 - pan), gr = v * Math.min(1, 1 + pan);
    const off = Math.round(c.t * SR);
    addInto(L, buf, gl, off);
    addInto(Rr, buf, gr, off);
    addInto(send, buf, v * revFor(c.s), off);
  }

  // reverb
  const rvL = reverb(send, 0.55, 1);
  const rvR = reverb(send, 0.55, 1.03);
  for (let i = 0; i < n; i++) { L[i] += rvL[i]; Rr[i] += rvR[i]; }

  // gentle low cut + master soft clip + normalise
  const hl = biquad('hp', 35), hr = biquad('hp', 35);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(bq(hl, L[i]) * 1.1);
    Rr[i] = Math.tanh(bq(hr, Rr[i]) * 1.1);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
  }
  const norm = peak > 0 ? 0.8 / peak : 1;
  // fades
  const fin = Math.round(0.01 * SR), fout = Math.round(0.35 * SR);
  for (let i = 0; i < n; i++) {
    let g = norm;
    if (i < fin) g *= i / fin;
    if (i > n - fout) g *= (n - i) / fout;
    L[i] *= g; Rr[i] *= g;
  }
  writeWav(file, L, Rr);
}

function writeWav(file, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
