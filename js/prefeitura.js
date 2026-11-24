/* =====================================================================
 * Prefeitura do Jaboatão dos Guararapes: modelo 3D do prédio 1
 * ---------------------------------------------------------------------
 * Feito por código a partir de uma foto da fachada (ferramentas/prefeitura/
 * foto-prefeitura.jpg):
 *  - prédio longo e baixo, revestido de painéis azuis, com telhado de
 *    fibrocimento ondulado aparecendo por trás da fachada;
 *  - à esquerda, pano de vidro alto; no meio, a entrada de vidro com marquise,
 *    vasos de planta, escada com corrimãos e patamar;
 *  - à direita, rampa com guarda-corpo branco, duas janelas e o logo da
 *    Prefeitura (coração + "JABOATÃO DOS GUARARAPES / PREFEITURA DA GENTE");
 *  - canteiro com palmeiras e dracenas;
 *  - três mastros com as bandeiras de Pernambuco, do Brasil e do Jaboatão,
 *    nessa ordem (da esquerda para a direita de quem olha), balançando ao vento.
 * Coordenadas locais: a fachada fica em z = +D/2 (voltada para a rua) e
 * x cresce para a direita de quem olha a fachada.
 * ===================================================================== */
(function () {
  "use strict";
  const U = CT.U;

  const Wd = 23, D = 13, H = 8.6;          // largura, profundidade e altura da fachada (m)
  const FZ = D / 2;                        // plano da fachada
  const LAND = 0.75;                       // altura do patamar da entrada
  const BLUE = "#2453C0";

  /* ---------- Texturas ---------- */
  // painéis azuis (2 × 2 painéis de 2,4 × 1,8 m por ladrilho)
  function facadeTex() {
    return U.canvasTex(512, 384, (ctx, w, h) => {
      const tones = ["#2554C2", "#2350BC", "#2757C6", "#2452BF"];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x = i * w / 2, y = j * h / 2;
        const g = ctx.createLinearGradient(x, y, x + w / 2, y + h / 2);
        g.addColorStop(0, U.shade(tones[i * 2 + j], 0.06)); g.addColorStop(1, tones[(i * 2 + j + 1) % 4]);
        ctx.fillStyle = g; ctx.fillRect(x, y, w / 2, h / 2);
      }
      ctx.fillStyle = "#16338E";
      [0, w / 2].forEach((x) => ctx.fillRect(x, 0, 3, h));
      [0, h / 2].forEach((y) => ctx.fillRect(0, y, w, 3));
      ctx.fillStyle = "rgba(140,175,255,0.35)";
      [3, w / 2 + 3].forEach((x) => ctx.fillRect(x, 0, 1.5, h));
      [3, h / 2 + 3].forEach((y) => ctx.fillRect(0, y, w, 1.5));
    }, true);
  }
  // telha de fibrocimento ondulada (ondas descendo o caimento)
  function roofTex() {
    return U.canvasTex(512, 256, (ctx, w, h) => {
      const n = 16, pw = w / n;
      for (let i = 0; i < n; i++) {
        const g = ctx.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
        g.addColorStop(0, "#8E918E"); g.addColorStop(0.35, "#C4C7C3"); g.addColorStop(0.6, "#B2B5B1"); g.addColorStop(1, "#7F827F");
        ctx.fillStyle = g; ctx.fillRect(i * pw, 0, pw, h);
      }
      // emendas das placas e manchas de tempo
      ctx.fillStyle = "rgba(60,62,60,0.35)"; ctx.fillRect(0, h / 2, w, 3); ctx.fillRect(0, 0, w, 2);
      let s = 7;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 90; k++) {
        ctx.fillStyle = r() < 0.5 ? "rgba(70,72,66,0.10)" : "rgba(235,235,228,0.12)";
        ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 6 + r() * 30, 3 + r() * 10, 0, 0, Math.PI * 2); ctx.fill();
      }
    }, true);
  }
  // folha de palmeira (nervura + folíolos), com transparência
  function frondTex(c1, c2) {
    return U.canvasTex(64, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = c2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 0); ctx.stroke();
      for (let y = 8; y < h - 4; y += 7) {
        const t = y / h, len = (w / 2 - 2) * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95));
        ctx.strokeStyle = (y / 7) % 2 ? c1 : U.shade(c1, -0.12); ctx.lineWidth = 3.2;
        [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(w / 2, y + 6); ctx.lineTo(w / 2 + s * len, y - 4); ctx.stroke(); });
      }
    });
  }
  // tufo de folhas finas da dracena (radial), com transparência
  function dracTex() {
    return U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      let s = 11;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 70; k++) {
        const a = -Math.PI * (0.02 + 0.96 * r()), L = 70 + r() * 56;
        const cols = ["#9DB53F", "#B9C24A", "#7E9E38", "#C7A24A", "#A86A3C"];
        ctx.strokeStyle = cols[Math.floor(r() * (r() < 0.8 ? 3 : 5))]; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(w / 2, h * 0.62);
        ctx.quadraticCurveTo(w / 2 + Math.cos(a) * L * 0.6, h * 0.62 + Math.sin(a) * L * 0.6, w / 2 + Math.cos(a) * L, h * 0.62 + Math.sin(a) * L * 0.85 + L * 0.18);
        ctx.stroke();
      }
    });
  }

  /* ---------- Bandeiras (desenho em canvas) ----------
   * mir = true: lado de quem olha a fachada (o mastro fica à direita); as formas
   * são espelhadas, mas os textos continuam legíveis. */
  function flagCanvas(draw, mir) {
    const w = 600, h = 420;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.save(); if (mir) ctx.setTransform(-1, 0, 0, 1, w, 0);
    draw.shapes(ctx, w, h); ctx.restore();
    if (draw.texts) draw.texts(ctx, w, h, mir);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  function star(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  const FLAG = {
    // Pernambuco: azul em cima (arco-íris vermelho/amarelo/verde, estrela e sol), branco embaixo com a cruz vermelha
    pernambuco: {
      shapes(ctx, w, h) {
        const bh = h * 2 / 3;
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#1C47A8"; ctx.fillRect(0, 0, w, bh);
        const cx = w / 2, R = w * 0.2, bw = w * 0.022;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, bh); ctx.clip();
        [["#E2231A", 0], ["#FFD200", 1], ["#009739", 2]].forEach(([c, i]) => {
          ctx.strokeStyle = c; ctx.lineWidth = bw;
          ctx.beginPath(); ctx.arc(cx, bh, R - bw * (i + 0.5), Math.PI, 0); ctx.stroke();
        });
        ctx.restore();
        ctx.fillStyle = "#FFD200";
        star(ctx, cx, bh - R - h * 0.12, h * 0.065);
        // sol com raios
        const sy = bh - R * 0.45, sr = h * 0.05;
        ctx.beginPath(); ctx.arc(cx, sy, sr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#FFD200"; ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3); ctx.lineTo(cx + Math.cos(a) * sr * 1.75, sy + Math.sin(a) * sr * 1.75); ctx.stroke(); }
        // cruz vermelha no branco
        ctx.fillStyle = "#E2231A";
        const ch = (h - bh) * 0.78, cy0 = bh + (h - bh - ch) / 2;
        ctx.fillRect(cx - w * 0.012, cy0, w * 0.024, ch);
        ctx.fillRect(cx - w * 0.05, cy0 + ch * 0.26, w * 0.1, h * 0.032);
      },
    },
    // Brasil: verde, losango amarelo, globo azul com faixa "ORDEM E PROGRESSO" e estrelas
    brasil: {
      shapes(ctx, w, h) {
        const u = w / 20, cx = w / 2, cy = h / 2;
        ctx.fillStyle = "#009C3B"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#FFDF00";
        ctx.beginPath(); ctx.moveTo(1.7 * u, cy); ctx.lineTo(cx, 1.7 * u); ctx.lineTo(w - 1.7 * u, cy); ctx.lineTo(cx, h - 1.7 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#002776"; ctx.beginPath(); ctx.arc(cx, cy, 3.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 3.5 * u, 0, Math.PI * 2); ctx.clip();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 0.5 * u;
        ctx.beginPath(); ctx.arc(cx - 2 * u, cy + 7 * u, 8.25 * u, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        const st = [[0.3, 1.6, 0.16], [-0.9, 1.9, 0.14], [1.4, 1.2, 0.13], [0.6, 2.5, 0.15], [-0.3, 2.9, 0.12], [-1.8, 1.0, 0.12], [2.2, 0.5, 0.12],
          [-2.4, 0.4, 0.1], [1.7, 2.2, 0.11], [-1.3, 2.6, 0.11], [0.1, 0.9, 0.1], [2.6, 1.5, 0.1], [-2.1, 1.8, 0.1], [1.0, 3.1, 0.1], [2.0, -0.7, 0.13]];
        st.forEach(([x, y, r]) => star(ctx, cx + x * u, cy + y * u, r * u * 1.6));
        ctx.restore();
      },
      texts(ctx, w, h, mir) {
        const u = w / 20, cx = w / 2, cy = h / 2, R = 8.25 * u;
        const txt = "ORDEM E PROGRESSO", n = txt.length;
        ctx.fillStyle = "#009C3B"; ctx.font = "800 " + (0.36 * u) + "px Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let i = 0; i < n; i++) {
          const k = mir ? n - 1 - i : i;
          const dx = (-2.45 + 4.9 * k / (n - 1)) * u + 2 * u, phi = Math.asin(dx / R);
          let x = cx - 2 * u + Math.sin(phi) * R, y = cy + 7 * u - Math.cos(phi) * R, a = phi;
          if (mir) { x = w - x; a = -a; }
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillText(txt[i], 0, 0); ctx.restore();
        }
      },
    },
    // Jaboatão dos Guararapes: cantão amarelo com o brasão, faixa branca diagonal com o nome, azul e verde
    jaboatao: {
      shapes(ctx, w, h) {
        const cw = w * 0.36, chh = h * 0.56;
        ctx.fillStyle = "#009C3B"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#1B3D9E";
        ctx.beginPath(); ctx.moveTo(cw, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(cw, chh); ctx.closePath(); ctx.fill();
        // faixa branca levemente ondulada
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = h * 0.13; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(cw, -10); ctx.lineTo(cw, chh);
        for (let t = 0; t <= 1.001; t += 0.05) ctx.lineTo(cw + (w - cw) * t * 1.04, chh + (h - chh) * t * 1.04 + Math.sin(t * Math.PI * 2) * h * 0.025);
        ctx.stroke();
        // cantão
        ctx.fillStyle = "#FFD21F"; ctx.fillRect(0, 0, cw - h * 0.065, chh - h * 0.04);
        // brasão (escudo com coroa mural)
        const bx = (cw - h * 0.065) / 2, by = chh * 0.52, sw = cw * 0.42, sh = chh * 0.55;
        ctx.fillStyle = "#C9A21A";
        ctx.fillRect(bx - sw * 0.42, by - sh * 0.72, sw * 0.84, sh * 0.16);
        for (let i = 0; i < 4; i++) ctx.fillRect(bx - sw * 0.42 + i * sw * 0.25, by - sh * 0.84, sw * 0.12, sh * 0.14);
        ctx.beginPath();
        ctx.moveTo(bx - sw / 2, by - sh * 0.52); ctx.lineTo(bx + sw / 2, by - sh * 0.52); ctx.lineTo(bx + sw / 2, by + sh * 0.08);
        ctx.quadraticCurveTo(bx + sw / 2, by + sh * 0.5, bx, by + sh * 0.58); ctx.quadraticCurveTo(bx - sw / 2, by + sh * 0.5, bx - sw / 2, by + sh * 0.08); ctx.closePath();
        ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#7A5A10"; ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.fillStyle = "#6FB7E8"; ctx.fillRect(bx - sw / 2, by - sh * 0.52, sw, sh * 0.5);
        ctx.fillStyle = "#2E8B3A"; ctx.beginPath(); ctx.moveTo(bx - sw / 2, by + sh * 0.1); ctx.quadraticCurveTo(bx - sw * 0.1, by - sh * 0.32, bx + sw / 2, by + sh * 0.05); ctx.lineTo(bx + sw / 2, by + sh * 0.6); ctx.lineTo(bx - sw / 2, by + sh * 0.6); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx - sw * 0.03, by - sh * 0.36, sw * 0.06, sh * 0.26); ctx.fillRect(bx - sw * 0.11, by - sh * 0.3, sw * 0.22, sh * 0.05);
        ctx.restore();
      },
      texts(ctx, w, h, mir) {
        const cw = w * 0.36, chh = h * 0.56;
        let x = cw + (w - cw) * 0.5, y = chh + (h - chh) * 0.5, a = Math.atan2(h - chh, w - cw);
        if (mir) { x = w - x; a = -a; }
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = "#1B3D9E"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "900 " + (h * 0.05) + "px Arial, sans-serif";
        ctx.fillText("JABOATÃO DOS", 0, -h * 0.026); ctx.fillText("GUARARAPES", 0, h * 0.03);
        ctx.restore();
      },
    },
  };

  /* Logo da fachada: coração com contorno branco e letras brancas, feito a partir
   * do logo oficial (assets/logos/prefeitura-jaboatao.png). */
  function logoTex() {
    const K = 4, pad = 18 * K, heartEnd = 146;
    const tex = U.canvasTex(434 * K + pad * 2, 122 * K + pad * 2, () => {});
    const cv = tex.image, ctx = cv.getContext("2d");
    const item = (CT.CONFIG.logosApoio || []).find((l) => l.id === "prefeitura-jaboatao");
    if (!item) return tex;
    const emb = window.CT_LOGOS_EMBUTIDOS || {};
    const im = new Image();
    im.onload = () => {
      const W0 = im.naturalWidth, H0 = im.naturalHeight, sc = (cv.width - pad * 2) / W0;
      const hw = heartEnd * W0 / 434;
      // coração: silhueta branca (contorno) e o coração por cima
      const hc = document.createElement("canvas"); hc.width = cv.width; hc.height = cv.height;
      const hx = hc.getContext("2d");
      hx.drawImage(im, 0, 0, hw, H0, pad, pad, hw * sc, H0 * sc);
      const sil = document.createElement("canvas"); sil.width = cv.width; sil.height = cv.height;
      const sx = sil.getContext("2d");
      const R = 7 * K;
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; sx.drawImage(hc, Math.cos(a) * R, Math.sin(a) * R); }
      sx.globalCompositeOperation = "source-in"; sx.fillStyle = "#FFFFFF"; sx.fillRect(0, 0, sil.width, sil.height);
      ctx.drawImage(sil, 0, 0); ctx.drawImage(hc, 0, 0);
      // letras em branco
      const tc = document.createElement("canvas"); tc.width = cv.width; tc.height = cv.height;
      const tx = tc.getContext("2d");
      tx.drawImage(im, hw, 0, W0 - hw, H0, pad + hw * sc, pad, (W0 - hw) * sc, H0 * sc);
      tx.globalCompositeOperation = "source-in"; tx.fillStyle = "#FFFFFF"; tx.fillRect(0, 0, tc.width, tc.height);
      ctx.drawImage(tc, 0, 0);
      tex.needsUpdate = true;
    };
    im.src = emb[item.arquivo] || item.arquivo;
    return tex;
  }

  /* ---------- Peças auxiliares ---------- */
  // tubo entre dois pontos (corrimãos, guarda-corpos)
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function tube(g, p1, p2, r, mat) {
    _a.set(p1[0], p1[1], p1[2]); _b.set(p2[0], p2[1], p2[2]);
    const len = _a.distanceTo(_b);
    const m = new THREE.Mesh(U.cyl(r, r, 1, 8), mat);
    m.scale.y = len; m.position.copy(_a).add(_b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
    m.castShadow = true; g.add(m);
    return m;
  }
  function box(g, w, h, d, mat, x, y, z, shadow) { return U.mesh(U.box(w, h, d), mat, x, y, z, g, shadow); }

  // folha curvada de palmeira (geometria compartilhada por tipo)
  function frondGeo(L, wid, up, curl) {
    const geo = new THREE.PlaneGeometry(wid, L, 1, 10);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + L / 2) / L;
      // integra a curva: começa subindo (ângulo "up") e vai caindo
      let px = 0, py = 0;
      const steps = Math.max(1, Math.round(t * 20));
      for (let k = 0; k < steps; k++) { const th = up - curl * (k / 20); px += Math.cos(th) * L / 20; py += Math.sin(th) * L / 20; }
      p.setXYZ(i, p.getX(i) * (1 - 0.55 * t), py, px);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function palm(g, x, z, opt) {
    const trunkM = U.mat(opt.trunk || "#8A7A62", { roughness: 0.95 });
    const lean = opt.lean || 0, h = opt.h;
    const top = new THREE.Vector3(x + lean, h, z);
    tube(g, [x, 0, z], [top.x, top.y, top.z], opt.r || 0.13, trunkM);
    const m = new THREE.MeshStandardMaterial({ map: frondTex(opt.c1, opt.c2), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
    const geo = frondGeo(opt.L, opt.wid || 0.75, 0.75, 1.9);
    const n = opt.n || 9;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(geo, m);
      f.position.copy(top); f.rotation.y = i * Math.PI * 2 / n + (opt.rot || 0) + Math.sin(i * 3.7) * 0.2;
      f.rotation.z = Math.sin(i * 2.3) * 0.15;
      g.add(f);
    }
    return top;
  }
  let dracM = null;
  function dracena(g, x, z, hs) {
    if (!dracM) dracM = new THREE.MeshStandardMaterial({ map: dracTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
    const trunkM = U.mat("#7C7466", { roughness: 0.95 });
    hs.forEach(([h, ox, oz]) => {
      tube(g, [x, 0, z], [x + ox, h, z + oz], 0.05, trunkM);
      for (let k = 0; k < 3; k++) {
        const p = new THREE.Mesh(U.geo("drac-plane", () => new THREE.PlaneGeometry(1.5, 1.5)), dracM);
        p.position.set(x + ox, h + 0.15, z + oz); p.rotation.y = k * Math.PI / 3 + ox; g.add(p);
      }
    });
  }

  /* ---------- Bandeira que balança ---------- */
  function flag(g, kind, poleX, poleZ, poleH, phase) {
    const fw = 2.5, fh = 1.75;
    const geo = new THREE.PlaneGeometry(fw, fh, 24, 12);
    geo.translate(-fw / 2, 0, 0); // tralha (lado do mastro) em x = 0, ponta solta para a esquerda (vento)
    const base = Float32Array.from(geo.attributes.position.array);
    const front = new THREE.MeshStandardMaterial({ map: flagCanvas(FLAG[kind], true), roughness: 0.8, side: THREE.FrontSide });
    const back = new THREE.MeshStandardMaterial({ map: flagCanvas(FLAG[kind], false), roughness: 0.8, side: THREE.BackSide });
    back.map.wrapS = THREE.RepeatWrapping; back.map.repeat.x = -1; back.map.offset.x = 1; // tralha também junto ao mastro no verso
    const grp = new THREE.Group(); grp.position.set(poleX - 0.05, poleH - 0.35 - fh / 2, poleZ); g.add(grp);
    const mf = new THREE.Mesh(geo, front), mb = new THREE.Mesh(geo, back);
    mf.castShadow = true; grp.add(mf, mb);
    const pos = geo.attributes.position;
    return function wave(t) {
      for (let i = 0; i < pos.count; i++) {
        const x0 = base[i * 3], y0 = base[i * 3 + 1];
        const u = -x0 / fw, v = (y0 + fh / 2) / fh;
        const a = 0.26 * Math.pow(u, 0.85);
        const z = a * Math.sin(u * 7.5 - t * 6.2 + phase + v * 0.9) + 0.05 * u * Math.sin(v * 5 + t * 4.1 + phase);
        pos.setXYZ(i, x0 * (1 - 0.04 * Math.abs(Math.sin(u * 3 - t * 6.2 + phase))), y0 - 0.1 * u * u + 0.03 * u * Math.sin(t * 3 + phase), z);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
  }

  /* ---------- Montagem ---------- */
  CT.Prefeitura = {
    largura: Wd, profundidade: D, altura: H,
    /** textura da bandeira ("pernambuco" | "brasil" | "jaboatao"), usada também no gabinete */
    texturaBandeira(kind) { return flagCanvas(FLAG[kind], true); },
    build(opts) {
      const atm = opts.atm, def = opts.def || {};
      const g = new THREE.Group();
      const boxes = [];   // colisões (retângulos locais x0, x1, z0, z1)
      const col = (x0, x1, z0, z1) => boxes.push([x0, x1, z0, z1]);

      // materiais
      const ftex = facadeTex();
      const blueM = new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.38, metalness: 0.25 });
      const bluePlainM = U.mat(BLUE, { roughness: 0.4, metalness: 0.25 });
      const whiteM = U.mat("#EEF1F3", { roughness: 0.45, metalness: 0.2 });
      const steelM = U.mat("#BFC5CB", { roughness: 0.3, metalness: 0.8 });
      const darkM = U.mat("#2A2F36", { roughness: 0.5, metalness: 0.4 });
      const graniteM = U.mat("#C9C4BA", { roughness: 0.85 });
      const glassM = new THREE.MeshStandardMaterial({ color: "#9CCBDA", roughness: 0.08, metalness: 0.5, emissive: "#FFE2A8", emissiveIntensity: 0 });
      atm.windowMat(glassM);   // acende à noite
      const winM = new THREE.MeshStandardMaterial({ color: "#4F6266", roughness: 0.12, metalness: 0.6, emissive: "#FFE2A8", emissiveIntensity: 0 });
      atm.windowMat(winM);

      // corpo
      const body = new THREE.Mesh(U.boxWorldUV(Wd, H, D, 4.8, 3.6), [blueM, blueM, bluePlainM, bluePlainM, blueM, blueM]);
      body.position.y = H / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      col(-Wd / 2, Wd / 2, -D / 2, D / 2);

      // telhado de fibrocimento em duas águas, aparecendo por trás da fachada
      const rise = 1.3, half = D / 2 - 0.1, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
      const rtex = roofTex(); rtex.repeat.set(Wd / 2.8, sl / 2.4);
      const roofM = new THREE.MeshStandardMaterial({ map: rtex, roughness: 0.9 });
      [1, -1].forEach((s) => {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(Wd + 0.3, sl), roofM);
        p.rotation.set(-Math.PI / 2 + ang, s < 0 ? Math.PI : 0, 0, "YXZ");
        p.position.set(0, H + rise / 2, s * half / 2); p.receiveShadow = true; p.castShadow = true; g.add(p);
      });
      const gable = new THREE.Shape(); gable.moveTo(-half, 0); gable.lineTo(half, 0); gable.lineTo(0, rise); gable.closePath();
      const gableM = U.mat(BLUE, { roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide });
      [-1, 1].forEach((s) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), gableM); m.rotation.y = Math.PI / 2; m.position.set(s * (Wd / 2 - 0.01), H, 0); g.add(m); });
      box(g, Wd + 0.3, 0.12, 0.3, U.mat("#9EA19D", { roughness: 0.9 }), 0, H + rise + 0.02, 0);
      // rufo/topo da fachada
      box(g, Wd + 0.06, 0.12, 0.2, U.mat("#1E45A6", { roughness: 0.5 }), 0, H + 0.04, FZ - 0.05);

      // pano de vidro alto à esquerda da entrada
      const gx0 = -6.3, gx1 = -2.6, gy0 = 0.1, gy1 = 6.6;
      box(g, gx1 - gx0, gy1 - gy0, 0.08, glassM, (gx0 + gx1) / 2, (gy0 + gy1) / 2, FZ + 0.03, false);
      [0, 1, 2, 3].forEach((i) => box(g, 0.07, gy1 - gy0, 0.14, whiteM, gx0 + i * (gx1 - gx0) / 3, (gy0 + gy1) / 2, FZ + 0.07));
      [gy0, 2.4, 4.6, gy1].forEach((y) => box(g, gx1 - gx0, 0.07, 0.14, whiteM, (gx0 + gx1) / 2, y, FZ + 0.07));
      // pilares azuis que emolduram a entrada
      [-2.45, 2.65].forEach((x) => box(g, 0.32, H, 0.42, bluePlainM, x, H / 2, FZ + 0.1));

      // entrada: 5 vãos (vidro, vidro, porta aberta, vidro, vidro) + bandeira de vidro em cima
      const ex0 = -2.29, ex1 = 2.49, bw = (ex1 - ex0) / 5, dTop = LAND + 2.6;
      box(g, ex1 - ex0, 4.3 - LAND, 0.06, glassM, (ex0 + ex1) / 2, (LAND + 4.3) / 2, FZ + 0.02, false);
      box(g, bw - 0.04, 2.6, 0.08, U.mat("#15191C", { roughness: 0.9 }), ex0 + bw * 2.5, LAND + 1.3, FZ + 0.05, false); // porta aberta (interior escuro)
      for (let i = 0; i <= 5; i++) box(g, 0.08, 4.3 - LAND, 0.12, whiteM, ex0 + i * bw, (LAND + 4.3) / 2, FZ + 0.07);
      [dTop, dTop + 0.12, 4.25].forEach((y) => box(g, ex1 - ex0, 0.1, 0.12, whiteM, (ex0 + ex1) / 2, y, FZ + 0.07));
      box(g, ex1 - ex0, 0.1, 0.12, whiteM, (ex0 + ex1) / 2, LAND + 0.05, FZ + 0.07);

      // marquise: viga azul, caibros escuros e placas translúcidas
      const cy = 4.55, cz0 = FZ, cz1 = FZ + 2.1, cxm = 0.1, cw = 5.7;
      const canM = new THREE.MeshStandardMaterial({ color: "#E3E5E0", roughness: 0.6, transparent: true, opacity: 0.9, emissive: "#FFF1CF", emissiveIntensity: 0 });
      atm.windowMat(canM);
      const can = new THREE.Group(); can.position.set(cxm, cy, cz0); can.rotation.x = 0.06; g.add(can);
      box(can, cw, 0.04, cz1 - cz0, canM, 0, 0.1, (cz1 - cz0) / 2, false);
      [-2.75, -0.9, 0.95, 2.8].forEach((x) => box(can, 0.08, 0.16, cz1 - cz0, darkM, x, 0.02, (cz1 - cz0) / 2));
      box(can, cw + 0.1, 0.18, 0.1, U.mat("#3F5BB8", { roughness: 0.5 }), 0, 0.08, cz1 - cz0);
      box(can, cw, 0.12, 0.1, darkM, 0, 0.0, 0.05);
      // refletores pretos acima da marquise
      [-2.2, 2.4].forEach((x) => { box(g, 0.34, 0.2, 0.24, U.mat("#1B1D21"), x, 5.25, FZ + 0.16); box(g, 0.3, 0.16, 0.02, U.mat("#FFF6DA", { emissive: "#FFF0C0", emissiveIntensity: 0.3 }), x, 5.25, FZ + 0.29, false); });

      // patamar e escada
      box(g, 5.8, LAND, 2.4, graniteM, 0.1, LAND / 2, FZ + 1.2);
      const stepsN = 5, rh = LAND / stepsN, tr = 0.32;
      for (let k = 1; k < stepsN; k++) {
        const hk = LAND - rh * k;
        box(g, 5.2, hk, tr, k % 2 ? U.mat("#D2CDC3", { roughness: 0.85 }) : graniteM, 0.1, hk / 2, FZ + 2.4 + tr * (k - 0.5));
      }
      const stEnd = FZ + 2.4 + tr * (stepsN - 1);
      col(-2.9, 3.0, FZ, stEnd);
      // corrimãos de inox (um na lateral esquerda e um no meio, como na foto)
      [-2.35, -0.15].forEach((x) => {
        tube(g, [x, LAND + 0.9, FZ + 1.9], [x, 0.9, stEnd + 0.15], 0.03, steelM);
        tube(g, [x, LAND, FZ + 1.9], [x, LAND + 0.9, FZ + 1.9], 0.025, steelM);
        tube(g, [x, 0, stEnd + 0.15], [x, 0.9, stEnd + 0.15], 0.025, steelM);
      });
      // vasos de terracota com plantas variegadas
      const potM = U.mat("#C2673F", { roughness: 0.85 });
      const leafA = U.mat("#9DAA3A", { flatShading: true, roughness: 0.9 }), leafB = U.mat("#C8C24E", { flatShading: true, roughness: 0.9 }), leafC = U.mat("#5F8A34", { flatShading: true, roughness: 0.9 });
      atm.leafMat && (atm.leafMat(leafA, 0), atm.leafMat(leafC, 2));
      [[-1.85, 1.0], [2.05, 0.85]].forEach(([x, s]) => {
        U.mesh(U.cyl(0.34, 0.25, 0.55, 14), potM, x, LAND + 0.275, FZ + 0.55, g);
        const ico = U.geo("ico-pref", () => new THREE.IcosahedronGeometry(0.3, 1));
        const ms = [leafA, leafB, leafC, leafA, leafB];
        for (let k = 0; k < 16; k++) {
          const t = k / 15, ang = k * 2.4 + x, rad = 0.12 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.15));
          const b = U.mesh(ico, ms[k % ms.length], x + Math.cos(ang) * rad * s, LAND + (0.75 + t * 1.7) * s, FZ + 0.55 + Math.sin(ang) * rad * 0.8, g);
          const k2 = (0.75 + 0.35 * Math.sin(k * 1.7)) * (1.05 - t * 0.35); b.scale.set(k2, k2 * 0.9, k2); b.rotation.set(k, k * 2, 0);
        }
      });

      // rampa com guarda-corpo branco, subindo da direita até o patamar
      const rx0 = 3.0, rx1 = 11.0, rz0 = FZ + 0.1, rz1 = FZ + 1.5;
      const rs = new THREE.Shape(); rs.moveTo(rx0, 0); rs.lineTo(rx1, 0); rs.lineTo(rx0, LAND); rs.closePath();
      const rg = new THREE.ExtrudeGeometry(rs, { depth: rz1 - rz0, bevelEnabled: false });
      const ramp = new THREE.Mesh(rg, graniteM); ramp.position.z = rz0; ramp.castShadow = ramp.receiveShadow = true; g.add(ramp);
      col(rx0 - 0.1, rx1 + 0.1, FZ, rz1 + 0.15);
      const rail = U.mat("#F4F5F6", { roughness: 0.4, metalness: 0.3 });
      const yR = (x) => LAND * (rx1 - x) / (rx1 - rx0);
      for (let x = rx0; x <= rx1 + 0.01; x += 1.0) tube(g, [x, yR(x), rz1 - 0.05], [x, yR(x) + 1.05, rz1 - 0.05], 0.03, rail);
      [1.05, 0.65, 0.3].forEach((hh) => tube(g, [rx0 - 0.3, yR(rx0) + hh, rz1 - 0.05], [rx1, yR(rx1) + hh, rz1 - 0.05], hh > 1 ? 0.032 : 0.022, rail));
      tube(g, [rx0 - 0.3, LAND + 1.05, rz1 - 0.05], [rx0 - 0.3, LAND, rz1 - 0.05], 0.03, rail);
      tube(g, [rx0, yR(rx0) + 0.9, rz0 + 0.06], [rx1, yR(rx1) + 0.9, rz0 + 0.06], 0.025, rail); // corrimão junto à parede
      // ponta da rampa: guarda-corpo que vira e acompanha a calçada
      tube(g, [rx1, 1.05, rz1 - 0.05], [rx1 + 0.4, 1.05, rz1 + 0.4], 0.03, rail);
      tube(g, [rx1 + 0.4, 0, rz1 + 0.4], [rx1 + 0.4, 1.05, rz1 + 0.4], 0.03, rail);

      // janelas (moldura branca, vidro escuro)
      [4.6, 9.6].forEach((x) => {
        box(g, 2.45, 1.12, 0.08, whiteM, x, 3.45, FZ + 0.03);
        box(g, 2.27, 0.96, 0.06, winM, x, 3.45, FZ + 0.07, false);
        box(g, 0.06, 0.96, 0.09, whiteM, x, 3.45, FZ + 0.08);
      });

      // logo da Prefeitura na fachada (letras brancas com sombra, para parecer em relevo)
      const ltex = logoTex();
      const logoM = new THREE.MeshStandardMaterial({ map: ltex, transparent: true, alphaTest: 0.08, roughness: 0.45, emissive: "#FFFFFF", emissiveMap: ltex, emissiveIntensity: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      atm.windowMat(logoM);
      const lw = 7.6, lh = lw * (122 + 36) / (434 + 36);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), logoM); logo.position.set(7.05, 6.25, FZ + 0.09); g.add(logo);
      const shM = new THREE.MeshBasicMaterial({ map: ltex, color: "#000000", transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      const sh = new THREE.Mesh(logo.geometry, shM); sh.position.set(7.05 + 0.05, 6.25 - 0.07, FZ + 0.05); g.add(sh);

      // canteiro à esquerda, com palmeiras e dracenas
      const bedM = U.mat("#B5B0A4", { roughness: 0.9 }), soilM = U.mat("#58733A", { roughness: 1 });
      box(g, 8.45, 0.32, 3.2, bedM, -7.2, 0.16, FZ + 1.6);
      box(g, 8.25, 0.04, 3.0, soilM, -7.2, 0.33, FZ + 1.6, false);
      col(-Wd / 2, -2.95, FZ, FZ + 3.2);
      palm(g, -10.4, FZ + 1.9, { h: 5.6, lean: 0.35, L: 2.6, c1: "#5E8D35", c2: "#4A6E2A", n: 11, r: 0.15 });
      // palmeira-areca em touceira, perto da entrada
      [[-3.7, FZ + 1.5, 4.7, -0.15], [-3.45, FZ + 1.9, 5.6, 0.2], [-4.1, FZ + 2.1, 4.1, -0.35], [-3.2, FZ + 1.2, 3.6, 0.3]].forEach(([x, z, h, l], i) =>
        palm(g, x, z, { h, lean: l, L: 2.1, wid: 0.6, c1: "#9BB043", c2: "#7C8F30", trunk: "#9AA157", n: 7, r: 0.06, rot: i }));
      dracena(g, -9.0, FZ + 1.2, [[3.6, 0.2, 0], [2.9, -0.3, 0.2], [4.3, 0.1, -0.2]]);
      dracena(g, -7.6, FZ + 2.3, [[2.6, 0.2, 0.1], [3.4, -0.2, -0.1]]);
      dracena(g, -6.2, FZ + 1.0, [[4.6, 0.25, 0], [3.8, -0.25, 0.15], [3.0, 0, -0.2]]);
      dracena(g, -5.0, FZ + 2.4, [[3.2, 0.2, 0], [2.4, -0.2, 0.1]]);
      dracena(g, -11.0, FZ + 0.7, [[2.8, 0.1, 0], [3.5, -0.2, 0.1]]);
      const shrub = U.mat("#4E7F35", { flatShading: true, roughness: 0.95 });
      [[-8.3, 0.9], [-5.8, 2.7], [-9.8, 2.8], [-4.4, 0.6]].forEach(([x, dz]) => { const b = U.mesh(U.geo("ico-pref2", () => new THREE.IcosahedronGeometry(0.55, 1)), shrub, x, 0.6, FZ + dz, g); b.scale.set(1.2, 0.8, 1); });

      // árvore jovem na frente da rampa e guarda-sol branco
      tube(g, [6.2, 0, FZ + 2.6], [6.0, 2.6, FZ + 2.5], 0.06, U.mat("#7A5A3A"));
      [[6.0, 2.9, 0.75], [5.6, 2.4, 0.5], [6.4, 2.5, 0.55], [6.1, 3.5, 0.5]].forEach(([x, y, s]) => {
        const b = U.mesh(U.geo("ico-pref3", () => new THREE.IcosahedronGeometry(0.6, 0)), U.mat("#6E9E3E", { flatShading: true }), x, y, FZ + 2.5, g); b.scale.setScalar(s / 0.6);
      });
      col(5.8, 6.4, FZ + 2.3, FZ + 2.9);
      tube(g, [11.0, 0, FZ + 2.4], [11.0, 2.3, FZ + 2.4], 0.03, steelM);
      const umb = U.mesh(new THREE.ConeGeometry(1.4, 0.45, 12, 1, true), U.mat("#F6F7F8", { roughness: 0.6, side: THREE.DoubleSide }), 11.0, 2.35, FZ + 2.4, g);
      umb.castShadow = true;
      col(10.8, 11.2, FZ + 2.2, FZ + 2.6);

      // placa com o número da etapa (o jogador encontra o prédio 1 por ela)
      const signM = new THREE.MeshBasicMaterial({ map: U.signTex(def.nome || "Portal da Transparência", { bg: "#16305C", fg: "#FFFFFF", badge: "1", font: 104, border: "#FFFFFF" }), transparent: true });
      const sx = 5.4, sz = FZ + 5.0;
      [-1.55, 1.55].forEach((o) => box(g, 0.12, 1.5, 0.12, darkM, sx + o, 0.75, sz));
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), signM); plate.position.set(sx, 1.15, sz + 0.04); g.add(plate);
      const plate2 = plate.clone(); plate2.rotation.y = Math.PI; plate2.position.z = sz - 0.04; g.add(plate2);
      box(g, 3.62, 0.92, 0.06, darkM, sx, 1.15, sz);
      col(sx - 1.8, sx + 1.8, sz - 0.2, sz + 0.2);

      // mastros com as bandeiras: Pernambuco, Brasil e Jaboatão (da esquerda para a direita)
      const poleM = U.mat("#D9DDE0", { roughness: 0.35, metalness: 0.7 });
      const fz = FZ + 5.6;
      const waves = [];
      [["pernambuco", -5.1, 11.0], ["brasil", -2.9, 11.8], ["jaboatao", -0.7, 11.2]].forEach(([kind, x, ph], i) => {
        U.mesh(U.cyl(0.05, 0.065, ph, 10), poleM, x, ph / 2, fz, g);
        U.mesh(U.sph(0.09, 10, 8), poleM, x, ph + 0.05, fz, g);
        box(g, 0.45, 0.2, 0.45, graniteM, x, 0.1, fz);
        col(x - 0.25, x + 0.25, fz - 0.25, fz + 0.25);
        waves.push(flag(g, kind, x, fz, ph, i * 1.9));
      });

      return {
        group: g, height: H, body, patamar: LAND,
        // lugar do Prefeito: no patamar, ao lado da porta (à direita de quem olha)
        prefeito: { x: 1.3, z: FZ + 1.25 },
        door: { x: 0.1, z: FZ + 0.1 },
        trigger: { x: 0.1, z: stEnd + 0.9 },
        boxes,
        update(dt, t, near) { if (near) waves.forEach((w) => w(t)); },
      };
    },
  };
})();
