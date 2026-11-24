/* =====================================================================
 * CASA DE FESTAS — área secreta (sem missão, sem anel e sem seta).
 * Uma das lojas da cidade é a "Casa de Festas"; quem chega à porta e
 * aperta ESPAÇO entra num salão de festa com pista de dança iluminada,
 * globo espelhado, bandeirinhas, balões, mesa com bolo, caixas de som,
 * confete caindo e... uma pessoa fantasiada de tiranossauro rex (fantasia
 * inflável laranja com listras marrons nas costas) dançando sem parar.
 * Ao entrar toca uma música animada (CT.CONFIG.musicas.festa).
 * Sala no mesmo padrão dos prédios: X de -11 a 11, Z de -9 (fundo) a 9 (entrada).
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U;
  const RW = 11, RD = 9, WH = 7;
  const BPM = 120, BEAT = 60 / BPM;           // andamento da música da festa
  const CORES = ["#FF4FA3", "#FFC83D", "#3DDC84", "#4FC3FF", "#B48CFF", "#FF7A45"];

  /* ------------------------------------------------------------------
   * Fantasia inflável de tiranossauro: corpo, cabeça, braços curtinhos,
   * cauda, pernas infladas e os tênis de quem está dentro.
   * As listras marrons são "cascas" da própria esfera (mesma curvatura).
   * ---------------------------------------------------------------- */
  function createDino() {
    const root = new THREE.Group();
    const LAR = U.mat("#D9480A", { roughness: 0.38 });
    const BAR = U.mat("#F0873A", { roughness: 0.42 });
    const LIS = U.mat("#4E2610", { roughness: 0.5 });
    const BRA = U.mat("#FFFFFF", { roughness: 0.3 });
    const PRE = U.mat("#141414", { roughness: 0.3 });
    const BOCA = U.mat("#7A1F2B", { roughness: 0.6 });

    // elipsoide (esfera com o polo no eixo Y, ou no eixo Z se 'deitada')
    function elip(parent, r, sx, sy, sz, mat, x, y, z, deitada) {
      const g = U.geo("dino-esf-" + (deitada ? "z" : "y"), () => { const s = new THREE.SphereGeometry(1, 32, 22); if (deitada) s.rotateX(Math.PI / 2); return s; });
      const m = new THREE.Mesh(g, mat); m.scale.set(sx * r, sy * r, sz * r); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    }
    // listras: faixas da mesma esfera, um tiquinho maiores, só do lado de trás/de cima
    function listras(base, deitada, faixas, larg) {
      faixas.forEach(([t0, t1]) => {
        const g = new THREE.SphereGeometry(1.012, 20, 4, 1.5 * Math.PI - larg, larg * 2, t0, t1 - t0);
        if (deitada) g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, LIS); m.scale.copy(base.scale); m.position.copy(base.position); m.rotation.copy(base.rotation);
        base.parent.add(m);
      });
    }

    // pernas: coxa inflada + canela até o tornozelo, e os tênis
    const legs = [];
    [-1, 1].forEach((s) => {
      const hip = new THREE.Group(); hip.position.set(s * 0.26, 0.98, 0); root.add(hip);
      elip(hip, 0.27, 1, 1.15, 1.05, LAR, 0, -0.12, 0.02);
      const knee = new THREE.Group(); knee.position.set(0, -0.42, 0.05); hip.add(knee);
      const shin = new THREE.Mesh(U.geo("dino-canela", () => new THREE.CylinderGeometry(0.15, 0.12, 0.46, 18)), LAR);
      shin.position.y = -0.2; shin.castShadow = true; knee.add(shin);
      const shoe = new THREE.Group(); shoe.position.set(0, -0.48, 0.04); knee.add(shoe);
      U.mesh(U.box(0.17, 0.09, 0.3), U.mat("#2F6FD8"), 0, 0.02, 0.03, shoe);
      U.mesh(U.box(0.18, 0.035, 0.32), BRA, 0, -0.02, 0.03, shoe);
      legs.push({ hip, knee, s });
    });

    // corpo (pulsa e balança no ritmo); a barriga é mais clara
    const torso = new THREE.Group(); torso.position.y = 0.95; root.add(torso);
    const body = elip(torso, 0.62, 0.95, 1.05, 0.92, LAR, 0, 0.55, 0);
    elip(torso, 0.48, 0.78, 1.0, 0.5, BAR, 0, 0.6, 0.36);
    listras(body, false, [[0.55, 0.68], [0.85, 0.98], [1.15, 1.28], [1.45, 1.58], [1.75, 1.88], [2.05, 2.16]], 0.75);

    // pescoço e cabeça (balança a cabeça e abre a boca na batida)
    const neck = new THREE.Group(); neck.position.set(0, 1.12, 0.05); torso.add(neck);
    const nk = elip(neck, 0.32, 0.95, 1.25, 0.95, LAR, 0, 0.2, 0.06);
    listras(nk, false, [[0.7, 0.86], [1.05, 1.2]], 0.8);
    const head = new THREE.Group(); head.position.set(0, 0.52, 0.12); neck.add(head);
    const skull = elip(head, 0.34, 0.95, 0.82, 1.5, LAR, 0, 0.06, 0.18, true);
    listras(skull, true, [[0.95, 1.1], [1.3, 1.45], [1.65, 1.8], [2.0, 2.12]], 0.7);
    // focinho e narinas
    elip(head, 0.2, 1.25, 0.8, 1.0, LAR, 0, 0.0, 0.62);
    [-1, 1].forEach((s) => elip(head, 0.025, 1, 0.7, 1, PRE, s * 0.08, 0.1, 0.81));
    // olhos grandes e simpáticos
    [-1, 1].forEach((s) => {
      elip(head, 0.11, 1, 1, 0.8, BRA, s * 0.22, 0.2, 0.32);
      elip(head, 0.055, 1, 1, 0.6, PRE, s * 0.25, 0.21, 0.39);
      elip(head, 0.018, 1, 1, 0.6, BRA, s * 0.265, 0.235, 0.425);
      const sob = U.mesh(U.box(0.16, 0.035, 0.05), LIS, s * 0.21, 0.33, 0.3, head); sob.rotation.z = -s * 0.25;
    });
    // mandíbula com a boca (interior e dentes)
    const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.12); head.add(jaw);
    elip(jaw, 0.27, 0.95, 0.42, 1.55, LAR, 0, -0.06, 0.24, true);
    elip(jaw, 0.24, 0.85, 0.2, 1.45, BOCA, 0, -0.01, 0.26, true);
    const dente = U.geo("dino-dente", () => new THREE.ConeGeometry(0.022, 0.06, 6));
    for (let i = 0; i < 7; i++) {
      const a = -0.95 + i * (1.9 / 6), px = Math.sin(a) * 0.19, pz = 0.3 + Math.cos(a) * 0.26;
      const t = new THREE.Mesh(dente, BRA); t.position.set(px, 0.02, pz); jaw.add(t);
      const t2 = new THREE.Mesh(dente, BRA); t2.position.set(px * 1.05, -0.06, pz + 0.02); t2.rotation.x = Math.PI; head.add(t2);
    }

    // bracinhos curtos com três garrinhas
    const arms = [];
    [-1, 1].forEach((s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.36, 0.9, 0.36); torso.add(sh);
      elip(sh, 0.09, 1, 1, 1.5, LAR, 0, 0, 0.08, true);
      const fo = new THREE.Group(); fo.position.set(0, 0, 0.2); sh.add(fo);
      elip(fo, 0.07, 1, 1, 1.4, LAR, 0, -0.04, 0.05, true);
      for (let c = -1; c <= 1; c++) { const k = new THREE.Mesh(dente, BRA); k.position.set(c * 0.03, -0.06, 0.13); k.rotation.x = Math.PI / 2; fo.add(k); }
      arms.push({ sh, fo, s });
    });

    // cauda: segmentos que afinam e encostam no chão
    const tail = [];
    let parent = torso, len = 0.0;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group(); seg.position.set(0, i === 0 ? 0.15 : -0.04, i === 0 ? -0.42 : -len * 0.82); parent.add(seg);
      const r = 0.3 * Math.pow(0.8, i); len = r * 1.9;
      const m = elip(seg, r, 1, 0.92, 1.9, LAR, 0, 0, -len * 0.45, true);
      listras(m, true, [[1.7, 1.95], [2.25, 2.5]], 0.8);
      seg.rotation.x = i === 0 ? -0.3 : 0.05;   // a cauda desce e segue rente ao chão
      tail.push(seg); parent = seg;
    }

    /* dança: pula, balança, rebola a cauda, bate os bracinhos e de vez em
     * quando dá uma voltinha completa */
    let t = 0;
    const ch = { root, mode: "dance", tempo: () => t };
    ch.update = function (dt) {
      t += dt;
      const b = t / BEAT, ph = b * Math.PI;                     // fase em batidas
      const bounce = Math.abs(Math.sin(ph));
      root.position.y = bounce * 0.11;
      const sq = 1 - 0.06 * (1 - bounce);
      torso.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      torso.rotation.z = Math.sin(ph) * 0.14;
      torso.rotation.x = 0.05 + 0.05 * Math.sin(ph * 2);
      // a cada 8 batidas, uma voltinha de 2 batidas
      const ciclo = b % 16;
      const giro = ciclo > 14 ? U.easeInOut((ciclo - 14) / 2) * Math.PI * 2 : 0;
      root.rotation.y = Math.sin(ph / 4) * 0.45 + giro;
      neck.rotation.x = 0.12 + Math.sin(ph * 2) * 0.1;
      head.rotation.x = 0.16 + Math.sin(ph * 2 + 0.6) * 0.15;
      head.rotation.z = Math.sin(ph) * 0.12;
      jaw.rotation.x = 0.08 + Math.max(0, Math.sin(ph * 2)) * 0.26;
      arms.forEach(({ sh, fo, s }) => {
        sh.rotation.x = -0.5 + Math.sin(ph * 4 + (s > 0 ? 0 : Math.PI)) * 0.55;
        sh.rotation.z = s * (0.25 + 0.15 * Math.sin(ph * 2));
        fo.rotation.x = -0.6 + Math.sin(ph * 4 + 1 + (s > 0 ? 0 : Math.PI)) * 0.4;
      });
      tail.forEach((seg, i) => { seg.rotation.y = Math.sin(ph - i * 0.55) * (0.22 + i * 0.04); });
      // passinhos: uma perna de cada vez
      legs.forEach(({ hip, knee, s }) => {
        const lift = Math.max(0, Math.sin(ph + (s > 0 ? 0 : Math.PI)));
        hip.rotation.x = -lift * 0.55; knee.rotation.x = lift * 0.9;
        hip.position.y = 0.98 - root.position.y * (1 - lift);
        hip.rotation.z = s * 0.05;
      });
    };
    return ch;
  }

  /* ------------------------------------------------------------------
   * O salão de festas
   * ---------------------------------------------------------------- */
  function buildRoom() {
    const group = new THREE.Group();
    const col = new U.Colliders();
    const anim = [];

    /* piso: madeira clara + pista de dança com ladrilhos que acendem */
    const floorTex = U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#C99E6A"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#C09260" : "#CFA674"; ctx.fillRect(0, i * 32, w, 31); ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(((i * 97) % 256), i * 32, 2, 31); }
    }, true);
    floorTex.repeat.set(5.5, 4.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), U.mat("#2A1838"));
    outside.rotation.x = -Math.PI / 2; outside.position.set(0, -0.02, RD + 15); group.add(outside);
    const exitMat = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshBasicMaterial({ map: U.signTex("SAÍDA", { w: 512, h: 200, bg: "#2B2F3A", fg: "#FFC83D", font: 90, radius: 20 }) }));
    exitMat.rotation.x = -Math.PI / 2; exitMat.position.set(0, 0.02, RD - 2.1); group.add(exitMat);

    const N = 7, TS = 1.25, PZ = -2.2;           // pista 7×7, centrada em z = -2,2
    const tiles = [];
    const tileG = new THREE.BoxGeometry(TS - 0.06, 0.05, TS - 0.06);
    U.mesh(U.box(N * TS + 0.3, 0.04, N * TS + 0.3), U.mat("#1C1426"), 0, 0.02, PZ, group, false);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const m = new THREE.MeshStandardMaterial({ color: "#222", emissive: "#000", roughness: 0.25, metalness: 0.1 });
      const tl = new THREE.Mesh(tileG, m); tl.position.set((i - (N - 1) / 2) * TS, 0.045, PZ + (j - (N - 1) / 2) * TS); tl.receiveShadow = true; group.add(tl);
      tiles.push({ m, i, j, c: new THREE.Color(CORES[(i + j) % CORES.length]) });
    }
    let lastStep = -1;
    anim.push((dt, t) => {
      const step = Math.floor(t / BEAT);
      if (step !== lastStep) {
        lastStep = step;
        tiles.forEach((tl, k) => {
          const on = ((tl.i * 3 + tl.j * 5 + step) % 4) === 0 || ((tl.i + tl.j + step) % 6 === 0);
          tl.c.set(CORES[(tl.i * 2 + tl.j + step) % CORES.length]);
          tl.on = on;
        });
      }
      const f = 1 - ((t / BEAT) % 1);             // brilho cai ao longo da batida
      tiles.forEach((tl) => {
        tl.m.color.copy(tl.c).multiplyScalar(tl.on ? 0.5 : 0.08);
        tl.m.emissive.copy(tl.c).multiplyScalar(tl.on ? 0.55 + 0.6 * f : 0.03);
      });
    });

    /* paredes com confetes pintados */
    const wallTex = U.canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = "#F4C6DE"; ctx.fillRect(0, 0, w, h);
      const r = U.rng(7);
      for (let i = 0; i < 140; i++) { ctx.fillStyle = CORES[i % CORES.length]; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }, true);
    wallTex.repeat.set(4, 1.3);
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const band = U.mat("#8E3FD1");
    U.mesh(U.box(RW * 2 + 0.8, WH, 0.4), wallM, 0, WH / 2, -RD - 0.2, group);
    [-1, 1].forEach((s) => {
      U.mesh(U.box(0.4, WH, RD * 2), wallM, s * (RW + 0.2), WH / 2, 0, group);
      U.mesh(U.box(0.1, 1.1, RD * 2), band, s * (RW - 0.02), 0.55, 0, group);
      U.mesh(U.box(0.6, WH, 0.6), U.mat("#5E2A8C"), s * (RW + 0.1), WH / 2, RD - 0.2, group);
    });
    U.mesh(U.box(RW * 2, 1.1, 0.1), band, 0, 0.55, -RD + 0.02, group);
    /* parede da entrada, com a porta dupla por onde se sai */
    const DW = 3.0, DH = 3.6;                                   // vão da porta
    const lado = (RW * 2 + 0.8 - DW) / 2;
    [-1, 1].forEach((s) => {
      U.mesh(U.box(lado, WH, 0.4), wallM, s * (DW / 2 + lado / 2), WH / 2, RD + 0.2, group);
      U.mesh(U.box(lado, 1.1, 0.1), band, s * (DW / 2 + lado / 2), 0.55, RD - 0.02, group);
    });
    U.mesh(U.box(DW, WH - DH, 0.4), wallM, 0, DH + (WH - DH) / 2, RD + 0.2, group);
    const portaM = U.mat("#8E3FD1", { roughness: 0.5 }), vidroM = new THREE.MeshStandardMaterial({ color: "#BFE6FF", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 });
    const ouro = U.mat("#F2C230", { metalness: 0.6, roughness: 0.3 });
    U.mesh(U.box(DW + 0.4, 0.2, 0.5), ouro, 0, DH + 0.1, RD + 0.15, group);               // batente
    [-1, 1].forEach((s) => {
      U.mesh(U.box(0.2, DH, 0.5), ouro, s * (DW / 2 + 0.1), DH / 2, RD + 0.15, group);
      const folha = new THREE.Group(); folha.position.set(s * DW / 4, 0, RD + 0.12); group.add(folha);
      U.mesh(U.box(DW / 2 - 0.04, DH - 0.04, 0.1), portaM, 0, DH / 2, 0, folha);
      const vid = new THREE.Mesh(new THREE.PlaneGeometry(DW / 2 - 0.5, 1.6), vidroM); vid.position.set(0, 2.3, -0.056); vid.rotation.y = Math.PI; folha.add(vid);
      U.mesh(U.box(0.06, 0.6, 0.08), ouro, -s * (DW / 4 - 0.22), 1.25, -0.08, folha);  // puxador
      // estrelinha na porta
      U.mesh(U.sph(0.12, 8, 6), U.mat(CORES[s > 0 ? 1 : 0], { emissive: CORES[s > 0 ? 1 : 0], emissiveIntensity: 0.4 }), 0, 1.0, -0.07, folha, false);
    });
    // placa luminosa de SAÍDA acima da porta
    const saida = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), new THREE.MeshBasicMaterial({ map: U.signTex("SAÍDA", { w: 512, h: 150, bg: "#1E9E4A", fg: "#FFFFFF", font: 96, radius: 16 }) }));
    saida.position.set(0, DH + 0.6, RD - 0.02); saida.rotation.y = Math.PI; group.add(saida);
    // balões ao lado da porta
    [-1, 1].forEach((s) => { for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(U.geo("festa-balao-porta", () => { const g = new THREE.SphereGeometry(0.26, 14, 10); g.scale(1, 1.18, 1); return g; }), U.mat(CORES[(i + (s > 0 ? 2 : 0)) % CORES.length], { roughness: 0.25 })); b.position.set(s * (DW / 2 + 0.55 + (i % 2) * 0.35), DH - 0.3 + Math.floor(i / 2) * 0.5, RD - 0.3); group.add(b); } });
    // letreiro no fundo
    const name = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.8), new THREE.MeshBasicMaterial({ map: U.signTex("Casa de Festas", { w: 1024, h: 220, bg: "#E83E8C", fg: "#FFFFFF", font: 120, radius: 40 }), transparent: true }));
    name.position.set(0, 5.9, -RD + 0.03); group.add(name);
    // lâmpadas em volta do letreiro (piscam)
    const bulbs = [];
    for (let i = 0; i < 26; i++) {
      const a = i / 26, per = 2 * (8.8 + 2.2);
      let d = a * per, x, y;
      if (d < 8.8) { x = -4.4 + d; y = 7.0; } else if ((d -= 8.8) < 2.2) { x = 4.4; y = 7.0 - d; } else if ((d -= 2.2) < 8.8) { x = 4.4 - d; y = 4.8; } else { d -= 8.8; x = -4.4; y = 4.8 + d; }
      const m = new THREE.MeshStandardMaterial({ color: "#FFF4C8", emissive: "#FFE08A", emissiveIntensity: 1 });
      const bb = new THREE.Mesh(U.sph(0.09, 8, 6), m); bb.position.set(x, y, -RD + 0.1); group.add(bb); bulbs.push(m);
    }
    anim.push((dt, t) => { const k = Math.floor(t / (BEAT / 2)); bulbs.forEach((m, i) => { m.emissiveIntensity = (i + k) % 2 ? 1.4 : 0.15; }); });

    /* bandeirinhas cruzando o teto */
    const flagG = U.geo("festa-bandeira", () => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.45, 0], 3)); g.computeVertexNormals(); return g; });
    const flagMs = CORES.map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.7 }));
    const strings = [[[-RW, 6.4, -RD], [RW, 6.4, RD - 1]], [[RW, 6.4, -RD], [-RW, 6.4, RD - 1]], [[-RW, 6.0, -1], [RW, 6.0, -1]], [[-RW, 6.2, 4], [RW, 6.2, 4]]];
    const flagsAll = [];
    strings.forEach(([a, b], si) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), n = Math.round(A.distanceTo(B) / 0.6);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, p = A.clone().lerp(B, u); p.y -= Math.sin(u * Math.PI) * 1.1; pts.push(p);
        if (i > 0 && i < n) {
          const f = new THREE.Mesh(flagG, flagMs[(i + si) % flagMs.length]); f.position.copy(p);
          f.lookAt(p.x + (B.z - A.z), p.y, p.z - (B.x - A.x)); group.add(f); flagsAll.push({ f, ph: i * 0.7 + si });
        }
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#5A4A60" })); group.add(line);
    });
    anim.push((dt, t) => flagsAll.forEach((o) => { o.f.rotation.z = Math.sin(t * 2 + o.ph) * 0.08; }));

    /* globo espelhado girando + feixes de luz coloridos */
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), new THREE.MeshStandardMaterial({ color: "#E8EEF5", metalness: 0.95, roughness: 0.12, flatShading: true, emissive: "#30343C" }));
    ball.position.set(0, 5.6, PZ); group.add(ball);
    U.mesh(U.cyl(0.015, 0.015, 0.9, 4), U.mat("#666"), 0, 6.55, PZ, group, false);
    const spots = [];
    ["#FF4FA3", "#4FC3FF", "#FFC83D"].forEach((c, i) => {
      const s = new THREE.SpotLight(c, 1.6, 22, 0.32, 0.5, 1.2);
      s.position.set((i - 1) * 6, 6.6, PZ + 4); s.target.position.set(0, 0, PZ); group.add(s); group.add(s.target);
      spots.push({ s, ph: i * 2.1 });
      const can = U.mesh(U.cyl(0.18, 0.25, 0.5, 12), U.mat("#222"), (i - 1) * 6, 6.7, PZ + 4, group, false); can.rotation.x = 0.6;
    });
    const glow = new THREE.PointLight("#FF7AD0", 0.9, 14); glow.position.set(0, 3, PZ); group.add(glow);
    anim.push((dt, t) => {
      ball.rotation.y += dt * 0.8;
      spots.forEach(({ s, ph }) => s.target.position.set(Math.sin(t * 0.9 + ph) * 4, 0, PZ + Math.cos(t * 0.7 + ph) * 3.5));
      glow.color.set(CORES[Math.floor(t / BEAT) % CORES.length]);
    });

    /* balões: cachos nos cantos e alguns flutuando (sobem e descem) */
    const balloonG = U.geo("festa-balao", () => { const g = new THREE.SphereGeometry(0.32, 16, 12); g.scale(1, 1.18, 1); return g; });
    const floaters = [];
    function balao(x, y, z, c, bob, fio) {
      const m = new THREE.Mesh(balloonG, U.mat(c, { roughness: 0.25, metalness: 0.05 })); m.position.set(x, y, z); m.castShadow = true; group.add(m);
      if (fio) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y - 0.38, z), new THREE.Vector3(x + 0.05, fio, z)]), new THREE.LineBasicMaterial({ color: "#EEEEEE" })); group.add(l); }
      if (bob) floaters.push({ m, y0: y, ph: Math.random() * 6 });
    }
    [[-9.6, -7.6], [9.6, -7.6], [-9.6, 7.2], [9.6, 7.2]].forEach(([x, z], k) => {
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9, r = i ? 0.45 : 0;
        balao(x + Math.cos(a) * r, 1.6 + (i % 3) * 0.55 + (i ? 0.2 : 1.2), z + Math.sin(a) * r, CORES[(i + k) % CORES.length], false, 0.25);
      }
      U.mesh(U.cyl(0.18, 0.22, 0.25, 10), U.mat("#8E3FD1"), x, 0.12, z, group);
    });
    for (let i = 0; i < 14; i++) balao(-9 + Math.random() * 18, 6.0 + Math.random() * 0.6, -8 + Math.random() * 15, CORES[i % CORES.length], true, null);
    anim.push((dt, t) => floaters.forEach((o) => { o.m.position.y = o.y0 + Math.sin(t * 0.8 + o.ph) * 0.12; }));

    /* mesa do bolo com docinhos, copos e presentes */
    const mesa = new THREE.Group(); mesa.position.set(-7.6, 0, -3.5); mesa.rotation.y = Math.PI / 2; group.add(mesa);
    U.mesh(U.box(3.2, 0.9, 1.2), U.mat("#FFFFFF", { roughness: 0.8 }), 0, 0.45, 0, mesa);
    U.mesh(U.box(3.3, 0.06, 1.3), U.mat("#FF9BCB"), 0, 0.92, 0, mesa);
    // saia da toalha com babado colorido
    for (let i = 0; i < 12; i++) U.mesh(U.box(0.27, 0.16, 0.02), U.mat(CORES[i % CORES.length]), -1.48 + i * 0.27, 0.8, 0.62, mesa, false);
    // bolo de 3 andares com velinhas
    [[0.42, 0.26, "#FFF0F6"], [0.32, 0.24, "#FFC1DC"], [0.22, 0.22, "#FFF0F6"]].reduce((y, [r, h, c]) => {
      U.mesh(U.cyl(r, r, h, 24), U.mat(c, { roughness: 0.6 }), 0, y + h / 2, 0, mesa);
      U.mesh(U.geo("festa-glace-" + r, () => new THREE.TorusGeometry(r, 0.03, 6, 24)), U.mat("#FF4FA3"), 0, y + h, 0, mesa, false).rotation.x = Math.PI / 2;
      return y + h;
    }, 0.95);
    const velas = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      U.mesh(U.cyl(0.015, 0.015, 0.12, 6), U.mat(CORES[i]), Math.cos(a) * 0.12, 1.73, Math.sin(a) * 0.12, mesa, false);
      const fl = new THREE.Mesh(U.sph(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#FFD36B" })); fl.position.set(Math.cos(a) * 0.12, 1.81, Math.sin(a) * 0.12); fl.scale.y = 1.6; mesa.add(fl); velas.push(fl);
    }
    anim.push((dt, t) => velas.forEach((v, i) => { v.scale.y = 1.4 + Math.sin(t * 17 + i * 2) * 0.3; }));
    // docinhos e copos
    for (let i = 0; i < 10; i++) {
      const x = -1.3 + (i % 5) * 0.2, z = -0.3 + Math.floor(i / 5) * 0.2;
      U.mesh(U.sph(0.045, 8, 6), U.mat(i % 2 ? "#5A2E1A" : "#FFFFFF"), x, 0.99, z, mesa, false);
    }
    for (let i = 0; i < 6; i++) U.mesh(U.cyl(0.05, 0.04, 0.14, 10), U.mat(CORES[i]), 0.9 + (i % 3) * 0.16, 1.02, -0.25 + Math.floor(i / 3) * 0.2, mesa, false);
    col.addCentered(-7.6, -3.5, 1.4, 3.4);
    // presentes empilhados
    [[-7.6, -0.8, 0.7, "#4FC3FF", "#FFC83D"], [-7.2, -0.3, 0.5, "#FF4FA3", "#FFFFFF"], [-8.0, -0.2, 0.45, "#3DDC84", "#FF4FA3"]].forEach(([x, z, s, c, f]) => {
      U.mesh(U.box(s, s, s), U.mat(c), x, s / 2, z, group);
      U.mesh(U.box(s + 0.01, s + 0.01, 0.08), U.mat(f), x, s / 2, z, group, false);
      U.mesh(U.box(0.08, s + 0.01, s + 0.01), U.mat(f), x, s / 2, z, group, false);
      const laco = U.mesh(U.geo("festa-laco", () => new THREE.TorusGeometry(0.1, 0.03, 6, 12)), U.mat(f), x, s + 0.08, z, group, false); laco.rotation.y = 0.6;
      col.addCentered(x, z, s + 0.1, s + 0.1);
    });

    /* caixas de som que "batem" com a música */
    const cones = [];
    [-1, 1].forEach((s) => {
      const x = s * 6.4, z = -6.6;
      U.mesh(U.box(1.3, 2.4, 1.0), U.mat("#1B1B22", { roughness: 0.5 }), x, 1.2, z, group);
      [0.65, 1.7].forEach((y, k) => {
        const r = k ? 0.24 : 0.4;
        U.mesh(U.cyl(r + 0.05, r + 0.05, 0.04, 20), U.mat("#3A3A44"), x, y, z + 0.51, group, false).rotation.x = Math.PI / 2;
        const c = U.mesh(U.cyl(r, r * 0.6, 0.06, 20), U.mat("#2B2B33", { roughness: 0.7 }), x, y, z + 0.52, group, false); c.rotation.x = Math.PI / 2;
        cones.push(c);
      });
      U.mesh(U.box(1.3, 0.05, 1.0), U.mat(s < 0 ? "#FF4FA3" : "#4FC3FF", { emissive: s < 0 ? "#FF4FA3" : "#4FC3FF", emissiveIntensity: 0.8 }), x, 2.42, z, group, false);
      col.addCentered(x, z, 1.4, 1.1);
    });
    anim.push((dt, t) => { const k = Math.pow(1 - ((t / BEAT) % 1), 3); cones.forEach((c) => { c.scale.set(1 + 0.08 * k, 1, 1 + 0.08 * k); }); });

    /* confete caindo sem parar */
    const NC = 260;
    const cg = new THREE.PlaneGeometry(0.07, 0.11);
    const cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const conf = new THREE.InstancedMesh(cg, cm, NC);
    const cdat = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3(), cc = new THREE.Color();
    for (let i = 0; i < NC; i++) {
      cdat.push({ x: -9 + Math.random() * 18, y: Math.random() * 6.5, z: -8 + Math.random() * 15, v: 0.5 + Math.random() * 0.6, r: Math.random() * 6, w: 2 + Math.random() * 4 });
      conf.setColorAt(i, cc.set(CORES[i % CORES.length]));
    }
    group.add(conf);
    anim.push((dt) => {
      cdat.forEach((c, i) => {
        c.y -= c.v * dt; c.r += c.w * dt;
        if (c.y < 0.03) { c.y = 6.6; c.x = -9 + Math.random() * 18; c.z = -8 + Math.random() * 15; }
        e.set(c.r, c.r * 0.7, 0); q.setFromEuler(e); p3.set(c.x + Math.sin(c.r) * 0.15, c.y, c.z);
        m4.compose(p3, q, one); conf.setMatrixAt(i, m4);
      });
      conf.instanceMatrix.needsUpdate = true;
    });

    /* o dinossauro dançarino, no meio da pista */
    const npc = createDino();
    npc.root.position.set(0, 0, PZ); group.add(npc.root);
    col.addCentered(0, PZ - 0.5, 1.6, 2.8);

    /* convidados em volta do dinossauro, dançando a mesma coreografia que ele */
    const PELES = ["#F1C9A5", "#E0AC7E", "#C68642", "#8D5524", "#5C3A21"], CAB = ["#2B1B12", "#120E0D", "#6B4A2B", "#C9A15A", "#8B3A1E"];
    const CAMISAS = ["#FF4FA3", "#FFC83D", "#3DDC84", "#4FC3FF", "#B48CFF", "#FF7A45", "#FFFFFF"], CALCAS = ["#2E3A55", "#1F1F24", "#4A5D7A", "#6B4A2B"];
    const convidados = [];
    if (CT.createPedestrian) {
      const angs = [-118, -78, -38, 0, 38, 78, 118];
      const rr = U.rng(23), pk = (a) => a[Math.floor(rr() * a.length)];
      angs.forEach((ang, i) => {
        const a = ang * Math.PI / 180, R0 = 3.3 + (i % 2) * 0.35;
        const x = Math.sin(a) * R0, z = PZ + Math.cos(a) * R0;
        const fem = i % 2 === 0;
        const ch = CT.createPedestrian({
          modelo: fem ? "feminino" : "masculino", pele: pk(PELES), cabelo: pk(CAB), camisa: CAMISAS[i % CAMISAS.length], calca: pk(CALCAS),
          sapato: pk(["#2B2B2B", "#F4F4F4", "#1E6FD9"]), altura: (fem ? 1.6 : 1.7) + rr() * 0.12, corpo: 0.92 + rr() * 0.2,
          estiloCabelo: pk(["curto", "longo", "rabo"]),
        });
        ch.root.position.set(x, 0, z);
        ch.root.rotation.y = Math.atan2(-x, PZ - z);                 // de frente para o dinossauro
        ch.mode = "dance"; ch.dancaBatida = BEAT; ch.dancaTempo = () => npc.tempo();   // dançam junto com o dinossauro
        group.add(ch.root);
        // chapéu de festa
        const hat = new THREE.Mesh(U.geo("festa-chapeu", () => new THREE.ConeGeometry(0.1, 0.26, 14)), U.mat(CORES[(i + 3) % CORES.length], { roughness: 0.5 }));
        hat.userData.alt = ch.root.userData.altura || (fem ? 1.6 : 1.7);
        if (i % 2 === 1) { hat.position.y = 0.13; }
        convidados.push({ ch, hat });
        col.addCentered(x, z, 0.6, 0.6);
      });
      // o chapéu acompanha a cabeça
      const v = new THREE.Vector3(), q = new THREE.Quaternion();
      convidados.forEach(({ ch, hat }, i) => { if (ch.head && i % 2 === 1) group.add(hat); });
      anim.push((dt) => convidados.forEach(({ ch, hat }, i) => {
        if (ch.mode !== "dance") ch.mode = "dance";
        ch.update(dt);
        if (hat.parent && ch.head) {
          ch.head.getWorldPosition(v); ch.head.getWorldQuaternion(q);
          group.worldToLocal(v);
          hat.position.copy(v).add(new THREE.Vector3(0, 0.2, 0).applyQuaternion(q));
          hat.quaternion.copy(q);
        }
      }));
    }

    return {
      group, colliders: col, anim, npc, festa: true,
      def: { nome: "Casa de Festas", cor: "#E83E8C" },
      bounds: { x0: -RW + 0.6, x1: RW - 0.6, z0: -RD + 0.6, z1: RD - 1.8 },   // a câmera fica do lado de dentro da parede da porta
      spawn: { x: 0, z: 5.2, heading: Math.PI },
      talk: { x: 0, z: -999, r: 0 },            // ninguém para conversar: é só festa!
      exitZ: RD - 0.3,
    };
  }

  CT.CasaFestas = { buildRoom, createDino, BPM, BEAT };
})();
