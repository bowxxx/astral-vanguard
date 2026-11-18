// audio.js — synthesizer Web Audio API murni: efek suara dan musik prosedural, tanpa file audio.
let actx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, musicTimer = null, nextNote = 0, step = 0, intensity = 0;
const lastPlay = {};

export function initAudio() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  const comp = actx.createDynamicsCompressor();
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  sfxBus = actx.createGain();
  sfxBus.gain.value = 0.9;
  musicBus = actx.createGain();
  musicBus.gain.value = 0.32;
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp);
  comp.connect(actx.destination);
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, actx.currentTime, 0.03);
}
export const isMuted = () => muted;
export function suspendAudio() {
  if (actx && actx.state === 'running') actx.suspend();
}
export function resumeAudio() {
  if (actx && actx.state === 'suspended') actx.resume();
}

// Satu nada osilator dengan amplop serangan-peluruhan dan sapuan frekuensi.
function tone({ type = 'sine', f0 = 440, f1 = f0, t = 0.15, vol = 0.1, delay = 0, attack = 0.004, bus = sfxBus, detune = 0 }) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(g);
  g.connect(bus);
  o.start(t0);
  o.stop(t0 + t + 0.03);
}

// Desis noise yang difilter, untuk ledakan dan gerakan.
function noise({ t = 0.3, vol = 0.2, f0 = 2000, f1 = 200, type = 'lowpass', q = 1, delay = 0, bus = sfxBus }) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const s = actx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = actx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + t);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t0);
  s.stop(t0 + t + 0.03);
}

// Pembatas laju: efek yang sama tidak boleh berbunyi lebih sering dari ms.
const gate = (k, ms) => {
  const n = performance.now();
  if (n - (lastPlay[k] || 0) < ms) return false;
  lastPlay[k] = n;
  return true;
};

let crystalStep = 0, crystalTime = 0;

export const sfx = {
  laser() {
    if (!gate('laser', 55)) return;
    tone({ type: 'square', f0: 980, f1: 260, t: 0.09, vol: 0.035 });
    tone({ type: 'sawtooth', f0: 1500, f1: 500, t: 0.05, vol: 0.015 });
  },
  missile() {
    if (!gate('missile', 80)) return;
    noise({ t: 0.25, vol: 0.06, f0: 3000, f1: 500, type: 'bandpass', q: 2 });
  },
  hit() {
    if (!gate('hit', 45)) return;
    tone({ type: 'triangle', f0: 320, f1: 120, t: 0.05, vol: 0.05 });
  },
  explode(size = 1) {
    if (!gate('exp' + (size > 1.5), 40)) return;
    noise({ t: 0.35 + size * 0.25, vol: 0.13 + size * 0.07, f0: 1800 + size * 400, f1: 80 });
    tone({ type: 'sine', f0: 140 + size * 20, f1: 36, t: 0.3 + size * 0.2, vol: 0.2 + size * 0.05 });
  },
  crystal() {
    const n = performance.now();
    crystalStep = n - crystalTime < 450 ? Math.min(crystalStep + 1, 9) : 0;
    crystalTime = n;
    const f = 880 * Math.pow(2, [0, 3, 5, 7, 10, 12, 15, 17, 19, 24][crystalStep] / 12);
    tone({ type: 'triangle', f0: f, f1: f * 1.01, t: 0.16, vol: 0.06 });
    tone({ type: 'sine', f0: f * 2, t: 0.1, vol: 0.02, delay: 0.02 });
  },
  power() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, t: 0.14, vol: 0.05, delay: i * 0.06 }));
  },
  heart() {
    [392, 523, 659].forEach((f, i) => tone({ type: 'sine', f0: f, t: 0.35, vol: 0.09, delay: i * 0.09 }));
  },
  shieldBreak() {
    noise({ t: 0.4, vol: 0.18, f0: 6000, f1: 400, type: 'highpass' });
    tone({ type: 'sine', f0: 900, f1: 200, t: 0.3, vol: 0.12 });
  },
  graze() {
    if (!gate('graze', 90)) return;
    tone({ type: 'sine', f0: 2400, f1: 3200, t: 0.04, vol: 0.02 });
  },
  dash() {
    noise({ t: 0.22, vol: 0.14, f0: 400, f1: 5000, type: 'bandpass', q: 1.2 });
    tone({ type: 'sawtooth', f0: 200, f1: 700, t: 0.15, vol: 0.04 });
  },
  hurt() {
    noise({ t: 0.6, vol: 0.3, f0: 3000, f1: 60 });
    tone({ type: 'sawtooth', f0: 220, f1: 40, t: 0.55, vol: 0.2 });
  },
  nova() {
    noise({ t: 1.3, vol: 0.25, f0: 300, f1: 7000, type: 'bandpass', q: 0.8 });
    tone({ type: 'sawtooth', f0: 70, f1: 280, t: 1.1, vol: 0.16 });
    tone({ type: 'square', f0: 140, f1: 560, t: 1.0, vol: 0.06 });
    tone({ type: 'sine', f0: 55, f1: 30, t: 1.4, vol: 0.3, delay: 0.1 });
  },
  warning() {
    for (let i = 0; i < 4; i++) {
      tone({ type: 'sawtooth', f0: 520, t: 0.3, vol: 0.09, delay: i * 0.75 });
      tone({ type: 'sawtooth', f0: 392, t: 0.3, vol: 0.09, delay: i * 0.75 + 0.35 });
    }
  },
  phase() {
    noise({ t: 0.9, vol: 0.2, f0: 5000, f1: 100 });
    tone({ type: 'sawtooth', f0: 90, f1: 45, t: 0.9, vol: 0.2 });
  },
  bossDie() {
    for (let i = 0; i < 7; i++) {
      noise({ t: 0.6, vol: 0.2, f0: 2500, f1: 60, delay: i * 0.22 });
      tone({ type: 'sine', f0: 120, f1: 30, t: 0.6, vol: 0.25, delay: i * 0.22 });
    }
  },
  select() { tone({ type: 'square', f0: 660, f1: 990, t: 0.08, vol: 0.05 }); },
  click() { tone({ type: 'square', f0: 440, f1: 660, t: 0.05, vol: 0.04 }); },
  upgrade() {
    [392, 494, 587, 784, 988].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.6, vol: 0.08, delay: i * 0.07 }));
  },
  gameover() {
    [440, 349, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f * 0.9, t: 0.7, vol: 0.1, delay: i * 0.28 }));
  },
};

// ---- Musik prosedural: sequencer 16 langkah bernada A minor, dengan lookahead ----
const BASS = [55, 55, 82.4, 55, 65.4, 65.4, 98, 65.4, 43.7, 43.7, 65.4, 43.7, 49, 49, 73.4, 49];
const ARP = [220, 329.6, 261.6, 440, 349.2, 261.6, 220, 174.6, 261.6, 392, 329.6, 523.3, 392, 329.6, 293.7, 246.9];

function playStep(i, t) {
  const bar = Math.floor(i / 16) % 4, s = i % 16;
  const root = [1, 0.7937, 1.1892, 1.3348][bar];
  const sp = 60 / (intensity > 0.5 ? 138 : 120) / 4;
  const mk = (type, f, dur, vol, bus = musicBus) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  // Kick tiap ketukan.
  if (s % 4 === 0) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }
  mk('sawtooth', BASS[s] * root, sp * 1.6, 0.12);
  // Hi-hat di langkah ganjil.
  if (s % 2 === 1) {
    const n = actx.createBufferSource();
    n.buffer = noiseBuf;
    const f = actx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(f);
    f.connect(g);
    g.connect(musicBus);
    n.start(t);
    n.stop(t + 0.05);
  }
  // Snare tambahan saat intensitas tinggi.
  if (intensity > 0.5 && (s === 4 || s === 12)) {
    const n = actx.createBufferSource();
    n.buffer = noiseBuf;
    const f = actx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f);
    f.connect(g);
    g.connect(musicBus);
    n.start(t);
    n.stop(t + 0.14);
  }
  if (s % 2 === 0 || intensity > 0.5) mk('square', ARP[s] * root * 2, sp * 1.2, 0.035 + intensity * 0.02);
  // Pad di awal tiap bar.
  if (s === 0) {
    [1, 1.5, 2].forEach((m) => mk('triangle', 110 * root * m, sp * 14, 0.05));
  }
}

function scheduler() {
  if (!actx || actx.state !== 'running') return;
  const sp = 60 / (intensity > 0.5 ? 138 : 120) / 4;
  if (nextNote < actx.currentTime) nextNote = actx.currentTime + 0.05;
  while (nextNote < actx.currentTime + 0.25) {
    playStep(step++, nextNote);
    nextNote += sp;
  }
}

export function startMusic() {
  if (!actx || musicTimer) return;
  step = 0;
  nextNote = actx.currentTime + 0.1;
  musicTimer = setInterval(scheduler, 50);
}
export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
export function setIntensity(v) { intensity = v; }
