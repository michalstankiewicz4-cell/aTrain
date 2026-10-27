// ===================== Tabor: materiały i szczegółowe modele (initStock dostaje materiały sceny) =====================
function initStock(mat) {
  // ===================== Tabor: materiały, szczegółowe modele, efekty =====================
  const TX = {
    hood: TK.steel({ seed: 3, base: [42, 76, 60], cols: 4, rivets: false, stripes: [{ y: 0.80, h: 0.07, color: '#d6c27c' }], grime: 1, rust: 0.4 }),
    cab: TK.steel({ seed: 4, base: [42, 76, 60], cols: 2, rivets: false, stripes: [{ y: 0.52, h: 0.05, color: '#d6c27c' }], grime: 0.9, rust: 0.3 }),
    frame: TK.cast({ seed: 5, base: [30, 29, 28], rust: 0.7 }),
    iron: TK.cast({ seed: 6, base: [26, 26, 27], rust: 1.0 }),
    disc: TK.cast({ seed: 7, base: [44, 34, 28], rust: 1.2 }),
    knuckle: TK.cast({ seed: 8, base: [50, 48, 46], rust: 0.6 }),
    tread: TK.tread({ seed: 9 }),
    hazard: TK.hazard({ seed: 10 }),
    roof: TK.roofing({ seed: 11, base: [74, 76, 78], strips: 4 }),
    tar: TK.roofing({ seed: 12, base: [48, 50, 52], strips: 7 }),
    louvreG: TK.louvre({ seed: 13, base: [30, 52, 42] }),
    louvreB: TK.louvre({ seed: 14, base: [70, 44, 30], n: 10 }),
    brushed: TK.brushed({ seed: 15 }),
    wood: TK.planks({ seed: 16, base: [104, 60, 38], boards: 8 }),
    floor: TK.planks({ seed: 17, base: [62, 48, 36], boards: 10, grime: 1.4 }),
    steel2: TK.steel({ seed: 18, base: [70, 86, 96], cols: 6, rivets: true, grime: 1.1, rust: 0.9 }),
    door2: TK.steel({ seed: 19, base: [70, 86, 96], cols: 1, rivets: false, ribs: 10, grime: 1, rust: 0.7 }),
    roof2: TK.steel({ seed: 20, base: [96, 98, 100], cols: 3, rivets: true, grime: 1.4, rust: 1.2, rough: 170 }),
  };
  const PBR = (t, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: t.map, roughnessMap: t.roughnessMap, bumpMap: t.bumpMap, bumpScale: 0.006, roughness: 1, metalness: 0.15 }, o));
  const SM = {
    hood: PBR(TX.hood, { metalness: 0.25 }), cab: PBR(TX.cab, { metalness: 0.25 }), frame: PBR(TX.frame, { metalness: 0.4 }), iron: PBR(TX.iron, { metalness: 0.4 }),
    disc: PBR(TX.disc, { metalness: 0.5 }), knuckle: PBR(TX.knuckle, { metalness: 0.55 }), tread: PBR(TX.tread, { metalness: 0.6 }), hazard: PBR(TX.hazard, { metalness: 0.2 }),
    roof: PBR(TX.roof), tar: PBR(TX.tar, { metalness: 0 }), louvreG: PBR(TX.louvreG, { metalness: 0.3 }), louvreB: PBR(TX.louvreB, { metalness: 0.2 }),
    steelB: PBR(TX.brushed, { metalness: 0.9, roughness: 0.55 }), wood: PBR(TX.wood, { metalness: 0, bumpScale: 0.01 }), floor: PBR(TX.floor, { metalness: 0 }),
    steel2: PBR(TX.steel2, { metalness: 0.3 }), door2: PBR(TX.door2, { metalness: 0.3, bumpScale: 0.02 }), roof2: PBR(TX.roof2, { metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0d1318, roughness: 0.05, metalness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.22, metalness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0xd2a51f, roughness: 0.5, metalness: 0.25 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa3241a, roughness: 0.5 }),
    gauge: new THREE.MeshStandardMaterial({ color: 0xe8e3d6, roughness: 0.4 }),
  };
  // zwykłe elementy, które dotąd miały gładkie kolory, dostają tekstury
  mat.frame = SM.frame; mat.steel = SM.steelB; mat.wheel = SM.disc; mat.tread = SM.steelB; mat.spring = SM.iron;
  { const s = TK.sleeperWood({ seed: 41 }); Object.assign(mat.sleeper, { map: s.map, roughnessMap: s.roughnessMap, bumpMap: s.bumpMap, bumpScale: 0.01, roughness: 1, color: new THREE.Color(0xffffff) }); }
  { const s = TK.gravel({ seed: 42 }); Object.assign(mat.ballast, { map: s.map, roughnessMap: s.roughnessMap, bumpMap: s.bumpMap, bumpScale: 0.03, roughness: 1, color: new THREE.Color(0xffffff) }); }
  { const s = TK.grass({ seed: 43 }); for (const t of [s.map, s.roughnessMap, s.bumpMap]) t.repeat.set(1600, 1600);
    Object.assign(mat.ground, { map: s.map, roughnessMap: s.roughnessMap, bumpMap: s.bumpMap, bumpScale: 0.02, roughness: 1, color: new THREE.Color(0xffffff) }); }

  // ---- pomocnicze bryły ----
  const part = (g, name) => { let p = g.getObjectByName(name); if (!p) { p = new THREE.Group(); p.name = name; p.userData.part = true; g.add(p); } return p; };
  const put = (par, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); par.add(o); return o; };
  const BX = (par, m, sx, sy, sz, x, y, z, r = 0, tile = 2) => put(par, fitUV(r > 0 ? roundedBox(sx, sy, sz, r, 2) : new THREE.BoxGeometry(sx, sy, sz), tile), m, x, y, z);
  const CX = (par, m, r, len, x, y, z, seg = 16) => put(par, new THREE.CylinderGeometry(r, r, len, seg), m, x, y, z, 0, 0, Math.PI / 2);
  const CY = (par, m, r, len, x, y, z, seg = 16) => put(par, new THREE.CylinderGeometry(r, r, len, seg), m, x, y, z);
  const CZ = (par, m, r, len, x, y, z, seg = 16) => put(par, new THREE.CylinderGeometry(r, r, len, seg), m, x, y, z, Math.PI / 2);
  function tube(par, m, pts, r = 0.02, seg = 10) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.08);
    return put(par, new THREE.TubeGeometry(curve, Math.max(seg, pts.length * seg), r, 8, false), m, 0, 0, 0);
  }
  // listwa/belka w płaszczyźnie (x,y) od punktu a do b
  function strip(par, m, ax, ay, bx, by, z, w = 0.08, d = 0.03) {
    const L = Math.hypot(bx - ax, by - ay); const o = BX(par, m, L, w, d, (ax + bx) / 2, (ay + by) / 2, z); o.rotation.z = Math.atan2(by - ay, bx - ax); return o;
  }
  // poręcz: rura po punktach + słupki do pomostu
  function handrail(par, pts, postsAt, yDeck, r = 0.019) {
    tube(par, SM.rail, pts, r);
    for (const [x, y, z] of postsAt) CY(par, SM.rail, r * 0.9, y - yDeck, x, (y + yDeck) / 2, z, 8);
  }
  function decal(par, tex, w, h, x, y, z, ry = 0) {
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.75, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return put(par, new THREE.PlaneGeometry(w, h), m, x, y, z, 0, ry, 0);
  }
  // stopnie wejściowe: dwa płaskowniki i dwa stopnie z blachy ryflowanej
  function steps(par, x, yTop, z, sideZ) {
    for (const dx of [-0.24, 0.24]) BX(par, SM.iron, 0.04, 0.78, 0.06, x + dx, yTop - 0.39, z);
    for (const yy of [yTop - 0.36, yTop - 0.72]) BX(par, SM.tread, 0.5, 0.035, 0.24, x, yy, z + sideZ * 0.06, 0, 0.5);
  }
  // wąż hamulcowy na czołownicy: rura + gumowy wąż + głowica + kurek
  function brakeHose(par, xEnd, sx, y0, z) {
    CX(par, SM.iron, 0.03, 0.12, xEnd + sx * 0.06, y0, z, 10);
    tube(par, SM.rubber, [[xEnd + sx * 0.1, y0, z], [xEnd + sx * 0.2, y0 - 0.12, z + 0.02], [xEnd + sx * 0.25, y0 - 0.32, z + 0.04], [xEnd + sx * 0.22, y0 - 0.46, z + 0.05]], 0.028, 8);
    BX(par, SM.iron, 0.09, 0.07, 0.11, xEnd + sx * 0.22, y0 - 0.5, z + 0.05);
    BX(par, SM.red, 0.12, 0.025, 0.03, xEnd + sx * 0.06, y0 + 0.05, z + 0.05);
  }
  // klocek hamulcowy przy bieżni koła (wisi na ostoi)
  function brakeShoe(par, xw, side, Rw, yAxle, z, yFrame) {
    const x = xw + side * (Rw + 0.045);
    BX(par, SM.iron, 0.07, 0.3, 0.1, x, yAxle, z);
    BX(par, SM.iron, 0.03, yFrame - yAxle - 0.1, 0.03, x, (yFrame + yAxle) / 2 + 0.05, z);
  }

  // ---- lokomotywa spalinowa manewrowa ----
  function buildLoco(veh, g, y) {
    const d = veh.def, Lb = d.Lb, H = Lb / 2;
    const fr = part(g, 'ostoja'), hood = part(g, 'maska'), cab = part(g, 'kabina'), rails = part(g, 'poręcze'), under = part(g, 'podwozie'), lights = part(g, 'światła');
    // ostoja: podłużnice, pomost z blachy ryflowanej, czołownice w pasy ostrzegawcze
    for (const sz of [1, -1]) BX(fr, SM.frame, Lb - 0.42, 0.42, 0.16, 0, y(1.06), sz * 1.12, 0.015, 3);
    BX(fr, SM.tread, Lb - 0.4, 0.05, 2.92, 0, y(1.295), 0, 0, 1);
    for (const sx of [1, -1]) BX(fr, SM.hazard, 0.2, 0.5, 2.96, sx * (H - 0.1), y(1.07), 0, 0.02, 0.62);
    for (const sx of [1, -1]) for (const sz of [1, -1]) steps(fr, sx * (H - 0.5), y(1.27), sz * 1.27, sz);
    // maska silnika
    const hx0 = -1.4, hx1 = H - 0.45, hl = hx1 - hx0, hcx = (hx0 + hx1) / 2, hy0 = 1.32, hy1 = 3.12, hh = hy1 - hy0;
    BX(hood, SM.hood, hl, hh, 1.95, hcx, y((hy0 + hy1) / 2), 0, 0.07, hl / 4);
    for (const sz of [1, -1]) for (const lx of [-0.5, 1.05, 2.6]) {
      BX(hood, SM.louvreG, 1.15, 0.72, 0.03, lx, y(2.42), sz * 0.988, 0.008, 1.15);
      BX(hood, SM.chrome, 0.05, 0.12, 0.04, lx + 0.66, y(1.95), sz * 0.99);         // klamki drzwi maski
    }
    BX(hood, SM.louvreG, 0.03, 1.05, 1.5, hx1 + 0.012, y(2.1), 0, 0.005, 1.5);       // atrapa chłodnicy z przodu
    CY(hood, SM.frame, 0.56, 0.14, 2.95, y(hy1 + 0.07), 0, 28);                    // wentylator chłodnicy na dachu
    put(hood, new THREE.CircleGeometry(0.5, 28), SM.louvreG, 2.95, y(hy1 + 0.155), 0, -Math.PI / 2);
    CY(hood, SM.iron, 0.12, 0.5, 0.95, y(hy1 + 0.25), 0, 18);                       // komin wydechu
    put(hood, new THREE.TorusGeometry(0.125, 0.02, 8, 18), SM.iron, 0.95, y(hy1 + 0.5), 0, Math.PI / 2);
    BX(hood, SM.iron, 0.3, 0.025, 0.3, 0.95, y(hy1 + 0.6), 0); CY(hood, SM.iron, 0.012, 0.09, 0.95, y(hy1 + 0.55), 0, 6);
    for (const sx of [hx0 + 0.25, hx1 - 0.25]) for (const sz of [0.85, -0.85]) put(hood, new THREE.TorusGeometry(0.05, 0.012, 6, 12), SM.iron, sx, y(hy1 + 0.04), sz, 0, Math.PI / 2);   // ucha
    BX(hood, SM.frame, 0.12, 0.36, 0.36, hx1 + 0.06, y(2.86), 0, 0.03);             // obudowa reflektora
    decal(hood, TK.decal([{ t: 'SM31-017', size: 64, weight: 700 }], { w: 512, h: 96, color: '#f2ead6', align: 'center', bg: '#1b1d1e' }), 0.8, 0.15, hx1 + 0.013 + 0.012, y(2.66), 0, Math.PI / 2);
    // kabina maszynisty
    const cx0 = -H + 0.45, cx1 = hx0 - 0.05, cl = cx1 - cx0, ccx = (cx0 + cx1) / 2, cy0 = 1.32, cy1 = 3.8;
    BX(cab, SM.cab, cl, cy1 - cy0, 2.8, ccx, y((cy0 + cy1) / 2), 0, 0.08, cl);
    BX(cab, SM.roof, cl + 0.2, 0.12, 3.0, ccx, y(cy1 + 0.06), 0, 0.04, 3);
    for (const sz of [1, -1]) BX(cab, SM.iron, cl + 0.2, 0.04, 0.05, ccx, y(cy1 + 0.0), sz * 1.5);   // rynny
    const pane = (px, py, pz, w, h, nx) => {                       // okno: uszczelka + szyba
      if (nx) { BX(cab, SM.rubber, 0.03, h + 0.07, w + 0.07, px, py, pz); BX(cab, SM.glass, 0.012, h, w, px + nx * 0.018, py, pz); }
      else { const s = Math.sign(pz); BX(cab, SM.rubber, w + 0.07, h + 0.07, 0.03, px, py, pz); BX(cab, SM.glass, w, h, 0.012, px, py, pz + s * 0.018); }
    };
    for (const sz of [1, -1]) {
      pane(cx1 - 0.42, y(3.1), sz * 1.415, 0.62, 0.66);
      pane(cx0 + 0.42, y(3.1), sz * 1.415, 0.62, 0.66);
      BX(cab, SM.cab, 0.86, 2.0, 0.03, ccx, y(2.34), sz * 1.415, 0.01, 0.86);          // drzwi
      pane(ccx, y(3.0), sz * 1.435, 0.5, 0.6);
      for (const dx of [-0.53, 0.53]) tube(cab, SM.rail, [[ccx + dx, y(1.6), sz * 1.43], [ccx + dx, y(1.62), sz * 1.5], [ccx + dx, y(2.7), sz * 1.5], [ccx + dx, y(2.72), sz * 1.43]], 0.016);
      steps(fr, ccx, y(1.27), sz * 1.36, sz);
      pane(cx1 + 0.016, y(3.42), sz * 0.66, 0.95, 0.5, 1);                           // przednie okna nad maską
      BX(cab, SM.iron, 0.012, 0.025, 0.55, cx1 + 0.05, y(3.25), sz * 0.66).rotation.x = sz * 0.5;   // wycieraczki
      BX(cab, SM.iron, 0.22, 0.02, 1.0, cx1 + 0.12, y(3.72), sz * 0.66).rotation.z = -0.25;       // daszki
      pane(cx0 - 0.016, y(3.1), sz * 0.66, 0.95, 0.66, -1);                           // tylne okna
    }
    put(cab, new THREE.ConeGeometry(0.06, 0.32, 12, 1, true), SM.chrome, ccx + 0.6, y(cy1 + 0.2), 0.35, 0, 0, -Math.PI / 2);   // syreny
    put(cab, new THREE.ConeGeometry(0.05, 0.26, 12, 1, true), SM.chrome, ccx + 0.6, y(cy1 + 0.2), -0.35, 0, 0, -Math.PI / 2);
    BX(cab, SM.iron, 0.1, 0.1, 0.9, ccx + 0.55, y(cy1 + 0.15), 0);
    CY(cab, SM.iron, 0.008, 0.9, ccx - 0.6, y(cy1 + 0.6), -0.9, 6); CY(cab, SM.iron, 0.04, 0.06, ccx - 0.6, y(cy1 + 0.13), -0.9, 10);   // antena
    BX(cab, SM.louvreG, 0.5, 0.12, 0.5, ccx - 0.2, y(cy1 + 0.18), 0.6, 0.02, 0.5);   // wywietrznik
    decal(cab, TK.decal([{ t: 'SM31-017', size: 58, weight: 700 }, { t: 'LAB RAIL · LOKOMOTYWOWNIA WARSZAWA', size: 20 }], { w: 512, h: 110, color: '#efe6cf' }), 0.95, 0.2, cx1 - 0.55, y(2.12), 1.416);
    decal(cab, TK.decal([{ t: 'SM31-017', size: 58, weight: 700 }, { t: 'LAB RAIL · LOKOMOTYWOWNIA WARSZAWA', size: 20 }], { w: 512, h: 110, color: '#efe6cf' }), 0.95, 0.2, cx1 - 0.55, y(2.12), -1.416, Math.PI);
    decal(hood, TK.decal([{ t: 'Vmax 60 km/h', size: 26 }, { t: 'Masa 22 t · 300 kW', size: 22 }, { t: 'Rew. P4 · 2026', size: 22 }], { w: 256, h: 110 }), 0.42, 0.18, hx1 - 0.35, y(1.62), 0.976);
    // poręcze wzdłuż pomostu i z przodu
    const ry = y(2.32), yd = y(1.32), rz = 1.36, rx1 = hx1 + 0.38;
    handrail(rails, [[cx1 + 0.05, ry, rz], [rx1, ry, rz], [rx1, ry, -rz], [cx1 + 0.05, ry, -rz]], [[hx0 + 0.1, ry, rz], [1.2, ry, rz], [2.8, ry, rz], [rx1, ry, rz], [hx0 + 0.1, ry, -rz], [1.2, ry, -rz], [2.8, ry, -rz], [rx1, ry, -rz]], yd);
    handrail(rails, [[cx0 - 0.3, y(2.2), 1.36], [cx0 - 0.3, y(2.2), -1.36]], [[cx0 - 0.3, y(2.2), 1.36], [cx0 - 0.3, y(2.2), -1.36]], yd);
    // podwozie: zbiornik paliwa, zbiorniki powietrza, akumulatory, piasecznice, klocki hamulcowe
    BX(under, SM.frame, 3.0, 0.44, 1.8, 0, y(0.64), 0, 0.14, 3);
    for (const sx of [-0.8, 0.8]) BX(under, SM.iron, 0.06, 0.48, 1.86, sx, y(0.64), 0);
    CZ(under, SM.chrome, 0.07, 0.06, -0.9, y(0.8), 0.92, 14); BX(under, SM.gauge, 0.22, 0.12, 0.01, 0.6, y(0.66), 0.905);
    for (const sz of [0.55, -0.55]) CX(under, SM.frame, 0.14, 2.4, 0, y(1.08), sz, 18);
    BX(under, SM.frame, 0.8, 0.5, 1.8, -H + 1.0, y(0.98), 0, 0.03, 1);
    for (const ws of veh.ws) {
      const xw = ws.p[0] - veh.body.p[0], out = Math.sign(xw), Rw = ws.Rw;
      for (const sz of [1, -1]) {
        BX(under, SM.frame, 0.3, 0.34, 0.2, xw + out * 0.72, y(1.0), sz * 1.25, 0.02, 0.5);
        tube(under, SM.iron, [[xw + out * 0.72, y(0.83), sz * 1.24], [xw + out * 0.68, y(0.5), sz * 1.0], [xw + out * 0.62, y(0.12), sz * 0.76]], 0.02, 6);
        brakeShoe(under, xw, out, Rw, y(Rw), sz * 0.75, y(1.27));
        brakeShoe(under, xw, -out, Rw, y(Rw), sz * 0.75, y(1.27));
      }
    }
    for (const sx of [1, -1]) brakeHose(fr, sx * H, sx, y(0.98), 0.42);
    // światła
    const lamp = (m, r, x, yy, z) => { CX(lights, SM.frame, r + 0.025, 0.06, x - 0.03, yy, z, 18); return CX(lights, m, r, 0.03, x, yy, z, 18); };
    for (const sz of [1, -1]) { BX(lights, SM.frame, 0.14, 0.4, 0.16, H - 0.12, y(1.52), sz * 0.95, 0.02, 0.4); lamp(mat.lampW, 0.085, H - 0.01, y(1.72), sz * 0.95); }   // lampy na wspornikach na czołownicy
    lamp(mat.lampW, 0.14, hx1 + 0.16, y(2.86), 0);
    return { smoke: [0.95, y(hy1 + 0.62), 0], head: [hx1 + 0.18, y(2.86), 0], white: [[H + 0.04, y(1.72), 0.95], [H + 0.04, y(1.72), -0.95]] };
  }

  // ---- ostoja wagonu (wspólna): podłużnice, czołownice, podłoga, ściągi, klocki, stopnie ----
  function wagonFrame(veh, g, y, i) {
    const d = veh.def, Lb = d.Lb, H = Lb / 2, fr = part(g, 'ostoja'), under = part(g, 'podwozie');
    for (const sz of [1, -1]) BX(fr, SM.iron, Lb - 0.36, 0.3, 0.14, 0, y(1.12), sz * 1.05, 0.012, 3);
    for (const sx of [1, -1]) BX(fr, SM.iron, 0.18, 0.44, 2.92, sx * (H - 0.09), y(1.08), 0, 0.02, 0.8);
    BX(fr, SM.floor, Lb - 0.36, 0.08, 2.84, 0, y(1.31), 0, 0, 1.4);
    for (const sz of [0.96, -0.96]) {                                               // ściągi z kozłami (końce w podłużnicach)
      tube(under, SM.iron, [[H - 0.9, y(1.0), sz], [1.0, y(0.6), sz], [-1.0, y(0.6), sz], [-H + 0.9, y(1.0), sz]], 0.022, 6);
      for (const sx of [1, -1]) CY(under, SM.iron, 0.025, 0.4, sx * 1.0, y(0.8), sz, 8);
    }
    for (const ws of veh.ws) {
      const xw = ws.p[0] - veh.body.p[0], Rw = ws.Rw;
      for (const sz of [1, -1]) for (const side of [1, -1]) brakeShoe(under, xw, side, Rw, y(Rw), sz * 0.75, y(1.27));
    }
    for (const sx of [1, -1]) { brakeHose(fr, sx * H, sx, y(0.98), 0.42); for (const sz of [1, -1]) steps(fr, sx * (H - 0.45), y(1.27), sz * 1.2, sz); }
  }
  // ---- wagon kryty drewniany (W1): deski w stalowej ramie, drzwi przesuwne, dach z papy ----
  function buildWoodVan(veh, g, y, i) {
    wagonFrame(veh, g, y, i);
    const Lb = veh.def.Lb, H = Lb / 2, bx = H - 0.25, body = part(g, 'pudło'), iron = part(g, 'okucia'), roof = part(g, 'dach');
    const by0 = 1.35, by1 = 3.62, bym = (by0 + by1) / 2, bh = by1 - by0, Z = 1.40;
    BX(body, SM.wood, 2 * bx, bh, 2 * Z, 0, y(bym), 0, 0.02, 1.6);
    for (const sz of [1, -1]) {
      const zf = sz * (Z + 0.018);
      for (const yy of [by0 + 0.05, by1 - 0.05]) BX(iron, SM.iron, 2 * bx + 0.04, 0.1, 0.04, 0, y(yy), zf);
      for (const xp of [-bx, -2.7, -1.05, 1.05, 2.7, bx]) BX(iron, SM.iron, 0.09, bh - 0.04, 0.06, xp, y(bym), zf);
      for (const [a, b] of [[-bx, -2.7], [-2.7, -1.05], [1.05, 2.7], [2.7, bx]]) strip(iron, SM.iron, a, y(by0 + 0.1), b, y(by1 - 0.1), zf, 0.075, 0.02);
      const zd = sz * (Z + 0.05);                                                     // drzwi przesuwne
      BX(body, SM.wood, 1.95, 2.06, 0.04, 0, y(bym - 0.02), zd, 0.01, 1.6);
      for (const yy of [by0 + 0.09, by1 - 0.13]) BX(iron, SM.iron, 1.99, 0.08, 0.03, 0, y(yy), zd + sz * 0.03);
      for (const xx of [-0.97, 0.97]) BX(iron, SM.iron, 0.08, 2.06, 0.03, xx, y(bym - 0.02), zd + sz * 0.03);
      strip(iron, SM.iron, -0.93, y(by0 + 0.14), 0.93, y(by1 - 0.18), zd + sz * 0.025, 0.07, 0.012);
      strip(iron, SM.iron, -0.93, y(by1 - 0.18), 0.93, y(by0 + 0.14), zd + sz * 0.037, 0.07, 0.012);
      BX(iron, SM.iron, 4.1, 0.07, 0.07, 1.0, y(by1 - 0.02), sz * (Z + 0.1));        // szyna drzwi
      BX(iron, SM.iron, 4.1, 0.05, 0.05, 1.0, y(by0 + 0.02), sz * (Z + 0.09));
      tube(iron, SM.iron, [[0.82, y(1.9), zd + sz * 0.05], [0.82, y(1.92), zd + sz * 0.11], [0.82, y(2.48), zd + sz * 0.11], [0.82, y(2.5), zd + sz * 0.05]], 0.016);
      for (const xv of [-3.55, 3.55]) BX(body, SM.louvreB, 0.55, 0.32, 0.03, xv, y(3.28), sz * (Z + 0.04), 0.008, 0.55);   // wywietrzniki
      const lab = TK.decal([{ t: '21 51 150 3 512-6', size: 34, weight: 700 }, { t: 'Gkks · LAB RAIL', size: 26 }, { t: 'Tara 12,0 t   Ładowność 25 t', size: 20 }, { t: 'Rew. 04.2026 · WAR', size: 20 }], { w: 512, h: 150 });
      decal(body, lab, 1.15, 0.34, sz * -2.0, y(1.75), sz * (Z + 0.006), sz > 0 ? 0 : Math.PI);
      decal(body, TK.decal([{ t: 'MAX 20 t', size: 40, weight: 700 }], { w: 256, h: 56 }), 0.4, 0.09, sz * -0.2, y(3.15), zd + sz * 0.022, sz > 0 ? 0 : Math.PI);
    }
    for (const sx of [1, -1]) {
      const xf = sx * (bx + 0.03);
      for (const zp of [-Z + 0.06, -0.7, 0.7, Z - 0.06]) BX(iron, SM.iron, 0.06, bh - 0.04, 0.09, xf, y(bym), zp);
      for (const yy of [by0 + 0.05, by1 - 0.05]) BX(iron, SM.iron, 0.04, 0.1, 2 * Z - 0.12, sx * (bx + 0.032), y(yy), 0);
    }
    for (let k = 0; k < 6; k++) BX(iron, SM.rail, 0.04, 0.03, 0.42, -(bx + 0.06), y(1.6 + k * 0.33), -0.92);   // drabinka na czole
    for (const zz of [-0.7, -1.14]) BX(iron, SM.rail, 0.03, 1.8, 0.03, -(bx + 0.06), y(2.42), zz);
    // ręczny hamulec: koło na czole
    put(iron, new THREE.TorusGeometry(0.2, 0.018, 8, 24), SM.iron, bx + 0.09, y(2.3), 0.85, 0, Math.PI / 2);
    for (let k = 0; k < 3; k++) put(iron, new THREE.CylinderGeometry(0.01, 0.01, 0.36, 6), SM.iron, bx + 0.082 + k * 0.008, y(2.3), 0.85, k * Math.PI / 3);
    CX(iron, SM.iron, 0.025, 0.12, bx + 0.04, y(2.3), 0.85, 8); CX(iron, SM.iron, 0.045, 0.05, bx + 0.09, y(2.3), 0.85, 12);
    // dach z papy (łuk walca) + listwy brzegowe
    const rg = new THREE.CylinderGeometry(3.2, 3.2, 2 * bx + 0.3, 40, 1, true, Math.PI / 2 - 0.45, 0.9); rg.rotateZ(Math.PI / 2);
    const rgeo = rg; const uvA = rgeo.attributes.uv, pA = rgeo.attributes.position; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, pA.getX(k) / 2, pA.getZ(k) / 2);
    SM.tar.side = THREE.DoubleSide; put(roof, rgeo, SM.tar, 0, y(by1 + 0.1) - 3.2 + (3.2 - 3.2 * Math.cos(0.45)), 0);
    for (const sz of [1, -1]) BX(roof, SM.iron, 2 * bx + 0.3, 0.06, 0.06, 0, y(by1 + 0.05), sz * (Z + 0.02));
    return { red: null };
  }
  // ---- wagon kryty stalowy (W2): żebrowane ściany, drzwi z przetłoczeniami, klapy, dach blaszany ----
  function buildSteelVan(veh, g, y, i, last) {
    wagonFrame(veh, g, y, i);
    const Lb = veh.def.Lb, H = Lb / 2, bx = H - 0.25, body = part(g, 'pudło'), ribs = part(g, 'żebra'), roof = part(g, 'dach'), lights = part(g, 'światła');
    const by0 = 1.35, by1 = 3.62, bym = (by0 + by1) / 2, bh = by1 - by0, Z = 1.40;
    BX(body, SM.steel2, 2 * bx, bh, 2 * Z, 0, y(bym), 0, 0.04, 2.4);
    for (const sz of [1, -1]) {
      const zr = sz * (Z + 0.022);
      for (let xr = -bx + 0.3; xr < bx - 0.2; xr += 0.62) if (Math.abs(xr) > 1.15) BX(ribs, SM.steel2, 0.07, bh - 0.12, 0.045, xr, y(bym), zr, 0.012, 0.5);
      for (const yy of [by0 + 0.04, by1 - 0.04]) BX(ribs, SM.steel2, 2 * bx + 0.04, 0.09, 0.05, 0, y(yy), zr);
      const zd = sz * (Z + 0.055);
      BX(body, SM.door2, 2.0, 2.08, 0.04, 0, y(bym - 0.02), zd, 0.01, 2.0);
      BX(ribs, SM.iron, 4.2, 0.08, 0.08, 1.05, y(by1 - 0.01), sz * (Z + 0.1));
      tube(ribs, SM.iron, [[0.85, y(1.9), zd + sz * 0.02], [0.85, y(1.92), zd + sz * 0.09], [0.85, y(2.5), zd + sz * 0.09], [0.85, y(2.52), zd + sz * 0.02]], 0.016);
      for (const xv of [-3.2, -2.0, 2.0, 3.2]) {                                    // klapy wentylacyjne z zawiasami
        BX(body, SM.steel2, 0.6, 0.36, 0.035, xv, y(3.25), sz * (Z + 0.05), 0.01, 0.6);
        for (const dx of [-0.2, 0.2]) CX(ribs, SM.iron, 0.02, 0.1, xv + dx, y(3.44), sz * (Z + 0.07), 8);
      }
      decal(body, TK.decal([{ t: '31 51 289 0 117-4', size: 34, weight: 700 }, { t: 'Hbbins · LAB RAIL', size: 26 }, { t: 'Tara 14,5 t', size: 20 }], { w: 512, h: 120 }), 1.1, 0.26, sz * -2.6, y(1.72), sz * (Z + 0.05), sz > 0 ? 0 : Math.PI);
      decal(body, TK.decal([{ t: 'UWAGA', size: 30, weight: 700 }, { t: 'nie spychać z górki', size: 22 }], { w: 256, h: 80, color: '#111', bg: '#e6c02a' }), 0.42, 0.13, sz * 2.6, y(1.62), sz * (Z + 0.05), sz > 0 ? 0 : Math.PI);
    }
    for (const sx of [1, -1]) {
      const xf = sx * (bx + 0.022);
      for (const zp of [-1.0, -0.35, 0.35, 1.0]) BX(ribs, SM.steel2, 0.045, bh - 0.12, 0.07, xf, y(bym), zp, 0.012, 0.5);
    }
    for (let k = 0; k < 6; k++) BX(ribs, SM.rail, 0.04, 0.03, 0.42, bx + 0.07, y(1.6 + k * 0.33), 0.92);
    for (const zz of [0.7, 1.14]) BX(ribs, SM.rail, 0.03, 1.8, 0.03, bx + 0.07, y(2.42), zz);
    const rg = new THREE.CylinderGeometry(3.2, 3.2, 2 * bx + 0.24, 40, 1, true, Math.PI / 2 - 0.45, 0.9); rg.rotateZ(Math.PI / 2);
    { const uvA = rg.attributes.uv, pA = rg.attributes.position; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, pA.getX(k) / 2.4, pA.getZ(k) / 2.4); }
    SM.roof2.side = THREE.DoubleSide;
    const ryc = y(by1 + 0.1) - 3.2 + (3.2 - 3.2 * Math.cos(0.45));
    put(roof, rg, SM.roof2, 0, ryc, 0);
    for (const a of [-0.32, 0.32]) CX(roof, SM.roof2, 0.025, 2 * bx + 0.24, 0, ryc + 3.215 * Math.cos(a), 3.215 * Math.sin(a), 8);
    for (let xs = -bx + 0.6; xs < bx; xs += 1.2) { const pts = []; for (let k = 0; k <= 12; k++) { const f = -0.44 + 0.88 * k / 12; pts.push([xs, ryc + 3.21 * Math.cos(f), 3.21 * Math.sin(f)]); } tube(roof, SM.roof2, pts, 0.018, 4); }
    if (last) {
      const lamp = (x, yy, z) => { CX(lights, SM.frame, 0.105, 0.06, x + 0.03, yy, z, 18); CX(lights, mat.lampR, 0.08, 0.03, x, yy, z, 18); };
      for (const sz of [1, -1]) lamp(-(bx + 0.06), y(1.72), sz * 0.68);       // lampy końca składu na ścianie czołowej (między żebrami)
      return { red: [[-(bx + 0.12), y(1.72), 0.68], [-(bx + 0.12), y(1.72), -0.68]] };
    }
    return { red: null };
  }
  return { SM, TX, buildLoco, buildWoodVan, buildSteelVan };
}
