// ===== Fizyka pociągu: bryły sztywne, kontakt koło–szyna, zawieszenie, sprzęgi, zderzaki =====
const PHYS = (function () {
  const G = 9.81;
  const H = 1 / 2400;                 // krok fizyki [s]
  const R_CURVE = 50;                 // promień łuku osi toru [m]
  const RAIL_HALF = 0.7535;           // oś szyny od osi toru (1435/2 + 72/2 mm)
  const BTB = 0.68;                   // połowa rozstawu wewnętrznych powierzchni kół (1360 mm)
  const SLEEPER_TOP = -0.172;         // wierzch podkładu (główka szyny = 0)
  const BUF_EXT = 0.62;               // wysięg zderzaka od czołownicy
  const BUF_Y = 1.06, BUF_Z = 0.875;  // wysokość i rozstaw zderzaków
  const HOOK_EXT = 0.30;              // wysięg haka cięgłowego
  const SLACK = 0.02;                 // luz sprzęgu [m]
  const MU_RAIL = 0.33, MU_GROUND = 0.5, MU_BUFFER = 0.15;
  const K_LINE = 5e9, C_LINE = 1.5e7; // sztywność/tłumienie kontaktu na metr szerokości profilu

  // Profil koła: a = odległość od wewnętrznej powierzchni koła [m], δ = r − r_nom [m]
  const PROFILE = [[0, 0.012], [0.003, 0.020], [0.008, 0.026], [0.014, 0.028], [0.020, 0.026], [0.025, 0.020],
    [0.029, 0.013], [0.033, 0.007], [0.037, 0.003], [0.042, 0.0014], [0.135, -0.00325]];
  function profileDelta(a) {
    for (let i = 1; i < PROFILE.length; i++) {
      if (a <= PROFILE[i][0]) {
        const [a0, d0] = PROFILE[i - 1], [a1, d1] = PROFILE[i];
        return d0 + (d1 - d0) * (a - a0) / (a1 - a0);
      }
    }
    return PROFILE[PROFILE.length - 1][1];
  }
  const SAMPLES = [];
  for (let a = 0; a <= 0.0421; a += 0.002) SAMPLES.push({ a, da: 0.002 });
  for (let a = 0.048; a <= 0.1351; a += 0.006) SAMPLES.push({ a, da: 0.006 });
  SAMPLES.forEach(s => s.d = profileDelta(s.a));

  // ---- Profil szyny (przekrój u: na zewnątrz toru +, v: w górę), SDF ----
  function sdRoundBox(px, py, bx, by, r) {
    const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r;
    const mx = Math.max(qx, 0), my = Math.max(qy, 0);
    return Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function railSdf(u, v) {
    const vc = v + u * u / 0.6;                        // korona główki R=300 mm
    const head = sdRoundBox(u, vc + 0.019, 0.036, 0.019, 0.012);
    if (v > -0.034) return head;                       // nad szyjką liczy się tylko główka
    const web = sdRoundBox(u, v + 0.1, 0.008, 0.065, 0.003);
    const foot = sdRoundBox(u, v + 0.163, 0.075, 0.009, 0.003);
    return Math.min(head, web, foot);
  }

  // ---- Geometria toru: owal (prosta, łuk 180°, prosta, łuk 180°) ----
  const TRACK = { R: R_CURVE, Ls: 0, hl: 0, L: 0 };
  function setTrack(Ls) { TRACK.Ls = Ls; TRACK.hl = Ls / 2; TRACK.L = 2 * Ls + 2 * Math.PI * R_CURVE; }
  const TP = { cx: 0, cz: 0, tx: 0, tz: 0, nx: 0, nz: 0 };
  function closest(x, z) {   // najbliższy punkt osi toru; n = kierunek do wnętrza owalu
    const hl = TRACK.hl, R = R_CURVE;
    if (x > hl || x < -hl) {
      const ox = x > hl ? hl : -hl;
      let dx = x - ox, dz = z; const d = Math.hypot(dx, dz) || 1e-9; dx /= d; dz /= d;
      TP.cx = ox + R * dx; TP.cz = R * dz; TP.tx = -dz; TP.tz = dx;
    } else if (z < 0) { TP.cx = x; TP.cz = -R; TP.tx = 1; TP.tz = 0; }
    else { TP.cx = x; TP.cz = R; TP.tx = -1; TP.tz = 0; }
    TP.nx = -TP.tz; TP.nz = TP.tx;
    return TP;
  }
  function trackAt(s) {      // punkt po długości toru
    const { Ls, hl } = TRACK, R = R_CURVE, A = Math.PI * R;
    s = ((s % TRACK.L) + TRACK.L) % TRACK.L;
    let px, pz, tx, tz;
    if (s < Ls) { px = -hl + s; pz = -R; tx = 1; tz = 0; }
    else if (s < Ls + A) { const th = -Math.PI / 2 + (s - Ls) / R; px = hl + R * Math.cos(th); pz = R * Math.sin(th); tx = -Math.sin(th); tz = Math.cos(th); }
    else if (s < 2 * Ls + A) { px = hl - (s - Ls - A); pz = R; tx = -1; tz = 0; }
    else { const th = Math.PI / 2 + (s - 2 * Ls - A) / R; px = -hl + R * Math.cos(th); pz = R * Math.sin(th); tx = -Math.sin(th); tz = Math.cos(th); }
    return { px, pz, tx, tz, nx: -tz, nz: tx };
  }

  // ---- Bryła sztywna ----
  class Body {
    constructor(m, Ix, Iy, Iz) {
      this.p = [0, 0, 0]; this.v = [0, 0, 0]; this.w = [0, 0, 0]; this.q = [1, 0, 0, 0];
      this.f = [0, 0, 0]; this.t = [0, 0, 0];
      this.R = new Float64Array(9); this.iIw = new Float64Array(9);
      this.setMass(m, Ix, Iy, Iz);
    }
    setMass(m, Ix, Iy, Iz) { this.m = m; this.im = 1 / m; this.I = [Ix, Iy, Iz]; this.iI = [1 / Ix, 1 / Iy, 1 / Iz]; this.update(); }
    update() {
      const [w, x, y, z] = this.q, R = this.R;
      R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
      R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
      R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
      const iI = this.iI, M = this.iIw;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        M[i * 3 + j] = R[i * 3] * iI[0] * R[j * 3] + R[i * 3 + 1] * iI[1] * R[j * 3 + 1] + R[i * 3 + 2] * iI[2] * R[j * 3 + 2];
    }
    toWorld(lx, ly, lz, o) { const R = this.R, p = this.p;
      o[0] = p[0] + R[0] * lx + R[1] * ly + R[2] * lz; o[1] = p[1] + R[3] * lx + R[4] * ly + R[5] * lz; o[2] = p[2] + R[6] * lx + R[7] * ly + R[8] * lz; return o; }
    dirWorld(lx, ly, lz, o) { const R = this.R;
      o[0] = R[0] * lx + R[1] * ly + R[2] * lz; o[1] = R[3] * lx + R[4] * ly + R[5] * lz; o[2] = R[6] * lx + R[7] * ly + R[8] * lz; return o; }
    dirLocal(x, y, z, o) { const R = this.R;
      o[0] = R[0] * x + R[3] * y + R[6] * z; o[1] = R[1] * x + R[4] * y + R[7] * z; o[2] = R[2] * x + R[5] * y + R[8] * z; return o; }
    velAt(P, o) { const rx = P[0] - this.p[0], ry = P[1] - this.p[1], rz = P[2] - this.p[2], w = this.w, v = this.v;
      o[0] = v[0] + w[1] * rz - w[2] * ry; o[1] = v[1] + w[2] * rx - w[0] * rz; o[2] = v[2] + w[0] * ry - w[1] * rx; return o; }
    addForceAt(fx, fy, fz, P) { const rx = P[0] - this.p[0], ry = P[1] - this.p[1], rz = P[2] - this.p[2];
      this.f[0] += fx; this.f[1] += fy; this.f[2] += fz;
      this.t[0] += ry * fz - rz * fy; this.t[1] += rz * fx - rx * fz; this.t[2] += rx * fy - ry * fx; }
    mulIw(x, y, z, o) { const M = this.iIw; o[0] = M[0] * x + M[1] * y + M[2] * z; o[1] = M[3] * x + M[4] * y + M[5] * z; o[2] = M[6] * x + M[7] * y + M[8] * z; return o; }
    invMassAt(P, nx, ny, nz) { const rx = P[0] - this.p[0], ry = P[1] - this.p[1], rz = P[2] - this.p[2];
      const cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx; const o = this.mulIw(cx, cy, cz, T3);
      return this.im + cx * o[0] + cy * o[1] + cz * o[2]; }
    impulseAt(jx, jy, jz, P) { const rx = P[0] - this.p[0], ry = P[1] - this.p[1], rz = P[2] - this.p[2];
      this.v[0] += jx * this.im; this.v[1] += jy * this.im; this.v[2] += jz * this.im;
      const o = this.mulIw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, T3); this.w[0] += o[0]; this.w[1] += o[1]; this.w[2] += o[2]; }
    angImpulse(lx, ly, lz) { const o = this.mulIw(lx, ly, lz, T3); this.w[0] += o[0]; this.w[1] += o[1]; this.w[2] += o[2]; }
    integrateVel(dt) {
      const im = this.im, v = this.v, f = this.f, w = this.w;
      v[0] += f[0] * im * dt; v[1] += (f[1] * im - G) * dt; v[2] += f[2] * im * dt;
      // moment żyroskopowy: τ − ω × (I ω)
      const l = this.dirLocal(w[0], w[1], w[2], T3b); const Lw = this.dirWorld(l[0] * this.I[0], l[1] * this.I[1], l[2] * this.I[2], T3c);
      const tx = this.t[0] - (w[1] * Lw[2] - w[2] * Lw[1]), ty = this.t[1] - (w[2] * Lw[0] - w[0] * Lw[2]), tz = this.t[2] - (w[0] * Lw[1] - w[1] * Lw[0]);
      const a = this.mulIw(tx, ty, tz, T3); w[0] += a[0] * dt; w[1] += a[1] * dt; w[2] += a[2] * dt;
      f[0] = f[1] = f[2] = 0; this.t[0] = this.t[1] = this.t[2] = 0;
    }
    integratePos(dt) {
      const p = this.p, v = this.v, w = this.w, q = this.q;
      p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
      const [qw, qx, qy, qz] = q, h = 0.5 * dt;
      q[0] += h * (-w[0] * qx - w[1] * qy - w[2] * qz);
      q[1] += h * (w[0] * qw + w[1] * qz - w[2] * qy);
      q[2] += h * (w[1] * qw + w[2] * qx - w[0] * qz);
      q[3] += h * (w[2] * qw + w[0] * qy - w[1] * qx);
      const n = Math.hypot(q[0], q[1], q[2], q[3]); q[0] /= n; q[1] /= n; q[2] /= n; q[3] /= n;
      this.update();
    }
  }
  const T3 = [0, 0, 0], T3b = [0, 0, 0], T3c = [0, 0, 0];

  // ---- Definicje pojazdów ----
  const WS_MASS = 1200, WS_I = [600, 600, 80];
  const VEH = {
    loco: { Lb: 9.0, wb: 4.6, comY: 1.45, Rw: 0.5, mass: 18000, dims: [9, 2.6, 3.0], kv: 1.3e6, kl: 1.5e6, kx: 6e6, driven: true },
    wagon: { Lb: 9.4, wb: 5.6, comY: 1.75, Rw: 0.46, mass: 12000, dims: [9.4, 2.8, 2.9], kv: 1.2e6, kl: 1.2e6, kx: 5e6, driven: false },
  };
  const SPRING_LEQ = 0.35, BUMP = 0.08, REBOUND = 0.10;
  function bodyInertia(m, d) { const [L, Hh, W] = d; return [m / 12 * (Hh * Hh + W * W), m / 12 * (L * L + W * W), m / 12 * (L * L + Hh * Hh)]; }

  function createSim() {
    const trainLen = VEH.loco.Lb + 2 * VEH.wagon.Lb + 6 * BUF_EXT;
    setTrack(3 * trainLen);
    const Lext = (2 * TRACK.Ls + 2 * Math.PI * R_CURVE) / 2;   // pętla przez przedłużenie = 2× obecny owal
    const tb = buildTrack(TRACK.hl, R_CURVE, Lext);
    const track = { base: tb.base, geo: tb.geo, Lext, gap: 0.025, version: 0,
      switches: [{ pos: 0, target: 0 }, { pos: 0, target: 0 }] };   // 0 = łuk (obecny owal), 1 = prosto (przedłużenie)
    // szczelina na stykach: przebudowa szyn w fizyce (te same odcinki rysuje grafika)
    track.setGap = g => {
      const sp = splitRails(track.base, g); track.pieces = sp.pieces; track.joints = sp.joints; track.grid = buildGrid(sp.pieces);
      track.gap = g; track.version++;
    };
    track.setGap(track.gap);
    const terrain = buildTerrain(TRACK.hl, R_CURVE, Lext);
    const sim = {
      H, t: 0, nc: 0, events: [], track, terrain, SL, btb: BTB, pieceSdf, pieceLocal, vehicles: [], bodies: [], couplers: [], buffers: [], contacts: [], joints: [],
      ctrl: { target: 0, brake: false, lock: false, power: 200000 },
      groundH: null,                                   // wysokość terenu poza torem (x, z) → y; null = płasko
      distToTrack: (x, z) => distToRoutes(x, z, TRACK.hl, R_CURVE, Lext),
      st: { brakeP: 0, F: 0, integ: 0, speed: 0 },
      trainLen, TRACK, SAMPLES, PROFILE, profileDelta, trackAt, railSdf, RAIL_HALF, BTB, SLEEPER_TOP,
      BUF_EXT, BUF_Y, BUF_Z, HOOK_EXT, SPRING_LEQ,
    };
    const types = ['loco', 'wagon', 'wagon'];
    let xFront = -TRACK.hl + 50; // przód lokomotywy (czoło zderzaka)
    const z0 = -R_CURVE;
    types.forEach((type, i) => {
      const d = VEH[type];
      const xc = xFront - BUF_EXT - d.Lb / 2;
      xFront = xc - d.Lb / 2 - BUF_EXT;
      const I = bodyInertia(d.mass, d.dims);
      const body = new Body(d.mass, I[0], I[1], I[2]);
      body.p = [xc, d.comY, z0];
      const veh = { type, def: d, body, ws: [], springs: [], massT: d.mass / 1000, idx: i };
      // zawieszenie projektowane dla masy nominalnej (ugięcie przy masie nominalnej)
      const L0 = SPRING_LEQ + d.mass * G / 4 / d.kv;
      for (const sx of [1, -1]) {
        const ws = new Body(WS_MASS, WS_I[0], WS_I[1], WS_I[2]);
        ws.p = [xc + sx * d.wb / 2, d.Rw + 0.0005, z0];
        ws.v[0] = 0; ws.Rw = d.Rw; ws.veh = veh;
        veh.ws.push(ws); sim.bodies.push(ws);
        for (const sz of [1, -1]) {
          veh.springs.push({ ws, ax: sx * d.wb / 2, ay: d.Rw + SPRING_LEQ - d.comY, az: sz * 1.0, wz: sz * 1.0, L0,
            k: [d.kx, d.kv, d.kl], c: [4e4, 2 * 0.25 * Math.sqrt(d.kv * d.mass / 4), 2.5e4], len: SPRING_LEQ });
        }
        sim.joints.push({ ws, body, L: 0 });
      }
      sim.bodies.push(body); sim.vehicles.push(veh);
    });
    // zderzaki boczne między kolejnymi pojazdami; sprzęgi: kłowy (lok–W1) i łańcuch na haku (W1–W2)
    sim.couplers.push(makeKnuckleJoint(sim, sim.vehicles[0], sim.vehicles[1]));
    sim.couplers.push(makeChainJoint(sim, sim.vehicles[1], sim.vehicles[2]));
    // zderzaki: każdy talerz może trafić w talerz dowolnego innego pojazdu (np. najazd po objechaniu toru)
    sim.bufHeads = [];
    for (const v of sim.vehicles) for (const e of [1, -1]) for (const sz of [1, -1])
      sim.bufHeads.push({ veh: v, e, sz, l: [e * (v.def.Lb / 2 + BUF_EXT), BUF_Y - v.def.comY, sz * BUF_Z], comp: 0 });
    for (let i = 0; i < sim.bufHeads.length; i++) for (let j = i + 1; j < sim.bufHeads.length; j++) {
      const a = sim.bufHeads[i], b = sim.bufHeads[j]; if (a.veh === b.veh) continue;
      sim.buffers.push({ ha: a, hb: b, A: a.veh, B: b.veh, comp: 0, F: 0, on: false, hard: false });
    }
    sim.setMass = (i, tons) => {
      const v = sim.vehicles[i]; v.massT = tons; const m = tons * 1000; const I = bodyInertia(m, v.def.dims);
      v.body.setMass(m, I[0], I[1], I[2]);
    };
    sim.step = () => stepSim(sim);
    // stan początkowy do restartu
    const all = sim.bodies.concat(...sim.couplers.filter(c => c.links).map(c => c.links));
    const snap = all.map(b => [b, b.p.slice(), b.q.slice()]);
    sim.reset = () => {
      for (const [b, p0, q0] of snap) {
        b.p = p0.slice(); b.q = q0.slice(); b.v = [0, 0, 0]; b.w = [0, 0, 0];
        b.f[0] = b.f[1] = b.f[2] = 0; b.t[0] = b.t[1] = b.t[2] = 0; b.update();
      }
      sim.t = 0; sim.broken = false; sim.st.brakeP = 0; sim.st.F = 0; sim.st.integ = 0; sim.st.speed = 0;
      sim.ctrl.target = 0; sim.ctrl.brake = false; sim.ctrl.lock = false;
      const k = sim.couplers[0]; for (const h of [k.ka, k.kb]) { h.ang = 0; h.om = 0; h.locked = true; h.lever = false; h.tau = 0; } sim.couplers[1].hooked = true; sim.couplers[1].lifting = false;
    };
    sim.KN = KN; sim.CH = CH; sim.KN_OPEN = KN_OPEN; sim.knShapes = knShapes;
    // rozprzęganie: Janney — otwarcie kości głowicy lokomotywy; łańcuch — zdjęcie ostatniego ogniwa z haka
    // dźwignia rozprzęgacza (głowica lokomotywy): pociągnięta = rygiel podniesiony; puszczona = rygiel opadnie przy zamknięciu kości
    sim.knuckleLever = pulled => { sim.couplers[0].ka.lever = pulled; };
    sim.knuckleState = () => { const k = sim.couplers[0].ka; return k.locked ? (k.lever ? 'bound' : 'locked') : k.lever ? 'lever' : 'open'; };
    sim.chainHook = on => {
      const c = sim.couplers[1];
      if (!on) { c.hooked = false; c.lifting = false; return true; }
      if (c.hooked) return true;
      // zasięg: hak musi być bliżej sworznia W1 niż długość łańcucha (inaczej ręka nie doniesie ogniwa)
      const a = c.A.body.toWorld(...c.ha, [0, 0, 0]), h = c.B.body.toWorld(...c.hb, [0, 0, 0]);
      if (Math.hypot(a[0] - h[0], a[1] - h[1], a[2] - h[2]) > c.links.length * c.pitch + 0.02) return false;
      c.lifting = true; c.liftT = sim.t; return true;
    };
    return sim;
  }

  // ---- kwaterniony ----
  function qMulTo(a, b, o) {
    const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    o[0] = a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3; o[1] = a0 * b1 + a1 * b0 + a2 * b3 - a3 * b2;
    o[2] = a0 * b2 - a1 * b3 + a2 * b0 + a3 * b1; o[3] = a0 * b3 + a1 * b2 - a2 * b1 + a3 * b0; return o;
  }
  function qMul(a, b) { return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]]; }
  function qRot(q, x, y, z, o) { // obrót wektora kwaternionem
    const [w, a, b, c] = q;
    const tx = 2 * (b * z - c * y), ty = 2 * (c * x - a * z), tz = 2 * (a * y - b * x);
    o[0] = x + w * tx + (b * tz - c * ty); o[1] = y + w * ty + (c * tx - a * tz); o[2] = z + w * tz + (a * ty - b * tx); return o; }
  const Q_YAW180 = [0, 0, 1, 0], Q_ROLL90 = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];

  // ---- Sprzęg kłowy: dwie głowice z „palcami” (bryły sztywne na sworzniu z aparatem cięgłowym) ----
  // kształty głowicy w jej układzie (x: do przodu, ku drugiej głowicy; z: w bok), odcinki z promieniem; wysokość ±KN.hh
  const KN = { mass: 150, I: [2.3, 14, 14], palm: 0.3, pivot: -0.6, gap: 0.305, hh: 0.14,
    // [0] dno gardzieli, [1] ściana po stronie kości, [2] nos kości, [3] ogon kości (2 i 3 obracają się na sworzniu), [4] ramię prowadzące.
    // Naciski przy pchaniu przenoszą zderzaki boczne; głowice opierają się dopiero o dno gardzieli (po pełnym skoku zderzaków).
    shapes: [{ a: [0.2, -0.10], b: [0.2, 0.10], r: 0.04 }, { a: [0.3, 0.16], b: [0.5, 0.16], r: 0.04 }, { a: [0.5, 0.16], b: [0.5, -0.06], r: 0.04 },
      { a: [0.5, 0.16], b: [0.36, 0.16], r: 0.04 }, { a: [0.3, -0.25], b: [0.54, -0.29], r: 0.04 }] };
  const KN_EP = BUF_EXT - KN.gap / 2; // wysięg czoła głowicy od czołownicy
  const KT = [0, 0, 0];
  function knTorque(k, b, Pc, fx, fz) {
    const pin = b.toWorld(KN.shapes[2].a[0], 0, KN.shapes[2].a[1], KT);
    const rx = Pc[0] - pin[0], rz = Pc[2] - pin[2];
    const ty = rz * fx - rx * fz;                            // moment wokół osi pionowej świata
    b.dirLocal(0, ty, 0, KT);                                // → oś y głowicy
    k.tau += -KT[1];                                         // otwieranie = obrót wokół −y głowicy
  }
  function knuckleDyn(sim, k, b) {
    let tq = k.tau; k.tau = 0;
    if (k.locked) {
      // rygiel podnosi się dopiero, gdy kość nie jest dociśnięta (tarcie rygla pod naciągiem)
      if (k.lever && Math.abs(tq) < 250) k.locked = false; else { k.ang = 0; k.om = 0; return; }
    }
    if (k.lever && k.ang < KN_OPEN - 0.05) tq += 60;                         // sprężyna wyrzutnika kości
    tq -= 3 * k.om; tq -= Math.abs(k.om) > 0.01 ? 4 * Math.sign(k.om) : 0;   // tarcie na sworzniu
    if (k.ang < 0) tq += -1e5 * k.ang - 300 * k.om;                          // oparcie w pozycji zamkniętej
    if (k.ang > KN_OPEN) tq += -1e5 * (k.ang - KN_OPEN) - 300 * k.om;        // ogranicznik otwarcia
    k.om += tq / KN_I * H; k.ang += k.om * H;
    // zamknięcie (rygiel) opada pod własnym ciężarem, gdy kość dojdzie do pozycji zamkniętej, a dźwignia puszczona
    if (!k.lever && k.ang < 0.004 && k.om <= 0.05) {
      k.locked = true; k.ang = 0; k.om = 0;
      const p = b.toWorld(KN.shapes[2].a[0], 0, KN.shapes[2].a[1], [0, 0, 0]); emit(sim, 'knuckle', p[0], p[1], p[2], 0.35);
    }
  }
  function makeKnuckle(sim, veh, end) {
    const d = veh.def, b = new Body(KN.mass, KN.I[0], KN.I[1], KN.I[2]);
    const palmX = end * (d.Lb / 2 + KN_EP), y = BUF_Y - d.comY;
    const qoff = end > 0 ? [1, 0, 0, 0] : Q_YAW180;
    b.q = qMul(veh.body.q, qoff); b.update();
    veh.body.toWorld(palmX - end * KN.palm, y, 0, b.p);
    sim.bodies.push(b);
    return { veh, end, body: b, qoff, anchor: [palmX - end * (KN.palm - KN.pivot), y, 0], ang: 0, om: 0, locked: true, lever: false, tau: 0 };
  }
  function makeKnuckleJoint(sim, A, B) {
    const ka = makeKnuckle(sim, A, -1), kb = makeKnuckle(sim, B, 1);
    return { type: 'knuckle', A, B, ka, kb, pa: ka.body.toWorld(KN.palm, 0, 0, [0, 0, 0]), pb: kb.body.toWorld(KN.palm, 0, 0, [0, 0, 0]), F: 0 };
  }
  const QE = [0, 0, 0], WR = [0, 0, 0], QM1 = [0, 0, 0, 0], QM2 = [0, 0, 0, 0], QM3 = [0, 0, 0, 0];
  function knuckleMount(k) {
    const c = k.veh.body, b = k.body;
    b.toWorld(KN.pivot, 0, 0, P);
    c.toWorld(k.anchor[0], k.anchor[1], k.anchor[2], Q);
    c.dirLocal(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2], D);
    b.velAt(P, V1); c.velAt(P, V2); c.dirLocal(V1[0] - V2[0], V1[1] - V2[1], V1[2] - V2[2], Q);
    let fx = -(4e6 * D[0] + 3e4 * Q[0]);                     // aparat cięgłowy (sprężyna)
    if (Math.abs(D[0]) > 0.05) fx -= Math.sign(D[0]) * 5e7 * (Math.abs(D[0]) - 0.05);
    const fy = -(5e7 * D[1] + 1e5 * Q[1]), fz = -(5e7 * D[2] + 1e5 * Q[2]);
    c.dirWorld(fx, fy, fz, D);
    b.addForceAt(D[0], D[1], D[2], P); c.addForceAt(-D[0], -D[1], -D[2], P);
    // kąty: głowica obraca się swobodnie w poziomie na sworzniu (słabe centrowanie, ogranicznik), pion i skręt podparte
    const qe = qMulTo(c.q, k.qoff, QM1), qc = QM2; qc[0] = qe[0]; qc[1] = -qe[1]; qc[2] = -qe[2]; qc[3] = -qe[3];
    const r = qMulTo(qc, b.q, QM3); if (r[0] < 0) { r[0] = -r[0]; r[1] = -r[1]; r[2] = -r[2]; r[3] = -r[3]; }
    const rx = 2 * r[1], ry = 2 * r[2], rz = 2 * r[3];
    qRot(qc, b.w[0] - c.w[0], b.w[1] - c.w[1], b.w[2] - c.w[2], WR);
    let tx = -(2e5 * rx + 500 * WR[0]), ty = -(3e4 * ry + 300 * WR[1]), tz = -(2e5 * rz + 500 * WR[2]);
    if (Math.abs(ry) > 0.2) ty -= Math.sign(ry) * 5e6 * (Math.abs(ry) - 0.2);
    qRot(qe, tx, ty, tz, QE);
    b.t[0] += QE[0]; b.t[1] += QE[1]; b.t[2] += QE[2]; c.t[0] -= QE[0]; c.t[1] -= QE[1]; c.t[2] -= QE[2];
  }
  // najbliższe punkty dwóch odcinków w 2D (x,z)
  function segSeg(p1x, p1z, q1x, q1z, p2x, p2z, q2x, q2z, out) {
    const d1x = q1x - p1x, d1z = q1z - p1z, d2x = q2x - p2x, d2z = q2z - p2z, rx = p1x - p2x, rz = p1z - p2z;
    const a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz;
    let s, t; const c = d1x * rx + d1z * rz, bb = d1x * d2x + d1z * d2z, den = a * e - bb * bb;
    s = den > 1e-12 ? Math.min(1, Math.max(0, (bb * f - c * e) / den)) : 0;
    t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (bb - c) / a)); }
    out[0] = p1x + d1x * s; out[1] = p1z + d1z * s; out[2] = p2x + d2x * t; out[3] = p2z + d2z * t; return out;
  }
  const SA = [0, 0, 0], SB = [0, 0, 0], SC = [0, 0, 0], SD = [0, 0, 0], SS = [0, 0, 0, 0];
  // kość (palec) obraca się na sworzniu w narożu głowicy; otwarta = obrócona do przodu o KN_OPEN rad
  // kość: bryła obrotowa na sworzniu (ang: 0 = zamknięta, rośnie przy otwieraniu do przodu), bezwładność KN_I
  const KN_OPEN = 1.6, KN_I = 0.6;
  function knShapes(k) {
    if (k.ang <= 0) return KN.shapes;
    const px = KN.shapes[2].a[0], pz = KN.shapes[2].a[1], co = Math.cos(k.ang), si = Math.sin(k.ang);
    const rot = c => { const bx = c.b[0] - px, bz = c.b[1] - pz; return { a: c.a, b: [px + bx * co - bz * si, pz + bx * si + bz * co], r: c.r }; };
    return [KN.shapes[0], KN.shapes[1], rot(KN.shapes[2]), rot(KN.shapes[3]), KN.shapes[4]];
  }
  function knuckleContact(sim, cp) {
    const A = cp.ka.body, B = cp.kb.body;
    cp.F = 0;
    if (Math.abs(A.p[1] - B.p[1]) > KN.hh) return;
    const shA = knShapes(cp.ka), shB = knShapes(cp.kb);
    for (let ia = 0; ia < 5; ia++) {
      const sa = shA[ia];
      A.toWorld(sa.a[0], 0, sa.a[1], SA); A.toWorld(sa.b[0], 0, sa.b[1], SB);
      for (let ib = 0; ib < 5; ib++) {
        const sb = shB[ib];
        B.toWorld(sb.a[0], 0, sb.a[1], SC); B.toWorld(sb.b[0], 0, sb.b[1], SD);
        segSeg(SA[0], SA[2], SB[0], SB[2], SC[0], SC[2], SD[0], SD[2], SS);
        let nx = SS[0] - SS[2], nz = SS[1] - SS[3]; const dist = Math.hypot(nx, nz);
        const pk = ia * 5 + ib, st = cp.touch || (cp.touch = new Array(25).fill(false));
        const pen = sa.r + sb.r - dist; if (pen <= 0 || dist < 1e-9) { st[pk] = false; continue; }
        nx /= dist; nz /= dist;
        P[0] = (SS[0] + SS[2]) / 2; P[1] = (A.p[1] + B.p[1]) / 2; P[2] = (SS[1] + SS[3]) / 2;
        A.velAt(P, V1); B.velAt(P, V2);
        const vn = (V1[0] - V2[0]) * nx + (V1[2] - V2[2]) * nz;
        if (!st[pk]) { st[pk] = true; emit(sim, 'knuckle', P[0], P[1], P[2], -vn / 0.25); }
        const Fn = 5e7 * pen - 3e4 * vn; if (Fn <= 0) continue;
        A.addForceAt(nx * Fn, 0, nz * Fn, P); B.addForceAt(-nx * Fn, 0, -nz * Fn, P);
        // moment na kości (palec ia/ib === 2) względem jej sworznia — obraca kość, gdy zamknięcie podniesione
        if (ia === 2 || ia === 3) knTorque(cp.ka, A, P, nx * Fn, nz * Fn);
        if (ib === 2 || ib === 3) knTorque(cp.kb, B, P, -nx * Fn, -nz * Fn);
        addContact(sim, A, P[0], P[1], P[2], nx, 0, nz, Fn, 0.2, -3, B);
        cp.F += Fn;
      }
    }
    A.toWorld(KN.palm, 0, 0, cp.pa); B.toWorld(KN.palm, 0, 0, cp.pb);
  }

  // ---- Łańcuch: ogniwa jako bryły sztywne, zaczepione końcami (z luzem) o siebie i o haki ----
  const CH = { N: 5, g: 0.005, m: 3, I: [0.004, 0.008, 0.008], kc: 1e8, cc: 6e3, sub: 10, kr: 2, cf: 0.03, rw: 0.013, rr: 0.035 };
  function makeChainJoint(sim, A, B) {
    const ha = [-(A.def.Lb / 2 + HOOK_EXT), BUF_Y - A.def.comY, 0], hb = [B.def.Lb / 2 + HOOK_EXT, BUF_Y - B.def.comY, 0];
    const pa = A.body.toWorld(...ha, [0, 0, 0]), pb = B.body.toWorld(...hb, [0, 0, 0]);
    const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
    const pitch = (L + SLACK - (CH.N + 1) * CH.g) / CH.N;
    const links = [];
    for (let i = 0; i < CH.N; i++) {
      const l = new Body(CH.m, CH.I[0], CH.I[1], CH.I[2]), t = (i + 0.5) / CH.N;
      l.p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
      l.q = qMul(qMul(A.body.q, Q_YAW180), i % 2 ? Q_ROLL90 : [1, 0, 0, 0]); l.update();
      links.push(l);
    }
    return { type: 'chain', A, B, ha, hb, links, pitch, pa, pb, F: 0, hooked: true };
  }
  const E1 = [0, 0, 0], E2 = [0, 0, 0], W1 = [0, 0, 0], W2 = [0, 0, 0], CVA = [0, 0, 0], CVB = [0, 0, 0], CFA = [0, 0, 0], CFB = [0, 0, 0];
  function chainStep(cp, sim) {
    const A = cp.A.body, B = cp.B.body, L = cp.links, n = L.length, hp = cp.pitch / 2, h = H / CH.sub;
    const pa0 = A.toWorld(cp.ha[0], cp.ha[1], cp.ha[2], cp.pa), pb0 = B.toWorld(cp.hb[0], cp.hb[1], cp.hb[2], cp.pb);
    const va = A.velAt(pa0, CVA), vb = B.velAt(pb0, CVB);
    const FA = CFA, FB = CFB; FA[0] = FA[1] = FA[2] = FB[0] = FB[1] = FB[2] = 0;
    let Fmax = 0;
    for (let s = 0; s < CH.sub; s++) {
      const tau = s * h;
      for (let j = 0; j <= n; j++) {
        // punkt 1: hak A albo koniec (+) ogniwa j-1; punkt 2: koniec (−) ogniwa j albo hak B
        if (j === 0) { for (let k = 0; k < 3; k++) { E1[k] = pa0[k] + va[k] * tau; W1[k] = va[k]; } }
        else { L[j - 1].toWorld(hp, 0, 0, E1); L[j - 1].velAt(E1, W1); }
        if (j === n) { if (!cp.hooked) continue; for (let k = 0; k < 3; k++) { E2[k] = pb0[k] + vb[k] * tau; W2[k] = vb[k]; } }
        else { L[j].toWorld(-hp, 0, 0, E2); L[j].velAt(E2, W2); }
        let dx = E1[0] - E2[0], dy = E1[1] - E2[1], dz = E1[2] - E2[2]; const d = Math.hypot(dx, dy, dz);
        const taut = cp.taut || (cp.taut = new Array(n + 1).fill(false));
        if (d <= CH.g) { taut[j] = false; continue; }
        dx /= d; dy /= d; dz /= d;
        const vr = (W1[0] - W2[0]) * dx + (W1[1] - W2[1]) * dy + (W1[2] - W2[2]) * dz;
        if (!taut[j]) { taut[j] = true; if (vr > 0.04) emit(sim, 'chain', E1[0], E1[1], E1[2], (vr - 0.04) / 0.3); }
        let F = CH.kc * (d - CH.g) + CH.cc * vr; if (F < 0) F = 0;
        if (F > Fmax) Fmax = F;
        if (j === 0) { FA[0] -= dx * F; FA[1] -= dy * F; FA[2] -= dz * F; } else L[j - 1].addForceAt(-dx * F, -dy * F, -dz * F, E1);
        if (j === n) { FB[0] += dx * F; FB[1] += dy * F; FB[2] += dz * F; } else L[j].addForceAt(dx * F, dy * F, dz * F, E2);
      }
      for (let j = 0; j + 1 < n; j++) {
        const a = L[j], b = L[j + 1];
        // ogniwa nie przenikają się środkami
        let dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2]; const d = Math.hypot(dx, dy, dz), dmin = 0.6 * cp.pitch;
        if (d < dmin && d > 1e-9) { const F = 2e6 * (dmin - d); dx /= d; dy /= d; dz /= d;
          a.f[0] -= dx * F; a.f[1] -= dy * F; a.f[2] -= dz * F; b.f[0] += dx * F; b.f[1] += dy * F; b.f[2] += dz * F; }
        // sąsiednie ogniwa leżą w prostopadłych płaszczyznach (geometria drutu)
        a.dirWorld(0, 1, 0, E1); b.dirWorld(0, 1, 0, E2); b.dirWorld(0, 0, 1, W1); b.dirWorld(1, 0, 0, W2);
        const tq = -CH.kr * (E1[0] * E2[0] + E1[1] * E2[1] + E1[2] * E2[2]) * (E1[0] * W1[0] + E1[1] * W1[1] + E1[2] * W1[2])
          - 0.002 * ((b.w[0] - a.w[0]) * W2[0] + (b.w[1] - a.w[1]) * W2[1] + (b.w[2] - a.w[2]) * W2[2]);
        b.t[0] += W2[0] * tq; b.t[1] += W2[1] * tq; b.t[2] += W2[2] * tq; a.t[0] -= W2[0] * tq; a.t[1] -= W2[1] * tq; a.t[2] -= W2[2] * tq;
        // tarcie drut o drut w miejscu zaczepienia ogniw (opór obrotu względnego)
        const cf = CH.cf, rx = (b.w[0] - a.w[0]) * cf, ry = (b.w[1] - a.w[1]) * cf, rz = (b.w[2] - a.w[2]) * cf;
        b.t[0] -= rx; b.t[1] -= ry; b.t[2] -= rz; a.t[0] += rx; a.t[1] += ry; a.t[2] += rz;
      }
      // tarcie ogniw skrajnych o hak / sworzeń
      { const a = L[0], b = L[n - 1], cf = CH.cf;
        a.t[0] -= (a.w[0] - A.w[0]) * cf; a.t[1] -= (a.w[1] - A.w[1]) * cf; a.t[2] -= (a.w[2] - A.w[2]) * cf;
        b.t[0] -= (b.w[0] - B.w[0]) * cf; b.t[1] -= (b.w[1] - B.w[1]) * cf; b.t[2] -= (b.w[2] - B.w[2]) * cf; }
      // manewrowy zakłada ostatnie ogniwo na hak: siła ręki (do 600 N) ku hakowi
      if (cp.lifting && !cp.hooked) {
        const l = L[n - 1]; l.toWorld(hp, 0, 0, E1); l.velAt(E1, W1);
        let dx = pb0[0] + vb[0] * tau - E1[0], dy = pb0[1] + vb[1] * tau - E1[1], dz = pb0[2] + vb[2] * tau - E1[2]; const d = Math.hypot(dx, dy, dz);
        if (d < 0.02) { cp.hooked = true; cp.lifting = false; }
        else { const F = Math.min(600, 4000 * d) / d; l.addForceAt(dx * F - 30 * W1[0], dy * F - 30 * W1[1], dz * F - 30 * W1[2], E1); }
      }
      for (const l of L) l.integrateVel(h);
      for (const l of L) l.integratePos(h);
    }
    const inv = 1 / CH.sub;
    A.addForceAt(FA[0] * inv, FA[1] * inv, FA[2] * inv, pa0);
    B.addForceAt(FB[0] * inv, FB[1] * inv, FB[2] * inv, pb0);
    cp.F = Fmax;
  }

  // scratch
  const BHA = [0, 0, 0], BHB = [0, 0, 0];
  const P = [0, 0, 0], Q = [0, 0, 0], V1 = [0, 0, 0], V2 = [0, 0, 0], D = [0, 0, 0];

  // kontakty z puli (bez tworzenia obiektów w każdym kroku); aktywne: sim.contacts[0 .. sim.nc-1]
  function addContact(sim, b, px, py, pz, nx, ny, nz, Fn, mu, kind, b2) {
    const pool = sim.contacts; let c = pool[sim.nc];
    if (!c) pool.push(c = { b: null, b2: null, P: [0, 0, 0], n: [0, 0, 0], J: [0, 0, 0], lim: 0, Fn: 0, kind: 0 });
    c.b = b; c.b2 = b2 || null; c.P[0] = px; c.P[1] = py; c.P[2] = pz; c.n[0] = nx; c.n[1] = ny; c.n[2] = nz;
    c.J[0] = c.J[1] = c.J[2] = 0; c.lim = mu * Fn * H; c.Fn = Fn; c.kind = kind === undefined ? -2 : kind;
    sim.nc++;
  }
  // zdarzenia akustyczne (odbierane przez stronę): typ, miejsce, siła 0..1
  function emit(sim, k, x, y, z, s) {
    if (s < 0.02 || sim.events.length > 300) return;
    sim.events.push({ k, x, y, z, s: s > 1 ? 1 : s });
  }

  function normalForce(b, nx, ny, nz, pen, k, c) {
    const vel = b.velAt(P, V1);
    const vn = vel[0] * nx + vel[1] * ny + vel[2] * nz;
    let Fn = k * pen - c * vn; if (Fn <= 0) return 0;
    b.addForceAt(nx * Fn, ny * Fn, nz * Fn, P);
    return Fn;
  }

  // ===================== SIEĆ TOROWA: odcinki szyn, rozjazdy =====================
  // Każda szyna to odcinek (prosty lub łuk) z przekrojem szyny, końcami, opcjonalnymi przycięciami
  // (iglica przylegająca do opornicy, dziób krzyżownicy) i ruchem (iglica przestawiana napędem).
  const GF = 0.7175, RC = 0.7535, FW = 0.045, CHK = 0.6415;
  const RAIL_LEN = 25;                                  // szyny 25 m
  function pieceLocal(pc, x, z, o) {
    if (pc.kind === 'line') {
      const rx = x - pc.ax, rz = z - pc.az;
      o[0] = rx * pc.dx + rz * pc.dz; o[1] = -rx * pc.dz + rz * pc.dx;
      o[2] = -pc.dz; o[3] = pc.dx;                       // kierunek poprzeczny
    } else {
      const rx = x - pc.cx, rz = z - pc.cz, rho = Math.hypot(rx, rz) || 1e-9;
      let ph = Math.atan2(rz, rx); const mid = pc.mid;
      while (ph < mid - Math.PI) ph += 2 * Math.PI; while (ph > mid + Math.PI) ph -= 2 * Math.PI;
      o[0] = (ph - pc.th0) * pc.r; o[1] = rho - pc.r; o[2] = rx / rho; o[3] = rz / rho;
    }
    return o;
  }
  const LO = [0, 0, 0, 0];
  function pieceSdf(pc, x, y, z, sw) {
    let px = x, pz = z;
    if (pc.blade) {
      const b = pc.blade, open = b.openAt1 ? sw[b.sw].pos : 1 - sw[b.sw].pos;
      if (open > 1e-6) {
        pieceLocal(pc, x, z, LO);
        let tt = b.toeAtEnd ? pc.len - LO[0] : LO[0]; tt = Math.min(Math.max(tt / b.L, 0), 1);
        const disp = open * b.throw * (1 - tt); px -= b.nx * disp; pz -= b.nz * disp;
      }
    }
    pieceLocal(pc, px, pz, LO);
    const t = LO[0], lat = LO[1];
    if (lat > 0.12 || lat < -0.12 || t < -0.1 || t > pc.len + 0.1) return 1;
    let d = railSdf(lat, y - pc.vOff);
    d = Math.max(d, -t, t - pc.len);
    const cl = pc.clips;
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i];
      const cd = c.t === 'z' ? c.s * (c.v - pz) : c.s * (c.v - Math.hypot(px - c.cx, pz - c.cz));
      if (cd > d) d = cd;
    }
    return d;
  }
  function line(x0, z0, x1, z1, extra) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    return Object.assign({ kind: 'line', ax: x0, az: z0, dx: (x1 - x0) / L, dz: (z1 - z0) / L, len: L, clips: [], vOff: 0 }, extra || {});
  }
  function arc(cx, cz, r, th0, th1, extra) {
    return Object.assign({ kind: 'arc', cx, cz, r, th0, th1, mid: (th0 + th1) / 2, len: (th1 - th0) * r, clips: [], vOff: 0 }, extra || {});
  }
  function mirror(pc) {               // odbicie z → −z
    const m = JSON.parse(JSON.stringify(pc));
    if (m.kind === 'line') { m.az = -m.az; m.dz = -m.dz; }
    else { m.cz = -m.cz; const a = -pc.th1, b = -pc.th0; m.th0 = a; m.th1 = b; m.mid = (a + b) / 2; if (m.blade) m.blade.toeAtEnd = !m.blade.toeAtEnd; }
    for (const c of m.clips) { if (c.t === 'z') { c.v = -c.v; c.s = -c.s; } else c.cz = -c.cz; }
    if (m.blade) m.blade.nz = -m.blade.nz;
    return m;
  }
  function buildTrack(hl, R, Lext) {
    const P = [], A = Math.asin, H2 = Math.PI / 2;
    const Ro = R + RC, Ri = R - RC;                     // osie szyn zewn./wewn.
    const dxS = Math.sqrt((R + GF - FW) ** 2 - (R - GF) ** 2);        // koniec szyny prostej przed żłobkiem
    const dxD = Math.sqrt((R + GF) ** 2 - (R - GF + FW) ** 2);        // koniec szyny zwrotnej przed żłobkiem
    const dxX = Math.sqrt((R + GF) ** 2 - (R - GF) ** 2);             // punkt przecięcia krawędzi tocznych
    const dxT = Math.sqrt((R + GF) ** 2 - (R - GF - 0.012) ** 2);     // dziób (szer. 12 mm)
    const dxE = dxX + 1.6;                                             // koniec kieropórek
    const BL = 6, TH = 0.12;
    const t1 = [];                                       // elementy rozjazdu 1 (z < 0), rozjazd 2 = odbicie
    t1.push(line(-hl, -Ro, hl + Lext, -Ro, { name: 'opornica prosta' }));
    t1.push(line(-hl, -Ri, hl, -Ri));
    t1.push(line(hl, -Ri, hl + BL, -Ri, { name: 'iglica prosta', clips: [{ t: 'r', cx: hl, cz: 0, s: 1, v: R - GF + 0.001 }],
      blade: { sw: 0, openAt1: false, L: BL, throw: TH, nx: 0, nz: -1, toeAtEnd: false } }));
    t1.push(line(hl + BL, -Ri, hl + dxS, -Ri));
    t1.push(arc(hl, 0, R + GF - FW - 0.036, -H2 + A(dxS / (R + GF - FW)), -H2 + A(dxE / (R + GF - FW - 0.036)), { name: 'kieropórka' }));
    t1.push(line(hl + dxT, -Ri, hl + Lext, -Ri, { name: 'dziób', clips: [{ t: 'r', cx: hl, cz: 0, s: 1, v: R + GF }] }));
    t1.push(arc(hl, 0, Ro, -H2, -H2 + BL / Ro, { name: 'iglica łukowa', clips: [{ t: 'z', s: 1, v: -(R + GF) + 0.001 }],
      blade: { sw: 0, openAt1: true, L: BL, throw: TH, nx: 0, nz: 1, toeAtEnd: false } }));
    t1.push(arc(hl, 0, Ro, -H2 + BL / Ro, -H2 + A(dxD / (R + GF))));
    t1.push(line(hl + dxD, -(R - GF + FW + 0.036), hl + dxE, -(R - GF + FW + 0.036), { name: 'kieropórka' }));
    t1.push(line(hl + dxX - 2.5, -(R + CHK), hl + dxX + 1.5, -(R + CHK), { name: 'kierownica', vOff: 0.01 }));
    const thX = -H2 + A(dxX / (R + GF));
    t1.push(arc(hl, 0, R - CHK, thX - 2.5 / R, thX + 1.5 / R, { name: 'kierownica', vOff: 0.01 }));
    for (const pc of t1) P.push(pc);
    for (const pc of t1) { const m = mirror(pc); if (m.blade) m.blade.sw = 1; P.push(m); }
    // łuk obecnego owalu za rozjazdami (szyna wewnętrzna ciągła, zewnętrzna od dzioba do dzioba)
    P.push(arc(hl, 0, Ri, -H2, H2, { name: 'opornica łukowa' }));
    const thT = A(dxT / Ro);
    P.push(arc(hl, 0, Ro, -H2 + thT, H2 - thT, { name: 'dziób', clips: [{ t: 'z', s: 1, v: -(R - GF) }, { t: 'z', s: -1, v: R - GF }] }));
    // lewy łuk owalu i łuk końcowy przedłużenia
    P.push(arc(-hl, 0, Ri, H2, 3 * H2)); P.push(arc(-hl, 0, Ro, H2, 3 * H2));
    P.push(arc(hl + Lext, 0, Ri, -H2, H2)); P.push(arc(hl + Lext, 0, Ro, -H2, H2));
    P.forEach(pc => { pc.vOff = pc.vOff || 0; });
    return { base: P, geo: { dxS, dxD, dxX, dxT, dxE, BL, TH } };
  }
  // podział na szyny po RAIL_LEN ze szczeliną dylatacyjną `gap` na stykach (bez iglic i krótkich elementów)
  function splitRails(P, gap) {
    const out = [], joints = [], JOINT_GAP = gap;
    for (const pc of P) {
      if (pc.blade || pc.len < 30 || pc.vOff) { out.push(pc); continue; }
      const n = Math.ceil(pc.len / RAIL_LEN);
      for (let k = 0; k < n; k++) {
        const t0 = k * RAIL_LEN + (k > 0 ? JOINT_GAP / 2 : 0), t1 = Math.min(pc.len, (k + 1) * RAIL_LEN - (k < n - 1 ? JOINT_GAP / 2 : 0));
        const q = JSON.parse(JSON.stringify(pc));
        if (q.kind === 'line') { q.ax = pc.ax + pc.dx * t0; q.az = pc.az + pc.dz * t0; }
        else { q.th0 = pc.th0 + t0 / pc.r; q.th1 = pc.th0 + t1 / pc.r; q.mid = (q.th0 + q.th1) / 2; }
        q.len = t1 - t0; out.push(q);
        if (k > 0) {                                   // styk: miejsce łubków
          const t = k * RAIL_LEN; let x, z, tx, tz;
          if (pc.kind === 'line') { x = pc.ax + pc.dx * t; z = pc.az + pc.dz * t; tx = pc.dx; tz = pc.dz; }
          else { const th = pc.th0 + t / pc.r; x = pc.cx + pc.r * Math.cos(th); z = pc.cz + pc.r * Math.sin(th); tx = -Math.sin(th); tz = Math.cos(th); }
          joints.push({ x, z, tx, tz });
        }
      }
    }
    out.forEach((pc, i) => { pc.id = i; });
    return { pieces: out, joints };
  }
  // siatka przestrzenna: komórki 2 m
  const CELL = 2;
  function buildGrid(pieces) {
    const grid = new Map(), o = [0, 0, 0, 0];
    for (const pc of pieces) {
      const n = Math.ceil(pc.len / 0.5) + 1;
      for (let i = 0; i <= n; i++) {
        const t = pc.len * i / n; let x, z, nx, nz;
        if (pc.kind === 'line') { x = pc.ax + pc.dx * t; z = pc.az + pc.dz * t; nx = -pc.dz; nz = pc.dx; }
        else { const th = pc.th0 + t / pc.r; nx = Math.cos(th); nz = Math.sin(th); x = pc.cx + pc.r * nx; z = pc.cz + pc.r * nz; }
        for (const l of [-0.35, 0, 0.35]) {
          const key = Math.floor((x + nx * l) / CELL) * 100003 + Math.floor((z + nz * l) / CELL);
          let a = grid.get(key); if (!a) grid.set(key, a = []);
          if (!a.includes(pc.id)) a.push(pc.id);
        }
      }
    }
    return grid;
  }

  // ===================== PODKŁADY I PODSYPKA (bryły) =====================
  const SL = { hx: 0.125, hy: 0.08, hz: 1.3, yc: SLEEPER_TOP - 0.08, step: 0.65 };
  const BAL_TOP = -0.26, GROUND_Y = -0.45;
  function extAt(s, hl, R, Lext) {
    const A = Math.PI * R;
    if (s < Lext) return { px: hl + s, pz: -R, tx: 1, tz: 0 };
    if (s < Lext + A) { const th = -Math.PI / 2 + (s - Lext) / R; return { px: hl + Lext + R * Math.cos(th), pz: R * Math.sin(th), tx: -Math.sin(th), tz: Math.cos(th) }; }
    return { px: hl + Lext - (s - Lext - A), pz: R, tx: -1, tz: 0 };
  }
  function buildTerrain(hl, R, Lext) {
    const sleepers = [], grid = new Map();
    const routes = [{ at: s => trackAt(s), L: TRACK.L }, { at: s => extAt(s, hl, R, Lext), L: 2 * Lext + Math.PI * R }];
    for (const r of routes) {
      const n = Math.floor(r.L / SL.step);
      for (let i = 0; i < n; i++) {
        const s = r.at((i + 0.5) * r.L / n), id = sleepers.length;
        sleepers.push({ x: s.px, z: s.pz, cx: s.tx, cz: s.tz });            // oś x podkładu wzdłuż toru
        for (let l = -1.4; l <= 1.41; l += 0.35) {
          const key = Math.floor((s.px - s.tz * l) / CELL) * 100003 + Math.floor((s.pz + s.tx * l) / CELL);
          let a = grid.get(key); if (!a) grid.set(key, a = []); if (!a.includes(id)) a.push(id);
        }
      }
    }
    return { sleepers, grid, routes };
  }
  function distToRoutes(x, z, hl, R, Lext) {     // odległość od osi najbliższego toru
    let d;
    if (x > hl || x < -hl) { const ox = x > hl ? hl : -hl; d = Math.abs(Math.hypot(x - ox, z) - R); } else d = Math.abs(Math.abs(z) - R);
    if (x >= hl) {
      const e = x <= hl + Lext ? Math.abs(Math.abs(z) - R) : Math.abs(Math.hypot(x - hl - Lext, z) - R);
      if (e < d) d = e;
    }
    return d;
  }
  function terrainSdf(sim, x, y, z) {
    const T = sim.terrain, Rr = R_CURVE, hl = TRACK.hl;
    // podsypka: korona −0,26 m do 1,45 m od osi, skarpa do −0,45 m na 2,1 m, dalej grunt
    const dl = distToRoutes(x, z, hl, Rr, sim.track.Lext);
    const hb = dl < 1.45 ? BAL_TOP : dl < 2.1 ? BAL_TOP + (GROUND_Y - BAL_TOP) * (dl - 1.45) / 0.65 : (sim.groundH ? sim.groundH(x, z) : GROUND_Y);
    let d = y - hb; TK = dl >= 2.1 ? 2 : 0;          // 0 podsypka, 1 podkład, 2 grunt
    if (y < SLEEPER_TOP + 0.05) {
      const cand = T.grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
      if (cand) for (let i = 0; i < cand.length; i++) {
        const s = T.sleepers[cand[i]], rx = x - s.x, rz = z - s.z;
        const a = rx * s.cx + rz * s.cz, l = -rx * s.cz + rz * s.cx;
        const qx = Math.abs(a) - SL.hx, qy = Math.abs(y - SL.yc) - SL.hy, qz = Math.abs(l) - SL.hz;
        const ds = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
        if (ds < d) { d = ds; TK = 1; }
      }
    }
    return d;
  }
  // kontakt punktu z podkładami/podsypką; zwraca siłę normalną (normalna w TN)
  const TN = [0, 0, 0]; let TK = 0, TKIND = 0, TVN = 0;
  function terrainContact(sim, b, k, c) {
    const d = terrainSdf(sim, P[0], P[1], P[2]); if (d >= 0) return 0;
    TKIND = TK;
    const e = 2e-4, x = P[0], y = P[1], z = P[2];
    let gx = terrainSdf(sim, x + e, y, z) - terrainSdf(sim, x - e, y, z);
    let gy = terrainSdf(sim, x, y + e, z) - terrainSdf(sim, x, y - e, z);
    let gz = terrainSdf(sim, x, y, z + e) - terrainSdf(sim, x, y, z - e);
    const gl = Math.hypot(gx, gy, gz); if (gl < 1e-12) { gx = 0; gy = 1; gz = 0; } else { gx /= gl; gy /= gl; gz /= gl; }
    TN[0] = gx; TN[1] = gy; TN[2] = gz;
    b.velAt(P, V2); TVN = V2[0] * gx + V2[1] * gy + V2[2] * gz;
    // grunt jest miękki (koło się zapada), podsypka sztywniejsza; obie stawiają opór orania/toczenia
    const soft = TKIND === 2 ? 0.08 : TKIND === 0 ? 0.5 : 1;
    const Fn = normalForce(b, gx, gy, gz, -d, k * soft, c * Math.sqrt(soft));
    if (Fn > 0 && TKIND !== 1) {
      // opór toczenia/orania działa przeciw ruchowi środka ciała (punkt styku toczącego się koła stoi w miejscu)
      const vv = b.v, vn = vv[0] * gx + vv[1] * gy + vv[2] * gz;
      const tx = vv[0] - vn * gx, ty = vv[1] - vn * gy, tz = vv[2] - vn * gz, tm = Math.hypot(tx, ty, tz);
      if (tm > 1e-3) { const cr = (TKIND === 2 ? 0.25 : 0.08) * Fn * Math.min(1, tm / 0.3) / tm; b.f[0] -= tx * cr; b.f[1] -= ty * cr; b.f[2] -= tz * cr; }
    }
    return Fn;
  }

  const EMPTY = [];
  const RING_ANG = [-1.0, -0.66, -0.33, 0, 0.33, 0.66, 1.0].map(a => [Math.cos(a), Math.sin(a)]);
  const CAND = [], CINFO = []; for (let i = 0; i < 16; i++) CINFO.push({ pc: null, fast: false, nx: 0, nz: 0 });
  function wheelCandidates(sim, x0, z0, x1, z1) {   // szyny w komórkach obejmujących wewn. i zewn. krawędź koła
    const grid = sim.track.grid; CAND.length = 0;
    for (let k = 0; k < 2; k++) {
      const x = k ? x1 : x0, z = k ? z1 : z0;
      const a = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)); if (!a) continue;
      for (let i = 0; i < a.length; i++) if (!CAND.includes(a[i])) CAND.push(a[i]);
    }
    return CAND;
  }
  function wheelContacts(sim, ws, sigma) {
    const R = ws.R, ax = R[2], ay = R[5], az = R[8], Rw = ws.Rw, btb = sim.btb;
    const TR = sim.track, pieces = TR.pieces, sw = TR.switches;
    let dx = ax * ay, dy = -1 + ay * ay, dz = az * ay; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    const G = WG; let ng = 0, slHit = false, slV = 0, slX = 0, slY = 0, slZ = 0;
    // kandydaci liczeni raz na koło; zwykła szyna (bez przycięć, iglicy i z dala od końca) idzie szybką ścieżką
    const s0 = sigma * btb, s1 = sigma * (btb + 0.135);
    const cand = wheelCandidates(sim, ws.p[0] + ax * s0 + dx * Rw, ws.p[2] + az * s0 + dz * Rw, ws.p[0] + ax * s1 + dx * Rw, ws.p[2] + az * s1 + dz * Rw);
    let nci = 0;
    const smx = ws.p[0] + ax * sigma * (btb + 0.07) + dx * Rw, smz = ws.p[2] + az * sigma * (btb + 0.07) + dz * Rw;
    for (let q = 0; q < cand.length && nci < CINFO.length; q++) {
      const pc = pieces[cand[q]]; pieceLocal(pc, smx, smz, LO);
      if (LO[1] > 0.3 || LO[1] < -0.3 || LO[0] < -0.5 || LO[0] > pc.len + 0.5) continue;
      const ci = CINFO[nci++]; ci.pc = pc;
      let clipFar = true;
      for (const c of pc.clips) { const cd = c.t === 'z' ? c.s * (c.v - smz) : c.s * (c.v - Math.hypot(smx - c.cx, smz - c.cz)); if (cd > -0.4) { clipFar = false; break; } }
      ci.fast = !pc.blade && clipFar && LO[0] > 0.5 && LO[0] < pc.len - 0.5;
      if (pc.kind === 'line') { ci.nx = -pc.dz; ci.nz = pc.dx; }
    }
    // próg sprawdzania gruntu: przy torze wierzch podkładu, na wyższym terenie (zbocze) jego wysokość
    let gTop = SLEEPER_TOP + 0.03;
    if (sim.groundH) { const gh = sim.groundH(ws.p[0], ws.p[2]); if (gh > SLEEPER_TOP) gTop = gh + 0.6; }
    for (let i = 0; i < SAMPLES.length; i++) {
      const smp = SAMPLES[i], s = sigma * (btb + smp.a), r = Rw + smp.d;
      P[0] = ws.p[0] + ax * s + dx * r; P[1] = ws.p[1] + ay * s + dy * r; P[2] = ws.p[2] + az * s + dz * r;
      const k = K_LINE * smp.da, c = C_LINE * smp.da;
      if (P[1] < gTop && (i % 3 === 0)) {
        // koło zeszło z szyn: łuk obwodu wokół najniższego punktu o podkłady i podsypkę
        const cx = P[0] - dx * r, cy = P[1] - dy * r, cz = P[2] - dz * r;
        const fx = ay * dz - az * dy, fy = az * dx - ax * dz, fz = ax * dy - ay * dx;   // kierunek wzdłuż obwodu
        const kk = k * 3, cc = c * 3;
        for (const [co, si] of RING_ANG) {
          P[0] = cx + r * (dx * co + fx * si); P[1] = cy + r * (dy * co + fy * si); P[2] = cz + r * (dz * co + fz * si);
          const Fn = terrainContact(sim, ws, kk, cc);
          if (Fn > 0) {
            ng = accG(G, ng, -1, Fn, TN[0], TN[1], TN[2]);
            if (TKIND === 1) { slHit = true; if (-TVN > slV) { slV = -TVN; slX = P[0]; slY = P[1]; slZ = P[2]; } }
          }
        }
        P[0] = cx + dx * r; P[1] = cy + dy * r; P[2] = cz + dz * r;
      }
      if (P[1] > 0.013) continue;
      for (let q = 0; q < nci; q++) {
        const ci = CINFO[q], pc = ci.pc;
        let d, gx, gy, gz;
        if (ci.fast) {
          // zwykła szyna: przekrój 2D (poprzecznie, pionowo) + kierunek poprzeczny w tym miejscu
          let lat, nx, nz;
          if (pc.kind === 'line') { lat = (P[0] - pc.ax) * ci.nx + (P[2] - pc.az) * ci.nz; nx = ci.nx; nz = ci.nz; }
          else { const rx = P[0] - pc.cx, rz = P[2] - pc.cz, rho = Math.sqrt(rx * rx + rz * rz); lat = rho - pc.r; nx = rx / rho; nz = rz / rho; }
          if (lat > 0.09 || lat < -0.09) continue;
          const v = P[1] - pc.vOff; d = railSdf(lat, v); if (d >= 0) continue;
          const e = 2e-5, gu = railSdf(lat + e, v) - railSdf(lat - e, v), gv = railSdf(lat, v + e) - railSdf(lat, v - e);
          const gl = Math.hypot(gu, gv); if (gl < 1e-12) continue;
          gx = nx * gu / gl; gy = gv / gl; gz = nz * gu / gl;
        } else {
          d = pieceSdf(pc, P[0], P[1], P[2], sw); if (d >= 0) continue;
          const e = 2e-5;
          gx = pieceSdf(pc, P[0] + e, P[1], P[2], sw) - pieceSdf(pc, P[0] - e, P[1], P[2], sw);
          gy = pieceSdf(pc, P[0], P[1] + e, P[2], sw) - pieceSdf(pc, P[0], P[1] - e, P[2], sw);
          gz = pieceSdf(pc, P[0], P[1], P[2] + e, sw) - pieceSdf(pc, P[0], P[1], P[2] - e, sw);
          const gl = Math.hypot(gx, gy, gz); if (gl < 1e-12) continue; gx /= gl; gy /= gl; gz /= gl;
        }
        const Fn = normalForce(ws, gx, gy, gz, -d, k, c);
        if (Fn > 0) ng = accG(G, ng, pc.id * 2 + (gy > 0.6 ? 0 : 1), Fn, gx, gy, gz);
      }
    }
    // uderzenie koła w drewniany podkład (początek kontaktu)
    const sti = sigma > 0 ? 0 : 1, slt = ws.slTouch || (ws.slTouch = [false, false]);
    if (slHit && !slt[sti]) emit(sim, 'sleeper', slX, slY, slZ, slV / 1.2 + 0.05);
    slt[sti] = slHit;
    let best = -1, bestF = 0;
    for (let j = 0; j < ng; j++) {
      const a = G[j]; const nn = Math.hypot(a[5], a[6], a[7]);
      const kind = a[0] === -1 ? -1 : a[0] % 2;
      addContact(sim, ws, a[2] / a[1], a[3] / a[1], a[4] / a[1], a[5] / nn, a[6] / nn, a[7] / nn, a[1], a[0] === -1 ? MU_GROUND : MU_RAIL, kind);
      if (kind === 0 && a[1] > bestF) { bestF = a[1]; best = a[0] >> 1; }
    }
    // przejście koła na kolejną szynę (styk / krzyżownica)
    const si = sigma > 0 ? 0 : 1, lt = ws.lastTread || (ws.lastTread = [-1, -1, 0, 0]);
    if (best >= 0 && best !== lt[si]) {
      if (lt[si] >= 0 && sim.t - lt[si + 2] > 0.04) {
        const v = Math.hypot(ws.v[0], ws.v[1], ws.v[2]);
        emit(sim, 'joint', ws.p[0] + ax * sigma * 0.75, 0, ws.p[2] + az * sigma * 0.75, (v / 14) * Math.min(1, bestF / 45000) + 0.05 * (v > 0.3));
      }
      lt[si] = best; lt[si + 2] = sim.t;
    }
  }
  const WG = []; for (let i = 0; i < 32; i++) WG.push([0, 0, 0, 0, 0, 0, 0, 0]);
  function accG(G, ng, key, Fn, nx, ny, nz) {
    let j = 0; while (j < ng && G[j][0] !== key) j++;
    if (j === ng) { if (ng >= G.length) return ng; const a = G[ng]; a[0] = key; a[1] = a[2] = a[3] = a[4] = a[5] = a[6] = a[7] = 0; ng++; }
    const a = G[j]; a[1] += Fn; a[2] += P[0] * Fn; a[3] += P[1] * Fn; a[4] += P[2] * Fn; a[5] += nx * Fn; a[6] += ny * Fn; a[7] += nz * Fn;
    return ng;
  }

  // punkty powierzchni pudła do zderzeń pudło–pudło: czoła (3×3) i boki
  function bodyProbe(veh) {
    const [L, Hh, W] = veh.def.dims, y0 = 0.9 - veh.def.comY, out = [];
    for (const sx of [1, -1]) for (const fy of [0.05, 0.5, 0.95]) for (const fz of [-0.48, 0, 0.48]) out.push(sx * L / 2, y0 + fy * Hh, fz * W);
    for (const fx of [-0.25, 0, 0.25]) for (const fy of [0.05, 0.95]) for (const sz of [1, -1]) out.push(fx * L, y0 + fy * Hh, sz * W / 2);
    return out;
  }
  const BQ = [0, 0, 0];
  function bodyCollisions(sim) {
    const V = sim.vehicles;
    for (let i = 0; i < V.length; i++) for (let j = 0; j < V.length; j++) {
      if (i === j) continue;
      const A = V[i], B = V[j], a = A.body, b = B.body;
      const rx = a.p[0] - b.p[0], rz = a.p[2] - b.p[2], lim = (A.def.dims[0] + B.def.dims[0]) / 2 + 1;
      if (rx * rx + rz * rz > lim * lim) continue;
      const pts = A.probe || (A.probe = bodyProbe(A));
      const [L, Hh, W] = B.def.dims, hx = L / 2, hy = Hh / 2, hz = W / 2, yc = 0.9 - B.def.comY + hy;
      for (let k = 0; k < pts.length; k += 3) {
        a.toWorld(pts[k], pts[k + 1], pts[k + 2], P);
        b.dirLocal(P[0] - b.p[0], P[1] - b.p[1], P[2] - b.p[2], BQ);              // punkt A w układzie pudła B
        const qx = Math.abs(BQ[0]) - hx, qy = Math.abs(BQ[1] - yc) - hy, qz = Math.abs(BQ[2]) - hz;
        if (qx >= 0 || qy >= 0 || qz >= 0) continue;
        // wypchnięcie wzdłuż osi najmniejszego zagłębienia
        let ax = 0, ay = 0, az = 0, pen;
        if (qx >= qy && qx >= qz) { ax = Math.sign(BQ[0]); pen = -qx; } else if (qy >= qz) { ay = Math.sign(BQ[1] - yc); pen = -qy; } else { az = Math.sign(BQ[2]); pen = -qz; }
        b.dirWorld(ax, ay, az, Q);                                                // normalna (z B na zewnątrz)
        a.velAt(P, V1); b.velAt(P, V2);
        const vn = (V1[0] - V2[0]) * Q[0] + (V1[1] - V2[1]) * Q[1] + (V1[2] - V2[2]) * Q[2];
        let F = 2e7 * pen - 2e5 * vn; if (F <= 0) continue;
        if (vn < -0.2) emit(sim, 'buffer', P[0], P[1], P[2], -vn / 0.5);
        a.addForceAt(Q[0] * F, Q[1] * F, Q[2] * F, P); b.addForceAt(-Q[0] * F, -Q[1] * F, -Q[2] * F, P);
        addContact(sim, a, P[0], P[1], P[2], Q[0], Q[1], Q[2], F, 0.3, -3, b);
      }
    }
  }
  // punkty kontaktu pudła z gruntem (spód w 5 przekrojach, dach w narożach)
  function bodyCorners(veh) {
    const [L, Hh, W] = veh.def.dims, y0 = 0.9 - veh.def.comY, out = [];
    for (const sx of [1, 0.5, 0, -0.5, -1]) for (const sy of [0, 1]) for (const sz of [1, -1]) {
      if (sy === 1 && Math.abs(sx) < 1) continue;
      out.push(sx * L / 2, y0 + sy * Hh, sz * W / 2);
    }
    return out;
  }
  function stepSim(sim) {
    const ctrl = sim.ctrl, st = sim.st;
    sim.nc = 0;
    for (const s of sim.track.switches) { const d = s.target - s.pos, m = H / 1.6; s.pos += d > m ? m : d < -m ? -m : d; } // napęd zwrotnicowy: 1,6 s
    // --- zawieszenie I stopnia (maźnice) ---
    for (const veh of sim.vehicles) {
      const b = veh.body;
      for (const sp of veh.springs) {
        const ws = sp.ws;
        ws.toWorld(0, 0, sp.wz, P);
        b.toWorld(sp.ax, sp.ay, sp.az, Q);
        b.dirLocal(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2], D);
        const e0 = D[0], e1 = D[1] + sp.L0, e2 = D[2];
        sp.len = -D[1];
        ws.velAt(P, V1); b.velAt(P, V2);
        b.dirLocal(V1[0] - V2[0], V1[1] - V2[1], V1[2] - V2[2], Q);
        let f0 = -sp.k[0] * e0 - sp.c[0] * Q[0];
        let f1 = -sp.k[1] * e1 - sp.c[1] * Q[1];
        let f2 = -sp.k[2] * e2 - sp.c[2] * Q[2];
        const defl = -D[1];
        if (defl < SPRING_LEQ - BUMP) f1 -= 2e7 * ((SPRING_LEQ - BUMP) - defl);   // odbój (ściśnięcie)
        if (defl > SPRING_LEQ + REBOUND) f1 += 2e7 * (defl - SPRING_LEQ - REBOUND);
        b.dirWorld(f0, f1, f2, D);
        ws.addForceAt(D[0], D[1], D[2], P);
        b.addForceAt(-D[0], -D[1], -D[2], P);
      }
    }
    // --- sprzęgi ---
    for (const cp of sim.couplers) {
      if (cp.type === 'knuckle') {
        knuckleMount(cp.ka); knuckleMount(cp.kb); knuckleContact(sim, cp);
        knuckleDyn(sim, cp.ka, cp.ka.body); knuckleDyn(sim, cp.kb, cp.kb.body);
      }
      else { if (cp.lifting && sim.t - cp.liftT > 4) cp.lifting = false; chainStep(cp, sim); }
    }
    // --- zderzaki (tylko ściskanie, sprężyny szeregowo), dowolne pary talerzy zwróconych do siebie ---
    for (const h of sim.bufHeads) h.comp = 0;
    for (const bf of sim.buffers) {
      const A = bf.A.body, B = bf.B.body, la = bf.ha.l, lb = bf.hb.l;
      const ha = A.toWorld(la[0], la[1], la[2], BHA), hb = B.toWorld(lb[0], lb[1], lb[2], BHB);
      let dx = hb[0] - ha[0], dy = hb[1] - ha[1], dz = hb[2] - ha[2];
      bf.F = 0;
      if (dx * dx + dy * dy + dz * dz > 1.0) { bf.on = false; continue; }
      A.dirWorld(bf.ha.e, 0, 0, V1); B.dirWorld(bf.hb.e, 0, 0, V2);           // zewnętrzne kierunki obu czół
      if (V1[0] * V2[0] + V1[1] * V2[1] + V1[2] * V2[2] > -0.7) { bf.on = false; continue; }
      let nx = V1[0] - V2[0], ny = V1[1] - V2[1], nz = V1[2] - V2[2]; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;   // od A ku B
      const gap = dx * nx + dy * ny + dz * nz;
      const off = Math.hypot(dx - gap * nx, dy - gap * ny, dz - gap * nz);
      const dl = -gap;
      if (!(dl > 0 && off < 0.42)) { bf.on = false; continue; }
      P[0] = (ha[0] + hb[0]) / 2; P[1] = (ha[1] + hb[1]) / 2; P[2] = (ha[2] + hb[2]) / 2;
      A.velAt(P, V1); B.velAt(P, V2);
      const rvx = V2[0] - V1[0], rvy = V2[1] - V1[1], rvz = V2[2] - V1[2];
      const vn = rvx * nx + rvy * ny + rvz * nz;                                  // < 0: zbliżanie
      const STROKE = 0.21; // dwa zderzaki po 105 mm
      if (!bf.on) { bf.on = true; emit(sim, 'buffer', P[0], P[1], P[2], -vn / 0.4); }
      if (dl > STROKE && !bf.hard) { bf.hard = true; emit(sim, 'buffer', P[0], P[1], P[2], 0.6 - vn); } else if (dl < STROKE - 0.005) bf.hard = false;
      let F = 7.5e5 * dl - 3e4 * vn; if (dl > STROKE) F += 5e7 * (dl - STROKE);
      if (F < 0) F = 0;
      const c = Math.min(dl, STROKE) / 2; bf.F = F;
      if (c > bf.ha.comp) bf.ha.comp = c; if (c > bf.hb.comp) bf.hb.comp = c;
      // tarcie talerzy
      const tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz, tm = Math.hypot(tx, ty, tz);
      let fx = nx * F, fy = ny * F, fz = nz * F;                                 // siła na B (od A)
      if (tm > 1e-6) { const fr = MU_BUFFER * F * Math.min(1, tm / 0.02) / tm; fx -= tx * fr; fy -= ty * fr; fz -= tz * fr; }
      B.addForceAt(fx, fy, fz, P); A.addForceAt(-fx, -fy, -fz, P);
    }
    // --- zderzenia pudeł (gdy zderzaki się miną: najazd skośny, wykolejenie) ---
    bodyCollisions(sim);
    // --- kontakt koło–szyna ---
    for (const veh of sim.vehicles) for (const ws of veh.ws) { wheelContacts(sim, ws, 1); wheelContacts(sim, ws, -1); }
    // --- pudło o grunt (wykolejenie / przewrócenie) ---
    for (const veh of sim.vehicles) {
      const b = veh.body, cs = veh.corners || (veh.corners = bodyCorners(veh));
      for (let i = 0; i < cs.length; i += 3) {
        b.toWorld(cs[i], cs[i + 1], cs[i + 2], P);
        let top = SLEEPER_TOP + 0.05; if (sim.groundH) { const gh = sim.groundH(P[0], P[2]); if (gh > SLEEPER_TOP) top = gh + 0.6; }
        if (P[1] < top) { const Fn = terrainContact(sim, b, 2e7, 3e5); if (Fn > 0) addContact(sim, b, P[0], P[1], P[2], TN[0], TN[1], TN[2], Fn, MU_GROUND); }
      }
    }
    // --- napęd i hamulec ---
    const loco = sim.vehicles[0];
    loco.body.dirWorld(1, 0, 0, V1);
    st.speed = loco.body.v[0] * V1[0] + loco.body.v[1] * V1[1] + loco.body.v[2] * V1[2];
    const tauUp = 3.0, tauDown = 4.0;
    if (ctrl.brake) st.brakeP += (1 - st.brakeP) * H / tauUp; else st.brakeP += (0 - st.brakeP) * H / tauDown;
    // silnik: stała siła do prędkości bazowej, powyżej stała moc (liczona z obrotów kół)
    const PW = ctrl.power, V_BASE = 4.0, FMAX = PW / V_BASE;
    let Fcmd = 0;
    if (ctrl.brake || ctrl.lock) { st.integ = 0; }
    else {
      const e = ctrl.target - st.speed;
      st.integ += e * H; const imax = FMAX / 8000; if (st.integ > imax) st.integ = imax; if (st.integ < -imax) st.integ = -imax;
      Fcmd = 4e4 * e + 8000 * st.integ; if (Fcmd > FMAX) Fcmd = FMAX; if (Fcmd < -FMAX) Fcmd = -FMAX;
    }
    const nAx = loco.ws.length; st.F = 0;
    for (const ws of loco.ws) {
      ws.dirWorld(0, 0, 1, D);
      const wr = (ws.w[0] - loco.body.w[0]) * D[0] + (ws.w[1] - loco.body.w[1]) * D[1] + (ws.w[2] - loco.body.w[2]) * D[2];
      // obroty maksymalne silnika: moment zanika między 100 a 115 km/h obwodu koła
      const vw = Math.abs(wr) * ws.Rw, VM = 100 / 3.6, rpmF = vw < VM ? 1 : vw > 1.15 * VM ? 0 : 1 - (vw - VM) / (0.15 * VM);
      const Tlim = rpmF * Math.min(FMAX / nAx * ws.Rw, (PW / nAx) / Math.max(Math.abs(wr), 0.5));
      let T = -(Fcmd / nAx) * ws.Rw; if (T > Tlim) T = Tlim; if (T < -Tlim) T = -Tlim;
      st.F += -T / ws.Rw;
      ws.t[0] += D[0] * T; ws.t[1] += D[1] * T; ws.t[2] += D[2] * T;
      loco.body.t[0] -= D[0] * T; loco.body.t[1] -= D[1] * T; loco.body.t[2] -= D[2] * T;
    }
    const TB = 3500; // maks. moment hamujący na zestaw kołowy [N·m]
    const Tmax = ctrl.lock ? 1e7 : st.brakeP * TB;
    // --- całkowanie prędkości ---
    for (const b of sim.bodies) b.integrateVel(H);
    // --- tarcie (Coulomb, impulsowo) + hamulec zestawów ---
    for (const j of sim.joints) j.L = 0;
    const LB = Tmax * H;
    for (let it = 0; it < 6; it++) {
      for (let ci = 0; ci < sim.nc; ci++) { const c = sim.contacts[ci];
        const b = c.b, b2 = c.b2; b.velAt(c.P, V1); const n = c.n;
        if (b2) { b2.velAt(c.P, V2); V1[0] -= V2[0]; V1[1] -= V2[1]; V1[2] -= V2[2]; }
        const vn = V1[0] * n[0] + V1[1] * n[1] + V1[2] * n[2];
        const tx = V1[0] - vn * n[0], ty = V1[1] - vn * n[1], tz = V1[2] - vn * n[2];
        const tm = Math.hypot(tx, ty, tz); if (tm < 1e-10) continue;
        const im = b.invMassAt(c.P, tx / tm, ty / tm, tz / tm) + (b2 ? b2.invMassAt(c.P, tx / tm, ty / tm, tz / tm) : 0);
        let jx = c.J[0] - tx / im, jy = c.J[1] - ty / im, jz = c.J[2] - tz / im;
        const jm = Math.hypot(jx, jy, jz); if (jm > c.lim) { const s = c.lim / jm; jx *= s; jy *= s; jz *= s; }
        b.impulseAt(jx - c.J[0], jy - c.J[1], jz - c.J[2], c.P);
        if (b2) b2.impulseAt(c.J[0] - jx, c.J[1] - jy, c.J[2] - jz, c.P);
        c.J[0] = jx; c.J[1] = jy; c.J[2] = jz;
      }
      if (LB > 0) for (const j of sim.joints) {
        const ws = j.ws, b = j.body; ws.dirWorld(0, 0, 1, D);
        const wr = (ws.w[0] - b.w[0]) * D[0] + (ws.w[1] - b.w[1]) * D[1] + (ws.w[2] - b.w[2]) * D[2];
        const a1 = ws.mulIw(D[0], D[1], D[2], V1), a2 = b.mulIw(D[0], D[1], D[2], V2);
        const iI = D[0] * (a1[0] + a2[0]) + D[1] * (a1[1] + a2[1]) + D[2] * (a1[2] + a2[2]);
        let Ln = j.L - wr / iI; if (Ln > LB) Ln = LB; if (Ln < -LB) Ln = -LB;
        const dL = Ln - j.L; j.L = Ln;
        ws.angImpulse(D[0] * dL, D[1] * dL, D[2] * dL); b.angImpulse(-D[0] * dL, -D[1] * dL, -D[2] * dL);
      }
    }
    // moc tarcia ślizgowego (poślizg bieżni, obrzeże w łuku) — do dźwięku
    for (let ci = 0; ci < sim.nc; ci++) { const c = sim.contacts[ci];
      if (c.kind !== 0 && c.kind !== 1) continue;
      const b = c.b; b.velAt(c.P, V1); const n = c.n;
      const vn = V1[0] * n[0] + V1[1] * n[1] + V1[2] * n[2];
      const vt = Math.hypot(V1[0] - vn * n[0], V1[1] - vn * n[1], V1[2] - vn * n[2]);
      if (c.kind === 0) b.slipP = (b.slipP || 0) + vt * c.Fn * MU_RAIL; else b.flangeP = (b.flangeP || 0) + vt * c.Fn * MU_RAIL;
    }
    for (const b of sim.bodies) b.integratePos(H);
    sim.t += H;
    if (!(sim.vehicles[0].body.p[0] === sim.vehicles[0].body.p[0])) sim.broken = true;   // NaN — rozbieżność obliczeń
  }

  return { createSim, closest, trackAt, railSdf, H };
})();
if (typeof module !== 'undefined') module.exports = PHYS;
