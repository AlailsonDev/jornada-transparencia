/* =====================================================================
 * PERSONAGENS 3D (protagonista, NPCs e chefe final)
 * Montados com formas simples e animados por código: caminhar, falar,
 * comemorar, acenar e respirar.
 * O personagem "olha" para +Z local. Rotação Y = direção.
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U;

  function capsule(r, len, color, parent, x, y, z) {
    const g = U.geo("cap" + r + "_" + len, () => new THREE.CapsuleGeometry(r, len, 6, 14));
    return U.mesh(g, U.mat(color), x, y, z, parent);
  }

  /**
   * Cria um personagem.
   * @param {object} o  pele, cabelo, estiloCabelo, camisa, calca, sapato,
   *                    acessorio, escala, mochila, boss
   */
  CT.createCharacter = function (o) {
    o = Object.assign({ pele: "#D9A07A", cabelo: "#2B1A12", estiloCabelo: "curto", camisa: "#1E6FD9", calca: "#25324A", sapato: "#1B1E27", acessorio: "", escala: 1 }, o);
    const root = new THREE.Group();
    const inner = new THREE.Group(); // recebe o pulo/balanço
    root.add(inner);
    inner.scale.setScalar(o.escala);

    const HIP = 0.92;
    const hips = new THREE.Group(); hips.position.y = HIP; inner.add(hips);

    // Tronco
    const torso = capsule(0.25, 0.36, o.camisa, hips, 0, 0.36, 0);
    torso.scale.set(1.12, 1, 0.78);
    // Cintura (calça)
    const waist = capsule(0.22, 0.04, o.calca, hips, 0, 0.02, 0); waist.scale.set(1.18, 1, 0.82);
    // Pescoço
    U.mesh(U.cyl(0.08, 0.09, 0.14, 10), U.mat(o.pele), 0, 0.76, 0, hips);

    // Cabeça
    const head = new THREE.Group(); head.position.y = 0.98; hips.add(head);
    const skull = U.mesh(U.sph(0.25, 24, 18), U.mat(o.pele), 0, 0, 0, head);
    skull.scale.set(1, 1.04, 0.98);
    // olhos
    const eyeM = U.mat("#1B1B22", { roughness: 0.3 });
    const shineM = U.mat("#FFFFFF", { emissive: "#FFFFFF", emissiveIntensity: 0.6 });
    [-1, 1].forEach((s) => {
      U.mesh(U.sph(0.036, 10, 8), eyeM, s * 0.088, 0.02, 0.222, head, false);
      U.mesh(U.sph(0.011, 6, 6), shineM, s * 0.088 + 0.012, 0.035, 0.252, head, false);
      const brow = U.mesh(U.box(0.075, 0.018, 0.02), U.mat(o.estiloCabelo === "calvo" ? "#CFCFCF" : o.cabelo), s * 0.09, 0.1, 0.225, head, false);
      brow.rotation.z = s * -0.12;
    });
    // nariz e sorriso
    U.mesh(U.sph(0.032, 8, 6), U.mat(U.shade(o.pele, -0.08)), 0, -0.035, 0.248, head, false);
    const smile = new THREE.Mesh(U.geo("smile", () => new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI)), U.mat("#6E2B2B"));
    smile.position.set(0, -0.085, 0.226); smile.rotation.z = Math.PI; head.add(smile);
    // bochechas
    const cheekM = U.mat("#F08C8C", { transparent: true, opacity: 0.35 });
    [-1, 1].forEach((s) => U.mesh(U.sph(0.035, 8, 6), cheekM, s * 0.15, -0.05, 0.19, head, false));
    // orelhas
    [-1, 1].forEach((s) => U.mesh(U.sph(0.05, 8, 6), U.mat(o.pele), s * 0.245, 0, 0, head, false));

    buildHair(head, o);
    buildAccessory(head, hips, o);

    // Braços (pivô no ombro)
    const arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.36, 0.6, 0); hips.add(pivot);
      capsule(0.08, 0.38, o.camisa, pivot, 0, -0.24, 0);
      const fore = capsule(0.07, 0.12, o.boss ? o.camisa : o.pele, pivot, 0, -0.5, 0);
      if (o.mangaLonga) fore.material = U.mat(o.camisa);
      U.mesh(U.sph(0.085, 12, 10), U.mat(o.boss ? "#F2F2F2" : o.pele), 0, -0.64, 0, pivot);
      return pivot;
    });

    // Pernas (pivô no quadril)
    const legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.13, HIP, 0); inner.add(pivot);
      capsule(0.1, 0.58, o.calca, pivot, 0, -0.41, 0);
      const shoe = U.mesh(U.box(0.18, 0.11, 0.3), U.mat(o.sapato), 0, -0.86, 0.05, pivot);
      return pivot;
    });

    if (o.mochila) {
      const bag = U.mesh(U.box(0.42, 0.46, 0.2), U.mat("#2D3E8F"), 0, 0.38, -0.25, hips);
      U.mesh(U.box(0.3, 0.16, 0.06), U.mat("#FFC83D"), 0, 0.3, -0.37, hips);
    }

    const ch = {
      root, inner, hips, head, arms, legs,
      phase: Math.random() * 10, t: Math.random() * 10,
      speed: 0,          // 0 parado, 1 caminhando, ~1.7 correndo
      mode: "idle",      // idle | talk | celebrate | wave | defeat
      extras: {},
    };
    ch.update = function (dt) { animate(ch, dt); };
    return ch;
  };

  function buildHair(head, o) {
    const hm = U.mat(o.cabelo, { roughness: 0.9 });
    const st = o.estiloCabelo;
    if (st === "calvo") {
      const ring = U.mesh(U.geo("hairRing", () => new THREE.TorusGeometry(0.2, 0.06, 8, 20)), U.mat("#E6E6E6"), 0, 0.02, -0.04, head);
      ring.rotation.x = Math.PI / 2; ring.scale.set(1.1, 1.1, 0.7);
      return;
    }
    if (st === "bone") {
      const cap = U.mesh(U.geo("capTop", () => new THREE.SphereGeometry(0.265, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), U.mat(o.boneCor || "#2D3E8F"), 0, 0.03, 0, head);
      const brim = U.mesh(U.box(0.34, 0.03, 0.2), U.mat(o.boneCor || "#2D3E8F"), 0, 0.05, 0.27, head);
      U.mesh(U.sph(0.03, 8, 6), U.mat("#FFC83D"), 0, 0.29, 0, head);
      const back = U.mesh(U.sph(0.25, 16, 12), hm, 0, -0.02, -0.06, head); back.scale.set(1.04, 0.72, 0.95);
      return;
    }
    // base para todos os outros estilos
    const top = U.mesh(U.geo("hairTop", () => new THREE.SphereGeometry(0.268, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), hm, 0, 0.0, -0.01, head);
    top.rotation.x = -0.18;
    if (st === "longo") {
      U.mesh(U.box(0.5, 0.55, 0.16), hm, 0, -0.2, -0.16, head);
      [-1, 1].forEach((s) => U.mesh(U.box(0.09, 0.42, 0.22), hm, s * 0.23, -0.14, -0.02, head));
    } else if (st === "coque") {
      U.mesh(U.sph(0.13, 12, 10), hm, 0, 0.18, -0.2, head);
    } else if (st === "rabo") {
      const tail = U.mesh(U.geo("tail", () => new THREE.CapsuleGeometry(0.075, 0.3, 4, 10)), hm, 0, -0.08, -0.3, head);
      tail.rotation.x = 0.4;
    } else if (st === "topete") {
      const q = U.mesh(U.sph(0.12, 10, 8), hm, 0, 0.22, 0.1, head); q.scale.set(1.4, 0.7, 1);
    }
  }

  function buildAccessory(head, hips, o) {
    const a = o.acessorio;
    if (a === "oculos") {
      const fm = U.mat("#1B1B22");
      const ring = U.geo("glass", () => new THREE.TorusGeometry(0.056, 0.011, 6, 16));
      [-1, 1].forEach((s) => U.mesh(ring, fm, s * 0.088, 0.02, 0.245, head, false));
      U.mesh(U.box(0.06, 0.012, 0.012), fm, 0, 0.03, 0.25, head, false);
    } else if (a === "cracha") {
      U.mesh(U.box(0.12, 0.15, 0.02), U.mat("#FFFFFF"), 0.12, 0.42, 0.2, hips, false);
      U.mesh(U.box(0.12, 0.04, 0.022), U.mat("#1E6FD9"), 0.12, 0.48, 0.2, hips, false);
    } else if (a === "headset") {
      const band = U.mesh(U.geo("hs", () => new THREE.TorusGeometry(0.27, 0.02, 6, 20, Math.PI)), U.mat("#22252E"), 0, 0.02, 0, head);
      band.rotation.z = 0;
      [-1, 1].forEach((s) => U.mesh(U.cyl(0.065, 0.065, 0.06, 12), U.mat("#22252E"), s * 0.27, 0, 0, head).rotation.z = Math.PI / 2);
      const mic = U.mesh(U.box(0.02, 0.02, 0.18), U.mat("#22252E"), -0.24, -0.1, 0.12, head); mic.rotation.y = 0.5;
    } else if (a === "bigode") {
      const m = U.mesh(U.box(0.15, 0.035, 0.03), U.mat("#E6E6E6"), 0, -0.06, 0.245, head, false);
    } else if (a === "gravata") {
      U.mesh(U.box(0.08, 0.32, 0.03), U.mat("#C0392B"), 0, 0.42, 0.21, hips, false);
      U.mesh(U.box(0.1, 0.07, 0.035), U.mat("#C0392B"), 0, 0.6, 0.21, hips, false);
    } else if (a === "capacete") {
      U.mesh(U.geo("helm", () => new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), U.mat("#FFD21F", { roughness: 0.4 }), 0, 0.04, 0, head);
      U.mesh(U.cyl(0.33, 0.33, 0.03, 18), U.mat("#FFD21F", { roughness: 0.4 }), 0, 0.05, 0.02, head);
    }
  }

  function animate(ch, dt) {
    ch.t += dt;
    const s = ch.speed;
    const t = ch.t;
    ch.phase += dt * (5 + s * 5) * (s > 0.05 ? 1 : 0);
    const sw = Math.sin(ch.phase);
    const amp = Math.min(s, 1.6);

    // reset suave
    let armL = { x: 0, z: 0.08 }, armR = { x: 0, z: -0.08 };
    let legL = 0, legR = 0, bob = 0, headX = 0, headY = 0, innerY = 0, innerRotY = 0, lean = 0;

    if (s > 0.05) {
      legL = sw * 0.75 * amp; legR = -sw * 0.75 * amp;
      armL.x = -sw * 0.65 * amp; armR.x = sw * 0.65 * amp;
      bob = Math.abs(Math.cos(ch.phase)) * 0.06 * amp;
      lean = 0.06 * amp;
    } else {
      // respiração
      bob = Math.sin(t * 2) * 0.012;
      armL.z = 0.1 + Math.sin(t * 2) * 0.02; armR.z = -0.1 - Math.sin(t * 2) * 0.02;
    }

    if (ch.mode === "talk") {
      armR.x = -0.6 + Math.sin(t * 5) * 0.35; armR.z = -0.25 + Math.sin(t * 3) * 0.1;
      armL.x = -0.2 + Math.sin(t * 4 + 1) * 0.15;
      headX = Math.sin(t * 6) * 0.05; headY = Math.sin(t * 1.5) * 0.12;
    } else if (ch.mode === "wave") {
      armR.z = -2.6 + Math.sin(t * 9) * 0.35; armR.x = 0;
      headY = Math.sin(t * 1.5) * 0.1;
    } else if (ch.mode === "celebrate") {
      const j = Math.abs(Math.sin(t * 7));
      innerY = j * 0.45;
      armL.z = 2.7 + Math.sin(t * 14) * 0.2; armR.z = -2.7 - Math.sin(t * 14) * 0.2;
      legL = -j * 0.3; legR = -j * 0.3;
    } else if (ch.mode === "defeat") {
      innerRotY = t * 10;
      armL.z = 1.4; armR.z = -1.4;
    } else if (ch.mode === "taunt") {
      armL.z = 0.5; armL.x = -0.4;
      armR.x = -1.2 + Math.sin(t * 3) * 0.5; armR.z = -0.3;
      headX = -0.12 + Math.sin(t * 2) * 0.05; headY = Math.sin(t * 1.2) * 0.2;
      innerY = Math.abs(Math.sin(t * 2)) * 0.05;
    }

    const k = 1 - Math.exp(-dt * 14);
    const L = U.lerp;
    ch.legs[0].rotation.x = L(ch.legs[0].rotation.x, legL, k);
    ch.legs[1].rotation.x = L(ch.legs[1].rotation.x, legR, k);
    ch.arms[0].rotation.x = L(ch.arms[0].rotation.x, armL.x, k);
    ch.arms[0].rotation.z = L(ch.arms[0].rotation.z, armL.z, k);
    ch.arms[1].rotation.x = L(ch.arms[1].rotation.x, armR.x, k);
    ch.arms[1].rotation.z = L(ch.arms[1].rotation.z, armR.z, k);
    ch.hips.position.y = 0.92 + bob;
    ch.hips.rotation.x = L(ch.hips.rotation.x, lean, k);
    ch.head.rotation.x = L(ch.head.rotation.x, headX, k);
    ch.head.rotation.y = L(ch.head.rotation.y, headY, k);
    ch.inner.position.y = L(ch.inner.position.y, innerY, ch.mode === "celebrate" ? 1 : k);
    if (ch.mode === "defeat") ch.inner.rotation.y = innerRotY;
    else ch.inner.rotation.y = L(ch.inner.rotation.y, 0, k);
  }

  /* Protagonista: jaqueta amarela, boné e mochila de explorador. */
  CT.createPlayerProcedural = function () {
    return CT.createCharacter({
      pele: "#D49A72", cabelo: "#3A2416", estiloCabelo: "bone", boneCor: "#16305C",
      camisa: "#FFC12E", calca: "#1F3B6E", sapato: "#F4F4F4", mochila: true, mangaLonga: true,
    });
  };

  /* NPC a partir dos dados de CT.PREDIOS[i].npc */
  CT.createNPCProcedural = function (npc) {
    return CT.createCharacter({
      pele: npc.pele, cabelo: npc.cabelo, estiloCabelo: npc.estiloCabelo,
      camisa: npc.camisa, calca: npc.calca, acessorio: npc.acessorio,
    });
  };

  /* Chefe final (reserva, se o modelo 3D não carregar): vilão de capa roxa e cartola. */
  CT.createBossProcedural = function () {
    const ch = CT.createCharacter({
      pele: "#C9B6E8", cabelo: "#2A1840", estiloCabelo: "curto", camisa: "#2A2440", calca: "#1C1830",
      sapato: "#0E0B16", escala: 1.75, boss: true, mangaLonga: true,
    });
    const head = ch.head, hips = ch.hips;
    // óculos escuros
    const dark = U.mat("#0B0B10", { roughness: 0.15, metalness: 0.4 });
    [-1, 1].forEach((s) => U.mesh(U.box(0.13, 0.08, 0.03), dark, s * 0.09, 0.03, 0.245, head, false));
    U.mesh(U.box(0.24, 0.02, 0.02), dark, 0, 0.05, 0.25, head, false);
    // cartola
    const hatM = U.mat("#15121F");
    U.mesh(U.cyl(0.4, 0.4, 0.03, 24), hatM, 0, 0.2, 0, head);
    U.mesh(U.cyl(0.21, 0.23, 0.4, 24), hatM, 0, 0.42, 0, head);
    U.mesh(U.cyl(0.235, 0.235, 0.07, 24), U.mat("#8E44FF", { emissive: "#5B1FB8", emissiveIntensity: 0.6 }), 0, 0.27, 0, head);
    // gravata-borboleta
    [-1, 1].forEach((s) => { const b = U.mesh(U.cyl(0, 0.07, 0.12, 4), U.mat("#8E44FF"), s * 0.06, 0.66, 0.2, hips); b.rotation.z = s * Math.PI / 2; });
    // capa
    const capeM = new THREE.MeshStandardMaterial({ color: "#5B1FB8", side: THREE.DoubleSide, roughness: 0.6, emissive: "#2B0A60", emissiveIntensity: 0.3 });
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 1.3, 20, 1, true, Math.PI * 0.3, Math.PI * 1.4), capeM);
    cape.position.set(0, 0.05, -0.04); cape.castShadow = true; hips.add(cape);
    // colarinho alto da capa
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.34, 16, 1, true, Math.PI * 0.45, Math.PI * 1.1), capeM);
    collar.position.set(0, 0.78, -0.02); hips.add(collar);
    // carimbo gigante "SIGILOSO" na mão direita
    const stamp = new THREE.Group();
    U.mesh(U.cyl(0.05, 0.06, 0.32, 10), U.mat("#6B3B1F"), 0, 0.18, 0, stamp);
    U.mesh(U.sph(0.09, 10, 8), U.mat("#6B3B1F"), 0, 0.36, 0, stamp);
    U.mesh(U.box(0.34, 0.1, 0.22), U.mat("#C0392B"), 0, 0, 0, stamp);
    const stampLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), new THREE.MeshBasicMaterial({ map: U.signTex("SIGILOSO", { w: 512, h: 150, bg: "#C0392B", fg: "#fff", font: 90, radius: 10 }) }));
    stampLabel.position.set(0, 0, 0.111); stamp.add(stampLabel);
    stamp.position.set(0, -1.0, 0.02);
    ch.arms[1].add(stamp);
    ch.extras.stamp = stamp;
    ch.extras.cape = cape;
    return ch;
  };

  /* -------------------------------------------------------------------
   * FÁBRICAS USADAS PELO JOGO
   * Tentam primeiro os modelos 3D com esqueleto (models.js / CT.MODELOS).
   * Se o modelo não estiver disponível, usam o personagem provisório
   * desenhado em código, com a mesma interface.
   * ----------------------------------------------------------------- */
  const rig = (o) => (CT.createRigged ? CT.createRigged(o) : null);
  /* protagonista: def é um item de CT.PERSONAGENS (padrão: o primeiro) */
  CT.createPlayer = function (def) {
    const P = def || CT.PROTAGONISTA || {};
    return rig(Object.assign({}, P, { modelo: P.modelo || "feminino", nome: undefined })) || CT.createPlayerProcedural();
  };
  CT.createNPC = function (npc) {
    const chest = npc.acessorio === "cracha" || npc.acessorio === "gravata";
    return rig({
      modelo: npc.modelo || "feminino", camisa: npc.camisa, calca: npc.calca, pele: npc.pele, cabelo: npc.cabelo,
      acessorio: chest ? null : npc.acessorio, peito: chest ? npc.acessorio : null, altura: npc.altura, corpo: npc.corpo,
    }) || CT.createNPCProcedural(npc);
  };
  CT.createBoss = function () {
    return rig({ modelo: "corrupson" }) || CT.createBossProcedural();
  };
  /* Pedestres: variações de roupa sobre os modelos disponíveis */
  CT.createPedestrian = function (o) {
    return rig(o) || CT.createCharacter(o);
  };
})();
