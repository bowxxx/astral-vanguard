// state.js — status global permainan: skor, sektor, nyawa, nova, kombo, buff, relic.
export const W = 1280;
export const H = 720;

export const MODE = { TITLE: 'title', PLAY: 'play', PAUSE: 'pause', UPGRADE: 'upgrade', OVER: 'over' };

const HS_KEY = 'astral-vanguard-high';

export const S = {};

export function loadHigh() {
  try {
    const v = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function saveHigh() {
  try {
    localStorage.setItem(HS_KEY, String(S.high));
  } catch {
    /* penyimpanan tidak tersedia: abaikan */
  }
}

export function bossTimeFor(sector) { return Math.min(70, 42 + 4 * (sector - 1)); }
export function bossScoreFor(sector) { return 2400 + 1000 * (sector - 1); }

export function resetSpawnTimers() {
  S.sp = { meteor: 0.6, magma: 9, swarm: 4.5, gate: 20, item: 9 };
}

export function resetState() {
  const high = S.high ?? loadHigh();
  Object.assign(S, {
    mode: S.mode || MODE.TITLE,
    time: 0, score: 0, high, sector: 1, crystals: 0,
    hp: 3, maxHp: 3, nova: 0, novaMax: 100,
    combo: 0, comboTimer: 0,
    buffs: { tri: 0, overdrive: 0, shield: 0, magnet: 0 },
    shieldCharges: 0,
    upgrades: { homing: 0, pierce: 0, wingman: 0, crit: 0, maxhp: 0 },
    autoFire: true,
    shake: 0, flash: 0, novaFlash: 0, hitstop: 0, slow: 0, starBoost: 1,
    sectorTime: 0, sectorScore: 0,
    bossTime: bossTimeFor(1), bossScore: bossScoreFor(1),
    bossPhase: 'approach', warnT: 0, clearT: 0,
    banner: { text: '', sub: '', t: 0 },
    newRecord: false,
    stats: { kills: 0, bosses: 0, grazes: 0, maxCombo: 0, crystalsTotal: 0 },
  });
  resetSpawnTimers();
}

// Kesulitan naik tanpa batas seiring sektor.
export const diff = () => 1 + 0.2 * (S.sector - 1);
export const hpMul = () => 1 + 0.22 * (S.sector - 1);

export function comboHit() {
  S.combo = Math.min(S.combo + 1, 40);
  S.comboTimer = 2.6;
  if (S.combo > S.stats.maxCombo) S.stats.maxCombo = S.combo;
}

export const comboMul = () => 1 + Math.min(S.combo, 20) * 0.05;

export function addScore(n, useCombo = true) {
  const v = Math.round(n * (useCombo ? comboMul() : 1));
  S.score += v;
  S.sectorScore += v;
  if (S.score > S.high) { S.high = S.score; S.newRecord = true; }
  return v;
}

resetState();
