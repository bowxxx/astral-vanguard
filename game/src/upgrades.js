// upgrades.js — relic permanen dan pemilihan 3 kartu acak setelah boss kalah.
import { S } from './state.js';

const svg = (body) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const RELICS = [
  { id: 'homing', name: 'Homing Missiles', max: 5, color: '#f59e0b',
    icon: svg('<path d="M10 54 L36 28 L54 12 L46 32 L36 28"/><path d="M36 28 L28 38 L22 34 L30 24 Z"/><circle cx="48" cy="48" r="8"/><path d="M48 36v5M48 55v5M36 48h5M55 48h5"/>'),
    desc: (l) => `Menembakkan ${l >= 3 ? 3 : 2} rudal pencari setiap ${(1.5 - 0.15 * l).toFixed(2)} detik. Damage ${(2.4 + 0.4 * l).toFixed(1)} per rudal.` },
  { id: 'pierce', name: 'Piercing Laser', max: 4, color: '#06b6d4',
    icon: svg('<path d="M4 32h56"/><path d="M22 20l10 12-10 12-10-12z"/><path d="M44 24l8 8-8 8-8-8z"/><path d="M4 22h14M4 42h14" opacity=".5"/>'),
    desc: (l) => `Tembakan menembus ${l} musuh berurutan dan damage naik +${l * 18}%.` },
  { id: 'wingman', name: 'Wingman Drone', max: 3, color: '#38bdf8',
    icon: svg('<path d="M28 32 L40 25 L45 32 L40 39 Z"/><path d="M6 18 L18 12 L22 21 L12 26 Z"/><path d="M6 46 L18 52 L22 43 L12 38 Z"/><path d="M22 21l7 7M22 43l7-7" opacity=".6"/>'),
    desc: (l) => `${l} drone pendamping terbang di sisi pesawat dan menembak otomatis.` },
  { id: 'crit', name: 'Crit Blast', max: 5, color: '#fde047',
    icon: svg('<path d="M32 6l4 13 13 2-11 8 3 13-9-9-9 9 3-13-11-8 13-2z"/><circle cx="32" cy="32" r="4"/>'),
    desc: (l) => `${l * 9}% tembakan menjadi kritis (damage x2.5) dan meledak kecil di sekitarnya.` },
  { id: 'maxhp', name: 'Max HP', max: 6, color: '#ef4444',
    icon: svg('<path d="M32 52 C10 36 12 16 24 16 C29 16 32 20 32 23 C32 20 35 16 40 16 C52 16 54 36 32 52z"/><path d="M32 25v15M24.5 32.5h15"/>'),
    desc: (l) => `Batas HP maksimum menjadi ${3 + l}, dan langsung memulihkan 1 HP.` },
];

export function relicById(id) {
  return RELICS.find((r) => r.id === id);
}

export function pickThree() {
  const pool = RELICS.filter((r) => S.upgrades[r.id] < r.max);
  const shuffled = pool.map((r) => ({ r, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.r);
  const out = shuffled.slice(0, 3);
  while (out.length < 3) out.push(relicById('maxhp'));
  return out.map((r) => ({
    id: r.id, name: r.name, color: r.color, icon: r.icon,
    level: S.upgrades[r.id], max: r.max, text: r.desc(S.upgrades[r.id] + 1),
  }));
}

export function applyRelic(id) {
  const r = relicById(id);
  if (!r) return;
  S.upgrades[id] = Math.min(S.upgrades[id] + 1, id === 'maxhp' ? 99 : r.max);
  if (id === 'maxhp') {
    S.maxHp++;
    S.hp = Math.min(S.maxHp, S.hp + 1);
  }
}
