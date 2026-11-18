// boss.js — Boss Kosmik raksasa: melayang, 3 fase serangan, tameng pergantian fase, animasi kematian.
import { W, H, S } from './state.js';
import { E, enemyBullet, burst, ring, floatText, shake, clearEnemyBullets } from './entities.js';
import { rnd, rndi, TAU, lerp, easeOut, clamp } from './util.js';
import { spawnSwarm, spawnMagmaMeteor } from './enemies.js';
import { sfx } from './audio.js';

export const BOSS_KINDS = [
  { name: 'KRYSTAL LEVIATHAN', color: '#a855f7', plates: 6 },
  { name: 'MAGMA HIVE-MOTHER', color: '#f97316', plates: 8 },
  { name: 'VOID SENTINEL PRIME', color: '#ec4899', plates: 5 },
];

export const B = {
  alive: false, dying: false, x: W + 260, y: H / 2, r: 104,
  hp: 1, maxHp: 1, phase: 0, t: 0, kind: 0, flash: 0,
  intro: 0, introT: 0, shieldT: 0, dyingT: 0,
  spin: 0, spinDir: 1, a1: 0, a2: 0, a3: 0, a4: 0, beam: null,
};

export function spawnBoss() {
  const s = S.sector;
  Object.assign(B, {
    alive: true, dying: false, kind: (s - 1) % 3,
    maxHp: 170 + 95 * (s - 1) + 12 * (s - 1) ** 2,
    phase: 0, t: 0, flash: 0, intro: 2.8, introT: 2.8, shieldT: 0, dyingT: 0,
    x: W + 260, y: H / 2, spin: 0, spinDir: 1,
    a1: 1.5, a2: 3, a3: 5, a4: 7, beam: null,
  });
  B.hp = B.maxHp;
  shake(10);
}

export const bossName = () => BOSS_KINDS[B.kind].name;
export const bossHpPct = () => (B.alive ? Math.max(0, B.hp / B.maxHp) : 0);

// Boss = badan utama + dua pod sayap yang juga bisa ditembak.
export function bossHit(x, y, r) {
  if (!B.alive) return false;
  const c = (cx, cy, cr) => (x - cx) ** 2 + (y - cy) ** 2 <= (cr + r) ** 2;
  return c(B.x, B.y, B.r) || c(B.x - 20, B.y - 80, 52) || c(B.x - 20, B.y + 80, 52);
}

export function damageBoss(d, o = {}) {
  if (!B.alive || B.dying) return false;
  if (B.intro > 0 || B.shieldT > 0) {
    burst(o.x ?? B.x - 90, o.y ?? B.y, 3, '#38bdf8', 160, 0.25, 10);
    return false;
  }
  B.hp -= d;
  B.flash = 0.06;
  sfx.hit();
  if (B.hp <= 0) {
    B.hp = 0;
    B.dying = true;
    B.dyingT = 0;
    S.slow = 1.2;
    S.stats.bosses++;
    clearEnemyBullets();
    B.beam = null;
    sfx.bossDie();
    shake(30);
  }
  return true;
}

function enterPhase(n) {
  B.phase = n;
  B.shieldT = 1.5;
  B.beam = null;
  clearEnemyBullets();
  ring(B.x, B.y, 420, BOSS_KINDS[B.kind].color, 0.9, 8);
  ring(B.x, B.y, 260, '#fff', 0.6, 3);
  burst(B.x, B.y, 60, BOSS_KINDS[B.kind].color, 500, 0.9, 24);
  floatText(B.x - 60, B.y - 150, n === 1 ? 'PHASE II' : 'PHASE III', '#ef4444', 40);
  sfx.phase();
  shake(22);
  B.a1 = 1.6;
  B.a2 = 2.6;
  B.a3 = 4;
  B.a4 = 6;
}

const speedMul = () => Math.min(1.6, 1 + 0.06 * (S.sector - 1));
const extra = () => Math.floor((S.sector - 1) / 2);

// Kipas peluru mengarah ke pemain.
function fan(P, n, spread, speed) {
  const base = Math.atan2(P.y - B.y, P.x - B.x);
  for (let i = 0; i < n; i++) {
    enemyBullet(B.x - 70, B.y, base + (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)), speed * speedMul());
  }
}

// Cincin peluru ke segala arah.
function ringShot(n, speed, off = rnd(0, TAU)) {
  for (let i = 0; i < n; i++) {
    enemyBullet(B.x - 40, B.y, off + (i / n) * TAU, speed * speedMul());
  }
}

// Tirai peluru vertikal dengan satu celah.
function curtain(speed = 215) {
  const n = 15, step = H / n, gap = rnd(130, H - 130);
  for (let i = 0; i < n; i++) {
    const y = i * step + step / 2;
    if (Math.abs(y - gap) > 78) enemyBullet(B.x - 90, y, Math.PI, speed * speedMul(), { r: 7 });
  }
}

function startBeam(P) {
  const a0 = Math.atan2(P.y - B.y, P.x - B.x), dir = P.y > B.y ? 1 : -1;
  B.beam = { t: 0, warn: 1.1, dur: 1.5, a0: a0 - dir * 0.45, a1: a0 + dir * 0.9 };
  sfx.warning();
}

export function beamAngle() {
  const b = B.beam;
  if (!b) return 0;
  return lerp(b.a0, b.a1, easeOut(clamp((b.t - b.warn) / b.dur, 0, 1)));
}

// Mengembalikan true tepat saat boss selesai runtuh.
export function updateBoss(dt, P) {
  if (!B.alive) return false;
  B.t += dt;
  B.flash -= dt;
  B.shieldT -= dt;
  const k = B.kind;

  if (B.dying) {
    B.dyingT += dt;
    if (Math.random() < dt * 16) {
      const x = B.x + rnd(-100, 100), y = B.y + rnd(-110, 110);
      burst(x, y, 18, Math.random() < 0.5 ? '#f59e0b' : BOSS_KINDS[k].color, 380, 0.7, 22);
      ring(x, y, rnd(40, 90), '#fde68a', 0.4, 3);
      shake(8);
    }
    B.x += Math.sin(B.t * 40) * 1.5;
    if (B.dyingT > 2.2) {
      burst(B.x, B.y, 140, '#fde68a', 800, 1.4, 30);
      burst(B.x, B.y, 90, BOSS_KINDS[k].color, 600, 1.2, 26);
      ring(B.x, B.y, 700, '#fff', 1.1, 10);
      ring(B.x, B.y, 480, '#f59e0b', 0.9, 6);
      B.alive = false;
      S.novaFlash = 1;
      shake(40);
      return true;
    }
    return false;
  }

  if (B.intro > 0) {
    B.intro -= dt;
    B.x = lerp(W + 260, W - 250, easeOut(1 - B.intro / B.introT));
    return false;
  }

  B.y = H / 2 + Math.sin(B.t * 0.65) * (H * 0.27);
  B.x = W - 250 + Math.sin(B.t * 0.4) * 30 + (B.phase === 2 ? Math.sin(B.t * 1.1) * 55 : 0);

  const ratio = B.hp / B.maxHp;
  if (B.phase === 0 && ratio <= 0.66) enterPhase(1);
  else if (B.phase === 1 && ratio <= 0.33) enterPhase(2);
  if (B.shieldT > 0) return false;

  if (B.beam) {
    B.beam.t += dt;
    if (B.beam.t > B.beam.warn + B.beam.dur) B.beam = null;
  }

  B.a1 -= dt;
  B.a2 -= dt;
  B.a3 -= dt;
  B.a4 -= dt;
  if (B.phase === 0) {
    if (B.a1 <= 0) {
      B.a1 = 1.8 / (1 + 0.05 * S.sector);
      B.flip = !B.flip;
      if (B.flip) fan(P, 5 + extra() * 2, 0.9, 260);
      else ringShot(16 + extra() * 2, 190);
    }
    if (k === 1 && B.a2 <= 0) { B.a2 = 3.2; fan(P, 3, 0.25, 360); }
    if (k === 2 && B.a3 <= 0) { B.a3 = 4.6; curtain(); }
  } else if (B.phase === 1) {
    B.spin += dt;
    if (B.a1 <= 0) {
      B.a1 = 0.085;
      const arms = k === 0 ? 3 : 2;
      for (let i = 0; i < arms; i++) {
        enemyBullet(B.x - 50, B.y, B.spin * 3.2 * B.spinDir + (i / arms) * TAU, 205 * speedMul());
      }
    }
    if (B.a2 <= 0) { B.a2 = 2.4; fan(P, 7 + extra() * 2, 1.1, 275); }
    if (k === 1 && B.a3 <= 0) { B.a3 = 6; spawnMagmaMeteor(B.x - 80, B.y, -240, rnd(-30, 30)); }
    if (k === 2 && B.a3 <= 0) { B.a3 = 4; curtain(); }
    if (k === 2 && B.a4 <= 0 && !B.beam) { B.a4 = 9; startBeam(P); }
  } else {
    B.spin += dt;
    B.spinDir = Math.floor(B.t / 3) % 2 === 0 ? 1 : -1;
    if (B.a1 <= 0) {
      B.a1 = 0.062;
      for (let i = 0; i < 3; i++) {
        enemyBullet(B.x - 50, B.y, B.spin * 3.6 * B.spinDir + (i / 3) * TAU, 215 * speedMul());
      }
    }
    if (B.a2 <= 0) { B.a2 = 2.7; ringShot(22 + extra() * 2, 200); }
    if (B.a3 <= 0) {
      B.a3 = 5;
      curtain(230);
      if (k === 1) spawnMagmaMeteor(B.x - 80, B.y, -250, 0);
    }
    if (B.a4 <= 0 && !B.beam) {
      startBeam(P);
      B.a4 = 8;
      B.summon = 1;
    }
    if (B.summon && B.beam && B.beam.t > 1.2) {
      B.summon = 0;
      spawnSwarm(B.x - 60, 4, 'vee');
    }
  }
  return false;
}
