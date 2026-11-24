/* =====================================================================
 * UTILITÁRIOS: texturas desenhadas em canvas, geometrias, instâncias,
 * colisões e áudio sintetizado. Nada aqui depende do conteúdo do jogo.
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = {};
  CT.U = U;

  U.FONT_DISPLAY = '"Bricolage Grotesque", "Segoe UI", Roboto, Arial, sans-serif';
  U.FONT_BODY = '"Figtree", "Segoe UI", Roboto, Arial, sans-serif';

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.angleDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /* Gerador pseudoaleatório com semente: a cidade é sempre igual. */
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Ajusta o brilho de uma cor hex. f > 0 clareia, f < 0 escurece. */
  U.shade = function (hex, f) {
    const c = new THREE.Color(hex);
    if (f >= 0) c.lerp(new THREE.Color(0xffffff), f);
    else c.lerp(new THREE.Color(0x000000), -f);
    return "#" + c.getHexString();
  };

  /* ------------------------------------------------------------------
   * Materiais e geometrias compartilhados (cache)
   * ---------------------------------------------------------------- */
  const matCache = new Map();
  U.mat = function (color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.78, metalness: 0.02 }, opts || {}));
    matCache.set(key, m);
    return m;
  };
  const geoCache = new Map();
  U.geo = function (key, make) {
    if (!geoCache.has(key)) geoCache.set(key, make());
    return geoCache.get(key);
  };
  U.box = (w, h, d) => U.geo("b" + w + "_" + h + "_" + d, () => new THREE.BoxGeometry(w, h, d));
  U.cyl = (rt, rb, h, s) => U.geo("c" + rt + "_" + rb + "_" + h + "_" + (s || 12), () => new THREE.CylinderGeometry(rt, rb, h, s || 12));
  U.sph = (r, w, h) => U.geo("s" + r + "_" + (w || 16), () => new THREE.SphereGeometry(r, w || 16, h || 12));

  U.mesh = function (geo, mat, x, y, z, parent, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    if (parent) parent.add(m);
    return m;
  };

  /* Caixa com UV em escala de mundo: a textura repete conforme o tamanho. */
  U.boxWorldUV = function (w, h, d, unitU, unitV) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    // ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, uv.getX(idx) * (dims[f][0] / unitU), uv.getY(idx) * (dims[f][1] / unitV));
      }
    }
    uv.needsUpdate = true;
    return g;
  };

  /* ------------------------------------------------------------------
   * Texturas em canvas
   * ---------------------------------------------------------------- */
  U.canvasTex = function (w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  };

  U.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* Fachada com janelas. A textura tem 4 x 4 janelas (U.FACADE_N); assim
   * o mapa de "janelas acesas" pode variar de janela para janela à noite. */
  U.FACADE_N = 4;
  function windowRect(style) {
    if (style === "tall") return [30, 14, 68, 100];
    if (style === "band") return [0, 30, 128, 58];
    if (style === "glass") return [4, 4, 120, 120];
    return [22, 24, 84, 72];
  }
  const facadeCache = new Map();
  U.facadeTex = function (wall, glass, style) {
    const key = wall + glass + style;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const N = U.FACADE_N;
    const t = U.canvasTex(128 * N, 128 * N, (ctx) => {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        ctx.save(); ctx.translate(i * 128, j * 128);
        const w = 128, h = 128;
        ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, 0, w, 6);
        ctx.fillStyle = "rgba(0,0,0,0.07)"; ctx.fillRect(0, h - 8, w, 8);
        const [gx, gy, gw, gh] = windowRect(style);
        const grd = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
        grd.addColorStop(0, U.shade(glass, 0.35)); grd.addColorStop(0.55, glass); grd.addColorStop(1, U.shade(glass, -0.25));
        ctx.fillStyle = grd; ctx.fillRect(gx, gy, gw, gh);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath(); ctx.moveTo(gx, gy + gh * 0.55); ctx.lineTo(gx + gw * 0.45, gy); ctx.lineTo(gx + gw * 0.62, gy); ctx.lineTo(gx, gy + gh * 0.85); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 3;
        if (style !== "glass") ctx.strokeRect(gx, gy, gw, gh);
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(gx + gw / 2, gy); ctx.lineTo(gx + gw / 2, gy + gh); ctx.stroke();
        if (style !== "band" && style !== "glass") { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(gx - 4, gy + gh, gw + 8, 7); }
        ctx.restore();
      }
    }, true);
    facadeCache.set(key, t);
    return t;
  };
  /* Mapa de janelas acesas (usado como emissiveMap à noite). */
  U.facadeLit = function (style, seed) {
    const N = U.FACADE_N, r = U.rng(seed || 1);
    const warm = ["#FFD98A", "#FFE7B0", "#FFC56B", "#FFF2D0", "#CFE6FF"];
    const t = U.canvasTex(128 * N, 128 * N, (ctx) => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 128 * N, 128 * N);
      const [gx, gy, gw, gh] = windowRect(style);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (style === "band") {
          // faixa contínua: acende metades
          [0, 1].forEach((k) => { if (r() < 0.55) { ctx.globalAlpha = 0.55 + r() * 0.45; ctx.fillStyle = warm[Math.floor(r() * warm.length)]; ctx.fillRect(i * 128 + gx + k * gw / 2 + 2, j * 128 + gy + 2, gw / 2 - 4, gh - 4); } });
        } else if (r() < (style === "glass" ? 0.4 : 0.5)) {
          ctx.globalAlpha = 0.55 + r() * 0.45; ctx.fillStyle = warm[Math.floor(r() * warm.length)];
          ctx.fillRect(i * 128 + gx + 2, j * 128 + gy + 2, gw - 4, gh - 4);
        }
      }
      ctx.globalAlpha = 1;
    }, true);
    return t;
  };
  /* Caixa com fachada: unidades em metros por janela. */
  U.facadeBox = (w, h, d, unitU, unitV) => U.boxWorldUV(w, h, d, unitU * U.FACADE_N, unitV * U.FACADE_N);

  /* Placa de texto (nome de prédio, avisos...). */
  U.signTex = function (text, opts) {
    const o = Object.assign({ w: 1024, h: 256, bg: "#1E6FD9", fg: "#FFFFFF", sub: "", font: 120, radius: 40, border: null, badge: null }, opts);
    return U.canvasTex(o.w, o.h, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      U.roundRect(ctx, 6, 6, w - 12, h - 12, o.radius);
      ctx.fillStyle = o.bg; ctx.fill();
      if (o.border) { ctx.lineWidth = 12; ctx.strokeStyle = o.border; ctx.stroke(); }
      let left = 0;
      if (o.badge) {
        const r = h * 0.3;
        ctx.fillStyle = o.fg; ctx.beginPath(); ctx.arc(h * 0.52, h / 2, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = o.bg; ctx.font = "800 " + Math.round(r * 1.25) + "px " + U.FONT_DISPLAY;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(o.badge, h * 0.52, h / 2 + r * 0.06);
        left = h * 0.55;
      }
      ctx.fillStyle = o.fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let size = o.font;
      ctx.font = "800 " + size + "px " + U.FONT_DISPLAY;
      const maxW = w - 80 - left * 2;
      while (ctx.measureText(o.text || text).width > maxW && size > 30) { size -= 4; ctx.font = "800 " + size + "px " + U.FONT_DISPLAY; }
      const cy = o.sub ? h * 0.4 : h / 2;
      ctx.fillText(text, w / 2 + left / 2, cy + size * 0.04);
      if (o.sub) {
        ctx.globalAlpha = 0.85; ctx.font = "600 " + Math.round(o.font * 0.36) + "px " + U.FONT_BODY;
        ctx.fillText(o.sub, w / 2 + left / 2, h * 0.76); ctx.globalAlpha = 1;
      }
    });
  };

  /* Ícones flutuantes sobre os prédios: cadeado, exclamação, check, coroa. */
  U.markerTex = function (kind) {
    const colors = { lock: "#6B7385", go: "#FFB020", done: "#18B26B", boss: "#8E44FF" };
    return U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = colors[kind];
      ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 14; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.stroke();
      ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = "#FFFFFF";
      if (kind === "lock") {
        ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(128, 104, 34, Math.PI, 0); ctx.stroke();
        U.roundRect(ctx, 76, 104, 104, 78, 14); ctx.fill();
        ctx.fillStyle = colors.lock; ctx.beginPath(); ctx.arc(128, 136, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(122, 136, 12, 26);
      } else if (kind === "go") {
        ctx.font = "900 170px " + U.FONT_DISPLAY; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 128, 136);
      } else if (kind === "done") {
        ctx.lineWidth = 28; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(74, 132); ctx.lineTo(112, 170); ctx.lineTo(184, 92); ctx.stroke();
      } else if (kind === "boss") {
        ctx.beginPath(); ctx.moveTo(62, 170); ctx.lineTo(70, 88); ctx.lineTo(104, 124); ctx.lineTo(128, 74); ctx.lineTo(152, 124); ctx.lineTo(186, 88); ctx.lineTo(194, 170); ctx.closePath(); ctx.fill();
      }
    });
  };

  /* Exclamação flutuante sobre personagens com quem dá para conversar (estilo jogo). */
  U.talkTex = function () {
    return U.canvasTex(128, 256, (ctx) => {
      ctx.font = "900 236px " + U.FONT_DISPLAY; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = 26; ctx.strokeStyle = "#16305C"; ctx.strokeText("!", 64, 136);
      const g = ctx.createLinearGradient(0, 30, 0, 230); g.addColorStop(0, "#FFE066"); g.addColorStop(1, "#FFA914");
      ctx.fillStyle = g; ctx.fillText("!", 64, 136);
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.strokeText("!", 64, 136);
    });
  };

  /* ------------------------------------------------------------------
   * InstanceBatch: junta objetos repetidos (árvores, postes, bancos...)
   * em InstancedMesh para reduzir chamadas de desenho.
   * ---------------------------------------------------------------- */
  U.InstanceBatch = function () {
    this.groups = new Map();
  };
  U.InstanceBatch.prototype.add = function (geo, mat, x, y, z, ry, sx, sy, sz, shadow) {
    const key = geo.uuid + mat.uuid;
    if (!this.groups.has(key)) this.groups.set(key, { geo, mat, list: [], shadow: shadow !== false });
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
    this.groups.get(key).list.push(m);
  };
  U.InstanceBatch.prototype.addMatrix = function (geo, mat, matrix, shadow) {
    const key = geo.uuid + mat.uuid;
    if (!this.groups.has(key)) this.groups.set(key, { geo, mat, list: [], shadow: shadow !== false });
    this.groups.get(key).list.push(matrix.clone());
  };
  U.InstanceBatch.prototype.build = function (parent) {
    this.groups.forEach((g) => {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length);
      g.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = g.shadow; im.receiveShadow = true;
      im.frustumCulled = false; // instâncias espalhadas pela cidade inteira
      parent.add(im);
    });
  };

  /* ------------------------------------------------------------------
   * Colisões: caixas alinhadas aos eixos (AABB) contra um círculo.
   * ---------------------------------------------------------------- */
  U.Colliders = function () { this.list = []; };
  U.Colliders.prototype.addBox = function (minX, maxX, minZ, maxZ, tag) {
    const c = { minX, maxX, minZ, maxZ, enabled: true, tag: tag || "" };
    this.list.push(c);
    return c;
  };
  U.Colliders.prototype.addCentered = function (x, z, w, d, tag) {
    return this.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, tag);
  };
  U.Colliders.prototype.clear = function () { this.list.length = 0; };
  /* Empurra o círculo (x,z,r) para fora das caixas. Retorna posição corrigida. */
  U.Colliders.prototype.resolve = function (x, z, r) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of this.list) {
        if (!c.enabled) continue;
        if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
        const nx = U.clamp(x, c.minX, c.maxX), nz = U.clamp(z, c.minZ, c.maxZ);
        let dx = x - nx, dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          x += (dx / d) * push; z += (dz / d) * push;
        } else {
          // centro dentro da caixa: sai pelo lado mais próximo
          const l = x - c.minX, rr = c.maxX - x, t = z - c.minZ, b = c.maxZ - z;
          const m = Math.min(l, rr, t, b);
          if (m === l) x = c.minX - r; else if (m === rr) x = c.maxX + r; else if (m === t) z = c.minZ - r; else z = c.maxZ + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return { x, z };
  };

  /* ------------------------------------------------------------------
   * Áudio sintetizado (sem arquivos externos)
   * ---------------------------------------------------------------- */
  const A = { ctx: null, muted: false };
  CT.Audio = A;
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === "suspended") A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { A.ctx = null; }
  };
  A.tone = function (freq, dur, type, vol, delay, slideTo) {
    if (!A.ctx || A.muted) return;
    const t0 = A.ctx.currentTime + (delay || 0);
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(A.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  };
  /* Passos: ruído filtrado + batida grave, com timbre conforme o piso.
   * superficie: "asfalto" | "calcada" | "grama" | "molhado" | "interno"
   * forca: 0..1 (correr = mais alto) */
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = A.ctx.sampleRate; noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  const STEP = {
    asfalto: { f: 620, q: 0.9, dur: 0.07, vol: 0.2, thump: 95, tv: 0.16 },
    calcada: { f: 1500, q: 1.6, dur: 0.05, vol: 0.2, thump: 130, tv: 0.12 },
    grama:   { f: 2600, q: 0.5, dur: 0.12, vol: 0.12, thump: 70, tv: 0.07, hp: 900 },
    molhado: { f: 2200, q: 0.8, dur: 0.16, vol: 0.2, thump: 90, tv: 0.12, splash: true },
    interno: { f: 2000, q: 2.2, dur: 0.045, vol: 0.18, thump: 160, tv: 0.12, echo: true },
  };
  A.step = function (surface, forca) {
    if (!A.ctx || A.muted) return;
    const c = STEP[surface] || STEP.calcada, ctx = A.ctx, t0 = ctx.currentTime;
    const k = 0.55 + 0.45 * (forca == null ? 0.6 : forca), pr = 0.88 + Math.random() * 0.24;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
    if (c.echo) { const dl = ctx.createDelay(0.3); dl.delayTime.value = 0.07; const fb = ctx.createGain(); fb.gain.value = 0.22; out.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(ctx.destination); }
    // camada de ruído (o "arrastar" do sapato no piso)
    const src = ctx.createBufferSource(); src.buffer = noise(); src.playbackRate.value = pr;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = c.f * pr; bp.Q.value = c.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(c.vol * k, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + c.dur);
    let node = src.connect(bp);
    if (c.hp) { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = c.hp; node = node.connect(hp); }
    node.connect(g).connect(out);
    src.start(t0, Math.random() * 0.8, c.dur + 0.05);
    // batida grave (o peso do pé)
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(c.thump * pr * 1.4, t0); o.frequency.exponentialRampToValueAtTime(c.thump * pr * 0.7, t0 + 0.06);
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(c.tv * k, t0 + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    o.connect(og).connect(out); o.start(t0); o.stop(t0 + 0.1);
    // respingo na água
    if (c.splash) {
      const s2 = ctx.createBufferSource(); s2.buffer = noise(); s2.playbackRate.value = 1.3 * pr;
      const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.setValueAtTime(3800, t0 + 0.02); f2.frequency.exponentialRampToValueAtTime(1200, t0 + 0.2); f2.Q.value = 2.5;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t0 + 0.015); g2.gain.exponentialRampToValueAtTime(0.13 * k, t0 + 0.03); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      s2.connect(f2).connect(g2).connect(out); s2.start(t0 + 0.015, Math.random() * 0.7, 0.25);
    }
  };

  /* ---- sons da batalha contra o chefe (sintetizados) ---- */
  function nz(t0, dur, f0, f1, vol, type, q, attack) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = type || "lowpass"; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  }
  function osc(t0, dur, type, f0, f1, vol, opt) {
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + ((opt && opt.attack) || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (opt && opt.bp) { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = opt.bp; f.Q.value = opt.q || 1.5; node = node.connect(f); }
    if (opt && opt.vib) { // vibrato "robótico"
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = opt.vib; lg.gain.value = opt.vibDepth || 25;
      l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
    }
    node.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  /* o chefe leva um golpe: impacto + estalo metálico + gemido robótico */
  A.bossHit = function () {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    nz(t, 0.28, 4200, 260, 0.42);                                   // impacto
    osc(t, 0.3, "sine", 170, 42, 0.5);                               // peso do golpe
    osc(t, 0.4, "triangle", 1180, 1100, 0.07, { bp: 1180, q: 6 });   // estalo de metal
    osc(t, 0.32, "triangle", 1730, 1650, 0.05, { bp: 1730, q: 6 });
    osc(t + 0.07, 0.6, "sawtooth", 430, 150, 0.16, { bp: 950, q: 2.2, vib: 19, vibDepth: 38, attack: 0.03 }); // "argh!"
    osc(t + 0.07, 0.6, "square", 215, 75, 0.05, { bp: 600, q: 1.5, vib: 19, vibDepth: 20, attack: 0.03 });
  };
  /* golpe final: o chefe vira fumaça */
  A.bossDie = function () {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    nz(t, 0.35, 5000, 300, 0.45);
    osc(t, 1.0, "sine", 110, 30, 0.6);                               // estrondo
    osc(t + 0.05, 1.7, "sawtooth", 400, 50, 0.17, { bp: 900, q: 2, vib: 14, vibDepth: 60, attack: 0.04 }); // "nãããão"
    osc(t + 0.05, 1.7, "square", 200, 28, 0.05, { bp: 500, q: 1.2, vib: 14, vibDepth: 30, attack: 0.04 });
    for (let i = 0; i < 7; i++) osc(t + 0.3 + i * 0.13 + Math.random() * 0.05, 0.07, "square", 300 + Math.random() * 1500, 200 + Math.random() * 500, 0.035); // falhas eletrônicas
    nz(t + 0.25, 2.2, 2600, 160, 0.3, "lowpass", 0.6, 0.25);         // "puf" da fumaça
    nz(t + 0.4, 1.8, 6000, 1500, 0.06, "bandpass", 0.8, 0.4);        // chiado
  };

  A.play = function (name) {
    switch (name) {
      case "click": A.tone(660, 0.07, "triangle", 0.07); break;
      case "type": A.tone(900 + Math.random() * 200, 0.03, "square", 0.015); break;
      case "correct": [523, 659, 784, 1047].forEach((f, i) => A.tone(f, 0.22, "triangle", 0.11, i * 0.09)); break;
      case "wrong": A.tone(320, 0.18, "sawtooth", 0.06); A.tone(220, 0.3, "sawtooth", 0.06, 0.16); break;
      case "gate": A.tone(180, 0.5, "triangle", 0.1, 0, 420); A.tone(660, 0.25, "sine", 0.08, 0.45); A.tone(880, 0.3, "sine", 0.08, 0.6); break;
      case "enter": A.tone(392, 0.15, "sine", 0.08); A.tone(587, 0.2, "sine", 0.08, 0.1); break;
      case "locked": A.tone(200, 0.12, "square", 0.05); A.tone(160, 0.16, "square", 0.05, 0.1); break;
      case "boss": A.tone(110, 0.8, "sawtooth", 0.07, 0, 70); A.tone(82, 1, "triangle", 0.1, 0.2); break;
      case "victory":
        [523, 659, 784, 659, 784, 1047].forEach((f, i) => A.tone(f, 0.3, "triangle", 0.1, i * 0.14));
        A.tone(1047, 0.9, "sine", 0.08, 0.9); break;
      case "pop": A.tone(500 + Math.random() * 400, 0.12, "sine", 0.05, 0, 1200); break;
      case "jump": A.tone(260, 0.16, "sine", 0.07, 0, 560); A.tone(520, 0.1, "triangle", 0.025, 0.03, 900); break;
    }
  };

  /* ------------------------------------------------------------------
   * Trilha sonora: músicas em MP3 configuradas em CT.CONFIG.musicas
   *   menu  → tela inicial
   *   jogo  → fundo da cidade e dos prédios (baixinho, sem cortes)
   *   chefe → batalha contra o chefe final
   * Só uma toca por vez; a troca é feita com crossfade. Usa <audio> comum,
   * que funciona também abrindo o index.html direto (file://).
   * Os navegadores só liberam som após um gesto do jogador; por isso a
   * primeira música começa no primeiro clique ou tecla.
   * ---------------------------------------------------------------- */
  const Mus = { tracks: {}, current: null, off: false };
  CT.Music = Mus;
  const cfgOf = (name) => (CT.CONFIG && CT.CONFIG.musicas && CT.CONFIG.musicas[name]) || null;
  function track(name) {
    const cfg = cfgOf(name);
    if (!cfg || !cfg.arquivo) return null;
    let t = Mus.tracks[name];
    if (!t) {
      const el = new Audio();
      el.src = cfg.arquivo; el.loop = true; el.preload = "auto"; el.volume = 0;
      t = Mus.tracks[name] = { name, el, cfg, raf: 0 };
      el.addEventListener("play", () => Mus.onchange && Mus.onchange());
      el.addEventListener("pause", () => Mus.onchange && Mus.onchange());
    }
    return t;
  }
  // fade por tempo (setInterval: independe da taxa de quadros do jogo)
  function fadeTo(t, target, secs, then) {
    clearInterval(t.raf);
    const el = t.el, from = el.volume, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000 || 1));
      el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k >= 1) { clearInterval(t.raf); if (then) then(); }
    };
    t.raf = setInterval(step, 40);
    step();
  }
  const vol = (t) => (t.cfg.volume != null ? t.cfg.volume : 0.4);
  Mus.audible = () => !!Mus.current && !Mus.off && !A.muted && !document.hidden;
  function tryPlay(fade) {
    const t = Mus.current && track(Mus.current); if (!t || !Mus.audible()) return;
    const ok = () => { if (Mus.audible() && Mus.current === t.name) fadeTo(t, vol(t), fade == null ? 2 : fade); };
    if (!t.el.paused) return ok();
    const p = t.el.play();
    if (p && p.then) p.then(ok, () => {}); else ok();
  }
  /* Para uma faixa com fade; ela volta do começo na próxima vez. */
  function silence(t, secs, rewind) {
    if (t.el.paused) { if (rewind) t.el.currentTime = 0; return; }
    fadeTo(t, 0, secs, () => { if (Mus.current !== t.name || !Mus.audible()) { t.el.pause(); if (rewind && Mus.current !== t.name) t.el.currentTime = 0; } });
  }
  /* Troca a música (nome de CT.CONFIG.musicas, ou null para silêncio). */
  Mus.play = function (name, fade) {
    if (name === Mus.current) return tryPlay(fade);
    const prev = Mus.current;
    Mus.current = name || null;
    if (prev && Mus.tracks[prev]) silence(Mus.tracks[prev], fade == null ? 1.6 : fade, true);
    tryPlay(fade);
  };
  Mus.stop = function (fade) { Mus.play(null, fade); };
  Mus.element = (name) => { const t = track(name); return t && t.el; };
  Mus.preload = function () { Object.keys((CT.CONFIG && CT.CONFIG.musicas) || {}).forEach(track); };
  Mus.playing = function () { const t = Mus.current && Mus.tracks[Mus.current]; return !!(t && !t.el.paused && Mus.audible()); };
  /* Recalcula após mudar "mudo", liga/desliga da música ou trocar de aba. */
  Mus.refresh = function () {
    if (Mus.audible()) tryPlay(1.2);
    else Object.values(Mus.tracks).forEach((t) => silence(t, 0.4, false));
  };
  Mus.toggle = function () { Mus.off = !Mus.off; Mus.refresh(); return !Mus.off; };
  // primeiro gesto do jogador libera o áudio (política de autoplay dos navegadores)
  // (chamada síncrona: alguns navegadores exigem o play() dentro do próprio gesto)
  /* iPhone/iPad e alguns navegadores só deixam tocar depois um áudio que já
   * foi iniciado dentro de um toque. No primeiro gesto, cada faixa toca muda
   * por um instante e pausa: assim a música do menu pode começar sozinha
   * quando a abertura termina. */
  const liberadas = new Set();
  function liberarFaixas() {
    Object.keys((CT.CONFIG && CT.CONFIG.musicas) || {}).forEach((name) => {
      const t = track(name);
      if (!t || liberadas.has(name) || !t.el.paused) return;
      liberadas.add(name);
      const el = t.el, mudo = el.muted;
      el.muted = true;
      const p = el.play();
      const fim = () => { if (Mus.current !== name || !Mus.audible()) { el.pause(); el.currentTime = 0; } el.muted = mudo; };
      if (p && p.then) p.then(fim, () => { liberadas.delete(name); el.muted = mudo; }); else fim();
    });
  }
  const unlock = (e) => {
    if (e.target && e.target.closest && e.target.closest("#title-music")) return; // o próprio botão decide
    // dedo encostando ainda não libera o som (só ao soltar)
    if (!(e.type === "pointerdown" && e.pointerType !== "mouse")) liberarFaixas();
    const t = Mus.current && Mus.tracks[Mus.current];
    if (!t || t.el.paused) tryPlay();
  };
  // (no celular o som só é liberado ao soltar o dedo: pointerup/touchend/click)
  ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach((t) => window.addEventListener(t, unlock, true));
  document.addEventListener("visibilitychange", () => Mus.refresh());
})();
