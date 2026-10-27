  // ===================== Tekstury proceduralne =====================
  // Technika z ShipKit (laboratorium Space): jeden układ rysowany naraz na kilku płótnach —
  // kolor, szorstkość i wypukłość — więc ciemna spoina jest też wgłębiona i bardziej matowa.
  const TK = (function () {
    const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    function valueNoise(rand, cx, cy) {
      const g = new Float32Array(cx * cy); for (let i = 0; i < g.length; i++) g[i] = rand();
      const at = (x, y) => g[((y % cy + cy) % cy) * cx + ((x % cx + cx) % cx)];
      return (u, v) => {
        const fx = u * cx, fy = v * cy, x0 = Math.floor(fx), y0 = Math.floor(fy);
        let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
        return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      };
    }
    function fbm(rand, bx, by, oct) {
      const L = []; for (let o = 0; o < oct; o++) L.push(valueNoise(rand, bx << o, by << o));
      return (u, v) => { let s = 0, a = 0.5, n = 0; for (const f of L) { s += f(u, v) * a; n += a; a *= 0.5; } return s / n; };
    }
    const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    function paint(ctx, w, h, f) {
      const img = ctx.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = f(x / w, y / h), i = (y * w + x) * 4; d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; d[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    const cl = x => x < 0 ? 0 : x > 255 ? 255 : x;
    const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
    function three(w, h) { const [cC, c] = cv(w, h), [cR, r] = cv(w, h), [cB, b] = cv(w, h); b.fillStyle = '#808080'; b.fillRect(0, 0, w, h); return { cC, c, cR, r, cB, b, w, h }; }
    const out = k => ({ map: tex(k.cC, true), roughnessMap: tex(k.cR), bumpMap: tex(k.cB) });
    // zacieki rdzy spod nitów i krawędzi, brud od góry, pył od dołu
    function weather(k, rand, { grime = 1, rust = 0.5 }) {
      const { c, r, w, h } = k;
      for (let i = 0; i < 140 * grime; i++) {
        const x = rand() * w, y = rand() * h * 0.6, len = 20 + rand() * h * 0.35, wd = 1 + rand() * 5;
        const g = c.createLinearGradient(x, y, x, y + len); g.addColorStop(0, `rgba(25,22,18,${0.08 + rand() * 0.16})`); g.addColorStop(1, 'rgba(25,22,18,0)');
        c.fillStyle = g; c.fillRect(x, y, wd, len);
      }
      for (let i = 0; i < 90 * rust; i++) {
        const x = rand() * w, y = rand() * h, len = 10 + rand() * 70, wd = 1 + rand() * 3;
        const g = c.createLinearGradient(x, y, x, y + len); g.addColorStop(0, `rgba(122,58,24,${0.25 + rand() * 0.35})`); g.addColorStop(1, 'rgba(122,58,24,0)');
        c.fillStyle = g; c.fillRect(x, y, wd, len);
        r.fillStyle = 'rgba(220,220,220,0.5)'; r.fillRect(x, y, wd, len * 0.5);
      }
      const g = c.createLinearGradient(0, h * 0.72, 0, h);           // pył z toru na dole
      g.addColorStop(0, 'rgba(112,96,74,0)'); g.addColorStop(1, `rgba(112,96,74,${0.55 * grime})`); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    // blacha malowana: panele, spoiny/nity, pasy, łuszcząca się farba
    function steel({ w = 512, h = 512, seed = 1, base = [60, 80, 70], cols = 3, rows = 1, rivets = true, ribs = 0, stripes = [], grime = 1, rust = 0.5, rough = 140 }) {
      const rand = rng(seed), k = three(w, h), { c, r, b } = k;
      const mot = fbm(rand, 4, 4, 5), gr = fbm(rand, 48, 48, 2);
      paint(c, w, h, (u, v) => { const m = (mot(u, v) - 0.5) * 28 + (gr(u, v) - 0.5) * 9; return [cl(base[0] + m), cl(base[1] + m), cl(base[2] + m)]; });
      paint(r, w, h, (u, v) => { const x = rough + (mot(u, v) - 0.5) * 50; return [x, x, x]; });
      const pw = w / cols, ph = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = i * pw, y = j * ph, t = (rand() - 0.5) * 0.14;
        c.fillStyle = t > 0 ? `rgba(255,255,255,${t})` : `rgba(0,0,0,${-t})`; c.fillRect(x, y, pw, ph);
        c.strokeStyle = 'rgba(14,16,18,0.8)'; c.lineWidth = 2; c.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
        b.strokeStyle = '#2a2a2a'; b.lineWidth = 3; b.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
        r.strokeStyle = '#d8d8d8'; r.lineWidth = 3; r.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
        if (rivets) {
          const dot = (px, py) => { c.fillStyle = 'rgba(20,22,24,0.7)'; c.beginPath(); c.arc(px, py, 2.1, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.arc(px - 0.6, py - 0.6, 1, 0, 7); c.fill(); b.fillStyle = '#f0f0f0'; b.beginPath(); b.arc(px, py, 2.4, 0, 7); b.fill(); };
          for (let py = y + 10; py < y + ph - 6; py += 16) { dot(x + 6, py); dot(x + pw - 6, py); }
        }
      }
      for (let i = 0; i < ribs; i++) {                                 // przetłoczenia (żebra) — tylko wypukłość i światło
        const x = (i + 0.5) * w / ribs, g = b.createLinearGradient(x - 9, 0, x + 9, 0);
        g.addColorStop(0, '#808080'); g.addColorStop(0.3, '#c8c8c8'); g.addColorStop(0.7, '#404040'); g.addColorStop(1, '#808080'); b.fillStyle = g; b.fillRect(x - 9, 0, 18, h);
      }
      for (const s of stripes) {
        c.fillStyle = s.color; c.fillRect(0, s.y * h, w, s.h * h);
        for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(70,72,74,${rand() * 0.45})`; c.fillRect(rand() * w, s.y * h + rand() * s.h * h, 1 + rand() * 3, 1 + rand() * 2); }
      }
      for (let i = 0; i < 260; i++) {                                 // odpryski farby
        const x = rand() * w, y = rand() * h, s = 1 + rand() * 4;
        c.fillStyle = `rgba(${90 + rand() * 40},${62 + rand() * 20},${44},${0.25 + rand() * 0.4})`; c.fillRect(x, y, s, s * (0.5 + rand()));
        r.fillStyle = '#e0e0e0'; r.fillRect(x, y, s, s);
      }
      weather(k, rand, { grime, rust });
      return out(k);
    }
    // deski: usłojenie, sęki, szpary, gwoździe, wyblakła farba
    function planks({ w = 512, h = 512, seed = 5, base = [112, 66, 42], boards = 6, grime = 1 }) {
      const rand = rng(seed), k = three(w, h), { c, r, b } = k;
      const grain = fbm(rand, 6, 48, 4), mot = fbm(rand, 3, 3, 4), fine = fbm(rand, 40, 200, 2);
      const tone = []; for (let i = 0; i < boards; i++) tone.push((rand() - 0.5) * 26);
      paint(c, w, h, (u, v) => {
        const bi = Math.floor(u * boards), t = tone[bi];
        const g = Math.sin((u * boards * 3 + grain(u, v) * 6) * Math.PI * 2) * 0.5 + 0.5, f = (fine(u, v) - 0.5) * 18;
        const m = (mot(u, v) - 0.5) * 30 + t + g * 14 + f;
        return [cl(base[0] + m), cl(base[1] + m * 0.8), cl(base[2] + m * 0.6)];
      });
      paint(r, w, h, (u, v) => { const x = 185 + (grain(u, v) - 0.5) * 40; return [x, x, x]; });
      paint(b, w, h, (u, v) => { const x = 128 + (Math.sin((u * boards * 3 + grain(u, v) * 6) * Math.PI * 2) * 10) + (fine(u, v) - 0.5) * 30; return [x, x, x]; });
      const bw = w / boards;
      for (let i = 0; i <= boards; i++) {
        const x = i * bw; c.fillStyle = 'rgba(16,10,6,0.85)'; c.fillRect(x - 1.5, 0, 3, h); b.fillStyle = '#101010'; b.fillRect(x - 2, 0, 4, h);
        for (const yy of [0.06, 0.5, 0.94]) for (const dx of [0.25, 0.75]) {       // gwoździe
          const px = x + bw * dx, py = yy * h; c.fillStyle = 'rgba(30,30,34,0.85)'; c.beginPath(); c.arc(px, py, 2.2, 0, 7); c.fill(); b.fillStyle = '#e8e8e8'; b.beginPath(); b.arc(px, py, 2.4, 0, 7); b.fill();
          c.fillStyle = 'rgba(110,52,20,0.35)'; c.fillRect(px - 1, py, 2, 10 + rand() * 20);
        }
      }
      for (let i = 0; i < boards * 1.3; i++) {                          // sęki
        const x = rand() * w, y = rand() * h, rx = 3 + rand() * 6;
        c.fillStyle = 'rgba(48,26,14,0.75)'; c.beginPath(); c.ellipse(x, y, rx, rx * 2.4, 0, 0, 7); c.fill();
        b.fillStyle = '#5a5a5a'; b.beginPath(); b.ellipse(x, y, rx, rx * 2.4, 0, 0, 7); b.fill();
      }
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(190,170,140,${0.05 + rand() * 0.1})`; c.fillRect(rand() * w, rand() * h, 10 + rand() * 60, 4 + rand() * 30); }  // wyblakła farba
      weather(k, rand, { grime, rust: 0.2 });
      return out(k);
    }
    // blacha ryflowana (pomosty, stopnie)
    function tread({ w = 256, seed = 7 }) {
      const rand = rng(seed), k = three(w, w), { c, r, b } = k, mot = fbm(rand, 4, 4, 4);
      paint(c, w, w, (u, v) => { const m = (mot(u, v) - 0.5) * 30; return [cl(70 + m), cl(72 + m), cl(74 + m)]; });
      paint(r, w, w, () => [120, 120, 120]);
      for (let y = 0; y < w; y += 16) for (let x = 0; x < w; x += 16) {
        const o = (y / 16) % 2 ? 8 : 0, ang = ((x + y) / 16) % 2 ? 0.8 : -0.8;
        for (const [cx, cy] of [[x + o, y]]) { b.save(); b.translate(cx + 4, cy + 4); b.rotate(ang); b.fillStyle = '#e0e0e0'; b.fillRect(-5, -1.3, 10, 2.6); b.restore();
          c.save(); c.translate(cx + 4, cy + 4); c.rotate(ang); c.fillStyle = 'rgba(150,152,156,0.6)'; c.fillRect(-5, -1, 10, 2); c.restore(); r.fillStyle = '#707070'; r.fillRect(cx, cy + 3, 8, 2); }
      }
      weather(k, rand, { grime: 0.8, rust: 0.6 });
      return out(k);
    }
    // pasy ostrzegawcze na czołownicach (żółto-czarne skosy)
    function hazard({ w = 512, h = 128, seed = 9 }) {
      const rand = rng(seed), k = three(w, h), { c, r } = k;
      c.fillStyle = '#e8b417'; c.fillRect(0, 0, w, h); c.fillStyle = '#16171a';
      for (let x = -h; x < w + h; x += 64) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 32, h); c.lineTo(x + 32 + h, 0); c.lineTo(x + h, 0); c.fill(); }
      paint(r, w, h, () => [150, 150, 150]);
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(80,70,60,${rand() * 0.5})`; c.fillRect(rand() * w, rand() * h, 1 + rand() * 5, 1 + rand() * 3); }
      weather(k, rand, { grime: 1.2, rust: 0.8 });
      return out(k);
    }
    // papa / brezent dachu
    function roofing({ w = 512, h = 512, seed = 11, base = [62, 63, 64], strips = 6 }) {
      const rand = rng(seed), k = three(w, h), { c, r, b } = k, mot = fbm(rand, 6, 6, 5), fine = fbm(rand, 96, 96, 2);
      paint(c, w, h, (u, v) => { const m = (mot(u, v) - 0.5) * 34 + (fine(u, v) - 0.5) * 16; return [cl(base[0] + m), cl(base[1] + m), cl(base[2] + m)]; });
      paint(r, w, h, (u, v) => { const x = 215 + (fine(u, v) - 0.5) * 40; return [x, x, x]; });
      paint(b, w, h, (u, v) => { const x = 128 + (fine(u, v) - 0.5) * 50; return [x, x, x]; });
      for (let i = 0; i < strips; i++) { const y = i * h / strips; c.fillStyle = 'rgba(20,20,20,0.6)'; c.fillRect(0, y, w, 3); b.fillStyle = '#c0c0c0'; b.fillRect(0, y + 3, w, 4); }
      for (let i = 0; i < 30; i++) { const x = rand() * w, y = rand() * h, s = 20 + rand() * 90; const g = c.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, 'rgba(18,16,14,0.35)'); g.addColorStop(1, 'rgba(18,16,14,0)'); c.fillStyle = g; c.fillRect(x - s, y - s, 2 * s, 2 * s); }
      return out(k);
    }
    // żaluzje (kratka wentylacyjna)
    function louvre({ w = 256, h = 256, seed = 13, n = 16, base = [40, 54, 48] }) {
      const rand = rng(seed), k = three(w, h), { c, r, b } = k, sh = h / n;
      for (let i = 0; i < n; i++) {
        const y = i * sh, g = c.createLinearGradient(0, y, 0, y + sh);
        g.addColorStop(0, `rgb(${base[0] + 40},${base[1] + 40},${base[2] + 40})`); g.addColorStop(0.55, `rgb(${base[0]},${base[1]},${base[2]})`); g.addColorStop(1, '#070808');
        c.fillStyle = g; c.fillRect(0, y, w, sh);
        const gb = b.createLinearGradient(0, y, 0, y + sh); gb.addColorStop(0, '#f0f0f0'); gb.addColorStop(0.6, '#909090'); gb.addColorStop(1, '#101010'); b.fillStyle = gb; b.fillRect(0, y, w, sh);
      }
      paint(r, w, h, () => [130, 130, 130]);
      c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(0, 0, w, h);
      weather(k, rand, { grime: 1.4, rust: 0.4 });
      return out(k);
    }
    // żeliwo / stal surowa (tarcze kół, ostoja, sprzęgi)
    function cast({ w = 256, seed = 15, base = [52, 46, 42], rust = 0.8 }) {
      const rand = rng(seed), k = three(w, w), { c, r, b } = k, mot = fbm(rand, 6, 6, 5), fine = fbm(rand, 64, 64, 2);
      paint(c, w, w, (u, v) => { const m = (mot(u, v) - 0.5) * 40, ru = sst(0.55, 0.8, mot(u, v)) * rust; return [cl(base[0] + m + ru * 70), cl(base[1] + m + ru * 28), cl(base[2] + m * 0.8 + ru * 6)]; });
      paint(r, w, w, (u, v) => { const x = 175 + (fine(u, v) - 0.5) * 60; return [x, x, x]; });
      paint(b, w, w, (u, v) => { const x = 128 + (fine(u, v) - 0.5) * 70; return [x, x, x]; });
      return out(k);
    }
    // stal szlifowana (bieżnie kół, nurniki zderzaków)
    function brushed({ w = 256, seed = 17, tint = [170, 174, 180] }) {
      const rand = rng(seed), k = three(w, w), { c, r } = k, st = fbm(rand, 2, 96, 3);
      paint(c, w, w, (u, v) => { const s = (st(u, v) - 0.5) * 50; return [cl(tint[0] + s), cl(tint[1] + s), cl(tint[2] + s)]; });
      paint(r, w, w, (u, v) => { const x = 60 + (st(u, v) - 0.5) * 40; return [x, x, x]; });
      return out(k);
    }
    // podkład drewniany nasycony olejem
    function sleeperWood({ w = 256, h = 512, seed = 19 }) {
      const rand = rng(seed), k = three(w, h), { c, r, b } = k, grain = fbm(rand, 4, 40, 4), mot = fbm(rand, 3, 3, 4);
      paint(c, w, h, (u, v) => { const g = Math.sin((u * 7 + grain(u, v) * 5) * Math.PI * 2) * 0.5 + 0.5, m = (mot(u, v) - 0.5) * 30 + g * 16; return [cl(70 + m), cl(54 + m * 0.8), cl(40 + m * 0.6)]; });
      paint(r, w, h, (u, v) => { const x = 200 + (grain(u, v) - 0.5) * 40; return [x, x, x]; });
      paint(b, w, h, (u, v) => { const x = 128 + Math.sin((u * 7 + grain(u, v) * 5) * Math.PI * 2) * 22; return [x, x, x]; });
      for (let i = 0; i < 8; i++) { const x = rand() * w; c.strokeStyle = 'rgba(14,10,8,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, rand() * h); c.lineTo(x + (rand() - 0.5) * 20, rand() * h); c.stroke(); }  // pęknięcia
      for (const yy of [0.22, 0.78]) { const g = c.createRadialGradient(w / 2, yy * h, 5, w / 2, yy * h, w * 0.7); g.addColorStop(0, 'rgba(10,8,6,0.55)'); g.addColorStop(1, 'rgba(10,8,6,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }  // olej pod szynami
      return out(k);
    }
    // tłuczeń
    function gravel({ w = 512, seed = 21 }) {
      const rand = rng(seed), k = three(w, w), { c, r, b } = k;
      c.fillStyle = '#5d5a55'; c.fillRect(0, 0, w, w); paint(r, w, w, () => [235, 235, 235]);
      for (let i = 0; i < 2600; i++) {
        const x = rand() * w, y = rand() * w, s = 4 + rand() * 9, t = 70 + rand() * 80, n = 5 + Math.floor(rand() * 3);
        const pts = []; for (let j = 0; j < n; j++) { const a = j / n * 6.283 + rand() * 0.6, rr = s * (0.6 + rand() * 0.5); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        for (const [ctx, col] of [[c, `rgb(${t},${t - 3},${t - 8})`], [b, `rgb(${150 + rand() * 90},${0},${0})`]]) {
          ctx.fillStyle = ctx === b ? `rgb(${170 + rand() * 80 | 0},${170 + rand() * 80 | 0},${170 + rand() * 80 | 0})` : col;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
        }
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.25, s * 0.35, 0, 7); c.fill();
      }
      return out(k);
    }
    // trawa / grunt
    function grass({ w = 512, seed = 23 }) {
      const rand = rng(seed), k = three(w, w), { c, r, b } = k, mot = fbm(rand, 5, 5, 5), fine = fbm(rand, 128, 128, 2);
      paint(c, w, w, (u, v) => { const m = mot(u, v), f = (fine(u, v) - 0.5) * 30, dry = sst(0.55, 0.75, m); return [cl(88 + f + dry * 50), cl(104 + f + dry * 22), cl(62 + f * 0.6)]; });
      paint(r, w, w, () => [240, 240, 240]);
      paint(b, w, w, (u, v) => { const x = 128 + (fine(u, v) - 0.5) * 90; return [x, x, x]; });
      for (let i = 0; i < 6000; i++) { const x = rand() * w, y = rand() * w; c.strokeStyle = `rgba(${60 + rand() * 60},${90 + rand() * 50},${40},0.55)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 6); c.stroke(); }
      return out(k);
    }
    // kalkomania (napis/oznaczenie) na przezroczystym tle
    function decal(lines, { w = 512, h = 128, color = '#f0ede4', font = '"Barlow Condensed", "Arial Narrow", sans-serif', align = 'left', bg = null, weight = 600 }) {
      const [cC, c] = cv(w, h);
      if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
      c.fillStyle = color; c.textBaseline = 'top'; c.textAlign = align;
      let y = 6;
      for (const l of lines) { const s = l.size || 30; c.font = `${l.weight || weight} ${s}px ${font}`; c.fillText(l.t, align === 'center' ? w / 2 : 8, y); y += s * 1.12; }
      const rand = rng(lines.length * 7 + w); c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.7})`; c.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 2); }   // przetarcia
      const t = new THREE.CanvasTexture(cC); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
    }
    // niebo do odbić (mapa otoczenia): gradient, słońce, ziemia
    function skyEquirect() {
      const w = 512, h = 256, [cC, c] = cv(w, h), rand = rng(31), cl2 = fbm(rand, 8, 4, 5);
      paint(c, w, h, (u, v) => {
        const up = 1 - v * 2;   // +1 zenit, −1 nadir
        if (up < 0) { const m = (cl2(u, v) - 0.5) * 20; return [cl(92 + m), cl(96 + m), cl(74 + m)]; }
        const hz = Math.pow(1 - up, 3), cloud = sst(0.5, 0.75, cl2(u, v)) * 0.5 * (1 - hz);
        return [cl(110 + hz * 110 + cloud * 120), cl(150 + hz * 85 + cloud * 90), cl(205 + hz * 30 + cloud * 40)];
      });
      const g = c.createRadialGradient(w * 0.3, h * 0.22, 0, w * 0.3, h * 0.22, 60); g.addColorStop(0, '#ffffff'); g.addColorStop(0.1, 'rgba(255,240,210,0.9)'); g.addColorStop(1, 'rgba(255,230,190,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = new THREE.CanvasTexture(cC); t.encoding = THREE.sRGBEncoding; t.mapping = THREE.EquirectangularReflectionMapping; return t;
    }
    return { steel, planks, tread, hazard, roofing, louvre, cast, brushed, sleeperWood, gravel, grass, decal, skyEquirect, rng };
  })();

  // UV w skali świata: boki i czoła — u wzdłuż poziomu co `tile` metrów, v = wysokość bryły 0..1;
  // góra — u, v w poziomie co `tile` (dzięki temu pasy i brud „od dołu” pasują do wysokości bryły)
  function fitUV(geo, tile = 2) {
    geo.computeBoundingBox(); const bb = geo.boundingBox, H = (bb.max.y - bb.min.y) || 1;
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    if (!uv || !n) return geo;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      if (ay > ax && ay > az) uv.setXY(i, x / tile, z / tile);
      else if (az >= ax) uv.setXY(i, (n.getZ(i) > 0 ? x : -x) / tile, (y - bb.min.y) / H);
      else uv.setXY(i, (n.getX(i) > 0 ? -z : z) / tile, (y - bb.min.y) / H);
    }
    uv.needsUpdate = true; return geo;
  }
  // prostopadłościan z zaokrąglonymi krawędziami (z ShipKit: siatka pudełka, wierzchołki odsunięte na łuk)
  function roundedBox(w, h, d, r, k = 2) {
    const hx = w / 2, hy = h / 2, hz = d / 2; r = Math.min(r, hx, hy, hz);
    const n = 2 * k + 1, g = new THREE.BoxGeometry(w, h, d, n, n, n);
    const p = g.attributes.position, nr = g.attributes.normal;
    const remap = (x, half) => { const i = Math.round((x / half + 1) / 2 * n); if (i <= k) return -half + r * (1 - Math.cos(i / k * Math.PI / 2)); if (i >= n - k) return half - r * (1 - Math.cos((n - i) / k * Math.PI / 2)); return 0; };
    const v = new THREE.Vector3(), q = new THREE.Vector3(), o = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(remap(p.getX(i), hx), remap(p.getY(i), hy), remap(p.getZ(i), hz));
      q.set(Math.max(-hx + r, Math.min(hx - r, v.x)), Math.max(-hy + r, Math.min(hy - r, v.y)), Math.max(-hz + r, Math.min(hz - r, v.z)));
      o.subVectors(v, q); if (o.lengthSq() > 1e-12) { o.normalize(); v.copy(q).addScaledVector(o, r); nr.setXYZ(i, o.x, o.y, o.z); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
