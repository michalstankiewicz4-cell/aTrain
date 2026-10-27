// ===================== Ląd: mapa wysokości wspólna dla fizyki i grafiki =====================
// Szum, erozja kroplowa i zasady kształtowania terenu przeniesione z laboratorium lądu (repo Battle, LandKit),
// dopasowane do skali toru: morze na południu za skarpą, wysoka góra w środku owalu, dalej łagodne wzgórza.
// Jednostki: metry; y = 0 to główka szyny, formacja pod torem leży na −0,45 m (jak w fizyce).
const LAND = (function () {
  'use strict';
  const SEA = -15;                    // poziom morza: skarpa ok. 14,5 m nad wodą
  const FORM = -0.45;                 // grunt pod podsypką (GROUND_Y w fizyce)
  const C = 2, N = 800, SIZE = N * C; // siatka 1600 × 1600 m co 2 m
  const X0 = -670, Z0 = -560;         // róg mapy (tor leży w x −97…349, z −50…50)
  const M = N + 1;
  let H = null, D = null, S = null;   // wysokości, odległość od osi toru, odległość od linii brzegu

  /* ---- szum gradientowy okresowy i fbm (LandKit) ---- */
  function hash2(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function pnoise(x, y, P, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const g = (ix, iy, dx, dy) => { const a = hash2(((ix % P) + P) % P, ((iy % P) + P) % P, seed) * Math.PI * 2; return Math.cos(a) * dx + Math.sin(a) * dy; };
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const n00 = g(x0, y0, fx, fy), n10 = g(x0 + 1, y0, fx - 1, fy), n01 = g(x0, y0 + 1, fx, fy - 1), n11 = g(x0 + 1, y0 + 1, fx - 1, fy - 1);
    return 1.41 * ((n00 + (n10 - n00) * u) + ((n01 + (n11 - n01) * u) - (n00 + (n10 - n00) * u)) * v);
  }
  function fbm(u, v, F, oct, pers, seed, ridged = false) {
    let s = 0, a = 1, norm = 0, f = F, prev = 1;
    for (let i = 0; i < oct; i++) {
      let n = pnoise(u * f, v * f, f, seed + i * 101);
      if (ridged) { n = 1 - Math.abs(n); n = n * n * prev; prev = Math.min(1, n * 1.6); n = n * 2 - 0.6; }
      s += n * a; norm += a; a *= pers; f *= 2;
    }
    return s / norm;
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---- erozja kroplowa (LandKit) na wycinku mapy ---- */
  function erode(Hw, W, Hh, drops, seed) {
    let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const at = (x, y) => Hw[Math.min(Hh - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    const add = (x, y, v) => { if (x < 0 || y < 0 || x >= W || y >= Hh) return; Hw[y * W + x] += v; };
    const grad = (px, py) => {
      const x = Math.floor(px), y = Math.floor(py), u = px - x, v = py - y;
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      return [(b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u, a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v];
    };
    const inertia = 0.05, capK = 4, minCap = 0.01, dep = 0.3, ero = 0.3, evap = 0.02, gravity = 4;
    for (let i = 0; i < drops; i++) {
      let px = rnd() * W, py = rnd() * Hh, dx = 0, dy = 0, sp = 1, water = 1, sed = 0;
      for (let k = 0; k < 40; k++) {
        const x = Math.floor(px), y = Math.floor(py), u = px - x, v = py - y;
        const [gx, gy, h0] = grad(px, py);
        dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
        const l = Math.hypot(dx, dy); if (l < 1e-9) break; dx /= l; dy /= l;
        px += dx; py += dy;
        if (px < 0 || py < 0 || px >= W - 1 || py >= Hh - 1) break;
        const h1 = grad(px, py)[2], dh = h1 - h0;
        const cap = Math.max(-dh * sp * water * capK, minCap);
        if (sed > cap || dh > 0) {
          const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * dep; sed -= amt;
          add(x, y, amt * (1 - u) * (1 - v)); add(x + 1, y, amt * u * (1 - v)); add(x, y + 1, amt * (1 - u) * v); add(x + 1, y + 1, amt * u * v);
        } else {
          const amt = Math.min((cap - sed) * ero, -dh); sed += amt;
          add(x, y, -amt * (1 - u) * (1 - v)); add(x + 1, y, -amt * u * (1 - v)); add(x, y + 1, -amt * (1 - u) * v); add(x + 1, y + 1, -amt * u * v);
        }
        sp = Math.sqrt(Math.max(0, sp * sp + dh * -gravity)); water *= 1 - evap;
      }
    }
  }

  /* ---- linia brzegu: skarpa wzdłuż toru, dalej brzeg skręca na północ ---- */
  function coastZ(x, seed) {
    const u = (x - X0) / SIZE;
    return -88 + 6 * fbm(u, 0.31, 9, 4, 0.5, seed + 21)
      + 0.0025 * Math.max(0, -150 - x) ** 2 + 0.002 * Math.max(0, x - 450) ** 2;
  }
  // 1 = wysoka skarpa (przy torze), 0 = niski brzeg z plażą
  const cliffness = x => sm(-260, -140, x) * (1 - sm(430, 560, x));

  function generate(sim, seed = 7) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    H = new Float32Array(M * M); D = new Float32Array(M * M); S = new Float32Array(M * M);
    const hl = sim.TRACK.hl;
    const zc = new Float32Array(M), cf = new Float32Array(M), cw = new Float32Array(M);
    for (let i = 0; i < M; i++) { const x = X0 + i * C; zc[i] = coastZ(x, seed); cf[i] = cliffness(x); cw[i] = 7 + 3 * fbm((x - X0) / SIZE, 0.77, 14, 3, 0.5, seed + 23); }
    for (let j = 0; j < M; j++) {
      const z = Z0 + j * C, v = j / N;
      for (let i = 0; i < M; i++) {
        const x = X0 + i * C, u = i / N, k = j * M + i;
        const dt = sim.distToTrack(x, z); D[k] = dt;
        // łagodny ląd: przy torze prawie płasko, dalej wzgórza (bez zagłębień poniżej morza — bez jezior)
        const far = sm(40, 420, dt);
        let h = FORM + (0.8 + 6 * far) * fbm(u, v, 5, 5, 0.5, seed) + 12 * far * (0.5 + 0.5 * fbm(u, v, 2, 3, 0.5, seed + 3));
        // góra w środku owalu: podstawa jak stadion (odległość od odcinka między środkami łuków), stopa 14 m od osi toru
        const dm = Math.hypot(Math.max(Math.abs(x) - hl, 0), z), t = 1 - dm / 36;
        if (t > 0) {
          const along = x / hl, ridge = 0.74 + 0.26 * Math.cos(Math.PI * Math.max(-1, Math.min(1, along + 0.3)));
          const det = fbm(u, v, 40, 4, 0.5, seed + 11, true);
          h += 84 * Math.pow(t, 1.45) * ridge * (0.84 + 0.2 * det);
        }
        // brzeg: skarpa i dno morza
        const s = z - zc[i]; S[k] = s;
        if (s < 60) {
          const c = cf[i];
          const lowT = SEA + 1.2 + Math.max(0, s) * 0.15, top = h - (1 - c) * Math.max(0, h - lowT);
          if (s > 0) {
            const w = cw[i], q = s / w;
            h = q >= 1 ? top : SEA + 1.0 + (top - SEA - 1.0) * Math.pow(sm(0.12, 0.9, q), 0.8) + 0.8 * c * fbm(u, v, 160, 3, 0.5, seed + 31) * (1 - Math.abs(2 * q - 1));
          } else {
            h = s > -10 ? SEA + 1.0 + s * 0.18 : SEA - 0.8 - 26 * sm(-10, -260, s) + 1.2 * fbm(u, v, 30, 3, 0.5, seed + 41);
          }
        }
        // brzeg mapy: ląd schodzi do morza
        const edge = Math.min(i, N - i, j, N - j) * C, fall = sm(30, 170, edge);
        if (fall < 1) h = SEA - 25 + (h - SEA + 25) * fall;
        // tor: formacja dokładnie na −0,45 m, przejście w teren do 14 m od osi
        H[k] = FORM + (h - FORM) * sm(2.6, 14, dt);
      }
    }
    // erozja kroplowa na górze (żleby i stożki usypiskowe); tor nietknięty
    {
      const i0 = Math.floor((-hl - 40 - X0) / C), i1 = Math.ceil((hl + 40 - X0) / C), j0 = Math.floor((-42 - Z0) / C), j1 = Math.ceil((42 - Z0) / C);
      const W = i1 - i0 + 1, Hh = j1 - j0 + 1, SC = 60, w = new Float32Array(W * Hh);
      for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) w[j * W + i] = H[(j0 + j) * M + i0 + i] / SC;
      const before = Float32Array.from(w);
      erode(w, W, Hh, Math.round(W * Hh * 1.2), seed + 99);
      for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
        const k = (j0 + j) * M + i0 + i, m = sm(15, 24, D[k]);
        H[k] += (w[j * W + i] - before[j * W + i]) * SC * m;
      }
    }
    const ms = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - t0);
    return { ms };
  }

  /* ---- próbkowanie (dwuliniowe, jak siatka w grafice) ---- */
  function bil(A, x, z, out) {
    const fx = (x - X0) / C, fz = (z - Z0) / C;
    if (!(fx >= 0 && fz >= 0 && fx < N && fz < N)) return out;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * M + i;
    return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + M] * (1 - u) + A[k + M + 1] * u) * v;
  }
  const height = (x, z) => bil(H, x, z, SEA - 40);
  const trackDist = (x, z) => bil(D, x, z, 1e4);
  const shoreDist = (x, z) => bil(S, x, z, -1e4);
  function normal(x, z, o) {
    const e = 1.0, hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); o[0] = -hx / l; o[1] = 2 * e / l; o[2] = -hz / l; return o;
  }
  return {
    SEA, FORM, X0, Z0, C, N, SIZE, M, generate, height, trackDist, shoreDist, normal, fbm,
    get H() { return H; },
  };
})();
if (typeof module !== 'undefined') module.exports = LAND;
