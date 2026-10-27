// ===================== Aplikacja: scena, tor, tabor, sterowanie, dźwięki, efekty, pętla =====================
(function () {
  const sim = PHYS.createSim();
  LAND.generate(sim); sim.groundH = LAND.height;          // teren poza torem: ten sam w fizyce i w grafice
  const view = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.NoToneMapping;   // ACES w końcowym przebiegu
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c3c6);
  scene.fog = new THREE.Fog(0xb8c3c6, 400, 2600);
  const hemi = new THREE.HemisphereLight(0xdfe7ea, 0x5d5a48, 0.85); scene.add(hemi);
  // jedno światło „nieba”: słońce w dzień, księżyc w nocy (rzuca cienie)
  const sun = new THREE.DirectionalLight(0xfff3dc, 0.95); sun.position.set(-80, 140, 60); scene.add(sun, sun.target);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 420 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const C = (h) => new THREE.Color(h);
  const SKY = { night: C(0x02040a), twi: C(0xd8966a), day: C(0xb8c3c6) }, SUNC = { low: C(0xffa062), high: C(0xfff3dc) }, MOONC = C(0x9fb4ff);
  const HEMI = { skyN: C(0x1a2438), skyD: C(0xdfe7ea), gndN: C(0x050506), gndD: C(0x5d5a48) };
  // gwiazdy i księżyc: sfera nieba podąża za kamerą (bez paralaksy), nie podlega mgle
  const skyG = new THREE.Group(); scene.add(skyG);
  const stars = (function () {
    const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.98 + 0.02, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 1500, y * 1500 - 40, Math.sin(th) * r * 1500], i * 3);
      const b = Math.pow(Math.random(), 3) * 0.85 + 0.15, t = Math.random();   // jasność i lekki odcień (chłodne/ciepłe)
      col.set([b * (0.85 + 0.15 * t), b * 0.92, b * (1.0 - 0.15 * t)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const p = new THREE.Points(g, m); p.renderOrder = -2; skyG.add(p); return p;
  })();
  const texC = (w, draw) => { const c = document.createElement('canvas'); c.width = c.height = w; draw(c.getContext('2d'), w); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ fog: false, transparent: true, depthWrite: false,
    map: texC(256, (x, w) => {
      const g = x.createRadialGradient(w * 0.42, w * 0.4, w * 0.05, w / 2, w / 2, w / 2); g.addColorStop(0, '#fbf8ec'); g.addColorStop(1, '#d6d2c2');
      x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 1, 0, 7); x.fill();
      x.fillStyle = 'rgba(120,118,108,0.35)';
      for (const [cx, cy, r] of [[0.36, 0.38, 0.12], [0.6, 0.3, 0.08], [0.55, 0.6, 0.15], [0.32, 0.66, 0.07], [0.7, 0.5, 0.06], [0.45, 0.2, 0.05]]) { x.beginPath(); x.arc(cx * w, cy * w, r * w, 0, 7); x.fill(); }
    }) }));
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    map: texC(128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(190,205,255,0.55)'); g.addColorStop(0.35, 'rgba(150,170,230,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }) }));
  moonGlow.scale.set(150, 150, 1); moon.renderOrder = moonGlow.renderOrder = -1; skyG.add(moon, moonGlow);
  const moonDir = new THREE.Vector3(); let nightF = 0;
  const sunDir = new THREE.Vector3(), tc = new THREE.Color();
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function setTimeOfDay(h) {
    const ang = (h - 6) / 12 * Math.PI, se = Math.sin(ang);              // 6:00 wschód, 12:00 górowanie, 18:00 zachód
    const day = sstep(-0.12, 0.22, se), twi = Math.max(0, 1 - Math.abs(se) / 0.22) * sstep(-0.2, 0, se + 0.15);
    const el = Math.asin(Math.max(-1, Math.min(1, se * 0.9))), az = Math.PI - ang;  // słońce ze wschodu (+x) na zachód przez południe (−z)
    if (se > -0.05) {                                                    // słońce
      sunDir.set(Math.cos(az) * Math.cos(el), Math.max(0.04, Math.sin(el)), -Math.abs(Math.sin(az)) * Math.cos(el) - 0.25).normalize();
      sun.color.copy(SUNC.low).lerp(SUNC.high, sstep(0.0, 0.5, se)); sun.intensity = 1.05 * sstep(-0.05, 0.2, se);
    } else {                                                             // księżyc (przeciwnie do słońca)
      sunDir.set(-Math.cos(az) * 0.6, 0.75, 0.3).normalize(); sun.color.copy(MOONC); sun.intensity = 0.11 * sstep(-0.05, -0.25, se);
    }
    // księżyc na niebie po przeciwnej stronie niż słońce (wschodzi wieczorem, zachodzi rano)
    moonDir.set(-Math.cos(az) * 0.6, Math.max(0.12, -se * 0.75 + 0.1), 0.3).normalize();
    nightF = 1 - sstep(-0.25, 0.05, se);
    stars.material.opacity = nightF; stars.visible = nightF > 0.01;
    moon.material.opacity = sstep(0.0, 0.6, 1 - sstep(-0.1, 0.15, se)); moonGlow.material.opacity = nightF;
    moon.visible = moon.material.opacity > 0.01; moonGlow.visible = nightF > 0.01;
    hemi.intensity = 0.045 + 0.805 * day;
    hemi.color.copy(HEMI.skyN).lerp(HEMI.skyD, day); hemi.groundColor.copy(HEMI.gndN).lerp(HEMI.gndD, day);
    tc.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.twi, twi * 0.75);
    scene.background.copy(tc); scene.fog.color.copy(tc);
    // wartości bez pogody: pogoda (chmury, deszcz, mgła) mnoży je w każdej klatce
    BASE.sunI = sun.intensity; BASE.hemiI = hemi.intensity; BASE.sunEl = el * 180 / Math.PI;
    BASE.trueSun.set(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.abs(Math.sin(az)) * Math.cos(el) - 0.25).normalize();
    BASE.starO = stars.material.opacity; BASE.moonO = moon.material.opacity; BASE.moonG = moonGlow.material.opacity;
  }
  const BASE = { sunI: 1, hemiI: 0.85, sunEl: 45, trueSun: new THREE.Vector3(0, 1, 0), starO: 0, moonO: 0, moonG: 0 };
  function placeSun() {                                                  // cień wokół miejsca, na które patrzy kamera
    const c = controls.target; sun.position.copy(c).addScaledVector(sunDir, 200); sun.target.position.copy(c); sun.target.updateMatrixWorld();
    skyG.position.copy(camera.position);                                 // niebo „w nieskończoności”
    moon.position.copy(moonDir).multiplyScalar(1200); moon.lookAt(camera.position); moonGlow.position.copy(moon.position);
  }

  // ---------- kamery ----------
  const persp = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.12, 4000);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 4000);
  let camera = persp;
  const loco0 = sim.vehicles[0].body.p;
  persp.position.set(loco0[0] - 6, 9, loco0[2] - 24);
  let controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(loco0[0] - 12, 1.2, loco0[2]);
  controls.enableDamping = true; controls.update();
  function makeControls(cam, target) {
    controls.dispose();
    controls = new THREE.OrbitControls(cam, renderer.domElement);
    controls.target.copy(target); controls.enableDamping = true; controls.update();
  }
  function setOrthoFrustum(h) {
    const a = innerWidth / innerHeight;
    ortho.left = -h * a / 2; ortho.right = h * a / 2; ortho.top = h / 2; ortho.bottom = -h / 2;
  }
  const camBtn = document.getElementById('cam');
  camBtn.addEventListener('click', () => {
    const target = controls.target.clone();
    if (camera === persp) {
      const dist = persp.position.distanceTo(target);
      setOrthoFrustum(2 * dist * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)));
      ortho.zoom = 1; ortho.position.copy(persp.position); ortho.quaternion.copy(persp.quaternion);
      ortho.updateProjectionMatrix(); camera = ortho;
      camBtn.textContent = 'Ortogonalna'; camBtn.setAttribute('aria-pressed', 'true');
    } else {
      const h = (ortho.top - ortho.bottom) / ortho.zoom;
      const dist = h / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)));
      const dir = ortho.position.clone().sub(target).normalize();
      persp.position.copy(target).addScaledVector(dir, dist); persp.updateProjectionMatrix(); camera = persp;
      camBtn.textContent = 'Perspektywa'; camBtn.setAttribute('aria-pressed', 'false');
    }
    makeControls(camera, target);
  });
  // ---------- filtry obrazu (jeden shader końcowy na GPU) ----------
  const FX = { pixel: false, scan: false, crt: false, pal: 0 };
  // potok obrazu: scena (MSAA, HDR) → bloom → końcowy shader: ekspozycja + ACES + sRGB + filtry
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new THREE.EffectComposer(renderer, rt);
  const renderPass = new THREE.RenderPass(scene, camera); composer.addPass(renderPass);
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.55, 1.6); composer.addPass(bloom);
  const finalPass = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, uPix: { value: 0 }, uScan: { value: 0 }, uCrt: { value: 0 }, uPal: { value: 0 }, uTime: { value: 0 }, uExp: { value: 1.15 },
      // wygląd kamery (laboratorium wyglądu, LookPipeline): mapowanie tonów, kolor, obiektyw, film
      l_tone: { value: 0 }, l_con: { value: 1 }, l_sat: { value: 1 }, l_vib: { value: 0 }, l_temp: { value: 0 }, l_tint: { value: 0 }, l_vig: { value: 0 }, l_grain: { value: 0 },
      l_ca: { value: 0 }, l_dist: { value: 0 }, l_drops: { value: 0 }, l_dirt: { value: 0 }, l_glare: { value: 0 }, l_sharp: { value: 0 }, l_sun: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float uPix, uScan, uCrt, uPal, uTime, uExp; varying vec2 vUv;
      uniform float l_tone, l_con, l_sat, l_vib, l_temp, l_tint, l_vig, l_grain, l_ca, l_dist, l_drops, l_dirt, l_glare, l_sharp; uniform vec3 l_sun;
      float lhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float lnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(lhash(i), lhash(i + vec2(1, 0)), f.x), mix(lhash(i + vec2(0, 1)), lhash(i + vec2(1, 1)), f.x), f.y); }
      vec3 hable1(vec3 x){ return ((x * (0.15 * x + 0.05) + 0.004) / (x * (0.15 * x + 0.5) + 0.06)) - 0.0667; }
      vec3 hable(vec3 x){ return clamp(hable1(x * 2.0) / hable1(vec3(11.2)), 0.0, 1.0); }
      vec3 agx(vec3 c){
        const mat3 inM = mat3(0.842479, 0.0423282, 0.0423756, 0.0784336, 0.878468, 0.0784336, 0.0792237, 0.0791661, 0.879142);
        const mat3 outM = mat3(1.19688, -0.0528968, -0.0529716, -0.0980209, 1.15190, -0.0980435, -0.0990297, -0.0989612, 1.15107);
        c = inM * max(c, 1e-6); c = clamp((log2(c) + 12.47393) / 16.5, 0.0, 1.0);
        vec3 x2 = c * c, x4 = x2 * x2;
        c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
        return clamp(pow(max(outM * c, 0.0), vec3(2.2)), 0.0, 1.0);
      }
      vec3 drops(vec2 uv, float amount){                                                 // krople wody na szkle obiektywu
        vec2 a = vec2(res.x / res.y, 1.0), p = uv * a * 9.0; vec3 o = vec3(0.0);
        for (int l = 0; l < 2; l++) {
          vec2 g = p * (1.0 + float(l) * 0.8) + float(l) * 3.7, id = floor(g), f = fract(g) - 0.5;
          float h = lhash(id + float(l) * 17.0);
          if (h > amount * 0.4) continue;
          float slide = fract(uTime * 0.03 * h + h * 7.0);
          vec2 c = vec2(lhash(id + 3.1) - 0.5, (lhash(id + 5.7) - 0.5) * 0.6 - slide * 0.3) * 0.6;
          float r = 0.1 + 0.28 * lhash(id + 9.3), d = length((f - c) * vec2(1.0, 1.15));
          float m = smoothstep(r, r * 0.65, d);
          o.xy += (f - c) * m * -0.035 / (1.0 + float(l)); o.z = max(o.z, m);
        }
        return o;
      }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }   // tone mapping ACES (dopasowanie Narkowicza)
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float b2(vec2 q){ return mod(2.0 * q.x + 3.0 * q.y, 4.0); }                       // Bayer 2×2: 0 2 / 3 1
      float bayer(vec2 p){ vec2 a = mod(p, 2.0), b = mod(floor(p / 2.0), 2.0); return (4.0 * b2(a) + b2(b) + 0.5) / 16.0; }
      vec3 cga(vec3 c){                                                                  // CGA, paleta 1 (jasna): czarny, cyjan, magenta, biały
        vec3 p[4]; p[0] = vec3(0.0); p[1] = vec3(0.333, 1.0, 1.0); p[2] = vec3(1.0, 0.333, 1.0); p[3] = vec3(1.0);
        vec3 best = p[0]; float bd = 1e9;
        for (int i = 0; i < 4; i++) { vec3 d = c - p[i]; float e = dot(d, d * vec3(0.3, 0.59, 0.11)); if (e < bd) { bd = e; best = p[i]; } }
        return best;
      }
      void main(){
        vec2 uv = vUv;
        if (uCrt > 0.5) {                                                                // krzywizna kineskopu
          vec2 c = uv - 0.5; float r2 = dot(c, c); uv = 0.5 + c * (1.0 + 0.12 * r2 + 0.06 * r2 * r2);
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        }
        vec2 q0 = uv - 0.5; float r2 = dot(q0 * vec2(res.x / res.y, 1.0), q0 * vec2(res.x / res.y, 1.0));
        if (l_dist > 0.0) { float k = l_dist * 0.32; uv = 0.5 + q0 * (1.0 - k * 0.35) * (1.0 + k * r2); }   // dystorsja beczkowa
        float drop = 0.0;
        if (l_drops > 0.0) { vec3 d = drops(uv, l_drops); uv += d.xy; drop = d.z; }
        float ps = 1.0;
        if (uPix > 0.5) { ps = max(3.0, floor(res.y / 200.0)); uv = (floor(uv * res / ps) + 0.5) * ps / res; }   // duże piksele
        vec3 col;
        vec2 cad = (uCrt > 0.5 ? vec2(0.0016, 0.0) : vec2(0.0)) + (uv - 0.5) * l_ca * 0.012 * (0.3 + r2 * 2.5);   // aberracja chromatyczna
        if (cad.x != 0.0 || cad.y != 0.0) col = vec3(texture2D(tDiffuse, uv + cad).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - cad).b);
        else col = texture2D(tDiffuse, uv).rgb;
        if (l_sharp > 0.0) {                                                             // wyostrzenie
          vec2 tx = 1.0 / res;
          vec3 n4 = texture2D(tDiffuse, uv + vec2(tx.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(tx.x, 0.0)).rgb + texture2D(tDiffuse, uv + vec2(0.0, tx.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, tx.y)).rgb;
          col = max(col + (col - n4 * 0.25) * l_sharp * 1.2, 0.0);
        }
        col = max(col, 0.0) * uExp;
        if (l_dirt > 0.0) {                                                              // brud na obiektywie, widoczny w jasnym świetle
          float smg = smoothstep(0.45, 0.85, lnoise(uv * 5.0 + 1.3) * 0.6 + lnoise(uv * 17.0) * 0.4);
          float bright = dot(max(col - vec3(0.85), 0.0), vec3(0.33)) * 3.0 + (l_sun.z > 0.0 ? smoothstep(0.7, 0.0, distance(uv, l_sun.xy)) * l_sun.z * 0.6 : 0.0);
          col += vec3(1.0, 0.96, 0.9) * smg * bright * l_dirt * 0.8;
        }
        if (l_glare > 0.0 && l_sun.z > 0.0) {                                            // odblask słońca: smuga, poświata i duchy
          vec2 s = l_sun.xy, dd = (uv - s) * vec2(res.x / res.y, 1.0);
          float streak = exp(-abs(dd.y) * 90.0) * exp(-abs(dd.x) * 2.2), halo = exp(-length(dd) * 9.0);
          vec3 g = vec3(1.0, 0.92, 0.8) * (streak * 0.9 + halo * 0.6);
          for (int i = 1; i < 4; i++) { vec2 gp = mix(s, vec2(0.5), float(i) * 0.55); float gd = length((uv - gp) * vec2(res.x / res.y, 1.0)); g += vec3(0.6, 0.8, 1.0) * smoothstep(0.05 + 0.03 * float(i), 0.0, gd) * 0.12; }
          col += g * l_sun.z * l_glare * 1.5;
        }
        if (drop > 0.0) col = mix(col, col * 1.08 + 0.015, drop * 0.5);
        col *= vec3(1.0 + l_temp * 0.6, 1.0 - l_tint * 0.4, 1.0 - l_temp * 0.6);           // temperatura barwowa i odcień
        col = toSRGB(l_tone < 0.5 ? aces(col) : l_tone < 1.5 ? agx(col) : hable(col));
        { float l0 = dot(col, vec3(0.2126, 0.7152, 0.0722));                              // nasycenie, żywość, kontrast
          col = mix(vec3(l0), col, l_sat);
          float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)), cs = (mx - mn) / max(mx, 1e-4);
          col = mix(vec3(l0), col, 1.0 + l_vib * (1.0 - cs));
          col = clamp((col - 0.5) * l_con + 0.5, 0.0, 1.0); }
        if (l_vig > 0.0) col *= 1.0 - smoothstep(0.25, 1.05, length(q0 * vec2(1.0, 0.85)) * 1.25) * l_vig * 0.75;
        if (l_dist > 0.0) { vec2 e = abs(uv - 0.5) * 2.0; col *= smoothstep(1.02, 0.96, max(e.x, e.y)); }
        if (l_grain > 0.0) col = clamp(col + (lhash(vUv * res + fract(uTime) * 91.0) - 0.5) * l_grain * 0.09 * (1.2 - dot(col, vec3(0.33))), 0.0, 1.0);
        float th = bayer(floor(uv * res / ps));
        float L = dot(col, vec3(0.299, 0.587, 0.114));
        if (uPal > 0.5 && uPal < 1.5) col = vec3(step(th, L));                          // czarno-biała z ditheringiem
        else if (uPal > 1.5 && uPal < 2.5) col = clamp(vec3(L * 1.08 + 0.06, L * 0.92 + 0.03, L * 0.70), 0.0, 1.0);   // sepia
        else if (uPal > 2.5 && uPal < 3.5) col = vec3(L);                               // odcienie szarości
        else if (uPal > 3.5) col = cga(col + (th - 0.5) * 0.45);                         // CGA z ditheringiem
        if (uPix > 0.5 && uPal < 0.5) col = floor(col * 12.0 + th) / 12.0;             // pixelart: mniej odcieni
        if (uPix > 0.5 && uPal > 2.5 && uPal < 3.5) col = floor(col * 8.0 + th) / 8.0;
        if (uScan > 0.5) { float lh = max(2.0, ps); float y = mod(gl_FragCoord.y, lh * 1.5); col *= y < lh * 0.5 ? 0.55 : 1.0; }
        if (uCrt > 0.5) {                                                                // maska RGB, winieta, migotanie
          float m = mod(gl_FragCoord.x, 3.0);
          col *= vec3(m < 1.0 ? 1.0 : 0.72, (m >= 1.0 && m < 2.0) ? 1.0 : 0.72, m >= 2.0 ? 1.0 : 0.72) * 1.22;
          vec2 c = uv - 0.5; col *= clamp(1.0 - dot(c, c) * 1.6, 0.0, 1.0); col *= 0.985 + 0.015 * sin(uTime * 55.0);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(finalPass);
  const postMat = { uniforms: finalPass.uniforms };
  const dbs = new THREE.Vector2();
  function sizeRT() { renderer.getDrawingBufferSize(dbs); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); postMat.uniforms.res.value.copy(dbs); }
  sizeRT();
  function renderFrame(t) {
    const u = postMat.uniforms; u.uPix.value = +FX.pixel; u.uScan.value = +FX.scan; u.uCrt.value = +FX.crt; u.uPal.value = FX.pal; u.uTime.value = t / 1000;
    for (const k in LOOK) u['l_' + k].value = LOOK[k];
    u.l_drops.value = Math.max(LOOK.drops, wxNow.rain * 0.5);                      // deszcz na obiektywie
    // słońce na ekranie (odblask i brud obiektywu): przed kamerą, nad horyzontem, nie za chmurami
    sunScr.copy(camera.position).addScaledVector(BASE.trueSun, 1000).project(camera);
    camera.getWorldDirection(camDir);
    const front = camDir.dot(BASE.trueSun) > 0.05 && BASE.trueSun.y > -0.02;
    const inView = front && Math.abs(sunScr.x) < 1.3 && Math.abs(sunScr.y) < 1.3 ? 1 - Math.max(0, Math.max(Math.abs(sunScr.x), Math.abs(sunScr.y)) - 1) / 0.3 : 0;
    const through = Math.max(0, 1 - wxNow.coverage * (0.4 + wxNow.density * 0.6)) * (1 - wxNow.rain * 0.85) * Math.min(1, Math.max(0, BASE.sunEl / 3));
    u.l_sun.value.set(sunScr.x * 0.5 + 0.5, sunScr.y * 0.5 + 0.5, Math.max(0, inView) * through);
    renderPass.camera = camera;
    composer.render();
  }
  // wygląd kamery: gotowe zestawy z laboratorium wyglądu i pojedyncze efekty obiektywu
  const LOOKS = {
    natural: { tone: 0, con: 1, sat: 1, vib: 0, temp: 0, tint: 0, vig: 0, grain: 0, ca: 0, dist: 0, drops: 0, dirt: 0, glare: 0, sharp: 0 },
    film: { tone: 1, con: 1.12, sat: 0.86, vib: 0, temp: -0.08, tint: 0, vig: 0.45, grain: 0.25, ca: 0.15, dist: 0, drops: 0, dirt: 0, glare: 0.5, sharp: 0.25 },
    bodycam: { tone: 1, con: 1.18, sat: 0.72, vib: 0, temp: -0.12, tint: 0.02, vig: 0.65, grain: 0.45, ca: 0.45, dist: 0.35, drops: 0.35, dirt: 0.55, glare: 0.8, sharp: 0.55 },
  };
  const LENS = { vig: 0.45, grain: 0.25, ca: 0.3, dist: 0.35, drops: 0.35, dirt: 0.55, glare: 0.6, sharp: 0.3 };   // siła efektu włączonego ręcznie
  const LOOK = { ...LOOKS.natural };
  let lookName = 'natural';
  function syncLookUI() {
    for (const k of Object.keys(LENS)) { const cb = document.getElementById('lk-' + k); if (cb) cb.checked = LOOK[k] > 0; }
    document.getElementById('lk-tone').value = String(LOOK.tone);
  }
  document.getElementById('lk-preset').addEventListener('change', e => { lookName = e.target.value; Object.assign(LOOK, LOOKS[lookName]); syncLookUI(); });
  document.getElementById('lk-tone').addEventListener('change', e => { LOOK.tone = +e.target.value; });
  for (const k of Object.keys(LENS)) document.getElementById('lk-' + k).addEventListener('change', e => { LOOK[k] = e.target.checked ? (LOOKS[lookName][k] || LENS[k]) : 0; });
  const sunScr = new THREE.Vector3(), camDir = new THREE.Vector3();
  let wxNow = { coverage: 0, density: 0, rain: 0 };
  for (const k of ['pixel', 'scan', 'crt']) document.getElementById('fx-' + k).addEventListener('change', e => { FX[k] = e.target.checked; });
  document.getElementById('fx-pal').addEventListener('change', e => { FX.pal = +e.target.value; });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight); sizeRT();
    persp.aspect = innerWidth / innerHeight; persp.updateProjectionMatrix();
    const h = ortho.top - ortho.bottom; setOrthoFrustum(h); ortho.updateProjectionMatrix();
  });

  // ---------- materiały ----------
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o));
  const mat = {
    ground: M(0x6d7754, { roughness: 1 }), ballast: M(0x8b867d, { roughness: 1 }), sleeper: M(0x564739, { roughness: 0.95 }),
    rail: M(0x9da1a6, { roughness: 0.35, metalness: 0.75 }),
    wheel: M(0x5b5f63, { roughness: 0.45, metalness: 0.6 }), tread: M(0xb7bbbf, { roughness: 0.3, metalness: 0.85 }),
    mark: M(0xe9e4d6, { roughness: 0.6 }),
    frame: M(0x26292b, { roughness: 0.7 }), spring: M(0x3a3d40, { roughness: 0.5, metalness: 0.4 }),
    beam: M(0x9b2f22), loco: M(0x2f4b40), cab: M(0x3a5a4d), glass: M(0x1c2328, { roughness: 0.2, metalness: 0.3 }),
    lampW: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 1.2 }),
    lampR: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 1.4 }),
    wagon1: M(0x6b3b2b), wagon2: M(0x4b5964), roof: M(0x77756f), steel: M(0x8e9296, { roughness: 0.4, metalness: 0.7 }),
  };

  // scalanie nieruchomych względem siebie części grupy w jedną siatkę na materiał (mniej wywołań rysowania)
  function mergeStatic(group) {
    if (window.__NO_MERGE) return;                      // badanie modeli (Model Doctor) na częściach niescalonych
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), byMat = new Map(), drop = [];
    for (const ch of group.children) {
      if (!ch.isMesh || ch.isInstancedMesh) continue;
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, ch.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      const flip = ch.matrixWorld.determinant() < 0;
      if (flip) { const p = g.attributes.position.array, n = g.attributes.normal.array;   // odbicie lustrzane: odwróć kolejność wierzchołków
        for (let i = 0; i < p.length; i += 9) for (const a of [p, n]) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; } }
      (byMat.get(ch.material) || byMat.set(ch.material, []).get(ch.material)).push(g); drop.push(ch);
    }
    for (const ch of drop) group.remove(ch);
    for (const [m, list] of byMat) {
      let n = 0; for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
      for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      group.add(new THREE.Mesh(mg, m));
    }
  }
  const { buildLoco, buildWoodVan, buildSteelVan } = initStock(mat);
  // ---------- teren i tor ----------
  const T = sim.TRACK;
  const world = initWorld({ scene, renderer, mat });     // teren, morze i las
  const ground = world.fine;
  const weather = initWeather({ scene, renderer });       // niebo z chmurami, deszcz, mgła, błyskawice
  {
    const sel = document.getElementById('wx');
    for (const [k, w] of Object.entries(weather.WEATHER)) { const o = document.createElement('option'); o.value = k; o.textContent = w.label; sel.appendChild(o); }
    sel.value = weather.preset;
    const vb = document.getElementById('wx-var');
    sel.addEventListener('change', () => { weather.set(sel.value); weather.setVariable(false); vb.setAttribute('aria-pressed', 'false'); });
    vb.addEventListener('click', () => { const on = vb.getAttribute('aria-pressed') !== 'true'; weather.setVariable(on); vb.setAttribute('aria-pressed', String(on)); });
  }
  window.__train = { sim, world, weather, renderer, get camera() { return camera; }, get controls() { return controls; } };                 // do testów z konsoli
  // ukrywanie menu: przycisk i klawisz H
  {
    const tb = document.getElementById('ui-toggle');
    const toggle = () => { const off = document.body.classList.toggle('noui'); tb.setAttribute('aria-pressed', String(off)); tb.textContent = off ? 'Pokaż menu' : 'Ukryj menu'; };
    tb.addEventListener('click', toggle);
    addEventListener('keydown', e => { if (e.code === 'KeyH' && !(e.target.closest && e.target.closest('input,select,textarea'))) toggle(); });
  }

  // przebiegi osi torów: owal i przedłużenie (do podsypki i podkładów)
  const TRK = sim.track, Lext = TRK.Lext, hl = T.hl, Rc = T.R;
  function extAt(s) {
    const A = Math.PI * Rc;
    if (s < Lext) return { px: hl + s, pz: -Rc, tx: 1, tz: 0, nx: 0, nz: 1 };
    if (s < Lext + A) { const th = -Math.PI / 2 + (s - Lext) / Rc; return { px: hl + Lext + Rc * Math.cos(th), pz: Rc * Math.sin(th), tx: -Math.sin(th), tz: Math.cos(th), nx: -Math.cos(th), nz: -Math.sin(th) }; }
    return { px: hl + Lext - (s - Lext - A), pz: Rc, tx: -1, tz: 0, nx: 0, nz: -1 };
  }
  const routes = [{ at: sim.trackAt, L: T.L }, { at: extAt, L: 2 * Lext + Math.PI * Rc }];
  function sweepRoute(profile, route, material) {
    const N = Math.ceil(route.L / 0.5), pos = [];
    const secs = []; for (let i = 0; i <= N; i++) secs.push(route.at(i / N * route.L * 0.99999));
    for (let i = 0; i < N; i++) for (let j = 0; j < profile.length; j++) {
      const p = profile[j], q = profile[(j + 1) % profile.length], a = secs[i], b = secs[i + 1];
      const pt = (s, u) => [s.px + s.nx * u[0], u[1], s.pz + s.nz * u[0]];
      pos.push(...pt(a, p), ...pt(a, q), ...pt(b, q), ...pt(a, p), ...pt(b, q), ...pt(b, p));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); scene.add(m); return m;
  }
  mat.rail.side = THREE.DoubleSide; mat.ballast.side = THREE.DoubleSide;
  for (const r of routes) sweepRoute([[2.1, -0.45], [1.45, -0.26], [-1.45, -0.26], [-2.1, -0.45]], r, mat.ballast);
  // podkłady
  {
    const list = sim.terrain.sleepers, S = sim.SL;   // te same bryły co w fizyce
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2 * S.hx, 2 * S.hy, 2 * S.hz), mat.sleeper, list.length);
    const dm = new THREE.Object3D();
    list.forEach((s, i) => { dm.position.set(s.x, S.yc, s.z); dm.rotation.set(0, Math.atan2(-s.cz, s.cx), 0); dm.updateMatrix(); sl.setMatrixAt(i, dm.matrix); });
    scene.add(sl);
  }
  // przekrój szyny (zgodny z modelem kontaktu)
  const railProf = [];
  (function () {
    const half = [];
    half.push([0.075, -0.172], [0.075, -0.155], [0.01, -0.146], [0.008, -0.04], [0.036, -0.034]);
    for (let k = 0; k <= 6; k++) { const th = k / 6 * Math.PI / 2; const u = 0.024 + 0.012 * Math.cos(th), vc = -0.012 + 0.012 * Math.sin(th); half.push([u, vc - u * u / 0.6]); }
    for (let k = 1; k <= 4; k++) { const u = 0.024 - k * 0.012; half.push([u, -u * u / 0.6]); }
    railProf.push(...half);
    for (let k = half.length - 1; k >= 0; k--) { const [u, v] = half[k]; if (u > 0) railProf.push([-u, v]); }
  })();
  // szyny jako odcinki z modelu fizycznego (z przycięciami iglic i dzioba)
  function stationAt(pc, t) {
    if (pc.kind === 'line') return { x: pc.ax + pc.dx * t, z: pc.az + pc.dz * t, nx: -pc.dz, nz: pc.dx };
    const th = pc.th0 + t / pc.r, nx = Math.cos(th), nz = Math.sin(th); return { x: pc.cx + pc.r * nx, z: pc.cz + pc.r * nz, nx, nz };
  }
  const clipD = (c, x, z) => c.t === 'z' ? c.s * (c.v - z) : c.s * (c.v - Math.hypot(x - c.cx, z - c.cz));
  function pieceGeometry(pc) {
    // gęsty krok tylko tam, gdzie przycięcie zmienia przekrój (iglica, dziób); poza tym prosto: końce, łuk: co 0,5 m
    const coarse = pc.kind === 'line' ? pc.len : 0.5, ts = [];
    const clipActive = t => {
      if (pc.blade) return true;
      const st = stationAt(pc, t);
      return pc.clips.some(c => clipD(c, st.x - st.nx * 0.12, st.z - st.nz * 0.12) > 0 || clipD(c, st.x + st.nx * 0.12, st.z + st.nz * 0.12) > 0);
    };
    for (let t = 0; t < pc.len; ) {
      ts.push(t);
      if (clipActive(t)) { t += 0.04; continue; }
      let nt = Math.min(pc.len, t + coarse);
      for (let k = 0.5; t + k < nt; k += 0.5) if (clipActive(t + k)) { nt = t + Math.max(0.04, k - 0.5); break; }   // nie przeskocz początku przycięcia
      t = nt;
    }
    ts.push(pc.len);
    const secs = ts.map(t => {
      const st = stationAt(pc, t);
      let lo = -1, hi = 1;   // dopuszczalny zakres u
      for (const c of pc.clips) {
        const f = l => clipD(c, st.x + st.nx * l, st.z + st.nz * l);
        const fa = f(-0.09), fb = f(0.09);
        if (fa <= 0 && fb <= 0) continue;
        if (fa > 0 && fb > 0) { lo = hi = fa < fb ? -0.09 : 0.09; continue; }
        let a = -0.09, b = 0.09; for (let k = 0; k < 18; k++) { const m = (a + b) / 2; if ((f(m) > 0) === (fa > 0)) a = m; else b = m; }
        const lam = (a + b) / 2; if (fa <= 0) hi = Math.min(hi, lam); else lo = Math.max(lo, lam);
      }
      if (lo > hi) lo = hi;
      return railProf.map(([u, v]) => { const uu = Math.min(Math.max(u, lo), hi); return [st.x + st.nx * uu, v + pc.vOff, st.z + st.nz * uu]; });
    });
    const pos = [], n = railProf.length;
    for (let i = 0; i + 1 < secs.length; i++) for (let j = 0; j < n; j++) {
      const A = secs[i][j], B = secs[i][(j + 1) % n], C = secs[i + 1][(j + 1) % n], D = secs[i + 1][j];
      pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
    for (const sec of [secs[0], secs[secs.length - 1]]) {   // czoła szyn
      const c = sec.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
      for (let j = 0; j < n; j++) pos.push(...c, ...sec[j], ...sec[(j + 1) % n]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  const bladeVis = [];
  let railGroup = null;
  function buildRails() {   // zwykłe szyny (z przerwami na stykach) — przebudowa po zmianie szczeliny
    if (railGroup) { scene.remove(railGroup); railGroup.traverse(o => o.geometry && o.geometry.dispose()); }
    railGroup = new THREE.Group(); scene.add(railGroup);
    for (const pc of TRK.pieces) if (!pc.blade) railGroup.add(new THREE.Mesh(pieceGeometry(pc), mat.rail));
    mergeStatic(railGroup); railGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  buildRails();
  for (const pc of TRK.pieces) {
    if (!pc.blade) continue;
    const g = pieceGeometry(pc);
    const b = pc.blade, toe = stationAt(pc, b.toeAtEnd ? pc.len : 0), heel = stationAt(pc, b.toeAtEnd ? 0 : pc.len);
    g.translate(-heel.x, 0, -heel.z);
    const grp = new THREE.Group(); grp.position.set(heel.x, 0, heel.z); grp.add(new THREE.Mesh(g, mat.rail)); scene.add(grp);
    const rx = toe.x - heel.x, rz = toe.z - heel.z;
    bladeVis.push({ grp, b, thMax: b.throw * (b.nx * rz - b.nz * rx) / (rx * rx + rz * rz) });
  }
  // łubki na stykach szyn (po obu stronach szyjki) ze śrubami
  {
    const J = TRK.joints, plates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.085, 0.02), M(0x4a4d50, { roughness: 0.6, metalness: 0.5 }), J.length * 2);
    const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), M(0x2c2e30), J.length * 4);
    const dm = new THREE.Object3D(); let ip = 0, ib = 0;
    for (const j of J) {
      const nx = -j.tz, nz = j.tx, yaw = Math.atan2(-j.tz, j.tx);
      for (const sd of [1, -1]) { dm.position.set(j.x + nx * sd * 0.019, -0.088, j.z + nz * sd * 0.019); dm.rotation.order = 'XYZ'; dm.rotation.set(0, yaw, 0); dm.updateMatrix(); plates.setMatrixAt(ip++, dm.matrix); }
      for (const a of [-0.21, -0.07, 0.07, 0.21]) { dm.position.set(j.x + j.tx * a, -0.088, j.z + j.tz * a); dm.rotation.order = 'YXZ'; dm.rotation.set(Math.PI / 2, yaw, 0); dm.updateMatrix(); bolts.setMatrixAt(ib++, dm.matrix); }
    }
    scene.add(plates, bolts);
  }
  // napędy zwrotnicowe (skrzynki przy iglicach)
  for (const zs of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.45), M(0x55606a)); m.position.set(hl + 0.4, -0.1, zs * (Rc + 1.9)); scene.add(m);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.6), mat.steel); rod.position.set(hl + 0.25, -0.13, zs * (Rc + 1.0)); scene.add(rod);
  }

  // ---------- pojazdy ----------
  const box = (parent, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); parent.add(o); return o; };
  const cylX = (parent, m, r, len, x, y, z, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; };

  // przystanek autobusowy (dla żartu)
  {
    const g = new THREE.Group(), x0 = -22, z0 = -Rc - 6.2;
    const conc = M(0x9b9a94), post = M(0x3e4247), glassM = new THREE.MeshStandardMaterial({ color: 0xa9c4cc, transparent: true, opacity: 0.35, roughness: 0.1 });
    box(g, conc, 7, 0.18, 2.6, 0, -0.36, 0);
    for (const sx of [-1.6, 1.6]) box(g, post, 0.08, 2.4, 0.08, sx, 0.93, -0.9);
    for (const sx of [-1.6, 1.6]) box(g, post, 0.08, 2.4, 0.08, sx, 0.93, 0.5);
    box(g, glassM, 3.2, 2.0, 0.03, 0, 0.95, -0.92);
    for (const sx of [-1.62, 1.62]) box(g, glassM, 0.03, 2.0, 1.4, sx, 0.95, -0.2);
    box(g, M(0x2f3a44), 3.6, 0.1, 1.8, 0, 2.17, -0.2);
    box(g, M(0x6d4b32), 2.4, 0.06, 0.4, 0, 0.18, -0.65); box(g, post, 0.06, 0.45, 0.06, -1, -0.05, -0.65); box(g, post, 0.06, 0.45, 0.06, 1, -0.05, -0.65);
    const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
    const signT = tex(256, 256, (x, w, h) => {
      x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f4f9b'; x.fillRect(12, 12, w - 24, h - 24);
      x.fillStyle = '#fff'; x.fillRect(48, 70, 160, 80); x.fillStyle = '#1f4f9b'; for (let i = 0; i < 3; i++) x.fillRect(62 + i * 48, 82, 36, 30);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(80, 160, 16, 0, 7); x.arc(176, 160, 16, 0, 7); x.fill();
      x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('PRZYSTANEK', w / 2, 222);
    });
    const ttT = tex(256, 340, (x, w, h) => {
      x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, w, h); x.fillStyle = '#1b1b1b'; x.textAlign = 'center';
      x.font = 'bold 26px sans-serif'; x.fillText('ROZKŁAD JAZDY', w / 2, 40); x.font = 'bold 22px sans-serif'; x.fillText('Linia 0 „Tory”', w / 2, 76);
      x.font = '19px sans-serif'; ['Odjazdy:', 'brak', '', 'Autobus zastępczy', 'jeździ po torach', 'tylko w niedziele', 'które nie istnieją.'].forEach((l, i) => x.fillText(l, w / 2, 120 + i * 28));
    });
    box(g, post, 0.07, 2.9, 0.07, 3.0, 1.1, 0.9);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: signT, side: THREE.DoubleSide })); sign.position.set(3.0, 2.35, 0.94); g.add(sign);
    const tt = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshStandardMaterial({ map: ttT })); tt.position.set(3.0, 1.35, 0.94); g.add(tt);
    g.position.set(x0, 0, z0); scene.add(g); mergeStatic(g);
  }

  function wheelGeo(Rw) {
    const pts = [new THREE.Vector2(0.09, 0)];
    pts.push(new THREE.Vector2(Rw - 0.06, 0));
    for (let a = 0; a <= 0.135 + 1e-9; a += 0.0025) pts.push(new THREE.Vector2(Rw + sim.profileDelta(a), a));
    pts.push(new THREE.Vector2(Rw - 0.06, 0.135), new THREE.Vector2(Rw - 0.08, 0.10), new THREE.Vector2(0.14, 0.10), new THREE.Vector2(0.09, 0.15));
    const g = new THREE.LatheGeometry(pts, 48); g.rotateX(Math.PI / 2); return g;
  }
  function makeWheelset(Rw) {
    const g = new THREE.Group();
    const wg = wheelGeo(Rw);
    g.userData.sides = [];
    for (const sg of [1, -1]) {
      const side = new THREE.Group(); side.position.z = sg * sim.btb; side.userData.sg = sg; g.add(side); g.userData.sides.push(side);
      const w = new THREE.Mesh(wg, mat.wheel); w.scale.z = sg; side.add(w);
      const tg = new THREE.Mesh(new THREE.CylinderGeometry(Rw - 0.005, Rw - 0.005, 0.09, 64, 1, true), mat.tread);
      tg.rotation.x = Math.PI / 2; tg.position.z = sg * 0.09; side.add(tg);
      // oznaczenia na tarczy — widać obrót
      for (let k = 0; k < 3; k++) {
        const ang = k * 2 * Math.PI / 3;
        const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 14), mat.mark);
        mk.rotation.x = Math.PI / 2; mk.position.set(Math.cos(ang) * (Rw * 0.55), Math.sin(ang) * (Rw * 0.55), sg * 0.105); side.add(mk);
      }
      const sp = new THREE.Mesh(new THREE.BoxGeometry(Rw * 1.6, 0.05, 0.02), mat.mark);
      sp.position.z = sg * 0.105; side.add(sp);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.12, 20), mat.steel); axle.rotation.x = Math.PI / 2; g.add(axle);
    scene.add(g); return g;
  }
  const coilGeo = (function () {
    const pts = []; const turns = 6, N = 160;
    for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * 2 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * 0.09, t, Math.sin(a) * 0.09)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.016, 6, false);
  })();

  function lampLens(g, m, r, x, y, z) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.08, 18), mat.frame); h.rotation.z = Math.PI / 2; h.position.set(x - Math.sign(x) * 0.03, y, z); g.add(h);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 18), m); l.rotation.z = Math.PI / 2; l.position.set(x, y, z); g.add(l);
  }
  function buildBody(veh, i) {
    const d = veh.def, g = new THREE.Group(), y = h => h - d.comY, Lb = d.Lb;
    g.name = ['lokomotywa', 'wagon 1', 'wagon 2'][i] || 'pojazd';
    for (const sx of [1, -1]) {
      // zderzaki: tuleja (stała) + nurnik z talerzem (ruchomy)
      for (const sz of [1, -1]) {
        cylX(g, mat.frame, 0.12, 0.30, sx * (Lb / 2 + 0.15), y(sim.BUF_Y), sz * sim.BUF_Z);
        const head = new THREE.Group(); g.add(head);
        cylX(head, mat.steel, 0.075, 0.32, -sx * 0.18, 0, 0);
        cylX(head, mat.steel, 0.2, 0.04, -sx * 0.02, 0, 0, 28);
        head.userData = { sx, sz, x0: sx * (Lb / 2 + sim.BUF_EXT) };
        head.position.set(head.userData.x0, y(sim.BUF_Y), sz * sim.BUF_Z);
        (veh.bufMeshes = veh.bufMeshes || []).push(head);
      }
      const endKind = (i === 0 && sx < 0) || (i === 1 && sx > 0) ? 'knuckle' : (i === 1 && sx < 0) ? 'shackle' : (i === 2 && sx > 0) ? 'hook' : 'plain';
      const hx = sx * (Lb / 2 + sim.HOOK_EXT), hy = y(sim.BUF_Y);
      if (endKind === 'plain') box(g, mat.steel, 0.36, 0.08, 0.09, sx * (Lb / 2 + 0.16), hy, 0);
      if (endKind === 'shackle') { // sworzeń z jarzmem, na którym wisi pierwsze ogniwo
        box(g, mat.steel, 0.30, 0.10, 0.10, sx * (Lb / 2 + 0.13), hy, 0);
        for (const sz of [1, -1]) box(g, mat.steel, 0.07, 0.12, 0.025, hx - sx * 0.01, hy, sz * 0.045);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 12), mat.steel); pin.rotation.x = Math.PI / 2; pin.position.set(hx, hy, 0); g.add(pin);
      }
      if (endKind === 'hook') { // hak cięgłowy: trzon i zagięty dziób
        box(g, mat.steel, 0.27, 0.09, 0.09, sx * (Lb / 2 + 0.125), hy - 0.035, 0);
        const tg = new THREE.TorusGeometry(0.045, 0.022, 10, 18, Math.PI);
        const tip = new THREE.Mesh(tg, mat.steel); tip.rotation.z = Math.PI; tip.position.set(hx, hy + 0.01, 0); g.add(tip);
        box(g, mat.steel, 0.056, 0.08, 0.056, hx + sx * 0.045, hy + 0.04, 0);
      }
    }
    // wsporniki sprężyn nad maźnicami
    const soleZ = veh.type === 'loco' ? 1.12 : 1.05, soleBot = y(veh.type === 'loco' ? 0.85 : 0.97);
    for (const sp of veh.springs) {
      box(g, mat.frame, 0.34, 0.06, 0.3, sp.ax, sp.ay, sp.az);
      if (soleBot - sp.ay > 0.05) for (const dx of [-0.13, 0.13]) box(g, mat.frame, 0.05, soleBot - sp.ay, 0.05, sp.ax + dx, (soleBot + sp.ay) / 2 + 0.01, Math.sign(sp.az) * (soleZ - 0.03));   // wieszaki do podłużnicy
    }
    const last = i === sim.vehicles.length - 1;
    const fx = veh.type === 'loco' ? buildLoco(veh, g, y) : i === 1 ? buildWoodVan(veh, g, y, i) : buildSteelVan(veh, g, y, i, last);
    // źródła światła (lampy, reflektor) — oprawy i klosze są w modelu
    veh.fx = fx;
    if (fx.white) for (const p of fx.white) { const pl = new THREE.PointLight(0xfff0d8, 0.9, 16, 2); pl.position.set(p[0] + 0.3, p[1], p[2]); g.add(pl); }
    if (fx.head) {
      const hl = new THREE.SpotLight(0xfff4e0, 4.5, 160, 0.3, 0.4, 1.1); hl.position.set(fx.head[0] + 0.1, fx.head[1], fx.head[2]);
      hl.target.position.set(fx.head[0] + 40, y(0) - 0.5, 0); g.add(hl, hl.target);
      hl.castShadow = true; hl.shadow.mapSize.set(1024, 1024); hl.shadow.camera.near = 0.5; hl.shadow.camera.far = 160; hl.shadow.bias = -0.0004;
    }
    if (fx.red) for (const p of fx.red) { const pl = new THREE.PointLight(0xff2414, 0.7, 9, 2); pl.position.set(p[0] - 0.25, p[1], p[2]); g.add(pl); }
    scene.add(g); return g;
  }

  const vis = window.__vis = sim.vehicles.map((veh, i) => {
    const body = buildBody(veh, i); mergeStatic(body);
    const wsets = veh.ws.map(ws => { const w = makeWheelset(ws.Rw); for (const sd of w.userData.sides) mergeStatic(sd); return w; });
    const boxes = veh.springs.map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.26), mat.frame); scene.add(b); return b; });
    const coils = veh.springs.map(() => { const c = new THREE.Mesh(coilGeo, mat.spring); scene.add(c); return c; });
    return { veh, body, wsets, boxes, coils };
  });
  // głowice sprzęgu kłowego (kształty jak w modelu kontaktu)
  const knMat = M(0x3d4246, { roughness: 0.55, metalness: 0.5 });
  function makeKnuckleMesh() {
    const g = new THREE.Group(), KN = sim.KN, Hh = 2 * KN.hh - 0.02;
    box(g, knMat, 0.85, 0.17, 0.15, (KN.pivot + 0.25) / 2, 0, 0);
    box(g, knMat, 0.12, Hh, 0.5, 0.14, 0, -0.02);                       // korpus głowicy za gardzielą
    const pin = KN.shapes[2].a, kn = new THREE.Group(); kn.position.set(pin[0], 0, pin[1]); g.add(kn);   // kość na sworzniu
    KN.shapes.forEach((sh, i) => {
      const par = i === 2 || i === 3 ? kn : g, ox = par === kn ? pin[0] : 0, oz = par === kn ? pin[1] : 0;
      const [ax, az] = sh.a, [bx, bz] = sh.b, len = Math.hypot(bx - ax, bz - az);
      const b = box(par, knMat, len, Hh, 2 * sh.r, (ax + bx) / 2 - ox, 0, (az + bz) / 2 - oz); b.rotation.y = -Math.atan2(bz - az, bx - ax);
      for (const [px, pz] of [sh.a, sh.b]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(sh.r, sh.r, Hh, 18), knMat); c.position.set(px - ox, 0, pz - oz); par.add(c); }
    });
    const pinM = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, Hh + 0.06, 10), mat.steel); pinM.position.set(pin[0], 0, pin[1]); g.add(pinM);
    g.userData.kn = kn; mergeStatic(kn); mergeStatic(g);
    scene.add(g); return g;
  }
  const knMeshes = [];
  // ogniwa łańcucha: owalny pierścień w płaszczyźnie x–y ogniwa
  const linkGeo = (function () {
    const CH = sim.CH, pc = sim.couplers[1].pitch, rr = CH.rr, s = pc / 2 - rr + CH.rw, pts = [];
    for (let k = 0; k < 64; k++) {
      const t = k / 64, per = 4 * s + 2 * Math.PI * rr; let d = t * per, x, yy;
      if (d < 2 * s) { x = -s + d; yy = -rr; }
      else if ((d -= 2 * s) < Math.PI * rr) { const a = -Math.PI / 2 + d / rr; x = s + rr * Math.cos(a); yy = rr * Math.sin(a); }
      else if ((d -= Math.PI * rr) < 2 * s) { x = s - d; yy = rr; }
      else { d -= 2 * s; const a = Math.PI / 2 + d / rr; x = -s + rr * Math.cos(a); yy = rr * Math.sin(a); }
      pts.push(new THREE.Vector3(x, yy, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, CH.rw, 8, true);
  })();
  const linkMeshes = [];
  for (const cp of sim.couplers) {
    if (cp.type === 'knuckle') knMeshes.push([cp.ka.body, makeKnuckleMesh(), cp.ka], [cp.kb.body, makeKnuckleMesh(), cp.kb]);
    else for (const l of cp.links) { const m = new THREE.Mesh(linkGeo, mat.steel); scene.add(m); linkMeshes.push([l, m]); }
  }

  // talerz zderzaka ↔ para zderzaków w fizyce (raz, przy budowie)
  const bufLinks = [];
  for (const V of vis) for (const h of V.veh.bufMeshes) {
    const hd = sim.bufHeads.find(b => b.veh === V.veh && b.e === h.userData.sx && b.sz === h.userData.sz);
    bufLinks.push([h, hd || null]);
  }
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  const setQ = (o, q) => o.quaternion.set(q[1], q[2], q[3], q[0]);
  function syncVisuals() {
    for (const V of vis) {
      const b = V.veh.body;
      V.body.position.set(b.p[0], b.p[1], b.p[2]); setQ(V.body, b.q);
      V.veh.ws.forEach((ws, k) => { V.wsets[k].position.set(ws.p[0], ws.p[1], ws.p[2]); setQ(V.wsets[k], ws.q); });
      V.veh.springs.forEach((sp, k) => {
        const W = sp.ws.toWorld(0, 0, sp.wz, tmp);
        const bx = V.boxes[k]; bx.position.set(W[0], W[1], W[2]); setQ(bx, b.q);
        b.dirWorld(0, 1, 0, tmp2);
        const top = v3.set(W[0] + tmp2[0] * 0.12, W[1] + tmp2[1] * 0.12, W[2] + tmp2[2] * 0.12);
        const A = b.toWorld(sp.ax, sp.ay - 0.03, sp.az, tmp);
        const dir = v3b.set(A[0], A[1], A[2]).sub(top); const len = dir.length();
        const c = V.coils[k]; c.position.copy(top); c.quaternion.setFromUnitVectors(up, dir.normalize()); c.scale.set(1, Math.max(len, 0.01), 1);
      });
    }
    // talerze zderzaków
    for (const [h, bf] of bufLinks) h.position.x = h.userData.x0 - h.userData.sx * (bf ? bf.comp : 0);
    // sprzęgi: głowice i ogniwa
    for (const [b, m, k] of knMeshes) { m.position.set(b.p[0], b.p[1], b.p[2]); setQ(m, b.q); m.userData.kn.rotation.y = -k.ang; }
    for (const [b, m] of linkMeshes) { m.position.set(b.p[0], b.p[1], b.p[2]); setQ(m, b.q); }
  }

  // ---------- sterowanie ----------
  const $ = id => document.getElementById(id);
  const target = $('target');
  let dir = 1;
  const applyTarget = () => { sim.ctrl.target = dir * +target.value / 3.6; $('targetV').textContent = (dir < 0 ? '−' : '') + target.value + ' km/h'; };
  target.addEventListener('input', applyTarget);
  $('dir').addEventListener('click', () => {
    dir = -dir; $('dir').textContent = dir > 0 ? 'Kierunek: naprzód' : 'Kierunek: wstecz';
    $('dir').setAttribute('aria-pressed', String(dir < 0)); applyTarget();
  });
  $('restart').addEventListener('click', () => {
    sim.reset(); target.value = 0; applyTarget();
    $('brake').setAttribute('aria-pressed', 'false'); $('lock').setAttribute('aria-pressed', 'false');
  });
  const toggle = (btn, key) => btn.addEventListener('click', () => {
    sim.ctrl[key] = !sim.ctrl[key]; btn.setAttribute('aria-pressed', String(sim.ctrl[key]));
  });
  const power = $('power');
  power.addEventListener('input', () => {
    sim.ctrl.power = +power.value * 1000;
    $('powerV').textContent = power.value + ' kW · ' + Math.round(+power.value / 4) + ' kN';
  });
  document.querySelectorAll('.swb').forEach(b => b.addEventListener('click', () => {
    const s = TRK.switches[+b.dataset.sw]; s.target = s.target ? 0 : 1;
    b.textContent = 'Zwrotnica ' + (+b.dataset.sw + 1) + ': ' + (s.target ? 'prosto' : 'łuk'); b.setAttribute('aria-pressed', String(!!s.target));
  }));
  const tod = $('tod');
  const applyTod = () => { const h = +tod.value, hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60); $('todV').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); setTimeOfDay(h); };
  tod.addEventListener('input', applyTod); applyTod();
  const gapS = $('gap');
  gapS.addEventListener('input', () => { $('gapV').textContent = gapS.value + ' mm'; });
  gapS.addEventListener('change', () => { TRK.setGap(+gapS.value / 1000); buildRails(); });
  const clr = $('clr'), BTB0 = sim.BTB, CLR0 = 0.0046;
  clr.addEventListener('input', () => {
    sim.btb = BTB0 + CLR0 - (+clr.value) / 1000; $('clrV').textContent = (+clr.value).toFixed(1) + ' mm';
    for (const V of vis) for (const w of V.wsets) for (const sd of w.userData.sides) sd.position.z = sd.userData.sg * sim.btb;
  });
  // sprzęg 1: dźwignia rozprzęgacza (podnosi rygiel); stan czytany z fizyki
  $('cpl1').addEventListener('click', () => { const k = sim.couplers[0].ka; sim.knuckleLever(!k.lever); });
  let cpl2Msg = 0;
  $('cpl2').addEventListener('click', () => {
    const c = sim.couplers[1];
    if (c.hooked) sim.chainHook(false); else if (!sim.chainHook(true)) cpl2Msg = performance.now() + 1800;
  });
  function couplerLabels() {
    const st = sim.knuckleState(), b1 = $('cpl1'), b2 = $('cpl2'), c = sim.couplers[1];
    const t1 = { locked: 'Sprzęg 1: rozprzęgnij', bound: 'Sprzęg 1: rygiel zakleszczony (naciąg)', lever: 'Sprzęg 1: puść dźwignię', open: 'Sprzęg 1: otwarty — najedź, by sprzęgnąć' }[st];
    if (b1.textContent !== t1) b1.textContent = t1;
    if (b1.getAttribute('aria-pressed') !== String(st !== 'locked')) b1.setAttribute('aria-pressed', String(st !== 'locked'));
    const t2 = c.hooked ? 'Sprzęg 2: zdejmij z haka' : c.lifting ? 'Sprzęg 2: zakładanie…' : performance.now() < cpl2Msg ? 'Sprzęg 2: hak za daleko' : 'Sprzęg 2: załóż na hak';
    if (b2.textContent !== t2) b2.textContent = t2;
    if (b2.getAttribute('aria-pressed') !== String(!c.hooked)) b2.setAttribute('aria-pressed', String(!c.hooked));
  }
  toggle($('brake'), 'brake'); toggle($('lock'), 'lock');
  [0, 1, 2].forEach(i => {
    const s = $('m' + i);
    s.addEventListener('input', () => { sim.setMass(i, +s.value); $('m' + i + 'v').textContent = s.value + ' t'; });
  });

  // ---------- śledzenie kamery ----------
  const tY = [0, 0, 0];
  const yawOf = b => { b.dirWorld(1, 0, 0, tY); return Math.atan2(-tY[2], tY[0]); };
  const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a), x = v.x, z = v.z; v.x = x * c + z * s; v.z = -x * s + z * c; return v; };
  function anchor(kind) {
    if (kind === 'sw1' || kind === 'sw2') {   // stały punkt: środek rozjazdu (iglice → krzyżownica)
      const zs = kind === 'sw1' ? -1 : 1;
      return { p: new THREE.Vector3(sim.TRACK.hl + 7, 0, zs * sim.TRACK.R), yaw: 0 };
    }
    if (kind === 'flange') {   // styk koła z szyną: przedni zestaw lokomotywy, koło zewnętrzne
      const veh = sim.vehicles[0], ws = veh.ws[0], p = ws.toWorld(0, -ws.Rw, -0.75, [0, 0, 0]);
      return { p: new THREE.Vector3(p[0], p[1], p[2]), yaw: yawOf(veh.body) };
    }
    if (kind === 'loco') {
      const b = sim.vehicles[0].body; return { p: new THREE.Vector3(b.p[0], b.p[1], b.p[2]), yaw: yawOf(b) };
    }
    if (kind === 'side') {
      const veh = sim.vehicles[0], b = veh.body, p = b.toWorld(0, veh.def.Rw - veh.def.comY, 0, [0, 0, 0]);
      return { p: new THREE.Vector3(p[0], p[1], p[2]), yaw: yawOf(b) };
    }
    const c = sim.couplers[kind === 'c0' ? 0 : 1];
    const pa = c.pa || c.A.body.toWorld(...c.ha, [0, 0, 0]), pb = c.pb || c.B.body.toWorld(...c.hb, [0, 0, 0]);
    const ya = yawOf(c.A.body), yb = yawOf(c.B.body);
    return { p: new THREE.Vector3((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2), yaw: Math.atan2(Math.sin(ya) + Math.sin(yb), Math.cos(ya) + Math.cos(yb)) };
  }
  let follow = null;   // { kind, last }
  const folBtns = [...document.querySelectorAll('.fol')];
  function setFollow(kind) {
    folBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === (kind || ''))));
    if (!kind) { follow = null; return; }
    const a = anchor(kind);
    const off = kind === 'side' ? new THREE.Vector3(0, 0.15, -6.0)
      : kind === 'flange' ? new THREE.Vector3(0.75, -0.13, 0.42)
      : kind === 'loco' ? new THREE.Vector3(-11, 5, -10)
      : kind === 'sw1' ? new THREE.Vector3(-7, 4.5, -8) : kind === 'sw2' ? new THREE.Vector3(-7, 4.5, 8)
      : new THREE.Vector3(2.2, 1.4, -4.6);
    controls.target.copy(a.p);
    camera.position.copy(a.p).add(rotY(off.clone(), a.yaw));
    if (camera === ortho) { ortho.zoom = (ortho.top - ortho.bottom) / (2 * off.length() * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))); ortho.updateProjectionMatrix(); }
    controls.update();
    follow = { kind, last: a };
  }
  folBtns.forEach(b => b.addEventListener('click', () => setFollow(b.dataset.f)));
  const offLocal = new THREE.Vector3();

  // ---------- WSAD ----------
  const keys = new Set();
  const MOVE = { KeyW: 1, KeyS: 1, KeyA: 1, KeyD: 1 };
  addEventListener('keydown', e => { if (MOVE[e.code]) { keys.add(e.code); e.preventDefault(); } });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3();
  function moveCamera(dt) {
    if (!keys.size) return;
    if (follow) setFollow(null);
    camera.getWorldDirection(fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    fwd.normalize(); right.crossVectors(fwd, up).normalize();
    mv.set(0, 0, 0);
    if (keys.has('KeyW')) mv.add(fwd); if (keys.has('KeyS')) mv.sub(fwd);
    if (keys.has('KeyD')) mv.add(right); if (keys.has('KeyA')) mv.sub(right);
    if (mv.lengthSq() === 0) return;
    const dist = camera === persp ? camera.position.distanceTo(controls.target) : (ortho.top - ortho.bottom) / ortho.zoom;
    mv.normalize().multiplyScalar(Math.max(4, dist * 0.9) * dt);
    camera.position.add(mv); controls.target.add(mv);
  }

  // ---------- dźwięk proceduralny, przestrzenny (źródło w miejscu zdarzenia, słuchacz = kamera) ----------
  const SND = { friction: false, chain: false, knuckle: false, joint: false, buffer: false, sleeper: false, thunder: false };
  let ac = null, master = null, noiseBuf = null; const fric = [];
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== 'running') ac.resume();
  }
  const fin = (...a) => a.every(Number.isFinite);
  const setP = (p, x, y, z) => { if (!fin(x, y, z)) return; if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); };
  function panner(x, y, z) {
    const p = ac.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.3; p.maxDistance = 600;
    setP(p, x, y, z); p.connect(master); return p;
  }
  // s = siła uderzenia 0..1 (z prędkości zderzenia): głośność, a także barwa —
  // słabe uderzenie gasi wyższe składowe i trzask, mocne je odsłania i lekko podnosi ton
  function partials(dest, t, list, amp, det, s) {
    list.forEach(([f, a0, dec], i) => {
      const a = a0 * Math.pow(s, 0.45 * i), dd = dec * (0.7 + 0.6 * s);
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * (1 + 0.04 * s) * (1 + (Math.random() - 0.5) * det);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * a + 1e-5, t + 0.004 - 0.003 * s); g.gain.exponentialRampToValueAtTime(1e-4, t + dd);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dd + 0.02);
    });
  }
  function noise(dest, t, f, q, dur, amp, type) {
    const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; flt.type = type || 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    src.connect(flt); flt.connect(g); g.connect(dest); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
  }
  const VOICE = {
    joint: (d, t, s) => { partials(d, t, [[85, 1, 0.09], [160, 0.5, 0.06], [620, 0.15, 0.04]], 1.6 * s, 0.1, s); noise(d, t, 1600 + 1600 * s, 1.4, 0.03, 1.1 * s ** 1.4); },
    chain: (d, t, s) => { partials(d, t, [[1900, 1, 0.14], [3150, 0.8, 0.12], [4700, 0.6, 0.09], [6300, 0.4, 0.07]], 0.18 * s, 0.25, s); noise(d, t, 4000 + 2500 * s, 3, 0.02, 0.25 * s ** 1.4); },
    knuckle: (d, t, s) => { partials(d, t, [[180, 1, 0.55], [431, 0.7, 0.42], [812, 0.5, 0.3], [1490, 0.35, 0.22], [2630, 0.2, 0.12]], 0.55 * s, 0.06, s); noise(d, t, 800 + 1500 * s, 0.8, 0.035, 0.6 * s ** 1.4); },
    // drewno: krótki, tłumiony stuk o niskich, nieharmonicznych składowych + szum „włókien”
    sleeper: (d, t, s) => { partials(d, t, [[72, 1, 0.12], [148, 0.8, 0.07], [263, 0.6, 0.05], [417, 0.35, 0.035], [690, 0.2, 0.025]], 0.9 * s, 0.15, s); noise(d, t, 700 + 900 * s, 1.1, 0.05, 0.55 * s ** 1.2); noise(d, t + 0.004, 180, 0.9, 0.08, 0.4 * s, 'lowpass'); },
    buffer: (d, t, s) => { partials(d, t, [[55, 1, 0.28], [118, 0.6, 0.16], [390, 0.35, 0.18], [910, 0.15, 0.1]], 0.8 * s, 0.08, s); noise(d, t, 220 + 600 * s, 0.7, 0.06, 0.5 * s ** 1.4, 'lowpass'); },
  };
  function frictionVoices(on) {
    if (on && !fric.length) {
      for (const veh of sim.vehicles) for (const ws of veh.ws) {
        const p = panner(ws.p[0], ws.p[1], ws.p[2]);
        const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.value = 900;
        const g1 = ac.createGain(); g1.gain.value = 0; src.connect(bp); bp.connect(g1); g1.connect(p); src.start();
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 2600 + Math.random() * 1400;
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5 + Math.random() * 4; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
        const sq = ac.createBiquadFilter(); sq.type = 'bandpass'; sq.Q.value = 8; sq.frequency.value = o.frequency.value;
        const g2 = ac.createGain(); g2.gain.value = 0; o.connect(sq); sq.connect(g2); g2.connect(p); o.start(); lfo.start();
        fric.push({ ws, p, bp, g1, g2, nodes: [src, o, lfo] });
      }
    }
    if (!on && fric.length) { for (const f of fric) { f.nodes.forEach(n => n.stop()); f.p.disconnect(); } fric.length = 0; }
  }
  document.querySelectorAll('.snd input').forEach(cb => cb.addEventListener('change', () => {
    SND[cb.dataset.s] = cb.checked;
    if (cb.checked) audio();
    if (cb.dataset.s === 'friction' && ac) frictionVoices(cb.checked);
  }));
  const lpos = new THREE.Vector3(), lfwd = new THREE.Vector3(), lup = new THREE.Vector3();
  function soundFrame(nSteps) {
    const ev = sim.events;
    const anyOn = SND.friction || SND.chain || SND.knuckle || SND.joint || SND.buffer || SND.sleeper;
    if (!ac || !anyOn) { ev.length = 0; for (const b of sim.bodies) b.slipP = b.flangeP = 0; return; }
    // słuchacz: kamera (w rzucie ortogonalnym — odległość odpowiadająca widocznemu kadrowi)
    camera.getWorldDirection(lfwd); lup.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (camera === ortho) lpos.copy(controls.target).addScaledVector(lfwd, -(ortho.top - ortho.bottom) / ortho.zoom); else lpos.copy(camera.position);
    const L = ac.listener, t = ac.currentTime;
    if (!fin(lpos.x, lpos.y, lpos.z, lfwd.x, lfwd.y, lfwd.z)) { ev.length = 0; return; }
    if (L.positionX) { L.positionX.value = lpos.x; L.positionY.value = lpos.y; L.positionZ.value = lpos.z;
      L.forwardX.value = lfwd.x; L.forwardY.value = lfwd.y; L.forwardZ.value = lfwd.z; L.upX.value = lup.x; L.upY.value = lup.y; L.upZ.value = lup.z; }
    else { L.setPosition(lpos.x, lpos.y, lpos.z); L.setOrientation(lfwd.x, lfwd.y, lfwd.z, lup.x, lup.y, lup.z); }
    const used = {};
    for (const e of ev) {
      if (!SND[e.k] || !fin(e.x, e.y, e.z, e.s)) continue;
      if ((used[e.k] = (used[e.k] || 0) + 1) > 10) continue;
      if (lpos.distanceToSquared(v3.set(e.x, e.y, e.z)) > 300 * 300) continue;
      VOICE[e.k](panner(e.x, e.y, e.z), t + Math.random() * 0.004, e.s);
    }
    ev.length = 0;
    const n = Math.max(1, nSteps);
    for (const f of fric) {
      const ws = f.ws, Ps = (ws.slipP || 0) / n, Pf = (ws.flangeP || 0) / n, v = Math.hypot(ws.v[0], ws.v[1], ws.v[2]);
      if (!fin(Ps, Pf, v)) continue;
      setP(f.p, ws.p[0], ws.p[1], ws.p[2]);
      f.g1.gain.setTargetAtTime(Math.min(0.9, Math.sqrt(Ps / 4e5)), t, 0.05);
      f.bp.frequency.setTargetAtTime(450 + Math.min(v, 25) * 45, t, 0.1);
      f.g2.gain.setTargetAtTime(Pf > 600 ? Math.min(0.35, Math.sqrt((Pf - 600) / 5e4)) : 0, t, 0.08);
    }
    for (const b of sim.bodies) b.slipP = b.flangeP = 0;
  }

  // ===================== Efekty: otoczenie, dym, iskry, poświaty, snop reflektora =====================
  {
    const pm = new THREE.PMREMGenerator(renderer), skyT = TK.skyEquirect();
    scene.environment = pm.fromEquirectangular(skyT).texture; skyT.dispose(); pm.dispose();
  }
  mat.lampW.emissiveIntensity = 5; mat.lampR.emissiveIntensity = 4;
  const envMats = new Set();
  scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) envMats.add(o.material); });
  const softTex = (inner, mid) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner); g.addColorStop(0.3, mid); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
  const puffTex = (function () {                                         // kłąb dymu: miękka plama z szumem
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), r = TK.rng(77);
    for (let i = 0; i < 26; i++) { const px = 40 + r() * 48, py = 40 + r() * 48, s = 18 + r() * 26, g = x.createRadialGradient(px, py, 0, px, py, s);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    return new THREE.CanvasTexture(c);
  })();
  // cząstki jako Points z własnym rozmiarem i przezroczystością na punkt (jedno wywołanie rysowania)
  function particlePool(N, tex, additive) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), col = new Float32Array(N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, uScale: { value: 600 }, uOrtho: { value: 0 }, uOS: { value: 10 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float uScale, uOrtho, uOS;
        void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aAlpha <= 0.0 ? 0.0 : (uOrtho > 0.5 ? aSize * uOS : aSize * uScale / max(0.1, -mv.z)); }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    return { N, pos, size, alpha, col, g, m, vel: new Float32Array(N * 3), age: new Float32Array(N).fill(1e9), life: new Float32Array(N).fill(1), s0: new Float32Array(N), next: 0 };
  }
  const smoke = particlePool(110, puffTex, false), sparks = particlePool(220, softTex('rgba(255,255,255,1)', 'rgba(255,170,60,0.6)'), true);
  function spawn(pl, x, y, z, vx, vy, vz, life, s0) {
    const i = pl.next; pl.next = (i + 1) % pl.N;
    pl.pos[i * 3] = x; pl.pos[i * 3 + 1] = y; pl.pos[i * 3 + 2] = z; pl.vel[i * 3] = vx; pl.vel[i * 3 + 1] = vy; pl.vel[i * 3 + 2] = vz;
    pl.age[i] = 0; pl.life[i] = life; pl.s0[i] = s0;
  }
  // poświaty lamp i snop reflektora — przypięte do pudła lokomotywy / ostatniego wagonu
  const glows = [];
  const glowW = softTex('rgba(255,250,235,1)', 'rgba(255,235,200,0.35)'), glowR = softTex('rgba(255,120,90,1)', 'rgba(255,40,20,0.35)');
  const addGlow = (V, p, tex, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(p[0], p[1], p[2]); sp.scale.set(s, s, 1); V.body.add(sp); glows.push({ sp, s }); };
  let beam = null;
  for (const V of vis) {
    const f = V.veh.fx || {};
    if (f.white) for (const p of f.white) addGlow(V, p, glowW, 0.9);
    if (f.red) for (const p of f.red) addGlow(V, p, glowR, 0.75);
    if (f.head) {
      addGlow(V, f.head, glowW, 1.7);
      const L = 38, cg = new THREE.CylinderGeometry(4.2, 0.13, L, 28, 1, true); cg.translate(0, -L / 2, 0); cg.rotateZ(Math.PI / 2);
      const cm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uI: { value: 0 } },
        vertexShader: `varying float vY; void main(){ vY = clamp(position.x / ${L.toFixed(1)}, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uI; varying float vY; void main(){ float a = uI * 0.075 * pow(1.0 - vY, 1.7) * smoothstep(0.0, 0.06, vY); gl_FragColor = vec4(vec3(1.0, 0.95, 0.84) * a, a); }` });
      beam = new THREE.Mesh(cg, cm); beam.position.set(f.head[0], f.head[1], f.head[2]); beam.rotation.z = -0.085; V.body.add(beam);
    }
  }
  const locoVis = vis[0], SMOKE_LOC = (locoVis.veh.fx && locoVis.veh.fx.smoke) || [1, 2, 0];
  const fxP = [0, 0, 0], fxQ = [0, 0, 0];
  let smokeAcc = 0;
  function fxFrame(nSteps, dt) {
    const night = typeof nightF === 'number' ? nightF : 0, light = 0.1 + 0.9 * (1 - night);
    for (const m of envMats) m.envMapIntensity = 0.06 + 0.9 * (1 - night);
    bloom.strength = 0.12 + 0.9 * night;
    for (const gl of glows) gl.sp.material.opacity = 0.18 + 0.82 * night;
    if (beam) beam.material.uniforms.uI.value = night;
    // dym z komina: tym więcej, im większa siła napędu
    const lb = sim.vehicles[0].body, Fmax = Math.max(1, sim.ctrl.power / 4), load = Math.min(1, Math.abs(sim.st.F) / Fmax);
    smokeAcc += dt * (2.5 + 32 * load);
    lb.toWorld(SMOKE_LOC[0], SMOKE_LOC[1], SMOKE_LOC[2], fxP);
    while (smokeAcc >= 1) { smokeAcc -= 1; const r = Math.random;
      spawn(smoke, fxP[0], fxP[1], fxP[2], lb.v[0] * 0.75 + (r() - 0.5) * 0.4, 1.8 + 2.2 * load + r() * 0.4, lb.v[2] * 0.75 + (r() - 0.5) * 0.4, 3.2 + r() * 1.8, 0.5 + load * 0.3); }
    // iskry spod kół przy poślizgu (moc tarcia ślizgowego z fizyki)
    const n = Math.max(1, nSteps);
    for (const veh of sim.vehicles) for (const ws of veh.ws) {
      const P = (ws.slipP || 0) / n + 0.25 * (ws.flangeP || 0) / n;
      ws.sparkAcc = (ws.sparkAcc || 0) + dt * P / 2500;
      if (ws.sparkAcc > 40) ws.sparkAcc = 40;
      while (ws.sparkAcc >= 1) { ws.sparkAcc -= 1; const r = Math.random, sd = r() < 0.5 ? 0.75 : -0.75;
        ws.toWorld(0, -ws.Rw + 0.02, sd, fxQ);
        spawn(sparks, fxQ[0], fxQ[1], fxQ[2], ws.v[0] * 0.4 + (r() - 0.5) * 3, 1 + r() * 3.5, ws.v[2] * 0.4 + (r() - 0.5) * 3, 0.18 + r() * 0.3, 0.06 + r() * 0.04); }
    }
    // ruch cząstek (bez alokacji)
    const dsm = Math.exp(-1.1 * dt);
    for (let i = 0; i < smoke.N; i++) {
      const a = smoke.age[i] += dt, t = a / smoke.life[i], k = i * 3;
      if (t >= 1) { smoke.alpha[i] = 0; continue; }
      smoke.vel[k] *= dsm; smoke.vel[k + 2] *= dsm; smoke.vel[k + 1] = smoke.vel[k + 1] * dsm + 0.35 * dt;
      smoke.pos[k] += smoke.vel[k] * dt; smoke.pos[k + 1] += smoke.vel[k + 1] * dt; smoke.pos[k + 2] += smoke.vel[k + 2] * dt;
      smoke.size[i] = smoke.s0[i] + t * 3.6; smoke.alpha[i] = 0.5 * Math.min(1, t * 8) * Math.pow(1 - t, 1.4);
      const sh = (0.34 + 0.1 * t) * light; smoke.col[k] = sh; smoke.col[k + 1] = sh; smoke.col[k + 2] = sh * 1.03;
    }
    for (let i = 0; i < sparks.N; i++) {
      const a = sparks.age[i] += dt, t = a / sparks.life[i], k = i * 3;
      if (t >= 1) { sparks.alpha[i] = 0; continue; }
      sparks.vel[k + 1] -= 9.81 * dt;
      sparks.pos[k] += sparks.vel[k] * dt; sparks.pos[k + 1] += sparks.vel[k + 1] * dt; sparks.pos[k + 2] += sparks.vel[k + 2] * dt;
      if (sparks.pos[k + 1] < 0) { sparks.pos[k + 1] = 0; sparks.vel[k + 1] *= -0.3; }
      sparks.size[i] = sparks.s0[i]; sparks.alpha[i] = 1 - t; sparks.col[k] = 3.0; sparks.col[k + 1] = 1.6 - t; sparks.col[k + 2] = 0.5 - 0.4 * t;
    }
    for (const pl of [smoke, sparks]) { const g = pl.g.attributes; g.position.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = g.aCol.needsUpdate = true; }
    // skala punktów zależna od kamery
    const hpx = renderer.getPixelRatio() * innerHeight;
    for (const pl of [smoke, sparks]) {
      const u = pl.m.uniforms; u.uOrtho.value = camera === ortho ? 1 : 0;
      u.uScale.value = hpx / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)));
      u.uOS.value = hpx * ortho.zoom / (ortho.top - ortho.bottom);
    }
  }

  // cienie: wszystko rzuca i przyjmuje, poza podłożem i podsypką (tylko przyjmują)
  scene.traverse(o => { if (o.isMesh && !o.userData.keepShadow) { o.castShadow = o !== ground && o.material !== mat.ballast && !o.material.transparent; o.receiveShadow = true; } });

  // ---------- pętla ----------
  let last = performance.now(), acc = 0;
  const warn = $('broken');
  function frame(now) {
    requestAnimationFrame(frame);           // następna klatka zaplanowana zawsze — błąd niżej nie zatrzyma strony
    try { frameBody(now); } catch (e) { console.error(e); sim.broken = true; }
    if (warn.hidden === !!sim.broken) warn.hidden = !sim.broken;
  }
  function frameBody(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 1 / 20) dt = 1 / 20;
    acc += dt;
    if (follow) { offLocal.copy(camera.position).sub(controls.target); rotY(offLocal, -follow.last.yaw); }
    let n = 0;
    if (!sim.broken) { while (acc >= sim.H && n < 140) { sim.step(); acc -= sim.H; n++; if (sim.broken) break; } }
    if (n >= 140 || sim.broken) acc = 0;
    if (!sim.broken) { fxFrame(n, dt); soundFrame(n); syncVisuals(); } else sim.events.length = 0;
    couplerLabels();
    for (const bv of bladeVis) { const sw = TRK.switches[bv.b.sw], open = bv.b.openAt1 ? sw.pos : 1 - sw.pos; bv.grp.rotation.y = bv.thMax * open; }
    if (follow) {
      const a = anchor(follow.kind); controls.target.copy(a.p);
      camera.position.copy(a.p).add(rotY(offLocal.clone(), a.yaw)); follow.last = a;
    }
    moveCamera(dt);
    $('spd').textContent = isFinite(sim.st.speed) ? (sim.st.speed * 3.6).toFixed(1) : '—';
    $('trac').textContent = 'siła: ' + (sim.st.F / 1000).toFixed(1) + ' kN';
    $('pbar').style.width = (sim.ctrl.lock ? 100 : sim.st.brakeP * 100).toFixed(0) + '%';
    controls.update();
    placeSun();
    // pogoda: chmury przyciemniają słońce, mgła i deszcz skracają widoczność, wiatr kołysze drzewami i morzem
    const wx = weather.update(dt, camera, BASE.trueSun, BASE.sunEl, SND.thunder);
    wxNow = wx;
    sun.intensity = BASE.sunI * (BASE.sunEl > -3 ? Math.max(0.05, wx.shadow) : 1 - wx.coverage * wx.density * 0.8);
    hemi.intensity = BASE.hemiI * (1 + 0.2 * wx.coverage) + 0.6 * wx.flash;
    scene.fog.color.copy(wx.fog);
    scene.fog.far = Math.min(2600, Math.max(220, wx.visKm * 1000)); scene.fog.near = Math.min(400, scene.fog.far * 0.12);
    const clear = 1 - wx.coverage * 0.95;
    stars.material.opacity = BASE.starO * clear; moon.material.opacity = BASE.moonO * clear; moonGlow.material.opacity = BASE.moonG * clear;
    world.setWind(wx.wind);
    world.update(camera, dt, sun, hemi, scene.fog);
    renderFrame(now);
  }
  requestAnimationFrame(frame);
})();
