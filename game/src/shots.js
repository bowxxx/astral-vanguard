// shots.js — pementasan tangkap-layar: RNG berbiji + autopilot yang memainkan aturan asli permainan.
// Dipakai lewat ?shot=title|play|boss|upgrade|over&seed=N. Tanpa parameter itu, modul ini diam.
import { S, MODE, H } from './state.js';
import { E } from './entities.js';
import { P } from './player.js';
import { B, damageBoss } from './boss.js';

// PRNG mulberry32: aliran acak deterministis dari satu biji.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(location.search);
export const staging = params.has('shot')
  ? { scene: params.get('shot') || 'play', seed: parseInt(params.get('seed') || '1', 10) || 1 }
  : null;

if (staging) {
  // Dipasang sebelum modul lain sempat mengacak apa pun (modul ini diimpor pertama).
  Math.random = mulberry32(staging.seed >>> 0);
}

// Autopilot: pilih lajur vertikal teraman, tembak terus, dash darurat, nova saat penuh.
function autopilot(api) {
  const inp = api.input;
  let bestY = P.y, bestScore = -Infinity;
  for (let y = 100; y <= H - 100; y += 40) {
    let score = 0, nearest = Infinity;
    for (const b of E.eb) {
      if (b.x < P.x - 60) continue;
      const d = Math.hypot(b.x - P.x, b.y - y);
      if (d < nearest) nearest = d;
    }
    for (const e of E.enemies) {
      if (e.type === 'gate') {
        if (Math.abs(e.x - P.x) < 260) {
          const top = e.gapY - e.gapH / 2, bot = e.gapY + e.gapH / 2;
          if (y < top + 30 || y > bot - 30) score -= 400;
        }
        continue;
      }
      if (e.x < P.x - 80) continue;
      const d = Math.hypot(e.x - P.x, e.y - y) - e.r;
      if (d < nearest) nearest = d;
    }
    score += Math.min(nearest, 400);
    score -= Math.min(220, Math.abs(y - H / 2) * 1.2) + Math.abs(y - P.y) * 0.15;
    if (score > bestScore) { bestScore = score; bestY = y; }
  }
  inp.mouseMode = false;
  inp.up = bestY < P.y - 14;
  inp.down = bestY > P.y + 14;
  inp.left = P.x > 300;
  inp.right = P.x < 170;
  inp.fire = true;
  if (P.dashCd <= 0) {
    for (const b of E.eb) {
      const dx = b.x - P.x, dy = b.y - P.y;
      if (dx > 0 && dx < 90 && Math.abs(dy) < 40 && b.vx < 0) {
        inp.dashPressed = true;
        break;
      }
    }
  }
  if (S.nova >= S.novaMax && (B.alive || E.enemies.some((e) => e.type !== 'gate' && e.x > P.x))) {
    api.tryNova();
  }
}

const DT = 1 / 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Majukan simulasi n langkah tetap, digerakkan autopilot, dalam potongan agar browser tetap responsif.
async function runSteps(api, n) {
  const CHUNK = 90;
  let done = 0;
  while (done < n) {
    const m = Math.min(CHUNK, n - done);
    for (let i = 0; i < m; i++) {
      autopilot(api);
      api.step(DT);
      if (S.mode !== MODE.PLAY) return done + i + 1;
    }
    done += m;
    await sleep(0);
  }
  return done;
}

export async function startStaging(cfg, api) {
  const scene = cfg.scene;
  try {
    if (scene === 'title') {
      await sleep(900);
    } else if (scene === 'play') {
      api.startGame();
      S.stagingHold = true;
      await runSteps(api, 60 * 14);
      S.stagingHold = false;
      await sleep(120);
    } else if (scene === 'boss') {
      api.startGame();
      S.stagingHold = true;
      await runSteps(api, 60 * 8);
      api.forceBoss();
      let guard = 0;
      while (S.bossPhase !== 'fight' && guard++ < 60 * 8 && S.mode === MODE.PLAY) {
        autopilot(api);
        api.step(DT);
      }
      await runSteps(api, 60 * 6);
      S.stagingHold = false;
      await sleep(120);
    } else if (scene === 'upgrade') {
      api.startGame();
      S.stagingHold = true;
      await runSteps(api, 60 * 6);
      api.forceBoss();
      let guard = 0;
      while (!B.alive && guard++ < 60 * 8 && S.mode === MODE.PLAY) {
        autopilot(api);
        api.step(DT);
      }
      if (B.alive) {
        B.intro = 0;
        B.shieldT = 0;
        damageBoss(1e9);
      }
      guard = 0;
      while (S.mode !== MODE.UPGRADE && guard++ < 60 * 8 && S.mode === MODE.PLAY) {
        autopilot(api);
        api.step(DT);
      }
      S.stagingHold = false;
      await sleep(400);
    } else if (scene === 'over') {
      api.startGame();
      S.stagingHold = true;
      await runSteps(api, 60 * 12); // main cukup lama agar layar skornya berisi angka nyata
      S.hp = 1;
      S.shieldCharges = 0;
      S.buffs.shield = 0;
      let guard = 0;
      while (S.hp > 0 && guard++ < 10) {
        P.invul = 0;
        P.dashT = 0;
        P.novaT = 0;
        api.hurtPlayer();
      }
      api.step(DT);
      S.stagingHold = false;
      await sleep(1700); // tunggu transisi layar game-over (delay CSS 1.1s)
    }
  } catch (err) {
    console.error('[shots]', err);
  }
  window.__shotReady = true;
  window.__shotMode = S.mode;
}
