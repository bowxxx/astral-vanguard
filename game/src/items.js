// items.js — kristal poin, power-up berkala, magnet kristal, dan efek pemulihan.
import { W, H, S, addScore } from './state.js';
import { E, burst, ring, floatText } from './entities.js';
import { rnd, TAU } from './util.js';
import { sfx } from './audio.js';

export const ITEM = {
  tri:       { name: 'TRI-SHOT',    color: '#06b6d4', dur: 14 },
  overdrive: { name: 'OVERDRIVE',   color: '#f59e0b', dur: 10 },
  shield:    { name: 'AEGIS ORB',   color: '#38bdf8', dur: 20 },
  magnet:    { name: 'MAGNET',      color: '#c084fc', dur: 14 },
  heart:     { name: 'REPAIR',      color: '#ef4444', dur: 0 },
  nova:      { name: 'NOVA CHARGE', color: '#fde047', dur: 0 },
};

export function spawnCrystals(x, y, n, spread = 180) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(40, spread);
    E.crystals.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 9, t: rnd(0, 6), dead: false });
  }
}

export function spawnItem(type, x, y) {
  E.items.push({ type, x, y, y0: y, vx: -70, r: 20, t: 0, dead: false });
}

// Acak berbobot: REPAIR lebih sering muncul saat HP tidak penuh.
function randomType() {
  const w = { tri: 22, overdrive: 20, shield: 16, magnet: 16, heart: S.hp < S.maxHp ? 24 : 4, nova: 20 };
  let tot = 0;
  for (const k in w) tot += w[k];
  let r = Math.random() * tot;
  for (const k in w) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return 'tri';
}

export function maybeDropItem(x, y, chance = 0.05) {
  if (Math.random() < chance) spawnItem(randomType(), x, y);
}

export function applyItem(type, x, y) {
  const it = ITEM[type];
  if (type === 'heart') {
    if (S.hp < S.maxHp) {
      S.hp++;
      floatText(x, y - 20, '+1 HP', it.color, 26);
      sfx.heart();
    } else {
      addScore(500);
      S.nova = Math.min(S.novaMax, S.nova + 20);
      floatText(x, y - 20, 'HULL FULL +500', it.color, 22);
      sfx.power();
    }
  } else if (type === 'nova') {
    S.nova = Math.min(S.novaMax, S.nova + 40);
    floatText(x, y - 20, '+40 NOVA', it.color, 24);
    sfx.power();
  } else {
    S.buffs[type] = it.dur;
    if (type === 'shield') S.shieldCharges = 2;
    floatText(x, y - 20, it.name, it.color, 24);
    sfx.power();
  }
  burst(x, y, 26, it.color, 300, 0.7, 20);
  ring(x, y, 90, it.color, 0.5, 4);
}

export function tickBuffs(dt) {
  for (const k in S.buffs) {
    if (S.buffs[k] > 0) S.buffs[k] = Math.max(0, S.buffs[k] - dt);
  }
  if (S.buffs.shield <= 0) S.shieldCharges = 0;
}

export function updateItems(dt, P) {
  // Power-up berkala yang melayang dari kanan.
  S.sp.item -= dt;
  if (S.sp.item <= 0) {
    S.sp.item = rnd(13, 19);
    spawnItem(randomType(), W + 30, rnd(90, H - 90));
  }

  const magnetR = S.buffs.magnet > 0 ? 440 : 80;
  for (const c of E.crystals) {
    c.t += dt;
    const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy) || 1;
    if (d < magnetR) {
      const pull = (S.buffs.magnet > 0 ? 2600 : 900) * (1 - d / magnetR) + 300;
      c.vx += (dx / d) * pull * dt;
      c.vy += (dy / d) * pull * dt;
      const sp = Math.hypot(c.vx, c.vy), mx = 900;
      if (sp > mx) { c.vx *= mx / sp; c.vy *= mx / sp; }
    } else {
      c.vx += (-70 - c.vx) * Math.min(1, 1.5 * dt);
      c.vy *= Math.exp(-1.5 * dt);
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (d < P.r + c.r + 4) {
      c.dead = true;
      S.crystals++;
      S.stats.crystalsTotal++;
      S.nova = Math.min(S.novaMax, S.nova + 2.2);
      addScore(25, false);
      sfx.crystal();
      burst(c.x, c.y, 3, '#fde68a', 120, 0.3, 10);
    }
    if (c.x < -30) c.dead = true;
  }

  for (const it of E.items) {
    it.t += dt;
    it.x += it.vx * dt;
    it.y = it.y0 + Math.sin(it.t * 2.2) * 18;
    if (S.buffs.magnet > 0) {
      const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy) || 1;
      if (d < 260) {
        it.x += (dx / d) * 320 * dt;
        it.y0 += (dy / d) * 320 * dt;
      }
    }
    if (Math.hypot(P.x - it.x, P.y - it.y) < P.r + it.r + 6) {
      it.dead = true;
      applyItem(it.type, it.x, it.y);
    }
    if (it.x < -40) it.dead = true;
  }
}
