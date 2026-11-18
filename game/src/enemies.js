// enemies.js — direktur gelombang dan perilaku meteor kristal, meteor magma, drone, gerbang laser.
import { W, H, S, diff, hpMul, addScore, comboHit } from './state.js';
import { E, enemyBullet, burst, ring, floatText, shake, compact } from './entities.js';
import { rnd, rndi, pick, TAU, clamp } from './util.js';
import { spawnCrystals, maybeDropItem } from './items.js';
import { sfx } from './audio.js';

// Siluet poligon tak beraturan untuk meteor: sudut dan radius acak per titik.
export function makeShape(n = 10, jitter = 0.28) {
  const s = [];
  for (let i = 0; i < n; i++) {
    s.push({ a: (i / n) * TAU + rnd(-0.12, 0.12), m: 1 - rnd(0, jitter) });
  }
  return s;
}

function base(type, x, y, r, hp, vx, vy) {
  return {
    type, x, y, r, hp, maxHp: hp, vx, vy,
    rot: rnd(0, TAU), vr: rnd(-1.2, 1.2),
    shape: makeShape(type === 'drone' ? 3 : rndi(9, 12)),
    flash: 0, t: 0, dead: false, size: 2,
  };
}

export function spawnCrystalMeteor(x, y, size = 2, vx = -rnd(110, 200), vy = rnd(-40, 40)) {
  const big = size === 2;
  const e = base('crystal', x, y, big ? 42 : 19, (big ? 5 : 1.4) * hpMul(), vx * (1 + 0.05 * (S.sector - 1)), vy);
  e.size = size;
  E.enemies.push(e);
  return e;
}

export function spawnMagmaMeteor(x, y, vx = -rnd(100, 160), vy = rnd(-30, 30)) {
  const e = base('magma', x, y, 38, 6 * hpMul(), vx, vy);
  E.enemies.push(e);
  return e;
}

export function spawnSwarm(x, count, pattern) {
  const baseY = rnd(130, H - 130), amp = rnd(50, 110), freq = rnd(1.5, 2.5);
  const mid = (count - 1) / 2, spd = 190 * (1 + 0.05 * S.sector);
  for (let i = 0; i < count; i++) {
    const e = base('drone', x, baseY, 15, 1.2 + 0.1 * (S.sector - 1), -spd, 0);
    e.pattern = pattern;
    e.y0 = baseY;
    e.amp = amp;
    e.freq = freq;
    e.ph = i * 0.55;
    e.shoot = rnd(1.5, 3.5);
    if (pattern === 'sine') {
      e.x = x + i * 50;
    } else if (pattern === 'vee') {
      e.x = x + Math.abs(i - mid) * 46;
      e.y = baseY + (i - mid) * 52;
      e.y0 = e.y;
    } else {
      e.x = x + i * 40;
      e.y = rnd(80, H - 80);
      e.y0 = e.y;
    }
    e.rot = Math.PI;
    E.enemies.push(e);
  }
}

export function spawnGate() {
  const gapH = Math.max(176, 270 - 14 * S.sector);
  const gapY = rnd(gapH / 2 + 70, H - gapH / 2 - 70);
  E.enemies.push({
    type: 'gate', x: W + 40, y: gapY, gapY, gy0: gapY, gapH,
    vx: -(150 + 8 * S.sector), r: 0, hp: Infinity, maxHp: Infinity,
    t: 0, warn: 1.1, dead: false, flash: 0, rot: 0, shape: [],
  });
}

export function updateSpawner(dt) {
  const d = diff(), sp = S.sp, t = S.sectorTime;
  sp.meteor -= dt;
  sp.magma -= dt;
  sp.swarm -= dt;
  sp.gate -= dt;
  if (sp.meteor <= 0) {
    sp.meteor = rnd(0.7, 1.4) / Math.pow(d, 0.8);
    spawnCrystalMeteor(W + 60, rnd(60, H - 60));
  }
  if (sp.magma <= 0 && t > 5) {
    sp.magma = rnd(5, 8) / d;
    spawnMagmaMeteor(W + 60, rnd(90, H - 90));
  }
  if (sp.swarm <= 0 && t > 3) {
    sp.swarm = rnd(7, 10) / Math.pow(d, 0.7);
    const pats = S.sector >= 3 ? ['sine', 'vee', 'chase'] : ['sine', 'vee'];
    spawnSwarm(W + 40, rndi(5, 6 + Math.min(3, S.sector)), pick(pats));
  }
  if (sp.gate <= 0 && t > (S.sector === 1 ? 17 : 9)) {
    sp.gate = rnd(15, 20) / Math.sqrt(d);
    if (!E.enemies.some((e) => e.type === 'gate' && e.x > W - 500)) spawnGate();
  }
}

export function updateEnemies(dt, P) {
  for (const e of E.enemies) {
    e.t += dt;
    e.flash -= dt;
    if (e.type === 'crystal' || e.type === 'magma') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.vr * dt;
      if ((e.y < e.r && e.vy < 0) || (e.y > H - e.r && e.vy > 0)) e.vy = -e.vy;
    } else if (e.type === 'drone') {
      e.x += e.vx * dt;
      if (e.pattern === 'sine') {
        e.y = e.y0 + Math.sin(e.t * e.freq + e.ph) * e.amp;
      } else if (e.pattern === 'chase') {
        e.y0 += clamp(P.y - e.y0, -1, 1) * 70 * dt;
        e.y = e.y0 + Math.sin(e.t * 3 + e.ph) * 24;
      }
      e.shoot -= dt;
      if (e.shoot <= 0 && S.sector >= 2 && e.x < W - 60 && e.x > P.x + 220) {
        e.shoot = rnd(2.2, 4) / Math.sqrt(diff());
        enemyBullet(e.x - 10, e.y, Math.atan2(P.y - e.y, P.x - e.x), 230 + 12 * S.sector);
      }
    } else if (e.type === 'gate') {
      e.x += e.vx * dt;
      if (S.sector >= 3) e.gapY = e.gy0 + Math.sin(e.t * 1.3) * 55;
    }
    if (e.x < (e.type === 'gate' ? -60 : -120)) e.dead = true;
  }
  compact(E.enemies);
}

export function damageEnemy(e, dmg, o = {}) {
  if (e.type === 'gate' || e.dead) return false;
  e.hp -= dmg;
  e.flash = 0.08;
  if (e.hp <= 0) {
    killEnemy(e, o);
    return true;
  }
  sfx.hit();
  return false;
}

export function killEnemy(e, o = {}) {
  if (e.dead) return;
  e.dead = true;
  S.stats.kills++;
  comboHit();
  if (e.type === 'crystal') {
    if (e.size === 2) {
      burst(e.x, e.y, 26, '#a855f7', 300, 0.7, 22);
      burst(e.x, e.y, 10, '#e9d5ff', 220, 0.4, 12);
      addScore(100);
      sfx.explode(1);
      shake(6);
      const n = rndi(2, 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(0, 1);
        spawnCrystalMeteor(e.x, e.y, 1, Math.cos(a) * 150 - 40, Math.sin(a) * 170);
      }
      spawnCrystals(e.x, e.y, rndi(3, 5));
    } else {
      burst(e.x, e.y, 12, '#c084fc', 220, 0.5, 16);
      addScore(30);
      sfx.explode(0.5);
      spawnCrystals(e.x, e.y, rndi(1, 2), 140);
    }
    maybeDropItem(e.x, e.y, 0.035);
  } else if (e.type === 'magma') {
    burst(e.x, e.y, 46, '#f97316', 420, 0.9, 26);
    burst(e.x, e.y, 22, '#fde68a', 300, 0.6, 16);
    ring(e.x, e.y, 150, '#f97316', 0.55, 6);
    ring(e.x, e.y, 100, '#fde68a', 0.4, 3);
    addScore(180);
    sfx.explode(2.2);
    shake(14);
    E.blasts.push({ x: e.x, y: e.y, r: 140, dmg: 6 });
    spawnCrystals(e.x, e.y, rndi(5, 7), 240);
    maybeDropItem(e.x, e.y, 0.12);
  } else if (e.type === 'drone') {
    burst(e.x, e.y, 14, '#ef4444', 260, 0.5, 14);
    addScore(60);
    sfx.explode(0.6);
    if (Math.random() < 0.7) spawnCrystals(e.x, e.y, 1, 120);
    maybeDropItem(e.x, e.y, 0.045);
  }
  S.nova = Math.min(S.novaMax, S.nova + 1.2);
  void o;
}
