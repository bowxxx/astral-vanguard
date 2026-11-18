// renderer.js — Canvas 2D prosedural: nebula paralaks, bintang, glow/bloom, partikel, entitas, boss.
import { W, H, S, MODE } from './state.js';
import { E } from './entities.js';
import { P, NOVA_TIME } from './player.js';
import { B, BOSS_KINDS, beamAngle } from './boss.js';
import { ITEM } from './items.js';
import { makeShape } from './enemies.js';
import { TAU, rnd, clamp, lerp } from './util.js';

let cv, ctx, bloomCv, bloomCtx, vignette, scan, nebA, nebB, planet;
let scrollA = 0, scrollB = 0, planetX = 900, boost = 1, clock = 0;
const stars = [];
const glowCache = new Map();
let demo = null;

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// Sprite glow radial yang di-cache per warna dan ukuran.
function glowSprite(color, size) {
  const key = color + size;
  let g = glowCache.get(key);
  if (!g) {
    g = document.createElement('canvas');
    g.width = g.height = size * 2;
    const c = g.getContext('2d');
    const gr = c.createRadialGradient(size, size, 0, size, size, size);
    gr.addColorStop(0, hexA(color, 1));
    gr.addColorStop(0.3, hexA(color, 0.55));
    gr.addColorStop(1, hexA(color, 0));
    c.fillStyle = gr;
    c.fillRect(0, 0, size * 2, size * 2);
    glowCache.set(key, g);
  }
  return g;
}

function glow(x, y, color, size, alpha = 1) {
  size = Math.max(4, Math.round(size / 4) * 4);
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color, size), x - size, y - size, size * 2, size * 2);
  ctx.globalAlpha = 1;
}

function makeNebula(palette, blobs, w = 2560) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = H;
  const g = c.getContext('2d');
  for (let i = 0; i < blobs; i++) {
    const x = rnd(0, w), y = rnd(0, H), r = rnd(180, 460), col = palette[i % palette.length];
    for (const ox of [-w, 0, w]) {
      const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      gr.addColorStop(0, hexA(col[0], col[1]));
      gr.addColorStop(0.55, hexA(col[0], col[1] * 0.35));
      gr.addColorStop(1, hexA(col[0], 0));
      g.fillStyle = gr;
      g.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 520; i++) {
    g.fillStyle = `rgba(200,230,255,${rnd(0.03, 0.18)})`;
    g.fillRect(rnd(0, w), rnd(0, H), rnd(1, 2), rnd(1, 2));
  }
  return c;
}

function makePlanet() {
  const c = document.createElement('canvas');
  c.width = c.height = 560;
  const g = c.getContext('2d');
  g.translate(280, 280);
  g.strokeStyle = 'rgba(6,182,212,.35)';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 0, 260, 56, -0.35, Math.PI, TAU);
  g.stroke();
  const gr = g.createRadialGradient(-70, -70, 20, -20, -20, 190);
  gr.addColorStop(0, '#1e3a5f');
  gr.addColorStop(0.45, '#0b1730');
  gr.addColorStop(1, '#030712');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 170, 0, TAU);
  g.fill();
  const rim = g.createRadialGradient(0, 0, 150, 0, 0, 172);
  rim.addColorStop(0, 'rgba(6,182,212,0)');
  rim.addColorStop(1, 'rgba(6,182,212,.5)');
  g.fillStyle = rim;
  g.beginPath();
  g.arc(0, 0, 172, 0, TAU);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(0, 0, 170, 0, TAU);
  g.clip();
  for (let i = -6; i < 7; i++) {
    g.fillStyle = i % 2 ? 'rgba(6,182,212,.10)' : 'rgba(126,34,206,.12)';
    g.fillRect(-180, i * 26 + Math.sin(i) * 6, 360, 12 + (i % 3) * 5);
  }
  g.fillStyle = 'rgba(3,7,18,.7)';
  g.beginPath();
  g.arc(80, 70, 195, 0, TAU);
  g.fill();
  g.restore();
  return c;
}

export function initRenderer(canvas) {
  cv = canvas;
  cv.width = W;
  cv.height = H;
  ctx = cv.getContext('2d');
  bloomCv = document.createElement('canvas');
  bloomCv.width = 320;
  bloomCv.height = 180;
  bloomCtx = bloomCv.getContext('2d');
  nebA = makeNebula([['#312e81', 0.30], ['#06b6d4', 0.13], ['#6b21a8', 0.24], ['#0e7490', 0.14]], 16);
  nebB = makeNebula([['#7e22ce', 0.12], ['#0891b2', 0.10], ['#f59e0b', 0.035], ['#be185d', 0.07]], 12);
  planet = makePlanet();
  vignette = document.createElement('canvas');
  vignette.width = W;
  vignette.height = H;
  const v = vignette.getContext('2d');
  const vg = v.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(3,7,18,0)');
  vg.addColorStop(1, 'rgba(3,7,18,.78)');
  v.fillStyle = vg;
  v.fillRect(0, 0, W, H);
  scan = document.createElement('canvas');
  scan.width = 4;
  scan.height = 3;
  const sc = scan.getContext('2d');
  sc.fillStyle = 'rgba(0,0,0,.14)';
  sc.fillRect(0, 2, 4, 1);
  const layers = [[80, 24, 1, 0.45], [50, 75, 1.6, 0.7], [28, 220, 2.2, 1]];
  layers.forEach(([n, sp, size, a], li) => {
    for (let i = 0; i < n; i++) {
      stars.push({
        x: rnd(0, W), y: rnd(0, H), sp: sp * rnd(0.8, 1.2), size, a, li,
        c: Math.random() < 0.2 ? '#fde68a' : Math.random() < 0.4 ? '#a5f3fc' : '#e2e8f0',
      });
    }
  });
  demo = { rocks: [] };
  for (let i = 0; i < 7; i++) {
    demo.rocks.push({
      type: i % 3 === 2 ? 'magma' : 'crystal',
      x: rnd(560, W + 300), y: rnd(60, H - 60), r: rnd(24, 46),
      rot: rnd(0, TAU), vr: rnd(-1, 1), vx: -rnd(40, 110),
      shape: makeShape(10), hp: 5, maxHp: 5, flash: 0, t: rnd(0, 5),
    });
  }
}

export function updateBackground(dt) {
  clock += dt;
  const target = S.mode === MODE.TITLE ? 0.9 : B.alive ? 1.8 : S.bossPhase === 'warning' ? 2.5 : 1;
  S.starBoost = lerp(S.starBoost, target, 1 - Math.exp(-3 * dt));
  boost = S.starBoost;
  scrollA = (scrollA + 14 * boost * dt) % 2560;
  scrollB = (scrollB + 34 * boost * dt) % 2560;
  planetX -= 6 * boost * dt;
  if (planetX < -420) planetX = W + 360;
  for (const s of stars) {
    s.x -= s.sp * boost * dt;
    if (s.x < -60) { s.x = W + 10; s.y = rnd(0, H); }
  }
}

export function updateDemo(dt) {
  for (const r of demo.rocks) {
    r.x += r.vx * dt;
    r.rot += r.vr * dt;
    r.t += dt;
    if (r.x < -80) { r.x = W + 80; r.y = rnd(60, H - 60); }
  }
}

// ---------- bentuk ----------

function polyPath(e, scale = 1) {
  ctx.beginPath();
  e.shape.forEach((p, i) => {
    const x = Math.cos(p.a) * e.r * p.m * scale, y = Math.sin(p.a) * e.r * p.m * scale;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
}

function drawShip(x, y, tilt, alpha = 1, flame = 1, blink = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * 0.18);
  ctx.globalAlpha = alpha * (blink ? 0.45 : 1);
  ctx.globalCompositeOperation = 'lighter';
  const fl = (16 + Math.random() * 9) * flame;
  glow(-20, 0, '#06b6d4', 34 + fl, 0.9);
  const fg = ctx.createLinearGradient(-18, 0, -18 - fl * 1.6, 0);
  fg.addColorStop(0, 'rgba(255,255,255,.95)');
  fg.addColorStop(0.35, 'rgba(6,182,212,.8)');
  fg.addColorStop(1, 'rgba(6,182,212,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-16, -6);
  ctx.lineTo(-18 - fl * 1.6, 0);
  ctx.lineTo(-16, 6);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(10, -7);
  ctx.lineTo(-4, -26);
  ctx.lineTo(-18, -24);
  ctx.lineTo(-11, -9);
  ctx.lineTo(-22, -5);
  ctx.lineTo(-22, 5);
  ctx.lineTo(-11, 9);
  ctx.lineTo(-18, 24);
  ctx.lineTo(-4, 26);
  ctx.lineTo(10, 7);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, -26, 0, 26);
  bg.addColorStop(0, '#1e293b');
  bg.addColorStop(0.5, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(6,182,212,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(-14, 0);
  ctx.moveTo(-4, -19);
  ctx.lineTo(4, -8);
  ctx.moveTo(-4, 19);
  ctx.lineTo(4, 8);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  glow(-16, -24, '#06b6d4', 12, 0.9);
  glow(-16, 24, '#06b6d4', 12, 0.9);
  glow(8, 0, '#f59e0b', 22, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(8, -5);
  ctx.lineTo(1, 0);
  ctx.lineTo(8, 5);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(8, -2);
  ctx.lineTo(5, 0);
  ctx.lineTo(8, 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMeteor(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  const crystal = e.type === 'crystal';
  ctx.globalCompositeOperation = 'lighter';
  if (crystal) glow(0, 0, '#a855f7', e.r * 2.1, 0.55);
  else glow(0, 0, '#f97316', e.r * (2.2 + 0.25 * Math.sin(e.t * 6)), 0.7);
  ctx.globalCompositeOperation = 'source-over';
  polyPath(e);
  const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r);
  if (crystal) {
    g.addColorStop(0, '#a855f7');
    g.addColorStop(1, '#3b0764');
  } else {
    g.addColorStop(0, '#57534e');
    g.addColorStop(1, '#1c1917');
  }
  ctx.fillStyle = g;
  ctx.fill();
  if (crystal) {
    const n = e.shape.length;
    for (let i = 0; i < n; i++) {
      const a = e.shape[i], b = e.shape[(i + 1) % n];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a.a) * e.r * a.m, Math.sin(a.a) * e.r * a.m);
      ctx.lineTo(Math.cos(b.a) * e.r * b.m, Math.sin(b.a) * e.r * b.m);
      ctx.fillStyle = i % 2 ? 'rgba(233,213,255,.2)' : 'rgba(30,10,60,.35)';
      ctx.fill();
    }
    polyPath(e);
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    const hot = 1 - e.hp / e.maxHp;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(251,146,60,${0.7 + hot * 0.3})`;
    ctx.lineWidth = 2.5;
    e.shape.forEach((p, i) => {
      if (i % 2) return;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(p.a) * e.r * p.m * 0.95, Math.sin(p.a) * e.r * p.m * 0.95);
      ctx.stroke();
    });
    glow(0, 0, '#fde68a', e.r * (0.7 + 0.2 * Math.sin(e.t * 8) + hot * 0.4), 0.9);
    ctx.globalCompositeOperation = 'source-over';
    polyPath(e);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (e.flash > 0) {
    polyPath(e);
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    ctx.fill();
  }
  ctx.restore();
}

function drawDrone(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, '#ef4444', 28, 0.55);
  glow(14, 0, '#ef4444', 16, 0.7);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(11, -13);
  ctx.lineTo(5, 0);
  ctx.lineTo(11, 13);
  ctx.closePath();
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#450a0a';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  glow(-3, 0, '#fecaca', 9, 1);
  ctx.restore();
}

function drawGate(e) {
  const top = e.gapY - e.gapH / 2, bot = e.gapY + e.gapH / 2, active = e.t > e.warn;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [y0, y1] of [[0, top], [bot, H]]) {
    if (active) {
      const f = 0.85 + Math.random() * 0.15, w = 16 * f;
      const g = ctx.createLinearGradient(e.x - w * 2, 0, e.x + w * 2, 0);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(0.35, 'rgba(239,68,68,.75)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(0.65, 'rgba(239,68,68,.75)');
      g.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = g;
      ctx.fillRect(e.x - w * 2, y0, w * 4, y1 - y0);
    } else {
      ctx.strokeStyle = `rgba(239,68,68,${0.35 + 0.35 * Math.sin(e.t * 22)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(e.x, y0);
      ctx.lineTo(e.x, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const y of [top, bot]) {
    glow(e.x, y, '#ef4444', 44, active ? 0.95 : 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1c0a0a';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, y - 20);
    ctx.lineTo(e.x + 15, y);
    ctx.lineTo(e.x, y + 20);
    ctx.lineTo(e.x - 15, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
  }
  ctx.restore();
}

function drawBoss() {
  const k = BOSS_KINDS[B.kind], col = k.color, t = B.t;
  ctx.save();
  ctx.translate(B.x, B.y);
  if (B.dying) ctx.translate(rnd(-6, 6), rnd(-4, 4));
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, col, 300, 0.32 + 0.1 * Math.sin(t * 3));
  ctx.globalCompositeOperation = 'source-over';
  // Pelat luar berputar mengelilingi badan.
  for (let i = 0; i < k.plates; i++) {
    const a = (i / k.plates) * TAU + t * 0.25 * (B.kind % 2 ? -1 : 1);
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(84, -33);
    ctx.lineTo(130, -21);
    ctx.lineTo(144, 0);
    ctx.lineTo(130, 21);
    ctx.lineTo(84, 33);
    ctx.closePath();
    const g = ctx.createLinearGradient(84, 0, 144, 0);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1f2937');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    glow(138, 0, col, 14, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  // Pod sayap + meriam.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-20, s * 80);
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#030712';
    ctx.fillRect(-72, -8, 52, 16);
    ctx.strokeRect(-72, -8, 52, 16);
    ctx.globalCompositeOperation = 'lighter';
    glow(-72, 0, '#ef4444', 18 + Math.sin(t * 8 + s) * 4, 0.9);
    glow(0, 0, col, 40, 0.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  // Badan utama bersisi banyak.
  const sides = 6 + (B.kind % 3);
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU + Math.PI / sides;
    const x = Math.cos(a) * 100, y = Math.sin(a) * 100;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  const bg = ctx.createRadialGradient(-30, -30, 10, 0, 0, 105);
  bg.addColorStop(0, '#1f2937');
  bg.addColorStop(1, '#030712');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(col, 0.55);
  ctx.lineWidth = 2;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96);
    ctx.stroke();
  }
  // Mata inti yang mengikuti pemain.
  const eyeCol = B.phase === 0 ? col : B.phase === 1 ? '#f59e0b' : '#ef4444';
  glow(-26, 0, eyeCol, 90 + Math.sin(t * 4) * 8, 0.85);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(-26, 0, 36, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = eyeCol;
  ctx.lineWidth = 3;
  ctx.stroke();
  const dx = clamp(P.x - B.x, -300, 300) / 300 * 9, dy = clamp(P.y - B.y, -300, 300) / 300 * 9;
  ctx.globalCompositeOperation = 'lighter';
  glow(-26 + dx, dy, eyeCol, 28, 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-26 + dx, dy, 8, 0, TAU);
  ctx.fill();
  if (B.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 104, 0, TAU);
    ctx.fill();
  }
  if (B.shieldT > 0 || B.intro > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(56,189,248,${0.5 + 0.3 * Math.sin(t * 14)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, TAU);
    ctx.stroke();
    glow(0, 0, '#38bdf8', 190, 0.18);
  }
  ctx.restore();
}

function drawBossBeam() {
  const b = B.beam;
  if (!b) return;
  const a = b.t < b.warn ? b.a0 : beamAngle(), active = b.t >= b.warn;
  ctx.save();
  ctx.translate(B.x, B.y);
  ctx.rotate(a);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (!active) {
    ctx.strokeStyle = `rgba(239,68,68,${0.3 + 0.4 * Math.abs(Math.sin(b.t * 18))})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(1700, 0);
    ctx.stroke();
  } else {
    const f = 0.85 + Math.random() * 0.15;
    ctx.strokeStyle = 'rgba(239,68,68,.35)';
    ctx.lineWidth = 64 * f;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(1700, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248,113,113,.9)';
    ctx.lineWidth = 28 * f;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9 * f;
    ctx.stroke();
    glow(40, 0, '#ef4444', 80, 0.9);
  }
  ctx.restore();
}

function drawIcon(type) {
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = '#fff';
  ctx.beginPath();
  if (type === 'tri') {
    ctx.moveTo(0, 7);
    ctx.lineTo(-8, -6);
    ctx.moveTo(0, 7);
    ctx.lineTo(0, -9);
    ctx.moveTo(0, 7);
    ctx.lineTo(8, -6);
    ctx.stroke();
  } else if (type === 'overdrive') {
    ctx.moveTo(3, -10);
    ctx.lineTo(-6, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-3, 10);
    ctx.lineTo(7, -3);
    ctx.lineTo(1, -3);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'shield') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, x = Math.cos(a) * 9, y = Math.sin(a) * 9;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, TAU);
    ctx.fill();
  } else if (type === 'magnet') {
    ctx.moveTo(-7, -9);
    ctx.lineTo(-7, 0);
    ctx.arc(0, 0, 7, Math.PI, 0, true);
    ctx.lineTo(7, -9);
    ctx.stroke();
  } else if (type === 'heart') {
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-14, -1, -9, -11, 0, -4);
    ctx.bezierCurveTo(9, -11, 14, -1, 0, 9);
    ctx.fill();
  } else {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r = i % 2 ? 4 : 10;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawItem(it) {
  const def = ITEM[it.type], pulse = 1 + 0.12 * Math.sin(it.t * 5);
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, def.color, 54 * pulse, 0.75);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(3,7,18,.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = hexA(def.color, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 25 * pulse, it.t * 2, it.t * 2 + 4);
  ctx.stroke();
  ctx.scale(0.85, 0.85);
  drawIcon(it.type);
  ctx.restore();
}

function drawBullets() {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of E.pb) {
    const col = b.crit ? '#fde047' : b.kind === 'missile' ? '#f59e0b' : '#22d3ee';
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    glow(b.x, b.y, col, b.r * 4.2, 0.85);
    ctx.strokeStyle = col;
    ctx.lineWidth = b.r * 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x - ux * b.len, b.y - uy * b.len);
    ctx.lineTo(b.x + ux * b.len * 0.3, b.y + uy * b.len * 0.3);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = b.r * 0.55;
    ctx.stroke();
  }
  for (const b of E.eb) {
    glow(b.x, b.y, '#ef4444', b.r * 3.6, 0.95);
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.62, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawCrystals() {
  for (const c of E.crystals) {
    const sx = Math.cos(c.t * 4);
    ctx.globalCompositeOperation = 'lighter';
    glow(c.x, c.y, '#f59e0b', 22, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 10);
    ctx.lineTo(c.x + sx * 6.5, c.y);
    ctx.lineTo(c.x, c.y + 10);
    ctx.lineTo(c.x - sx * 6.5, c.y);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawNovaBeam() {
  if (P.novaT <= 0) return;
  const el = NOVA_TIME - P.novaT;
  const env = Math.min(1, el / 0.15) * Math.min(1, P.novaT / 0.3);
  const h = 160 * env, x0 = P.x + 24;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, P.y - h / 2, 0, P.y + h / 2);
  g.addColorStop(0, 'rgba(6,182,212,0)');
  g.addColorStop(0.28, 'rgba(6,182,212,.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.72, 'rgba(6,182,212,.6)');
  g.addColorStop(1, 'rgba(6,182,212,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, P.y - h / 2, W - x0 + 20, h);
  ctx.strokeStyle = 'rgba(103,232,249,.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = x0; x < W + 20; x += 24) {
      const y = P.y + Math.sin(x * 0.03 - clock * 30 + i * 1.7) * h * 0.3 * (i % 2 ? 1 : -1);
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  glow(x0, P.y, '#fff', 120 * env, 0.9);
  glow(x0 + 20, P.y, '#06b6d4', 220 * env, 0.6);
  ctx.restore();
}

function drawFx() {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of E.parts) {
    const a = p.life / p.max;
    glow(p.x, p.y, p.color, p.size * (0.4 + a * 0.8), a);
  }
  for (const r of E.rings) {
    const k = r.t / r.life, e = 1 - Math.pow(1 - k, 3);
    ctx.strokeStyle = hexA(r.color, 1 - k);
    ctx.lineWidth = r.width * (1 - k * 0.7);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxR * e, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const t of E.texts) {
    ctx.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1);
    ctx.font = `700 ${t.size}px 'Segoe UI', system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(3,7,18,.85)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawPlayerGroup() {
  for (const a of P.afterimg) drawShip(a.x, a.y, a.tilt, a.life * 1.2, 0, false);
  const blink = P.invul > 0 && P.dashT <= 0 && Math.floor(P.invul * 14) % 2 === 0;
  drawShip(P.x, P.y, P.tilt, 1, P.thrust, blink);
  // Inti hitbox kecil di tengah pesawat.
  ctx.globalCompositeOperation = 'lighter';
  glow(P.x + 2, P.y, '#fff', 11, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(P.x + 2, P.y, 2.6, 0, TAU);
  ctx.fill();
  for (const w of P.wing) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.globalCompositeOperation = 'lighter';
    glow(0, 0, '#38bdf8', 22, 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(w.t * 2);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(0, -7);
    ctx.lineTo(-8, 0);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (S.shieldCharges > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(56,189,248,${0.5 + 0.2 * Math.sin(clock * 9)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 40, 0, TAU);
    ctx.stroke();
    glow(P.x, P.y, '#38bdf8', 56, 0.28);
    for (let i = 0; i < S.shieldCharges; i++) {
      const a = clock * 3 + i * Math.PI;
      glow(P.x + Math.cos(a) * 40, P.y + Math.sin(a) * 40, '#bae6fd', 14, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawBackground() {
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(11,15,25,.9)');
  g.addColorStop(1, 'rgba(3,7,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(nebA, -scrollA, 0);
  ctx.drawImage(nebA, 2560 - scrollA, 0);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(planet, planetX - 280, 90, 560, 560);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(nebB, -scrollB, 0);
  ctx.drawImage(nebB, 2560 - scrollB, 0);
  ctx.globalAlpha = 1;
  for (const s of stars) {
    const tw = 0.75 + 0.25 * Math.sin(clock * 2 + s.x);
    const len = s.li === 2 ? s.size + s.sp * boost * 0.035 : s.size;
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, s.y, len, s.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawTitleScene() {
  for (const r of demo.rocks) drawMeteor(r);
  const y = H / 2 + Math.sin(clock * 1.4) * 14;
  ctx.save();
  ctx.translate(130, y);
  ctx.scale(1.8, 1.8);
  drawShip(0, 0, Math.sin(clock * 1.4) * 0.4, 1, 1.1);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = ((clock * 700 + i * 380) % 1000) + 240;
    glow(x, y, '#22d3ee', 14, 0.9);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(x - 14, y - 1.5, 28, 3);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function render(titleMode) {
  ctx.save();
  if (S.shake > 0.3) {
    ctx.translate(rnd(-S.shake, S.shake) * 0.6, rnd(-S.shake, S.shake) * 0.6);
  }
  drawBackground();
  if (titleMode) {
    drawTitleScene();
  } else {
    for (const e of E.enemies) if (e.type === 'gate') drawGate(e);
    drawCrystals();
    for (const it of E.items) drawItem(it);
    for (const e of E.enemies) {
      if (e.type === 'crystal' || e.type === 'magma') drawMeteor(e);
      else if (e.type === 'drone') drawDrone(e);
    }
    if (B.alive) {
      drawBoss();
      drawBossBeam();
    }
    drawBullets();
    if (S.hp > 0) drawPlayerGroup();
    drawNovaBeam();
    drawFx();
  }
  ctx.restore();
  // Bloom palsu: kecilkan, blur, lalu tambahkan kembali dengan mode lighter.
  bloomCtx.filter = 'brightness(.95) contrast(1.7) blur(1.5px)';
  bloomCtx.drawImage(cv, 0, 0, 320, 180);
  bloomCtx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCv, 0, 0, W, H);
  ctx.restore();
  ctx.drawImage(vignette, 0, 0);
  ctx.fillStyle = ctx.createPattern(scan, 'repeat');
  ctx.fillRect(0, 0, W, H);
  if (S.flash > 0) {
    const f = clamp(S.flash, 0, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(239,68,68,0)');
    g.addColorStop(1, `rgba(239,68,68,${0.65 * f})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (S.novaFlash > 0) {
    ctx.fillStyle = `rgba(207,250,254,${clamp(S.novaFlash, 0, 1) * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
}
