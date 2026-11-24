/* =====================================================================
 * CIDADE 3D
 * ---------------------------------------------------------------------
 * A cidade é uma grade 3 x 3 de bairros (72 x 72 unidades cada).
 * Cada bairro tem um cruzamento de ruas e quatro quarteirões.
 * Entre os bairros há fileiras de prédios que funcionam como muralhas;
 * a passagem entre bairros consecutivos da jornada é uma rua fechada
 * por um PORTÃO (cancela + cones + grade), que abre ao concluir o prédio.
 *
 *   Ordem da jornada (serpentina):
 *     [1 Portal] → [2 LAI]   → [3 Ouvidoria]
 *                                   ↓
 *     [6 Licit.] ← [5 LGPD]  ← [4 Controle]
 *        ↓
 *     [7 Obras]  → [8 Dados] → [★ Torre/Boss]
 *
 * Coordenadas: X para leste, Z para sul (no minimapa, -Z fica em cima).
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U;
  const S = 72;          // tamanho do bairro
  const IN = 31;         // meia-largura útil do bairro
  const RD = 5;          // meia-largura da rua
  const ROW = 5;         // meia-espessura das fileiras de prédios (muralhas)
  const EDGE = 108;      // limite da cidade (eixo das fileiras externas)
  const CURB = 0.12;     // altura das calçadas

  // posição (coluna, linha) de cada etapa na grade — índice 8 = chefe final
  const ZONE_GRID = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2]];
  // quadra onde fica o prédio temático de cada bairro (sinal X, sinal Z)
  const BUILDING_QUAD = [[1, -1], [-1, 1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, -1], [1, 1]];
  const STREETS = ["Rua da Integridade", "Av. da Cidadania", "Rua da Publicidade", "Av. do Controle Social",
    "Alameda da Ética", "Rua das Contas Abertas", "Rua da Participação", "Av. da Informação", "Praça do Guardião"];

  CT.WORLD_CONST = { S, IN, RD, ROW, EDGE, ZONE_GRID };

  CT.buildCity = function (scene) {
    const rand = U.rng(20241118);
    const W = {
      scene, colliders: new U.Colliders(), raised: [], cameraBlockers: [],
      buildings: [], gates: [], animated: [], pedestrians: [], minimap: { rows: [], quads: [], plazas: [] },
      zones: ZONE_GRID.map(([c, r]) => ({ c, r, x: (c - 1) * S, z: (r - 1) * S })),
    };
    const batch = new U.InstanceBatch();
    const root = new THREE.Group(); scene.add(root); W.root = root;

    /* ---------------- céu, luz, névoa, tempo e clima (atmosphere.js) ---------------- */
    const atm = CT.createAtmosphere(scene, W); W.atm = atm;
    const KAY = CT.MODELOS && CT.MODELOS.objetos ? CT.MODELOS.objetos : {};
    const has = (f) => CT.Assets && f && CT.Assets.has(f);

    /* ---------------- chão da cidade (asfalto) ---------------- */
    const asphaltTex = U.canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#4B5162"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},255,${rand() * 0.05})`; ctx.fillRect(rand() * w, rand() * h, 2, 2); }
    }, true);
    asphaltTex.repeat.set(60, 60);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * EDGE + 20, 2 * EDGE + 20), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    atm.wetMat(floor.material, { wetRough: 0.3, env: 0.45, wetColor: new THREE.Color(0.55, 0.56, 0.6) });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), U.mat("#9CC98A", { roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; root.add(grass);
    atm.grassMat(grass.material, "field");

    /* ---------------- materiais comuns ---------------- */
    const tileTex = U.canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = "#E4DED3"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(120,110,95,0.35)"; ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 64, 64); ctx.strokeRect(64, 0, 64, 64); ctx.strokeRect(0, 64, 64, 64); ctx.strokeRect(64, 64, 64, 64);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(4, 4, 56, 4); ctx.fillRect(68, 68, 56, 4);
    }, true);
    const curbM = U.mat("#B9B4AA");
    const sidewalkM = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.9 });
    atm.wetMat(sidewalkM, { wetRough: 0.45, env: 0.45, wetColor: new THREE.Color(0.78, 0.78, 0.8) });
    const white = U.mat("#F5F5F0", { roughness: 0.6 });
    const yellowLine = U.mat("#FFC83D", { roughness: 0.6 });

    /* =================================================================
     * FUNÇÕES DE CONSTRUÇÃO
     * =============================================================== */

    function inst(geo, mat, x, y, z, rx, ry, rz, sx, sy, sz, shadow) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
        new THREE.Vector3(sx || 1, sy || 1, sz || 1));
      batch.addMatrix(geo, mat, m, shadow);
    }
    const UNIT = new THREE.BoxGeometry(1, 1, 1);
    const UNITP = new THREE.PlaneGeometry(1, 1);
    function slab(x, y, z, w, h, d, mat, ry, shadow) { inst(UNIT, mat, x, y, z, 0, ry || 0, 0, w, h, d, shadow); }
    function decal(x, z, w, d, mat, ry, y) { inst(UNITP, mat, x, y || 0.012, z, -Math.PI / 2, 0, ry || 0, w, d, 1, false); }
    /* objeto 3D externo (KayKit) como instância; devolve false se não houver */
    function prop(file, fit, x, y, z, ry) {
      if (!has(file)) return false;
      const pp = CT.Assets.propParts(file, fit);
      const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(1, 1, 1));
      pp.parts.forEach((pt) => batch.addMatrix(pt.geo, pt.mat, base.clone().multiply(pt.matrix)));
      return pp;
    }
    // caixa de colisão girada em múltiplos de 90°
    function colRot(x, z, w, d, ry, tag) {
      const q = Math.round(((ry || 0) / (Math.PI / 2))) % 2 !== 0;
      return W.colliders.addCentered(x, z, q ? d : w, q ? w : d, tag);
    }

    /* ---------- Bairro comum ---------- */
    function buildZone(z, zi) {
      const bq = BUILDING_QUAD[zi];
      const kinds = ["park", "plaza", "parking", "shops"];
      // embaralha com semente
      for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
      let ki = 0;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const Q = quad(z, sx, sz);
        if (sx === bq[0] && sz === bq[1]) buildThemedBuilding(Q, zi);
        else {
          const kind = kinds[ki++];
          W.minimap.quads.push({ x0: Q.x0, x1: Q.x1, z0: Q.z0, z1: Q.z1, kind });
          if (kind === "park") buildPark(Q);
          else if (kind === "plaza") buildPlaza(Q);
          else if (kind === "parking") buildParking(Q);
          else buildShops(Q);
        }
        buildStreetFurniture(Q, sx === bq[0] && sz === bq[1]);
      });
      buildRoadMarkings(z, zi);
      // placa com nome das ruas no cruzamento
      // recuada da esquina, para o semáforo (em u = v = 0,8) não ficar na frente das placas
      streetSign(z.x + RD + 2.7, z.z - RD - 2.7, STREETS[zi], STREETS[(zi + 3) % STREETS.length]);
      // pedestres que circulam
      addPedestrian(z.x - RD - 2.6, z.z + RD + 4, z.x - RD - 2.6, z.z + IN - 4);
      addPedestrian(z.x + RD + 4, z.z + RD + 2.6, z.x + IN - 4, z.z + RD + 2.6);
      if (zi % 2 === 0) addPedestrian(z.x + RD + 2.6, z.z - IN + 4, z.x + RD + 2.6, z.z - RD - 4);
      if (zi === 0) buildWelcomeArch(z);
    }

    /* Quadra: devolve conversor de coordenadas locais (u,v) → mundo. */
    function quad(z, sx, sz) {
      const ox = z.x + sx * RD, oz = z.z + sz * RD;
      const Q = {
        sx, sz, ox, oz, zone: z,
        x0: Math.min(ox, ox + sx * 26), x1: Math.max(ox, ox + sx * 26),
        z0: Math.min(oz, oz + sz * 26), z1: Math.max(oz, oz + sz * 26),
        wx: (u) => ox + sx * u, wz: (v) => oz + sz * v,
      };
      // calçada elevada (com meio-fio)
      const g = U.boxWorldUV(26, CURB, 26, 3, 3);
      const m = new THREE.Mesh(g, [curbM, curbM, sidewalkM, curbM, curbM, curbM]);
      m.position.set((Q.x0 + Q.x1) / 2, CURB / 2, (Q.z0 + Q.z1) / 2); m.receiveShadow = true; root.add(m);
      W.raised.push({ x0: Q.x0, x1: Q.x1, z0: Q.z0, z1: Q.z1 });
      return Q;
    }

    /* ---------- Prédio temático ---------- */
    function buildThemedBuilding(Q, idx) {
      const def = CT.PREDIOS[idx];
      if (def.modelo3d === "prefeitura" && CT.Prefeitura) return buildPrefeituraBuilding(Q, idx, CT.Prefeitura);
      if (def.modelo3d === "ouvidoria" && CT.Ouvidoria) return buildPrefeituraBuilding(Q, idx, CT.Ouvidoria);
      const cx = Q.wx(13.5), cz = Q.wz(13.5);
      const ry = Q.sz < 0 ? 0 : Math.PI; // fachada voltada para a rua horizontal
      const g = new THREE.Group(); g.position.set(cx, CURB, cz); g.rotation.y = ry; root.add(g);
      const Wd = 16, D = 13, H = 11 + (idx % 3) * 2;

      // corpo principal com janelas
      const wall = U.shade(def.cor, 0.1);
      const fstyle = idx % 2 ? "tall" : "band";
      const tex = U.facadeTex(wall, "#BFE3FF", fstyle);
      const bodyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: "#FFFFFF", emissiveMap: U.facadeLit(fstyle, 300 + idx), emissiveIntensity: 0 });
      atm.windowMat(bodyMat);
      const roofMat = U.mat(U.shade(def.cor, -0.35));
      const body = new THREE.Mesh(U.facadeBox(Wd, H, D, 4, 3.5), [bodyMat, bodyMat, roofMat, roofMat, bodyMat, bodyMat]);
      body.position.y = H / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      W.cameraBlockers.push(body);
      // platibanda / cobertura
      U.mesh(U.box(Wd + 0.6, 0.7, D + 0.6), U.mat(U.shade(def.cor, -0.2)), 0, H + 0.35, 0, g);
      // base de pedra
      U.mesh(U.box(Wd + 0.3, 1.1, D + 0.3), U.mat("#D8D2C6"), 0, 0.55, 0, g);
      // pórtico de entrada
      const accent = U.mat(def.destaque);
      const portM = U.mat("#F7F5F0");
      [-3.2, 3.2].forEach((x) => U.mesh(U.cyl(0.32, 0.36, 4.4, 14), portM, x, 2.2, D / 2 + 1.6, g));
      U.mesh(U.box(8.4, 0.5, 3.6), U.mat(def.cor), 0, 4.6, D / 2 + 1.3, g);
      U.mesh(U.box(8.6, 0.16, 3.8), accent, 0, 4.9, D / 2 + 1.3, g);
      // porta de vidro iluminada
      const doorM = new THREE.MeshStandardMaterial({ color: "#CFEFFF", emissive: "#7FD3FF", emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.3 });
      U.mesh(U.box(3.6, 3.4, 0.2), doorM, 0, 1.75, D / 2 + 0.06, g);
      U.mesh(U.box(0.12, 3.4, 0.24), U.mat("#2B2F3A"), 0, 1.75, D / 2 + 0.1, g);
      U.mesh(U.box(4, 0.25, 0.3), U.mat("#2B2F3A"), 0, 3.5, D / 2 + 0.1, g);
      // degraus
      U.mesh(U.box(7, 0.06, 1.2), U.mat("#CFC8BB"), 0, 0.03, D / 2 + 3.4, g);
      U.mesh(U.box(7, 0.12, 1.4), U.mat("#DAD3C7"), 0, 0.06, D / 2 + 2.3, g);
      // letreiro com número da etapa
      const signM = new THREE.MeshBasicMaterial({ map: U.signTex(def.nome, { bg: def.cor, fg: "#FFFFFF", badge: String(idx + 1), font: 104, border: "#FFFFFF" }), transparent: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signM);
      sign.position.set(0, H - 2.2, D / 2 + 0.08); g.add(sign);
      // faixa lateral com cor do tema
      [-1, 1].forEach((s) => U.mesh(U.box(0.3, H, 2.2), U.mat(def.cor), s * (Wd / 2 + 0.05), H / 2, D / 2 - 1.2, g));
      // jardineiras ao lado da entrada
      [-1, 1].forEach((s) => {
        U.mesh(U.box(2.2, 0.7, 1.2), U.mat("#9A8F80"), s * 5.6, 0.35, D / 2 + 1.2, g);
        U.mesh(U.sph(0.7, 10, 8), U.mat("#4FA85A"), s * 5.6, 1.0, D / 2 + 1.2, g).scale.set(1.4, 0.7, 0.8);
      });

      // símbolo no telhado
      const prop = buildRoofProp(def, H, g);

      // marcador flutuante + feixe de luz + anel no chão
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.markerTex("lock"), depthTest: true }));
      marker.scale.set(3.4, 3.4, 1); marker.position.set(0, H + 9.5, 0); g.add(marker);
      const beamM = new THREE.MeshBasicMaterial({ color: "#FFC83D", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 70, 20, 1, true), beamM);
      beam.position.set(0, H + 35, 0); g.add(beam);
      const ringM = new THREE.MeshBasicMaterial({ color: "#FFC83D", transparent: true, opacity: 0.7, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), ringM);
      ring.rotation.x = -Math.PI / 2;
      const doorWorld = { x: Q.wx(13.5), z: Q.wz(7) };
      const trig = { x: Q.wx(13.5), z: Q.wz(3.6) };
      ring.position.set(trig.x, CURB + 0.03, trig.z); root.add(ring);

      // colisão (corpo + pórtico + jardineiras)
      W.colliders.addBox(Q.wx(5.5) < Q.wx(21.5) ? Q.wx(5.5) : Q.wx(21.5), Math.max(Q.wx(5.5), Q.wx(21.5)),
        Math.min(Q.wz(7), Q.wz(20)), Math.max(Q.wz(7), Q.wz(20)), "building");
      [-3.2, 3.2].forEach((lx) => {
        const wx = cx + (ry === 0 ? lx : -lx), wz = cz + (ry === 0 ? 1 : -1) * (D / 2 + 1.6);
        W.colliders.addCentered(wx, wz, 0.8, 0.8);
      });
      [-5.6, 5.6].forEach((lx) => W.colliders.addCentered(cx + lx, cz + (ry === 0 ? 1 : -1) * (D / 2 + 1.2), 2.2, 1.2));

      // árvores atrás do prédio
      for (let i = 0; i < 3; i++) tree(Q.wx(6 + i * 7.5), Q.wz(23), 0.9 + rand() * 0.3);

      const b = {
        def, index: idx, zoneIndex: idx, center: { x: cx, z: cz }, door: doorWorld, trigger: trig,
        rect: { x0: Math.min(Q.wx(5.5), Q.wx(21.5)), x1: Math.max(Q.wx(5.5), Q.wx(21.5)), z0: Math.min(Q.wz(7), Q.wz(20)), z1: Math.max(Q.wz(7), Q.wz(20)) },
        facing: ry === 0 ? 1 : -1, // direção (em Z) da porta para a rua
        status: "locked", marker, beam, ring, prop, group: g, height: H,
      };
      b.setStatus = function (st) {
        b.status = st;
        marker.material.map = U.markerTex(st === "locked" ? "lock" : st === "done" ? "done" : "go");
        marker.material.needsUpdate = true;
        beam.visible = st === "available";
        ring.visible = st === "available";
      };
      b.setStatus("locked");
      W.buildings.push(b);
      W.animated.push((dt, t) => {
        marker.position.y = H + 9.5 + Math.sin(t * 2 + idx) * 0.5;
        if (b.status === "available") {
          ringM.opacity = 0.45 + Math.sin(t * 4) * 0.3;
          ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
          beamM.opacity = 0.16 + Math.sin(t * 2) * 0.06;
        }
        if (prop) prop.rotation.y += dt * 0.5;
      });
    }

    /* Prédios modelados a partir de fotos — 1: sede da Prefeitura (js/prefeitura.js);
     * 3: Ouvidoria Geral (js/ouvidoria.js) — com o mesmo marcador, feixe de luz
     * e anel de chegada dos outros prédios. */
    function buildPrefeituraBuilding(Q, idx, M) {
      const def = CT.PREDIOS[idx];
      const cx = Q.wx(13.5), cz = Q.wz(13.5);
      const ry = Q.sz < 0 ? 0 : Math.PI;
      const P = M.build({ atm, def });
      const g = P.group; g.position.set(cx, CURB, cz); g.rotation.y = ry; root.add(g);
      W.cameraBlockers.push(P.body);
      const H = P.height, f = ry === 0 ? 1 : -1;
      const toW = (lx, lz) => ({ x: cx + f * lx, z: cz + f * lz });
      P.boxes.forEach(([x0, x1, z0, z1]) => {
        const a = toW(x0, z0), b = toW(x1, z1);
        W.colliders.addBox(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), "building");
      });
      const doorWorld = toW(P.door.x, P.door.z), trig = toW(P.trigger.x, P.trigger.z);

      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.markerTex("lock"), depthTest: true }));
      marker.scale.set(3.4, 3.4, 1); marker.position.set(0, H + 9.5, 0); g.add(marker);
      const beamM = new THREE.MeshBasicMaterial({ color: "#FFC83D", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 70, 20, 1, true), beamM);
      beam.position.set(0, H + 35, 0); g.add(beam);
      const ringM = new THREE.MeshBasicMaterial({ color: "#FFC83D", transparent: true, opacity: 0.7, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), ringM);
      ring.rotation.x = -Math.PI / 2; ring.position.set(trig.x, CURB + 0.03, trig.z); root.add(ring);

      for (let i = 0; i < 3; i++) tree(Q.wx(6 + i * 7.5), Q.wz(23), 0.9 + rand() * 0.3);
      // o Prefeito, no patamar da entrada, acena para quem chega
      let pref = null;
      if (P.prefeito && CT.PREFEITO && CT.createPedestrian) {
        const ch = CT.createPedestrian({ modelo: CT.PREFEITO.modelo });
        const pw = toW(P.prefeito.x, P.prefeito.z), base = ry;   // de frente para a rua
        ch.root.position.set(pw.x, CURB + P.patamar, pw.z); ch.root.rotation.y = base;
        root.add(ch.root);
        pref = { ch, x: pw.x, z: pw.z, base, t: 1.5 };
        W.prefeito = pref;
      }

      const hw = M.largura / 2, hd = M.profundidade / 2;
      const r0 = toW(-hw, -hd), r1 = toW(hw, hd);
      const b = {
        def, index: idx, zoneIndex: idx, center: { x: cx, z: cz }, door: doorWorld, trigger: trig,
        rect: { x0: Math.min(r0.x, r1.x), x1: Math.max(r0.x, r1.x), z0: Math.min(r0.z, r1.z), z1: Math.max(r0.z, r1.z) },
        facing: f, status: "locked", marker, beam, ring, prop: null, group: g, height: H,
      };
      b.setStatus = function (st) {
        b.status = st;
        marker.material.map = U.markerTex(st === "locked" ? "lock" : st === "done" ? "done" : "go");
        marker.material.needsUpdate = true;
        beam.visible = st === "available";
        ring.visible = st === "available";
      };
      b.setStatus("locked");
      W.buildings.push(b);
      W.animated.push((dt, t) => {
        marker.position.y = H + 9.5 + Math.sin(t * 2 + idx) * 0.5;
        if (b.status === "available") {
          ringM.opacity = 0.45 + Math.sin(t * 4) * 0.3;
          ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
          beamM.opacity = 0.16 + Math.sin(t * 2) * 0.06;
        }
        // bandeiras balançando (só com o jogador por perto, para poupar desempenho)
        const pp = W.lastPlayerPos;
        P.update(dt, t, !pp || Math.hypot(pp.x - cx, pp.z - cz) < 90);
        // Prefeito: vira para o jogador quando ele chega perto e acena de tempos em tempos
        if (pref) {
          const ch = pref.ch, d = pp ? Math.hypot(pp.x - pref.x, pp.z - pref.z) : 99;
          ch.root.visible = d < 80;
          if (ch.root.visible) {
            let want = pref.base;
            if (pp && d < 18) want = Math.atan2(pp.x - pref.x, pp.z - pref.z);
            ch.root.rotation.y += U.angleDiff(ch.root.rotation.y, want) * Math.min(1, dt * 3);
            pref.t += dt;
            if (ch.mode !== "wave" && pref.t > (d < 18 ? 2.2 : 4.5)) { ch.mode = "wave"; pref.t = 0; }
            if (ch.mode === "wave") pref.t = 0;
            ch.speed = 0;
            ch.update(dt);
          }
        }
      });
    }

    /* Símbolo 3D no telhado, ligado ao tema. */
    function buildRoofProp(def, H, g) {
      const p = new THREE.Group(); p.position.y = H + 0.7; g.add(p);
      const c = U.mat(def.cor), d = U.mat(def.destaque), w = U.mat("#FFFFFF"), gold = U.mat("#FFC83D", { metalness: 0.5, roughness: 0.35 });
      switch (def.decoracao) {
        case "portal": {
          const coin = U.mesh(U.cyl(2, 2, 0.5, 32), gold, 0, 3.2, 0, p); coin.rotation.x = Math.PI / 2;
          const cs = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: U.signTex("R$", { w: 256, h: 256, bg: "rgba(0,0,0,0)", fg: "#9A6A00", font: 150 }), transparent: true }));
          cs.position.set(0, 3.2, 0.27); p.add(cs);
          const cs2 = cs.clone(); cs2.rotation.y = Math.PI; cs2.position.z = -0.27; p.add(cs2);
          U.mesh(U.cyl(0.25, 0.25, 1.2, 8), U.mat("#8A8A8A"), 0, 0.6, 0, p);
          break;
        }
        case "lai": {
          U.mesh(U.cyl(2.2, 2.2, 0.4, 32), c, 0, 3.4, 0, p).rotation.x = Math.PI / 2;
          U.mesh(U.box(0.6, 2, 0.6), w, 0, 3.1, 0.1, p);
          U.mesh(U.sph(0.42, 14, 10), w, 0, 4.6, 0.1, p);
          U.mesh(U.cyl(0.25, 0.25, 1.2, 8), U.mat("#8A8A8A"), 0, 0.6, 0, p);
          break;
        }
        case "ouvidoria": {
          const bub = U.mesh(U.sph(2, 20, 14), w, 0, 3.6, 0, p); bub.scale.set(1.3, 0.9, 0.6);
          const tail = U.mesh(U.cyl(0, 0.7, 1.4, 8), w, -1.2, 2.2, 0, p); tail.rotation.z = -0.6;
          [-0.9, 0, 0.9].forEach((x) => U.mesh(U.sph(0.3, 10, 8), c, x, 3.6, 1.2, p));
          [-0.9, 0, 0.9].forEach((x) => U.mesh(U.sph(0.3, 10, 8), c, x, 3.6, -1.2, p));
          break;
        }
        case "controle": {
          const ringG = new THREE.TorusGeometry(1.6, 0.32, 10, 32);
          const r = U.mesh(ringG, d.color ? c : c, 0, 4, 0, p);
          const lens = U.mesh(U.cyl(1.5, 1.5, 0.1, 30), new THREE.MeshStandardMaterial({ color: "#BFE9FF", transparent: true, opacity: 0.5, roughness: 0.05 }), 0, 4, 0, p);
          lens.rotation.x = Math.PI / 2;
          const h = U.mesh(U.cyl(0.3, 0.35, 2.4, 10), U.mat("#3A2E3F"), 1.9, 2.1, 0, p); h.rotation.z = 0.75;
          break;
        }
        case "lgpd": {
          U.mesh(U.box(3, 2.4, 1.2), c, 0, 2.6, 0, p);
          const sh = U.mesh(new THREE.TorusGeometry(1, 0.28, 10, 24, Math.PI), U.mat("#C9D3E6", { metalness: 0.6, roughness: 0.3 }), 0, 3.8, 0, p);
          U.mesh(U.sph(0.35, 10, 8), U.mat(def.destaque, { emissive: def.destaque, emissiveIntensity: 0.8 }), 0, 2.7, 0.65, p);
          break;
        }
        case "licitacoes": {
          const head = U.mesh(U.cyl(0.8, 0.8, 3, 18), U.mat("#7A4A22"), 0, 4.2, 0, p); head.rotation.z = Math.PI / 2;
          [-1.5, 1.5].forEach((x) => { const b = U.mesh(U.cyl(0.85, 0.85, 0.25, 18), gold, x, 4.2, 0, p); b.rotation.z = Math.PI / 2; });
          U.mesh(U.cyl(0.25, 0.25, 3, 10), U.mat("#5A3418"), 0, 2.4, 0, p);
          U.mesh(U.box(3.2, 0.5, 2), U.mat("#5A3418"), 0, 0.25, 0, p);
          break;
        }
        case "obras": {
          const y = U.mat("#FFC21A");
          U.mesh(U.box(0.8, 9, 0.8), y, -4, 4.5, -2, p);
          U.mesh(U.box(10, 0.6, 0.6), y, -1.5, 9, -2, p);
          U.mesh(U.box(1.6, 1.2, 1.2), U.mat("#3A3A3A"), -6.5, 8.8, -2, p);
          U.mesh(U.cyl(0.03, 0.03, 3.5, 4), U.mat("#222"), 2.5, 7.2, -2, p, false);
          U.mesh(U.box(0.8, 0.5, 0.8), U.mat("#C0392B"), 2.5, 5.4, -2, p);
          U.mesh(U.box(1.6, 1.4, 1.6), U.mat("#2D78C4"), -4, 9.4, -2, p);
          p.userData.noSpin = true;
          break;
        }
        case "dados": {
          const cols = ["#14A44D", "#1E6FD9", "#FFC83D", "#E2574C", "#7A4DD8"];
          [1.2, 2.2, 3.4, 2.6, 4.2].forEach((h, i) => U.mesh(U.box(0.8, h, 0.8), U.mat(cols[i]), -2 + i, h / 2 + 0.3, 0, p));
          U.mesh(U.box(5.4, 0.3, 1.4), U.mat("#E8EEF5"), 0, 0.15, 0, p);
          break;
        }
      }
      return p.userData.noSpin ? null : p;
    }

    /* ---------- Parque ---------- */
    function buildPark(Q) {
      const grassM = U.mat("#7DBE6A", { roughness: 1 });
      atm.grassMat(grassM, "park");
      const pathM = U.mat("#E7D9B8", { roughness: 1 });
      slab((Q.x0 + Q.x1) / 2, CURB + 0.03, (Q.z0 + Q.z1) / 2, 21.5, 0.06, 21.5, grassM, 0, false);
      // caminhos em cruz
      decal((Q.x0 + Q.x1) / 2, (Q.z0 + Q.z1) / 2, 21.5, 2.4, pathM, 0, CURB + 0.07);
      decal((Q.x0 + Q.x1) / 2, (Q.z0 + Q.z1) / 2, 2.4, 21.5, pathM, 0, CURB + 0.07);
      const cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2;
      fountain(cx, cz);
      // árvores nos cantos do gramado
      [[5.5, 5.5], [21, 5.5], [5.5, 21], [21, 21], [9, 18], [18, 9]].forEach(([u, v]) => tree(Q.wx(u), Q.wz(v), 0.9 + rand() * 0.5, rand() > 0.6 ? "pine" : "round"));
      // bancos ao longo dos caminhos
      bench(cx + 5.5, cz + 2.1, 0); bench(cx - 5.5, cz - 2.1, Math.PI);
      bench(cx + 2.1, cz - 5.5, Math.PI / 2); bench(cx - 2.1, cz + 5.5, -Math.PI / 2);
      // canteiros de flores
      [[8, 13.5], [19, 13.5]].forEach(([u, v]) => flowers(Q.wx(u), Q.wz(v)));
      // flores espalhadas pelo gramado (aparecem na primavera e no verão)
      for (let i = 0; i < 9; i++) {
        let u = 3 + rand() * 21, v = 3 + rand() * 21;
        if (Math.abs(u - 13.5) < 3.5 || Math.abs(v - 13.5) < 3.5) continue;
        flowerPatch(Q.wx(u), Q.wz(v));
      }
    }

    function fountain(x, z) {
      const stone = U.mat("#CFC6B6");
      slab(x, CURB + 0.35, z, 5.4, 0.7, 5.4, stone);
      const water = new THREE.Mesh(U.box(4.6, 0.1, 4.6), new THREE.MeshStandardMaterial({ color: "#5FC4F0", roughness: 0.1, metalness: 0.2, emissive: "#1A6E9A", emissiveIntensity: 0.25 }));
      water.position.set(x, CURB + 0.66, z); root.add(water);
      U.mesh(U.cyl(0.35, 0.5, 1.8, 12), stone, x, CURB + 1.2, z, root);
      U.mesh(U.cyl(1.2, 0.6, 0.3, 16), stone, x, CURB + 2.1, z, root);
      const jet = new THREE.Mesh(U.cyl(0.08, 0.25, 1.2, 8), new THREE.MeshStandardMaterial({ color: "#BDEBFF", transparent: true, opacity: 0.7, emissive: "#6CCBFF", emissiveIntensity: 0.3 }));
      jet.position.set(x, CURB + 2.8, z); root.add(jet);
      W.animated.push((dt, t) => { jet.scale.y = 1 + Math.sin(t * 6 + x) * 0.25; });
      W.colliders.addCentered(x, z, 5.4, 5.4, "fountain");
    }

    // materiais exclusivos das flores (somem no outono e no inverno)
    const FLOWER_MATS = ["#FF5A7A", "#FFC83D", "#B65CFF", "#FF8A3D", "#FFFFFF"].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, transparent: true });
      atm.flowerMat(m); return m;
    });
    function flowers(x, z) {
      slab(x, CURB + 0.2, z, 3, 0.4, 1.4, U.mat("#9A7B5B"));
      for (let i = 0; i < 9; i++) inst(U.sph(0.18, 8, 6), FLOWER_MATS[i % 5], x - 1.2 + (i % 5) * 0.6, CURB + 0.5, z - 0.35 + Math.floor(i / 5) * 0.7, 0, 0, 0, 1, 1, 1, false);
      W.colliders.addCentered(x, z, 3, 1.4);
    }
    function flowerPatch(x, z) {
      const m = FLOWER_MATS[Math.floor(rand() * FLOWER_MATS.length)];
      for (let i = 0; i < 6; i++) inst(U.sph(0.15, 6, 5), m, x + (rand() - 0.5) * 1.6, CURB + 0.16, z + (rand() - 0.5) * 1.6, 0, 0, 0, 1, 0.7, 1, false);
    }

    /* ---------- Praça ---------- */
    function buildPlaza(Q) {
      const cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2;
      const plazaTex = U.canvasTex(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#EFE6D6"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#D7C8AE"; ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
      }, true);
      plazaTex.repeat.set(6, 6);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(21.5, 21.5), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
      pm.rotation.x = -Math.PI / 2; pm.position.set(cx, CURB + 0.015, cz); pm.receiveShadow = true; root.add(pm);
      // monumento "olho da transparência": pedestal + cubo de vidro
      slab(cx, CURB + 0.6, cz, 3, 1.2, 3, U.mat("#B8AE9E"));
      const glass = new THREE.Mesh(U.box(2, 2, 2), new THREE.MeshStandardMaterial({ color: "#9FE3FF", transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2, emissive: "#3FB6E8", emissiveIntensity: 0.25 }));
      glass.position.set(cx, CURB + 2.6, cz); glass.rotation.set(0.6, 0.6, 0); root.add(glass);
      W.animated.push((dt) => { glass.rotation.y += dt * 0.6; });
      W.colliders.addCentered(cx, cz, 3, 3);
      // bancos ao redor
      bench(cx, cz + 4.5, 0); bench(cx, cz - 4.5, Math.PI); bench(cx + 4.5, cz, Math.PI / 2); bench(cx - 4.5, cz, -Math.PI / 2);
      // árvores em vasos
      [[5, 5], [22, 5], [5, 22], [22, 22]].forEach(([u, v]) => {
        slab(Q.wx(u), CURB + 0.35, Q.wz(v), 2, 0.7, 2, U.mat("#9A8F80")); tree(Q.wx(u), Q.wz(v), 0.8, "round", 0.7);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; inst(U.sph(0.15, 6, 5), FLOWER_MATS[i % 5], Q.wx(u) + Math.cos(a) * 0.75, CURB + 0.78, Q.wz(v) + Math.sin(a) * 0.75, 0, 0, 0, 1, 1, 1, false); }
      });
      // banca de jornal
      kiosk(Q.wx(20), Q.wz(13.5), Q.sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    }

    function kiosk(x, z, ry) {
      slab(x, CURB + 1.2, z, 2.8, 2.4, 2.2, U.mat("#2F7D5B"), ry);
      slab(x, CURB + 2.55, z, 3.4, 0.3, 2.8, U.mat("#FFC83D"), ry);
      colRot(x, z, 2.8, 2.2, ry);
    }

    /* ---------- Estacionamento ---------- */
    function buildParking(Q) {
      const cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2;
      const lot = U.mat("#5A6070", { roughness: 0.95 });
      slab(cx, CURB + 0.02, cz, 21, 0.04, 21, lot, 0, false);
      const colors = ["#E2574C", "#1E6FD9", "#F4F4F4", "#FFC83D", "#2F3B4F", "#14A44D", "#B0B7C3", "#7A4DD8"];
      // duas fileiras de vagas (carros apontando para o centro)
      for (let row = 0; row < 2; row++) {
        const vz = row === 0 ? 7.5 : 19.5;
        for (let i = 0; i < 6; i++) {
          const u = 5 + i * 3.4;
          decal(Q.wx(u - 1.7), Q.wz(vz), 0.14, 5, white, 0, CURB + 0.05);
          if (rand() < 0.75) car(Q.wx(u), Q.wz(vz), (row === 0 ? 0 : Math.PI) + (Q.sz < 0 ? Math.PI : 0), colors[Math.floor(rand() * colors.length)]);
        }
      }
      // placa "E"
      const sm = new THREE.MeshBasicMaterial({ map: U.signTex("E", { w: 256, h: 256, bg: "#1D4E89", font: 170, radius: 30 }) });
      const pole = U.mesh(U.cyl(0.08, 0.08, 3, 8), U.mat("#8A8F99"), Q.wx(2), CURB + 1.5, Q.wz(13.5), root);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), sm); s.position.set(Q.wx(2), CURB + 3.1, Q.wz(13.5)); s.rotation.y = Q.sx > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(s);
      const s2 = s.clone(); s2.rotation.y += Math.PI; root.add(s2);
    }

    function car(x, z, ry, color) {
      const list = KAY.carros || [];
      const f = list[Math.floor(rand() * list.length)];
      if (prop(f, { comprimento: 4.3 }, x, CURB, z, ry)) { colRot(x, z, 2, 4.3, ry, "car"); return; }
      const body = U.mat(color, { roughness: 0.35, metalness: 0.25 });
      const glass = U.mat("#2A3B52", { roughness: 0.1, metalness: 0.5 });
      const y = CURB;
      const c = Math.cos(ry), s = Math.sin(ry);
      const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      let p = P(0, 0);
      inst(UNIT, body, p[0], y + 0.65, p[1], 0, ry, 0, 1.9, 0.7, 4.2);
      p = P(0, -0.3); inst(UNIT, glass, p[0], y + 1.25, p[1], 0, ry, 0, 1.7, 0.6, 2.2);
      p = P(0, -0.3); inst(UNIT, body, p[0], y + 1.58, p[1], 0, ry, 0, 1.72, 0.08, 2.1);
      [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]].forEach(([lx, lz]) => {
        const q = P(lx, lz); inst(U.cyl(0.38, 0.38, 0.3, 14), U.mat("#1B1E27"), q[0], y + 0.38, q[1], 0, ry, Math.PI / 2);
      });
      // faróis
      [[-0.6, 2.11], [0.6, 2.11]].forEach(([lx, lz]) => { const q = P(lx, lz); inst(UNIT, U.mat("#FFF6C8", { emissive: "#FFF0A0", emissiveIntensity: 0.6 }), q[0], y + 0.75, q[1], 0, ry, 0, 0.4, 0.2, 0.05, false); });
      colRot(x, z, 2, 4.3, ry, "car");
    }

    /* ---------- Lojas ---------- */
    const SHOP_NAMES = [["Padaria", "#E2574C"], ["Farmácia", "#14A44D"], ["Café", "#7A4A22"], ["Livraria", "#1E6FD9"], ["Mercado", "#F07D1A"], ["Floricultura", "#B65CFF"], ["Ótica", "#2D3E8F"], ["Casa de Festas", "#E83E8C"]];
    let shopI = 0;
    function buildShops(Q) {
      [[7.5, 9], [19.5, 9]].forEach(([u, w]) => {
        const [name, col] = SHOP_NAMES[shopI++ % SHOP_NAMES.length];
        const cx = Q.wx(u), cz = Q.wz(9.5);
        const ry = Q.sz < 0 ? 0 : Math.PI;
        const dir0 = ry === 0 ? 1 : -1;
        const shopFile = (KAY.lojas || [])[Math.floor(rand() * (KAY.lojas || []).length)];
        const kp = prop(shopFile, { largura: 9 }, cx, CURB, cz, ry);
        if (kp) {
          // letreiro sobre a porta
          const ss = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1), new THREE.MeshBasicMaterial({ map: U.signTex(name, { w: 768, h: 160, bg: col, font: name.length > 10 ? 78 : 100, radius: 20 }) }));
          ss.position.set(cx, CURB + Math.min(kp.size.y * 0.36, 4.2), cz + dir0 * (kp.size.z / 2 + 0.12)); ss.rotation.y = ry; root.add(ss);
          W.colliders.addCentered(cx, cz, 9, 8.6, "shop");
          if (name === "Casa de Festas") casaFestas(cx, cz, dir0, kp.size.z / 2);
          if (name === "Café" || name === "Padaria") {
            [-2.5, 2.5].forEach((dx) => { inst(U.cyl(0.6, 0.6, 0.08, 12), U.mat("#FFFFFF"), cx + dx, CURB + 0.9, cz + dir0 * 6.2); inst(U.cyl(0.06, 0.06, 0.9, 6), U.mat("#555"), cx + dx, CURB + 0.45, cz + dir0 * 6.2); });
          }
          return;
        }
        const H = 5 + rand() * 2.5;
        const wall = ["#F6E7CF", "#E9F0F6", "#F3D9D0", "#E0EEDB"][Math.floor(rand() * 4)];
        const tex = U.facadeTex(wall, "#9FD3F5", "band");
        const m = new THREE.MeshStandardMaterial({ map: tex });
        const b = new THREE.Mesh(U.facadeBox(9, H, 8, 4.5, 3.5), [m, m, U.mat("#B8B0A3"), m, m, m]);
        b.position.set(cx, CURB + H / 2, cz); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; root.add(b);
        W.cameraBlockers.push(b);
        const dir = ry === 0 ? 1 : -1;
        // toldo listrado
        const awn = U.canvasTex(128, 64, (ctx) => { for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#FFFFFF" : col; ctx.fillRect(i * 16, 0, 16, 64); } });
        const a = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.15, 2), new THREE.MeshStandardMaterial({ map: awn }));
        a.position.set(cx, CURB + 3.1, cz + dir * 4.9); a.rotation.y = ry; a.rotation.x = dir * 0.28; a.castShadow = true; root.add(a);
        // letreiro
        const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: U.signTex(name, { w: 768, h: 160, bg: col, font: 100, radius: 20 }) }));
        s.position.set(cx, CURB + Math.min(H - 0.8, 4.4), cz + dir * 4.02); s.rotation.y = ry; root.add(s);
        W.colliders.addCentered(cx, cz, 9, 8, "shop");
        if (name === "Casa de Festas") casaFestas(cx, cz, dir, 4);
        // mesinhas na calçada
        if (name === "Café" || name === "Padaria") {
          [-2.5, 2.5].forEach((dx) => { inst(U.cyl(0.6, 0.6, 0.08, 12), U.mat("#FFFFFF"), cx + dx, CURB + 0.9, cz + dir * 5.9); inst(U.cyl(0.06, 0.06, 0.9, 6), U.mat("#555"), cx + dx, CURB + 0.45, cz + dir * 5.9); });
        }
      });
      for (let i = 0; i < 3; i++) tree(Q.wx(5 + i * 8.5), Q.wz(21.5), 1 + rand() * 0.3);
    }

    /* Casa de Festas: área secreta (sem anel, sem seta e sem missão). Guarda a
     * porta para o jogo saber onde dá para entrar e põe dois cachos de balões
     * na fachada, a única pista de que ali tem festa. */
    function casaFestas(cx, cz, dir, half) {
      const fz = cz + dir * half;
      W.casaFestas = { door: { x: cx, z: fz }, trigger: { x: cx, z: fz + dir * 1.6 }, facing: dir, center: { x: cx, z: cz } };
      const cores = ["#FF4FA3", "#FFC83D", "#4FC3FF", "#3DDC84", "#B48CFF"];
      [-2.9, 2.9].forEach((dx, k) => {
        for (let i = 0; i < 5; i++) {
          const a = i * 1.25, r = i ? 0.32 : 0, x = cx + dx + Math.cos(a) * r, z = fz + dir * (0.45 + Math.sin(a) * 0.2), y = CURB + 2.5 + (i ? 0 : 0.45) + (i % 2) * 0.3;
          const b = new THREE.Mesh(U.geo("balao-rua", () => { const g = new THREE.SphereGeometry(0.28, 14, 10); g.scale(1, 1.18, 1); return g; }), U.mat(cores[(i + k) % 5], { roughness: 0.3 }));
          b.position.set(x, y, z); b.castShadow = true; root.add(b);
          W.animated.push((dt, t) => { b.position.y = y + Math.sin(t * 1.3 + i + k * 2) * 0.05; });
        }
        const fio = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx + dx, CURB + 2.2, fz + dir * 0.45), new THREE.Vector3(cx + dx, CURB + 1.2, fz + dir * 0.3)]), new THREE.LineBasicMaterial({ color: "#DDDDDD" }));
        root.add(fio);
      });
    }

    /* ---------- Mobiliário urbano ao longo das calçadas ---------- */
    function buildStreetFurniture(Q, isBuilding) {
      // postes de luz
      [[1, 8], [1, 18], [8, 1], [18, 1]].forEach(([u, v]) => {
        if (isBuilding && Math.abs(u - 13.5) < 6 && v < 3) return;
        lamp(Q.wx(u), Q.wz(v), u < v ? (Q.sx > 0 ? Math.PI : 0) : 0, u < v ? "x" : "z", Q);
      });
      // semáforo na esquina
      trafficLight(Q.wx(0.8), Q.wz(0.8), Q);
      // lixeira e hidrante
      if (prop(KAY.cacamba, { comprimento: 1.9 }, Q.wx(1.4), CURB, Q.wz(23.6), Q.sx > 0 ? 0 : Math.PI)) W.colliders.addCentered(Q.wx(1.4), Q.wz(23.6), 1.4, 2.0);
      else { inst(U.cyl(0.32, 0.28, 0.9, 10), U.mat("#2F7D5B"), Q.wx(1.2), CURB + 0.45, Q.wz(24)); W.colliders.addCentered(Q.wx(1.2), Q.wz(24), 0.7, 0.7); }
      if (!prop(KAY.hidrante, { altura: 0.8 }, Q.wx(24), CURB, Q.wz(1.1), 0)) inst(U.cyl(0.18, 0.22, 0.7, 10), U.mat("#E2574C"), Q.wx(24), CURB + 0.35, Q.wz(1.1));
      W.colliders.addCentered(Q.wx(24), Q.wz(1.1), 0.5, 0.5);
      if (!isBuilding) { tree(Q.wx(1.3), Q.wz(13), 0.75, "round", 0.7); tree(Q.wx(13), Q.wz(1.3), 0.75, "round", 0.7); }
    }

    const BULB = U.mat("#FFF4D2", { emissive: "#FFE9A8", emissiveIntensity: 0.9 });
    atm.bulbMat(BULB);
    function lamp(x, z, ry, axis, Q) {
      // direção do braço: para a rua mais próxima
      const ddx = axis === "x" ? -Q.sx : 0, ddz = axis === "z" ? -Q.sz : 0;
      if (has(KAY.poste)) {
        const th = Math.atan2(ddz, -ddx); // o braço do modelo aponta para -X
        prop(KAY.poste, { altura: 5.6, centralizar: false }, x, CURB, z, th);
        const bx = x + ddx * 1.3, bz = z + ddz * 1.3;
        inst(U.sph(0.2, 10, 8), BULB, bx, CURB + 5.15, bz, 0, 0, 0, 1.2, 0.6, 1.2, false);
        atm.lamp(bx, CURB + 5.1, bz, 0.02);
        W.colliders.addCentered(x, z, 0.45, 0.45);
        return;
      }
      atm.lamp(x + ddx * 1.33, CURB + 5.0, z + ddz * 1.33, 0.02);
      const pole = U.mat("#3A4150", { metalness: 0.4, roughness: 0.4 });
      inst(U.cyl(0.09, 0.13, 5.2, 8), pole, x, CURB + 2.6, z);
      // braço apontando para a rua
      const dx = axis === "x" ? -Q.sx * 0.7 : 0, dz = axis === "z" ? -Q.sz * 0.7 : 0;
      inst(UNIT, pole, x + dx, CURB + 5.1, z + dz, 0, 0, 0, axis === "x" ? 1.5 : 0.12, 0.12, axis === "z" ? 1.5 : 0.12);
      inst(UNIT, BULB, x + dx * 1.9, CURB + 5.0, z + dz * 1.9, 0, 0, 0, 0.6, 0.18, 0.6, false);
      W.colliders.addCentered(x, z, 0.4, 0.4);
    }

    function trafficLight(x, z, Q) {
      if (prop(KAY.semaforo, { altura: 4.2, centralizar: false }, x, CURB, z, Math.atan2(-Q.sx, -Q.sz))) { W.colliders.addCentered(x, z, 0.4, 0.4); return; }
      const pole = U.mat("#2B2F3A");
      inst(U.cyl(0.08, 0.1, 3.6, 8), pole, x, CURB + 1.8, z);
      inst(UNIT, pole, x, CURB + 3.8, z, 0, 0, 0, 0.42, 1.2, 0.42);
      ["#FF4D4D", "#FFC83D", "#3DDC84"].forEach((c, i) => {
        inst(U.sph(0.12, 8, 6), U.mat(c, { emissive: c, emissiveIntensity: i === 2 ? 1 : 0.15 }), x - Q.sx * 0.22, CURB + 4.15 - i * 0.35, z - Q.sz * 0.22, 0, 0, 0, 1, 1, 1, false);
      });
      W.colliders.addCentered(x, z, 0.35, 0.35);
    }

    function bench(x, z, ry) {
      if (prop(KAY.banco, { comprimento: 2.2 }, x, CURB, z, ry + Math.PI / 2)) { colRot(x, z, 2.2, 0.8, ry); return; }
      const wood = U.mat("#B07A45"), iron = U.mat("#2B2F3A");
      const c = Math.cos(ry), s = Math.sin(ry);
      const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      let p = P(0, 0); inst(UNIT, wood, p[0], CURB + 0.5, p[1], 0, ry, 0, 2.2, 0.1, 0.6);
      p = P(0, -0.3); inst(UNIT, wood, p[0], CURB + 0.85, p[1], 0, ry, 0, 2.2, 0.5, 0.08);
      [-0.9, 0.9].forEach((lx) => { const q = P(lx, -0.05); inst(UNIT, iron, q[0], CURB + 0.25, q[1], 0, ry, 0, 0.1, 0.5, 0.6); });
      colRot(x, z, 2.2, 0.8, ry);
    }

    function tree(x, z, sc, type, colScale) {
      sc = sc || 1;
      const trunk = U.mat("#7A5233");
      inst(U.cyl(0.16, 0.24, 2.2, 8), trunk, x, CURB + 1.1 * sc, z, 0, 0, 0, sc, sc, sc);
      if (type === "pine") {
        const m = U.mat("#2F8F4E", { flatShading: true });
        atm.pineMat(m);
        inst(U.geo("cone1", () => new THREE.ConeGeometry(1.5, 3, 8)), m, x, CURB + 3.2 * sc, z, 0, rand() * 6, 0, sc, sc, sc);
        inst(U.geo("cone1", () => new THREE.ConeGeometry(1.5, 3, 8)), m, x, CURB + 4.4 * sc, z, 0, rand() * 6, 0, sc * 0.75, sc * 0.75, sc * 0.75);
      } else {
        const greens = ["#4FA85A", "#5DB86A", "#3E9A55", "#6CC070"];
        const gi = Math.floor(rand() * greens.length);
        const m = U.mat(greens[gi], { flatShading: true });
        atm.leafMat(m, gi);
        const g = U.geo("ico", () => new THREE.IcosahedronGeometry(1.4, 1));
        inst(g, m, x, CURB + 3.2 * sc, z, rand(), rand() * 6, 0, sc, sc * 0.95, sc);
        inst(g, m, x + 0.6 * sc, CURB + 2.7 * sc, z + 0.3 * sc, rand(), rand() * 6, 0, sc * 0.7, sc * 0.65, sc * 0.7);
        inst(g, m, x - 0.5 * sc, CURB + 2.8 * sc, z - 0.4 * sc, rand(), rand() * 6, 0, sc * 0.65, sc * 0.6, sc * 0.65);
      }
      W.colliders.addCentered(x, z, 0.7 * (colScale || 1), 0.7 * (colScale || 1));
    }

    /* Placa de esquina: a haste termina embaixo das placas (nada passa na frente do
     * nome) e cada placa é legível dos dois lados. A placa de cima acompanha a rua
     * no sentido X; a de baixo, a rua no sentido Z. */
    function streetSign(x, z, a, b) {
      const PW = 2.5, PH = 0.56, y0 = CURB + 2.45;
      const poleM = U.mat("#6E7480", { metalness: 0.5, roughness: 0.4 }), frameM = U.mat("#14335E", { roughness: 0.5 });
      inst(U.cyl(0.055, 0.07, y0 - CURB, 8), poleM, x, (CURB + y0) / 2, z);
      [[b, y0 + PH / 2, Math.PI / 2], [a, y0 + PH * 1.5 + 0.03, 0]].forEach(([nome, y, ry]) => {
        const tex = U.signTex(nome, { w: 768, h: 172, bg: "#1D4E89", font: 70, radius: 16, border: "#FFFFFF" });
        const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const pl = new THREE.Group(); pl.position.set(x, y, z); pl.rotation.y = ry; root.add(pl);
        const frame = new THREE.Mesh(U.box(PW + 0.04, PH + 0.04, 0.05), frameM); pl.add(frame);
        [1, -1].forEach((sd) => {
          const f = new THREE.Mesh(U.geo("streetsign-plane", () => new THREE.PlaneGeometry(PW, PH)), m);
          f.position.z = sd * 0.03; f.rotation.y = sd < 0 ? Math.PI : 0; pl.add(f);
        });
      });
      W.colliders.addCentered(x, z, 0.3, 0.3);
    }

    /* ---------- Faixas, linhas e faixas de pedestre ---------- */
    function buildRoadMarkings(z, zi) {
      // linhas tracejadas no centro das ruas
      for (let d = -IN - 4; d <= IN + 4; d += 4) {
        if (Math.abs(d) < 10) continue;
        decal(z.x + d, z.z, 2, 0.22, yellowLine);
        decal(z.x, z.z + d, 0.22, 2, yellowLine);
      }
      // faixas de pedestres nos quatro braços do cruzamento
      for (let i = -4; i <= 4; i++) {
        const o = i * 1.05;
        decal(z.x + o, z.z - 7.4, 0.6, 2.6, white);
        decal(z.x + o, z.z + 7.4, 0.6, 2.6, white);
        decal(z.x - 7.4, z.z + o, 2.6, 0.6, white);
        decal(z.x + 7.4, z.z + o, 2.6, 0.6, white);
      }
    }

    /* ---------- Pórtico de boas-vindas no bairro inicial ---------- */
    function buildWelcomeArch(z) {
      const x = z.x - 20;
      const postM = U.mat("#16305C");
      [-1, 1].forEach((s) => { U.mesh(U.box(0.8, 6.4, 0.8), postM, x, CURB + 3.2, z.z + s * 6.4, root); W.colliders.addCentered(x, z.z + s * 6.4, 0.8, 0.8); });
      U.mesh(U.box(0.6, 1.9, 13.6), postM, x, CURB + 6.6, z.z, root);
      const tex = U.signTex("BEM-VINDO À JORNADA DA TRANSPARÊNCIA", { w: 2048, h: 256, bg: "#16305C", fg: "#FFC83D", font: 112, radius: 24 });
      const m = new THREE.MeshBasicMaterial({ map: tex });
      [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.6), m); p.position.set(x + s * 0.31, CURB + 6.6, z.z); p.rotation.y = s * Math.PI / 2; root.add(p); });
      // Seu Lima, o guarda municipal, recebe quem chega (antes do pórtico, ao lado da rua)
      const L = CT.SEU_LIMA;
      if (L && CT.createPedestrian) {
        const ch = CT.createPedestrian({ modelo: L.modelo });
        const lx = x - 2.4, lz = z.z - 4.3;
        ch.root.position.set(lx, W.groundHeight ? W.groundHeight(lx, lz) : CURB, lz);
        ch.root.rotation.y = -Math.PI / 2;
        root.add(ch.root);
        W.colliders.addCentered(lx, lz, 0.7, 0.7);
        // exclamação flutuante acima da cabeça: indica que dá para conversar com ele
        const exc = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.talkTex(), transparent: true, depthWrite: false }));
        exc.scale.set(0.34, 0.68, 1); exc.renderOrder = 5;
        root.add(exc);
        W.seuLima = { ch, x: lx, z: lz, falando: false, t: 0, base: -Math.PI / 2, exc, excA: 1 };
      }
    }

    /* ---------- Pedestres que caminham pela cidade ---------- */
    /* Pedestres: cada um com modelo, pele, cabelo, roupa, altura,
     * porte e acessório sorteados (sempre os mesmos, pela semente). */
    const PED = {
      peles: ["#F6D3B8", "#F1C7A5", "#E0AC86", "#D49A72", "#B57C55", "#A86E4A", "#8D5A3B", "#6B4128", "#4E2F1E"],
      cabelos: ["#141414", "#2B1A12", "#3B2314", "#6B3B1F", "#9A5B2A", "#C2852F", "#E3C27A", "#B9B9B9", "#E8E8E8", "#7A2E2E"],
      camisas: ["#E2574C", "#1E6FD9", "#14A44D", "#B65CFF", "#F07D1A", "#0E9F8E", "#E84393", "#F4F4F4", "#FFC83D", "#2D3E8F", "#8D6E63", "#263238", "#9CCC65", "#FF8A80"],
      calcas: ["#2F3B4F", "#1F3B6E", "#4A4A55", "#6B4A2B", "#2E4A3A", "#C8B79A", "#1B1B1F", "#5D6D7E", "#7B1F2E"],
      acessF: [null, null, null, "oculos", "chapeu", "headset", "bone"],
      acessM: [null, null, "oculos", "bone", "chapeu", "bigode", "gravata", "cracha", "headset"],
    };
    const pick = (a) => a[Math.floor(rand() * a.length)];
    function addPedestrian(x0, z0, x1, z1) {
      const r = rand();
      const modelo = r < 0.45 ? "feminino" : r < 0.88 ? "masculino" : "aventureiro";
      const acc = modelo === "feminino" ? pick(PED.acessF) : modelo === "masculino" ? pick(PED.acessM) : null;
      const chest = acc === "gravata" || acc === "cracha";
      const o = {
        modelo, pele: pick(PED.peles), cabelo: pick(PED.cabelos), camisa: pick(PED.camisas), calca: pick(PED.calcas),
        sapato: pick(["#2B2B2B", "#F4F4F4", "#6B4A2B", "#1E6FD9"]),
        acessorio: chest ? null : acc, peito: chest ? acc : null,
        chapeu: acc === "bone" ? "bone" : null, cor: pick(PED.camisas), corGravata: pick(["#C0392B", "#1E6FD9", "#2E7D32", "#6A1B9A"]),
        altura: (modelo === "feminino" ? 1.58 : 1.66) + rand() * 0.2, corpo: 0.9 + rand() * 0.24,
        // reserva (personagem desenhado em código)
        estiloCabelo: pick(["curto", "longo", "rabo", "coque", "topete"]),
      };
      if (o.acessorio === "bone") o.acessorio = null;
      const p = CT.createPedestrian(o);
      if (!p.rigged) p.root.scale.setScalar(0.95);
      p.root.position.set(x0, CURB, z0);
      root.add(p.root);
      W.pedestrians.push({ ch: p, a: { x: x0, z: z0 }, b: { x: x1, z: z1 }, t: rand(), dir: 1, wait: 0 });
    }

    /* ---------- Fileiras de prédios entre bairros ---------- */
    function buildRows() {
      const palette = ["#F2E8D5", "#E3ECF5", "#F6D7C3", "#D6E8E1", "#E9DDF2", "#F3E3A8", "#CFE0F3", "#F0C9B8", "#DDE5C8", "#FFFFFF"];
      const glassC = ["#8EC3EA", "#6FA6D6", "#8FD0DE", "#A3B9E8"];
      const mats = palette.map((c, i) => {
        const st = i % 3 === 0 ? "tall" : i % 3 === 1 ? "plain" : "band";
        const t = U.facadeTex(c, glassC[i % glassC.length], st);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, emissive: "#FFFFFF", emissiveMap: U.facadeLit(st, 100 + i), emissiveIntensity: 0 });
        atm.windowMat(m);
        return m;
      });
      const roofM = U.mat("#9AA0AA"), capM = U.mat("#7E8592");
      const rowTops = []; W.rowTops = rowTops;
      const isConnected = (zoneA, zoneB) => Math.abs(zoneA - zoneB) === 1;
      const zoneIdx = (c, r) => ZONE_GRID.findIndex(([cc, rr]) => cc === c && rr === r);

      // linhas verticais (x constante): cobrem toda a extensão em Z
      [-EDGE, -36, 36, EDGE].forEach((lx, li) => {
        const gaps = [];
        if (li === 1 || li === 2) {
          for (let r = 0; r < 3; r++) {
            const a = zoneIdx(li - 1, r), b = zoneIdx(li, r);
            if (isConnected(a, b)) gaps.push((r - 1) * S);
          }
        }
        fillLine("v", lx, -EDGE - ROW, EDGE + ROW, gaps, li === 0 || li === 3);
      });
      // linhas horizontais (z constante): apenas dentro de cada coluna
      [-EDGE, -36, 36, EDGE].forEach((lz, li) => {
        for (let c = 0; c < 3; c++) {
          const cx = (c - 1) * S;
          const gaps = [];
          if (li === 1 || li === 2) {
            const a = zoneIdx(c, li - 1), b = zoneIdx(c, li);
            if (isConnected(a, b)) gaps.push(cx);
          }
          fillLine("h", lz, cx - IN, cx + IN, gaps, li === 0 || li === 3);
        }
      });

      function fillLine(dir, line, from, to, gaps, outer) {
        // segmentos sem as aberturas
        let segs = [[from, to]];
        gaps.forEach((g) => {
          const ns = [];
          segs.forEach(([a, b]) => {
            if (g + RD <= a || g - RD >= b) ns.push([a, b]);
            else { if (g - RD > a) ns.push([a, g - RD]); if (g + RD < b) ns.push([g + RD, b]); }
          });
          segs = ns;
        });
        segs.forEach(([a, b]) => {
          let p = a;
          while (p < b - 0.01) {
            let w = 7 + rand() * 7;
            if (b - (p + w) < 6) w = b - p;
            const h = outer ? 16 + rand() * 20 : 9 + rand() * 18;
            const mid = p + w / 2;
            const x = dir === "v" ? line : mid, z = dir === "v" ? mid : line;
            const bw = dir === "v" ? ROW * 2 : w - 0.05, bd = dir === "v" ? w - 0.05 : ROW * 2;
            const mat = mats[Math.floor(rand() * mats.length)];
            const mesh = new THREE.Mesh(U.facadeBox(bw, h, bd, 3.5, 3.2), [mat, mat, roofM, roofM, mat, mat]);
            mesh.position.set(x, h / 2, z); mesh.castShadow = mesh.receiveShadow = true;
            root.add(mesh); W.cameraBlockers.push(mesh);
            slab(x, h + 0.25, z, bw + 0.3, 0.5, bd + 0.3, capM);
            slab(x, 0.6, z, bw + 0.12, 1.2, bd + 0.12, U.mat("#C9C2B5"), 0, false);
            // detalhes no telhado
            if (rand() < 0.5) inst(U.cyl(0.9, 0.9, 1.6, 12), U.mat("#D9DEE6"), x + (rand() - 0.5) * 3, h + 1.3, z + (rand() - 0.5) * 3);
            if (rand() < 0.5) slab(x + (rand() - 0.5) * 3, h + 0.9, z + (rand() - 0.5) * 3, 1.6, 1, 1.2, U.mat("#B8BEC8"));
            if (rand() < 0.25) inst(U.cyl(0.05, 0.05, 4, 4), U.mat("#555B66"), x, h + 2.5, z);
            W.colliders.addCentered(x, z, bw, bd, "row");
            rowTops.push({ x, z, h, w: w - 0.05, dir, line, outer });
            W.minimap.rows.push({ x0: x - bw / 2, x1: x + bw / 2, z0: z - bd / 2, z1: z + bd / 2 });
            p += w;
          }
        });
      }
      // limite invisível extra (segurança): ninguém sai do mapa
      const L = EDGE + ROW + 2;
      W.colliders.addBox(-L - 10, -L, -L - 10, L + 10); W.colliders.addBox(L, L + 10, -L - 10, L + 10);
      W.colliders.addBox(-L - 10, L + 10, -L - 10, -L); W.colliders.addBox(-L - 10, L + 10, L, L + 10);
    }

    /* ---------- Outdoors com os logos, no alto de alguns prédios ---------- */
    function billboardTex(peca) {
      const logos = (CT.CONFIG.logosApoio || []);
      const emb = window.CT_LOGOS_EMBUTIDOS || {};
      const lista = peca.logo === "todos" ? logos : logos.filter((l) => l.id === peca.logo);
      const tex = U.canvasTex(1024, 512, () => {});
      const cv = tex.image, ctx = cv.getContext("2d");
      const imgs = lista.map((l) => { const im = new Image(); im.src = emb[l.arquivo] || l.arquivo; return im; });
      function draw() {
        const w = cv.width, h = cv.height;
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(1, "#EEF2F8");
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        // logos centralizados na área branca
        const ok = imgs.filter((im) => im.complete && im.naturalWidth);
        tex.needsUpdate = true;
        if (!ok.length) return;
        const padX = 56, top = 44, areaH = h - top * 2, gap = 44;
        const cellW = (w - padX * 2 - gap * (ok.length - 1)) / ok.length;
        ok.forEach((im, i) => {
          const sc = Math.min(cellW / im.naturalWidth, areaH / im.naturalHeight) * (ok.length > 1 ? 0.95 : 0.9);
          const iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
          const cx = padX + cellW * (i + 0.5) + gap * i;
          ctx.drawImage(im, cx - iw / 2, top + (areaH - ih) / 2, iw, ih);
        });
      }
      draw();
      imgs.forEach((im) => { if (!im.complete) im.addEventListener("load", draw); });
      return tex;
    }
    function buildBillboards() {
      const cfg = CT.OUTDOORS || {}, pecas = cfg.pecas || [];
      if (!pecas.length || !W.rowTops) return;
      const mats = pecas.map((p) => {
        const t = billboardTex(p);
        // afastado da moldura + polygonOffset: sem "piscar" (z-fighting) quando visto de longe
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, emissive: "#8A8A8A", emissiveMap: t, emissiveIntensity: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        atm.windowMat(m);   // acende à noite, junto com as janelas
        return m;
      });
      const frameM = U.mat("#2B2F38", { roughness: 0.6 }), steelM = U.mat("#5B616C", { roughness: 0.5 });
      const lampM = new THREE.MeshStandardMaterial({ color: "#FFF4D6", emissive: "#FFE8B0", emissiveIntensity: 0 });
      atm.windowMat(lampM);
      const BW = 10.6, BH = 5.3;
      const panelGeo = new THREE.PlaneGeometry(BW, BH);
      // candidatos: prédios largos o bastante e não altos demais (para ver da rua).
      // Primeiro os que ficam no fim de uma rua (bem na linha do eixo do bairro):
      // quem anda pela rua vê o outdoor de frente, lá no alto.
      const cand = W.rowTops.filter((t) => t.w >= BW - 0.6 && t.h <= 24);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      const fimDeRua = (t) => { const c = t.dir === "v" ? t.z : t.x; return Math.min(...[-S, 0, S].map((a) => Math.abs(c - a))) < RD + 6; };
      cand.sort((a, b) => fimDeRua(b) - fimDeRua(a));
      const chosen = [];
      for (const t of cand) {
        if (chosen.length >= (cfg.quantidade || 12)) break;
        if (chosen.some((c) => Math.hypot(c.x - t.x, c.z - t.z) < 38)) continue;
        chosen.push(t);
      }
      let k = 0;
      chosen.forEach((t) => {
        // fileiras externas: uma face voltada para dentro da cidade; internas: duas faces
        const inward = t.dir === "v" ? [-Math.sign(t.line), 0] : [0, -Math.sign(t.line)];
        const ry = Math.atan2(inward[0], inward[1]);
        const g = new THREE.Group(); g.position.set(t.x, t.h + 0.5, t.z); g.rotation.y = ry; root.add(g);
        const lift = 1.3, cy = lift + BH / 2;
        // pernas e treliça
        [-1, 1].forEach((s) => {
          U.mesh(U.box(0.22, lift + BH * 0.6, 0.22), steelM, s * BW * 0.32, (lift + BH * 0.6) / 2, -0.25, g);
          const br = U.mesh(U.box(0.12, 1.9, 0.12), steelM, s * BW * 0.32, 0.9, -1.0, g); br.rotation.x = 0.6;
        });
        U.mesh(U.box(BW + 0.3, BH + 0.3, 0.28), frameM, 0, cy, -0.05, g);
        const front = new THREE.Mesh(panelGeo, mats[k++ % mats.length]); front.position.set(0, cy, 0.17); g.add(front);
        if (!t.outer) {
          const back = new THREE.Mesh(panelGeo, mats[k++ % mats.length]); back.position.set(0, cy, -0.27); back.rotation.y = Math.PI; g.add(back);
        }
        // passarela e luminárias
        U.mesh(U.box(BW, 0.08, 0.7), steelM, 0, lift - 0.1, 0.35, g);
        [-0.3, 0, 0.3].forEach((f) => {
          U.mesh(U.box(0.06, 0.06, 0.6), steelM, f * BW, cy + BH / 2 + 0.2, 0.3, g);
          U.mesh(U.box(0.5, 0.14, 0.24), lampM, f * BW, cy + BH / 2 + 0.2, 0.62, g);
          if (!t.outer) {
            U.mesh(U.box(0.06, 0.06, 0.6), steelM, f * BW, cy + BH / 2 + 0.2, -0.6, g);
            U.mesh(U.box(0.5, 0.14, 0.24), lampM, f * BW, cy + BH / 2 + 0.2, -0.92, g);
          }
        });
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      });
      W.billboards = chosen;
    }

    /* ---------- Portões (bloqueios da jornada) ---------- */
    function buildGate(k) {
      const A = W.zones[k], B = W.zones[k + 1];
      const gx = (A.x + B.x) / 2, gz = (A.z + B.z) / 2;
      // grupo girado para que +Z local aponte para o bairro anterior (lado de quem chega)
      const ry = Math.atan2(A.x - gx, A.z - gz);
      const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; root.add(g);
      const concrete = U.mat("#D9D4CA");
      // pilares + pórtico
      const lightM = [];
      [-1, 1].forEach((s) => {
        U.mesh(U.box(0.9, 4.6, 0.9), concrete, s * 5.4, 2.3, 0, g);
        const lm = new THREE.MeshStandardMaterial({ color: "#FF4D4D", emissive: "#FF2020", emissiveIntensity: 1.2 });
        lightM.push(lm);
        U.mesh(U.sph(0.3, 12, 10), lm, s * 5.4, 4.85, 0, g);
      });
      U.mesh(U.box(11.7, 0.6, 0.7), U.mat("#16305C"), 0, 4.3, 0, g);
      // placa no pórtico
      const def = CT.PREDIOS[k], next = k < 7 ? CT.PREDIOS[k + 1].nome : CT.BOSS.predio;
      const lockedTex = U.signTex("ACESSO BLOQUEADO", { w: 1024, h: 256, bg: "#C0392B", sub: "Conclua: " + def.nome, font: 92 });
      const openTex = U.signTex("PASSAGEM LIBERADA", { w: 1024, h: 256, bg: "#18A05E", sub: "Próxima etapa: " + next, font: 92 });
      const signM = new THREE.MeshBasicMaterial({ map: lockedTex });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), signM); sign.position.set(0, 3.35, 0.37); g.add(sign);
      const signB = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), signM); signB.position.set(0, 3.35, -0.37); signB.rotation.y = Math.PI; g.add(signB);
      // cancela listrada (gira no eixo Z local)
      const stripe = U.canvasTex(256, 32, (ctx) => { for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#FFFFFF" : "#E2312B"; ctx.fillRect(i * 32, 0, 32, 32); } });
      const boomPivot = new THREE.Group(); boomPivot.position.set(-4.7, 1.15, 0.7); g.add(boomPivot);
      U.mesh(U.box(0.7, 1.2, 0.7), U.mat("#F4C430"), 0, -0.55, 0, boomPivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.26, 0.2), new THREE.MeshStandardMaterial({ map: stripe }));
      arm.position.x = 4.7; arm.castShadow = true; boomPivot.add(arm);
      // grades portáteis
      const fenceTex = U.canvasTex(256, 64, (ctx) => { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 256, 64); for (let i = -2; i < 10; i++) { ctx.fillStyle = "#F07D1A"; ctx.beginPath(); ctx.moveTo(i * 40, 64); ctx.lineTo(i * 40 + 20, 64); ctx.lineTo(i * 40 + 44, 0); ctx.lineTo(i * 40 + 24, 0); ctx.fill(); } });
      const fences = [-2.4, 2.4].map((x) => {
        const f = new THREE.Group(); f.position.set(x, 0, -0.6); g.add(f);
        const p = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.12), new THREE.MeshStandardMaterial({ map: fenceTex }));
        p.position.y = 1.05; p.castShadow = true; f.add(p);
        [-2, 2].forEach((fx) => { U.mesh(U.box(0.12, 1.5, 0.12), U.mat("#E6E6E6"), fx, 0.75, 0, f); U.mesh(U.box(0.25, 0.08, 0.9), U.mat("#555"), fx, 0.04, 0, f); });
        return f;
      });
      // cones na frente
      const coneG = U.geo("cone", () => new THREE.ConeGeometry(0.32, 0.9, 14));
      const cones = [-3.6, -1.2, 1.2, 3.6].map((x, i) => {
        const c = new THREE.Group(); c.position.set(x, 0, 2.6 + (i % 2) * 0.5); g.add(c);
        U.mesh(coneG, U.mat("#FF6B1A"), 0, 0.5, 0, c);
        U.mesh(U.cyl(0.21, 0.25, 0.16, 14), U.mat("#FFFFFF"), 0, 0.5, 0, c, false);
        U.mesh(U.box(0.75, 0.06, 0.75), U.mat("#2B2B2B"), 0, 0.03, 0, c);
        return c;
      });
      // faixa zebrada no chão
      const zebra = U.canvasTex(256, 32, (ctx) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? "#1B1E27" : "#FFC83D"; ctx.fillRect(i * 16, 0, 16, 32); } });
      const zm = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.8), new THREE.MeshBasicMaterial({ map: zebra, transparent: true }));
      zm.rotation.x = -Math.PI / 2; zm.position.set(0, 0.015, 1.6); g.add(zm);

      // colisão: bloqueia toda a passagem (inclui a área dos cones)
      const c = Math.cos(ry), s = Math.sin(ry);
      const corners = [[-6, -1.4], [6, -1.4], [-6, 3.6], [6, 3.6]].map(([lx, lz]) => [gx + lx * c + lz * s, gz - lx * s + lz * c]);
      const xs = corners.map((p) => p[0]), zs = corners.map((p) => p[1]);
      const col = W.colliders.addBox(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), "gate");

      const gate = {
        k, x: gx, z: gz, ry, isOpen: false, p: 0, animating: false, collider: col,
        approach: { x: gx + 7 * s, z: gz + 7 * c },
        axis: Math.abs(A.z - B.z) < 1 ? "x" : "z",
      };
      gate.open = function (animated) {
        gate.isOpen = true; col.enabled = false;
        signM.map = openTex; signM.needsUpdate = true;
        lightM.forEach((m) => { m.color.set("#3DDC84"); m.emissive.set("#20C060"); });
        if (animated) { gate.animating = true; gate.p = 0; } else { gate.p = 1; apply(1); }
      };
      gate.reset = function () {
        gate.isOpen = false; col.enabled = true; gate.animating = false; gate.p = 0; apply(0);
        signM.map = lockedTex; signM.needsUpdate = true;
        lightM.forEach((m) => { m.color.set("#FF4D4D"); m.emissive.set("#FF2020"); });
      };
      function apply(p) {
        boomPivot.rotation.z = U.easeOutBack(U.clamp(p * 1.3, 0, 1)) * 1.42;
        fences.forEach((f, i) => { const q = U.clamp(p * 1.5 - 0.2, 0, 1); f.position.x = (i ? 1 : -1) * (2.4 + q * 3.2); f.position.y = -q * 1.6; });
        cones.forEach((cn, i) => { const q = U.clamp(p * 2 - i * 0.18, 0, 1); cn.scale.setScalar(Math.max(0.001, 1 - q)); cn.position.y = -q * 0.6; cn.visible = q < 1; });
      }
      gate.update = function (dt) {
        if (!gate.animating) return;
        gate.p = Math.min(1, gate.p + dt / 1.8);
        apply(gate.p);
        if (gate.p >= 1) gate.animating = false;
      };
      W.animated.push((dt, t) => {
        gate.update(dt);
        if (!gate.isOpen) lightM.forEach((m) => (m.emissiveIntensity = 0.6 + (Math.sin(t * 6) > 0 ? 0.9 : 0)));
        else lightM.forEach((m) => (m.emissiveIntensity = 1));
      });
      return gate;
    }

    /* ---------- Bairro final: Torre da Transparência ---------- */
    function buildBossZone(z) {
      const x0 = z.x - IN, x1 = z.x + IN, z0 = z.z - IN, z1 = z.z + IN;
      // grande praça elevada
      const ptex = U.canvasTex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#E7E1F2"; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(110,90,150,0.35)"; ctx.lineWidth = 4;
        for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke(); }
        ctx.fillStyle = "rgba(142,68,255,0.12)"; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
      }, true);
      const pm = new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.85 });
      const g = U.boxWorldUV(62, CURB, 62, 6, 6);
      const m = new THREE.Mesh(g, [curbM, curbM, pm, curbM, curbM, curbM]);
      m.position.set(z.x, CURB / 2, z.z); m.receiveShadow = true; root.add(m);
      W.raised.push({ x0, x1, z0, z1 });
      W.minimap.plazas.push({ x0, x1, z0, z1 });

      // tapete do caminho até o chefe
      const carpetM = U.mat("#5B1FB8", { roughness: 0.9 });
      slab(z.x - 17, CURB + 0.02, z.z, 28, 0.04, 4, carpetM, 0, false);
      // torre
      const tx = z.x + 14, tz = z.z;
      slab(tx, CURB + 0.6, tz, 18, 1.2, 18, U.mat("#CFC8DD"));
      const glassTex = U.facadeTex("#3C3F66", "#6A7BD8", "glass");
      const towerM = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.4, emissive: "#20134A", emissiveIntensity: 0.4 });
      const tower = new THREE.Mesh(U.facadeBox(12, 34, 12, 3, 3), towerM);
      tower.position.set(tx, CURB + 1.2 + 17, tz); tower.castShadow = true; root.add(tower);
      W.cameraBlockers.push(tower);
      const crownM = U.mat("#2A2440");
      slab(tx, CURB + 35.6, tz, 13, 0.8, 13, crownM);
      const crystalM = new THREE.MeshStandardMaterial({ color: "#6B5A9A", emissive: "#3A1F7A", emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.9 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), crystalM);
      crystal.position.set(tx, CURB + 41, tz); crystal.scale.set(1, 1.6, 1); crystal.castShadow = true; root.add(crystal);
      // nome da torre
      const sm = new THREE.MeshBasicMaterial({ map: U.signTex("TORRE DA TRANSPARÊNCIA", { w: 1280, h: 220, bg: "#2A2440", fg: "#E9DDF2", font: 96, radius: 30, border: "#8E44FF" }) });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.9), sm); sign.position.set(tx - 6.05, CURB + 11.5, tz); sign.rotation.y = -Math.PI / 2; root.add(sign);
      // portal de entrada
      const doorM = new THREE.MeshStandardMaterial({ color: "#2A1F4A", emissive: "#8E44FF", emissiveIntensity: 0.5 });
      U.mesh(U.box(0.3, 5, 4), doorM, tx - 6.05, CURB + 3.7, tz, root);
      W.colliders.addCentered(tx, tz, 18, 18, "tower");

      // nuvem escura girando ao redor da torre (some na vitória)
      const cloud = new THREE.Group(); cloud.position.set(tx, CURB + 38, tz); root.add(cloud);
      const cloudM = new THREE.MeshStandardMaterial({ color: "#3A2E55", transparent: true, opacity: 0.85, roughness: 1, flatShading: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rand() * 1.4, 0), cloudM);
        c.position.set(Math.cos(a) * 9, (rand() - 0.5) * 3, Math.sin(a) * 9); cloud.add(c);
      }

      // estandartes e braseiros ao longo do caminho
      const bannerM = U.mat("#5B1FB8", { side: THREE.DoubleSide });
      const fireM = new THREE.MeshStandardMaterial({ color: "#C08BFF", emissive: "#8E44FF", emissiveIntensity: 1.4 });
      for (let i = 0; i < 4; i++) {
        const bx = z.x - 26 + i * 6.5;
        [-1, 1].forEach((s) => {
          const bz = z.z + s * 4.6;
          U.mesh(U.cyl(0.1, 0.12, 5, 8), U.mat("#2A2440"), bx, CURB + 2.5, bz, root);
          const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), bannerM); ban.position.set(bx, CURB + 3.4, bz + s * 0.02 * 0); ban.position.x += 0.75; root.add(ban);
          W.colliders.addCentered(bx, bz, 0.4, 0.4);
        });
      }
      [[z.x - 6, z.z - 6], [z.x - 6, z.z + 6]].forEach(([bx, bz]) => {
        U.mesh(U.cyl(0.6, 0.35, 1.2, 10), U.mat("#2A2440"), bx, CURB + 0.6, bz, root);
        const f = U.mesh(U.geo("flame", () => new THREE.ConeGeometry(0.45, 1.2, 8)), fireM, bx, CURB + 1.7, bz, root, false);
        W.animated.push((dt, t) => { f.scale.y = 1 + Math.sin(t * 9 + bx) * 0.2; });
        W.colliders.addCentered(bx, bz, 1.2, 1.2);
      });
      const purple = new THREE.PointLight("#9B5CFF", 2.2, 26, 1.6); purple.position.set(z.x - 2, CURB + 5, z.z); root.add(purple);

      // árvores e canteiros nos cantos da praça
      [[-24, -24], [-24, 24], [24, -24], [24, 24], [-12, -22], [-12, 22], [2, -24], [2, 24]].forEach(([dx, dz]) => tree(z.x + dx, z.z + dz, 1.1, rand() > 0.5 ? "pine" : "round"));
      [[-18, -12], [-18, 12]].forEach(([dx, dz]) => { bench(z.x + dx, z.z + dz, dz > 0 ? Math.PI : 0); });

      // o chefe
      const boss = CT.createBoss();
      boss.root.position.set(z.x - 1, CURB, z.z);
      boss.root.rotation.y = -Math.PI / 2;
      boss.mode = "rage";
      root.add(boss.root);
      W.colliders.addCentered(z.x - 1, z.z, 3.6, 3.6, "boss");
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: U.markerTex("lock") }));
      const BOSS_H = (CT.MODELOS.personagens.corrupson || {}).altura || 3.3;
      marker.scale.set(2.4, 2.4, 1); marker.position.set(z.x - 1, CURB + BOSS_H + 1.6, z.z); root.add(marker);

      W.boss = {
        ch: boss, x: z.x - 1, z: z.z, trigger: { x: z.x - 6.5, z: z.z }, door: { x: z.x - 1, z: z.z }, altura: BOSS_H + 0.6,
        tower: { x: tx, z: tz }, status: "locked", defeated: false, marker, purple, cloud, crystal, towerM, crystalM, bannerM, fireM, carpetM,
        defeatT: -1,
      };
      W.boss.setStatus = function (st) {
        W.boss.status = st;
        marker.material.map = U.markerTex(st === "locked" ? "lock" : st === "done" ? "done" : "boss");
        marker.material.needsUpdate = true;
      };
      /* ---- batalha: golpes (tremor, brilho vermelho, faíscas) e fumaça final ---- */
      const bossMats = [];
      boss.root.traverse((n) => {
        if (!n.isMesh || !n.material || !n.material.emissive) return;
        n.material = n.material.clone(); // material próprio: o brilho do golpe não afeta mais nada
        bossMats.push({ m: n.material, e: n.material.emissive.clone(), i: n.material.emissiveIntensity });
      });
      const innerBase = boss.inner.position.clone();
      const HIT_COLOR = new THREE.Color("#FF2D55");
      const puffTex = (() => {
        const c = document.createElement("canvas"); c.width = c.height = 128;
        const g = c.getContext("2d");
        for (let k = 0; k < 7; k++) {
          const x = 64 + (Math.random() - 0.5) * 34, y = 64 + (Math.random() - 0.5) * 34, r = 30 + Math.random() * 22;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, "rgba(255,255,255,0.5)"); gr.addColorStop(0.6, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        }
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
      })();
      const puffs = [];
      for (let i = 0; i < 90; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
        sp.visible = false; sp.renderOrder = 6; root.add(sp);
        puffs.push({ sp, life: 0, max: 1, v: new THREE.Vector3(), s0: 1, s1: 2, op: 1, drag: 1.5, rot: 0, lift: 0.6 });
      }
      // solta partículas em volta do chefe
      function emit(n, o) {
        const bx = boss.root.position.x, bz = boss.root.position.z;
        let c = 0;
        for (const p of puffs) {
          if (c >= n) break;
          if (p.life > 0) continue;
          c++;
          const a = Math.random() * Math.PI * 2, rr = Math.random() * o.r, sp = o.speed * (0.4 + Math.random());
          p.sp.position.set(bx + Math.cos(a) * rr, CURB + o.y0 + Math.random() * (o.y1 - o.y0), bz + Math.sin(a) * rr);
          p.v.set(Math.cos(a) * sp, o.up * (0.5 + Math.random()), Math.sin(a) * sp);
          p.max = p.life = o.life[0] + Math.random() * (o.life[1] - o.life[0]);
          p.s0 = o.size[0] + Math.random() * (o.size[1] - o.size[0]); p.s1 = p.s0 * o.grow;
          p.op = o.opacity; p.drag = o.drag; p.lift = o.lift || 0;
          p.sp.material.color.set(o.color[(Math.random() * o.color.length) | 0]);
          p.sp.material.rotation = Math.random() * 6.28; p.rot = (Math.random() - 0.5) * 1.6;
          p.sp.scale.set(p.s0, p.s0, 1); p.sp.visible = true;
        }
      }
      let hitT = -1, vanishT = -1;
      /* golpe: o chefe treme, pisca em vermelho e solta faíscas */
      W.boss.hit = function () {
        hitT = 0;
        emit(22, { y0: 2.2, y1: 4.6, r: 0.9, speed: 5, up: 2, color: ["#FFFFFF", "#FFD6F0", "#C08BFF", "#FF7AA8"], size: [0.25, 0.55], grow: 2, life: [0.3, 0.65], opacity: 1, drag: 3.5 });
      };
      /* golpe final: o chefe some numa nuvem de fumaça */
      W.boss.smoke = function () {
        if (vanishT >= 0) return;
        hitT = 0; vanishT = 0; marker.visible = false;
        emit(30, { y0: 1.8, y1: 4.8, r: 1.0, speed: 7, up: 2.5, color: ["#FFFFFF", "#E8D9FF", "#C08BFF"], size: [0.3, 0.7], grow: 2.2, life: [0.35, 0.8], opacity: 1, drag: 3 });
        emit(90, { y0: 0.1, y1: 5.0, r: 1.6, speed: 3.0, up: 1.2, color: ["#8E7FA8", "#B3A6C9", "#6B5A88", "#D9D0E8", "#A08CC4"], size: [1.2, 2.3], grow: 2.3, life: [1.6, 3.0], opacity: 0.88, drag: 1.4, lift: 0.8 });
      };
      W.boss.defeat = function () { W.boss.defeated = true; W.boss.defeatT = 0; boss.mode = "defeat"; if (boss.root.visible && vanishT < 0) W.boss.smoke(); };
      W.animated.push((dt) => {
        // tremor + brilho do golpe
        if (hitT >= 0) {
          hitT += dt;
          const k = Math.min(1, hitT / 0.65), f = (1 - k) * (1 - k);
          bossMats.forEach((b) => { b.m.emissive.copy(b.e).lerp(HIT_COLOR, f); b.m.emissiveIntensity = b.i + f * 1.8; });
          boss.inner.position.set(innerBase.x + Math.sin(hitT * 70) * 0.16 * f, innerBase.y, innerBase.z + Math.cos(hitT * 53) * 0.1 * f);
          if (k >= 1) { hitT = -1; bossMats.forEach((b) => { b.m.emissive.copy(b.e); b.m.emissiveIntensity = b.i; }); boss.inner.position.copy(innerBase); }
        }
        // o corpo some dentro da fumaça
        if (vanishT >= 0 && boss.root.visible) {
          vanishT += dt;
          const p = U.clamp(vanishT / 0.55, 0, 1);
          boss.root.scale.setScalar(Math.max(0.001, 1 - U.easeInOut(p)));
          if (p >= 1) { boss.root.visible = false; W.colliders.list.forEach((c) => { if (c.tag === "boss") c.enabled = false; }); }
        }
        // partículas
        for (const p of puffs) {
          if (p.life <= 0) continue;
          p.life -= dt;
          if (p.life <= 0) { p.sp.visible = false; continue; }
          const k = 1 - p.life / p.max;
          p.sp.position.addScaledVector(p.v, dt);
          p.v.multiplyScalar(Math.exp(-p.drag * dt)); p.v.y += p.lift * dt;
          const sc = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k));
          p.sp.scale.set(sc, sc, 1);
          p.sp.material.rotation += p.rot * dt;
          p.sp.material.opacity = p.op * Math.min(1, k * 8) * (1 - k);
        }
      });
      W.boss.reset = function () {
        W.boss.defeated = false; W.boss.defeatT = -1; boss.mode = "rage";
        boss.root.visible = true; boss.root.scale.setScalar(1); boss.inner.rotation.y = 0;
        boss.root.position.y = CURB; boss.inner.position.copy(innerBase);
        hitT = -1; vanishT = -1;
        bossMats.forEach((b) => { b.m.emissive.copy(b.e); b.m.emissiveIntensity = b.i; });
        puffs.forEach((p) => { p.life = 0; p.sp.visible = false; });
        cloud.visible = true; cloud.scale.setScalar(1);
        towerM.emissive.set("#20134A"); towerM.emissiveIntensity = 0.4;
        crystalM.color.set("#6B5A9A"); crystalM.emissive.set("#3A1F7A"); crystalM.emissiveIntensity = 0.6;
        bannerM.color.set("#5B1FB8"); carpetM.color.set("#5B1FB8");
        fireM.color.set("#C08BFF"); fireM.emissive.set("#8E44FF");
        purple.color.set("#9B5CFF"); marker.visible = true;
        W.colliders.list.forEach((c) => { if (c.tag === "boss") c.enabled = true; });
        W.boss.setStatus("locked");
      };
      W.animated.push((dt, t) => {
        cloud.rotation.y += dt * 0.35;
        crystal.rotation.y += dt * (W.boss.defeated ? 1.6 : 0.4);
        crystal.position.y = CURB + 41 + Math.sin(t * 1.5) * 0.6;
        marker.position.y = CURB + BOSS_H + 1.6 + Math.sin(t * 2) * 0.3;
        purple.intensity = W.boss.defeated ? 2.2 : 1.8 + Math.sin(t * 5) * 0.5;
        if (W.boss.defeatT >= 0) {
          W.boss.defeatT += dt;
          const p = U.clamp(W.boss.defeatT / 2.4, 0, 1);
          if (p >= 1) marker.visible = false; // o chefe já virou fumaça (W.boss.smoke)
          cloud.scale.setScalar(Math.max(0.001, 1 - p));
          if (p >= 1) cloud.visible = false;
          // a torre acende
          towerM.emissive.set("#6FE3FF"); towerM.emissiveIntensity = 0.15 + p * 0.55;
          crystalM.color.set("#BFF4FF"); crystalM.emissive.set("#3FD0FF"); crystalM.emissiveIntensity = 0.6 + p * 1.2;
          bannerM.color.set("#FFC83D"); carpetM.color.set("#1E6FD9");
          fireM.color.set("#FFE08A"); fireM.emissive.set("#FFB020");
          purple.color.set("#7FE0FF");
        }
      });
    }

    /* ---------------- MONTAGEM (após as definições acima) ---------------- */
    /* ---------------- bairros ---------------- */
    W.zones.forEach((z, zi) => {
      if (zi === 8) buildBossZone(z);
      else buildZone(z, zi);
    });

    /* ---------------- fileiras de prédios (muralhas) ---------------- */
    buildRows();
    buildBillboards();

    /* ---------------- portões entre etapas ---------------- */
    for (let k = 0; k < 8; k++) W.gates.push(buildGate(k));

    batch.build(root);

    /* =================================================================
     * CONSULTAS
     * =============================================================== */
    W.groundHeight = function (x, z) {
      for (const r of W.raised) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return CURB;
      return 0;
    };
    /* Índice da etapa (0..8) do bairro onde o ponto está. */
    /* Tipo de piso em um ponto (usado pelo som dos passos). */
    W.surfaceAt = function (x, z) {
      if (W.groundHeight(x, z) < 0.05) return "asfalto";
      for (const q of W.minimap.quads) {
        if (q.kind !== "park" || x < q.x0 + 2.2 || x > q.x1 - 2.2 || z < q.z0 + 2.2 || z > q.z1 - 2.2) continue;
        const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
        if (Math.abs(x - cx) < 1.3 || Math.abs(z - cz) < 1.3) return "calcada"; // caminhos de terra batida
        return "grama";
      }
      return "calcada";
    };
    W.zoneAt = function (x, z) {
      const c = U.clamp(Math.floor((x + EDGE) / S), 0, 2), r = U.clamp(Math.floor((z + EDGE) / S), 0, 2);
      return ZONE_GRID.findIndex(([cc, rr]) => cc === c && rr === r);
    };
    W.start = { x: W.zones[0].x - 27, z: W.zones[0].z + 1.5, heading: Math.PI / 2 };

    W.update = function (dt, t, playerPos) {
      W.lastPlayerPos = playerPos;
      W.animated.forEach((f) => f(dt, t));
      // chefe (Corrupson): animações e gestos, só quando o jogador está por perto
      const Bo = W.boss;
      if (Bo && Bo.ch.root.visible && (!playerPos || Math.hypot(playerPos.x - Bo.x, playerPos.z - Bo.z) < 90)) Bo.ch.update(dt);
      // Seu Lima: vira para o jogador e acena de tempos em tempos
      const L = W.seuLima;
      if (L) {
        const ch = L.ch;
        if (!L.yOk) { L.yOk = true; ch.root.position.y = W.groundHeight(L.x, L.z); }
        let want = L.base;
        const d = playerPos ? Math.hypot(playerPos.x - L.x, playerPos.z - L.z) : 99;
        if (playerPos && d < 16) want = Math.atan2(playerPos.x - L.x, playerPos.z - L.z);
        ch.root.rotation.y += U.angleDiff(ch.root.rotation.y, want) * Math.min(1, dt * 4);
        if (L.falando) { if (ch.mode !== "salute") ch.mode = "talk"; }   // começa batendo continência
        else {
          if (ch.mode === "talk") ch.mode = "idle";
          L.t += dt;
          if (ch.mode !== "wave" && L.t > (d < 16 ? 1.6 : 3.5)) { ch.mode = "wave"; L.t = 0; }
          if (ch.mode === "wave") L.t = 0;
        }
        ch.speed = 0;
        ch.root.visible = d < 70;
        if (ch.root.visible) ch.update(dt);
        // exclamação: flutua acima da cabeça e some durante a conversa
        if (L.exc) {
          L.excA = U.damp(L.excA, L.falando ? 0 : 1, 8, dt);
          const e = L.exc, pulse = 1 + Math.sin(t * 5) * 0.06;
          e.visible = ch.root.visible && L.excA > 0.02;
          e.material.opacity = L.excA;
          e.position.set(L.x, ch.root.position.y + 2.28 + Math.sin(t * 2.6) * 0.09, L.z);
          e.scale.set(0.34 * pulse * L.excA, 0.68 * pulse * L.excA, 1);
        }
      }
      // pedestres
      W.pedestrians.forEach((p) => {
        // longe do jogador: some (economiza desempenho; a névoa já esconde)
        if (playerPos) {
          const far = Math.hypot(playerPos.x - p.ch.root.position.x, playerPos.z - p.ch.root.position.z) > 62;
          p.ch.root.visible = !far;
          if (far) return;
        }
        if (p.wait > 0) { p.wait -= dt; p.ch.speed = 0; p.ch.update(dt); return; }
        const tgt = p.dir > 0 ? p.b : p.a;
        const dx = tgt.x - p.ch.root.position.x, dz = tgt.z - p.ch.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) { p.dir *= -1; p.wait = 1 + Math.random() * 2; return; }
        const sp = 1.6;
        // espera se o jogador estiver muito perto
        if (playerPos && Math.hypot(playerPos.x - p.ch.root.position.x, playerPos.z - p.ch.root.position.z) < 1.6) { p.ch.speed = 0; p.ch.update(dt); return; }
        p.ch.root.position.x += (dx / d) * sp * dt; p.ch.root.position.z += (dz / d) * sp * dt;
        const want = Math.atan2(dx, dz);
        p.ch.root.rotation.y += U.angleDiff(p.ch.root.rotation.y, want) * Math.min(1, dt * 8);
        p.ch.speed = 0.55; p.ch.update(dt);
      });
    };

    return W;
  };

})();
