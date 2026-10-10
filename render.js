#!/usr/bin/env node
// Render "Mates sin palabras — Zenón y la pizza".
//   node render.js                 -> out/zenon_pizza.mp4 (+ audio) and out/zenon_pizza_sin_audio.mp4
//   node render.js --stills 1,4.5  -> out/stills/*.png
//   node render.js --sheet 0:32:1  -> out/sheet.png (contact sheet)
//   node render.js --fps 30 --preview  (half resolution, quick check)
import { createCanvas } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawFrame, DURATION, FPS_DEFAULT } from './src/scene.js';
import { W, H } from './src/style.js';
import { renderAudio } from './src/audio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const preview = !!opt('preview', false);
const fps = Number(opt('fps', preview ? 30 : FPS_DEFAULT));
const scale = preview ? 0.5 : 1;

function frameCanvas() {
  const c = createCanvas(Math.round(W * scale), Math.round(H * scale));
  const g = c.getContext('2d');
  return { c, g };
}

function renderAt(g, t) {
  g.save();
  g.scale(scale, scale);
  drawFrame(g, t);
  g.restore();
}

async function stills(list) {
  const dir = path.join(OUT, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const { c, g } = frameCanvas();
  for (const t of list) {
    renderAt(g, t);
    const f = path.join(dir, `t_${t.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, c.toBuffer('image/png'));
    console.log(f);
  }
}

async function sheet(spec) {
  let times = [];
  if (spec.includes(':')) {
    const [a, b, s] = spec.split(':').map(Number);
    for (let t = a; t <= b + 1e-9; t += s) times.push(+t.toFixed(3));
  } else times = spec.split(',').map(Number);
  const cols = Math.min(Number(opt('cols', 8)), times.length);
  const tw = Number(opt('tw', 270)), th = Math.round(tw * 16 / 9);
  const rows = Math.ceil(times.length / cols);
  const out = createCanvas(cols * tw, rows * (th + 26));
  const og = out.getContext('2d');
  og.fillStyle = '#333';
  og.fillRect(0, 0, out.width, out.height);
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  times.forEach((t, i) => {
    g.save();
    drawFrame(g, t);
    g.restore();
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 26);
    og.drawImage(c, x, y, tw - 4, th);
    og.fillStyle = '#fff';
    og.font = '18px sans-serif';
    og.fillText(t.toFixed(2) + 's', x + 6, y + th + 19);
  });
  const f = path.join(OUT, opt('name', 'sheet') + '.png');
  fs.writeFileSync(f, out.toBuffer('image/png'));
  console.log(f);
}

function waitDrain(stream) {
  return new Promise((res) => stream.once('drain', res));
}

async function video() {
  const total = Math.round(DURATION * fps);
  const from = Number(opt('from', 0)), to = Number(opt('to', DURATION));
  const f0 = Math.round(from * fps), f1 = Math.min(total, Math.round(to * fps));
  const silent = path.join(OUT, preview ? 'preview_sin_audio.mp4' : 'zenon_pizza_sin_audio.mp4');
  const { c, g } = frameCanvas();
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${c.width}x${c.height}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', preview ? '23' : '15',
    '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    silent,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg ' + code)))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / fps;
    renderAt(g, t);
    const buf = c.data();
    if (!ff.stdin.write(Buffer.from(buf))) await waitDrain(ff.stdin);
    if (f % fps === 0) process.stdout.write(`\r  frame ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  ff.stdin.end();
  await done;
  console.log(`\nvideo: ${silent}`);
  if (opt('noaudio', false)) return;

  const wav = path.join(OUT, 'zenon_pizza_audio.wav');
  renderAudio(wav, DURATION);
  console.log(`audio: ${wav}`);
  const final = path.join(OUT, preview ? 'preview.mp4' : 'zenon_pizza.mp4');
  await new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav,
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error('mux ' + code))));
  });
  console.log(`final: ${final}`);
}

const st = opt('stills', null);
const sh = opt('sheet', null);
if (st) await stills(String(st).split(',').map(Number));
else if (sh) await sheet(String(sh));
else if (opt('audio', false)) { renderAudio(path.join(OUT, 'zenon_pizza_audio.wav'), DURATION); }
else await video();
