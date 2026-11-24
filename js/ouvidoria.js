/* ============================================================
 * ouvidoria.js — Prédio 3: a Ouvidoria Geral do Jaboatão dos Guararapes,
 * modelada a partir da foto da fachada (ferramentas/ouvidoria/foto-ouvidoria.jpg):
 *  - prédio térreo de paredes brancas, com a platibanda azul por cima;
 *  - letreiro luminoso "OUVIDORIA GERAL" com o logo da Prefeitura e a faixa
 *    de formas coloridas no canto (desenhado em canvas, com o logo oficial);
 *  - luminária fluorescente sob a platibanda;
 *  - porta de vidro com o cartaz "Ouvidoria — Queremos ouvir você!"
 *    (recortado da própria foto: assets/texturas/ouvidoria-porta.jpg);
 *  - grade de ferro aberta ao lado da porta, tapete preto, canteiros com
 *    espadas-de-são-jorge, meio-fio azul e a escadaria de concreto gasto.
 * A pessoa e a escada de alumínio da foto foram deixadas de fora.
 * Medidas: a foto foi convertida em metros (porta ≈ 0,9 m × 2,1 m) e tudo
 * ampliado 1,8× para combinar com a escala dos outros prédios do jogo.
 * ============================================================ */
(function () {
  "use strict";
  const CT = (window.CT = window.CT || {});
  const U = CT.U;

  const Wd = 16, D = 12;           // largura e profundidade do prédio
  const FZ = D / 2;                // plano da fachada
  const HW = 4.86;                 // altura da parede branca (até a platibanda)
  const HF = 1.55;                 // altura da platibanda azul
  const LAND = 0.54;               // altura do patamar (3 degraus de 0,18)
  const LZ = FZ + 1.9;             // fim do patamar
  const TREAD = 0.42;

  function box(g, w, h, d, mat, x, y, z, shadow) { return U.mesh(U.box(w, h, d), mat, x, y, z, g, shadow); }
  function tube(g, p1, p2, r, mat) {
    const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2);
    const m = new THREE.Mesh(U.geo("ouv-tubo-" + r, () => new THREE.CylinderGeometry(r, r, 1, 8)), mat);
    m.position.copy(a).lerp(b, 0.5);
    m.scale.y = a.distanceTo(b);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; g.add(m); return m;
  }
  // ruído simples para as texturas
  function speckle(ctx, w, h, n, colors, rMin, rMax, alpha) {
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
      ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
      const r = rMin + Math.random() * (rMax - rMin);
      ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, r, r * (0.5 + Math.random()), Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* parede branca pintada: leve encardido, escorridos e sujeira perto do chão */
  function wallTex() {
    return U.canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#F8F8F5"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 700, ["#ECECE8", "#FFFFFF", "#E6E6E1"], 1, 5, 0.3);
      for (let i = 0; i < 26; i++) {               // escorridos da chuva
        const x = Math.random() * w, l = 40 + Math.random() * 200, y = Math.random() * h * 0.6;
        const gr = ctx.createLinearGradient(0, y, 0, y + l);
        gr.addColorStop(0, "rgba(150,150,140,0)"); gr.addColorStop(0.4, "rgba(150,150,140,0.10)"); gr.addColorStop(1, "rgba(150,150,140,0)");
        ctx.fillStyle = gr; ctx.fillRect(x, y, 2 + Math.random() * 4, l);
      }
      const g2 = ctx.createLinearGradient(0, h * 0.78, 0, h);  // barra suja junto ao chão
      g2.addColorStop(0, "rgba(120,125,110,0)"); g2.addColorStop(1, "rgba(105,110,95,0.35)");
      ctx.fillStyle = g2; ctx.fillRect(0, h * 0.78, w, h * 0.22);
      speckle(ctx, w, h * 0.12, 160, ["#8C9182", "#A3A897"], 1, 4, 0.25);
    }, true);
  }
  /* concreto gasto da escadaria, com manchas escuras de mofo */
  function concreteTex() {
    return U.canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#B9BAB2"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 1400, ["#A9AAA2", "#C8C9C1", "#9C9D95"], 1, 5, 0.6);
      speckle(ctx, w, h, 45, ["#7A7D74", "#8A8D83", "#6B6E66"], 5, 22, 0.28);
      speckle(ctx, w, h, 220, ["#5A5D55"], 1, 2.5, 0.35);
    }, true);
  }
  /* cascalho escuro dos canteiros */
  function gravelTex() {
    return U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#4A4744"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 1600, ["#5F5B57", "#3A3836", "#77726C", "#2E2C2A"], 1, 3.2, 0.9);
    }, true);
  }

  /* Letreiro luminoso: fundo branco, logo da Prefeitura (coração em cima,
   * nome embaixo), filete verde, "OUVIDORIA GERAL" e as formas coloridas. */
  function signTex() {
    const W = 1600, H = 800;
    const tex = U.canvasTex(W, H, () => {});
    const cv = tex.image, ctx = cv.getContext("2d");
    const draw = (logo) => {
      const gr = ctx.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, "#F7F8F9"); gr.addColorStop(0.55, "#EEF1F3"); gr.addColorStop(1, "#E6EAEE");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // canto verde no alto, à esquerda (como no letreiro da foto)
      ctx.fillStyle = "#6BB24A"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(46, 0); ctx.lineTo(0, 46); ctx.fill();
      // logo: coração centralizado sobre o nome
      if (logo) {
        const W0 = logo.naturalWidth, H0 = logo.naturalHeight, hw = 146 * W0 / 434;
        const hs = 330 / H0;                                   // coração com ~330 px de altura
        const cx = 330;
        ctx.drawImage(logo, 0, 0, hw, H0, cx - hw * hs / 2, 120, hw * hs, H0 * hs);
        const tw = W0 - hw, ts = 470 / tw;                     // nome com ~470 px de largura
        ctx.drawImage(logo, hw, 0, tw, H0, cx - 235, 470, tw * ts, H0 * ts);
      }
      // filete verde vertical
      ctx.fillStyle = "#7DB443"; ctx.fillRect(665, 160, 8, 460);
      // OUVIDORIA / GERAL
      ctx.fillStyle = "#3D3A8E"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      let fs = 150; ctx.font = "800 " + fs + "px " + U.FONT_DISPLAY;
      while (ctx.measureText("OUVIDORIA").width > 760 && fs > 60) { fs -= 4; ctx.font = "800 " + fs + "px " + U.FONT_DISPLAY; }
      ctx.fillText("OUVIDORIA", 760, 345); ctx.fillText("GERAL", 760, 345 + fs * 1.02);
      // faixa de formas coloridas (canto de baixo, à direita)
      const T = 150, y = H - 40 - T; let x = W - 40 - T * 5;
      const Y = "#F2C230", G = "#6CB548", P = "#6B3FA0", Wt = "#F4F4EE";
      // 1: meia-lua amarela
      ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(x + T, y); ctx.lineTo(x + T * 0.5, y); ctx.arc(x + T * 0.5, y + T * 0.5, T * 0.5, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(x + T, y + T); ctx.fill();
      x += T;
      // 2: quadrado verde com sol amarelo
      ctx.fillStyle = G; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = Y; ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? T * 0.22 : T * 0.4; ctx.lineTo(x + T / 2 + Math.cos(a) * r, y + T / 2 + Math.sin(a) * r); }
      ctx.fill(); x += T;
      // 3: meia-lua roxa sobre branco
      ctx.fillStyle = Wt; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(x + T * 0.55, y); ctx.arc(x + T * 0.55, y + T / 2, T / 2, -Math.PI / 2, Math.PI / 2, true); ctx.fill();
      x += T;
      // 4: asterisco amarelo sobre branco
      ctx.fillStyle = Wt; ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = Y; ctx.lineWidth = T * 0.13; ctx.lineCap = "butt";
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + T / 2 - Math.cos(a) * T * 0.48, y + T / 2 - Math.sin(a) * T * 0.48); ctx.lineTo(x + T / 2 + Math.cos(a) * T * 0.48, y + T / 2 + Math.sin(a) * T * 0.48); ctx.stroke(); }
      x += T;
      // 5: verde com seta roxa
      ctx.fillStyle = G; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = P; ctx.beginPath(); ctx.moveTo(x + T, y + T); ctx.lineTo(x + T * 0.28, y + T); ctx.lineTo(x + T, y + T * 0.28); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + T * 0.12, y + T * 0.12); ctx.lineTo(x + T * 0.55, y + T * 0.12); ctx.lineTo(x + T * 0.12, y + T * 0.55); ctx.fill();
      tex.needsUpdate = true;
    };
    let logo = null;
    draw(null);
    const item = (CT.CONFIG.logosApoio || []).find((l) => l.id === "prefeitura-jaboatao");
    if (item) {
      const im = new Image();
      im.onload = () => { logo = im; draw(im); };
      im.src = (window.CT_LOGOS_EMBUTIDOS || {})[item.arquivo] || item.arquivo;
    }
    // a fonte do jogo pode chegar depois: redesenha quando estiver pronta
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(logo));
    return tex;
  }

  /* cartaz da porta: recorte da foto (embutido em assets/texturas/js/texturas.js) */
  function doorTex() {
    const src = "assets/texturas/ouvidoria-porta.jpg";
    const emb = window.CT_TEXTURAS_EMBUTIDAS || {};
    const tex = new THREE.Texture();
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const im = new Image();
    im.onload = () => { tex.image = im; tex.needsUpdate = true; };
    im.src = emb[src] || src;
    return tex;
  }

  /* folha de espada-de-são-jorge: lâmina estreita e pontuda, um pouco arqueada */
  function leafGeo() {
    return U.geo("ouv-folha", () => {
      const seg = 8, pos = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg, w = 0.075 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.12)) * (1 - t * 0.55);
        const z = 0.18 * t * t;            // arqueia para a frente
        pos.push(-w, t, z, w, t, z);
        if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      pos.push(0, 1.04, 0.2);               // ponta
      const tip = (seg + 1) * 2; idx.push(seg * 2, seg * 2 + 1, tip);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    });
  }

  CT.Ouvidoria = {
    largura: Wd, profundidade: D,
    build({ atm, def }) {
      const g = new THREE.Group();
      const boxes = [];
      const col = (x0, x1, z0, z1) => boxes.push([x0, x1, z0, z1]);

      const wallM = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.92 });
      wallM.map.repeat.set(1, 1);
      const blueM = U.mat("#1C4CB0", { roughness: 0.6 });
      const blueDM = U.mat("#1B3F86", { roughness: 0.65 });
      const navyM = U.mat("#131A2C", { roughness: 0.5 });
      const roofM = U.mat("#9EA19C", { roughness: 0.95 });
      const conc = concreteTex(); const concM = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95 });
      const alumM = U.mat("#A5ABB1", { metalness: 0.65, roughness: 0.35 });
      const gateM = U.mat("#C9CCCB", { metalness: 0.35, roughness: 0.5 });

      /* ---- corpo: paredes brancas (UV em metros), laje e platibanda azul ---- */
      const body = new THREE.Mesh(U.boxWorldUV(Wd, HW, D, 5, HW), [wallM, wallM, roofM, roofM, wallM, wallM]);
      body.position.y = HW / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      // platibanda: frente com um pequeno beiral, laterais e fundo
      const OV = 0.28;
      box(g, Wd + 0.3, HF, 0.5 + OV, blueM, 0, HW + HF / 2, FZ - 0.25 + OV / 2);
      box(g, Wd + 0.36, 0.08, 0.6 + OV, navyM, 0, HW + HF + 0.04, FZ - 0.25 + OV / 2);     // rufo escuro no topo
      box(g, Wd + 0.3, 0.06, OV + 0.02, blueDM, 0, HW + 0.03, FZ + OV / 2, false);           // face de baixo do beiral
      [-1, 1].forEach((s) => box(g, 0.3, HF, D, blueM, s * (Wd / 2), HW + HF / 2, 0));
      box(g, Wd + 0.3, HF, 0.3, blueM, 0, HW + HF / 2, -D / 2);
      box(g, Wd - 0.2, 0.1, D - 0.4, roofM, 0, HW + 0.05, 0);
      // barrado azul na base da parede, à esquerda (aparece atrás do canteiro na foto)
      box(g, 4.2, 0.36, 0.04, blueM, -Wd / 2 + 2.1, LAND + 0.18, FZ + 0.02, false);

      /* ---- letreiro luminoso "OUVIDORIA GERAL" ---- */
      const sW = 3.95, sH = 1.97, sX = 0.16, sY = 5.1 + sH / 2, sZ = FZ + OV + 0.16;
      box(g, sW + 0.08, sH + 0.08, 0.28, navyM, sX, sY, sZ - 0.02);
      const sTex = signTex();
      const sM = new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false });
      sM.color.setScalar(0.94);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), sM);
      sign.position.set(sX, sY, sZ + 0.125); g.add(sign);
      // suportes do letreiro no telhado
      [-1.4, 1.4].forEach((x) => box(g, 0.08, 1.1, 0.08, navyM, sX + x, HW + HF + 0.3, FZ - 0.05));

      /* ---- luminária fluorescente sob a platibanda ---- */
      box(g, 2.3, 0.1, 0.16, U.mat("#ECEDEA"), 0.02, HW - 0.12, FZ + 0.09);
      const tubeM = new THREE.MeshStandardMaterial({ color: "#F4F7FF", emissive: "#F4F8FF", emissiveIntensity: 0.15, roughness: 0.3 });
      atm.windowMat(tubeM);
      const lt = U.mesh(U.cyl(0.03, 0.03, 2.15, 8), tubeM, 0.02, HW - 0.19, FZ + 0.1, g, false); lt.rotation.z = Math.PI / 2;

      /* ---- porta de vidro com o cartaz ---- */
      const dW = 1.6, dH = 3.78, dY = LAND;
      const fr = 0.07;
      box(g, dW + fr * 2, fr, 0.12, alumM, 0, dY + dH + fr / 2, FZ + 0.05);
      [-1, 1].forEach((s) => box(g, fr, dH + fr, 0.12, alumM, s * (dW / 2 + fr / 2), dY + (dH + fr) / 2, FZ + 0.05));
      box(g, dW, 0.05, 0.1, alumM, 0, dY + 0.03, FZ + 0.05);
      const pM = new THREE.MeshStandardMaterial({ map: doorTex(), roughness: 0.22, metalness: 0.05 });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(dW, dH), pM);
      poster.position.set(0, dY + dH / 2, FZ + 0.06); g.add(poster);
      // caixilho interno (perfil fino em volta do vidro)
      box(g, dW, 0.04, 0.03, alumM, 0, dY + dH - 0.02, FZ + 0.08, false);
      // maçaneta / fechadura
      box(g, 0.05, 0.16, 0.05, alumM, -dW / 2 + 0.1, dY + 1.76, FZ + 0.1, false);

      /* ---- grade de ferro aberta, encostada na parede à esquerda da porta ---- */
      const gx0 = -2.68, gx1 = -0.92, gy0 = LAND + 0.02, gy1 = LAND + 3.92, gz = FZ + 0.13;
      tube(g, [gx0, gy0, gz], [gx0, gy1, gz], 0.03, gateM);
      tube(g, [gx1, gy0, gz], [gx1, gy1, gz], 0.03, gateM);
      [gy0 + 0.02, gy0 + 1.0, gy0 + 2.05, gy1 - 0.02].forEach((y) => tube(g, [gx0, y, gz], [gx1, y, gz], 0.022, gateM));
      for (let i = 1; i < 10; i++) { const x = gx0 + (gx1 - gx0) * i / 10; tube(g, [x, gy0, gz], [x, gy1, gz], 0.013, gateM); }
      // dobradiças e o ferrolho
      [gy0 + 0.6, gy1 - 0.6].forEach((y) => box(g, 0.16, 0.1, 0.1, gateM, gx0 - 0.08, y, gz - 0.04, false));
      box(g, 0.28, 0.06, 0.06, gateM, gx1 - 1.45, gy0 + 2.2, gz + 0.02, false);
      box(g, 0.1, 0.12, 0.1, gateM, gx0 + 0.02, gy0 + 1.15, gz, false);

      /* ---- patamar, tapete e escadaria de concreto ---- */
      const land = new THREE.Mesh(U.boxWorldUV(Wd, LAND, LZ - FZ, 2.5, 2.5), concM);
      land.position.set(0, LAND / 2, (FZ + LZ) / 2); land.receiveShadow = true; g.add(land);
      for (let i = 0; i < 3; i++) {
        const h = LAND - (i + 1) * 0.18, z0 = LZ + i * TREAD;
        if (h <= 0) break;
        const st = new THREE.Mesh(U.boxWorldUV(Wd, h, TREAD, 2.5, 2.5), concM);
        st.position.set(0, h / 2, z0 + TREAD / 2); st.receiveShadow = st.castShadow = true; g.add(st);
        // quina gasta (frisinho mais claro)
        box(g, Wd, 0.02, 0.04, U.mat("#C9CAC2"), 0, h - 0.01, z0 + TREAD - 0.02, false);
      }
      const lastStep = LZ + 2 * TREAD + TREAD;
      // tapete preto em frente à porta
      box(g, 2.9, 0.025, 1.45, U.mat("#1D1F22", { roughness: 1 }), -0.05, LAND + 0.013, FZ + 0.85, false);
      // pedaços de tijolo soltos (como na foto)
      box(g, 0.32, 0.14, 0.2, U.mat("#9B8B78"), 2.4, LAND - 0.18 * 2 + 0.07, LZ + TREAD + 0.12, true).rotation.y = 0.4;
      box(g, 0.3, 0.12, 0.18, U.mat("#A3836A"), -6.6, LAND - 0.18 + 0.06, LZ + 0.2, true).rotation.y = -0.3;

      /* ---- canteiros com espadas-de-são-jorge ---- */
      const gravM = new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: 1 });
      gravM.map.repeat.set(3, 1);
      const beds = [[-Wd / 2 + 0.1, -2.75], [0.95, Wd / 2 - 0.1]];
      beds.forEach(([x0, x1]) => {
        const w = x1 - x0;
        box(g, w, 0.08, 0.95, gravM, (x0 + x1) / 2, LAND + 0.04, FZ + 0.5, false);
        box(g, w, 0.2, 0.08, x0 < 0 ? blueM : concM, (x0 + x1) / 2, LAND + 0.1, FZ + 1.0, true);   // meio-fio (azul à esquerda)
      });
      const leaf = leafGeo();
      const leafM = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.55, side: THREE.DoubleSide });
      const clumps = [];
      for (let x = -Wd / 2 + 0.45; x < -2.9; x += 0.55 + Math.random() * 0.25) clumps.push(x);
      for (let x = 1.25; x < Wd / 2 - 0.4; x += 0.55 + Math.random() * 0.25) clumps.push(x);
      const perClump = 17, n = clumps.length * perClump;
      const inst = new THREE.InstancedMesh(leaf, leafM, n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
      const cA = new THREE.Color("#2F6A2B"), cB = new THREE.Color("#5E9440"), cC = new THREE.Color("#8DA85A"), cc = new THREE.Color();
      let k = 0;
      clumps.forEach((cx) => {
        const cz = FZ + 0.45 + (Math.random() - 0.5) * 0.25;
        for (let i = 0; i < perClump; i++) {
          const yaw = Math.random() * Math.PI * 2, tilt = 0.08 + Math.random() * 0.42;
          e.set(0, yaw, 0); q.setFromEuler(e);
          const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
          q.multiply(qt);
          const hgt = 1.2 + Math.random() * 1.2;
          s3.set(1.1 + Math.random() * 0.6, hgt, hgt * 0.9);
          p3.set(cx + (Math.random() - 0.5) * 0.18, LAND + 0.06, cz + (Math.random() - 0.5) * 0.15);
          m4.compose(p3, q, s3); inst.setMatrixAt(k, m4);
          cc.copy(cA).lerp(Math.random() < 0.3 ? cC : cB, Math.random() * 0.8); inst.setColorAt(k, cc);
          k++;
        }
      });
      inst.castShadow = true; inst.receiveShadow = true; g.add(inst);

      /* ---- placa com o número da etapa (como nos outros prédios) ---- */
      const plM = new THREE.MeshBasicMaterial({ map: U.signTex(def.nome || "Ouvidoria", { bg: "#2556B2", fg: "#FFFFFF", badge: String(Math.max(1, (CT.PREDIOS || []).indexOf(def) + 1)), font: 104, border: "#FFFFFF" }), transparent: true });
      const px = 5.2, pz = lastStep + 1.4;
      [-1.55, 1.55].forEach((o) => box(g, 0.12, 1.5, 0.12, navyM, px + o, 0.75, pz));
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), plM); plate.position.set(px, 1.15, pz + 0.04); g.add(plate);
      const plate2 = plate.clone(); plate2.rotation.y = Math.PI; plate2.position.z = pz - 0.04; g.add(plate2);
      box(g, 3.62, 0.92, 0.06, navyM, px, 1.15, pz);
      col(px - 1.8, px + 1.8, pz - 0.2, pz + 0.2);

      // colisões: prédio, patamar e degraus
      col(-Wd / 2, Wd / 2, -D / 2, FZ + 0.3);
      col(-Wd / 2, Wd / 2, FZ, lastStep);

      return {
        group: g, height: sY + sH / 2, body, patamar: LAND,
        door: { x: 0, z: FZ + 0.1 },
        trigger: { x: 0, z: lastStep + 0.75 },
        boxes,
        update() {},
      };
    },
  };
})();
