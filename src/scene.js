// "Mates sin palabras" — Zenón y la pizza.
// The whole film is a pure function of time: drawFrame(g, t).
import { createCanvas } from '@napi-rs/canvas';
import { C, W, H, FLOOR, X0, X1, L, BAR_Y, BAR_H, EQ_Y, CHAR_SCALE as CS, WATERMARK, FONT, posOf, fracColor } from './style.js';
import * as U from './util.js';
import { clamp, lerp, ease, track, over, range01, mix, rgba, TAU } from './util.js';
import { drawCharacter, anchors, POSES, runPose, expr, RIG } from './character.js';
import * as P from './props.js';

P.fracSize._g = createCanvas(8, 8).getContext('2d');

export const FPS_DEFAULT = 60;
export const DURATION = 32.0;

// ------------------------------------------------------------------ layout
const LEAD = (RIG.lead + 7) * CS; // hip -> touching point (incl. half gate width)
const hipAt = (x) => x - LEAD;
const G = [null, posOf(1 / 2), posOf(3 / 4), posOf(7 / 8), posOf(15 / 16)];
const TABLE = { cx: 885, top: FLOOR - 136, w: 172 };
const PZ = { cx: 885, cy: TABLE.top - 26, rx: 88, ry: 34 }; // pizza
const GATE_H = 340;
const EQ_SIZE = 64;

// ------------------------------------------------------------------ key times
export const T = {
  turn: 0.55, bang: 0.7, whip: 0.95, hearts: 1.68,
  bar: 2.15, numline: 2.25,
  crouch1: 3.3, go1: 3.72, slam1: 3.86, stop1: 4.62, q1: 4.72, fill1: 5.0, ret1: 5.22,
  go2: 5.52, slam2: 5.62, stop2: 6.12, fill2: 6.55, ret2: 6.8,
  go3: 6.95, slam3: 7.14, bonk: 7.30, fill3: 8.25, ret3: 8.5,
  hop: 8.85, slam4: 8.98, land4: 9.25, fill4: 9.35, ret4: 9.55,
  lensOpen: 9.95, lensSteps: [10.4, 11.25, 11.95, 12.55], lensDur: [0.85, 0.7, 0.6, 0.5],
  flurry: 13.05, lensClose: 13.6, lensShut: 13.95,
  tantrum: 14.0, stomps: [14.3, 14.6, 14.9], slump: 15.25, sitThud: 15.55,
  reveal: 16.45, lookUp: 16.85, tail: 17.05, merges: [17.6, 18.2, 18.8, 19.4, 20.0], eqOne: 20.4,
  standUp: 20.6, bulb: 20.95, point: 21.55,
  rewind: 22.65, rewindEnd: 23.55,
  crouch2: 23.7, sprint: 24.05, sprintDur: 1.6,
  grabPrep: 26.4, miniIn: 26.38, steal: 26.66, grab: 26.75, see: 26.95, minus: 27.0,
  deadpan: 27.42, miniSlam: 27.55, miniQ: 27.85, lookMini: 28.15, smirk: 28.55, shrug: 28.7,
  eatGrab: 29.25, eatPick: 29.45, miniSlam2: 29.7, end: 32.0,
};
T.arrive = T.sprint + T.sprintDur;
const sprintGateT = (k) => T.sprint + T.sprintDur * (1 - Math.pow(2, -k)); // burst through gate k
const sprintAppearT = (k) => T.sprint + T.sprintDur * (1 - Math.pow(2, -(k - 1))) - (k === 1 ? 0.1 : 0);

// ------------------------------------------------------------------ audio cues
// (consumed by audio.js so picture and sound share one timeline)
export const CUES = [];
const cue = (t, s, o = {}) => CUES.push({ t, s, ...o });
cue(0.0, 'steam', { v: 0.25 });
cue(T.bang, 'pop', { p: 1.3 });
cue(T.whip, 'whoosh', { v: 0.5 });
cue(T.whip + 0.22, 'bulb', { v: 0.5 });
cue(T.hearts, 'love');
cue(T.bar, 'draw');
cue(T.numline + 0.25, 'pop', { p: 0.9 });
cue(T.numline + 0.45, 'pop', { p: 1.1 });
cue(T.crouch1, 'windup');
cue(T.go1, 'whoosh');
[[T.slam1, 1], [T.slam2, 2], [T.slam3, 3], [T.slam4, 4]].forEach(([t, k]) => {
  cue(t, 'slam', { v: 1 }); cue(t + 0.12, 'popnote', { k });
});
cue(4.36, 'skid');
cue(T.q1, 'question');
[[T.fill1, 1], [T.fill2, 2], [T.fill3, 3], [T.fill4, 4]].forEach(([t, k]) => {
  cue(t, 'fly', { k }); cue(t + 0.45, 'land', { k });
});
[T.ret1, T.ret2, T.ret3, T.ret4].forEach((t) => cue(t, 'retract'));
cue(T.go2, 'whoosh', { v: 0.6 });
cue(6.0, 'skid', { v: 0.6, d: 0.2 });
cue(T.go3, 'whoosh', { v: 0.8 });
cue(T.bonk, 'bonk');
cue(T.bonk + 0.15, 'birds');
cue(8.1, 'shake');
cue(T.hop, 'jump');
cue(T.land4, 'land4');
cue(9.6, 'stretch');
cue(T.lensOpen, 'zoomIn');
T.lensSteps.forEach((t, i) => {
  const d = T.lensDur[i];
  cue(t, 'slam', { v: 0.75, p: 1 + i * 0.12 });
  cue(t + 0.1, 'popnote', { k: 5 + i });
  cue(t + d * 0.18, 'stretch', { v: 0.6, d: d * 0.25 });
  cue(t + d * 0.5, 'fwip', { p: 1 + i * 0.15 });
});
for (let j = 1; j <= 9; j++) cue(T.flurry + 0.055 * (j - 1), 'tick', { p: 1 + j * 0.09, v: 0.8 });
cue(T.lensClose, 'zoomOut');
cue(T.lensShut, 'tapestop');
T.stomps.forEach((t) => cue(t, 'stomp'));
cue(T.tantrum + 0.05, 'grumble');
cue(T.sitThud, 'thud');
cue(T.sitThud + 0.1, 'sad');
cue(T.reveal, 'shimmer');
cue(T.tail, 'tailfill');
T.merges.forEach((t, i) => cue(t + 0.22, 'merge', { k: i }));
cue(T.eqOne, 'eqone');
cue(T.bulb, 'bulb');
cue(T.rewind, 'rewind');
cue(T.crouch2, 'windup', { v: 0.8 });
cue(T.sprint, 'whoosh', { v: 1 });
for (let k = 1; k <= 12; k++) cue(sprintGateT(k), 'burst', { k, v: Math.max(0.25, 1 - k * 0.07) });
cue(T.arrive, 'arrive');
cue(T.miniIn, 'zip', { p: 1.4 });
cue(T.steal, 'snatch');
cue(T.steal + 0.14, 'zip', { p: 0.9, v: 0.8 });
cue(T.minus, 'popnote', { k: 3, v: 0.7 });
cue(T.deadpan, 'cricket');
cue(T.miniSlam, 'slam', { v: 0.8, p: 1.2 });
cue(T.miniSlam + 0.1, 'skid', { v: 0.5, p: 1.6, d: 0.25 });
cue(T.miniQ, 'question', { p: 1.4 });
cue(T.smirk, 'sting');
cue(T.eatPick + 0.25, 'chomp');
cue(T.eatPick + 0.65, 'chomp', { p: 1.1 });
cue(T.eatPick + 1.05, 'chomp', { p: 0.95 });
cue(T.miniSlam2, 'slam', { v: 0.7, p: 1.35 });
cue(T.miniSlam2 + 0.08, 'eek');

// ------------------------------------------------------------------ helpers
const R = (t, a, b) => range01(t, a, b);
const E = (name, u) => ease[name](clamp(u));
const popIn = (t, t0, d = 0.28) => (t < t0 ? 0 : ease.outBack(clamp((t - t0) / d)));
const popInOut = (t, t0, t1, din = 0.25, dout = 0.18) => {
  if (t < t0 || t > t1 + dout) return 0;
  if (t > t1) return 1 - ease.inBack(clamp((t - t1) / dout));
  return ease.outBack(clamp((t - t0) / din));
};

// ------------------------------------------------------------------ main character
const tz = (a, d) => (u) => U.trapez(u, a, d);
const hip0 = hipAt(X0);
const hipEnd = hipAt(X1);

const xTrack = track([
  [0, hip0],
  [T.crouch1, hip0],
  [T.go1 - 0.02, hip0 - 8],
  [T.stop1, hipAt(G[1]) - 10, tz(0.22, 0.4)],
  [T.go2 - 0.1, hipAt(G[1]) - 10],
  [T.go2, hipAt(G[1]) - 15],
  [T.stop2, hipAt(G[2]) - 10, tz(0.3, 0.38)],
  [T.go3, hipAt(G[2]) - 10],
  [T.bonk, hipAt(G[3]), tz(0.5, 0)],
  [T.bonk + 0.25, hipAt(G[3]) - 30, 'outQuad'],
  [8.32, hipAt(G[3]) - 30],
  [8.6, hipAt(G[3]), 'inOutSine'],
  [T.hop, hipAt(G[3])],
  [T.land4, hipAt(G[4]), 'inOutSine'],
  [T.slump, hipAt(G[4])],
  [T.sitThud, hipAt(G[4]) - 34, 'inOutSine'],
  [T.rewind + 0.08, hipAt(G[4]) - 34],
  [T.rewindEnd, hip0, 'inOutCubic'],
  [T.crouch2, hip0],
  [T.sprint - 0.02, hip0 - 8],
  [T.arrive, hipEnd, 'linear'],
  [T.arrive + 0.1, hipEnd + 4, 'outQuad'],
  [T.end, hipEnd + 4],
]);
const charX = (t) => xTrack(t);
const charLead = (t) => charX(t) + LEAD;

// windows where the run overlay is disabled (hops, tantrums ...)
const noRun = (t) =>
  (t > T.hop - 0.1 && t < T.land4 + 0.2) || (t > T.bonk - 0.005 && t < 8.7) || (t > T.tantrum && t < T.rewind);

const hopPose = { lean: 0.15, headTilt: -0.2, armF: [2.3, 0.6], armB: [-2.0, 0.5], legF: [1.0, -1.7], legB: [0.35, -1.5], lift: 0 };
const landPose = mix(POSES.idle, POSES.crouch, 0.55);
const halfCrouch = mix(POSES.idle, POSES.crouch, 0.6);
const slumpPose = over(POSES.idle, { lean: 0.35, headTilt: 0.45, armF: [0.15, 0.1], armB: [-0.05, 0.1] });
const reachLens = over(POSES.reachMax, { lean: 0.04, armF: [1.19, 0.2], armB: [1.0, 0.3] });
const surprise = over(POSES.idle, { armF: [0.95, 1.2], armB: [-0.95, 1.2], headTilt: -0.12 });

const PK = (t, p, e) => [t, typeof p === 'string' ? POSES[p] : p, e];
const poseTrack = track([
  PK(0, 'idle'),
  PK(T.bang - 0.06, 'idle'),
  PK(T.bang + 0.06, surprise, 'outBack'),
  PK(1.2, 'idle'),
  PK(T.hearts, 'rubHands'),
  PK(2.25, 'rubHands'),
  PK(2.45, 'idle'),
  PK(T.crouch1, 'idle'),
  PK(T.go1 - 0.08, 'crouch', 'outCubic'),
  PK(T.go1 + 0.02, 'crouch'),
  PK(4.2, 'idle'),
  PK(4.36, 'skid'),
  PK(T.stop1, 'skid'),
  PK(4.85, 'stopBrace'),
  PK(5.15, 'idle'),
  PK(T.go2 - 0.15, 'idle'),
  PK(T.go2 - 0.02, halfCrouch),
  PK(T.go2 + 0.05, halfCrouch),
  PK(5.9, 'idle'),
  PK(6.02, 'stopBrace'),
  PK(T.stop2 + 0.05, 'stopBrace'),
  PK(6.4, 'idle'),
  PK(T.bonk - 0.02, 'idle'),
  PK(T.bonk + 0.03, 'bonk', 'outQuad'),
  PK(7.5, 'bonk'),
  PK(7.75, 'daze'),
  PK(8.1, 'daze'),
  PK(8.35, 'idle'),
  PK(T.hop - 0.15, 'idle'),
  PK(T.hop - 0.02, halfCrouch),
  PK(T.hop + 0.08, hopPose, 'outQuad'),
  PK(T.land4 - 0.08, hopPose),
  PK(T.land4 + 0.02, landPose),
  PK(9.45, 'idle'),
  PK(9.6, 'idle'),
  PK(9.92, reachLens, 'outBack'),
  PK(T.lensShut, reachLens),
  PK(T.tantrum + 0.08, 'armsUp', 'outBack'),
  PK(T.stomps[0], 'stomp'), PK(T.stomps[0] + 0.15, 'armsUp'),
  PK(T.stomps[1], 'stomp'), PK(T.stomps[1] + 0.15, 'armsUp'),
  PK(T.stomps[2], 'stomp'), PK(15.1, 'idle'),
  PK(T.slump + 0.08, slumpPose),
  PK(T.sitThud, 'sit', 'inQuad'),
  PK(T.lookUp - 0.3, 'sit'),
  PK(T.lookUp, 'sitLookUp'),
  PK(T.standUp, 'sitLookUp'),
  PK(T.standUp + 0.35, 'idle', 'outBack'),
  PK(T.point - 0.2, 'idle'),
  PK(T.point, 'pointUp', 'outBack'),
  PK(22.3, 'pointUp'),
  PK(22.55, 'idle'),
  PK(T.crouch2, 'idle'),
  PK(T.sprint - 0.05, 'crouch', 'outCubic'),
  PK(T.sprint + 0.02, 'crouch'),
  PK(T.sprint + 0.2, 'idle'),
  PK(T.arrive - 0.02, 'idle'),
  PK(T.arrive + 0.05, 'skid', 'outQuad'),
  PK(T.arrive + 0.2, 'stopBrace'),
  PK(T.arrive + 0.4, 'rubHands'),
  PK(T.grabPrep - 0.05, 'rubHands'),
  PK(T.grabPrep + 0.1, 'grabPrep'),
  PK(T.grab - 0.08, 'grabPrep'),
  PK(T.grab, 'grab', 'outQuad'),
  PK(27.3, 'grab'),
  PK(27.5, 'idle'),
  PK(T.smirk, 'idle'),
  PK(T.shrug + 0.12, 'shrug', 'outBack'),
  PK(29.1, 'shrug'),
  PK(T.eatGrab, 'grab'),
  PK(T.eatPick, 'grab'),
  PK(T.eatPick + 0.28, 'eat', 'outBack'),
  PK(T.end, 'eat'),
]);

const EK = (t, o, e) => [t, expr(o), e];
const exprTrack = track([
  EK(0, { turn: 0 }),
  EK(T.turn - 0.1, { turn: 0 }),
  EK(T.turn, { turn: 1, look: [1, 0] }),
  EK(T.bang, { turn: 1, look: [1, 0], eyeScale: 1.35, pupil: 0.8, mouth: 'o', open: 0.8 }, 'outBack'),
  EK(T.hearts - 0.05, { turn: 1, look: [1, 0], eyeScale: 1.35, pupil: 0.8, mouth: 'o', open: 0.8 }),
  EK(T.hearts + 0.08, { turn: 1, heart: 1, mouth: 'open', open: 0.5, eyeScale: 1.1 }, 'outBack'),
  EK(2.2, { turn: 1, heart: 1, mouth: 'open', open: 0.6, drool: 1 }),
  EK(2.4, { turn: 0.6, look: [0.3, -1], mouth: 'o', open: 0.3 }),
  EK(2.9, { turn: 0.6, look: [0.1, -1], mouth: 'o', open: 0.3 }),
  EK(3.05, { turn: 1, look: [1, 0], lid: 0.12, slant: 0.45, mouth: 'grin', open: 0.3 }),
  EK(4.3, { turn: 1, look: [1, 0], lid: 0.12, slant: 0.45, mouth: 'grin', open: 0.3 }),
  EK(4.42, { turn: 1, look: [1, -0.2], eyeScale: 1.3, mouth: 'o', open: 1 }),
  EK(T.q1, { turn: 1, look: [0.6, -1], mouth: 'flat', curve: 0 }),
  EK(4.95, { turn: 1, look: [0.6, -1], mouth: 'flat', curve: 0 }),
  EK(5.08, { turn: 0.15, look: [0, 0], lid: 0.15, mouth: 'flat', curve: -2 }),
  EK(5.35, { turn: 0.15, look: [0, 0], lid: 0.15, mouth: 'flat', curve: -2 }),
  EK(5.45, { turn: 1, look: [1, 0], lid: 0.15, slant: 0.4, mouth: 'grin', open: 0.2 }),
  EK(5.95, { turn: 1, look: [1, 0], lid: 0.15, slant: 0.4, mouth: 'grin', open: 0.2 }),
  EK(6.05, { turn: 1, look: [1, -0.3], eyeScale: 1.25, mouth: 'o', open: 0.6 }),
  EK(6.3, { turn: 0, look: [0, 0], lid: 0.45, slant: 0.55, mouth: 'flat', curve: -1 }),
  EK(6.85, { turn: 0, look: [0, 0], lid: 0.45, slant: 0.55, mouth: 'flat', curve: -1 }),
  EK(6.95, { turn: 1, look: [1, 0], lid: 0.22, slant: 0.75, mouth: 'grin', open: 0.4 }),
  EK(T.bonk - 0.01, { turn: 1, look: [1, 0], lid: 0.22, slant: 0.75, mouth: 'grin', open: 0.4 }),
  EK(T.bonk + 0.02, { turn: 1, eyeScale: 1.45, pupil: 0.6, mouth: 'o', open: 1 }),
  EK(7.42, { turn: 0.5, spiral: 1, mouth: 'wavy' }),
  EK(8.05, { turn: 0.5, spiral: 1, mouth: 'wavy' }),
  EK(8.12, { turn: 1, look: [1, 0], lid: 0.32, slant: 0.65, mouth: 'flat', curve: -2 }),
  EK(T.hop - 0.1, { turn: 1, look: [1, 0], lid: 0.32, slant: 0.65, mouth: 'flat', curve: -2 }),
  EK(T.hop + 0.05, { turn: 1, look: [1, -0.3], lid: 0.05, slant: 0.4, mouth: 'grin', open: 0.6 }),
  EK(T.slam4 + 0.02, { turn: 1, look: [1, -0.6], eyeScale: 1.4, pupil: 0.7, mouth: 'o', open: 0.9 }),
  EK(9.5, { turn: 1, look: [1, -0.4], eyeScale: 1.2, mouth: 'o', open: 0.5 }),
  EK(9.75, { turn: 1, look: [1, 0.25], lid: 0.2, slant: 0.35, mouth: 'wavy' }),
  EK(T.lensShut, { turn: 1, look: [1, 0.25], lid: 0.2, slant: 0.35, mouth: 'wavy' }),
  EK(T.tantrum + 0.05, { turn: 0.25, look: [0, 0], lid: 0.32, slant: 0.95, mouth: 'grit', open: 0.5 }),
  EK(15.15, { turn: 0.25, look: [0, 0], lid: 0.32, slant: 0.95, mouth: 'grit', open: 0.5 }),
  EK(15.35, { turn: 0.2, look: [0, 1], lid: 0.45, slant: -0.55, mouth: 'frown', curve: -5 }),
  EK(T.lookUp - 0.15, { turn: 0.2, look: [0, 1], lid: 0.45, slant: -0.55, mouth: 'frown', curve: -5 }),
  EK(T.lookUp + 0.1, { turn: 0.35, look: [0, -1], lid: 0.15, slant: -0.25, mouth: 'o', open: 0.15 }),
  EK(T.merges[2], { turn: 0.35, look: [0.3, -1], lid: 0.05, mouth: 'o', open: 0.3 }),
  EK(T.eqOne, { turn: 0.35, look: [0, -1], eyeScale: 1.4, pupil: 0.72, mouth: 'o', open: 1 }, 'outBack'),
  EK(T.bulb, { turn: 0.35, look: [0, -1], eyeScale: 1.4, pupil: 0.72, mouth: 'o', open: 1 }),
  EK(T.bulb + 0.25, { turn: 0.4, look: [0.2, -1], eyeScale: 1.2, mouth: 'grin', open: 1 }),
  EK(22.2, { turn: 0.4, look: [0.2, -1], eyeScale: 1.2, mouth: 'grin', open: 1 }),
  EK(22.4, { turn: 0, look: [0, 0], lid: 0.28, slant: 0.5, mouth: 'grin', open: 0.6, mouthSide: 1 }),
  EK(T.rewind + 0.05, { turn: 0, look: [0, 0], lid: 0.28, slant: 0.5, mouth: 'grin', open: 0.6, mouthSide: 1 }),
  EK(T.crouch2, { turn: 1, look: [1, 0], lid: 0.18, slant: 0.6, mouth: 'grin', open: 0.5 }),
  EK(T.arrive - 0.02, { turn: 1, look: [1, 0], lid: 0.18, slant: 0.6, mouth: 'grin', open: 0.5 }),
  EK(T.arrive + 0.15, { turn: 1, heart: 1, mouth: 'open', open: 0.8, drool: 1 }, 'outBack'),
  EK(T.grabPrep - 0.02, { turn: 1, heart: 1, mouth: 'open', open: 0.8, drool: 1 }),
  EK(T.grabPrep + 0.06, { turn: 1, happy: 1, mouth: 'open', open: 1 }),
  EK(T.see - 0.03, { turn: 1, happy: 1, mouth: 'open', open: 1 }),
  EK(T.see + 0.05, { turn: 1, look: [0.6, 1], eyeScale: 1.45, pupil: 0.65, mouth: 'o', open: 0.5 }),
  EK(T.deadpan - 0.08, { turn: 1, look: [0.6, 1], eyeScale: 1.45, pupil: 0.65, mouth: 'o', open: 0.5 }),
  EK(T.deadpan + 0.04, { turn: 0, look: [0, 0], lid: 0.52, mouth: 'flat', curve: 0 }),
  EK(T.lookMini - 0.05, { turn: 0, look: [0, 0], lid: 0.52, mouth: 'flat', curve: 0 }),
  EK(T.lookMini + 0.12, { turn: -1, look: [-1, 0.2], lid: 0.3, mouth: 'flat', curve: 0 }),
  EK(T.smirk - 0.05, { turn: -1, look: [-1, 0.2], lid: 0.3, mouth: 'flat', curve: 0 }),
  EK(T.smirk + 0.08, { turn: 0, look: [0, 0], lid: 0.22, slant: 0.35, mouth: 'smirk' }),
  EK(T.eatGrab - 0.05, { turn: 0, look: [0, 0], lid: 0.22, slant: 0.35, mouth: 'smirk' }),
  EK(T.eatGrab + 0.05, { turn: 1, look: [1, 0.6], mouth: 'open', open: 0.6 }),
  EK(T.eatPick + 0.25, { turn: 0.6, happy: 1, mouth: 'open', open: 1 }),
  EK(T.eatPick + 0.32, { turn: 0.6, happy: 1, mouth: 'chew' }),
  EK(T.end, { turn: 0.6, happy: 1, mouth: 'chew' }),
]);

const BLINKS = [0.35, 2.95, 5.25, 8.95, 16.3, 19.1, 23.0, 28.3, 31.0];
function blinkAt(t) {
  let b = 0;
  for (const bt of BLINKS) {
    const d = Math.abs(t - bt);
    if (d < 0.07) b = Math.max(b, 1 - d / 0.07);
  }
  return b;
}

function jumpAt(t) {
  // hop over to the 1/16 gate
  if (t > T.hop && t < T.land4) {
    const u = (t - T.hop) / (T.land4 - T.hop);
    return 70 * 4 * u * (1 - u);
  }
  // first surprise hop
  if (t > T.bang && t < T.bang + 0.28) {
    const u = (t - T.bang) / 0.28;
    return 22 * 4 * u * (1 - u);
  }
  // tantrum hops between stomps
  if (t > T.tantrum && t < T.stomps[2]) {
    const pts = [T.tantrum, ...T.stomps];
    for (let i = 0; i < pts.length - 1; i++) {
      if (t >= pts[i] && t < pts[i + 1]) {
        const u = (t - pts[i]) / (pts[i + 1] - pts[i]);
        return 34 * 4 * u * (1 - u);
      }
    }
  }
  // lightbulb bounce
  if (t > T.standUp + 0.3 && t < T.standUp + 0.6) {
    const u = (t - T.standUp - 0.3) / 0.3;
    return 26 * 4 * u * (1 - u);
  }
  return 0;
}

function mainChar(t) {
  const dt = 1 / 120;
  const x = charX(t);
  const v = (charX(t + dt) - charX(t - dt)) / (2 * dt);
  const v2 = (charX(t) - charX(t - 2 * dt)) / (2 * dt);
  const acc = (v - v2) / dt;
  let pose = poseTrack(t);
  let wRun = noRun(t) ? 0 : U.smoothstep(30, 210, Math.abs(v));
  const sprint = t > T.sprint - 0.1 && t < T.arrive + 0.1 ? 1 : 0;
  if (wRun > 0.001) {
    const stride = (250 + 40 * sprint) * CS;
    const rp = runPose(x / stride, 1, sprint);
    pose = mix(pose, rp, wRun);
  }
  // secondary animation
  pose = { ...pose, armF: pose.armF.slice(), armB: pose.armB.slice() };
  const rub = (t > T.hearts && t < 2.3) || (t > T.arrive + 0.4 && t < T.grabPrep);
  if (rub) {
    pose.armF[1] += 0.28 * Math.sin(t * 28);
    pose.armB[1] -= 0.28 * Math.sin(t * 28);
  }
  if (t > 9.85 && t < T.lensShut) {
    pose.armF[0] += 0.02 * U.noise1(t * 30);
    pose.lift = (pose.lift || 0) + 2 * Math.abs(U.noise1(t * 20));
  }
  if (t > 8.08 && t < 8.4) pose.headTilt += 0.3 * Math.sin((t - 8.08) * 40) * (1 - (t - 8.08) / 0.32);
  if (t > T.eatPick + 0.3) pose.armF[1] += 0.08 * Math.sin(t * 22);
  // idle breathing
  const breathe = Math.sin(t * 3.2) * 1.5 * (1 - wRun);
  pose.lift = (pose.lift || 0) + Math.max(0, breathe);

  let e = exprTrack(t);
  const b = blinkAt(t);
  if (b > 0 && !e.heart && !e.happy && !e.spiral) e = { ...e, lid: Math.max(e.lid, b) };

  // squash on impacts
  let sx = 1, sy = 1;
  const sq = (t0, amt, d = 0.25) => {
    if (t < t0 || t > t0 + d) return 0;
    return amt * U.spring(t - t0, 4, 9);
  };
  const bonkSq = sq(T.bonk, 0.32, 0.4);
  sx -= bonkSq; sy += bonkSq * 0.5;
  for (const st of T.stomps) { const s = sq(st, 0.12); sx += s; sy -= s; }
  const landSq = sq(T.land4, 0.16) + sq(T.sitThud, 0.12) + sq(T.arrive, 0.12);
  sx += landSq; sy -= landSq;
  const stretch = (t > T.hop && t < T.hop + 0.15) ? 0.12 * Math.sin(((t - T.hop) / 0.15) * Math.PI) : 0;
  sx -= stretch; sy += stretch;

  return {
    x, y: FLOOR, face: 1, scale: CS, pose, expr: e, t, sx, sy,
    jump: jumpAt(t),
    hairWobble: clamp(-acc * 0.00025, -0.6, 0.6) + clamp(-v * 0.0005, -0.4, 0.4),
    hairBoing: t > T.bonk && t < T.bonk + 0.6 ? 0.25 * U.wobble(t - T.bonk, 7, 6) : 0,
    speed: Math.abs(v), v,
  };
}

// ------------------------------------------------------------------ mini character
const miniX = track([
  [0, 1160],
  [T.miniIn, 1160],
  [T.miniIn + 0.17, 948, 'outQuad'],
  [T.steal + 0.12, 920, 'inOutSine'],
  [27.5, 330, (u) => U.trapez(u, 0.25, 0.05)],
  [27.82, 182, 'outQuart'],
  [T.miniSlam2, 182],
  [T.miniSlam2 + 0.12, 198, 'outQuad'],
  [T.end, 198],
]);
const miniPoseTrack = track([
  PK(0, 'idle'),
  PK(T.miniIn + 0.2, 'idle'),
  PK(T.steal - 0.12, halfCrouch),
  PK(T.steal - 0.04, hopPose),
  PK(T.steal + 0.12, over(hopPose, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(27.5, over(POSES.idle, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(27.62, over(POSES.skid, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(27.82, over(POSES.skid, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(28.0, over(POSES.idle, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(T.miniSlam2, over(POSES.idle, { armF: [2.9, 0.2], armB: [-2.9, -0.2] })),
  PK(T.miniSlam2 + 0.08, over(POSES.bonk, { armF: [2.9, 0.4], armB: [-2.9, -0.4] }), 'outQuad'),
  PK(T.end, over(POSES.bonk, { armF: [2.9, 0.4], armB: [-2.9, -0.4] })),
]);
const miniExprTrack = track([
  EK(0, { turn: 1, look: [1, 0], lid: 0.2, slant: 0.5, mouth: 'grin', open: 0.4 }),
  EK(27.55, { turn: 1, look: [1, 0], lid: 0.2, slant: 0.5, mouth: 'grin', open: 0.4 }),
  EK(27.62, { turn: 1, look: [1, -0.2], eyeScale: 1.4, mouth: 'o', open: 1 }),
  EK(T.miniQ, { turn: 1, look: [1, -0.6], mouth: 'flat', curve: 0 }),
  EK(28.5, { turn: 0, look: [0, 0], mouth: 'flat', curve: -2, lid: 0.2 }),
  EK(T.miniSlam2, { turn: 0, look: [0, 0], mouth: 'flat', curve: -2, lid: 0.2 }),
  EK(T.miniSlam2 + 0.06, { turn: 1, look: [1, -0.5], eyeScale: 1.5, pupil: 0.6, mouth: 'o', open: 1 }),
  EK(T.end, { turn: 1, look: [1, -0.5], eyeScale: 1.5, pupil: 0.6, mouth: 'o', open: 1 }),
]);

function miniChar(t) {
  if (t < T.miniIn) return null;
  const dt = 1 / 120;
  const x = miniX(t);
  const v = (miniX(t + dt) - miniX(t - dt)) / (2 * dt);
  let pose = miniPoseTrack(t);
  const hopping = t > T.steal - 0.06 && t < T.steal + 0.14;
  const wRun = hopping ? 0 : U.smoothstep(40, 260, Math.abs(v));
  if (wRun > 0.001) {
    const rp = runPose(Math.abs(x) / (250 * 0.55 * CS), 1, 1);
    const keepArms = t > T.steal;
    pose = mix(pose, { ...rp, armF: keepArms ? pose.armF : rp.armF, armB: keepArms ? pose.armB : rp.armB }, wRun);
  }
  let jump = 0;
  if (t > T.steal - 0.08 && t < T.steal + 0.16) {
    const u = (t - (T.steal - 0.08)) / 0.24;
    jump = 125 * 4 * u * (1 - u);
  }
  if (t > T.miniSlam2 && t < T.miniSlam2 + 0.3) {
    const u = (t - T.miniSlam2) / 0.3;
    jump = 40 * 4 * u * (1 - u);
  }
  const face = t < T.steal + 0.05 ? -1 : t < 28.3 ? -1 : -1;
  const s = {
    x, y: FLOOR, face, scale: 0.55 * CS, headScale: 1.4, mini: true, bandana: true,
    pose, expr: miniExprTrack(t), t, jump, speed: clamp(Math.abs(v) / 600),
  };
  if (t > T.steal) {
    s.holding = (g, hx, hy) => P.drawSlice(g, hx - 6, hy - 18, 1.6, 0.15);
  }
  return s;
}

// ------------------------------------------------------------------ gates
// main-run gates: x, colour, slam time, retract time, (opt) bend from contact
const GATES = [
  { k: 1, x: G[1], slam: T.slam1, ret: T.ret1, hit: T.stop1 },
  { k: 2, x: G[2], slam: T.slam2, ret: T.ret2, hit: T.stop2 },
  { k: 3, x: G[3], slam: T.slam3, ret: T.ret3, hit: T.bonk, hard: true },
  { k: 4, x: G[4], slam: T.slam4, ret: T.ret4, hit: T.land4 },
];
const DROP = 0.12;

function gateHeight(t, slam, ret, h = GATE_H) {
  if (t < slam - DROP) return null;
  if (t < slam) {
    // falling from the sky: return y offset of the bottom
    return { h, drop: (1 - ease.inQuad((t - (slam - DROP)) / DROP)) * (FLOOR + 50) };
  }
  let hh = h * (1 - 0.18 * U.spring(t - slam, 5, 9) * (t - slam < 0.5 ? 1 : 0));
  if (ret !== undefined && t > ret) {
    const u = clamp((t - ret) / 0.22);
    hh = lerp(hh, 24, ease.inBack(u));
  }
  return { h: hh, drop: 0 };
}

function drawMainGates(g, t, front) {
  const lead = charLead(t);
  const hx = charX(t);
  for (const gt of GATES) {
    if ((hx + 12 < gt.x) !== front) continue;
    const st = gateHeight(t, gt.slam, gt.ret);
    if (!st) continue;
    // ticks vanish when the character rewinds past them
    if (t > T.rewind && lead < gt.x - 2) continue;
    let bend = 0;
    if (gt.hit && t > gt.hit) bend = (gt.hard ? 36 : 16) * U.wobble(t - gt.hit, 3.2, 3.5);
    bend += 10 * U.wobble(t - gt.slam, 4, 6);
    const col = fracColor(gt.k);
    if (st.drop > 0) {
      // motion streak
      g.save();
      g.strokeStyle = rgba(col, 0.25);
      g.lineWidth = 12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(gt.x, FLOOR - st.drop - st.h - 120);
      g.lineTo(gt.x, FLOOR - st.drop - st.h);
      g.stroke();
      g.restore();
    }
    P.drawGate(g, gt.x, FLOOR - st.drop, st.h, col, { bend });
    P.dustBurst(g, gt.x, FLOOR, gt.slam, t, { n: 8, speed: 140, rise: 26, seed: gt.k * 13 });
  }
}

// arcs ("hops") with their fraction label; the label flies to the equation
const ARCS = [
  { k: 1, a: X0, b: G[1], t0: T.slam1, fly: T.fill1 },
  { k: 2, a: G[1], b: G[2], t0: T.slam2, fly: T.fill2 },
  { k: 3, a: G[2], b: G[3], t0: T.slam3, fly: T.fill3 },
  { k: 4, a: G[3], b: G[4], t0: T.slam4, fly: T.fill4 },
];
const FLY_DUR = 0.45;
function arcApex(a, b) {
  const hgt = Math.min(Math.abs(b - a) * 0.42, 150);
  return [(a + b) / 2, FLOOR - 10 - hgt];
}
function labelRest(arc) {
  const [mx, my] = arcApex(arc.a, arc.b);
  // keep small hops' labels above the character's head
  const y = Math.min(my - 70, 870);
  return [mx, y];
}

// ------------------------------------------------------------------ equation
const EQ = (() => {
  const items = [
    { type: 'frac', k: 1, t: T.fill1 + FLY_DUR },
    { type: 'plus', t: T.fill2 + 0.05 },
    { type: 'frac', k: 2, t: T.fill2 + FLY_DUR },
    { type: 'plus', t: T.fill3 + 0.05 },
    { type: 'frac', k: 3, t: T.fill3 + FLY_DUR },
    { type: 'plus', t: T.fill4 + 0.05 },
    { type: 'frac', k: 4, t: T.fill4 + FLY_DUR },
    { type: 'plus', t: T.lensSteps[0] + 0.05 },
    { type: 'dots', t: T.lensSteps[0] + 0.05 },
    { type: 'eq', t: T.eqOne },
    { type: 'one', t: T.eqOne + 0.12 },
  ];
  const widths = { plus: 62, dots: 92, eq: 78, one: 70 };
  for (const it of items) {
    if (it.type === 'frac') it.w = P.fracSize(1, Math.pow(2, it.k), EQ_SIZE).w + 6;
    else it.w = widths[it.type];
  }
  const total = items.reduce((s, it) => s + it.w, 0);
  let x = W / 2 - total / 2;
  for (const it of items) { it.x = x + it.w / 2; x += it.w; }
  return items;
})();
const eqSlot = (k) => EQ.find((it) => it.type === 'frac' && it.k === k);

function drawEquation(g, t) {
  const sc = 1 + 0.08 * E('inOutCubic', R(t, T.reveal, T.reveal + 0.5)) - 0.08 * E('inOutCubic', R(t, T.rewind, T.rewind + 0.5));
  g.save();
  g.translate(W / 2, EQ_Y);
  g.scale(sc, sc);
  g.translate(-W / 2, -EQ_Y);
  for (const it of EQ) {
    if (t < it.t) continue;
    let s = popIn(t, it.t, 0.3);
    if (it.type === 'frac') {
      // pulse when its block merges in the proof
      let pulse = 0;
      for (let m = 0; m < 5; m++) {
        const tm = T.merges[m];
        const involved = (m === 0 && it.k === 4) || (m >= 1 && it.k === 5 - m);
        if (involved) pulse = Math.max(pulse, Math.sin(clamp((t - tm) / 0.35) * Math.PI));
      }
      s *= 1 + 0.18 * pulse;
      P.drawFrac(g, it.x, EQ_Y, 1, Math.pow(2, it.k), EQ_SIZE, fracColor(it.k), { scale: s });
    } else if (it.type === 'plus') P.drawPlus(g, it.x, EQ_Y, EQ_SIZE, C.ink, s);
    else if (it.type === 'eq') P.drawEquals(g, it.x, EQ_Y, EQ_SIZE * 1.1, C.ink, s);
    else if (it.type === 'dots') {
      // dots appear one per zoom step, pulse in the proof
      const n = t > T.lensSteps[3] + 0.3 ? 3 : t > T.lensSteps[2] + 0.3 ? 2 : t > T.lensSteps[1] + 0.3 ? 1 : 0;
      const shimmer = t > T.tail && t < T.merges[0] + 0.4 ? 1 + 0.15 * Math.sin((t - T.tail) * 18) : 1;
      g.save();
      g.translate(it.x, EQ_Y);
      g.scale(shimmer, shimmer);
      for (let i = 0; i < 3; i++) {
        const tt = [T.lensSteps[0] + 0.6, T.lensSteps[1] + 0.5, T.lensSteps[2] + 0.45][i];
        const ds = popIn(t, tt, 0.25);
        if (ds <= 0) continue;
        g.fillStyle = C.ink;
        g.beginPath();
        g.arc((i - 1) * EQ_SIZE * 0.36, 0, EQ_SIZE * 0.095 * ds, 0, TAU);
        g.fill();
      }
      g.restore();
    } else if (it.type === 'one') {
      const glow = t > T.eqOne + 0.1 ? 0.5 + 0.5 * Math.sin((t - T.eqOne) * 5) : 0;
      if (glow > 0) {
        g.save();
        g.fillStyle = rgba(C.gold, 0.28 + 0.14 * glow);
        g.beginPath();
        g.arc(it.x, EQ_Y + 2, 50 * s, 0, TAU);
        g.fill();
        g.restore();
      }
      P.drawText(g, it.x, EQ_Y + 2, '1', EQ_SIZE * 1.5, C.ink, { scale: s, bold: true });
    }
  }
  g.restore();
  // flying labels
  for (const arc of ARCS) {
    if (t < arc.fly || t > arc.fly + FLY_DUR) continue;
    const u = ease.inOutCubic((t - arc.fly) / FLY_DUR);
    const [sx, sy] = labelRest(arc);
    const slot = eqSlot(arc.k);
    const x = lerp(sx, slot.x, u);
    const y = lerp(sy, EQ_Y, u) - Math.sin(u * Math.PI) * 60;
    const sc2 = lerp(1.15, 1, u);
    P.drawFrac(g, x, y, 1, Math.pow(2, arc.k), EQ_SIZE, fracColor(arc.k), { scale: sc2, halo: C.bg });
  }
}

// ------------------------------------------------------------------ the bar
const BAR_PATH = { x: X0, y: BAR_Y, w: L, h: BAR_H };
const BAR_REVEAL = { x: 90, y: 820, w: 900, h: 74 };

function barRect(t) {
  const u1 = E('inOutCubic', R(t, T.reveal, T.reveal + 0.55));
  const u2 = E('inOutCubic', R(t, T.rewind + 0.05, T.rewind + 0.6));
  const u = u1 * (1 - u2);
  return mix(BAR_PATH, BAR_REVEAL, u);
}
const kStart = (k) => 1 - Math.pow(2, -(k - 1));
const kEnd = (k) => 1 - Math.pow(2, -k);

// fill times of each term during the first (stop-and-go) run
const FILL_T = [null, T.fill1, T.fill2, T.fill3, T.fill4,
  T.lensSteps[0] + 0.6, T.lensSteps[1] + 0.5, T.lensSteps[2] + 0.45, T.lensSteps[3] + 0.4];

function segsFirstRun(t) {
  const segs = [];
  for (let k = 1; k <= 8; k++) {
    const p = E('outCubic', R(t, FILL_T[k], FILL_T[k] + (k <= 4 ? 0.3 : 0.15)));
    if (p <= 0) continue;
    const a = kStart(k), b = kEnd(k);
    segs.push({ a, b: lerp(a, b, p), color: fracColor(k), k });
  }
  return segs;
}

function segsProgress(prog, kMax = 14) {
  const segs = [];
  for (let k = 1; k <= kMax; k++) {
    const a = kStart(k);
    if (prog <= a) break;
    segs.push({ a, b: Math.min(prog, kEnd(k)), color: fracColor(k), k });
  }
  return segs;
}

function drawBar(g, t) {
  if (t < T.bar) return;
  const r = barRect(t);
  const grow = E('outCubic', R(t, T.bar, T.bar + 0.45));
  const x = r.x, y = r.y - r.h / 2, w = r.w * grow, h = r.h;
  const rad = 12;
  const pathRR = () => {
    g.beginPath();
    g.roundRect(x, y, w, h, rad);
  };
  g.save();
  // shadow
  g.fillStyle = rgba(C.ink, 0.08);
  g.beginPath();
  g.roundRect(x + 4, y + 7, w, h, rad);
  g.fill();
  pathRR();
  g.fillStyle = C.white;
  g.fill();
  g.save();
  pathRR();
  g.clip();

  const X = (f) => x + f * r.w;
  const fillRect = (a, b, color, alpha = 1) => {
    if (b <= a) return;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(X(a), y - 2, (b - a) * r.w + 0.6, h + 4);
    g.globalAlpha = 1;
  };
  const sep = (f, alpha = 1) => {
    if (alpha <= 0.01) return;
    g.strokeStyle = rgba('#FFFFFF', 0.9 * alpha);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(X(f), y);
    g.lineTo(X(f), y + h);
    g.stroke();
  };
  let flash = 0;
  let showOne = 0;
  const overlays = [];

  if (t < T.reveal + 0.3) {
    const segs = segsFirstRun(t);
    for (const s of segs) fillRect(s.a, s.b, s.color);
    for (const s of segs) if (s.k > 1) sep(s.a);
    // pulse on fill
    for (let k = 1; k <= 4; k++) flash = Math.max(flash, 0.5 * (1 - clamp((t - FILL_T[k] - 0.3) / 0.25)) * (t > FILL_T[k] + 0.3 ? 1 : 0));
  } else if (t < T.rewind + 0.1) {
    // ---- the proof: tail shimmer, then pairwise merges
    const m = T.merges;
    const tailStripes = (a, alpha) => {
      // infinitely many ever-thinner pieces
      for (let k = 5; k <= 16; k++) fillRect(kStart(k), kEnd(k), fracColor(k), alpha);
      const fillP = E('outCubic', R(t, T.tail, T.tail + 0.4));
      fillRect(kStart(17), lerp(kStart(17), 1, fillP), fracColor(1), alpha);
      // shimmer bands
      if (alpha > 0.1) {
        const sh = (t * 1.6) % 1;
        g.globalAlpha = 0.35 * alpha;
        g.fillStyle = '#FFFFFF';
        g.fillRect(X(a) + sh * (1 - a) * r.w - 6, y, 6, h);
        g.globalAlpha = 1;
      }
    };
    // blocks state
    const cK = (k) => fracColor(k);
    const mixT = (i) => E('inOutCubic', R(t, m[i] + 0.22, m[i] + (i === 4 ? 0.55 : 0.45)));
    // step 0: tail -> solid colour of 1/16 (k=4)
    const s0 = mixT(0);
    // Blocks depending on merge progress
    const blocks = [];
    if (t < m[1] + 0.22) {
      blocks.push({ a: 0, b: 1 / 2, c: cK(1) }, { a: 1 / 2, b: 3 / 4, c: cK(2) }, { a: 3 / 4, b: 7 / 8, c: cK(3) }, { a: 7 / 8, b: 15 / 16, c: cK(4) });
      fillRect(0, 1, '#FFFFFF');
      for (const bl of blocks) fillRect(bl.a, bl.b, bl.c);
      tailStripes(15 / 16, 1);
      fillRect(15 / 16, lerp(15 / 16, 1, s0), cK(4));
      sep(1 / 2); sep(3 / 4); sep(7 / 8); sep(15 / 16);
    } else if (t < m[2] + 0.22) {
      const u = mixT(1);
      fillRect(0, 1 / 2, cK(1)); fillRect(1 / 2, 3 / 4, cK(2)); fillRect(3 / 4, 7 / 8, cK(3));
      fillRect(7 / 8, 1, cK(4)); fillRect(7 / 8, lerp(7 / 8, 1, u), cK(3));
      sep(1 / 2); sep(3 / 4); sep(7 / 8); sep(15 / 16, 1 - u);
    } else if (t < m[3] + 0.22) {
      const u = mixT(2);
      fillRect(0, 1 / 2, cK(1)); fillRect(1 / 2, 3 / 4, cK(2));
      fillRect(3 / 4, 1, cK(3)); fillRect(3 / 4, lerp(3 / 4, 1, u), cK(2));
      sep(1 / 2); sep(3 / 4); sep(7 / 8, 1 - u);
    } else if (t < m[4] + 0.22) {
      const u = mixT(3);
      fillRect(0, 1 / 2, cK(1));
      fillRect(1 / 2, 1, cK(2)); fillRect(1 / 2, lerp(1 / 2, 1, u), cK(1));
      sep(1 / 2); sep(3 / 4, 1 - u);
    } else {
      const u = mixT(4);
      fillRect(0, 1, cK(1)); fillRect(0, u, C.gold);
      sep(1 / 2, 1 - u);
      showOne = E('outBack', R(t, m[4] + 0.35, m[4] + 0.65));
    }
    for (let i = 0; i < 5; i++) flash = Math.max(flash, 0.25 * Math.max(0, 1 - Math.abs(t - (m[i] + 0.22)) / 0.08));
    // brackets + labels under the bar
    const MERGE_SPANS = [[15 / 16, 1, 4], [7 / 8, 1, 3], [3 / 4, 1, 2], [1 / 2, 1, 1], [0, 1, 0]];
    for (let i = 0; i < 5; i++) {
      const [a, b, k] = MERGE_SPANS[i];
      const vis = popInOut(t, m[i] - 0.05, m[i] + (i === 4 ? 0.75 : 0.5), 0.25, 0.2);
      if (vis <= 0) continue;
      overlays.push({ a, b, k, vis, i });
    }
  } else if (t < T.sprint) {
    // rewind: drain gold from right to left
    const u = E('inOutSine', R(t, T.rewind + 0.1, T.rewindEnd - 0.1));
    fillRect(0, 1 - u, C.gold);
    showOne = 1 - E('outQuad', R(t, T.rewind + 0.05, T.rewind + 0.3));
  } else if (t < T.arrive) {
    const prog = clamp((charLead(t) - X0) / L);
    const segs = segsProgress(prog);
    for (const s of segs) fillRect(s.a, s.b, s.color);
    for (const s of segs) if (s.k > 1 && s.k < 7) sep(s.a);
  } else {
    const u = E('inOutSine', R(t, T.arrive + 0.05, T.arrive + 0.35));
    const segs = segsProgress(1, 20);
    for (const s of segs) fillRect(s.a, s.b, s.color, 1 - u);
    fillRect(0, 1, C.gold, u);
    flash = 0.8 * Math.max(0, 1 - Math.abs(t - T.arrive - 0.05) / 0.15);
    showOne = E('outBack', R(t, T.arrive + 0.2, T.arrive + 0.5));
  }
  if (flash > 0) {
    g.globalAlpha = flash;
    g.fillStyle = '#FFFFFF';
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  g.restore(); // clip

  if (showOne > 0.01) {
    P.drawText(g, x + r.w / 2, r.y + 1, '1', h * 0.78, '#FFFFFF', { scale: showOne, bold: true, halo: C.goldDeep });
  }
  // outline
  pathRR();
  g.strokeStyle = C.ink;
  g.lineWidth = 5;
  g.stroke();
  g.restore();

  // merge brackets
  for (const o of overlays) {
    const xa = X(o.a) + 4, xb = X(o.b) - 4;
    const by = r.y + r.h / 2 + 16;
    const col = o.k === 0 ? C.goldDeep : fracColor(o.k);
    g.save();
    g.globalAlpha = clamp(o.vis);
    g.strokeStyle = C.ink;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const mxp = (xa + xb) / 2;
    const span = Math.max(8, xb - xa);
    g.beginPath();
    g.moveTo(xa, by - 8);
    g.quadraticCurveTo(xa, by + 6, xa + Math.min(18, span / 4), by + 6);
    g.lineTo(mxp - 10, by + 6);
    g.lineTo(mxp, by + 18);
    g.lineTo(mxp + 10, by + 6);
    g.lineTo(xb - Math.min(18, span / 4), by + 6);
    g.quadraticCurveTo(xb, by + 6, xb, by - 8);
    g.stroke();
    g.restore();
    const s = clamp(o.vis, 0, 1.2);
    if (o.k === 0) P.drawText(g, mxp, by + 66, '1', 76, col, { scale: s, bold: true, halo: C.bg });
    else P.drawFrac(g, mxp, by + 80, 1, Math.pow(2, o.k), 54, col, { scale: s, halo: C.bg });
  }
}

// ------------------------------------------------------------------ floor / number line
function drawFloor(g, t) {
  g.save();
  g.strokeStyle = C.ink;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-700, FLOOR);
  g.lineTo(W + 700, FLOOR);
  g.stroke();
  // coloured travelled segments
  const lead = charLead(t);
  let segs;
  if (t < T.rewind) segs = segsFirstRun(t).filter((s) => s.k <= 4);
  else if (t < T.sprint) segs = segsFirstRun(T.rewind).filter((s) => s.k <= 4).map((s) => ({ ...s, b: Math.min(s.b, (lead - X0) / L) })).filter((s) => s.b > s.a);
  else segs = segsProgress(clamp((lead - X0) / L), 14);
  g.lineWidth = 10;
  g.lineCap = 'butt';
  for (const s of segs) {
    g.strokeStyle = s.color;
    g.beginPath();
    g.moveTo(X0 + s.a * L, FLOOR);
    g.lineTo(X0 + s.b * L, FLOOR);
    g.stroke();
  }
  // 0 and 1 ticks of the number line
  const nl = E('outBack', R(t, T.numline, T.numline + 0.3));
  if (nl > 0) {
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.strokeStyle = C.ink;
    for (const xx of [X0, X1]) {
      g.beginPath();
      g.moveTo(xx, FLOOR - 14 * nl);
      g.lineTo(xx, FLOOR + 14 * nl);
      g.stroke();
    }
    P.drawText(g, X0, FLOOR + 58, '0', 50, C.ink, { scale: popIn(t, T.numline + 0.25), bold: true });
    P.drawText(g, X1, FLOOR + 58, '1', 50, C.ink, { scale: popIn(t, T.numline + 0.45), bold: true });
  }
  g.restore();
}

// guide lines tying the bar to the run
function drawGuides(g, t) {
  const a = popInOut(t, T.bar + 0.2, 3.2, 0.3, 0.4);
  if (a <= 0) return;
  g.save();
  g.globalAlpha = clamp(a) * 0.5;
  g.strokeStyle = C.ink;
  g.lineWidth = 3;
  g.setLineDash([6, 12]);
  for (const xx of [X0, X1]) {
    g.beginPath();
    g.moveTo(xx, BAR_Y + BAR_H / 2 + 10);
    g.lineTo(xx, FLOOR - 18);
    g.stroke();
  }
  g.restore();
}

// ------------------------------------------------------------------ sprint gates
function drawSprintGates(g, t, front) {
  if (t < T.sprint - 0.2) return;
  const hx = charX(t);
  for (let k = 1; k <= 14; k++) {
    const x = posOf(kEnd(k));
    if ((hx + 12 < x) !== front) continue;
    const tb = sprintGateT(k);
    const ta = sprintAppearT(k);
    const col = fracColor(k);
    const life = tb - ta;
    if (t >= ta && t < tb && life > 1 / 90) {
      const dropT = Math.min(0.1, life * 0.45);
      let drop = 0;
      if (t < ta + dropT) drop = (1 - ease.inQuad((t - ta) / dropT)) * 700;
      const h = GATE_H * (1 - 0.12 * U.spring(t - ta - dropT, 6, 10));
      P.drawGate(g, x, FLOOR - drop, h, col);
      if (k <= 4 && drop < 1) {
        P.drawFrac(g, x, FLOOR - h - 70, 1, Math.pow(2, k), 54 - k * 5, col, { scale: popIn(t, ta + dropT, 0.15), halo: C.bg });
      }
    }
    if (t >= tb) {
      // tick left on the floor
      if (k <= 7) P.drawGate(g, x, FLOOR, 22, col);
      if (k <= 4) P.shards(g, x, FLOOR, GATE_H, col, tb, t, 1, k * 7);
    }
  }
}

// ------------------------------------------------------------------ mini gates
const MINI_GATES = [
  { k: 1, x: 150, a: 300, slam: T.miniSlam },
  { k: 2, x: 75, a: 150, slam: T.miniSlam2 },
];
function drawMiniGates(g, t) {
  for (const mg of MINI_GATES) {
    const st = gateHeight(t, mg.slam, undefined, 230);
    if (!st) continue;
    const col = fracColor(mg.k);
    P.drawGate(g, mg.x, FLOOR - st.drop, st.h, col, { bend: 10 * U.wobble(t - mg.slam, 4, 6) });
    P.dustBurst(g, mg.x, FLOOR, mg.slam, t, { n: 7, speed: 120, rise: 22, seed: 99 + mg.k });
    if (t > mg.slam) {
      const p = E('outCubic', R(t, mg.slam, mg.slam + 0.25));
      P.drawArc(g, mg.a, mg.x, FLOOR, col, p);
      P.drawFrac(g, mg.x, FLOOR - st.h - 62, 1, Math.pow(2, mg.k), 46, col, { scale: popIn(t, mg.slam + 0.1), halo: C.bg });
    }
  }
}

// ------------------------------------------------------------------ the lens (zoom)
const LENS = { x: 540, y: 1200, r: 400 };
const LZ = { floor: 150, xF: -285, xC: 190, armY: -6 };

function drawLens(g, t, handPos) {
  if (t < T.lensOpen || t > T.lensShut) return;
  const openU = E('outCubic', R(t, T.lensOpen, T.lensOpen + 0.4));
  const closeU = E('inCubic', R(t, T.lensClose, T.lensShut));
  const k = openU * (1 - closeU);
  const gap = [handPos[0] + 8, handPos[1]];
  const cx = lerp(gap[0], LENS.x, k), cy = lerp(gap[1], LENS.y, k);
  const r = LENS.r * k;
  if (r < 2) return;

  // dim the world behind
  g.save();
  g.fillStyle = rgba(C.bg, 0.55 * k);
  g.fillRect(0, 0, W, H);
  // drop shadow
  g.fillStyle = rgba(C.ink, 0.12);
  g.beginPath();
  g.arc(cx + 8, cy + 12, r + 6, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.clip();
  g.fillStyle = C.bgLens;
  g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.translate(cx, cy);
  const cs = lerp(0.35, 1, k);
  g.scale(cs, cs);

  // ---- zoom state
  const steps = T.lensSteps, durs = T.lensDur;
  let i = -1;
  for (let j = 0; j < steps.length; j++) if (t >= steps[j]) i = j;
  let fingerU = 0, z = 1, zoomU = 0;
  if (i >= 0) {
    const d = durs[i], s0 = steps[i];
    fingerU = 0.5 * E('outBack', R(t, s0 + d * 0.18, s0 + d * 0.42));
    zoomU = E('inOutCubic', R(t, s0 + d * 0.5, s0 + d * 0.85));
    z = Math.pow(2, zoomU);
  }
  const totalZoom = Math.pow(2, Math.max(0, i) + zoomU);
  // u -> screen x, with the current zoom about the crust (u = 1)
  const XU = (u) => LZ.xF + (1 - (1 - u) * z) * (LZ.xC - LZ.xF);

  // fractal dot-grid anchored at the crust
  const lg = Math.log2(totalZoom);
  const fr = lg - Math.floor(lg);
  for (const [mul, alpha] of [[1, 1 - fr], [2, fr], [0.5, 0]]) {
    const sp = 46 * Math.pow(2, fr) * mul;
    if (alpha <= 0.02) continue;
    g.fillStyle = rgba('#D9CFBC', alpha);
    for (let gx = LZ.xC; gx > -r / cs - 50; gx -= sp) {
      for (let gy = LZ.floor; gy > -r / cs - 50; gy -= sp) {
        g.beginPath();
        g.arc(gx, gy, 3, 0, TAU);
        g.fill();
      }
    }
  }

  // floor
  g.strokeStyle = C.ink;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(-r / cs - 20, LZ.floor);
  g.lineTo(r / cs + 20, LZ.floor);
  g.stroke();

  // coloured floor segments of previous steps (in current coords)
  g.lineWidth = 14;
  for (let j = 0; j <= i; j++) {
    const done = j < i || fingerU >= 0.49;
    if (!done) continue;
    const sh = Math.pow(2, i - j);
    const ua = 1 - sh, ub = 1 - 0.5 * sh;
    g.strokeStyle = fracColor(5 + j);
    g.beginPath();
    g.moveTo(XU(ua), LZ.floor);
    g.lineTo(XU(ub), LZ.floor);
    g.stroke();
  }

  // pizza crust (huge)
  const pcx = LZ.xC + 700, pcy = -20;
  g.fillStyle = C.crustDark;
  g.beginPath(); g.arc(pcx + 6, pcy + 26, 700, 0, TAU); g.fill();
  g.fillStyle = C.crust;
  g.beginPath(); g.arc(pcx, pcy, 700, 0, TAU); g.fill();
  g.fillStyle = C.sauce;
  g.beginPath(); g.arc(pcx, pcy, 640, 0, TAU); g.fill();
  g.fillStyle = C.cheese;
  g.beginPath(); g.arc(pcx, pcy, 626, 0, TAU); g.fill();
  g.fillStyle = C.pepperoni;
  g.beginPath(); g.arc(LZ.xC + 150, -170, 62, 0, TAU); g.fill();
  g.beginPath(); g.arc(LZ.xC + 175, 90, 56, 0, TAU); g.fill();
  g.fillStyle = C.pepperoniDark;
  for (const [dx, dy] of [[135, -185], [168, -150], [160, 75], [190, 105], [150, 100]]) {
    g.beginPath(); g.ellipse(LZ.xC + dx, dy, 7, 5, 0, 0, TAU); g.fill();
  }
  g.fillStyle = C.basil;
  g.beginPath(); g.ellipse(LZ.xC + 110, -40, 36, 15, 0.6, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(LZ.xC + 180, 250, 30, 13, -0.4, 0, TAU); g.fill();
  // crust bubbles
  g.fillStyle = rgba('#FFFFFF', 0.25);
  for (const [dx, dy] of [[28, -180], [24, 40], [34, -60], [30, 170]]) {
    g.beginPath(); g.ellipse(LZ.xC + dx, dy, 8, 5, 0, 0, TAU); g.fill();
  }

  // gates
  const drawLGate = (u, j, slamT, label) => {
    const x = XU(u);
    if (x < -r / cs - 40) return;
    let drop = 0;
    if (t < slamT) drop = (1 - ease.inQuad(clamp((t - (slamT - 0.1)) / 0.1))) * 900;
    const h = 330 * (1 - 0.16 * U.spring(t - slamT, 5, 9));
    const col = fracColor(5 + j);
    P.drawGate(g, x, LZ.floor - drop, h, col, { width: 16, bend: 12 * U.wobble(t - slamT, 4, 6) });
    if (label && drop < 1) {
      const vis = popIn(t, slamT, 0.25);
      g.save();
      g.globalAlpha *= j === i || (i < 0 && j === 0) ? 1 : 0.35;
      if (vis > 0.01) P.drawFrac(g, x, LZ.floor - h - 90, 1, Math.pow(2, 5 + j), 62, col, { scale: vis, halo: C.bgLens });
      g.restore();
    }
    P.dustBurst(g, x, LZ.floor, slamT, t, { n: 8, speed: 160, rise: 30, size: 18, seed: 300 + j });
  };
  for (let j = 0; j <= i; j++) {
    const sh = Math.pow(2, i - j);
    drawLGate(1 - 0.5 * sh, j, steps[j] + 0.1, true);
  }
  if (i < 0 && t > steps[0] - 0.12) drawLGate(0.5, 0, steps[0] + 0.1, true);

  // flurry: gates pile up towards the crust (no more zoom)
  let flurryFinger = 0;
  if (t > T.flurry - 0.1) {
    for (let j = 1; j <= 9; j++) {
      const st = T.flurry + 0.055 * (j - 1);
      if (t < st - 0.06) continue;
      const u = 1 - Math.pow(2, -j);
      const x = XU(u);
      let drop = t < st ? (1 - (t - (st - 0.06)) / 0.06) * 800 : 0;
      const col = fracColor(8 + j);
      P.drawGate(g, x, LZ.floor - drop, 330 - j * 6, col, { width: Math.max(4, 16 - j * 1.3) });
      if (drop < 1 && j <= 4) {
        const lv = popInOut(t, st, st + 0.12, 0.08, 0.15);
        if (lv > 0) P.drawFrac(g, x + (j % 2 ? -26 : 26) - 30, LZ.floor - 330 - (j % 2) * 80, 1, Math.pow(2, 8 + j), 40, col, { scale: lv, halo: C.bgLens });
      }
      if (t > st) flurryFinger = Math.max(flurryFinger, u * 0.15);
    }
  }

  // the finger (arm coming from the left)
  const fu = i >= 0 ? (zoomU > 0 ? 0.5 : fingerU) : 0;
  let fx = XU(fu) - 30;
  if (t > T.flurry) fx += 8 * U.noise1(t * 40);
  const fy = LZ.armY + 4 * Math.sin(t * 9);
  g.strokeStyle = C.ink;
  g.lineCap = 'round';
  g.lineWidth = 46;
  g.beginPath();
  g.moveTo(-r / cs - 80, LZ.armY + 60);
  g.lineTo(fx, fy);
  g.stroke();
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(fx, fy, 34, 0, TAU);
  g.fill();
  // tiny sweat drops
  if (t > steps[1]) {
    const sp = ((t - steps[1]) * 2.2) % 1;
    P.drawSweat(g, fx - 60 - sp * 40, fy - 70 - sp * 30, 12 * (1 - sp));
  }
  g.restore();

  // lens ring
  g.save();
  g.strokeStyle = C.ink;
  g.lineWidth = 12;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.stroke();
  g.strokeStyle = rgba('#FFFFFF', 0.6);
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, r - 12, -2.6, -1.9);
  g.stroke();
  g.restore();

  // zoom badge  (×2, ×4, ...)
  if (i >= 0 && k > 0.9) {
    const zl = Math.round(Math.pow(2, i + (zoomU > 0.5 ? 1 : 0)));
    if (zl >= 2) {
      const bx = cx + r * 0.62, by = cy + r * 0.78;
      const s = popIn(t, steps[i] + durs[i] * 0.68, 0.2) || 1;
      g.save();
      g.fillStyle = C.ink;
      g.beginPath();
      g.roundRect(bx - 58, by - 30, 116, 60, 30);
      g.fill();
      g.restore();
      P.drawText(g, bx, by, '×' + zl, 38, '#FFFFFF', { bold: true, scale: s });
    }
  }
}

// ------------------------------------------------------------------ overlays
function drawCharFx(g, t, st, anc) {
  const [hx, hy] = anc.head;
  const hr = anc.headR;
  // "!" when he first sees the pizza
  const bang = popInOut(t, T.bang, 1.3, 0.2, 0.15);
  if (bang > 0) P.drawBang(g, hx + 6, hy - hr - 70, 92, bang, C.ink, 0.12);
  // "?" at the first gate
  const q = popInOut(t, T.q1, 5.25, 0.22, 0.15);
  if (q > 0) P.drawQuestion(g, hx + 10, hy - hr - 66, 84, q, C.ink, 0.1 * Math.sin(t * 6));
  // speed lines
  const sl = clamp((st.speed - 250) / 300);
  if (t < T.rewind || t > T.sprint) P.speedLines(g, st.x - 20, FLOOR - 40, 200, Math.sign(st.v || 1), sl, t);
  // dust from launching / skidding
  P.dustBurst(g, st.x - 10, FLOOR, T.go1, t, { dir: -1, n: 6, speed: 160, seed: 21 });
  P.dustBurst(g, st.x - 10, FLOOR, T.sprint, t, { dir: -1, n: 8, speed: 200, seed: 22 });
  for (const ts of [4.4, 4.5, 4.58, 6.04, T.arrive]) P.dustBurst(g, st.x + 40, FLOOR, ts, t, { dir: 1, n: 4, speed: 70, size: 11, seed: Math.floor(ts * 100) });
  // bonk: stars orbiting the head
  if (t > T.bonk && t < 8.1) {
    const fade = 1 - clamp((t - 7.85) / 0.25);
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + (i * TAU) / 3;
      P.drawStar4(g, hx + Math.cos(a) * hr * 1.3, hy - hr * 0.9 + Math.sin(a) * hr * 0.35, 13 * fade, C.gold, t * 4);
    }
  }
  if (t > T.bonk && t < T.bonk + 0.3) {
    // impact lines
    const u = (t - T.bonk) / 0.3;
    g.save();
    g.strokeStyle = rgba(C.ink, 1 - u);
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + i * 0.55;
      const r0 = 30 + u * 40, r1 = r0 + 26;
      g.beginPath();
      g.moveTo(G[3] + 10 + Math.cos(a) * r0, hy + Math.sin(a) * r0);
      g.lineTo(G[3] + 10 + Math.cos(a) * r1, hy + Math.sin(a) * r1);
      g.stroke();
    }
    g.restore();
  }
  // tantrum: scribble cloud with infinity + steam
  const tc = popInOut(t, T.tantrum + 0.05, 15.15, 0.2, 0.2);
  if (tc > 0) {
    g.save();
    g.translate(hx, hy - hr - 130);
    g.scale(tc, tc);
    P.drawCloud(g, 0, 0, 1.6, '#FFFFFF', C.ink);
    P.drawScribble(g, 0, 0, 46, t, 5);
    P.drawInfinity(g, 0, 0, 52, fracColor(1), 11, 0.15 * Math.sin(t * 20));
    g.restore();
    for (let i = 0; i < 4; i++) {
      const ph = (t * 2.5 + i / 4) % 1;
      const side = i % 2 ? 1 : -1;
      g.save();
      g.globalAlpha = (1 - ph) * 0.8;
      g.fillStyle = '#FFFFFF';
      g.strokeStyle = rgba(C.ink, 0.4);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(hx + side * (hr + 8 + ph * 40), hy - hr * 0.3 - ph * 60, 8 + ph * 12, 0, TAU);
      g.fill();
      g.stroke();
      g.restore();
    }
  }
  // rain cloud while sitting
  const rc = popInOut(t, T.sitThud + 0.05, T.lookUp + 0.2, 0.25, 0.3);
  if (rc > 0) {
    const cxr = hx + 4, cyr = hy - hr - 95;
    g.save();
    g.beginPath();
    g.rect(cxr - 70, cyr, 140, FLOOR - cyr);
    g.clip();
    g.strokeStyle = rgba('#7FB7E6', 0.9 * clamp(rc));
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const ph = (t * 2.2 + i * 0.37) % 1;
      const dx = -50 + ((i * 37) % 100);
      const dy = cyr + 20 + ph * 140;
      g.beginPath();
      g.moveTo(cxr + dx, dy);
      g.lineTo(cxr + dx - 3, dy + 16);
      g.stroke();
    }
    g.restore();
    g.save();
    g.translate(cxr, cyr);
    g.scale(rc, rc);
    P.drawCloud(g, 0, 0, 0.95, '#A9B1BC', null);
    g.restore();
  }
  // light bulb
  const bulb = popInOut(t, T.bulb, 22.35, 0.3, 0.2);
  if (bulb > 0) P.drawBulb(g, hx + 4, hy - hr - 80, bulb * 1.15, clamp((t - T.bulb) / 0.3), t);
  // sweat drop while reaching
  if (t > 9.8 && t < T.lensShut) {
    const ph = ((t - 9.8) * 1.6) % 1;
    P.drawSweat(g, hx - hr - 6, hy - hr * 0.5 + ph * 30, 9 * (1 - ph * 0.5));
  }
  // rewind arrows over the character
  if (t > T.rewind && t < T.rewindEnd) {
    P.speedLines(g, st.x + 30, FLOOR - 40, 200, -1, 0.9, t);
  }
}

function drawRewindOverlay(g, t) {
  const a = popInOut(t, T.rewind, T.rewindEnd, 0.08, 0.12);
  if (a <= 0) return;
  g.save();
  g.globalAlpha = clamp(a);
  // scanlines
  g.fillStyle = rgba(C.ink, 0.05);
  for (let y = 0; y < H; y += 8) g.fillRect(0, y, W, 3);
  // tracking noise bands
  const r = U.rng(Math.floor(t * 24));
  for (let i = 0; i < 3; i++) {
    const y = ((t * 900 + i * 640) % (H + 200)) - 100;
    g.fillStyle = rgba('#FFFFFF', 0.35 + r() * 0.2);
    g.fillRect(0, y, W, 10 + r() * 20);
  }
  const blink = Math.sin(t * 16) > -0.2 ? 1 : 0.3;
  g.globalAlpha = clamp(a) * blink;
  P.drawRewind(g, 150, 330, 46, 1);
  g.restore();
}

// ------------------------------------------------------------------ background
let bgCache = null;
function drawBackground(g) {
  if (!bgCache) {
    bgCache = createCanvas(W, H);
    const b = bgCache.getContext('2d');
    b.fillStyle = C.bg;
    b.fillRect(0, 0, W, H);
    b.fillStyle = C.grid;
    const sp = 54;
    for (let x = sp / 2; x < W; x += sp) {
      for (let y = sp / 2; y < H; y += sp) {
        b.beginPath();
        b.arc(x, y, 2.4, 0, TAU);
        b.fill();
      }
    }
  }
  g.drawImage(bgCache, 0, 0);
}

// ------------------------------------------------------------------ camera
const camTrack = track([
  [0, { z: 1.75, x: 250, y: 1120 }],
  [T.whip, { z: 1.75, x: 250, y: 1120 }],
  [T.whip + 0.22, { z: 1.75, x: 830, y: 1120 }, 'inOutCubic'],
  [1.42, { z: 1.75, x: 840, y: 1120 }],
  [1.82, { z: 1, x: W / 2, y: H / 2 }, 'inOutQuad'],
  [T.tantrum, { z: 1, x: W / 2, y: H / 2 }],
  [T.tantrum + 0.35, { z: 1.07, x: 640, y: 1080 }, 'outCubic'],
  [T.reveal - 0.1, { z: 1.07, x: 640, y: 1080 }],
  [T.reveal + 0.5, { z: 1, x: W / 2, y: H / 2 }, 'inOutCubic'],
  [T.deadpan - 0.02, { z: 1, x: W / 2, y: H / 2 }],
  [T.deadpan + 0.08, { z: 1.32, x: 700, y: 920 }, 'outQuart'],
  [T.lookMini + 0.25, { z: 1.32, x: 700, y: 920 }],
  [T.lookMini + 0.55, { z: 1, x: W / 2, y: H / 2 }, 'inOutCubic'],
  [T.end, { z: 1, x: W / 2, y: H / 2 }],
]);
const SHAKES = [
  [T.slam1, 10], [T.slam2, 10], [T.slam3, 12], [T.bonk, 16], [T.slam4, 9],
  [T.stomps[0], 9], [T.stomps[1], 9], [T.stomps[2], 11], [T.sitThud, 6],
  [T.merges[4] + 0.25, 6], [T.arrive, 8], [T.miniSlam, 8], [T.miniSlam2, 6],
];
function shakeAt(t) {
  let sx = 0, sy = 0;
  for (const [t0, amp] of SHAKES) {
    const d = t - t0;
    if (d < 0 || d > 0.4) continue;
    const a = amp * Math.exp(-d * 12);
    sx += a * U.noise1(t * 60 + t0 * 10);
    sy += a * U.noise1(t * 60 + 77 + t0 * 10);
  }
  return [sx, sy];
}

// ------------------------------------------------------------------ frame
export function drawFrame(g, t) {
  drawBackground(g);
  const cam = camTrack(t);
  const [shx, shy] = shakeAt(t);
  g.save();
  g.translate(W / 2 + shx, H / 2 + shy);
  g.scale(cam.z, cam.z);
  g.translate(-cam.x, -cam.y);

  drawGuides(g, t);
  drawEquation(g, t);
  drawBar(g, t);
  drawFloor(g, t);

  // table + pizza
  P.drawTable(g, TABLE.cx, TABLE.top, FLOOR, TABLE.w);
  const missing = [];
  if (t > T.steal) missing.push(2);
  if (t > T.eatPick) missing.push(4);
  P.drawSteam(g, PZ.cx, PZ.cy - 10, t, t > T.steal ? 0.5 : 1);
  P.drawPizza(g, PZ.cx, PZ.cy, PZ.rx, PZ.ry, { missing, t });
  // cheese strings while the slice is pulled away
  const mini = miniChar(t);
  if (mini && t > T.steal && t < T.steal + 0.22) {
    const ma = anchors(mini);
    const u = (t - T.steal) / 0.22;
    g.save();
    g.strokeStyle = C.cheese;
    g.lineWidth = 4 * (1 - u) + 1;
    for (const off of [-6, 2, 9]) {
      g.beginPath();
      g.moveTo(PZ.cx + 30 + off, PZ.cy + 12);
      g.quadraticCurveTo(PZ.cx + 50, PZ.cy + 30 * u, ma.hand[0] - 6 + off * 0.3, ma.hand[1] - 18);
      g.stroke();
    }
    g.restore();
  }
  // "−1/8" on the hole
  const minus = popInOut(t, T.minus, 28.9, 0.3, 0.25);
  if (minus > 0) {
    g.save();
    g.translate(PZ.cx + 44, PZ.cy - 92);
    g.scale(minus, minus);
    g.rotate(-0.08);
    P.drawText(g, -40, 0, '−', 56, C.pepperoni, { bold: true, halo: C.bg });
    P.drawFrac(g, 4, 0, 1, 8, 44, C.pepperoni, { halo: C.bg });
    g.restore();
  }

  // arcs + labels of the first run
  for (const arc of ARCS) {
    if (t < arc.t0) continue;
    if (t > arc.fly + 0.3) continue;
    const p = E('outCubic', R(t, arc.t0, arc.t0 + 0.3));
    const fade = 1 - clamp((t - arc.fly) / 0.3);
    P.drawArc(g, arc.a, arc.b, FLOOR, fracColor(arc.k), p, 0, fade);
    if (t < arc.fly) {
      const [lx, ly] = labelRest(arc);
      P.drawFrac(g, lx, ly, 1, Math.pow(2, arc.k), EQ_SIZE, fracColor(arc.k), { scale: 1.15 * popIn(t, arc.t0 + 0.12, 0.3), halo: C.bg });
    }
  }

  drawMainGates(g, t, false);
  drawSprintGates(g, t, false);

  const st = mainChar(t);
  const anc = drawCharacter(g, st);
  drawMainGates(g, t, true);
  drawSprintGates(g, t, true);
  // slice in the main character's hand at the end
  if (t > T.eatPick) {
    const a = anchors(st);
    P.drawSlice(g, a.hand[0] + 4, a.hand[1] - 8, 1.25, -0.5 - 0.1 * Math.sin(t * 22));
  }
  if (mini) drawCharacter(g, mini);
  drawMiniGates(g, t);
  if (mini) {
    const ma = anchors(mini);
    const q = popInOut(t, T.miniQ, T.miniSlam2 - 0.05, 0.22, 0.12);
    if (q > 0) P.drawQuestion(g, ma.head[0] + 30, ma.head[1] - ma.headR - 40, 62, q, C.ink, 0.15);
    const bang = popInOut(t, T.miniSlam2 + 0.05, T.end, 0.18, 0.1);
    if (bang > 0) P.drawBang(g, ma.head[0] + 30, ma.head[1] - ma.headR - 40, 64, bang, C.ink, 0.15);
    if (t > T.miniIn && t < T.steal + 0.9) P.speedLines(g, ma.hip[0] + 20 * (t > T.steal ? 1 : -1), FLOOR - 10, 90, t > T.steal ? -1 : -1, clamp((mini.speed - 0.3) * 2), t);
  }
  drawCharFx(g, t, st, anc);

  // celebration sparkles
  const br = barRect(t);
  P.sparkleBurst(g, br.x + br.w / 2, br.y, T.merges[4] + 0.3, t, { n: 16, radius: 420, sy: 0.35, size: 16, colors: [C.gold, fracColor(1), fracColor(2), fracColor(3), fracColor(4)], seed: 3 });
  P.sparkleBurst(g, X0 + L / 2, BAR_Y, T.arrive + 0.05, t, { n: 14, radius: 340, sy: 0.4, size: 14, colors: [C.gold, fracColor(1), fracColor(2), fracColor(3)], seed: 4 });
  P.sparkleBurst(g, PZ.cx, PZ.cy - 30, T.whip + 0.2, t, { n: 9, radius: 140, size: 15, colors: [C.gold, '#FFFFFF'], seed: 8, life: 0.7 });
  P.sparkleBurst(g, PZ.cx, PZ.cy - 40, T.arrive + 0.15, t, { n: 8, radius: 110, size: 12, colors: [C.gold], seed: 5 });

  g.restore();

  // screen-space overlays
  drawLens(g, t, anc.hand);
  drawRewindOverlay(g, t);
  drawWatermark(g);
}

// ------------------------------------------------------------------ watermark
let watermarkText = WATERMARK.text;
export function setWatermark(text) {
  watermarkText = text || null;
}
function drawWatermark(g) {
  if (!watermarkText) return;
  g.save();
  g.globalAlpha = WATERMARK.alpha;
  g.font = `${WATERMARK.size}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // soft halo so it stays readable when something passes behind it
  g.lineJoin = 'round';
  g.strokeStyle = C.bg;
  g.lineWidth = WATERMARK.size * 0.22;
  g.strokeText(watermarkText, WATERMARK.x, WATERMARK.y);
  g.fillStyle = C.ink;
  g.fillText(watermarkText, WATERMARK.x, WATERMARK.y);
  g.restore();
}
