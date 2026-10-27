// ===================== Rośliny: drzewa i krzewy z kodu, las z imitacjami w oddali =====================
// Przeniesione z laboratorium roślin (repo Battle: PlantKit i ForestKit) i dostosowane do three.js r147
// (kodowanie tekstur, nazwy zmiennych w szaderach, liniowa mgła sceny). Bez trawy.
const PLANTS = (function () {
// PlantKit: procedural plants at real scale (metres, y up, the base at the origin) — trees, palms and shrubs grown from
// a seed by species rules (trunk, branch whorls or limbs, twigs), dressed with bark and foliage drawn on canvases (no
// image files), and moved by the wind in the vertex shader (the trunk bends with height, leaves flutter).
//  SPECIES                      what each plant is (botanical name, heights, biomes) — sources in docs/plants.md
//  growPlant(id, { seed, size }) → { bark, leaf: BufferGeometry, height, radius, crown } (merged, one per material)
//  plantMaterials(id, wind)     bark and foliage materials (+ shadow-casting depth materials) sharing the wind uniforms
//  windUniforms()               uWind (strength 0..1.5), uWindDir (xz), uTime, uSeason (0 summer … 1 autumn)
// Every vertex carries aWind = (sway in metres per unit wind, flutter 0..1, phase); the same attribute drives the
// impostors' baking (none) and the shadow pass (same sway), so shadows move with the trees.

function rng(seed = 1) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ---------------- species ---------------- */
// leaf: which canvas foliage; bark: which canvas bark; deciduous: autumn colours; heights in metres (mature trees)
const SPECIES = {
  spruce: { name: 'Norway spruce', latin: 'Picea abies', kind: 'conifer', height: [18, 32], biomes: ['temperate'], leaf: 'spruce', bark: 'spruce', note: 'Conical crown of whorled branches that droop and turn up at the tips; the commonest tree of northern and mountain forests.' },
  pine: { name: 'Scots pine', latin: 'Pinus sylvestris', kind: 'conifer', height: [15, 28], biomes: ['temperate', 'plains'], leaf: 'pine', bark: 'pine', note: 'Tall bare trunk, grey-brown and furrowed below, thin orange flaking bark above; an irregular, flat-topped crown of needle tufts.' },
  birch: { name: 'Silver birch', latin: 'Betula pendula', kind: 'broadleaf', deciduous: true, height: [14, 24], biomes: ['temperate', 'plains'], leaf: 'birch', bark: 'birch', note: 'White bark with black lenticels, dark and fissured at the base; ascending branches with hanging twigs.' },
  oak: { name: 'Pedunculate oak', latin: 'Quercus robur', kind: 'broadleaf', deciduous: true, height: [16, 28], biomes: ['plains', 'temperate'], leaf: 'oak', bark: 'oak', note: 'Short massive trunk dividing into a few heavy limbs; a broad, open, rounded crown of lobed leaves; deeply furrowed grey bark.' },
  palm: { name: 'Date palm', latin: 'Phoenix dactylifera', kind: 'palm', height: [12, 22], biomes: ['desert'], leaf: 'frond', bark: 'palm', note: 'A single trunk patterned by old leaf bases; a crown of 20–30 pinnate fronds 4–6 m long, the old ones hanging dry below.' },
  acacia: { name: 'Umbrella thorn acacia', latin: 'Vachellia tortilis', kind: 'broadleaf', height: [5, 11], biomes: ['desert'], leaf: 'acacia', bark: 'acacia', note: 'A short trunk splitting into ascending limbs that end in a wide, flat, umbrella-shaped crown of tiny leaflets.' },
  juniper: { name: 'Common juniper', latin: 'Juniperus communis', kind: 'shrub', height: [1.5, 4], biomes: ['temperate', 'plains'], leaf: 'juniper', bark: 'juniper', note: 'An evergreen shrub of several stems, columnar or spreading, with prickly blue-green needles; on heaths and dry slopes.' },
  saltbush: { name: 'Desert saltbush', latin: 'Atriplex sp.', kind: 'shrub', height: [0.6, 1.4], biomes: ['desert'], leaf: 'saltbush', bark: 'acacia', note: 'A low, rounded grey-green bush of small fleshy leaves; tolerates salt and drought.' },
};
const SPECIES_IDS = Object.keys(SPECIES);

/* ---------------- canvas textures ---------------- */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
function stroke(g, x0, y0, x1, y1, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

// Foliage cards: v (the canvas y, top = 0) runs along the twig from its base (bottom of the canvas) to its tip (top).
const LEAF_DRAW = {
  spruce(g, W, H, r) {                                                  // a hanging spray: twig, side twigs, dense short needles
    const twig = (x0, y0, x1, y1, n) => {
      stroke(g, x0, y0, x1, y1, 3, '#3b2a1c');
      for (let i = 0; i < n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0);
        for (const s of [-1, 1]) for (let q = 0; q < 2; q++) {
          const b = a + s * (0.8 + r() * 0.9), L = 14 + r() * 12;
          stroke(g, x, y, x + Math.cos(b) * L, y + Math.sin(b) * L, 4, hsl(105 + r() * 25, 30 + r() * 15, 12 + r() * 12));
        }
      }
    };
    for (let k = 0; k < 3; k++) {
      const x = W * (0.3 + 0.2 * k), sway = (r() - 0.5) * 60;
      twig(x, H * 0.98, x + sway, H * 0.05, 120);
      for (let j = 1; j < 12; j++) { const y = H * (0.97 - j * 0.075), s = j % 2 ? 1 : -1, wd = (60 + r() * 50) * (1 - j / 14); twig(x + sway * (1 - y / H), y, x + sway * (1 - y / H) + s * wd, y - 50 - r() * 40, 30); }
    }
  },
  pine(g, W, H, r) {                                                    // tufts of long needles in pairs at the twig ends
    for (let k = 0; k < 14; k++) {
      const x = W * (0.15 + r() * 0.7), y = H * (0.12 + r() * 0.72);
      stroke(g, W / 2, H, x, y, 5, '#4a3524');
      for (let i = 0; i < 90; i++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 3.0, L = 36 + r() * 46;
        stroke(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.9, 3.2, hsl(110 + r() * 25, 26 + r() * 12, 16 + r() * 14));
      }
    }
  },
  birch(g, W, H, r) {                                                   // hanging twigs with small ovate leaves
    for (let k = 0; k < 11; k++) {
      let x = W * (0.06 + k * 0.088 + (r() - 0.5) * 0.04), y = H * (0.02 + r() * 0.1);
      const n = 24 - Math.floor(r() * 8);
      for (let s = 0; s < n; s++) {
        const nx = x + (r() - 0.5) * 12, ny = y + H / 26;
        stroke(g, x, y, nx, ny, 1.6, '#3a3128'); x = nx; y = ny;
        for (const side of [-1, 1]) for (let q = 0; q < 2; q++) {
          g.save(); g.translate(x + side * (8 + q * 7), y + 4 + q * 6); g.rotate(side * 0.6 + (r() - 0.5) * 0.8);
          g.fillStyle = hsl(78 + r() * 22, 40 + r() * 20, 24 + r() * 18); g.beginPath(); g.ellipse(0, 0, 8, 12, 0, 0, 7); g.fill(); g.restore();
        }
      }
    }
  },
  oak(g, W, H, r) {                                                     // clusters of lobed leaves
    for (let i = 0; i < 420; i++) {
      const x = W * (0.06 + r() * 0.88), y = H * (0.06 + r() * 0.88), a = r() * 6.28, L = 26 + r() * 16;
      const dx = W / 2 - x, dy = H / 2 - y; if (dx * dx + dy * dy > (W * 0.46) ** 2) continue;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = hsl(80 + r() * 20, 30 + r() * 18, 18 + r() * 14);
      for (let l = 0; l < 4; l++) { g.beginPath(); g.ellipse(0, -L * 0.45 + l * L * 0.3, L * (0.22 + 0.06 * (l % 2)), L * 0.2, 0, 0, 7); g.fill(); }
      g.beginPath(); g.ellipse(0, 0, L * 0.18, L * 0.62, 0, 0, 7); g.fill(); g.restore();
    }
  },
  acacia(g, W, H, r) {                                                  // feathery twigs of tiny leaflets
    for (let k = 0; k < 34; k++) {
      const x0 = W * (0.1 + r() * 0.8), y0 = H * (0.1 + r() * 0.8), a = r() * 6.28, L = 70 + r() * 70;
      for (let i = 0; i < 24; i++) {
        const t = i / 24, x = x0 + Math.cos(a) * L * t, y = y0 + Math.sin(a) * L * t;
        for (const s of [-1, 1]) for (let q = 1; q <= 2; q++) { g.fillStyle = hsl(70 + r() * 20, 25 + r() * 15, 22 + r() * 14); g.beginPath(); g.ellipse(x + Math.cos(a + s * 1.57) * 6 * q, y + Math.sin(a + s * 1.57) * 6 * q, 5, 3.5, a, 0, 7); g.fill(); }
      }
    }
  },
  juniper(g, W, H, r) {
    for (let i = 0; i < 2600; i++) {
      const x = W * (0.05 + r() * 0.9), y = H * (0.05 + r() * 0.9), dx = x - W / 2, dy = y - H / 2;
      if (dx * dx + dy * dy > (W * 0.47) ** 2) continue;
      const a = r() * 6.28, L = 10 + r() * 10;
      stroke(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 3.4, hsl(130 + r() * 30, 14 + r() * 14, 22 + r() * 14));
    }
  },
  saltbush(g, W, H, r) {
    for (let i = 0; i < 1500; i++) {
      const x = W * (0.05 + r() * 0.9), y = H * (0.05 + r() * 0.9), dx = x - W / 2, dy = y - H / 2;
      if (dx * dx + dy * dy > (W * 0.46) ** 2) continue;
      g.fillStyle = hsl(85 + r() * 25, 10 + r() * 10, 42 + r() * 16); g.beginPath(); g.ellipse(x, y, 4 + r() * 3, 3 + r() * 2, r() * 3, 0, 7); g.fill();
    }
  },
  frond(g, W, H, r) {                                                   // two pinnate fronds side by side: live (left half), dry (right half)
    for (const [x0, dead] of [[0, false], [W / 2, true]]) {
      const cx = x0 + W / 4;
      stroke(g, cx, H, cx, 0, 5, dead ? '#6b5233' : '#5d6b3a');
      for (let y = H * 0.97; y > H * 0.02; y -= 7) {
        const t = 1 - y / H, L = W * 0.24 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.95) + 4;
        for (const s of [-1, 1]) {
          const col = dead ? hsl(30 + r() * 10, 30 + r() * 15, 26 + r() * 14) : hsl(85 + r() * 20, 20 + r() * 14, 30 + r() * 12);
          stroke(g, cx, y, cx + s * L, y - L * 0.55, 3, col);
        }
      }
    }
  },
};
const LEAF_SIZE = { frond: [512, 1024] };
const _leafTex = {};
function leafTexture(kind) {
  if (_leafTex[kind]) return _leafTex[kind];
  const [W, H] = LEAF_SIZE[kind] || [512, 512], [c, g] = cnv(W, H);
  LEAF_DRAW[kind](g, W, H, rng(kind.length * 977));
  if (kind !== 'frond') {                                               // an irregular, rounded outline: no card edges in the silhouette
    const d = g.getImageData(0, 0, W, H), r = rng(kind.length * 31), N = 16, nz = Array.from({ length: N * N }, () => r());
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, a = (i, j) => nz[((j % N + N) % N) * N + ((i % N + N) % N)];
      return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W - 0.5, v = y / H - 0.5, rr = Math.hypot(u, v * (kind === 'spruce' || kind === 'birch' ? 0.75 : 1)) + (vn(x / W * 7, y / H * 7) - 0.5) * 0.22;
      const k = Math.min(1, Math.max(0, (0.47 - rr) / 0.07)), i = (y * W + x) * 4 + 3; d.data[i] = d.data[i] * k;
    }
    g.putImageData(d, 0, 0);
  }
  const t = tex(c, false); t.generateMipmaps = true;
  return (_leafTex[kind] = t);
}

// Bark: tileable 256 × 512, u around the stem, v up it.
const BARK_DRAW = {
  spruce: { base: [52, 30, 22], plates: true, contrast: 0.45 },
  pine: { base: [70, 52, 40], furrows: true, contrast: 0.55 },
  birch: { base: [222, 220, 210], lenticels: true, contrast: 0.12 },
  oak: { base: [72, 66, 58], furrows: true, contrast: 0.7 },
  palm: { base: [104, 84, 60], diamonds: true, contrast: 0.5 },
  acacia: { base: [70, 58, 48], furrows: true, contrast: 0.45 },
  juniper: { base: [92, 58, 40], shreds: true, contrast: 0.5 },
};
const _barkTex = {};
function barkTexture(kind) {
  if (_barkTex[kind]) return _barkTex[kind];
  const W = 256, H = 512, [c, g] = cnv(W, H), d = g.createImageData(W, H), r = rng(kind.length * 131 + 7), B = BARK_DRAW[kind];
  const N = 64, n1 = Array.from({ length: N * N }, () => r());
  const vn = (x, y, s) => { x = x / s; y = y / s; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, a = (i, j) => n1[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (a(xi, yi) * (1 - sx) + a(xi + 1, yi) * sx) * (1 - sy) + (a(xi, yi + 1) * (1 - sx) + a(xi + 1, yi + 1) * sx) * sy; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0.5 + (vn(x, y, 16) - 0.5) * 0.5 + (vn(x, y, 5) - 0.5) * 0.3;
    if (B.furrows) { const f = Math.abs(Math.sin((x + vn(x, y, 40) * 60) / W * Math.PI * 7)); v *= 0.45 + 0.75 * Math.pow(f, 0.6); }
    if (B.plates) { const f = vn(x * 1.4, y * 0.8, 9); v *= 0.6 + 0.6 * f; }
    if (B.shreds) { const f = Math.abs(Math.sin((x + vn(x, y, 60) * 40) / W * Math.PI * 14)); v *= 0.6 + 0.5 * f; }
    if (B.diamonds) { const u = ((x / W * 6 + y / H * 4) % 1 + 1) % 1, w = ((x / W * 6 - y / H * 4) % 1 + 1) % 1; v *= 0.45 + 0.9 * Math.min(1, Math.min(u, 1 - u, w, 1 - w) * 5); }
    let [R, G, Bc] = B.base, k = 1 + (v - 0.5) * 2 * B.contrast;
    if (B.lenticels) {                                                   // birch: black horizontal lenticels and dark patches
      const l = vn(x * 0.25, y * 3, 6), p = vn(x, y, 50);
      if (l > 0.72) k *= 0.25; if (p > 0.7) k *= 0.35 + (1 - p) * 1.5;
    }
    const i = (y * W + x) * 4; d.data[i] = Math.min(255, R * k); d.data[i + 1] = Math.min(255, G * k); d.data[i + 2] = Math.min(255, Bc * k); d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return (_barkTex[kind] = tex(c, true));
}

/* ---------------- geometry builder ---------------- */
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.w = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(p, n, u, v, w) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, v); this.w.push(w[0], w[1], w[2]); return this.count - 1; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
// A tapered tube along a polyline (parallel-transport frames); wind(t 0..1 along it) → [sway, flutter, phase]
function tube(G, pts, rads, segs, wind, texW = 0.6, texH = 1.6) {
  const n = pts.length, T = [];
  for (let i = 0; i < n; i++) T.push(pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  let N = Math.abs(T[0].y) < 0.9 ? V(0, 1, 0).cross(T[0]).normalize() : V(1, 0, 0).cross(T[0]).normalize();
  const reps = Math.max(1, Math.round(2 * Math.PI * rads[0] / texW)); let len = 0;
  const base = G.count;
  for (let i = 0; i < n; i++) {
    if (i > 0) { const ax = T[i - 1].clone().cross(T[i]); if (ax.lengthSq() > 1e-10) N.applyAxisAngle(ax.normalize(), Math.acos(Math.min(1, Math.max(-1, T[i - 1].dot(T[i]))))); len += pts[i].distanceTo(pts[i - 1]); }
    const Bn = T[i].clone().cross(N).normalize(), w = wind(i / (n - 1));
    for (let s = 0; s <= segs; s++) {
      const a = s / segs * Math.PI * 2, d = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
      G.vert(pts[i].clone().addScaledVector(d, rads[i]), d, s / segs * reps, len / texH, w);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < segs; s++) {
    const a = base + i * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1;
    G.i.push(a, c, b, b, c, d);
  }
}
// A foliage card: base at c, extends along ax by h, across side by w; nrm is the shading normal (outward from the crown)
function card(G, c, ax, side, w, h, nrm, wind, uv = [0, 0, 1, 1]) {
  const [u0, v0, u1, v1] = uv, b = G.count;
  const p = (sx, t) => c.clone().addScaledVector(side, sx * w / 2).addScaledVector(ax, t * h);
  G.vert(p(-1, 0), nrm, u0, v0, wind); G.vert(p(1, 0), nrm, u1, v0, wind); G.vert(p(-1, 1), nrm, u0, v1, wind); G.vert(p(1, 1), nrm, u1, v1, wind);
  G.i.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
}
// a tuft: three crossed cards around c in a random orientation — reads as a volume of leaves from any side
function tuft(G, c, size, nrm, wind, r) {
  const a = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), b = perp(a), e = a.clone().cross(b).normalize();
  for (const [ax, sd] of [[a, b], [b, e], [e, a]]) card(G, c.clone().addScaledVector(ax, -size / 2), ax, sd, size, size, nrm, wind);
}
const perp = (d) => (Math.abs(d.y) < 0.95 ? V(0, 1, 0).cross(d) : V(1, 0, 0).cross(d)).normalize();
const dirAt = (yaw, pitch) => V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
// a curved limb: from p0 along d, length L, bending by `bend` per unit length towards `pull` (gravity or light)
function limb(p0, d, L, n, pull, bend) {
  const pts = [p0.clone()], dir = d.clone(); let p = p0.clone();
  for (let i = 1; i <= n; i++) { dir.addScaledVector(pull, bend * L / n).normalize(); p = p.clone().addScaledVector(dir, L / n); pts.push(p); }
  return pts;
}

/* ---------------- growers ---------------- */
// sway in metres at full wind for a point at height y of a tree H tall, plus how far out along a branch it is
const swayAt = (y, H, out = 0) => 0.035 * H * Math.pow(Math.max(0, y) / H, 1.6) + out * 0.08;

const GROW = {
  spruce(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), R0 = H * 0.017, lean = V((r() - 0.5) * 0.02, 1, (r() - 0.5) * 0.02).normalize();
    const trunk = []; for (let i = 0; i <= 10; i++) trunk.push(lean.clone().multiplyScalar(H * i / 10));
    tube(bark, trunk, trunk.map((_, i) => R0 * (1 - i / 10) + 0.02), Math.max(5, Math.round(9 * d)), (t) => [swayAt(t * H, H), 0, r()]);
    const cb = H * (0.08 + r() * 0.06), step = 0.55 / Math.max(0.6, d); let rot = r() * 6;
    for (let y = cb; y < H - 0.4; y += step * (0.85 + r() * 0.3)) {
      const rel = (y - cb) / (H - cb), L = Math.min(5, (H - y) * 0.36 + 0.4) * (0.85 + r() * 0.3), n = 4 + Math.floor(r() * 2);
      rot += 0.9;
      for (let k = 0; k < n; k++) {
        const yaw = rot + k / n * 6.283 + (r() - 0.5) * 0.4, pitch = -0.25 + rel * 0.55 + (r() - 0.5) * 0.15;
        const p0 = lean.clone().multiplyScalar(y), d0 = dirAt(yaw, pitch);
        const pts = limb(p0, d0, L, 3, V(0, -1, 0), 0.18 * (1 - rel));
        const tip = pts[pts.length - 1], w = (t) => [swayAt(y, H, t * L), 0, r()];
        if (d >= 0.75 || L > 1.6) tube(bark, pts, pts.map((_, i) => 0.06 * (1 - i / pts.length) * (0.5 + 0.5 * (1 - rel)) + 0.01), 3, w);
        // hanging sprays along the outer two thirds, one lying along the branch, one hanging below it
        const sp = Math.max(0.4, 0.5 / Math.max(0.6, d));
        for (let s = L * 0.2; s < L; s += sp) {
          const t = s / L, c = pts[0].clone().lerp(tip, t), side = perp(d0), nrm = V(d0.x, 0.35, d0.z).normalize(), size = 1.3 + 0.8 * (1 - rel);
          card(leaf, c.clone().addScaledVector(d0, -size * 0.3), d0, side, size * 0.9, size * 1.1, nrm, [swayAt(y, H, s), 1, r()]);
          card(leaf, c.clone().add(V(0, 0.1, 0)), V(d0.x * 0.4, -1, d0.z * 0.4).normalize(), side, size * 0.8, size * 0.9, nrm, [swayAt(y, H, s), 1, r()]);
        }
      }
    }
    for (let k = 0; k < 3; k++) card(leaf, lean.clone().multiplyScalar(H - 1.4), V(0, 1, 0), dirAt(k * 2.1, 0), 0.9, 1.6, V(0, 1, 0), [swayAt(H, H), 1, r()]);
    return { bark, leaf, H, R: H * 0.2, crown: V(0, H * 0.45, 0) };
  },
  pine(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), R0 = H * 0.016, trunk = [];
    let p = V(), dir = V((r() - 0.5) * 0.06, 1, (r() - 0.5) * 0.06).normalize();
    for (let i = 0; i <= 12; i++) { trunk.push(p.clone()); if (i % 4 === 3) dir.add(V((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12)).normalize(); p = p.clone().addScaledVector(dir, H * 0.92 / 12); }
    tube(bark, trunk, trunk.map((_, i) => R0 * (1 - i / 13) + 0.03), Math.max(5, Math.round(9 * d)), (t) => [swayAt(t * H, H), 0, r()]);
    const top = trunk[trunk.length - 1], crownC = V(top.x, H * 0.8, top.z);
    for (let i = 1; i < 5; i++) { const y = H * (0.15 + i * 0.1), at = trunk[Math.round(y / H * 12)]; tube(bark, [at, at.clone().add(dirAt(r() * 6.28, -0.2).multiplyScalar(0.4))], [0.05, 0.02], 3, () => [swayAt(y, H), 0, 0]); }   // dead stubs
    const nb = 6 + Math.floor(r() * 4);
    const clump = (c, rad, n, out) => { for (let k = 0; k < n; k++) { const nd = dirAt(r() * 6.28, (r() - 0.3) * 1.2), p = c.clone().addScaledVector(nd, rad * r() * 0.6), sz = 1.3 + r() * 0.7; tuft(leaf, p, sz, p.clone().sub(crownC).add(V(0, 1.2, 0)).normalize(), [swayAt(c.y, H, out), 1, r()], r); } };
    for (let k = 0; k < nb; k++) {
      const y = H * (0.6 + 0.35 * (k / nb)) , at = trunk[Math.min(12, Math.round(y / H * 12))], yaw = r() * 6.28, L = H * (0.18 + 0.12 * r()) * (1 - (k / nb) * 0.5);
      const pts = limb(at, dirAt(yaw, 0.5 + r() * 0.5), L, 4, V(0, 1, 0), 0.25);
      tube(bark, pts, pts.map((_, i) => 0.11 * (1 - i / 5) + 0.02), 4, (t) => [swayAt(y, H, t * L), 0, r()]);
      for (let s = 0; s < 3; s++) {
        const a0 = pts[2 + (s % 3)], sub = limb(a0, dirAt(yaw + (r() - 0.5) * 1.8, 0.3 + r() * 0.4), L * 0.45, 2, V(0, 1, 0), 0.3);
        if (d >= 0.75) tube(bark, sub, [0.05, 0.03, 0.015], 3, (t) => [swayAt(a0.y, H, L * 0.5 + t * L * 0.4), 0, r()]);
        clump(sub[2], 1.2, Math.round(5 * Math.min(1.3, d)), L);
      }
      clump(pts[pts.length - 1], 1.4, Math.round(6 * Math.min(1.3, d)), L);
    }
    clump(top, 1.3, 8, 0);
    return { bark, leaf, H, R: H * 0.22, crown: crownC };
  },
  birch(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), R0 = H * 0.012, trunk = [];
    const bend = V((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8);
    for (let i = 0; i <= 10; i++) { const t = i / 10; trunk.push(V(bend.x * Math.sin(t * Math.PI), H * t, bend.z * Math.sin(t * Math.PI))); }
    tube(bark, trunk, trunk.map((_, i) => R0 * (1 - i / 11) + 0.02), Math.max(5, Math.round(8 * d)), (t) => [swayAt(t * H, H), 0, r()], 0.8, 2.4);
    const crownC = V(0, H * 0.62, 0), nb = Math.round(16 * Math.min(1.2, d) + r() * 6);
    for (let k = 0; k < nb; k++) {
      const y = H * (0.3 + 0.62 * k / nb), at = trunk[Math.round(y / H * 10)], rel = (y - H * 0.3) / (H * 0.7);
      const yaw = k * 2.4 + r() * 0.6, L = (H * 0.32 * (1 - rel * 0.75) + 1) * (0.8 + 0.4 * r());
      const pts = limb(at, dirAt(yaw, 0.75 + r() * 0.25), L, 4, V(0, -1, 0), 0.22);
      tube(bark, pts, pts.map((_, i) => 0.06 * (1 - i / 5) + 0.012), 3, (t) => [swayAt(y, H, t * L), 0, r()], 0.8, 2.4);
      for (let s = 0.15; s < 1.0; s += 0.07 / Math.max(0.6, d)) {
        const i0 = Math.min(pts.length - 2, Math.floor(s * (pts.length - 1))), c = pts[i0].clone().lerp(pts[i0 + 1], s * (pts.length - 1) - i0).add(V((r() - 0.5) * 1.2, (r() - 0.5) * 0.6, (r() - 0.5) * 1.2));
        const nrm = c.clone().sub(crownC).normalize(), side = perp(V(0, -1, 0)).applyAxisAngle(V(0, 1, 0), r() * 6.28), sz = 1.2 + r() * 0.6;
        if (r() < 0.55) card(leaf, c.clone().add(V(0, 0.3, 0)), V((r() - 0.5) * 0.4, -1, (r() - 0.5) * 0.4).normalize(), side, sz * 0.55, sz * 1.5, nrm, [swayAt(c.y, H, s * L), 1, r()]);
        else tuft(leaf, c, sz, nrm, [swayAt(c.y, H, s * L), 1, r()], r);
      }
    }
    return { bark, leaf, H, R: H * 0.25, crown: crownC };
  },
  oak(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), R0 = H * 0.034, crownC = V(0, H * 0.6, 0);
    const split = H * (0.22 + 0.1 * r()), trunk = [V(), V((r() - 0.5) * 0.3, split * 0.5, (r() - 0.5) * 0.3), V((r() - 0.5) * 0.4, split, (r() - 0.5) * 0.4)];
    tube(bark, trunk, [R0 * 1.25, R0, R0 * 0.85], Math.max(6, Math.round(10 * d)), (t) => [swayAt(t * split, H), 0, r()]);
    const grow = (p0, dir, L, rad, lvl, out) => {
      const pts = limb(p0, dir, L, 3, V(0, 1, 0), 0.12 + lvl * 0.04);
      tube(bark, pts, pts.map((_, i) => rad * (1 - i / 4 * 0.55)), Math.max(3, Math.round((7 - lvl * 2) * d)), (t) => [swayAt(p0.y, H, out + t * L), 0, r()]);
      const end = pts[pts.length - 1];
      if (lvl >= 2 || rad < 0.05) {                                    // leaf clusters at the twig ends
        const n = Math.round(6 * Math.min(1.3, d));
        for (let k = 0; k < n; k++) {
          const nd = dirAt(r() * 6.28, (r() - 0.3) * 1.4), c = end.clone().addScaledVector(nd, r() * 2.2), sz = 2.2 + r() * 1.0;
          tuft(leaf, c, sz, c.clone().sub(crownC).add(V(0, H * 0.15, 0)).normalize(), [swayAt(c.y, H, out + L), 1, r()], r);
        }
        return;
      }
      const kids = 2 + Math.floor(r() * 2);
      for (let k = 0; k < kids; k++) {
        const nd = dir.clone().applyAxisAngle(perp(dir), (r() - 0.5) * 1.3).applyAxisAngle(V(0, 1, 0), (k - (kids - 1) / 2) * 1.0 + (r() - 0.5) * 0.4);
        nd.y = Math.max(-0.2, nd.y); nd.normalize();
        grow(end, nd, L * (0.6 + r() * 0.2), rad * 0.55, lvl + 1, out + L);
      }
      // a few twig clusters along the limb too, to fill the crown
      if (lvl >= 1) for (let k = 0; k < 3; k++) { const c = pts[1 + (k % 3)].clone().add(V((r() - 0.5) * 1.5, (r() - 0.5), (r() - 0.5) * 1.5)), sz = 2.0 + r() * 0.8; tuft(leaf, c, sz, c.clone().sub(crownC).add(V(0, H * 0.15, 0)).normalize(), [swayAt(c.y, H, out), 1, r()], r); }
    };
    const limbs = 3 + Math.floor(r() * 3), top = trunk[2];
    for (let k = 0; k < limbs; k++) grow(top, dirAt(k / limbs * 6.28 + r() * 0.5, 0.5 + r() * 0.45), H * (0.3 + 0.1 * r()), R0 * 0.6, 0, 0);
    return { bark, leaf, H, R: H * 0.45, crown: crownC };
  },
  palm(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), lean = (r() - 0.5) * 0.25, ly = r() * 6.28, trunk = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; trunk.push(V(Math.sin(ly) * lean * H * t * t, H * t, Math.cos(ly) * lean * H * t * t)); }
    tube(bark, trunk, trunk.map((_, i) => (i === 0 ? 0.48 : 0.34 - 0.04 * i / 12)), Math.max(6, Math.round(10 * d)), (t) => [swayAt(t * H, H) * 1.3, 0, r()], 0.7, 1.4);
    const top = trunk[12], crownC = top.clone().add(V(0, 0.5, 0));
    // a frond: a ribbon along an arching rachis, folded in a shallow V (two halves)
    const frond = (yaw, pitch, L, dead) => {
      const n = Math.max(5, Math.round(9 * d)), dir = dirAt(yaw, pitch), pts = limb(top.clone().add(V(0, 0.3, 0)), dir, L, n, V(0, -1, 0), dead ? 0.1 : 0.32);
      const uv0 = dead ? 0.5 : 0;
      for (const side of [-1, 1]) {
        const b = leaf.count;
        for (let i = 0; i <= n; i++) {
          const p = pts[i], t = i / n, tg = pts[Math.min(n, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(), sd = perp(tg), up = tg.clone().cross(sd).normalize();
          if (up.y < 0) up.negate();
          const w = 0.5 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.95) + 0.06, fold = sd.clone().multiplyScalar(side * w).addScaledVector(up, w * 0.35), wind = [swayAt(H, H) * 1.2 + t * L * 0.05, 0.6 + t * 0.4, r()];
          const nrm = up.clone().add(V(0, 0.5, 0)).normalize();
          leaf.vert(p, nrm, uv0 + 0.25, t, wind); leaf.vert(p.clone().add(fold), nrm, uv0 + 0.25 + side * 0.25, t, wind);
        }
        for (let i = 0; i < n; i++) { const a = b + i * 2; leaf.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    };
    const nf = Math.round(24 + r() * 8);
    for (let k = 0; k < nf; k++) frond(k * 2.4 + r() * 0.3, 1.1 - 1.3 * (k / nf) + (r() - 0.5) * 0.2, 4 + r() * 1.5, false);
    for (let k = 0; k < 10; k++) frond(k * 0.63 + r() * 0.3, -1.25 + (r() - 0.5) * 0.25, 2.8 + r(), true);      // the dry skirt
    return { bark, leaf, H: H + 2.5, R: 5.5, crown: crownC };
  },
  acacia(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), R0 = 0.16 + H * 0.02, split = 1.2 + r() * 1.2, top = H - 0.6, crownC = V(0, top, 0);
    tube(bark, [V(), V((r() - 0.5) * 0.3, split, (r() - 0.5) * 0.3)], [R0, R0 * 0.85], Math.max(5, Math.round(8 * d)), (t) => [swayAt(t * split, H), 0, r()]);
    const base = V(0, split, 0), limbs = 3 + Math.floor(r() * 3), CR = H * (0.85 + r() * 0.3);
    for (let k = 0; k < limbs; k++) {
      const yaw = k / limbs * 6.28 + r() * 0.6, out = CR * (0.35 + r() * 0.35), end = V(Math.sin(yaw) * out, top - 0.5 - r() * 0.8, Math.cos(yaw) * out);
      const mid = base.clone().lerp(end, 0.5).add(V(0, -0.4, 0)), pts = [base.clone(), base.clone().lerp(mid, 0.5), mid, mid.clone().lerp(end, 0.5), end];
      tube(bark, pts, pts.map((_, i) => R0 * 0.6 * (1 - i / 5)), Math.max(3, Math.round(5 * d)), (t) => [swayAt(split + t * (top - split), H), 0, r()]);
      for (let s = 0; s < 3; s++) { const e2 = end.clone().add(V((r() - 0.5) * CR * 0.5, 0.3 + r() * 0.4, (r() - 0.5) * CR * 0.5)); tube(bark, [end, e2], [R0 * 0.2, 0.02], 3, () => [swayAt(top, H, 1), 0, r()]); }
    }
    // the flat umbrella: overlapping, almost horizontal leaf cards in a thin layer
    const n = Math.round(130 * Math.min(1.3, d) * (CR / 8));
    for (let k = 0; k < n; k++) {
      const a = r() * 6.28, rr = Math.sqrt(r()) * CR, y = top + (r() - 0.5) * 1.5 - (rr / CR) ** 2 * 0.8, c = V(Math.sin(a) * rr, y, Math.cos(a) * rr), sz = 1.6 + r() * 0.8;
      const nd = V((r() - 0.5) * 1.4, 1, (r() - 0.5) * 1.4).normalize(), side = perp(nd), ax = nd.clone().cross(side).normalize();   // a layer about 1.5 m thick, the cards tilted every way
      card(leaf, c.clone().addScaledVector(ax, -sz / 2), ax, side, sz, sz, V(c.x / CR * 0.5, 1, c.z / CR * 0.5).normalize(), [swayAt(y, H, rr * 0.3), 1, r()]);
    }
    return { bark, leaf, H: H + 0.4, R: CR, crown: crownC };
  },
  juniper(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), crownC = V(0, H * 0.5, 0), W = H * (0.25 + r() * 0.35), stems = 4 + Math.floor(r() * 4);
    for (let k = 0; k < stems; k++) {
      const yaw = r() * 6.28, top = V(Math.sin(yaw) * W * 0.5, H * (0.7 + r() * 0.3), Math.cos(yaw) * W * 0.5);
      tube(bark, [V(Math.sin(yaw) * 0.08, 0, Math.cos(yaw) * 0.08), top.clone().multiplyScalar(0.5), top], [0.06, 0.04, 0.01], 3, (t) => [swayAt(t * top.y, H), 0, r()]);
    }
    const n = Math.round(26 * Math.min(1.3, d) * H / 3);
    for (let k = 0; k < n; k++) {
      const a = r() * 6.28, y = H * (0.08 + 0.9 * r()), rr = W * Math.sqrt(1 - ((y - H * 0.5) / (H * 0.55)) ** 2) * (0.5 + 0.5 * r()), c = V(Math.sin(a) * rr, y, Math.cos(a) * rr);
      tuft(leaf, c, 0.6 + r() * 0.5, c.clone().sub(crownC).add(V(0, H * 0.2, 0)).normalize(), [swayAt(y, H), 1, r()], r);
    }
    return { bark, leaf, H, R: W + 0.4, crown: crownC };
  },
  saltbush(r, H, d) {
    const bark = new Geo(), leaf = new Geo(), W = H * (0.9 + r() * 0.6), crownC = V(0, H * 0.3, 0), n = Math.round(34 * Math.min(1.3, d));
    for (let k = 0; k < n; k++) {
      const a = r() * 6.28, e = r() * 1.4, c = V(Math.sin(a) * Math.cos(e) * W, Math.sin(e) * H * 0.9 + 0.05, Math.cos(a) * Math.cos(e) * W).multiplyScalar(0.55 + 0.45 * r());
      tuft(leaf, c, 0.5 + r() * 0.4, c.clone().sub(crownC).add(V(0, 0.3, 0)).normalize(), [swayAt(c.y, H) + 0.03, 1, r()], r);
    }
    return { bark, leaf, H, R: W + 0.3, crown: crownC };
  },
};

// One plant: { bark, leaf: BufferGeometry, height, radius, crown } — size 0.4..1.2 scales a mature height within the species' range
function growPlant(id, { seed = 1, size = 1, detail = 1 } = {}) {
  const S = SPECIES[id], r = rng(seed * 7919 + id.length * 104729), H = (S.height[0] + (S.height[1] - S.height[0]) * r()) * size;
  const t0 = performance.now(), g = GROW[id](r, H, detail);
  return { bark: g.bark.count ? g.bark.build() : null, leaf: g.leaf.build(), height: g.H, radius: g.R, crown: g.crown, ms: performance.now() - t0 };
}

/* ---------------- materials and wind ---------------- */
function windUniforms() {
  return { uWind: { value: 0.5 }, uWindDir: { value: new THREE.Vector2(0.8, 0.6) }, uTime: { value: 0 }, uSeason: { value: 0 } };
}
// wind after the instance transform (world space), so instanced trees all bend downwind; gusts travel across the land
const WIND_VERT = /* glsl */`
  vec4 mvPosition = vec4(transformed, 1.0);
  float wsc = 1.0; vec3 ipos = vec3(0.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition; wsc = length(instanceMatrix[0].xyz); ipos = instanceMatrix[3].xyz;
#endif
  {
    vec2 wp = (modelMatrix * vec4(ipos, 1.0)).xz;
    float gust = 0.6 + 0.4 * sin(dot(wp, uWindDir) * 0.035 - uTime * 1.3) * sin(dot(wp, vec2(-uWindDir.y, uWindDir.x)) * 0.02 + uTime * 0.4);
    float sway = aWind.x * wsc * uWind * (gust + 0.25 * sin(uTime * 1.7 + aWind.z * 6.28 + wp.x * 0.1));
    mvPosition.xz += uWindDir * sway;
    mvPosition.y -= 0.15 * sway * sway / max(1.0, aWind.x * 20.0);
    float fl = aWind.y * uWind * 0.06 * wsc;                                  // leaves flutter
    mvPosition.xyz += vec3(sin(uTime * 7.0 + aWind.z * 40.0), sin(uTime * 9.0 + aWind.z * 23.0) * 0.6, cos(uTime * 8.0 + aWind.z * 31.0)) * fl;
  }
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
`;
function addWind(m, wu, leafy, extraFrag = '') {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wu);
    sh.vertexShader = 'attribute vec3 aWind;\nuniform float uWind, uTime, uSeason; uniform vec2 uWindDir;\nvarying float vPhase;\n' + sh.vertexShader
      .replace('#include <project_vertex>', WIND_VERT + 'vPhase = aWind.z;');
    if (leafy) sh.fragmentShader = 'uniform float uSeason;\nvarying float vPhase;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);   // foliage: shade by the crown\'s outward normal on both faces')
      .replace('#include <alphatest_fragment>', '  { vec2 tsz = vUv * 512.0; float lod = 0.5 * log2(max(dot(dFdx(tsz), dFdx(tsz)), dot(dFdy(tsz), dFdy(tsz)))); diffuseColor.a *= 1.0 + max(0.0, lod) * 0.28; }   // mipmaps thin the cut-out: keep its coverage\n#include <alphatest_fragment>')
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + extraFrag);
  };
  m.customProgramCacheKey = () => 'plant-' + (leafy ? 'leaf' : 'bark') + extraFrag.length;
}
// autumn: deciduous foliage turns yellow (birch) or russet (oak), each leaf cluster at its own pace
const AUTUMN = {
  birch: 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.66, 0.16) * (0.7 + 0.5 * dot(diffuseColor.rgb, vec3(1.0))), smoothstep(vPhase * 0.6, vPhase * 0.6 + 0.4, uSeason));',
  oak: 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.36, 0.14) * (0.7 + 0.5 * dot(diffuseColor.rgb, vec3(1.0))), smoothstep(vPhase * 0.6, vPhase * 0.6 + 0.4, uSeason));',
};
function plantMaterials(id, wu) {
  const S = SPECIES[id], bt = barkTexture(S.bark), lt = leafTexture(S.leaf);
  const bark = new THREE.MeshStandardMaterial({ map: bt, bumpMap: bt, bumpScale: 2.0, roughness: 0.92, metalness: 0 });
  const leaf = new THREE.MeshStandardMaterial({ map: lt, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.7 });
  addWind(bark, wu, false); addWind(leaf, wu, true, S.deciduous ? AUTUMN[id] : '');
  const depth = (map, alphaTest) => { const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest }); addWind(dm, wu, false); return dm; };
  return { bark, leaf, barkDepth: depth(null, 0), leafDepth: depth(lt, 0.42) };
}

// ForestKit: many plants at once, cheaply. Builds on PlantKit (single plants) and LandKit (terrain).
//  bakeImpostors(renderer, id)  renders a few variants of a species from 8 sides into two atlases — colour with the
//                               cut-out, and the object-space normal — so a far tree is one camera-facing quad that is
//                               still lit by the sun from the right side (the view picks and blends the two nearest frames)
//  Forest                       placements → instanced near meshes (full models, wind, shadows) and instanced impostors
//                               beyond the LOD distance, re-sorted a few times a second; one draw call per species and part
//  grassField(...)              blades of grass in tufts on a tile that follows the camera (the tile wraps, so the
//                               grass never runs out), standing on LandKit's height texture, thinned by biome, slope,
//                               water and height, swaying in travelling gusts; fades out at its radius
// Lighting for the impostors and the grass comes from plantLight() (sun, sky, ground, fog) — the lab copies SkyKit's
// light into it each time the sky changes.

function plantLight() {
  return {
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
    uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, uGroundCol: { value: new THREE.Color(0.2, 0.2, 0.15) },
    uFogCol: { value: new THREE.Color(0.8, 0.85, 0.9) }, uFogNear: { value: 400 }, uFogFar: { value: 2600 }, uGain: { value: 1 },
  };
}
const LIGHT_GLSL = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uFogCol; uniform float uFogNear, uFogFar, uGain, uMatGain;
vec3 plantLit(vec3 alb, vec3 n, float wrap) {
  float nl = max(0.0, (dot(n, uSunDir) + wrap) / (1.0 + wrap));
  vec3 amb = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5);
  return alb * (uSunCol * nl + amb) * uGain * uMatGain;
}
vec3 plantFog(vec3 c, float d) { return mix(c, uFogCol, smoothstep(uFogNear, uFogFar, d)); }
`;

/* ---------------- impostors ---------------- */
const IMP_VIEWS = 8;
const NORMAL_BAKE = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 } }, side: THREE.DoubleSide,
  vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vN = normal; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D map; uniform float useMap; varying vec3 vN; varying vec2 vUv; void main(){ if (useMap > 0.5 && texture2D(map, vUv).a < 0.42) discard; gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0); }',
});
function bakeImpostors(renderer, id, { variants = 3, cell = 256, seed0 = 1 } = {}) {
  const S = SPECIES[id], views = IMP_VIEWS, plants = [];
  for (let v = 0; v < variants; v++) plants.push(growPlant(id, { seed: seed0 + v, size: 1, detail: 0.75 }));
  let W = 0, Hb = 0;
  for (const p of plants) for (const g of [p.bark, p.leaf]) if (g) { const b = g.boundingBox; W = Math.max(W, -b.min.x, b.max.x, -b.min.z, b.max.z); Hb = Math.max(Hb, b.max.y); }
  W = W * 2 * 1.04; Hb *= 1.03;
  const mk = () => new THREE.WebGLRenderTarget(cell * views, cell * variants, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const rtA = mk(), rtN = mk();
  const bt = barkTexture(S.bark), lt = leafTexture(S.leaf);
  const albedo = [new THREE.MeshBasicMaterial({ map: bt }), new THREE.MeshBasicMaterial({ map: lt, alphaTest: 0.42, side: THREE.DoubleSide })];
  const normal = [NORMAL_BAKE(null), NORMAL_BAKE(lt)];
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-W / 2, W / 2, Hb / 2, -Hb / 2, 0.1, W * 4 + 10);
  const prev = { rt: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, sc: renderer.getScissorTest() };
  renderer.autoClear = false;
  for (const [rt, mats, clear] of [[rtA, albedo, 0x26301a], [rtN, normal, 0x7f7f7f]]) {
    renderer.setClearColor(clear, 0); rt.scissorTest = true;
    plants.forEach((p, v) => {
      scene.clear();
      if (p.bark) scene.add(new THREE.Mesh(p.bark, mats[0]));
      scene.add(new THREE.Mesh(p.leaf, mats[1]));
      for (let k = 0; k < views; k++) {
        const a = k / views * Math.PI * 2;
        cam.position.set(Math.sin(a) * W * 2, Hb / 2, Math.cos(a) * W * 2); cam.lookAt(0, Hb / 2, 0); cam.updateMatrixWorld();
        rt.viewport.set(k * cell, v * cell, cell, cell); rt.scissor.set(k * cell, v * cell, cell, cell);   // a render target keeps its own viewport
        renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
      }
    });
  }
  for (const rt of [rtA, rtN]) { rt.viewport.set(0, 0, rt.width, rt.height); rt.scissor.set(0, 0, rt.width, rt.height); rt.scissorTest = false; }
  renderer.setRenderTarget(prev.rt); renderer.setClearColor(prev.clear, prev.alpha); renderer.autoClear = prev.autoClear;
  albedo.forEach((m) => m.dispose()); normal.forEach((m) => m.dispose());
  return { albedo: rtA.texture, normal: rtN.texture, W, H: Hb, variants, views, plants, targets: [rtA, rtN] };
}
function impostorMaterial(imp, L) {
  return new THREE.ShaderMaterial({
    // uMatGain: a crown seen whole is darker inside than its baked colour (self-shadowing the bake does not see)
    uniforms: { ...L, uMatGain: { value: 0.72 }, tA: { value: imp.albedo }, tN: { value: imp.normal }, uImp: { value: new THREE.Vector4(imp.W, imp.H, imp.variants, imp.views) } },
    vertexShader: /* glsl */`
      attribute vec3 aImp;                       // yaw, variant, scale
      uniform vec4 uImp;
      varying vec2 vUv; varying float vVar, vAng, vYaw, vDist;
      void main() {
        vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 tc = normalize(cameraPosition.xz - c.xz + vec2(1e-4, 0.0));
        vec3 right = vec3(tc.y, 0.0, -tc.x);
        vec3 wp = c + right * position.x * uImp.x * aImp.z + vec3(0.0, (position.y + 0.5) * uImp.y * aImp.z, 0.0);
        vUv = position.xy + 0.5; vVar = aImp.y; vYaw = aImp.x; vAng = atan(tc.x, tc.y) - aImp.x; vDist = length(cameraPosition - wp);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tA, tN; uniform vec4 uImp;
      varying vec2 vUv; varying float vVar, vAng, vYaw, vDist;
      ${LIGHT_GLSL}
      void main() {
        float f = mod(vAng / 6.2831853 * uImp.w, uImp.w), i0 = floor(f), i1 = mod(i0 + 1.0, uImp.w), t = f - i0;
        vec2 cellUv = vec2(clamp(vUv.x, 0.01, 0.99), clamp(vUv.y, 0.01, 0.99));
        vec2 a0 = vec2((i0 + cellUv.x) / uImp.w, (vVar + cellUv.y) / uImp.z), a1 = vec2((i1 + cellUv.x) / uImp.w, (vVar + cellUv.y) / uImp.z);
        vec4 c0 = texture2D(tA, a0), c1 = texture2D(tA, a1);
        vec4 col = mix(c0, c1, t);
        if (col.a < 0.5) discard;
        vec3 n = mix(texture2D(tN, a0).xyz, texture2D(tN, a1).xyz, t) * 2.0 - 1.0;
        float cy = cos(vYaw), sy = sin(vYaw);
        n = normalize(vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy));
        vec3 lit = plantLit(col.rgb, n, 0.35);
        gl_FragColor = vec4(plantFog(lit, vDist), 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
}

/* ---------------- a forest: near meshes + far impostors ---------------- */
class Forest {
  constructor(renderer, scene, { wind = windUniforms(), light = plantLight(), variants = 3, nearCap = 900 } = {}) {
    Object.assign(this, { renderer, scene, wind, light, variants, nearCap, kinds: {}, list: [], nearDist: 110, impostors: true, group: new THREE.Group(), counts: { near: 0, far: 0 } });
    this.group.name = 'forest'; scene.add(this.group);
  }
  // one species ready: its variants as full models (instanced) and its impostor atlas
  kind(id) {
    if (this.kinds[id]) return this.kinds[id];
    const imp = bakeImpostors(this.renderer, id, { variants: this.variants }), mats = plantMaterials(id, this.wind);
    const near = imp.plants.map((p) => {
      const parts = [];
      for (const [g, m, dm] of [[p.bark, mats.bark, mats.barkDepth], [p.leaf, mats.leaf, mats.leafDepth]]) {
        if (!g) continue;
        const im = new THREE.InstancedMesh(g, m, this.nearCap); im.customDepthMaterial = dm; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.count = 0;
        this.group.add(im); parts.push(im);
      }
      return parts;
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    const far = new THREE.InstancedMesh(quad, impostorMaterial(imp, this.light), 1); far.frustumCulled = false; far.count = 0;
    this.group.add(far);
    return (this.kinds[id] = { imp, mats, near, far, cap: 0 });
  }
  // placements: [{ id, x, y, z, yaw, s, v }] (v: variant index)
  set(list) {
    this.list = list;
    const by = {};
    for (const p of list) (by[p.id] ||= []).push(p);
    for (const [id, K] of Object.entries(this.kinds)) { K.far.count = 0; K.near.forEach((parts) => parts.forEach((m) => { m.count = 0; })); }
    for (const [id, ps] of Object.entries(by)) {
      const K = this.kind(id);
      if (K.cap < ps.length) {                                         // grow the impostor buffer
        this.group.remove(K.far); K.far.dispose();
        const far = new THREE.InstancedMesh(K.far.geometry, K.far.material, ps.length); far.frustumCulled = false;
        far.geometry.setAttribute('aImp', new THREE.InstancedBufferAttribute(new Float32Array(ps.length * 3), 3));
        this.group.add(far); K.far = far; K.cap = ps.length;
      }
    }
    this.by = by; this.dirty = true;
  }
  // re-sort near / far around the camera (call a few times a second)
  update(camera) {
    if (!this.by) return;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const cx = camera.position.x, cz = camera.position.z, nd2 = this.nearDist * this.nearDist;
    let nN = 0, nF = 0;
    for (const [id, ps] of Object.entries(this.by)) {
      const K = this.kinds[id], ai = K.far.geometry.getAttribute('aImp'), nc = K.near.map(() => 0);
      let f = 0;
      for (const p of ps) {
        const d2 = (p.x - cx) ** 2 + (p.z - cz) ** 2;
        const near = !this.impostors || d2 < nd2;
        if (near && nc[p.v] < this.nearCap) {
          Q.setFromAxisAngle(Y, p.yaw); M.compose(P.set(p.x, p.y, p.z), Q, S3.set(p.s, p.s, p.s));
          for (const m of K.near[p.v]) m.setMatrixAt(nc[p.v], M);
          nc[p.v]++; nN++;
        } else if (!near || this.impostors) {
          M.makeTranslation(p.x, p.y - 0.15 * p.s, p.z); K.far.setMatrixAt(f, M); ai.setXYZ(f, p.yaw, p.v, p.s); f++; nF++;
        }
      }
      K.near.forEach((parts, v) => parts.forEach((m) => { m.count = nc[v]; m.instanceMatrix.needsUpdate = true; }));
      K.far.count = f; K.far.instanceMatrix.needsUpdate = true; ai.needsUpdate = true;
    }
    this.counts = { near: nN, far: nF };
  }
  dispose() {
    for (const K of Object.values(this.kinds)) { K.imp.targets.forEach((t) => t.dispose()); K.far.material.dispose(); K.near.forEach((ps) => ps.forEach((m) => m.dispose())); }
    this.scene.remove(this.group); this.kinds = {};
  }
}


  return { SPECIES, growPlant, plantMaterials, windUniforms, plantLight, bakeImpostors, impostorMaterial, Forest, rng };
})();
