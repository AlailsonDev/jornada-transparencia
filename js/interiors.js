/* =====================================================================
 * AMBIENTES INTERNOS DOS PRÉDIOS
 * Cada prédio tem uma sala própria (montada uma vez e reaproveitada),
 * com decoração ligada ao tema e o NPC aguardando atrás do balcão.
 * Sala: X de -11 a 11, Z de -9 (parede do fundo) a 9 (entrada).
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U;
  const RW = 11, RD = 9, WH = 7;

  CT.createInteriors = function () {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1B2238");
    const hemi = new THREE.HemisphereLight("#FFFFFF", "#6B6F80", 0.7); scene.add(hemi);
    const key = new THREE.DirectionalLight("#FFF4E6", 0.9);
    key.position.set(6, 14, 10); key.castShadow = !!CT.CONFIG.sombras;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
    key.shadow.bias = -0.0008;
    scene.add(key);
    const fill = new THREE.PointLight("#FFE2B0", 0.6, 30); fill.position.set(0, 6, 0); scene.add(fill);

    const cache = new Map();
    let current = null;

    const api = { scene, current: null };

    api.enter = function (idx) {
      if (current) scene.remove(current.group);
      hemi.intensity = 0.7; key.intensity = 0.9; fill.intensity = 0.6;
      if (!cache.has(idx)) cache.set(idx, buildRoom(idx));
      current = cache.get(idx);
      scene.add(current.group);
      scene.background = new THREE.Color(U.shade(CT.PREDIOS[idx].cor, -0.72));
      current.npc.mode = "wave";
      current.npc.root.position.set(0, 0, -4.3);
      current.npc.root.rotation.y = 0;
      api.current = current;
      return current;
    };
    /* Bia Festas (área secreta): salão montado em js/casa-festas.js */
    api.enterFesta = function () {
      if (current) scene.remove(current.group);
      hemi.intensity = 0.42; key.intensity = 0.55; fill.intensity = 0.25;   // luz de festa: mais baixa, as cores aparecem
      if (!cache.has("festa")) cache.set("festa", CT.CasaFestas.buildRoom());
      current = cache.get("festa");
      scene.add(current.group);
      scene.background = new THREE.Color("#2A1838");
      api.current = current;
      return current;
    };
    api.update = function (dt, t, alvo) {
      if (!current) return;
      // o servidor acompanha o jogador com o olhar: em pé, vira o corpo; sentado, a cabeça
      if (alvo && !current.festa && current.npc && current.npc.root) {
        const n = current.npc;
        if (n.sentado) n.olharPara = alvo;
        else {
          const r = n.root, want = U.clamp(Math.atan2(alvo.x - r.position.x, alvo.z - r.position.z), -1.25, 1.25);
          r.rotation.y += U.angleDiff(r.rotation.y, want) * Math.min(1, dt * 6);
        }
      }
      current.npc.update(dt);
      if (current.bia) current.bia.update(dt, t, alvo);   // Bia Festas: a organizadora
      current.anim.forEach((f) => f(dt, t));
    };
    return api;
  };

  /* Textura de "tela" com gráfico ou lista. */
  function screenTex(title, kind, color) {
    return U.canvasTex(512, 320, (ctx, w, h) => {
      ctx.fillStyle = "#0F1730"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, 52);
      ctx.fillStyle = "#FFFFFF"; ctx.font = "800 30px " + U.FONT_DISPLAY; ctx.textBaseline = "middle"; ctx.fillText(title, 20, 27);
      const r = U.rng(title.length * 97);
      if (kind === "bars") {
        const cols = ["#FFC83D", "#6FE3FF", "#3DDC84", "#FF8A7A", "#B48CFF"];
        for (let i = 0; i < 7; i++) { const bh = 40 + r() * 190; ctx.fillStyle = cols[i % 5]; ctx.fillRect(40 + i * 64, h - 30 - bh, 40, bh); }
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.moveTo(26, h - 30); ctx.lineTo(w - 20, h - 30); ctx.stroke();
      } else if (kind === "line") {
        ctx.strokeStyle = "#6FE3FF"; ctx.lineWidth = 6; ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const x = 30 + i * 45, y = 250 - i * 14 - r() * 50; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = "rgba(111,227,255,0.15)"; ctx.lineTo(480, 290); ctx.lineTo(30, 290); ctx.fill();
      } else if (kind === "list") {
        ctx.font = "600 22px " + U.FONT_BODY;
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"; ctx.fillRect(16, 66 + i * 40, w - 32, 36);
          ctx.fillStyle = "#DDE6FF"; ctx.fillText(["Contrato 0" + (12 + i) + "/2026", "Edital 0" + (3 + i) + "/2026", "Ata de Registro", "Aditivo nº " + (i + 1), "Dispensa 0" + (40 + i), "Pregão 0" + (20 + i)][i], 28, 85 + i * 40);
          ctx.fillStyle = "#3DDC84"; ctx.fillText("Publicado", w - 150, 85 + i * 40);
        }
      } else if (kind === "csv") {
        ctx.font = "600 21px monospace"; ctx.fillStyle = "#3DDC84";
        const lines = ["orgao;despesa;valor", "SAUDE;medicamentos;125430,00", "EDUCACAO;merenda;98210,50", "OBRAS;pavimentacao;310000,00", "CULTURA;eventos;15300,00", "ASSIST;cestas;42800,00"];
        lines.forEach((l, i) => ctx.fillText(l, 20, 84 + i * 40));
      } else if (kind === "pie") {
        let a = -Math.PI / 2; const vals = [0.38, 0.24, 0.18, 0.12, 0.08], cols = ["#FFC83D", "#6FE3FF", "#3DDC84", "#FF8A7A", "#B48CFF"];
        vals.forEach((v, i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(170, 185); ctx.arc(170, 185, 110, a, a + v * Math.PI * 2); ctx.fill(); a += v * Math.PI * 2; });
        ["Saúde", "Educação", "Obras", "Social", "Outros"].forEach((t, i) => { ctx.fillStyle = cols[i]; ctx.fillRect(320, 90 + i * 40, 22, 22); ctx.fillStyle = "#fff"; ctx.font = "600 22px " + U.FONT_BODY; ctx.fillText(t, 352, 102 + i * 40); });
      } else if (kind === "lock") {
        ctx.strokeStyle = "#6FE3FF"; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(256, 150, 50, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "#6FE3FF"; U.roundRect(ctx, 186, 150, 140, 110, 16); ctx.fill();
        ctx.fillStyle = "#0F1730"; ctx.beginPath(); ctx.arc(256, 195, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(250, 195, 12, 36);
      }
    });
  }

  function poster(text, sub, bg, fg) {
    return new THREE.MeshBasicMaterial({ map: U.signTex(text, { w: 1024, h: 384, bg, fg: fg || "#FFFFFF", sub, font: 110, radius: 30 }) });
  }

  function buildRoom(idx) {
    const def = CT.PREDIOS[idx];
    const group = new THREE.Group();
    const col = new U.Colliders();
    const anim = [];
    const theme = def.cor;

    /* ---------- piso ---------- */
    const floorTex = U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = U.shade(theme, 0.86); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = U.shade(theme, 0.74); ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
      ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 256, 256);
    }, true);
    floorTex.repeat.set(5.5, 4.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), U.mat(U.shade(theme, -0.6)));
    outside.rotation.x = -Math.PI / 2; outside.position.set(0, -0.02, RD + 15); group.add(outside);
    // tapete de entrada
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshBasicMaterial({ map: U.signTex("SAÍDA", { w: 512, h: 200, bg: "#2B2F3A", fg: "#FFC83D", font: 90, radius: 20 }) }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.02, RD - 1); group.add(mat);
    // tapete central
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 7), U.mat(U.shade(theme, 0.2)));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.015, 3.2); rug.receiveShadow = true; group.add(rug);

    /* ---------- paredes ---------- */
    const wallM = U.mat(U.shade(theme, 0.88), { roughness: 0.9 });
    const band = U.mat(theme);
    U.mesh(U.box(RW * 2 + 0.8, WH, 0.4), wallM, 0, WH / 2, -RD - 0.2, group);
    [-1, 1].forEach((s) => {
      U.mesh(U.box(0.4, WH, RD * 2), wallM, s * (RW + 0.2), WH / 2, 0, group);
      U.mesh(U.box(0.1, 1.1, RD * 2), band, s * (RW - 0.02), 0.55, 0, group);
      // batente da entrada
      U.mesh(U.box(0.6, WH, 0.6), U.mat(U.shade(theme, -0.3)), s * (RW + 0.1), WH / 2, RD - 0.2, group);
    });
    U.mesh(U.box(RW * 2, 1.1, 0.1), band, 0, 0.55, -RD + 0.02, group);
    // nome do prédio na parede do fundo
    const nameM = new THREE.MeshBasicMaterial({ map: U.signTex(def.nome, { bg: theme, fg: "#FFFFFF", badge: String(idx + 1), font: 104 }), transparent: true });
    const name = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), nameM); name.position.set(0, 5.95, -RD + 0.03); group.add(name);
    // luminárias pendentes
    [-5, 0, 5].forEach((x) => {
      U.mesh(U.cyl(0.02, 0.02, 1.6, 4), U.mat("#333"), x, WH - 0.4, 0, group, false);
      U.mesh(U.cyl(0.4, 0.8, 0.5, 16), U.mat(theme), x, WH - 1.3, 0, group, false);
      U.mesh(U.sph(0.3, 12, 8), U.mat("#FFF6D8", { emissive: "#FFE9A8", emissiveIntensity: 1 }), x, WH - 1.55, 0, group, false);
    });

    /* ---------- balcão de atendimento (ou mesa de gabinete) ---------- */
    let gabinete = null;
    if (def.npc.mesaChefe) gabinete = mesaChefe(group, col, def, anim);
    else {
      U.mesh(U.box(6.4, 1.15, 1.3), U.mat(theme), 0, 0.58, -2.6, group);
      U.mesh(U.box(6.7, 0.12, 1.5), U.mat("#F7F5F0"), 0, 1.2, -2.6, group);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshBasicMaterial({ map: U.signTex(def.npc.placa || (def.npc.nome + " · " + def.npc.cargo), { w: 1024, h: 170, bg: "#FFFFFF", fg: U.shade(theme, -0.3), font: 70, radius: 20 }) }));
      plate.position.set(0, 0.72, -1.94); group.add(plate);
      col.addCentered(0, -2.6, 6.7, 1.5);
      // monitor no balcão
      U.mesh(U.box(1, 0.65, 0.06), U.mat("#1B1E27"), 2.2, 1.65, -2.8, group);
      U.mesh(U.box(0.08, 0.35, 0.08), U.mat("#1B1E27"), 2.2, 1.35, -2.8, group);
    }

    /* ---------- decoração temática ---------- */
    const D = { group, col, anim, theme, def };
    (DECOR[def.decoracao] || DECOR.portal)(D);

    // plantas nos cantos do fundo
    [-1, 1].forEach((s) => {
      U.mesh(U.cyl(0.45, 0.35, 0.8, 12), U.mat("#E8E1D4"), s * 9.8, 0.4, -7.8, group);
      U.mesh(U.geo("ico1", () => new THREE.IcosahedronGeometry(0.9, 1)), U.mat("#4FA85A", { flatShading: true }), s * 9.8, 1.5, -7.8, group).scale.set(1, 1.3, 1);
      col.addCentered(s * 9.8, -7.8, 1, 1);
    });

    /* ---------- NPC ---------- */
    const npc = CT.createNPC(def.npc);
    npc.root.position.set(0, 0, -4.3);
    group.add(npc.root);
    if (gabinete) { npc.sentado = true; gabinete.cadeira(npc); }

    return {
      group, colliders: col, anim, npc, def,
      bounds: { x0: -RW + 0.6, x1: RW - 0.6, z0: -RD + 0.6, z1: RD + 0.4 },
      spawn: { x: 0, z: 4.6, heading: Math.PI },
      talk: { x: 0, z: -1.2, r: 2.6 },
      exitZ: RD - 0.3,
    };
  }

  /* ---------- Mesa de gabinete (Prefeito): madeira escura, tampo com couro,
   * enfeites em cima e cadeira de espaldar alto ---------- */
  function mesaChefe(group, col, def, anim) {
    const g = new THREE.Group(); group.add(g);
    const wood = U.mat("#3F1C0B", { roughness: 0.4 }), woodL = U.mat("#5A2A12", { roughness: 0.38 });
    const woodD = U.mat("#2A1207", { roughness: 0.45 }), brass = U.mat("#C9A04A", { metalness: 0.75, roughness: 0.28 });
    const leatherG = U.mat("#24443A", { roughness: 0.6 });
    const Z = -3.5, W2 = 2.7, DP = 1.12, TOP = 0.72;            // centro, largura, profundidade e altura do tampo
    const zF = Z + DP / 2, zB = Z - DP / 2;                     // frente (lado do jogador) e fundo (lado da cadeira)
    // tampo com borda boleada e couro verde embutido
    U.mesh(U.box(W2, 0.06, DP), wood, 0, TOP - 0.03, Z, g);
    U.mesh(U.box(W2 + 0.06, 0.03, DP + 0.06), woodL, 0, TOP - 0.075, Z, g);
    U.mesh(U.box(1.5, 0.006, 0.62), leatherG, 0, TOP + 0.003, Z - 0.12, g);
    // gaveteiros laterais
    [-1, 1].forEach((s) => {
      const x = s * (W2 / 2 - 0.36);
      U.mesh(U.box(0.66, TOP - 0.13, DP - 0.04), wood, x, (TOP - 0.13) / 2 + 0.04, Z, g);
      U.mesh(U.box(0.7, 0.05, DP), woodD, x, 0.025, Z, g);                       // rodapé
      for (let i = 0; i < 3; i++) {                                              // gavetas (lado da cadeira)
        const y = 0.17 + i * 0.165;
        U.mesh(U.box(0.56, 0.14, 0.02), woodL, x, y, zB + 0.01, g);
        U.mesh(U.box(0.12, 0.018, 0.03), brass, x, y, zB - 0.01, g, false);
      }
      // painel almofadado nas laterais
      const side = U.mesh(U.box(0.02, 0.36, DP - 0.3), woodL, s * (W2 / 2 - 0.02), 0.36, Z, g); side.castShadow = false;
    });
    // gaveta central sob o tampo e painel frontal (lado do jogador) com molduras
    U.mesh(U.box(W2 - 1.44, 0.1, DP - 0.1), wood, 0, TOP - 0.13, Z, g);
    U.mesh(U.box(W2 - 0.02, TOP - 0.16, 0.05), wood, 0, (TOP - 0.16) / 2 + 0.04, zF - 0.06, g);
    [-0.92, 0, 0.92].forEach((x) => U.mesh(U.box(0.74, 0.36, 0.02), woodL, x, 0.33, zF - 0.025, g));
    // placa de latão na frente: "Prefeito - Portal da Transparência"
    const plateTex = U.signTex(def.npc.placa || def.npc.nome, { w: 1024, h: 150, bg: "#C9A04A", fg: "#3A2410", font: 64, radius: 14 });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.28), new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.45, roughness: 0.35 }));
    plate.position.set(0, 0.52, zF + 0.001); g.add(plate);
    col.addCentered(0, Z, W2 + 0.1, DP + 0.1);

    /* ---- enfeites em cima da mesa ---- */
    const y0 = TOP;
    // placa de mesa (prisma de madeira com plaqueta de latão, virada para o jogador)
    const np = new THREE.Group(); np.position.set(-0.62, y0, zF - 0.2); g.add(np);
    U.mesh(U.box(0.5, 0.03, 0.1), woodD, 0, 0.015, 0, np);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), new THREE.MeshStandardMaterial({ map: U.signTex("PREFEITO", { w: 512, h: 110, bg: "#C9A04A", fg: "#2B1A0B", font: 70, radius: 6 }), metalness: 0.4, roughness: 0.35 }));
    const tb = U.mesh(U.box(0.48, 0.12, 0.02), woodD, 0, 0.09, 0, np); tb.rotation.x = -0.35;
    tag.position.set(0, 0.093, 0.022); tag.rotation.x = -0.35; np.add(tag);
    // luminária de mesa estilo "banker" (cúpula verde)
    const lamp = new THREE.Group(); lamp.position.set(-1.05, y0, Z - 0.18); g.add(lamp);
    U.mesh(U.box(0.26, 0.03, 0.16), brass, 0, 0.015, 0, lamp);
    U.mesh(U.cyl(0.012, 0.012, 0.32, 8), brass, 0, 0.17, 0, lamp);
    const shade = U.mesh(U.geo("lamp-shade", () => new THREE.CylinderGeometry(0.075, 0.075, 0.3, 16, 1, false, 0, Math.PI)), U.mat("#1E6B3C", { roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide }), 0, 0.36, 0, lamp);
    shade.rotation.z = Math.PI / 2; shade.rotation.y = Math.PI / 2;
    U.mesh(U.cyl(0.025, 0.025, 0.27, 10), U.mat("#FFF4C8", { emissive: "#FFE9A0", emissiveIntensity: 1.2 }), 0, 0.33, 0, lamp, false).rotation.z = Math.PI / 2;
    const glow = new THREE.PointLight("#FFE2A0", 0.5, 2.2); glow.position.set(0, 0.2, 0.05); lamp.add(glow);
    // globo terrestre em suporte de latão
    const globe = new THREE.Group(); globe.position.set(1.05, y0, Z - 0.15); g.add(globe);
    U.mesh(U.cyl(0.09, 0.11, 0.03, 16), woodD, 0, 0.015, 0, globe);
    U.mesh(U.cyl(0.012, 0.012, 0.1, 8), brass, 0, 0.08, 0, globe);
    const gtex = U.canvasTex(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#2E6FA8"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#D9C27A";
      [[40, 35, 30, 22], [60, 80, 18, 30], [130, 40, 40, 25], [140, 75, 20, 28], [200, 45, 35, 20], [215, 95, 18, 12]].forEach(([x, y, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); ctx.fill(); });
    });
    const gl = new THREE.Mesh(U.geo("globo", () => new THREE.SphereGeometry(0.12, 24, 16)), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.4 }));
    gl.position.y = 0.25; gl.rotation.z = 0.41; gl.castShadow = true; globe.add(gl);
    const ring = new THREE.Mesh(U.geo("globo-aro", () => new THREE.TorusGeometry(0.135, 0.006, 6, 32, Math.PI * 1.2)), brass);
    ring.position.y = 0.25; ring.rotation.set(0, Math.PI / 2, 0.41 - 0.3); globe.add(ring);
    anim.push((dt) => { gl.rotation.y += dt * 0.25; });
    // porta-canetas e caneta-tinteiro
    const pens = new THREE.Group(); pens.position.set(0.55, y0, zF - 0.28); g.add(pens);
    U.mesh(U.box(0.3, 0.03, 0.14), U.mat("#1D1A18", { roughness: 0.3 }), 0, 0.015, 0, pens);
    [-0.07, 0.07].forEach((x, i) => {
      U.mesh(U.cyl(0.018, 0.022, 0.04, 10), brass, x, 0.05, -0.02, pens);
      const pen = U.mesh(U.cyl(0.007, 0.007, 0.16, 8), U.mat(i ? "#1D1A18" : "#7A1E1E", { roughness: 0.25 }), x, 0.12, -0.04, pens); pen.rotation.x = -0.45;
    });
    // pilha de pastas e documentos
    const docs = new THREE.Group(); docs.position.set(-0.98, y0, zF - 0.32); docs.rotation.y = 0.12; g.add(docs);
    ["#1E4895", "#C0392B", "#E9E4D8", "#14A44D", "#E9E4D8"].forEach((c, i) => {
      const f = U.mesh(U.box(0.34, 0.022, 0.25), U.mat(c), Math.sin(i * 2.1) * 0.015, 0.012 + i * 0.024, Math.cos(i * 1.7) * 0.012, docs); f.rotation.y = Math.sin(i * 1.3) * 0.08;
    });
    // porta-retrato (de costas para o jogador) e xícara de café
    const fr = new THREE.Group(); fr.position.set(0.88, y0, Z - 0.42); fr.rotation.y = Math.PI + 0.5; g.add(fr);
    const fb = U.mesh(U.box(0.2, 0.15, 0.015), woodD, 0, 0.085, 0, fr); fb.rotation.x = 0.18;
    U.mesh(U.box(0.02, 0.12, 0.012), woodD, 0, 0.06, -0.05, fr).rotation.x = -0.5;
    const cup = new THREE.Group(); cup.position.set(0.48, y0, Z - 0.3); g.add(cup);
    U.mesh(U.cyl(0.075, 0.075, 0.008, 18), U.mat("#F4F1EA"), 0, 0.004, 0, cup);
    U.mesh(U.cyl(0.04, 0.033, 0.07, 14), U.mat("#F4F1EA"), 0, 0.043, 0, cup);
    U.mesh(U.cyl(0.036, 0.036, 0.004, 14), U.mat("#3B2416"), 0, 0.076, 0, cup, false);
    const handle = U.mesh(U.geo("xicara-asa", () => new THREE.TorusGeometry(0.018, 0.005, 6, 12)), U.mat("#F4F1EA"), 0.045, 0.045, 0, cup); handle.rotation.y = 0;
    // mini bandeiras de mesa (Brasil e Pernambuco)
    const minis = new THREE.Group(); minis.position.set(0.05, y0, zF - 0.16); g.add(minis);
    U.mesh(U.cyl(0.05, 0.06, 0.025, 14), brass, 0, 0.012, 0, minis);
    [["brasil", -0.035, 0.18], ["pernambuco", 0.035, -0.18]].forEach(([k, x, r]) => {
      const pole = U.mesh(U.cyl(0.004, 0.004, 0.32, 6), brass, x, 0.17, 0, minis); pole.rotation.z = r * 0.6;
      const tex = CT.Prefeitura && CT.Prefeitura.texturaBandeira ? CT.Prefeitura.texturaBandeira(k) : null;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshStandardMaterial({ map: tex, color: tex ? "#FFFFFF" : (k === "brasil" ? "#1E9E4A" : "#1E4895"), side: THREE.DoubleSide, roughness: 0.8 }));
      fl.position.set(x + Math.sign(x) * 0.08 + Math.sin(r * 0.6) * -0.12, 0.27, 0); fl.rotation.z = r * 0.25;
      if (x < 0) fl.scale.x = 1; minis.add(fl);
    });

    /* ---- cadeira de espaldar alto, em couro, na altura do assento do Prefeito ---- */
    function cadeira(npc) {
      const seat = (npc.sit && npc.sit.assento) || 0.46;
      const c = new THREE.Group(); c.position.set(0, 0, -4.32); group.add(c);
      const lea = U.mat("#2E140B", { roughness: 0.5 }), leaD = U.mat("#2A140C", { roughness: 0.6 }), chrome = U.mat("#B9BCC2", { metalness: 0.8, roughness: 0.25 });
      // base em estrela com rodízios e coluna
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, leg = U.mesh(U.box(0.05, 0.04, 0.34), chrome, Math.sin(a) * 0.17, 0.08, Math.cos(a) * 0.17, c); leg.rotation.y = a;
        U.mesh(U.sph(0.035, 8, 6), U.mat("#1A1A1A"), Math.sin(a) * 0.33, 0.035, Math.cos(a) * 0.33, c);
      }
      U.mesh(U.cyl(0.035, 0.045, seat - 0.16, 10), chrome, 0, (seat - 0.16) / 2 + 0.06, 0, c);
      // assento (o topo fica na altura medida do personagem) e encosto alto acolchoado
      U.mesh(U.box(0.62, 0.11, 0.58), lea, 0, seat - 0.055, 0.02, c);
      U.mesh(U.box(0.66, 0.04, 0.62), leaD, 0, seat - 0.12, 0.02, c);
      const back = new THREE.Group(); back.position.set(0, seat, -0.3); back.rotation.x = -0.12; c.add(back);
      U.mesh(U.box(0.64, 0.95, 0.14), lea, 0, 0.5, 0, back);
      U.mesh(U.box(0.5, 0.25, 0.06), leaD, 0, 0.78, 0.07, back);
      U.mesh(U.box(0.5, 0.25, 0.06), leaD, 0, 0.45, 0.07, back);
      // botões capitonê
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) U.mesh(U.sph(0.014, 6, 5), leaD, -0.16 + q * 0.16, 0.3 + r * 0.24, 0.072, back, false);
      // braços da cadeira
      [-1, 1].forEach((s) => {
        U.mesh(U.box(0.07, 0.05, 0.42), lea, s * 0.36, seat + 0.2, 0.0, c);
        U.mesh(U.box(0.04, 0.2, 0.04), chrome, s * 0.36, seat + 0.09, -0.08, c);
      });
      col.addCentered(0, -4.4, 0.8, 0.8);
    }
    return { cadeira };
  }

  /* ---------- Decoração por tema (paredes laterais e fundo) ---------- */
  function wallScreen(D, tex, x, y, z, w, h, ry) {
    const frame = U.mesh(U.box(w + 0.3, h + 0.3, 0.2), U.mat("#1B1E27"), x, y, z, D.group);
    frame.rotation.y = ry || 0;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    s.position.set(x + Math.sin(ry || 0) * 0.11, y, z + Math.cos(ry || 0) * 0.11); s.rotation.y = ry || 0; D.group.add(s);
    return s;
  }
  function sideBox(D, x, z, w, h, d, color) { const m = U.mesh(U.box(w, h, d), U.mat(color), x, h / 2, z, D.group); D.col.addCentered(x, z, w, d); return m; }
  function chairs(D, x, z0, n, color) {
    for (let i = 0; i < n; i++) {
      const z = z0 + i * 1.3;
      U.mesh(U.box(0.9, 0.12, 0.9), U.mat(color), x, 0.55, z, D.group);
      U.mesh(U.box(0.12, 0.8, 0.9), U.mat(color), x + Math.sign(x) * 0.42, 0.95, z, D.group);
      U.mesh(U.box(0.8, 0.5, 0.08), U.mat("#2B2F3A"), x, 0.25, z, D.group);
    }
    D.col.addBox(x - 0.5, x + 0.5, z0 - 0.5, z0 + (n - 1) * 1.3 + 0.5);
  }
  function shelf(D, x, z, ry, colors) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; D.group.add(g);
    U.mesh(U.box(3.6, 3.6, 0.8), U.mat("#8C6239"), 0, 1.8, 0, g);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      const b = U.mesh(U.box(0.3, 0.6 + (i % 3) * 0.08, 0.6), U.mat(colors[(i + r) % colors.length]), -1.45 + i * 0.36, 0.55 + r * 0.85, 0.12, g);
    }
    const q = Math.abs(Math.sin(ry)) > 0.5;
    D.col.addCentered(x, z, q ? 0.8 : 3.6, q ? 3.6 : 0.8);
  }

  const DECOR = {
    portal(D) {
      wallScreen(D, screenTex("RECEITAS 2026", "line", "#1E6FD9"), -6.5, 3.6, -RD + 0.15, 4.4, 2.75);
      wallScreen(D, screenTex("DESPESAS POR ÁREA", "pie", "#FFC83D"), 6.5, 3.6, -RD + 0.15, 4.4, 2.75);
      wallScreen(D, screenTex("CONTRATOS", "list", "#14A44D"), -RW + 0.15, 3.4, -1, 5, 3.1, Math.PI / 2);
      wallScreen(D, screenTex("EXECUÇÃO MENSAL", "bars", "#7A4DD8"), RW - 0.15, 3.4, -1, 5, 3.1, -Math.PI / 2);
      // pilhas de moedas
      const gold = U.mat("#FFC83D", { metalness: 0.6, roughness: 0.3 });
      [[-7, 4], [7, 4], [-7.8, 5.5], [7.8, 5.5]].forEach(([x, z], i) => {
        for (let k = 0; k < 4 + i; k++) U.mesh(U.cyl(0.5, 0.5, 0.16, 20), gold, x, 0.08 + k * 0.17, z, D.group);
        D.col.addCentered(x, z, 1.1, 1.1);
      });
    },
    lai(D) {
      const cols = ["#0E9F8E", "#1E6FD9", "#FFC83D", "#E2574C", "#7A4DD8", "#F4F4F4"];
      shelf(D, -RW + 0.6, -3.5, Math.PI / 2, cols); shelf(D, -RW + 0.6, 1, Math.PI / 2, cols);
      shelf(D, RW - 0.6, -3.5, -Math.PI / 2, cols);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2), poster("SIC", "Serviço de Informação ao Cidadão", "#0E9F8E"));
      p.position.set(-6.6, 4, -RD + 0.05); D.group.add(p);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2), poster("20 + 10 dias", "prazo de resposta da LAI", "#16305C", "#FFC83D"));
      p2.position.set(6.6, 4, -RD + 0.05); D.group.add(p2);
      // caixas de arquivo
      for (let i = 0; i < 6; i++) U.mesh(U.box(0.9, 0.6, 0.7), U.mat("#D8B98A"), 7.6 + (i % 2) * 1, 0.3 + Math.floor(i / 2) * 0.62, 3, D.group);
      D.col.addCentered(8.1, 3, 2, 0.8);
      chairs(D, RW - 1.2, 4.5, 3, "#0E9F8E");
      // totem de senhas
      U.mesh(U.box(0.7, 1.6, 0.5), U.mat("#2B2F3A"), -4.5, 0.8, 0.5, D.group);
      U.mesh(U.box(0.5, 0.4, 0.05), U.mat("#6FE3FF", { emissive: "#6FE3FF", emissiveIntensity: 0.6 }), -4.5, 1.35, 0.78, D.group);
      D.col.addCentered(-4.5, 0.5, 0.8, 0.6);
    },
    ouvidoria(D) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), poster("FALE CONOSCO", "Reclamação · Denúncia · Sugestão · Elogio", "#E2574C"));
      p.position.set(-6.6, 4, -RD + 0.05); D.group.add(p);
      // balões de fala gigantes nas paredes
      const bubbles = [["Sugestão", "#FFC83D"], ["Elogio", "#3DDC84"], ["Reclamação", "#FF8A7A"], ["Denúncia", "#6FA6FF"]];
      bubbles.forEach(([t, c], i) => {
        const tex = U.canvasTex(512, 300, (ctx) => {
          ctx.fillStyle = c; U.roundRect(ctx, 10, 10, 492, 220, 60); ctx.fill();
          ctx.beginPath(); ctx.moveTo(90, 220); ctx.lineTo(70, 290); ctx.lineTo(160, 220); ctx.fill();
          ctx.fillStyle = "#1B1E27"; ctx.font = "800 64px " + U.FONT_DISPLAY; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, 256, 122);
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        const side = i < 2 ? -1 : 1;
        m.position.set(side * (RW - 0.05), 3.6 + (i % 2) * 0.4, -4 + (i % 2) * 5); m.rotation.y = -side * Math.PI / 2; D.group.add(m);
        D.anim.push((dt, t) => { m.position.y = 3.6 + (i % 2) * 0.4 + Math.sin(t * 1.5 + i) * 0.12; });
      });
      // urna de sugestões
      U.mesh(U.box(1, 1, 1), U.mat("#2D78C4"), 6.5, 1.3, -6, D.group);
      U.mesh(U.box(0.5, 0.04, 0.12), U.mat("#111"), 6.5, 1.81, -6, D.group);
      U.mesh(U.cyl(0.12, 0.12, 0.8, 8), U.mat("#888"), 6.5, 0.4, -6, D.group);
      D.col.addCentered(6.5, -6, 1.1, 1.1);
      chairs(D, -RW + 1.2, 2.5, 4, "#E2574C");
      // mesas com telefone
      [5.8, 8.6].forEach((x) => {
        sideBox(D, x, 3, 2, 0.9, 1.1, "#F4F4F4");
        U.mesh(U.box(0.5, 0.15, 0.3), U.mat("#E2574C"), x, 0.98, 3, D.group);
      });
    },
    controle(D) {
      // mesa redonda do conselho
      U.mesh(U.cyl(2, 2, 0.15, 32), U.mat("#8C6239"), 6.5, 1, 2.5, D.group);
      U.mesh(U.cyl(0.25, 0.4, 1, 12), U.mat("#5A3B22"), 6.5, 0.5, 2.5, D.group);
      D.col.addCentered(6.5, 2.5, 4.2, 4.2);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        U.mesh(U.box(0.7, 0.9, 0.7), U.mat("#7A4DD8"), 6.5 + Math.cos(a) * 2.7, 0.45, 2.5 + Math.sin(a) * 2.7, D.group);
      }
      // cavalete com gráfico
      wallScreen(D, screenTex("AUDIÊNCIA PÚBLICA · LOA", "bars", "#7A4DD8"), -RW + 0.15, 3.4, -1.5, 5, 3.1, Math.PI / 2);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), poster("CONSELHO MUNICIPAL", "A cidade fiscaliza junto", "#7A4DD8"));
      p.position.set(-6.6, 4, -RD + 0.05); D.group.add(p);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 2), poster("60 dias", "contas abertas ao contribuinte", "#16305C", "#FFC83D"));
      p2.position.set(6.6, 4, -RD + 0.05); D.group.add(p2);
      // lupa gigante
      const lupa = new THREE.Group(); lupa.position.set(-7.5, 1.6, 4); D.group.add(lupa);
      U.mesh(new THREE.TorusGeometry(0.9, 0.16, 10, 28), U.mat("#3A2E3F"), 0, 0.6, 0, lupa);
      U.mesh(U.cyl(0.85, 0.85, 0.05, 24), new THREE.MeshStandardMaterial({ color: "#BFE9FF", transparent: true, opacity: 0.45 }), 0, 0.6, 0, lupa).rotation.x = Math.PI / 2;
      U.mesh(U.cyl(0.12, 0.14, 1.4, 8), U.mat("#3A2E3F"), 0, -0.6, 0, lupa);
      D.anim.push((dt) => { lupa.rotation.y += dt * 0.8; });
      D.col.addCentered(-7.5, 4, 1.4, 1.4);
    },
    lgpd(D) {
      // racks de servidores com LEDs
      const leds = [];
      [[-RW + 1, -5], [-RW + 1, -2.6], [-RW + 1, -0.2], [RW - 1, -5], [RW - 1, -2.6]].forEach(([x, z]) => {
        sideBox(D, x, z, 1.4, 3.4, 2, "#1E2433");
        for (let r = 0; r < 6; r++) {
          const m = new THREE.MeshStandardMaterial({ color: "#6FE3FF", emissive: "#6FE3FF", emissiveIntensity: 1 });
          leds.push(m);
          U.mesh(U.box(0.05, 0.08, 1.4), m, x - Math.sign(x) * 0.72, 0.5 + r * 0.5, z, D.group, false);
        }
      });
      D.anim.push((dt, t) => leds.forEach((m, i) => (m.emissiveIntensity = Math.sin(t * 6 + i * 1.7) > 0.2 ? 1.2 : 0.2)));
      wallScreen(D, screenTex("DADOS PROTEGIDOS", "lock", "#2D3E8F"), 6.2, 4, -RD + 0.15, 4.4, 2.75);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), poster("LGPD", "Lei nº 13.709/2018", "#2D3E8F", "#6FE3FF"));
      p.position.set(-6.6, 4, -RD + 0.05); D.group.add(p);
      // escudo flutuante
      const shield = new THREE.Group(); shield.position.set(6.8, 2.2, 3.5); D.group.add(shield);
      const sh = new THREE.Shape(); sh.moveTo(0, 1); sh.quadraticCurveTo(0.9, 0.9, 0.9, 0.5); sh.quadraticCurveTo(0.9, -0.5, 0, -1); sh.quadraticCurveTo(-0.9, -0.5, -0.9, 0.5); sh.quadraticCurveTo(-0.9, 0.9, 0, 1);
      U.mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }), U.mat("#2D3E8F", { metalness: 0.4, roughness: 0.3 }), 0, 0, 0, shield);
      U.mesh(U.sph(0.25, 12, 8), U.mat("#6FE3FF", { emissive: "#6FE3FF", emissiveIntensity: 1 }), 0, 0.1, 0.3, shield);
      U.mesh(U.cyl(0.5, 0.6, 0.6, 16), U.mat("#E8EEF5"), 6.8, 0.3, 3.5, D.group);
      D.anim.push((dt, t) => { shield.rotation.y += dt; shield.position.y = 2.2 + Math.sin(t * 2) * 0.15; });
      D.col.addCentered(6.8, 3.5, 1.3, 1.3);
    },
    licitacoes(D) {
      wallScreen(D, screenTex("PNCP · CONTRATAÇÕES", "list", "#C9861A"), 6.2, 3.8, -RD + 0.15, 4.6, 2.9);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), poster("LEI 14.133/2021", "Nova Lei de Licitações", "#C9861A"));
      p.position.set(-6.6, 4, -RD + 0.05); D.group.add(p);
      // mesa de abertura de propostas com envelopes
      sideBox(D, -6.5, 3, 4, 0.95, 1.8, "#8C6239");
      for (let i = 0; i < 5; i++) {
        const e = U.mesh(U.box(0.8, 0.04, 0.55), U.mat("#F3E3B5"), -8 + i * 0.75, 0.98, 3 + (i % 2) * 0.3, D.group);
        e.rotation.y = (i - 2) * 0.15;
        U.mesh(U.cyl(0.07, 0.07, 0.02, 10), U.mat("#C0392B"), -8 + i * 0.75, 1.01, 3 + (i % 2) * 0.3, D.group);
      }
      // martelo no balcão
      const gv = new THREE.Group(); gv.position.set(-2, 1.35, -2.4); gv.rotation.y = 0.5; D.group.add(gv);
      U.mesh(U.cyl(0.13, 0.13, 0.5, 12), U.mat("#6B3B1F"), 0, 0.05, 0, gv).rotation.z = Math.PI / 2;
      U.mesh(U.cyl(0.03, 0.03, 0.6, 8), U.mat("#8C6239"), 0, 0.05, 0.3, gv).rotation.x = Math.PI / 2;
      // arquivo de contratos
      shelf(D, RW - 0.6, 1, -Math.PI / 2, ["#C9861A", "#F4F4F4", "#2E3A55", "#E2574C"]);
      chairs(D, -RW + 1.2, -6.5, 3, "#C9861A");
    },
    obras(D) {
      // placa de obra (com as informações que o cidadão deve encontrar)
      const tex = U.canvasTex(768, 480, (ctx, w, h) => {
        ctx.fillStyle = "#1E6FD9"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#FFC83D"; ctx.fillRect(0, 0, w, 80);
        ctx.fillStyle = "#16305C"; ctx.font = "800 46px " + U.FONT_DISPLAY; ctx.textBaseline = "middle"; ctx.fillText("PLACA DE OBRA", 30, 42);
        ctx.fillStyle = "#FFFFFF"; ctx.font = "700 32px " + U.FONT_BODY;
        ["Objeto: Reforma da Escola Municipal", "Valor: R$ 1.250.000,00", "Prazo: 240 dias", "Empresa: Construtora Exemplo Ltda.", "Fonte: Recursos próprios", "Fiscal: Eng.ª Paula"].forEach((t, i) => ctx.fillText(t, 30, 128 + i * 58));
      });
      wallScreen(D, tex, -6.6, 3.6, -RD + 0.15, 5.2, 3.25);
      // mesa com planta baixa
      sideBox(D, 6.5, 2.5, 3.6, 0.95, 2.2, "#8C6239");
      const bp = U.canvasTex(512, 320, (ctx, w, h) => { ctx.fillStyle = "#1F4FA0"; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = "#CFE3FF"; ctx.lineWidth = 4; ctx.strokeRect(40, 40, 430, 240); ctx.strokeRect(40, 40, 200, 120); ctx.strokeRect(240, 160, 230, 120); ctx.beginPath(); ctx.moveTo(140, 160); ctx.lineTo(140, 280); ctx.stroke(); });
      const bpm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.9), new THREE.MeshBasicMaterial({ map: bp }));
      bpm.rotation.x = -Math.PI / 2; bpm.position.set(6.5, 0.97, 2.5); D.group.add(bpm);
      // cones, capacetes, tijolos
      [[-8.5, 5], [-7.2, 6], [-9, 2.8]].forEach(([x, z]) => {
        U.mesh(U.geo("cone", () => new THREE.ConeGeometry(0.32, 0.9, 14)), U.mat("#FF6B1A"), x, 0.45, z, D.group);
        D.col.addCentered(x, z, 0.7, 0.7);
      });
      sideBox(D, RW - 1, -5, 1.2, 2.6, 3, "#8C6239");
      [-6, -5, -4].forEach((z) => U.mesh(U.geo("helm", () => new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), U.mat("#FFD21F"), RW - 1, 2.6, z, D.group));
      for (let i = 0; i < 8; i++) U.mesh(U.box(0.6, 0.3, 0.3), U.mat("#B5553A"), -9 + (i % 4) * 0.62, 0.15 + Math.floor(i / 4) * 0.31, -6.5, D.group);
      D.col.addCentered(-8, -6.5, 2.6, 0.5);
      // andaime
      const sc = U.mat("#9AA0AA", { metalness: 0.5 });
      [[-RW + 0.8, -2], [-RW + 0.8, 0.5], [-RW + 2.2, -2], [-RW + 2.2, 0.5]].forEach(([x, z]) => U.mesh(U.cyl(0.06, 0.06, 4.5, 6), sc, x, 2.25, z, D.group));
      [1.5, 3].forEach((y) => U.mesh(U.box(1.6, 0.08, 2.8), U.mat("#C49A5A"), -RW + 1.5, y, -0.75, D.group));
      D.col.addCentered(-RW + 1.5, -0.75, 1.8, 3);
    },
    dados(D) {
      wallScreen(D, screenTex("despesas.csv", "csv", "#14A44D"), -6, 3.8, -RD + 0.15, 4.6, 2.9);
      wallScreen(D, screenTex("PAINEL DE DADOS", "bars", "#1E6FD9"), 6, 3.8, -RD + 0.15, 4.6, 2.9);
      wallScreen(D, screenTex("SÉRIE HISTÓRICA", "line", "#14A44D"), -RW + 0.15, 3.4, -1, 5, 3.1, Math.PI / 2);
      // escultura de cubos de dados
      const cubes = new THREE.Group(); cubes.position.set(6.8, 0, 3); D.group.add(cubes);
      const cols = ["#14A44D", "#1E6FD9", "#FFC83D", "#E2574C", "#7A4DD8", "#0E9F8E"];
      for (let i = 0; i < 9; i++) {
        const c = U.mesh(U.box(0.7, 0.7, 0.7), U.mat(cols[i % 6], { emissive: cols[i % 6], emissiveIntensity: 0.15 }), (i % 3 - 1) * 0.8, 0.4 + Math.floor(i / 3) * 0.8, 0, cubes);
        D.anim.push((dt, t) => { c.position.y = 0.4 + Math.floor(i / 3) * 0.8 + Math.sin(t * 2 + i) * 0.06; c.rotation.y = Math.sin(t + i) * 0.3; });
      }
      D.col.addCentered(6.8, 3, 2.6, 1.2);
      // pufes
      [[-7, 4], [-8.4, 5.3], [-6, 5.8]].forEach(([x, z], i) => {
        U.mesh(U.sph(0.6, 14, 10), U.mat(cols[i + 1]), x, 0.4, z, D.group).scale.set(1, 0.65, 1);
        D.col.addCentered(x, z, 1.1, 1.1);
      });
      sideBox(D, RW - 1, -2, 1.4, 3.4, 2.4, "#1E2433");
    },
  };
})();
