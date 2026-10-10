// Small math / animation helpers shared by the video and audio renderers.

export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const range01 = (t, a, b) => clamp(invLerp(a, b, t));
export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};

// Easings (u in 0..1)
export const ease = {
  linear: (u) => u,
  inQuad: (u) => u * u,
  outQuad: (u) => 1 - (1 - u) * (1 - u),
  inOutQuad: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  inCubic: (u) => u * u * u,
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outQuart: (u) => 1 - Math.pow(1 - u, 4),
  inQuart: (u) => u * u * u * u,
  inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  outSine: (u) => Math.sin((u * Math.PI) / 2),
  inSine: (u) => 1 - Math.cos((u * Math.PI) / 2),
  outBack: (u) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  },
  outBackBig: (u) => {
    const c1 = 3.0, c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  },
  inBack: (u) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * u * u * u - c1 * u * u;
  },
  outElastic: (u) => {
    if (u === 0 || u === 1) return u;
    return Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (TAU / 3)) + 1;
  },
  step: (u) => (u < 1 ? 0 : 1),
  hold: () => 0,
};

// Accelerate / cruise / decelerate profile, normalised position for u in 0..1.
// a = fraction of time accelerating, d = fraction decelerating.
export function trapez(u, a = 0.25, d = 0.25) {
  u = clamp(u);
  const c = 1 - a - d;
  const vmax = 1 / (a / 2 + c + d / 2);
  if (u < a) return (vmax * u * u) / (2 * a);
  const pa = (vmax * a) / 2;
  if (u < a + c) return pa + vmax * (u - a);
  const pc = pa + vmax * c;
  if (d <= 0) return Math.min(1, pc);
  const ud = u - a - c;
  return pc + vmax * ud - (vmax * ud * ud) / (2 * d);
}

// Damped oscillation, starts at 1 when dt = 0
export function spring(dt, freq = 6, decay = 6) {
  if (dt < 0) return 0;
  return Math.exp(-decay * dt) * Math.cos(TAU * freq * dt);
}
// Damped sine (starts at 0)
export function wobble(dt, freq = 6, decay = 6) {
  if (dt < 0) return 0;
  return Math.exp(-decay * dt) * Math.sin(TAU * freq * dt);
}

// Seeded RNG
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D smooth value noise in -1..1
const NOISE = (() => {
  const r = rng(1234);
  return Array.from({ length: 512 }, () => r() * 2 - 1);
})();
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = NOISE[((i % 512) + 512) % 512], b = NOISE[(((i + 1) % 512) + 512) % 512];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

// Recursive interpolation of numbers / plain objects / arrays.
// Non-numeric leaves snap to `a` until t reaches 1.
export function mix(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out[k] = b[k];
      else if (!(k in b)) out[k] = a[k];
      else out[k] = mix(a[k], b[k], t);
    }
    return out;
  }
  return t >= 1 ? b : a;
}

// Keyframe track: keys = [[time, value, easeName?], ...] (ease applies to the
// segment that *ends* at that key). Returns f(t).
export function track(keys) {
  const ks = keys.map(([t, v, e]) => ({ t, v, e: e || 'inOutSine' }));
  return (t) => {
    if (t <= ks[0].t) return ks[0].v;
    for (let i = 1; i < ks.length; i++) {
      if (t < ks[i].t) {
        const k0 = ks[i - 1], k1 = ks[i];
        const fn = typeof k1.e === 'function' ? k1.e : ease[k1.e];
        const u = fn((t - k0.t) / (k1.t - k0.t));
        return mix(k0.v, k1.v, u);
      }
    }
    return ks[ks.length - 1].v;
  };
}

// Merge-override helper: deep-assign b over a
export function over(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') {
      out[k] = over(a[k], b[k]);
    } else out[k] = b[k];
  }
  return out;
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))));
  return `rgb(${r[0]},${r[1]},${r[2]})`;
}
export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
