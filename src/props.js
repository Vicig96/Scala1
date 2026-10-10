// Props and math objects: pizza, table, fraction gates, fractions, icons, FX.
import { C, FONT, FONT_BOLD } from './style.js';
import { TAU, clamp, lerp, rng, ease, rgba } from './util.js';
import { heartPath } from './character.js';

// ---------------------------------------------------------------- pizza
// Pizza seen slightly from above. `missing` = slice index removed (or -1),
// `sliceLift` = 0..1 how far that slice has been pulled away (cheese strings).
export const PIZZA = { slices: 8, stolen: 2 }; // slice index 2 sits at the front-right

function sliceAngles(i, n) {
  const a0 = -Math.PI / 2 + (i * TAU) / n + 0.35;
  return [a0, a0 + TAU / n];
}

export function drawPizza(g, cx, cy, rx, ry, opt = {}) {
  const n = PIZZA.slices;
  const missing = opt.missing || [];
  const t = opt.t || 0;
  const thick = 13;
  g.save();
  // plate
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.ellipse(cx, cy + thick * 0.6, rx * 1.12, ry * 1.18, 0, 0, TAU);
  g.fill();
  g.strokeStyle = C.ink;
  g.lineWidth = 4;
  g.stroke();

  const drawBody = () => {
    g.save();
    if (missing.length) {
      // clip away the missing wedges
      g.beginPath();
      g.rect(cx - rx * 2, cy - ry * 3, rx * 4, ry * 6 + thick * 3);
      for (const m of missing) {
        const [a0, a1] = sliceAngles(m, n);
        const am = (a0 + a1) / 2;
        g.moveTo(cx, cy + thick);
        g.lineTo(cx + Math.cos(a1) * rx * 2, cy + Math.sin(a1) * ry * 2 + thick);
        g.lineTo(cx + Math.cos(am) * rx * 3, cy + Math.sin(am) * ry * 3 + thick * 3);
        g.lineTo(cx + Math.cos(a0) * rx * 2, cy + Math.sin(a0) * ry * 2 + thick);
        g.closePath();
      }
      g.clip('evenodd');
    }
    // crust side (thickness)
    g.fillStyle = C.crustDark;
    g.beginPath();
    g.ellipse(cx, cy + thick, rx, ry, 0, 0, TAU);
    g.fill();
    g.fillRect(cx - rx, cy, rx * 2, thick);
    // crust top
    g.fillStyle = C.crust;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    g.fill();
    // sauce + cheese
    g.fillStyle = C.sauce;
    g.beginPath();
    g.ellipse(cx, cy + 1, rx * 0.87, ry * 0.84, 0, 0, TAU);
    g.fill();
    g.fillStyle = C.cheese;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const w = 1 + 0.035 * Math.sin(a * 7 + 1) + 0.025 * Math.sin(a * 11);
      const x = cx + Math.cos(a) * rx * 0.82 * w, y = cy + 1 + Math.sin(a) * ry * 0.78 * w;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.fill();
    // pepperoni & basil
    const r = rng(7);
    const tops = [[-0.45, -0.25], [0.15, -0.45], [0.5, 0.05], [-0.1, 0.35], [-0.6, 0.25], [0.3, 0.5], [0.05, -0.02], [0.62, -0.38]];
    for (const [u, v] of tops) {
      const px = cx + u * rx * 0.85, py = cy + v * ry * 0.85;
      g.fillStyle = C.pepperoni;
      g.beginPath();
      g.ellipse(px, py, rx * 0.11, ry * 0.12, 0, 0, TAU);
      g.fill();
      g.fillStyle = C.pepperoniDark;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(px + (r() - 0.5) * rx * 0.1, py + (r() - 0.5) * ry * 0.1, 2.2, 1.4, 0, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = C.basil;
    for (const [u, v, a] of [[-0.25, -0.05, 0.6], [0.32, -0.12, -0.4], [-0.35, 0.55, 0.2], [0.22, 0.25, 1.2]]) {
      g.beginPath();
      g.ellipse(cx + u * rx * 0.85, cy + v * ry * 0.85, 8, 3.6, a, 0, TAU);
      g.fill();
    }
    // slice cuts
    g.strokeStyle = rgba('#B8742C', 0.55);
    g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const [a0] = sliceAngles(i, n);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * rx * 0.97, cy + Math.sin(a0) * ry * 0.97);
      g.stroke();
    }
    g.restore();
  };
  drawBody();
  // cut edges of missing slices
  if (missing.length) {
    g.strokeStyle = C.crustDark;
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const m of missing) {
      const [a0, a1] = sliceAngles(m, n);
      g.fillStyle = '#EFE8DC';
      g.beginPath();
      g.moveTo(cx, cy + 2);
      g.ellipse(cx, cy + 2, rx * 1.0, ry * 1.0, 0, a0, a1);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
      g.lineTo(cx, cy);
      g.lineTo(cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
      g.stroke();
    }
  }
  g.restore();
}

// A single slice drawn flat-ish at (x, y) – the stolen one.
export function drawSlice(g, x, y, s = 1, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  // tip at origin pointing left, crust at right
  g.fillStyle = C.crustDark;
  g.beginPath();
  g.moveTo(-34, 4);
  g.lineTo(26, -18 + 4);
  g.quadraticCurveTo(36, 4, 26, 24 + 4);
  g.closePath();
  g.fill();
  g.fillStyle = C.cheese;
  g.beginPath();
  g.moveTo(-34, 0);
  g.lineTo(24, -18);
  g.quadraticCurveTo(34, 0, 24, 22);
  g.closePath();
  g.fill();
  g.fillStyle = C.crust;
  g.beginPath();
  g.moveTo(22, -19);
  g.quadraticCurveTo(36, 0, 22, 23);
  g.lineTo(30, 21);
  g.quadraticCurveTo(42, 0, 30, -17);
  g.closePath();
  g.fill();
  g.fillStyle = C.pepperoni;
  g.beginPath(); g.arc(4, -2, 6.5, 0, TAU); g.fill();
  g.beginPath(); g.arc(14, 10, 5, 0, TAU); g.fill();
  g.restore();
}

export function drawTable(g, cx, topY, floorY, w = 160) {
  g.save();
  g.strokeStyle = C.ink;
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(cx - w / 2, topY);
  g.lineTo(cx + w / 2, topY);
  g.stroke();
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(cx, topY);
  g.lineTo(cx, floorY - 6);
  g.moveTo(cx - 34, floorY - 3);
  g.lineTo(cx + 34, floorY - 3);
  g.stroke();
  g.restore();
}

export function drawSteam(g, cx, topY, t, alpha = 1) {
  g.save();
  g.strokeStyle = rgba('#B9AE9B', 0.7 * alpha);
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.55 + k / 3) % 1;
    const x0 = cx + (k - 1) * 30;
    const a = Math.sin(ph * Math.PI);
    g.globalAlpha = a * alpha;
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const y = topY - 18 - ph * 60 - u * 46;
      const x = x0 + Math.sin(u * 5 + t * 4 + k) * 7;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- fractions
export function fracSize(num, den, size) {
  const g = fracSize._g;
  g.font = `${size}px ${FONT}`;
  const wn = g.measureText(String(num)).width;
  const wd = g.measureText(String(den)).width;
  return { w: Math.max(wn, wd) + size * 0.24, h: size * 2.05 };
}

// Stacked fraction centred at (x, y) (y = fraction bar).
export function drawFrac(g, x, y, num, den, size, color, opt = {}) {
  g.save();
  g.translate(x, y);
  if (opt.scale !== undefined) g.scale(opt.scale, opt.scale);
  if (opt.rot) g.rotate(opt.rot);
  const font = opt.bold ? FONT_BOLD : FONT;
  g.font = `${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const wn = g.measureText(String(num)).width;
  const wd = g.measureText(String(den)).width;
  const bw = Math.max(wn, wd) + size * 0.22;
  if (opt.halo) {
    g.lineJoin = 'round';
    g.strokeStyle = opt.halo;
    g.lineWidth = size * 0.28;
    g.strokeText(String(num), 0, -size * 0.17);
    g.strokeText(String(den), 0, size * 0.86);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-bw / 2, 0);
    g.lineTo(bw / 2, 0);
    g.stroke();
  }
  g.fillStyle = color;
  g.fillText(String(num), 0, -size * 0.17);
  g.fillText(String(den), 0, size * 0.86);
  g.strokeStyle = color;
  g.lineWidth = Math.max(3, size * 0.11);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-bw / 2, 0);
  g.lineTo(bw / 2, 0);
  g.stroke();
  g.restore();
  return bw;
}

export function drawText(g, x, y, str, size, color, opt = {}) {
  g.save();
  g.translate(x, y);
  if (opt.scale !== undefined) g.scale(opt.scale, opt.scale);
  if (opt.rot) g.rotate(opt.rot);
  g.font = `${size}px ${opt.bold ? FONT_BOLD : FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opt.halo) {
    g.lineJoin = 'round';
    g.strokeStyle = opt.halo;
    g.lineWidth = size * 0.25;
    g.strokeText(str, 0, size * 0.04);
  }
  g.fillStyle = color;
  g.fillText(str, 0, size * 0.04);
  g.restore();
}

// Math glyphs drawn as strokes (font independent)
export function drawPlus(g, x, y, s, color, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.strokeStyle = color;
  g.lineWidth = s * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-s * 0.32, 0); g.lineTo(s * 0.32, 0);
  g.moveTo(0, -s * 0.32); g.lineTo(0, s * 0.32);
  g.stroke();
  g.restore();
}
export function drawEquals(g, x, y, s, color, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.strokeStyle = color;
  g.lineWidth = s * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-s * 0.34, -s * 0.15); g.lineTo(s * 0.34, -s * 0.15);
  g.moveTo(-s * 0.34, s * 0.15); g.lineTo(s * 0.34, s * 0.15);
  g.stroke();
  g.restore();
}
export function drawDots(g, x, y, s, color, n = 3, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.beginPath();
    g.arc((i - 1) * s * 0.3, 0, s * 0.085, 0, TAU);
    g.fill();
  }
  g.restore();
}
export function drawInfinity(g, x, y, s, color, lw = 7, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * TAU;
    const d = 1 + Math.sin(a) ** 2;
    const px = (s * Math.cos(a)) / d, py = (s * Math.sin(a) * Math.cos(a)) / d;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- gate
// A fraction gate: a coloured post planted in the floor.
// h = visible height, bend = horizontal offset of the top (wobble)
export function drawGate(g, x, floorY, h, color, opt = {}) {
  if (h <= 0.5) return;
  const bend = opt.bend || 0;
  const w = opt.width || 12;
  g.save();
  if (opt.alpha !== undefined) g.globalAlpha *= opt.alpha;
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, floorY);
  g.quadraticCurveTo(x, floorY - h * 0.5, x + bend, floorY - h);
  g.stroke();
  // ball on top
  if (h > 30) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + bend, floorY - h, w * 0.95, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(x + bend - w * 0.3, floorY - h - w * 0.3, w * 0.3, 0, TAU);
    g.fill();
  }
  g.restore();
}

// Dashed hop arc between two floor points with an arrow head.
export function drawArc(g, xa, xb, floorY, color, progress = 1, lift = 0, alpha = 1) {
  const span = xb - xa;
  const hgt = Math.min(Math.abs(span) * 0.42, 150) + lift;
  const mx = (xa + xb) / 2, my = floorY - 10 - hgt * 2 * 0.98;
  const pt = (u) => {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * xa + b * mx + c * xb, a * (floorY - 10) + b * my + c * (floorY - 10)];
  };
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.setLineDash([2, 14]);
  g.beginPath();
  const N = 40;
  for (let i = 0; i <= N * progress; i++) {
    const [x, y] = pt(i / N);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.setLineDash([]);
  if (progress > 0.95) {
    const [x, y] = pt(1), [x2, y2] = pt(0.94);
    const a = Math.atan2(y - y2, x - x2);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    g.lineTo(x + Math.cos(a + 2.5) * 16, y + Math.sin(a + 2.5) * 16);
    g.lineTo(x + Math.cos(a - 2.5) * 16, y + Math.sin(a - 2.5) * 16);
    g.closePath();
    g.fill();
  }
  g.restore();
  return [mx, floorY - 10 - hgt];
}

// ---------------------------------------------------------------- icons
export function drawBang(g, x, y, s, scale = 1, color = C.ink, rot = 0) {
  drawText(g, x, y, '!', s, color, { scale, bold: true, rot });
}
export function drawQuestion(g, x, y, s, scale = 1, color = C.ink, rot = 0) {
  drawText(g, x, y, '?', s, color, { scale, bold: true, rot });
}

export function drawBulb(g, x, y, s, glow = 1, t = 0) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (glow > 0) {
    g.strokeStyle = rgba('#F5B700', 0.9 * glow);
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const r0 = 40 + Math.sin(t * 10 + i) * 2, r1 = 52 + 6 * glow;
      if (Math.sin(a) > 0.5) continue;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
      g.stroke();
    }
    g.fillStyle = rgba('#FFE066', 0.35 * glow);
    g.beginPath();
    g.arc(0, -4, 44, 0, TAU);
    g.fill();
  }
  g.fillStyle = C.bulb;
  g.strokeStyle = C.ink;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, -8, 24, Math.PI * 0.8, Math.PI * 2.2);
  g.lineTo(9, 22);
  g.lineTo(-9, 22);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = C.ink;
  g.fillRect(-10, 24, 20, 6);
  g.fillRect(-7, 32, 14, 5);
  g.restore();
}

export function drawStar4(g, x, y, r, color, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = i % 2 ? r * 0.28 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

export function drawCloud(g, x, y, s, fill, stroke) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const bumps = [[-38, 6, 24], [-14, -12, 30], [16, -14, 28], [40, 4, 22], [0, 10, 28]];
  g.beginPath();
  for (const [bx, by, r] of bumps) {
    g.moveTo(bx + r, by);
    g.arc(bx, by, r, 0, TAU);
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 10 / s;
    g.stroke();
  }
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

// Scribbled frustration cloud (tangled loops)
export function drawScribble(g, x, y, s, t, seed = 3) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = C.ink;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const r = rng(seed + Math.floor(t * 12));
  g.beginPath();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU * 3 + r() * 0.6;
    const rr = s * (0.55 + r() * 0.45);
    const px = Math.cos(a) * rr * 1.35, py = Math.sin(a) * rr * 0.75;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.stroke();
  g.restore();
}

export function drawRewind(g, x, y, s, alpha) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.fillStyle = C.ink;
  for (const dx of [0, s * 0.9]) {
    g.beginPath();
    g.moveTo(dx - s * 0.9, 0);
    g.lineTo(dx, -s * 0.55);
    g.lineTo(dx, s * 0.55);
    g.closePath();
    g.fill();
  }
  g.restore();
}

export function drawSweat(g, x, y, s, color = C.drool) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + s * 0.8, y + s * 0.2, x, y + s * 0.6);
  g.quadraticCurveTo(x - s * 0.8, y + s * 0.2, x, y - s);
  g.fill();
  g.restore();
}

export { heartPath };

// ---------------------------------------------------------------- particles
// Deterministic particle bursts: each burst is fully defined by its spawn
// time and seed, so any frame can be rendered independently.
export function dustBurst(g, x, y, t0, t, opt = {}) {
  const dt = t - t0;
  const life = opt.life || 0.55;
  if (dt < 0 || dt > life) return;
  const r = rng(opt.seed || Math.floor(x * 7 + t0 * 1000));
  const n = opt.n || 7;
  const dirn = opt.dir ?? 0; // -1 left only, 1 right only, 0 both
  const u = dt / life;
  g.save();
  for (let i = 0; i < n; i++) {
    let side = dirn || (i % 2 ? 1 : -1);
    const sp = (opt.speed || 120) * (0.5 + r());
    const px = x + side * sp * ease.outCubic(u) * (0.6 + r() * 0.6);
    const py = y - (opt.rise || 30) * ease.outCubic(u) * (0.4 + r()) - 4;
    const rad = (opt.size || 14) * (0.6 + r() * 0.7) * (0.6 + u * 0.8);
    g.globalAlpha = (1 - u) * (opt.alpha || 0.9);
    g.fillStyle = opt.color || C.dust;
    g.beginPath();
    g.arc(px, py, rad, 0, TAU);
    g.fill();
  }
  g.restore();
}

export function speedLines(g, x, y, h, dirn, strength, t) {
  if (strength <= 0.02) return;
  g.save();
  g.strokeStyle = rgba(C.ink, 0.35 * clamp(strength));
  g.lineWidth = 4;
  g.lineCap = 'round';
  const r = rng(Math.floor(t * 30));
  for (let i = 0; i < 5; i++) {
    const yy = y - r() * h;
    const len = (40 + r() * 70) * strength;
    const xx = x - dirn * (30 + r() * 40);
    g.beginPath();
    g.moveTo(xx, yy);
    g.lineTo(xx - dirn * len, yy);
    g.stroke();
  }
  g.restore();
}

export function sparkleBurst(g, x, y, t0, t, opt = {}) {
  const dt = t - t0;
  const life = opt.life || 0.8;
  if (dt < 0 || dt > life) return;
  const r = rng(opt.seed || 11);
  const n = opt.n || 10;
  const u = dt / life;
  const colors = opt.colors || [C.gold];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const sp = (opt.radius || 120) * (0.5 + r() * 0.6);
    const px = x + Math.cos(a) * sp * ease.outCubic(u) * (opt.sx || 1);
    const py = y + Math.sin(a) * sp * ease.outCubic(u) * (opt.sy || 1) + (opt.gravity || 0) * u * u;
    const s = (opt.size || 12) * (1 - u) * (0.6 + r() * 0.8);
    drawStar4(g, px, py, s, colors[i % colors.length], u * 3 + i);
  }
}

// Gate shards when burst through
export function shards(g, x, floorY, h, color, t0, t, dirn = 1, seed = 5) {
  const dt = t - t0;
  const life = 0.55;
  if (dt < 0 || dt > life) return;
  const r = rng(seed);
  const n = 5;
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 10;
  for (let i = 0; i < n; i++) {
    const y0 = floorY - (i + 0.5) * (h / n);
    const vx = dirn * (220 + r() * 300), vy = -(120 + r() * 260);
    const px = x + vx * dt;
    const py = Math.min(floorY - 6, y0 + vy * dt + 1500 * dt * dt);
    const a = (r() - 0.5) * 16 * dt + Math.PI / 2;
    const len = h / n / 2.6;
    g.globalAlpha = clamp(1.4 - dt / life * 1.4);
    g.beginPath();
    g.moveTo(px - Math.cos(a) * len, py - Math.sin(a) * len);
    g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    g.stroke();
  }
  g.restore();
}
