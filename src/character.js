// Rigged stick figure ("el monigote"): pose = joint angles, expr = face.
import { C } from './style.js';
import { TAU, clamp, lerp, mix } from './util.js';

export const RIG = {
  head: 40,
  torso: 84,
  neck: 7,
  upperArm: 48,
  foreArm: 46,
  thigh: 54,
  shin: 54,
  line: 11,
  hand: 7.5,
  foot: 15,
  lead: 24, // distance from hip to the front of the body (used for "touching")
};

// Angles: 0 = straight down, positive = towards facing direction.
// Arms: a2 > 0 bends the forearm forward/up. Legs: a2 < 0 bends the shin back.
export const POSES = {
  idle: {
    lean: 0.02, headTilt: 0, armF: [0.18, 0.25], armB: [-0.16, 0.2],
    legF: [0.13, -0.04], legB: [-0.13, -0.04], lift: 0,
  },
  crouch: {
    lean: 0.42, headTilt: -0.15, armF: [-0.9, 0.6], armB: [-1.15, 0.5],
    legF: [0.75, -1.45], legB: [-0.25, -1.1], lift: 0,
  },
  skid: {
    lean: -0.32, headTilt: 0.12, armF: [-0.6, 1.1], armB: [-2.1, 0.6],
    legF: [0.32, -0.05], legB: [-0.18, -0.9], lift: 0,
  },
  stopBrace: {
    lean: -0.1, headTilt: 0.05, armF: [0.5, 1.4], armB: [-0.6, 0.6],
    legF: [0.25, -0.08], legB: [-0.2, -0.4], lift: 0,
  },
  bonk: {
    lean: -0.35, headTilt: -0.25, armF: [2.4, 0.5], armB: [-2.3, 0.4],
    legF: [0.55, -0.3], legB: [-0.25, -0.6], lift: 0,
  },
  daze: {
    lean: -0.08, headTilt: 0.18, armF: [0.35, 0.1], armB: [-0.35, 0.1],
    legF: [0.25, -0.15], legB: [-0.22, -0.15], lift: 0,
  },
  reach: {
    lean: 0.18, headTilt: -0.05, armF: [1.42, 0.08], armB: [1.1, 0.25],
    legF: [0.32, -0.08], legB: [-0.38, -0.05], lift: 0,
  },
  reachMax: {
    lean: 0.28, headTilt: -0.08, armF: [1.5, 0.0], armB: [1.25, 0.15],
    legF: [0.4, -0.05], legB: [-0.55, -0.02], lift: 6,
  },
  armsUp: { // tantrum: fists up
    lean: -0.05, headTilt: -0.2, armF: [2.6, 0.7], armB: [-2.6, -0.7],
    legF: [0.3, -0.5], legB: [-0.3, -0.5], lift: 0,
  },
  stomp: {
    lean: 0.08, headTilt: 0.15, armF: [0.6, 1.9], armB: [-0.6, -1.9],
    legF: [0.55, -1.5], legB: [-0.12, -0.05], lift: 0,
  },
  sit: {
    lean: 0.38, headTilt: 0.4, armF: [1.2, 0.6], armB: [1.0, 0.7],
    legF: [2.15, -1.55], legB: [1.95, -1.4], lift: 0, sit: 1,
  },
  sitLookUp: {
    lean: -0.05, headTilt: -0.45, armF: [0.9, 0.5], armB: [0.7, 0.6],
    legF: [2.15, -1.55], legB: [1.95, -1.4], lift: 0, sit: 1,
  },
  pointUp: {
    lean: -0.04, headTilt: -0.3, armF: [2.75, 0.15], armB: [-0.2, 0.25],
    legF: [0.15, -0.04], legB: [-0.15, -0.04], lift: 0,
  },
  grabPrep: {
    lean: 0.22, headTilt: 0.0, armF: [1.2, 0.9], armB: [0.95, 1.1],
    legF: [0.25, -0.1], legB: [-0.3, -0.06], lift: 0,
  },
  grab: {
    lean: 0.38, headTilt: 0.1, armF: [1.25, 0.25], armB: [1.05, 0.35],
    legF: [0.35, -0.06], legB: [-0.4, -0.04], lift: 0,
  },
  shrug: {
    lean: 0.0, headTilt: 0.12, armF: [0.7, 1.7], armB: [-0.7, -1.7],
    legF: [0.13, -0.04], legB: [-0.13, -0.04], lift: 0,
  },
  eat: {
    lean: 0.04, headTilt: 0.05, armF: [0.55, 2.3], armB: [-0.2, 0.3],
    legF: [0.13, -0.04], legB: [-0.13, -0.04], lift: 0,
  },
  rubHands: {
    lean: 0.08, headTilt: -0.05, armF: [0.55, 1.5], armB: [0.2, 1.75],
    legF: [0.13, -0.04], legB: [-0.13, -0.04], lift: 0,
  },
};

export const EXPR = {
  neutral: { look: [0, 0], turn: 0, eyeScale: 1, pupil: 1, lid: 0, slant: 0, lower: 0, heart: 0, spiral: 0, happy: 0, mouth: 'smile', mouthW: 9, curve: 4, open: 0, drool: 0, mouthSide: 0 },
};
export const expr = (o) => ({ ...EXPR.neutral, ...o });

// Run cycle (phase in cycles). Returns pose overrides.
export function runPose(phase, intensity = 1, sprint = 0) {
  const w = phase * TAU;
  const A = 0.62 + 0.12 * sprint;
  const leg = (o) => {
    const a1 = 0.1 + A * Math.sin(w + o);
    const sw = Math.max(0, Math.cos(w + o));
    const a2 = -(0.18 + (1.45 + 0.35 * sprint) * Math.pow(sw, 1.4));
    return [a1, a2];
  };
  const armSwing = 0.85 + 0.25 * sprint;
  return {
    lean: 0.24 + 0.2 * sprint,
    headTilt: -0.12,
    legF: leg(0),
    legB: leg(Math.PI),
    armF: [0.15 - armSwing * Math.sin(w), 1.45],
    armB: [0.15 + armSwing * Math.sin(w), 1.45],
    lift: 7 * Math.abs(Math.sin(w * 1)) * intensity,
  };
}

const dir = (face, a) => [face * Math.sin(a), Math.cos(a)];

function limb(g, sx, sy, face, a1, a2, l1, l2, width, color, endR, isLeg, footAngle) {
  const d1 = dir(face, a1), d2 = dir(face, a1 + a2);
  const ex = sx + d1[0] * l1, ey = sy + d1[1] * l1;
  const hx = ex + d2[0] * l2, hy = ey + d2[1] * l2;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(ex, ey);
  g.lineTo(hx, hy);
  g.stroke();
  if (isLeg) {
    // little foot pointing forward
    const fa = footAngle || 0;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx + face * Math.cos(fa) * RIG.foot, hy + Math.sin(fa) * RIG.foot);
    g.stroke();
  } else if (endR) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(hx, hy, endR, 0, TAU);
    g.fill();
  }
  return [hx, hy];
}

export function legExtent(a1, a2) {
  return RIG.thigh * Math.cos(a1) + RIG.shin * Math.cos(a1 + a2);
}

// Character state:
// { x, y (floor y under the hip), face, pose, expr, scale, sx, sy, hair, headScale, bandana, alpha, t }
export function drawCharacter(g, s) {
  const p = s.pose;
  const e = s.expr;
  const face = s.face || 1;
  const scale = s.scale || 1;
  const lw = RIG.line;
  g.save();
  g.translate(s.x, s.y);
  if (s.rot) g.rotate(s.rot);
  g.scale(scale * (s.sx || 1), scale * (s.sy || 1));
  if (s.alpha !== undefined) g.globalAlpha *= s.alpha;

  // Ground the hip: lowest foot touches the floor (y=0 locally)
  const extF = legExtent(p.legF[0], p.legF[1]);
  const extB = legExtent(p.legB[0], p.legB[1]);
  const stand = Math.max(extF, extB) + lw / 2;
  let hipY = -(p.sit ? lerp(stand, Math.max(lw * 0.9, stand), p.sit) : stand);
  hipY -= p.lift || 0;
  hipY -= s.jump || 0;
  const hipX = 0;

  const lean = p.lean;
  const td = [face * Math.sin(lean), -Math.cos(lean)];
  const neckX = hipX + td[0] * RIG.torso, neckY = hipY + td[1] * RIG.torso;
  const shX = hipX + td[0] * (RIG.torso - 10), shY = hipY + td[1] * (RIG.torso - 10);

  const backCol = s.mini ? C.inkBack : C.inkBack;
  // back limbs
  limb(g, hipX, hipY, face, p.legB[0], p.legB[1], RIG.thigh, RIG.shin, lw, backCol, 0, true, p.footB || 0);
  limb(g, shX, shY, face, p.armB[0], p.armB[1], RIG.upperArm, RIG.foreArm, lw, backCol, RIG.hand);
  // torso
  g.strokeStyle = C.ink;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hipX, hipY);
  g.lineTo(neckX, neckY);
  g.stroke();
  // front leg
  limb(g, hipX, hipY, face, p.legF[0], p.legF[1], RIG.thigh, RIG.shin, lw, C.ink, 0, true, p.footF || 0);

  // head
  const hs = s.headScale || 1;
  const hr = RIG.head * hs;
  const ha = lean + (p.headTilt || 0);
  const hd = [face * Math.sin(ha), -Math.cos(ha)];
  const hx = neckX + hd[0] * (RIG.neck + hr);
  const hy = neckY + hd[1] * (RIG.neck + hr);
  drawHair(g, hx, hy, hr, ha * face, s);
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(hx, hy, hr, 0, TAU);
  g.fill();
  if (s.bandana) drawBandana(g, hx, hy, hr, ha * face, face, s.t || 0, s.speed || 0);
  drawFace(g, hx, hy, hr, ha * face, face, e, s.t || 0);

  // front arm last (over body)
  const hand = limb(g, shX, shY, face, p.armF[0], p.armF[1], RIG.upperArm, RIG.foreArm, lw, C.ink, RIG.hand);
  if (s.holding) s.holding(g, hand[0], hand[1]);
  g.restore();

  // expose some world-space anchors for effects
  const toWorld = (lx, ly) => [s.x + lx * scale * (s.sx || 1), s.y + ly * scale * (s.sy || 1)];
  return { head: toWorld(hx, hy), headR: hr * scale, hand: toWorld(hand[0], hand[1]), hip: toWorld(hipX, hipY) };
}

// Standalone anchor computation (no drawing) — used to place props relative to the body.
export function anchors(s) {
  const p = s.pose, face = s.face || 1, scale = s.scale || 1;
  const extF = legExtent(p.legF[0], p.legF[1]);
  const extB = legExtent(p.legB[0], p.legB[1]);
  const stand = Math.max(extF, extB) + RIG.line / 2;
  let hipY = -(p.sit ? lerp(stand, Math.max(RIG.line * 0.9, stand), p.sit) : stand);
  hipY -= (p.lift || 0) + (s.jump || 0);
  const lean = p.lean;
  const td = [face * Math.sin(lean), -Math.cos(lean)];
  const neckX = td[0] * RIG.torso, neckY = hipY + td[1] * RIG.torso;
  const shX = td[0] * (RIG.torso - 10), shY = hipY + td[1] * (RIG.torso - 10);
  const hr = RIG.head * (s.headScale || 1);
  const ha = lean + (p.headTilt || 0);
  const hd = [face * Math.sin(ha), -Math.cos(ha)];
  const hx = neckX + hd[0] * (RIG.neck + hr), hy = neckY + hd[1] * (RIG.neck + hr);
  const d1 = dir(face, p.armF[0]), d2 = dir(face, p.armF[0] + p.armF[1]);
  const handX = shX + d1[0] * RIG.upperArm + d2[0] * RIG.foreArm;
  const handY = shY + d1[1] * RIG.upperArm + d2[1] * RIG.foreArm;
  const W = (lx, ly) => [s.x + lx * scale * (s.sx || 1), s.y + ly * scale * (s.sy || 1)];
  return { head: W(hx, hy), headR: hr * scale, hand: W(handX, handY), hip: W(0, hipY), neck: W(neckX, neckY) };
}

function drawHair(g, hx, hy, hr, ang, s) {
  const t = s.t || 0;
  const wob = (s.hairWobble || 0) + Math.sin(t * 3.1) * 0.06;
  g.save();
  g.translate(hx, hy);
  g.rotate(ang + wob);
  g.translate(0, -hr + 3);
  g.strokeStyle = C.ink;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (s.mini) {
    // three little spikes
    for (const [dx, a] of [[-8, -0.5], [0, 0], [8, 0.5]]) {
      g.beginPath();
      g.moveTo(dx, 2);
      g.lineTo(dx + Math.sin(a + wob * 2) * 12, 2 - Math.cos(a) * 13);
      g.stroke();
    }
  } else {
    // signature single curl
    const k = 1 + (s.hairBoing || 0);
    g.beginPath();
    g.moveTo(0, 2);
    g.bezierCurveTo(2, -10 * k, -12, -16 * k, -6, -26 * k);
    g.bezierCurveTo(-1, -33 * k, 11, -30 * k, 9, -21 * k);
    g.bezierCurveTo(7, -15 * k, 0, -17 * k, 1, -22 * k);
    g.stroke();
  }
  g.restore();
}

function drawBandana(g, hx, hy, hr, ang, face, t, speed) {
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  g.fillStyle = C.bandana;
  // band across the forehead
  g.beginPath();
  g.ellipse(0, -hr * 0.42, hr * 1.02, hr * 0.26, 0, 0, TAU);
  g.save();
  g.clip();
  g.fillRect(-hr * 1.2, -hr * 0.75, hr * 2.4, hr * 0.55);
  g.restore();
  // knot tails fluttering behind
  const flap = Math.sin(t * 22) * (0.25 + speed * 0.4);
  const bx = -face * hr * 0.95, by = -hr * 0.45;
  for (const k of [0, 1]) {
    const a = (k ? 0.35 : -0.15) + flap * (k ? 1 : -0.8);
    g.beginPath();
    g.moveTo(bx, by - 4);
    g.quadraticCurveTo(bx - face * hr * 0.6, by - 6 + a * 20, bx - face * hr * (0.9 + 0.2 * k), by + 4 + a * 26);
    g.lineTo(bx - face * hr * (0.7 + 0.2 * k), by + 10 + a * 20);
    g.quadraticCurveTo(bx - face * hr * 0.4, by + 4, bx, by + 4);
    g.fill();
  }
  g.restore();
}

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

function drawFace(g, hx, hy, hr, ang, face, e, t) {
  const k = hr / RIG.head;
  g.save();
  g.translate(hx, hy);
  g.rotate(ang * 0.6);
  g.scale(k, k);
  const turn = e.turn * face;
  const ex = 15, ey = -1;
  const shift = turn * 13;
  const blinkLid = e.lid;
  for (const side of [-1, 1]) {
    const cx = side * ex + shift - (turn * side > 0 ? 0 : 0);
    const cy = ey;
    const rx = 10.5 * e.eyeScale, ry = 13 * e.eyeScale;
    if (e.heart > 0.01) {
      const pulse = 1 + 0.12 * Math.sin(t * 14);
      g.fillStyle = C.heart;
      heartPath(g, cx, cy + 3, 13 * e.heart * pulse);
      g.fill();
      continue;
    }
    if (e.happy > 0.5) {
      // ^ ^ eyes
      g.strokeStyle = C.white;
      g.lineWidth = 4.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - 8, cy + 4);
      g.quadraticCurveTo(cx, cy - 10, cx + 8, cy + 4);
      g.stroke();
      continue;
    }
    if (e.spiral > 0.01) {
      g.strokeStyle = C.white;
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i * 0.45 + t * 12 * side;
        const r = i * 0.27;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
      continue;
    }
    // white of the eye
    g.save();
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    g.fillStyle = C.white;
    g.fill();
    g.clip();
    // pupil
    const px = cx + clamp(e.look[0] + turn * 0.5, -1.3, 1.3) * 4.6 * e.eyeScale;
    const py = cy + e.look[1] * 6 * e.eyeScale;
    const pr = 5.8 * e.pupil;
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    g.fillStyle = C.white;
    g.beginPath();
    g.arc(px + pr * 0.35, py - pr * 0.4, pr * 0.28, 0, TAU);
    g.fill();
    // upper lid (with slant: >0 angry, <0 sad)
    const lid = clamp(blinkLid);
    if (lid > 0.001 || Math.abs(e.slant) > 0.001) {
      const top = cy - ry - 2;
      const base = top + (ry * 2 + 4) * lid;
      const sl = e.slant * -side; // inner corner is towards the centre
      g.fillStyle = C.ink;
      g.beginPath();
      g.moveTo(cx - rx - 4, top - 20);
      g.lineTo(cx + rx + 4, top - 20);
      g.lineTo(cx + rx + 4, base + sl * (rx + 4) * 1.4);
      g.lineTo(cx - rx - 4, base - sl * (rx + 4) * 1.4);
      g.closePath();
      g.fill();
    }
    if (e.lower > 0.001) {
      g.fillStyle = C.ink;
      g.fillRect(cx - rx - 2, cy + ry - ry * 2 * e.lower * 0.5, rx * 2 + 4, ry * 2);
    }
    g.restore();
  }

  // mouth
  const mx = shift * 0.95 + e.mouthSide * 5, my = 21;
  g.strokeStyle = C.white;
  g.fillStyle = C.white;
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const w = e.mouthW;
  switch (e.mouth) {
    case 'smile':
    case 'flat':
    case 'frown': {
      g.beginPath();
      g.moveTo(mx - w, my - e.curve * 0.25);
      g.quadraticCurveTo(mx, my + e.curve, mx + w, my - e.curve * 0.25);
      g.stroke();
      break;
    }
    case 'smirk': {
      g.beginPath();
      g.moveTo(mx - w, my + 2);
      g.quadraticCurveTo(mx + 2, my + 5, mx + w + 2, my - 6);
      g.stroke();
      break;
    }
    case 'open':
    case 'o': {
      const ow = e.mouth === 'o' ? 6 + e.open * 3 : w + 1;
      const oh = 4 + e.open * 11;
      g.beginPath();
      g.ellipse(mx, my + oh * 0.3, ow, oh, 0, 0, TAU);
      g.fillStyle = C.mouth;
      g.fill();
      g.lineWidth = 3;
      g.stroke();
      break;
    }
    case 'grin': {
      const gw = w + 4, gh = 7 + e.open * 7;
      g.beginPath();
      g.moveTo(mx - gw, my - 3);
      g.lineTo(mx + gw, my - 3);
      g.quadraticCurveTo(mx + gw, my + gh * 1.4, mx, my + gh * 1.25);
      g.quadraticCurveTo(mx - gw, my + gh * 1.4, mx - gw, my - 3);
      g.closePath();
      g.fill();
      break;
    }
    case 'grit': {
      // clenched teeth
      const gw = w + 5, gh = 6 + e.open * 4;
      g.beginPath();
      g.roundRect(mx - gw, my - gh / 2, gw * 2, gh, 3);
      g.fill();
      g.strokeStyle = C.ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(mx - gw, my);
      g.lineTo(mx + gw, my);
      for (const dx of [-gw / 2, 0, gw / 2]) { g.moveTo(mx + dx, my - gh / 2); g.lineTo(mx + dx, my + gh / 2); }
      g.stroke();
      break;
    }
    case 'wavy': {
      g.lineWidth = 3.6;
      g.beginPath();
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const x = mx - w - 2 + (i * (2 * w + 4)) / n;
        const y = my + (i % 2 ? -3 : 3);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      break;
    }
    case 'chew': {
      const o = 0.5 + 0.5 * Math.sin(t * 22);
      g.beginPath();
      g.ellipse(mx, my + 2, w * 0.8, 2 + o * 6, 0, 0, TAU);
      g.fillStyle = C.mouth;
      g.fill();
      g.lineWidth = 3;
      g.stroke();
      break;
    }
  }
  if (e.drool > 0.01) {
    const dy = my + 6 + e.drool * 14;
    g.fillStyle = C.drool;
    g.beginPath();
    g.moveTo(mx + w * 0.7, my + 2);
    g.quadraticCurveTo(mx + w * 0.7 + 5, dy, mx + w * 0.7, dy + 6);
    g.quadraticCurveTo(mx + w * 0.7 - 5, dy, mx + w * 0.7, my + 2);
    g.fill();
  }
  g.restore();
}

export { heartPath, mix };
