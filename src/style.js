// Visual identity of "Mates sin palabras": palette, layout and fonts.
import { GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(path.join(here, '../assets/fonts/fredoka-latin-600-normal.woff2'), 'Fredoka');
GlobalFonts.registerFromPath(path.join(here, '../assets/fonts/fredoka-latin-700-normal.woff2'), 'FredokaBold');

export const FONT = 'Fredoka';
export const FONT_BOLD = 'FredokaBold';

export const W = 1080;
export const H = 1920;

export const C = {
  bg: '#F6F1E7',
  bgLens: '#FFFDF8',
  grid: '#ECE4D4',
  ink: '#1B1B1F',
  inkBack: '#45454D',
  white: '#FFFFFF',
  dust: '#DCD2C1',
  mouth: '#E14B57',
  heart: '#FF4D5E',
  drool: '#8FD3FF',
  gold: '#FFC83D',
  goldDeep: '#F0A400',
  // pizza
  crust: '#E7A552',
  crustDark: '#C67F33',
  cheese: '#FFD55E',
  cheeseDark: '#F3B93A',
  sauce: '#E4572E',
  pepperoni: '#D7263D',
  pepperoniDark: '#A91B2E',
  basil: '#3FA34D',
  bandana: '#FF4D5E',
  bulb: '#FFE066',
};

// One colour per term of the series 1/2, 1/4, 1/8, ...
export const FRAC_COLORS = [
  '#FF5A5F', // 1/2
  '#3A86FF', // 1/4
  '#2EC4B6', // 1/8
  '#8E6CFF', // 1/16
  '#FF66C4', // 1/32
  '#FFA62B', // 1/64
  '#22C55E', // 1/128
  '#00B4D8', // 1/256
];
export const fracColor = (k) => FRAC_COLORS[(k - 1) % FRAC_COLORS.length];

// Stage layout
export const FLOOR = 1330;
export const X0 = 125; // start of the run (character's lead point)
export const X1 = 745; // the pizza (end of the run)
export const L = X1 - X0;
export const BAR_Y = 690;
export const BAR_H = 50;
export const EQ_Y = 505;
export const CHAR_SCALE = 1.22;
export const posOf = (frac) => X0 + L * frac; // x for a fraction of the run

// Creator watermark (screen space, top centre: clear of the TikTok / Reels /
// Shorts UI and of the animation). Override with --watermark / --no-watermark.
export const WATERMARK = { text: 'AntonioSumaySigue', x: W / 2, y: 250, size: 40, alpha: 0.42 };
