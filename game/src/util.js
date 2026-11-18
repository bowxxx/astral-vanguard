// util.js — bantuan matematika dan grid spasial untuk tabrakan cepat.
export const TAU = Math.PI * 2;

export function rnd(a, b) { return a + Math.random() * (b - a); }
export function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
export function easeOut(t) { const u = clamp(t, 0, 1); return 1 - (1 - u) * (1 - u) * (1 - u); }

export function circlesHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

// Jarak kuadrat dari titik (px,py) ke segmen garis (ax,ay)-(bx,by).
export function pointSegDist2(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  const cx = ax + abx * t - px, cy = ay + aby * t - py;
  return cx * cx + cy * cy;
}

// Grid hash spasial: dunia dibagi sel, tiap objek didaftarkan ke sel yang
// dilewati lingkarnya, jadi kueri tetangga hanya memeriksa sel terdekat.
export class SpatialGrid {
  constructor(w, h, cell = 96) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell) + 3;
    this.rows = Math.ceil(h / cell) + 3;
    this.cells = [];
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
    this.stamp = 0;
  }
  clear() {
    for (const c of this.cells) c.length = 0;
  }
  _idx(v, max) {
    return clamp(Math.floor(v / this.cell) + 1, 0, max - 1);
  }
  insert(o) {
    const x0 = this._idx(o.x - o.r, this.cols), x1 = this._idx(o.x + o.r, this.cols);
    const y0 = this._idx(o.y - o.r, this.rows), y1 = this._idx(o.y + o.r, this.rows);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.cells[y * this.cols + x].push(o);
    }
  }
  query(x, y, r, out = []) {
    out.length = 0;
    const s = ++this.stamp;
    const x0 = this._idx(x - r, this.cols), x1 = this._idx(x + r, this.cols);
    const y0 = this._idx(y - r, this.rows), y1 = this._idx(y + r, this.rows);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cy * this.cols + cx];
        for (const o of cell) {
          if (o._q !== s) { o._q = s; out.push(o); }
        }
      }
    }
    return out;
  }
}
