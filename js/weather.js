// ===================== Pogoda: niebo z chmurami, deszcz, błyskawice, zmienne warunki =====================
// Niebo, chmury, mgła i deszcz przeniesione z laboratorium wyglądu i wody (repo Battle: SkyKit i RainKit),
// dostosowane do three.js r147. Pora dnia, słońce, księżyc i gwiazdy zostają z symulatora; pogoda dokłada chmury,
// przyciemnia słońce, skraca widoczność, pada deszcz, bije piorun. „Zmienne warunki” same przechodzą między pogodami.
function initWeather({ scene, renderer }) {
  const WEATHER = {
    clear: { label: 'Bezchmurnie', coverage: 0.08, density: 0.25, haze: 0.18, wind: 4, scale: 1.0, rain: 0, vis: 25, lightning: 0 },
    fair: { label: 'Pogodnie', coverage: 0.35, density: 0.35, haze: 0.25, wind: 6, scale: 1.0, rain: 0, vis: 20, lightning: 0 },
    broken: { label: 'Zachmurzenie', coverage: 0.6, density: 0.55, haze: 0.3, wind: 9, scale: 0.9, rain: 0, vis: 15, lightning: 0 },
    overcast: { label: 'Pochmurno', coverage: 0.86, density: 0.72, haze: 0.42, wind: 11, scale: 0.8, rain: 0, vis: 10, lightning: 0 },
    rain: { label: 'Deszcz', coverage: 0.94, density: 0.78, haze: 0.5, wind: 10, scale: 0.8, rain: 0.55, vis: 4, lightning: 0 },
    fog: { label: 'Mgła', coverage: 0.75, density: 0.35, haze: 0.7, wind: 3, scale: 0.9, rain: 0, vis: 0.4, lightning: 0 },
    storm: { label: 'Burza', coverage: 0.97, density: 0.95, haze: 0.6, wind: 18, scale: 0.7, rain: 0.9, vis: 2.5, lightning: 0.6 },
  };
  const KEYS = ['coverage', 'density', 'haze', 'wind', 'scale', 'rain', 'vis', 'lightning'];
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------------- niebo (SkyKit) ---------------- */
  const u = {
    uSkySun: { value: new THREE.Vector3(0, 1, 0) }, uSkySunCol: { value: new THREE.Color(1, 0.95, 0.85) },
    uSkyHor: { value: new THREE.Color(0xc9d7e2) }, uSkyZen: { value: new THREE.Color(0x3d6c9a) }, uSkyLow: { value: new THREE.Color(0x1d3a4c) },
    uCloud: { value: new THREE.Vector4(0.4, 0.4, 1, 0.3) }, uCloudOff: { value: new THREE.Vector2() },
    uSkyFog: { value: new THREE.Vector3(0, 0, 0) }, uSkyCloud: { value: new THREE.Color(1, 0.99, 0.97) },
    uSkyGlow: { value: new THREE.Color(0, 0, 0) }, uSkyBolt: { value: new THREE.Vector4(0, 0, 1, 0) },
    uSkyMoon: { value: new THREE.Vector3(0, -1, 0) }, uSkyNight: { value: new THREE.Vector2(0, 0) },
  };
  const GLSL_SKY = /* glsl */`
uniform vec3 uSkySun, uSkySunCol, uSkyHor, uSkyZen, uSkyLow;
uniform vec4 uCloud; uniform vec2 uCloudOff; uniform vec3 uSkyFog, uSkyCloud, uSkyGlow, uSkyMoon; uniform vec2 uSkyNight; uniform vec4 uSkyBolt;
float skHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float skNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skHash(i), skHash(i + vec2(1, 0)), f.x), mix(skHash(i + vec2(0, 1)), skHash(i + vec2(1, 1)), f.x), f.y); }
float skFbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * skNoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
vec2 skClouds(vec3 d) {
  if (d.y < 0.005) return vec2(0.0);
  vec2 p = d.xz / (d.y + 0.08) * 0.9 * uCloud.z + uCloudOff;
  float n = skFbm(p * 0.38) * 0.62 + skFbm(p * 1.6 + 3.7) * 0.28 + skFbm(p * 5.0 + 1.1) * 0.1;
  float cov = uCloud.x;
  float c = smoothstep(1.0 - cov - 0.05, 1.0 - cov + 0.22, n);
  float lit = clamp((skFbm(p * 0.38 + uSkySun.xz * 0.5) - n) * 2.2 + 0.5, 0.0, 1.0);
  return vec2(c * smoothstep(0.005, 0.12, d.y), lit);
}
vec3 skyColor(vec3 d) {
  float h = d.y, s = max(dot(d, uSkySun), 0.0), cov = uCloud.x, den = uCloud.y, haze = uCloud.w;
  vec3 zen = mix(uSkyZen, uSkyHor * 0.82, cov * 0.85);
  vec3 col = h > 0.0 ? mix(uSkyHor, zen, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(uSkyHor, uSkyLow, clamp(-h * 6.0, 0.0, 1.0));
  vec2 hz = normalize(d.xz + 1e-5), sz = normalize(uSkySun.xz + 1e-5);
  col += uSkyGlow * (pow(max(dot(hz, sz), 0.0), 3.0) * 0.8 + 0.2) * smoothstep(0.45, 0.0, h) * step(-0.02, h);
  float mo = dot(d, uSkyMoon);
  vec2 cl = skClouds(d);
  float shade = mix(0.95, 0.3, den) * (0.45 + 0.75 * cl.y) * mix(1.0, 0.7, smoothstep(0.6, 1.0, cl.x) * den);
  vec3 cloud = mix(uSkyHor * 0.3 + uSkyCloud * 0.04, uSkyCloud, shade) * mix(1.0, 0.72, den * cov);
  cloud += vec3(0.5, 0.55, 0.65) * uSkyNight.y * pow(max(mo, 0.0), 8.0) * 0.12 * (cl.x * (1.0 - cl.x)) * 4.0;
  cloud += uSkySunCol * pow(s, 6.0) * (cl.x * (1.0 - cl.x)) * 3.2 * (1.0 - den * 0.6);
  cloud += uSkySunCol * pow(s, 3.0) * 0.18 * cl.y;
  col = mix(col, cloud, cl.x);
  if (uSkyBolt.w > 0.0) {
    float near = pow(max(dot(d, uSkyBolt.xyz), 0.0), 6.0);
    col += vec3(0.72, 0.78, 1.0) * uSkyBolt.w * (0.06 + 0.94 * near) * (0.25 + cl.x) * step(-0.02, h);
  }
  col = mix(col, uSkyHor, smoothstep(0.18 + haze * 0.2, 0.0, abs(h)) * haze);
  float through = 1.0 - smoothstep(0.15, 0.85, cl.x);
  if (uSkyFog.z > 0.0 && h > -0.02) {
    float a = atan(d.x, d.z);
    float cell = skFbm(vec2(a * 2.2 + uCloudOff.x * 0.15, 3.1));
    float streak = skNoise(vec2(a * 260.0, h * 6.0 + uCloudOff.y * 2.0));
    float curtain = smoothstep(0.42, 0.7, cell) * smoothstep(0.32, 0.01, h) * uSkyFog.z;
    col = mix(col, uSkyHor * 0.62 + vec3(0.02), curtain * (0.55 + 0.25 * streak));
  }
  col += uSkySunCol * (pow(s, 1800.0) * 60.0 * through * smoothstep(-0.012, 0.004, uSkySun.y) * smoothstep(0.35, 0.0, uSkyFog.z) + pow(s, 12.0) * 0.35 * (0.4 + 0.6 * through) * (1.0 - uSkyFog.z * 0.7));
  if (uSkyFog.x > 0.0) {
    float path = uSkyFog.y / max(h, 0.015);
    float f = 1.0 - exp(-pow(path * uSkyFog.x, 2.0));
    vec3 fogCol = uSkyHor + uSkySunCol * pow(s, 4.0) * 0.25;
    col = mix(col, fogCol, f);
    col += uSkySunCol * pow(s, 400.0) * 1.5 * f * (1.0 - f) * 4.0 * (1.0 - uSkyFog.z);
  }
  return col;
}
`;
  const VS = 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const FS = GLSL_SKY + 'varying vec3 vD;void main(){gl_FragColor=vec4(skyColor(normalize(vD)),1.);}';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3500, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u, vertexShader: VS, fragmentShader: FS }));
  dome.frustumCulled = false; dome.renderOrder = -3; dome.name = 'niebo'; dome.userData.keepShadow = true;
  scene.add(dome);
  // odbicia i światło otoczenia materiałów z tego samego nieba (odświeżane, gdy pogoda się zmienia)
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: u, vertexShader: VS, fragmentShader: FS })));
  let envRT = null;
  function refreshEnv() {
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(envScene, 0.02); pm.dispose();
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
  }

  // kolory nieba dla wysokości słońca i pogody (SkyKit applySky, bez księżyca i gwiazd — te rysuje symulator)
  const C = (h) => new THREE.Color(h), tmp = new THREE.Color();
  function applySky(sunDir, sunEl, W) {
    const { coverage, density, scale, haze, rain, vis } = W, R = Math.PI / 180, el = sunEl * R;
    const day = sm(-7, 5, sunEl), twi = sm(-12, -1, sunEl), low = 1 - Math.min(1, Math.max(0, el) / 0.45), dusk = sm(-8, -1, sunEl) * (1 - sm(4, 14, sunEl));
    const sunCol = new THREE.Color(1, 0.94 - low * 0.3, 0.86 - low * 0.55);
    u.uSkySun.value.copy(sunDir); u.uSkySunCol.value.copy(sunCol).multiplyScalar(twi);
    const nightHor = C(0x0e1824).lerp(C(0x1a222c), coverage * 0.5).multiplyScalar(0.6);
    const hor = C(0xc9d7e2).lerp(C(0xe8b48a), low * 0.55).lerp(C(0x9aa3aa), coverage * density * 0.8);
    hor.lerp(C(0x8a6f73), dusk * 0.5).lerp(nightHor, 1 - day);
    u.uSkyZen.value.set(0x3d6c9a).lerp(C(0x2a3a52), low * 0.4).lerp(C(0x1d3366), dusk * 0.75).lerp(C(0x03060d), Math.pow(1 - day, 1.6));
    u.uSkyLow.value.set(0x1d3a4c).lerp(C(0x1a2328), coverage * 0.6).multiplyScalar(0.08 + 0.92 * day);
    u.uSkyGlow.value.set(0xff7a3a).lerp(C(0xff9e6a), sm(0, 6, sunEl)).multiplyScalar(dusk * 0.55 * (1 - coverage * 0.75));
    u.uSkyCloud.value.set(0xfffdf8).lerp(C(0xffb08a), dusk * 0.7).multiplyScalar(0.03 + 0.97 * day).add(tmp.set(0x10141c).multiplyScalar(1 - day));
    u.uCloud.value.set(coverage, density, scale, haze);
    u.uSkyNight.value.set(0, 0);
    const hazeVis = (3600 - haze * 2400) * 1.25 / 1000;
    const visKm = Math.min(vis, hazeVis, rain > 0 ? 12 / (0.4 + rain * 3.6) : 99);
    const fogK = 1.73 / Math.max(50, visKm * 1000), thick = Math.min(1, 0.6 / visKm);
    u.uSkyFog.value.set(vis < hazeVis || rain > 0 ? fogK : 0, 260, rain);
    hor.lerp(C(0xb9c2c8).multiplyScalar(0.05 + 0.95 * day), thick * 0.5); u.uSkyHor.value.copy(hor);
    const shadow = (1 - coverage * density * 0.85) * (1 - thick * 0.7) * (1 - rain * 0.35);
    return { visKm, thick, shadow, fog: hor, day };
  }

  /* ---------------- deszcz (RainKit) ---------------- */
  const RU = { uRain: { value: 0 }, uTimeR: { value: 0 }, uWindR: { value: new THREE.Vector2() }, uRainCol: { value: new THREE.Color(0xc8d0d6) },
    uBox: { value: new THREE.Vector3(70, 45, 70) }, uFall: { value: 8.5 }, uStreak: { value: 0.045 } };
  const rain = (function () {
    const maxDrops = 24000, seed = new Float32Array(maxDrops * 2 * 4);
    for (let i = 0; i < maxDrops; i++) { const x = Math.random(), y = Math.random(), z = Math.random(), r = Math.random(); seed.set([x, y, z, r * 0.999], i * 8); seed.set([x, y, z, 1 + r * 0.999], i * 8 + 4); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxDrops * 6), 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const m = new THREE.ShaderMaterial({ uniforms: RU, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        uniform float uRain, uTimeR, uFall, uStreak; uniform vec2 uWindR; uniform vec3 uBox;
        attribute vec4 aSeed; varying float vA;
        void main() {
          float rnd = fract(aSeed.w), bottom = step(1.0, aSeed.w);
          float fall = uFall * (0.8 + 0.4 * rnd);
          vec3 vel = vec3(uWindR.x, -fall, uWindR.y);
          vec3 p = aSeed.xyz * uBox + vel * uTimeR;
          vec3 origin = cameraPosition - uBox * 0.5;
          p = origin + mod(p - origin, uBox);
          p -= vel * uStreak * bottom;
          float d = length(p - cameraPosition);
          vA = (1.0 - bottom * 0.85) * smoothstep(uBox.x * 0.5, uBox.x * 0.2, d) * smoothstep(0.4, 1.5, d);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform float uRain; uniform vec3 uRainCol; varying float vA; void main() { gl_FragColor = vec4(uRainCol, vA * (0.18 + 0.22 * uRain)); }' });
    const mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.userData.keepShadow = true;
    mesh.setRain = (a) => { g.setDrawRange(0, Math.round(maxDrops * Math.min(1, a)) * 2); mesh.visible = a > 0.005; };
    mesh.setRain(0); scene.add(mesh); return mesh;
  })();

  /* ---------------- błyskawice (RainKit) ---------------- */
  const bolts = (function () {
    const light = new THREE.DirectionalLight(0xc8d4ff, 0); scene.add(light, light.target);
    const mat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float aW; varying float vW; void main(){ vW = aW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uI; varying float vW; void main(){ gl_FragColor = vec4(vec3(0.8, 0.85, 1.0) * uI * (0.4 + 0.6 * vW) * 30.0, 1.0); }' });
    function boltGeometry(rnd, top, width) {
      const split = (a, b, depth, out) => { if (depth === 0) { out.push(a); return; }
        const mx = (a[0] + b[0]) / 2 + (rnd() - 0.5) * Math.abs(b[1] - a[1]) * 0.45, my = (a[1] + b[1]) / 2 + (rnd() - 0.5) * Math.abs(b[1] - a[1]) * 0.1;
        split(a, [mx, my], depth - 1, out); split([mx, my], b, depth - 1, out); };
      const main = []; split([0, top], [0, 0], 7, main); main.push([0, 0]);
      const lines = [[main, width]];
      for (let k = 0; k < 4; k++) { const i = 4 + Math.floor(rnd() * main.length * 0.5), s = main[i], len = top * (0.15 + rnd() * 0.25), dx = rnd() < 0.5 ? -1 : 1;
        const br = []; split(s, [s[0] + dx * len * 0.6, s[1] - len], 5, br); br.push([s[0] + dx * len * 0.6, s[1] - len]); lines.push([br, width * 0.45]); }
      const pos = [], al = [];
      for (const [ln, w] of lines) for (let i = 0; i < ln.length - 1; i++) {
        const [x0, y0] = ln[i], [x1, y1] = ln[i + 1]; let nx = -(y1 - y0), ny = x1 - x0; const l = Math.hypot(nx, ny) || 1; nx = nx / l * w; ny = ny / l * w;
        pos.push(x0 - nx, y0 - ny, 0, x0 + nx, y0 + ny, 0, x1 + nx, y1 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0);
        for (let j = 0; j < 6; j++) al.push(w / width);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(al, 1));
      return g;
    }
    let bolt = null, strike = null, next = 3, audio = null;
    const S = { rate: 0, sound: false, fogK: 0 };
    function thunder(delay, dist) {
      if (!S.sound) return;
      try {
        audio = audio || new AudioContext(); audio.resume();
        const len = 4 + Math.min(4, dist / 1500), sr = audio.sampleRate, buf = audio.createBuffer(1, Math.floor(len * sr), sr), d = buf.getChannelData(0);
        let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.015; const t = i / sr; d[i] = b * 9 * (Math.exp(-t * 0.9) * (0.6 + 0.4 * Math.sin(t * 7 + Math.sin(t * 2.3) * 3))); }
        const src = audio.createBufferSource(), lp = audio.createBiquadFilter(), gn = audio.createGain();
        src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 900 - Math.min(700, dist / 10); gn.gain.value = Math.min(1, 2500 / dist) * 0.8;
        src.connect(lp); lp.connect(gn); gn.connect(audio.destination); src.start(audio.currentTime + delay);
      } catch (e) { /* bez dźwięku */ }
    }
    function strikeNow(camera, rnd = Math.random) {
      const az = rnd() * Math.PI * 2, dist = 900 + rnd() * 3000, top = 700 + rnd() * 300;
      const at = new THREE.Vector3(camera.position.x + Math.sin(az) * dist, -15, camera.position.z + Math.cos(az) * dist);
      if (bolt) { scene.remove(bolt); bolt.geometry.dispose(); }
      bolt = new THREE.Mesh(boltGeometry(rnd, top, 9 + dist / 450), mat); bolt.frustumCulled = false; bolt.renderOrder = 2; bolt.userData.keepShadow = true;
      bolt.position.copy(at); bolt.lookAt(camera.position.x, at.y, camera.position.z); scene.add(bolt);
      const dir = new THREE.Vector3(at.x - camera.position.x, top * 0.6, at.z - camera.position.z).normalize();
      const strokes = [[0, 0.07]]; let t = 0.09; for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) { t += 0.04 + rnd() * 0.08; strokes.push([t, 0.04 + rnd() * 0.05]); }
      strike = { t: 0, strokes, dir, at, dist, end: t + 0.3 };
      light.position.copy(camera.position).addScaledVector(dir, 500); light.target.position.copy(camera.position); light.target.updateMatrixWorld();
      thunder(dist / 343, dist);
    }
    function update(dt, camera) {
      if (S.rate > 0) { next -= dt; if (next <= 0) { strikeNow(camera); next = (4 + Math.random() * 14) / S.rate; } }
      let I = 0;
      if (strike) {
        strike.t += dt;
        for (const [s, l] of strike.strokes) if (strike.t >= s && strike.t < s + l) I = Math.max(I, 1 - (strike.t - s) / l * 0.6);
        I += Math.max(0, 1 - strike.t / strike.end) * 0.08;
        if (strike.t > strike.end) { strike = null; if (bolt) bolt.visible = false; }
      }
      const near = strike ? Math.min(1, 2500 / strike.dist) : 0;
      const seen = strike ? Math.max(0.12, Math.exp(-((strike.dist * S.fogK) ** 2))) : 1;
      mat.uniforms.uI.value = I * seen; if (bolt) bolt.visible = I > 0.15;
      light.intensity = I * 2.2 * near;
      return { I: I * (0.5 + 0.5 * near), dir: strike ? strike.dir : null };
    }
    return { S, update, strikeNow };
  })();

  /* ---------------- stan pogody i zmienne warunki ---------------- */
  const pick = (k) => { const o = {}; for (const q of KEYS) o[q] = WEATHER[k][q]; return o; };
  const W = pick('fair');                                      // bieżąca pogoda
  let from = { ...W }, to = { ...W }, blendT = 1, blendDur = 1, preset = 'fair';
  let variable = false, hold = 0, t = 0, rainNow = 0, envT = 0, envDirty = true, lastSunEl = -999;
  function goTo(k, dur) { preset = k; from = { ...W }; to = pick(k); blendT = 0; blendDur = dur; envDirty = true; }
  // kolejna pogoda dla zmiennych warunków: częściej pogodnie, czasem deszcz, mgła lub burza; bez skoków (sąsiednie stany)
  const NEXT = { clear: ['fair', 'fair', 'broken', 'fog'], fair: ['clear', 'broken', 'broken', 'overcast'], broken: ['fair', 'overcast', 'rain', 'clear'],
    overcast: ['broken', 'rain', 'rain', 'fog', 'storm'], rain: ['overcast', 'broken', 'storm', 'rain'], fog: ['fair', 'overcast', 'broken'], storm: ['rain', 'overcast'] };

  const L = { visKm: 20, shadow: 1, fog: new THREE.Color(), day: 1 }, wind2 = new THREE.Vector2();
  return {
    WEATHER, u, dome, rain, bolts,
    get preset() { return preset; }, get variable() { return variable; },
    set(k, dur = 4) { if (WEATHER[k]) goTo(k, Math.max(0.01, dur)); },
    setVariable(on) { variable = on; hold = on ? 20 : 0; },
    get state() { return { ...W, rainNow, visKm: L.visKm, shadow: L.shadow, day: L.day }; },
    // sunDir: kierunek do słońca (także pod horyzontem); zwraca mnożniki światła, mgłę i deszcz dla sceny
    update(dt, camera, sunDir, sunEl, sound) {
      t += dt;
      if (variable) { hold -= dt; if (hold <= 0 && blendT >= 1) { const n = NEXT[preset]; goTo(n[Math.floor(Math.random() * n.length)], 35 + Math.random() * 25); hold = 70 + Math.random() * 80; } }
      if (blendT < 1) {
        blendT = Math.min(1, blendT + dt / blendDur); const k = sm(0, 1, blendT);
        for (const q of KEYS) W[q] = from[q] + (to[q] - from[q]) * k;
        envDirty = true;
      }
      // chmury płyną z wiatrem
      u.uCloudOff.value.x += dt * W.wind * 0.0012; u.uCloudOff.value.y += dt * W.wind * 0.0006;
      const r = applySky(sunDir, sunEl, W); Object.assign(L, r);
      // deszcz przychodzi i odchodzi (szkwały)
      rainNow = W.rain <= 0.001 ? 0 : W.rain * Math.min(1, 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.11) * 0.7 + Math.sin(t * 0.047 + 1.3) * 0.5 + 0.35));
      rain.setRain(rainNow); RU.uRain.value = rainNow; RU.uTimeR.value = t;
      const w = W.wind * 0.55; RU.uWindR.value.set(w * 0.894, w * 0.447); RU.uRainCol.value.copy(L.fog).lerp(tmp.set(1, 1, 1), 0.25);
      bolts.S.rate = W.lightning > 0.05 ? W.lightning : 0; bolts.S.sound = !!sound; bolts.S.fogK = 1.73 / Math.max(50, L.visKm * 1000);
      const lb = bolts.update(dt, camera);
      if (lb.dir) u.uSkyBolt.value.set(lb.dir.x, lb.dir.y, lb.dir.z, lb.I * 1.6); else u.uSkyBolt.value.w = 0;
      dome.position.copy(camera.position);
      // odbicia: przy zmianie pogody lub po przesunięciu słońca
      envT += dt;
      if (Math.abs(sunEl - lastSunEl) > 0.5) envDirty = true;
      if (envDirty && envT > 0.6) { refreshEnv(); envDirty = false; envT = 0; lastSunEl = sunEl; }
      return { shadow: L.shadow, coverage: W.coverage, density: W.density, fog: L.fog, visKm: L.visKm, rain: rainNow, wind: W.wind, flash: lb.I };
    },
  };
}
