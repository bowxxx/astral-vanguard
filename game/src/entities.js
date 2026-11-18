// entities.js — wadah entitas bersama dan pabrik peluru, partikel, cincin, teks melayang.
import { W, H, S } from './state.js';
import { rnd, TAU } from './util.js';

export const E = {
  pb: [], eb: [], parts: [], rings: [], texts: [],
  enemies: [], items: [], crystals: [], blasts: [],
};
const MAX_PARTS = 1100;

export function resetEntities() {
  for (const k in E) E[k].length = 0;
}

export function shake(a) {
  if (a > S.shake) S.shake = a;
}

export function playerBullet(o) {
  E.pb.push({
    x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, pierce: 0, hits: null,
    kind: 'shot', crit: false, life: 2.2, dead: false, homing: 0, len: 16, ...o,
  });
}

export function enemyBullet(x, y, angle, speed, o = {}) {
  if (E.eb.length > 900) return;
  E.eb.push({
    x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: 6, kind: 'orb', life: 10, dead: false, grazed: false, ...o,
  });
}

export function burst(x, y, n, color, spd = 220, life = 0.6, size = 18) {
  for (let i = 0; i < n && E.parts.length < MAX_PARTS; i++) {
    const a = rnd(0, TAU), s = rnd(spd * 0.2, spd), l = rnd(life * 0.5, life);
    E.parts.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: l, max: l, size: rnd(size * 0.5, size), color, drag: 2.2,
    });
  }
}

export function trail(x, y, color, size = 12, life = 0.3, vx = -60) {
  if (E.parts.length >= MAX_PARTS) return;
  E.parts.push({
    x, y, vx: vx + rnd(-20, 20), vy: rnd(-20, 20),
    life, max: life, size, color, drag: 3,
  });
}

export function ring(x, y, maxR, color, life = 0.5, width = 4) {
  E.rings.push({ x, y, maxR, color, life, t: 0, width });
}

export function floatText(x, y, text, color = '#fff', size = 22) {
  E.texts.push({ x, y, text, color, size, life: 1.0, max: 1.0 });
}

// Buang entitas bertanda dead dari sebuah array, tanpa alokasi baru.
export function compact(arr) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].dead) arr[j++] = arr[i];
  }
  arr.length = j;
}

export function updateEnemyBullets(dt) {
  for (const b of E.eb) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.dead = true;
  }
  compact(E.eb);
}

// Hapus peluru musuh (opsional hanya dalam radius) — berubah jadi percikan.
export function clearEnemyBullets(x = 0, y = 0, r = Infinity) {
  let shown = 0;
  for (const b of E.eb) {
    const dx = b.x - x, dy = b.y - y;
    if (r === Infinity || dx * dx + dy * dy < r * r) {
      b.dead = true;
      if (shown++ < 60) burst(b.x, b.y, 2, '#fca5a5', 120, 0.35, 10);
    }
  }
  compact(E.eb);
}

export function updateFx(dt) {
  for (const p of E.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const d = Math.exp(-p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.life -= dt;
  }
  let j = 0;
  for (let i = 0; i < E.parts.length; i++) {
    if (E.parts[i].life > 0) E.parts[j++] = E.parts[i];
  }
  E.parts.length = j;
  for (const r of E.rings) r.t += dt;
  E.rings = E.rings.filter((r) => r.t < r.life);
  for (const t of E.texts) {
    t.y -= 34 * dt;
    t.life -= dt;
  }
  E.texts = E.texts.filter((t) => t.life > 0);
}
