// combat.js — seluruh resolusi tabrakan: peluru, musuh, boss, gerbang laser, ledakan area, graze.
import { W, H, S, addScore } from './state.js';
import { E, burst, ring, floatText, shake, compact } from './entities.js';
import { SpatialGrid, circlesHit, pointSegDist2 } from './util.js';
import { P, hurtPlayer } from './player.js';
import { B, bossHit, damageBoss, beamAngle } from './boss.js';
import { damageEnemy, killEnemy } from './enemies.js';
import { sfx } from './audio.js';

const grid = new SpatialGrid(W, H, 96);
const near = [];

// Ledakan kecil saat peluru kritis mengenai sasaran.
function critBlast(x, y, dmg) {
  ring(x, y, 70, '#fde047', 0.35, 4);
  burst(x, y, 10, '#fde047', 260, 0.4, 14);
  for (const e of E.enemies) {
    if (e.type !== 'gate' && !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < (70 + e.r) ** 2) {
      damageEnemy(e, dmg * 0.5);
    }
  }
}

// Ledakan area (meteor magma): merusak musuh, boss, dan pemain dalam radius.
function processBlasts() {
  for (const b of E.blasts) {
    for (const e of E.enemies) {
      if (!e.dead && e.type !== 'gate' && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (b.r + e.r) ** 2) {
        damageEnemy(e, b.dmg);
      }
    }
    if (B.alive && bossHit(b.x, b.y, b.r * 0.6)) damageBoss(b.dmg * 1.5);
    if (circlesHit(P.x, P.y, P.hit, b.x, b.y, b.r)) hurtPlayer();
  }
  E.blasts.length = 0;
}

export function updateCombat(dt) {
  void dt;
  // --- peluru pemain vs musuh / boss ---
  grid.clear();
  for (const e of E.enemies) if (e.type !== 'gate') grid.insert(e);
  for (const b of E.pb) {
    if (b.dead) continue;
    grid.query(b.x, b.y, b.r, near);
    for (const e of near) {
      if (e.dead || !circlesHit(b.x, b.y, b.r, e.x, e.y, e.r)) continue;
      if (b.pierce > 0) {
        if (!b.hits) b.hits = [];
        if (b.hits.includes(e)) continue;
        b.hits.push(e);
      }
      damageEnemy(e, b.dmg);
      burst(b.x, b.y, b.crit ? 8 : 3, b.crit ? '#fde047' : '#67e8f9', 200, 0.25, 9);
      if (b.crit) {
        critBlast(e.x, e.y, b.dmg);
        floatText(e.x, e.y - 20, 'CRIT', '#fde047', 20);
      }
      if (b.kind === 'missile') {
        ring(b.x, b.y, 55, '#f59e0b', 0.3, 3);
        burst(b.x, b.y, 12, '#f59e0b', 280, 0.4, 14);
        sfx.explode(0.4);
      }
      if (b.pierce > 0) b.pierce--;
      else { b.dead = true; break; }
    }
    if (!b.dead && B.alive && bossHit(b.x, b.y, b.r)) {
      if (damageBoss(b.dmg, { x: b.x, y: b.y })) {
        burst(b.x, b.y, b.crit ? 10 : 4, b.crit ? '#fde047' : '#67e8f9', 220, 0.3, 10);
        if (b.crit) floatText(b.x, b.y - 24, 'CRIT', '#fde047', 20);
        if (b.kind === 'missile') {
          ring(b.x, b.y, 60, '#f59e0b', 0.3, 3);
          sfx.explode(0.5);
        }
      }
      b.dead = true;
    }
  }
  compact(E.pb);

  // --- peluru musuh vs pemain (+ graze: nyaris kena = nova & skor) ---
  for (const b of E.eb) {
    const dx = b.x - P.x, dy = b.y - P.y, d2 = dx * dx + dy * dy;
    const hr = P.hit + b.r * 0.7;
    if (d2 < hr * hr) {
      hurtPlayer();
    } else if (!b.grazed && d2 < (hr + 16) ** 2 && P.invul <= 0) {
      b.grazed = true;
      S.stats.grazes++;
      S.nova = Math.min(S.novaMax, S.nova + 0.5);
      addScore(5, false);
      sfx.graze();
      burst(P.x, P.y, 2, '#67e8f9', 120, 0.25, 8);
    }
  }
  compact(E.eb);

  // --- musuh vs pemain ---
  for (const e of E.enemies) {
    if (e.dead) continue;
    if (e.type === 'gate') {
      const nearX = Math.abs(P.x - e.x) < 11 + P.hit;
      const top = e.gapY - e.gapH / 2, bot = e.gapY + e.gapH / 2;
      if (e.t > e.warn && nearX && (P.y - P.hit < top || P.y + P.hit > bot)) hurtPlayer();
      continue;
    }
    if (circlesHit(P.x, P.y, P.hit + 2, e.x, e.y, e.r * 0.85)) {
      if (P.dashT > 0) {
        damageEnemy(e, 4);
        burst(e.x, e.y, 6, '#67e8f9', 260, 0.3, 12);
      } else if (P.novaT > 0) {
        damageEnemy(e, 10);
      } else {
        hurtPlayer();
        killEnemy(e);
      }
    }
  }

  // --- boss vs pemain, dan laser boss ---
  if (B.alive && !B.dying) {
    if (bossHit(P.x, P.y, P.hit)) hurtPlayer();
    if (B.beam && B.beam.t > B.beam.warn) {
      const a = beamAngle();
      const d2 = pointSegDist2(P.x, P.y, B.x, B.y, B.x + Math.cos(a) * 1700, B.y + Math.sin(a) * 1700);
      if (d2 < (14 + P.hit) ** 2) hurtPlayer();
    }
  }

  processBlasts();
}
