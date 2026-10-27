// ===================== Świat: teren, morze i las =====================
// Teren z mapy LAND (siatka gęsta przy torze, rzadka do brzegu mapy), barwiony jak w laboratorium lądu (LandKit:
// piasek, mokry piasek, trawa, zarośla, skała, dno morza) z detalem tekstury trawy z bliska; morze z falami w szaderze,
// pianą przy brzegu i prześwitującą płycizną; las z PLANTS (pełne modele blisko, imitacje dalej).
function initWorld({ scene, renderer, mat }) {
  const L = LAND, M = L.M, Hh = L.H;

  /* ---------------- teren ---------------- */
  const TERRAIN_HEAD = /* glsl */`
    uniform float uSea, uRelief, uDetAvg;
    varying vec3 vWP; varying vec3 vWN;
    float lnHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
    float lnNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(lnHash(i), lnHash(i + vec2(1, 0)), f.x), mix(lnHash(i + vec2(0, 1)), lnHash(i + vec2(1, 1)), f.x), f.y); }
    float lnFbm(vec2 p) { return lnNoise(p) * 0.5 + lnNoise(p * 2.1 + 3.1) * 0.3 + lnNoise(p * 4.3 + 7.7) * 0.2; }
  `;
  // barwy jak w LandKit (strefa umiarkowana); wysokość liczona od poziomu morza
  const TERRAIN_COLOR = /* glsl */`
    float hh = vWP.y - uSea, up = normalize(vWN).y;
    vec2 q = vWP.xz;
    float fd = length(cameraPosition - vWP);
    float n0 = lnFbm(q * 0.006), n1 = lnFbm(q * 0.035);
    float n2 = mix(0.5, lnFbm(q * 0.31), smoothstep(3500.0, 900.0, fd)), n3 = mix(0.5, lnNoise(q * 2.3), smoothstep(320.0, 60.0, fd));
    float rel = hh / max(uRelief, 1.0);
    vec3 sand = vec3(0.72, 0.64, 0.48) * (0.9 + 0.2 * n2), wetSand = vec3(0.42, 0.37, 0.29);
    vec3 grass = mix(vec3(0.085, 0.14, 0.045), vec3(0.17, 0.21, 0.08), n1);           // soczystsza trawa niż w laboratorium (bliżej kamery)
    grass = mix(grass, vec3(0.24, 0.21, 0.12), smoothstep(0.55, 0.8, n0) * 0.4);
    grass = mix(grass, vec3(0.17, 0.13, 0.12), smoothstep(0.6, 0.85, n2) * 0.25);
    grass *= 0.75 + 0.35 * n2 * (0.7 + 0.3 * n3);
    vec3 scrub = mix(vec3(0.27, 0.25, 0.18), vec3(0.2, 0.2, 0.14), n2) * (0.8 + 0.3 * n3);
    vec3 rock = mix(vec3(0.11, 0.105, 0.095), vec3(0.2, 0.18, 0.15), n1) * (0.8 + 0.3 * n3) * (0.85 + 0.3 * n2);
    vec3 bed = mix(vec3(0.32, 0.29, 0.21), vec3(0.1, 0.12, 0.11), smoothstep(-2.0, -25.0, hh));
    float rough = 0.95;
    vec3 c;
    if (hh < 0.0) { c = mix(bed, rock * 0.6, smoothstep(0.75, 0.55, up) * 0.6); rough = 0.85; }
    else {
      float beach = smoothstep(4.5 + n2 * 2.5, 1.5, hh) * smoothstep(0.82, 0.93, up);
      float veg = smoothstep(0.7, 0.86, up + (n1 - 0.5) * 0.12) * (1.0 - smoothstep(0.45, 0.75, rel + n1 * 0.12));
      c = rock;
      c = mix(c, mix(scrub, grass, smoothstep(0.5, 0.2, rel)), veg);
      c = mix(c, sand, beach);
      float wet = smoothstep(1.4, 0.3, hh) * beach;
      c = mix(c, wetSand, wet); rough = mix(0.95, 0.35, wet);
      c *= 0.82 + 0.18 * smoothstep(0.5, 0.95, up);
    }
    // detal z bliska: jasność tekstury trawy (bez jej koloru)
    float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float avg = uDetAvg;
    diffuseColor.rgb = c * 0.85 * mix(1.0, clamp(lum / avg, 0.7, 1.3), smoothstep(260.0, 25.0, fd));
  `;
  const gm = mat.ground;                                   // tekstura trawy z zestawu TK (kolor, szorstkość, wypukłość)
  for (const t of [gm.map, gm.roughnessMap, gm.bumpMap]) if (t) t.repeat.set(1, 1);
  // średnia jasność tekstury trawy (liniowa): detal tylko moduluje barwę terenu, nie rozjaśnia jej
  let detAvg = 0.12;
  try {
    const img = gm.map && gm.map.image, cx = img && img.getContext && img.getContext('2d');
    if (cx) {
      const d = cx.getImageData(0, 0, img.width, img.height).data, lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      let s = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 17) { s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++; }
      if (n && s > 0) detAvg = s / n;
    }
  } catch (e) { /* bez dostępu do pikseli: wartość domyślna */ }
  const terrainMat = new THREE.MeshStandardMaterial({ map: gm.map, roughnessMap: gm.roughnessMap, bumpMap: gm.bumpMap, bumpScale: 0.02, roughness: 1, metalness: 0 });
  terrainMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSea = { value: L.SEA }; sh.uniforms.uRelief = { value: 85 }; sh.uniforms.uDetAvg = { value: detAvg };
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normal;');
    sh.fragmentShader = TERRAIN_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + TERRAIN_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = rough;');
  };
  terrainMat.customProgramCacheKey = () => 'train-terrain';
  terrainMat.shadowSide = THREE.BackSide;                  // cień rzucają tylko zbocza odwrócone od słońca (bez trądziku na stokach)

  // siatka na węzłach mapy: i0, j0 — pierwszy węzeł, step — co ile węzłów, skip(x0,z0,x1,z1) — pominięcie kwadratu
  function gridMesh(i0, j0, ni, nj, step, drop, skip) {
    const nv = (ni + 1) * (nj + 1), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const at = (i, j) => Hh[Math.min(M - 1, Math.max(0, j)) * M + Math.min(M - 1, Math.max(0, i))];
    let k = 0;
    for (let b = 0; b <= nj; b++) for (let a = 0; a <= ni; a++, k++) {
      const i = i0 + a * step, j = j0 + b * step, x = L.X0 + i * L.C, z = L.Z0 + j * L.C;
      pos[k * 3] = x; pos[k * 3 + 1] = at(i, j) - drop; pos[k * 3 + 2] = z;
      const hx = at(i + step, j) - at(i - step, j), hz = at(i, j + step) - at(i, j - step), e = 2 * step * L.C, l = Math.hypot(hx, e, hz);
      nor[k * 3] = -hx / l; nor[k * 3 + 1] = e / l; nor[k * 3 + 2] = -hz / l;
      uv[k * 2] = x / 5; uv[k * 2 + 1] = z / 5;           // płytka trawy co 5 m
    }
    const idx = [];
    for (let b = 0; b < nj; b++) for (let a = 0; a < ni; a++) {
      const v0 = b * (ni + 1) + a;
      if (skip && skip(pos[v0 * 3], pos[v0 * 3 + 2], pos[(v0 + ni + 2) * 3], pos[(v0 + ni + 2) * 3 + 2])) continue;
      idx.push(v0, v0 + ni + 1, v0 + 1, v0 + 1, v0 + ni + 1, v0 + ni + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  // gęsta siatka (2 m) wokół toru i góry, rzadka (8 m) na całej mapie pod nią (lekko obniżona, zachodzi pod brzeg gęstej)
  const F = { x0: -260, x1: 560, z0: -240, z1: 240 };
  const fi0 = (F.x0 - L.X0) / L.C, fj0 = (F.z0 - L.Z0) / L.C;
  const fine = new THREE.Mesh(gridMesh(fi0, fj0, (F.x1 - F.x0) / L.C, (F.z1 - F.z0) / L.C, 1, 0), terrainMat);
  const coarse = new THREE.Mesh(gridMesh(0, 0, L.N / 4, L.N / 4, 4, 0.35,
    (x0, z0, x1, z1) => x0 >= F.x0 + 8 && x1 <= F.x1 - 8 && z0 >= F.z0 + 8 && z1 <= F.z1 - 8), terrainMat);
  for (const m of [fine, coarse]) { m.receiveShadow = true; m.userData.keepShadow = true; m.name = 'teren'; scene.add(m); }
  fine.castShadow = true; coarse.castShadow = false;

  /* ---------------- morze ---------------- */
  const hd = new Uint16Array(M * M);
  for (let k = 0; k < hd.length; k++) hd[k] = THREE.DataUtils.toHalfFloat(Hh[k]);
  const tLand = new THREE.DataTexture(hd, M, M, THREE.RedFormat, THREE.HalfFloatType);
  tLand.magFilter = tLand.minFilter = THREE.LinearFilter; tLand.generateMipmaps = false; tLand.unpackAlignment = 2; tLand.needsUpdate = true;   // 801 tekseli × 2 B: wiersze nie są wielokrotnością 4 B
  const wu = { tLand: { value: tLand }, uLand: { value: new THREE.Vector4(L.X0, L.Z0, L.C, M) }, uSeaY: { value: L.SEA }, uTime: { value: 0 }, uWave: { value: 1 } };
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0c2c36, roughness: 0.06, metalness: 0, transparent: true });
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wu);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = /* glsl */`
      uniform sampler2D tLand; uniform vec4 uLand; uniform float uSeaY, uTime, uWave;
      varying vec3 vWP;
      float wHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
      float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }
      float landAt(vec2 xz) {
        vec2 g = (xz - uLand.xy) / uLand.z;                       // węzły mapy
        if (g.x < 0.0 || g.y < 0.0 || g.x > uLand.w - 1.0 || g.y > uLand.w - 1.0) return uSeaY - 40.0;
        return texture2D(tLand, (g + 0.5) / uLand.w).r;
      }
      // fale: kilka ciągów fal + drobne zmarszczki, wygaszane z odległością (bez migotania)
      vec2 waveSlope(vec2 p, float t, float fd) {
        vec2 g = vec2(0.0);
        vec2 d1 = normalize(vec2(0.25, 1.0)), d2 = normalize(vec2(-0.6, 1.0)), d3 = normalize(vec2(0.9, 0.7)), d4 = normalize(vec2(-0.2, 1.0));
        g += d1 * 0.022 * cos(dot(d1, p) * 0.21 + t * 1.15);
        g += d2 * 0.018 * cos(dot(d2, p) * 0.33 + t * 1.5 + 1.3);
        g += d3 * 0.014 * cos(dot(d3, p) * 0.57 + t * 1.9 + 2.1) * smoothstep(900.0, 200.0, fd);
        g += d4 * 0.010 * cos(dot(d4, p) * 1.10 + t * 2.7 + 0.4) * smoothstep(400.0, 80.0, fd);
        float e = 0.35, sc = 0.9; vec2 r = p * sc + vec2(t * 0.35, t * 0.22);
        vec2 rn = vec2(wNoise(r + vec2(e, 0.0)) - wNoise(r - vec2(e, 0.0)), wNoise(r + vec2(0.0, e)) - wNoise(r - vec2(0.0, e)));
        g += rn * 0.06 * smoothstep(160.0, 25.0, fd);
        return g * uWave;
      }
    ` + sh.fragmentShader
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        float depth = uSeaY - landAt(vWP.xz);
        float wfd = length(cameraPosition - vWP);
        diffuseColor.rgb = mix(vec3(0.05, 0.27, 0.27), vec3(0.01, 0.05, 0.075), 1.0 - exp(-max(depth, 0.0) / 7.0));
        diffuseColor.a = mix(0.55, 0.96, smoothstep(0.0, 4.0, depth));
        // piana przy brzegu: pasy przypływające do lądu, poszarpane szumem
        float fn = wNoise(vWP.xz * 0.35 + vec2(uTime * 0.25, -uTime * 0.18));
        float foamF = smoothstep(1.4, 0.0, depth + 0.7 * (fn - 0.5)) * (0.55 + 0.45 * sin(depth * 5.0 - uTime * 1.6 + fn * 3.0));
        foamF = clamp(foamF, 0.0, 1.0) * smoothstep(900.0, 150.0, wfd);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.86), foamF * 0.85);
        diffuseColor.a = max(diffuseColor.a, foamF * 0.9);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.85, foamF);')
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
        { vec2 sl = waveSlope(vWP.xz, uTime, wfd); normal = normalize((viewMatrix * vec4(-sl.x, 1.0, -sl.y, 0.0)).xyz); }`);
  };
  waterMat.customProgramCacheKey = () => 'train-water';
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000, 280, 280), waterMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(150, L.SEA, 200); sea.name = 'morze';
  sea.receiveShadow = true; sea.castShadow = false; sea.userData.keepShadow = true; sea.renderOrder = 1;
  scene.add(sea);

  /* ---------------- las ---------------- */
  const wind = PLANTS.windUniforms(); wind.uWind.value = 0.35;
  const light = PLANTS.plantLight();
  const forest = new PLANTS.Forest(renderer, scene, { wind, light, variants: 3, nearCap: 400 });
  forest.nearDist = 80;
  {
    const r = PLANTS.rng(4242), list = [], nrm = [0, 0, 0], step = 7;
    for (let z = L.Z0 + 30; z < L.Z0 + L.SIZE - 30; z += step) for (let x = L.X0 + 30; x < L.X0 + L.SIZE - 30; x += step) {
      const px = x + (r() - 0.5) * step * 0.9, pz = z + (r() - 0.5) * step * 0.9;
      const h = L.height(px, pz); if (h < L.SEA + 2.5) continue;          // nie w morzu ani na plaży
      const dt = L.trackDist(px, pz); if (dt < 12) continue;                // skrajnia i pas wzdłuż toru
      if (L.shoreDist(px, pz) < 14) continue;                               // krawędź skarpy
      if (Math.hypot(px + 22, pz + 56) < 14) continue;                      // przystanek
      L.normal(px, pz, nrm); if (nrm[1] < 0.62) continue;                    // urwiska i strome skały
      const u = (px - L.X0) / L.SIZE, v = (pz - L.Z0) / L.SIZE, fo = L.fbm(u, v, 6, 4, 0.5, 77);
      const onHill = h > 6 && dt > 13;
      let dens = onHill ? 0.5 * (1 - Math.min(1, Math.max(0, (h - 42) / 18))) : 0.04 + 0.85 * Math.min(1, Math.max(0, (fo + 0.02) / 0.25));
      if (r() > dens) continue;
      const pick = r();
      let id;
      if (onHill) id = pick < 0.7 ? 'spruce' : 'pine';
      else if (fo > 0.18) id = pick < 0.45 ? 'spruce' : pick < 0.8 ? 'pine' : 'birch';
      else id = pick < 0.35 ? 'birch' : pick < 0.6 ? 'oak' : pick < 0.8 ? 'pine' : 'juniper';
      list.push({ id, x: px, y: h - 0.1, z: pz, yaw: r() * 6.283, s: 0.75 + 0.45 * r(), v: Math.floor(r() * 3) });
    }
    forest.set(list);
    forest.count = list.length;
  }
  forest.group.traverse(o => { o.userData.keepShadow = true; });

  let tAcc = 0, sortAcc = 1;
  return {
    fine, coarse, sea, forest,
    // wiatr (m/s): kołysanie drzew i wysokość fal
    setWind(w) { wind.uWind.value = 0.12 + w / 16; wu.uWave.value = 0.45 + w / 10; },
    // światło imitacji drzew z tego samego słońca i nieba co scena; mgła sceny
    update(camera, dt, sun, hemi, fog) {
      tAcc += dt; wu.uTime.value = tAcc; wind.uTime.value = tAcc;
      const lu = light;
      lu.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
      lu.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      lu.uSkyCol.value.copy(hemi.color).multiplyScalar(hemi.intensity);
      lu.uGroundCol.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity);
      lu.uFogCol.value.copy(fog.color); lu.uFogNear.value = fog.near; lu.uFogFar.value = fog.far;
      sortAcc += dt;
      if (sortAcc > 0.25) { sortAcc = 0; forest.update(camera); }
    },
  };
}
