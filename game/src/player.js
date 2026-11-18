// player.js — pesawat Star-Weaver: gerak (keyboard/mouse), dash, tembakan, rudal, drone, Nova.
import { W, H, S, MODE } from './state.js';
import { E, playerBullet, burst, ring, trail, floatText, shake, clearEnemyBullets, compact } from './entities.js';
import { clamp, lerp, rnd, TAU } from './util.js';
import { B, damageBoss } from './boss.js';
import { damageEnemy } from './enemies.js';
import { sfx } from './audio.js';

export const DASH_CD = 1.5;
export const NOVA_TIME = 1.15;
const XMIN = 36, XMAX = 560, YMIN = 30, YMAX = H - 30;
const WING_OFFS = [[-8, -54], [-8, 54], [-50, 0]];

export const P = {
  x: 150, y: H / 2, vx: 0, vy: 0, r: 20, hit: 8, speed: 440,
  dashT: 0, dashCd: 0, invul: 0, fireCd: 0, missCd: 1,
  tilt: 0, novaT: 0, novaTick: 0, wing: [], wingCd: 0, afterimg: [], thrust: 0,
};

export function resetPlayer() {
  Object.assign(P, {
    x: 150, y: H / 2, vx: 0, vy: 0, dashT: 0, dashCd: 0, invul: 1.5,
    fireCd: 0, missCd: 1, tilt: 0, novaT: 0, novaTick: 0,
    wing: [], wingCd: 0, afterimg: [], thrust: 0,
  });
}

export function hurtPlayer() {
  if (P.invul > 0 || P.dashT > 0 || P.novaT > 0 || S.hp <= 0) return false;
  if (S.shieldCharges > 0) {
    S.shieldCharges--;
    P.invul = 0.7;
    if (S.shieldCharges <= 0) S.buffs.shield = 0;
    ring(P.x, P.y, 120, '#38bdf8', 0.5, 6);
    burst(P.x, P.y, 24, '#38bdf8', 320, 0.5, 14);
    clearEnemyBullets(P.x, P.y, 150);
    sfx.shieldBreak();
    shake(8);
    return false;
  }
  S.hp--;
  P.invul = 1.8;
  S.combo = 0;
  S.flash = 1;
  S.hitstop = 0.07;
  burst(P.x, P.y, 34, '#ef4444', 380, 0.8, 20);
  burst(P.x, P.y, 14, '#fde68a', 260, 0.5, 12);
  ring(P.x, P.y, 160, '#ef4444', 0.6, 6);
  clearEnemyBullets(P.x, P.y, 170);
  sfx.hurt();
  shake(20);
  return true;
}

export function tryNova() {
  if (S.mode !== MODE.PLAY || S.nova < S.novaMax || P.novaT > 0) return false;
  S.nova = 0;
  P.novaT = NOVA_TIME;
  P.novaTick = 0;
  P.invul = Math.max(P.invul, NOVA_TIME + 0.2);
  S.novaFlash = 0.8;
  S.starBoost = 5;
  ring(P.x, P.y, 1100, '#06b6d4', 0.9, 10);
  ring(P.x, P.y, 700, '#fff', 0.7, 4);
  ring(P.x, P.y, 420, '#f59e0b', 0.6, 5);
  burst(P.x + 30, P.y, 50, '#67e8f9', 700, 0.8, 24);
  clearEnemyBullets();
  for (const e of E.enemies) if (e.type !== 'gate') damageEnemy(e, 5);
  if (B.alive) damageBoss(8, { x: B.x - 90, y: B.y });
  sfx.nova();
  shake(30);
  return true;
}

// Selama Nova aktif: sinar merusak semua yang ada di jalurnya.
function updateNova(dt) {
  if (P.novaT <= 0) return;
  P.novaT -= dt;
  P.novaTick -= dt;
  const half = 78;
  for (const b of E.eb) {
    if (b.x > P.x && Math.abs(b.y - P.y) < half + 20) {
      b.dead = true;
      burst(b.x, b.y, 2, '#67e8f9', 140, 0.3, 10);
    }
  }
  compact(E.eb);
  if (P.novaTick <= 0) {
    P.novaTick = 0.09;
    for (const e of E.enemies) {
      if (e.type === 'gate' || e.x < P.x) continue;
      if (Math.abs(e.y - P.y) < half + e.r) {
        damageEnemy(e, 5, { nova: true });
        burst(e.x, e.y, 4, '#67e8f9', 260, 0.35, 12);
      }
    }
    if (B.alive && B.x - 60 > P.x && Math.abs(B.y - P.y) < half + B.r) {
      damageBoss(4.2, { x: B.x - 100, y: B.y });
    }
  }
}

function shoot() {
  const u = S.upgrades, pierce = u.pierce;
  const angles = S.buffs.tri > 0 ? [-0.17, 0, 0.17] : [0];
  const dmg = 1 + 0.18 * pierce;
  for (const a of angles) {
    const crit = Math.random() < u.crit * 0.09;
    playerBullet({
      x: P.x + 28, y: P.y + a * 40,
      vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000,
      r: pierce ? 6 : 5, dmg: dmg * (crit ? 2.5 : 1), pierce, crit,
      kind: pierce ? 'laser' : 'shot', len: pierce ? 48 : 18,
    });
  }
  sfx.laser();
}

function launchMissiles() {
  const l = S.upgrades.homing, n = l >= 3 ? 3 : 2;
  const ang = n === 3 ? [-1.0, 0, 1.0] : [-0.9, 0.9];
  for (const a of ang) {
    playerBullet({
      x: P.x + 4, y: P.y,
      vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
      r: 7, dmg: 2.4 + 0.4 * l, kind: 'missile', homing: 1, life: 3.2, len: 18,
    });
  }
  sfx.missile();
}

export function updatePlayer(dt, inp) {
  // --- gerak ---
  let ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let ay = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const keys = ax || ay;
  if (P.dashT > 0) P.dashT -= dt;
  P.dashCd -= dt;
  P.invul -= dt;
  if (P.dashT <= 0) {
    if (keys) {
      const l = Math.hypot(ax, ay);
      ax /= l;
      ay /= l;
      inp.mouseMode = false;
      const k = 1 - Math.exp(-14 * dt);
      P.vx = lerp(P.vx, ax * P.speed, k);
      P.vy = lerp(P.vy, ay * P.speed, k);
    } else if (inp.mouseMode) {
      const tx = clamp(inp.mx, XMIN, XMAX), ty = clamp(inp.my, YMIN, YMAX);
      const tvx = clamp((tx - P.x) * 10, -760, 760), tvy = clamp((ty - P.y) * 10, -760, 760);
      const k = 1 - Math.exp(-18 * dt);
      P.vx = lerp(P.vx, tvx, k);
      P.vy = lerp(P.vy, tvy, k);
    } else {
      const k = Math.exp(-10 * dt);
      P.vx *= k;
      P.vy *= k;
    }
  }
  // --- dash ---
  if (inp.dashPressed) {
    inp.dashPressed = false;
    if (P.dashCd <= 0 && P.dashT <= 0) {
      let dx = 1, dy = 0;
      if (keys) {
        dx = ax;
        dy = ay;
      } else if (inp.mouseMode && Math.hypot(inp.mx - P.x, inp.my - P.y) > 40) {
        const l = Math.hypot(inp.mx - P.x, inp.my - P.y);
        dx = (inp.mx - P.x) / l;
        dy = (inp.my - P.y) / l;
      }
      P.dashT = 0.17;
      P.dashCd = DASH_CD;
      P.invul = Math.max(P.invul, 0.5);
      P.vx = dx * 1350;
      P.vy = dy * 1350;
      sfx.dash();
      S.starBoost = 3.5;
      ring(P.x, P.y, 70, '#67e8f9', 0.3, 3);
    }
  }
  P.x = clamp(P.x + P.vx * dt, XMIN, XMAX);
  P.y = clamp(P.y + P.vy * dt, YMIN, YMAX);
  P.tilt = lerp(P.tilt, clamp(P.vy / 520, -1, 1), 1 - Math.exp(-10 * dt));
  P.thrust = lerp(P.thrust, clamp((P.vx + 200) / 500, 0, 1.6), 0.15);
  if (P.dashT > 0) {
    P.afterimg.push({ x: P.x, y: P.y, tilt: P.tilt, life: 0.28 });
    trail(P.x - 20, P.y, '#06b6d4', 20, 0.35, -120);
  }
  for (const a of P.afterimg) a.life -= dt;
  P.afterimg = P.afterimg.filter((a) => a.life > 0);
  trail(P.x - 24, P.y + rnd(-3, 3), Math.random() < 0.5 ? '#06b6d4' : '#f59e0b', rnd(7, 12), 0.25, -160);

  // --- tembak ---
  const rate = 0.15 / (S.buffs.overdrive > 0 ? 1.85 : 1);
  P.fireCd -= dt;
  if ((inp.fire || S.autoFire) && P.fireCd <= 0) {
    shoot();
    P.fireCd = rate;
  }
  if (S.upgrades.homing > 0) {
    P.missCd -= dt;
    if (P.missCd <= 0) {
      launchMissiles();
      P.missCd = 1.5 - 0.15 * S.upgrades.homing;
    }
  }

  // --- drone pendamping ---
  const wn = S.upgrades.wingman;
  while (P.wing.length < wn) P.wing.push({ x: P.x - 40, y: P.y, t: rnd(0, 6) });
  P.wing.length = wn;
  P.wingCd -= dt;
  P.wing.forEach((w, i) => {
    const o = WING_OFFS[i];
    w.t += dt;
    w.x = lerp(w.x, P.x + o[0], 1 - Math.exp(-9 * dt));
    w.y = lerp(w.y, P.y + o[1] + Math.sin(w.t * 3 + i) * 5, 1 - Math.exp(-9 * dt));
  });
  if (wn > 0 && P.wingCd <= 0) {
    P.wingCd = 0.38;
    for (const w of P.wing) {
      playerBullet({ x: w.x + 12, y: w.y, vx: 900, vy: 0, r: 4, dmg: 0.75, kind: 'shot', len: 12, life: 1.6 });
    }
  }
  updateNova(dt);
}

export function updatePlayerBullets(dt) {
  for (const b of E.pb) {
    if (b.homing) {
      let best = null, bd = 760 * 760;
      for (const e of E.enemies) {
        if (e.type === 'gate' || e.x < P.x) continue;
        const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (B.alive && !B.dying && (B.x - b.x) ** 2 + (B.y - b.y) ** 2 < bd) best = B;
      let ang = Math.atan2(b.vy, b.vx);
      if (best) {
        const want = Math.atan2(best.y - b.y, best.x - b.x);
        let d = want - ang;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        ang += clamp(d, -6.5 * dt, 6.5 * dt);
      }
      const sp = Math.min(760, Math.hypot(b.vx, b.vy) + 520 * dt);
      b.vx = Math.cos(ang) * sp;
      b.vy = Math.sin(ang) * sp;
      trail(b.x - b.vx * 0.02, b.y - b.vy * 0.02, Math.random() < 0.5 ? '#f59e0b' : '#fca5a5', 11, 0.3, 0);
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x > W + 80 || b.x < -80 || b.y < -80 || b.y > H + 80) b.dead = true;
  }
  compact(E.pb);
}
