// main.js — titik masuk: mesin status, input, loop requestAnimationFrame, binding HUD.
import { staging, startStaging } from './shots.js';
import { W, H, S, MODE, resetState, saveHigh, loadHigh, bossTimeFor, bossScoreFor, resetSpawnTimers, addScore } from './state.js';
import { E, resetEntities, updateFx, updateEnemyBullets, burst, ring, floatText, shake, compact } from './entities.js';
import { P, resetPlayer, updatePlayer, updatePlayerBullets, tryNova, hurtPlayer, DASH_CD } from './player.js';
import { updateSpawner, updateEnemies } from './enemies.js';
import { B, spawnBoss, updateBoss, bossName, bossHpPct } from './boss.js';
import { updateItems, tickBuffs, spawnCrystals, ITEM } from './items.js';
import { pickThree, applyRelic } from './upgrades.js';
import { updateCombat } from './combat.js';
import { initRenderer, updateBackground, updateDemo, render } from './renderer.js';
import { initAudio, startMusic, stopMusic, setIntensity, setMuted, isMuted, suspendAudio, resumeAudio, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('game');
const input = { up: false, down: false, left: false, right: false, fire: false, mx: 160, my: H / 2, mouseMode: false, dashPressed: false };
let lastT = 0, cards = [];

/* ============ Mesin status ============ */
function setMode(m) {
  S.mode = m;
  document.body.dataset.mode = m;
}

function banner(main, sub = '', dur = 2.2) {
  S.banner = { text: main, sub, t: dur };
  $('banner-main').textContent = main;
  $('banner-sub').textContent = sub;
  $('banner').classList.add('on');
}

function startGame() {
  initAudio();
  resumeAudio();
  resetState();
  resetEntities();
  resetPlayer();
  Object.assign(input, { fire: false, dashPressed: false });
  setMode(MODE.PLAY);
  stopMusic();
  startMusic();
  setIntensity(0);
  banner('SECTOR 1', 'Sabuk kristal Nyx · bertahan hidup', 2.6);
  sfx.select();
}

function toTitle() {
  stopMusic();
  resetState();
  resetEntities();
  setMode(MODE.TITLE);
  $('title-high').textContent = S.high.toLocaleString('id-ID');
}

function togglePause() {
  if (S.mode === MODE.PLAY) {
    setMode(MODE.PAUSE);
    suspendAudio();
  } else if (S.mode === MODE.PAUSE) {
    setMode(MODE.PLAY);
    resumeAudio();
  }
}

function onBossDefeated() {
  setIntensity(0);
  addScore(3000 + 1000 * S.sector, false);
  for (const e of E.enemies) {
    if (e.type !== 'gate') {
      burst(e.x, e.y, 10, '#fde68a', 240, 0.5, 14);
      spawnCrystals(e.x, e.y, 2, 200);
    }
  }
  E.enemies.length = 0;
  E.eb.length = 0;
  spawnCrystals(B.x, B.y, 40, 520);
  floatText(B.x - 40, B.y - 40, `+${(3000 + 1000 * S.sector).toLocaleString('id-ID')}`, '#fde68a', 40);
  S.bossPhase = 'cleared';
  S.clearT = 2.2;
  banner('BOSS HANCUR', 'Ambil kristal yang berjatuhan', 2.0);
}

function openUpgrade() {
  cards = pickThree();
  sfx.upgrade();
  $('up-title').textContent = `Sector ${S.sector} bersih`;
  $('cards').innerHTML = cards.map((c, i) => `
    <button class="card" style="--c:${c.color}" data-id="${c.id}" data-i="${i}">
      ${c.icon}<h3>${c.name}</h3><p>${c.text}</p>
      <div class="lv"><span>Lv ${c.level} → ${c.level + 1}</span><kbd>${i + 1}</kbd></div>
    </button>`).join('');
  $('cards').querySelectorAll('.card').forEach((el) => el.addEventListener('click', () => chooseUpgrade(el.dataset.id)));
  setMode(MODE.UPGRADE);
  $('cards').querySelector('.card')?.focus({ preventScroll: true });
}

function chooseUpgrade(id) {
  if (S.mode !== MODE.UPGRADE) return;
  applyRelic(id);
  sfx.select();
  S.sector++;
  S.sectorTime = 0;
  S.sectorScore = 0;
  S.bossTime = bossTimeFor(S.sector);
  S.bossScore = bossScoreFor(S.sector);
  S.bossPhase = 'approach';
  S.hp = Math.min(S.maxHp, S.hp + 1);
  P.invul = 2;
  resetSpawnTimers();
  B.alive = false;
  E.eb.length = 0;
  setMode(MODE.PLAY);
  banner(`SECTOR ${S.sector}`, 'Ancaman meningkat', 2.4);
  document.activeElement?.blur?.();
}

function gameOver() {
  setMode(MODE.OVER);
  stopMusic();
  sfx.gameover();
  burst(P.x, P.y, 90, '#06b6d4', 700, 1.2, 26);
  burst(P.x, P.y, 50, '#ef4444', 500, 1, 22);
  burst(P.x, P.y, 30, '#fde68a', 400, 0.9, 18);
  ring(P.x, P.y, 320, '#ef4444', 0.9, 8);
  ring(P.x, P.y, 200, '#fff', 0.6, 3);
  shake(34);
  S.slow = 1.2;
  S.flash = 1;
  saveHigh();
  $('over-score').textContent = S.score.toLocaleString('id-ID');
  $('over-high').textContent = S.high.toLocaleString('id-ID');
  $('over-sector').textContent = S.sector;
  $('over-crystals').textContent = S.crystals;
  $('over-kills').textContent = S.stats.kills;
  $('over-bosses').textContent = S.stats.bosses;
  $('over-record').classList.toggle('on', S.newRecord);
  $('warning').classList.remove('on');
  $('boss-bar').classList.remove('on');
}

/* ============ Simulasi ============ */
function progressSector(dt) {
  if (S.bossPhase === 'approach') {
    if (S.sectorTime >= S.bossTime || S.sectorScore >= S.bossScore) {
      S.bossPhase = 'warning';
      S.warnT = 3.2;
      sfx.warning();
      setIntensity(1);
    }
  } else if (S.bossPhase === 'warning') {
    S.warnT -= dt;
    if (S.warnT <= 0) {
      spawnBoss();
      S.bossPhase = 'fight';
    }
  } else if (S.bossPhase === 'cleared') {
    S.clearT -= dt;
    if (S.clearT <= 0) {
      S.bossPhase = 'upgrade';
      openUpgrade();
    }
  }
}

function step(dt) {
  S.time += dt;
  S.sectorTime += dt;
  S.comboTimer -= dt;
  if (S.comboTimer <= 0) S.combo = 0;
  S.shake *= Math.exp(-7 * dt);
  S.flash = Math.max(0, S.flash - dt * 1.6);
  S.novaFlash = Math.max(0, S.novaFlash - dt * 1.8);
  if (S.banner.t > 0) {
    S.banner.t -= dt;
    if (S.banner.t <= 0) $('banner').classList.remove('on');
  }

  updatePlayer(dt, input);
  updatePlayerBullets(dt);
  tickBuffs(dt);
  progressSector(dt);
  if (S.bossPhase === 'approach') updateSpawner(dt);
  updateEnemies(dt, P);
  if (updateBoss(dt, P)) onBossDefeated();
  updateEnemyBullets(dt);
  updateItems(dt, P);
  updateCombat(dt);
  compact(E.enemies);
  compact(E.crystals);
  compact(E.items);
  updateFx(dt);
  if (S.hp <= 0 && S.mode === MODE.PLAY) gameOver();
}

function idleStep(dt) {
  S.shake *= Math.exp(-7 * dt);
  S.flash = Math.max(0, S.flash - dt * 1.2);
  S.novaFlash = Math.max(0, S.novaFlash - dt * 1.8);
  updateFx(dt);
}

/* ============ HUD ============ */
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] !== v) {
    hudCache[id] = v;
    $(id).textContent = v;
  }
}
const HEART = '<svg class="heart %c" viewBox="0 0 26 24"><path d="M13 21 C2 13 1 4 6 2 C9 1 12 3 13 5 C14 3 17 1 20 2 C25 4 24 13 13 21Z"/></svg>';

function updateHUD() {
  setText('hud-score', String(S.score).padStart(7, '0'));
  setText('hud-high', String(S.high).padStart(7, '0'));
  setText('hud-sector', String(S.sector));
  setText('hud-crystals', String(S.crystals));
  const lv = `${S.hp}/${S.maxHp}`;
  if (hudCache.lives !== lv) {
    hudCache.lives = lv;
    let h = '';
    for (let i = 0; i < S.maxHp; i++) {
      h += HEART.replace('%c', i < S.hp ? (S.hp <= 1 ? 'low' : '') : 'empty');
    }
    $('hud-lives').innerHTML = h;
  }
  const mul = (1 + Math.min(S.combo, 20) * 0.05).toFixed(2);
  const combo = $('hud-combo');
  combo.classList.toggle('on', S.combo >= 2);
  setText('hud-combo', `KOMBO ${S.combo} · x${mul}`);

  // Progres menuju boss.
  const pg = $('sector-prog');
  const pct = S.bossPhase === 'approach'
    ? Math.min(1, Math.max(S.sectorTime / S.bossTime, S.sectorScore / S.bossScore))
    : 1;
  $('sector-prog-fill').style.width = (pct * 100).toFixed(1) + '%';
  pg.style.opacity = S.bossPhase === 'approach' ? 1 : 0;

  // Bar boss.
  const bb = $('boss-bar'), on = B.alive && S.mode !== MODE.OVER;
  bb.classList.toggle('on', on);
  if (B.alive) {
    setText('boss-name', bossName());
    setText('boss-phase', B.dying ? 'Runtuh' : `Fase ${['I', 'II', 'III'][B.phase]}`);
    $('boss-fill').style.width = (bossHpPct() * 100).toFixed(1) + '%';
  }
  $('warning').classList.toggle('on', S.bossPhase === 'warning' && S.mode === MODE.PLAY);

  // Chip buff aktif.
  let bh = '';
  for (const k in S.buffs) {
    if (S.buffs[k] > 0) {
      const d = ITEM[k], f = Math.min(1, S.buffs[k] / d.dur);
      bh += `<div class="buff" style="--c:${d.color}">${d.name}${k === 'shield' ? ` ×${S.shieldCharges}` : ''}<i style="width:${(f * 100).toFixed(0)}%"></i></div>`;
    }
  }
  if (hudCache.buffs !== bh) {
    hudCache.buffs = bh;
    $('buffs').innerHTML = bh;
  }

  // Cincin Nova + dash.
  const C = 289, nova = $('nova');
  const np = Math.min(1, S.nova / S.novaMax);
  $('nova-ring').style.strokeDashoffset = (C * (1 - np)).toFixed(1);
  const ready = S.nova >= S.novaMax;
  nova.classList.toggle('ready', ready);
  setText('nova-pct', ready ? 'SIAP' : Math.floor(np * 100) + '%');
  setText('nova-key', ready ? 'RMB / E' : 'Nova');
  const dp = Math.max(0, Math.min(1, 1 - P.dashCd / DASH_CD));
  $('dash-ring').style.strokeDashoffset = (151 * (1 - dp)).toFixed(1);
  const fire = $('hud-fire');
  fire.classList.toggle('on', S.autoFire);
  setText('hud-fire', S.autoFire ? 'Auto-fire aktif' : 'Auto-fire mati (tahan klik)');
}

/* ============ Loop ============ */
function loop(ts) {
  requestAnimationFrame(loop);
  const raw = Math.min(0.05, (ts - lastT) / 1000 || 0);
  lastT = ts;
  if (S.mode === MODE.PAUSE) {
    render(false);
    return;
  }
  if (S.stagingHold) {
    render(S.mode === MODE.TITLE);
    updateHUD();
    return;
  }
  let dt = raw;
  if (S.hitstop > 0) {
    S.hitstop -= raw;
    dt = 0;
  }
  if (S.slow > 0) {
    S.slow -= raw;
    dt *= 0.35;
  }
  if (S.mode === MODE.PLAY) step(dt);
  else if (S.mode === MODE.TITLE) updateDemo(dt);
  else idleStep(dt);
  updateBackground(S.mode === MODE.PLAY || S.mode === MODE.TITLE ? dt : dt * 0.4);
  render(S.mode === MODE.TITLE);
  updateHUD();
}

/* ============ Input ============ */
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

window.addEventListener('keydown', (e) => {
  initAudio();
  const k = KEYMAP[e.code];
  if (k) {
    input[k] = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    $('btn-mute').textContent = `Suara: ${isMuted() ? 'mati' : 'nyala'}`;
    return;
  }
  if (S.mode === MODE.TITLE || S.mode === MODE.OVER) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startGame();
    }
    return;
  }
  if (S.mode === MODE.UPGRADE) {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0 && cards[i]) chooseUpgrade(cards[i].id);
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
    return;
  }
  if (S.mode !== MODE.PLAY) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) S.autoFire = !S.autoFire;
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyQ') {
    if (!e.repeat) input.dashPressed = true;
  } else if (e.code === 'KeyE') {
    if (!e.repeat) tryNova();
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});
window.addEventListener('blur', () => {
  input.up = input.down = input.left = input.right = input.fire = false;
  if (S.mode === MODE.PLAY) togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === MODE.PLAY) togglePause();
});

function mousePos(e) {
  const r = canvas.getBoundingClientRect();
  input.mx = (e.clientX - r.left) / r.width * W;
  input.my = (e.clientY - r.top) / r.height * H;
}
stage.addEventListener('mousemove', (e) => {
  mousePos(e);
  input.mouseMode = true;
});
stage.addEventListener('mousedown', (e) => {
  initAudio();
  if (e.target.closest('button')) return;
  mousePos(e);
  if (S.mode !== MODE.PLAY) return;
  if (e.button === 0) input.fire = true;
  else if (e.button === 2) tryNova();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.fire = false;
});
stage.addEventListener('contextmenu', (e) => e.preventDefault());

$('btn-start').addEventListener('click', () => { sfx.click(); startGame(); });
$('btn-retry').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', () => { initAudio(); sfx.click(); toTitle(); });
$('btn-pause').addEventListener('click', () => { sfx.click(); togglePause(); });
$('btn-resume').addEventListener('click', () => { togglePause(); });
$('btn-quit').addEventListener('click', () => { resumeAudio(); toTitle(); });
$('btn-mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('btn-mute').textContent = `Suara: ${isMuted() ? 'mati' : 'nyala'}`;
});

/* ============ Boot ============ */
S.high = loadHigh();
resetState();
setMode(MODE.TITLE);
$('title-high').textContent = S.high.toLocaleString('id-ID');
initRenderer(canvas);
requestAnimationFrame(loop);

// Hook debug/QA (dipakai skrip tangkap-layar & uji otomatis).
window.__astral = {
  S, P, B, E, input, startGame, openUpgrade, chooseUpgrade, gameOver, togglePause, tryNova, hurtPlayer, spawnBoss,
  forceBoss() { S.sectorTime = S.bossTime; },
  step,
};

if (staging) {
  startStaging(staging, {
    input, startGame, step, tryNova, hurtPlayer,
    forceBoss() { S.sectorTime = S.bossTime; },
  });
}
