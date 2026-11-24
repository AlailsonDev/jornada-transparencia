/* =====================================================================
 * TEMPO, ESTAÇÕES E CLIMA
 * ---------------------------------------------------------------------
 * Controla céu, sol/lua, nuvens, chuva, poças, folhas caindo, flores,
 * cores das árvores e iluminação noturna (postes e janelas).
 *
 * O estado visual é um conjunto de números que muda aos poucos:
 *   hora (0–24), nuvens (0–1), chuva (0–1), molhado (0–1) e o peso de
 *   cada estação (primavera, verão, outono, inverno).
 * A sequência da jornada fica em CT.TEMPO (data.js).
 *
 * Desempenho: chuva e folhas são animadas na placa de vídeo (shader),
 * poças e luzes dos postes são instâncias (1 chamada de desenho cada),
 * e só 3 luzes pontuais reais acompanham o jogador à noite.
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U;
  const C = (h) => new THREE.Color(h);
  const SEASONS = ["primavera", "verao", "outono", "inverno"];
  const SEASON_LABEL = { primavera: "Primavera", verao: "Verão", outono: "Outono", inverno: "Inverno" };

  /* Paletas por estação [primavera, verão, outono, inverno] */
  const LEAF = [
    ["#7ED07A", "#3E9A55", "#E8A23A", "#8FA597"],
    ["#96DC84", "#2F8A4A", "#D9662A", "#7E968A"],
    ["#66C26E", "#4FA85A", "#C7452E", "#9DB0A5"],
    ["#A4E08E", "#378F4D", "#F0C445", "#A9B9B0"],
  ].map((r) => r.map(C));
  const PINE = ["#3C9A58", "#2B7F45", "#2E7445", "#6E8F83"].map(C);
  const GRASS = { park: ["#86C96F", "#78B85A", "#A9B25C", "#9AA89A"].map(C), field: ["#A3D08F", "#9CC27A", "#BDB873", "#A9B5A8"].map(C) };
  const FLOWER_ALPHA = [1, 0.75, 0.08, 0];

  /* Cores do céu */
  const SKY = {
    clear: { top: C("#4E9CF0"), hor: C("#BFE3FF"), bot: C("#F2E7D6") },
    summer: { top: C("#3388EE"), hor: C("#B3DDFF"), bot: C("#F5E6CF") },
    over: { top: C("#7D8896"), hor: C("#B9C1CB"), bot: C("#A9AFB6") },
    sunset: { top: C("#3F5A9C"), hor: C("#FFB27A"), bot: C("#E9A27C") },
    night: { top: C("#050B20"), hor: C("#16213F"), bot: C("#0B1020") },
  };

  function seasonVec(name) { return SEASONS.map((s) => (s === name ? 1 : 0)); }
  function stateFrom(def) {
    const cl = CT.CLIMAS[def.clima] || CT.CLIMAS.sol;
    return { hour: def.hora, cloud: cl.nuvens, rain: cl.chuva, season: seasonVec(def.estacao), def };
  }
  function lerpState(a, b, t) {
    return { hour: U.lerp(a.hour, b.hour, t), cloud: U.lerp(a.cloud, b.cloud, t), rain: U.lerp(a.rain, b.rain, t), season: a.season.map((v, i) => U.lerp(v, b.season[i], t)), def: t < 0.5 ? a.def : b.def };
  }
  const smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function radialTex(inner, outer) {
    return U.canvasTex(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, "0.45)")); g.addColorStop(1, outer);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  }

  CT.createAtmosphere = function (scene, W) {
    const atm = { reg: { leaf: [], pine: [], grass: [], flower: [], window: [], bulb: [], wet: [], lamps: [] } };
    const R = atm.reg;
    const group = new THREE.Group(); scene.add(group); // acompanha o jogador
    atm.group = group;

    /* ---------------- luzes principais ---------------- */
    const hemi = new THREE.HemisphereLight("#DDF0FF", "#9C8A6A", 0.75); scene.add(hemi);
    const sun = new THREE.DirectionalLight("#FFF1DC", 1.25);
    sun.castShadow = !!CT.CONFIG.sombras;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 10, far: 300 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    W.sun = sun; W.hemi = hemi;

    /* ---------------- céu (shader) ---------------- */
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: C("#4E9CF0") }, uHor: { value: C("#BFE3FF") }, uBot: { value: C("#F2E7D6") },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: C("#FFF1DC") }, uSunAmt: { value: 1 }, uGlow: { value: 1 },
      },
      vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 uTop, uHor, uBot, uSunDir, uSunColor; uniform float uSunAmt, uGlow; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float y = d.y;
          vec3 col = y > 0.0 ? mix(uHor, uTop, pow(clamp(y / 0.55, 0.0, 1.0), 0.75)) : mix(uHor, uBot, clamp(-y / 0.12, 0.0, 1.0));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (uGlow * (pow(s, 7.0) * 0.32 + pow(s, 60.0) * 0.35) + uSunAmt * smoothstep(0.9982, 0.9992, s) * 1.6);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), skyMat);
    sky.renderOrder = -2; group.add(sky); W.sky = group;
    scene.fog = new THREE.Fog("#D6ECFF", 110, 330);
    scene.background = C("#BFE3FF");

    // estrelas
    const starGeo = new THREE.BufferGeometry(), sp = [], rr = U.rng(99);
    for (let i = 0; i < 900; i++) {
      const u = rr() * Math.PI * 2, v = 0.06 + rr() * 0.94, r = 430;
      const y = v, k = Math.sqrt(1 - y * y);
      sp.push(Math.cos(u) * k * r, y * r, Math.sin(u) * k * r);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    const starMat = new THREE.PointsMaterial({ color: "#FFFFFF", size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -1; group.add(stars);
    // lua
    const moonTex = U.canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.32, "rgba(240,244,255,1)"); g.addColorStop(0.38, "rgba(200,215,255,0.35)"); g.addColorStop(1, "rgba(160,180,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "rgba(180,190,215,0.5)"; [[52, 54, 7], [74, 70, 5], [60, 78, 4]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    });
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    moon.scale.set(46, 46, 1); group.add(moon);

    // nuvens: cada uma aparece a partir de um nível de "nebulosidade"
    const cloudMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 1, emissive: "#FFFFFF", emissiveIntensity: 0.25, flatShading: true, fog: false });
    const clouds = [];
    const cr = U.rng(7);
    for (let i = 0; i < 28; i++) {
      const c = new THREE.Group();
      const n = 4 + Math.floor(cr() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + cr() * 7, 0), cloudMat);
        m.position.set(j * 7 - n * 3.5, cr() * 3, (cr() - 0.5) * 9); m.scale.y = 0.55; c.add(m);
      }
      const a = cr() * Math.PI * 2, d = 90 + cr() * 190;
      c.userData = { a, d, h: 70 + cr() * 35, th: (i + cr() * 0.8) / 28.8, base: 0.8 + cr() * 0.6, spin: (cr() - 0.5) * 0.01 };
      group.add(c); clouds.push(c);
    }

    /* ---------------- estado ---------------- */
    let cur = stateFrom(CT.TEMPO[0]), from = cur, to = cur, tt = 1, dur = 1;
    let wet = 0, time = 0, flash = 0, nextThunder = 8, envT = 0, envKey = "";
    atm.set = function (def) { cur = from = to = stateFrom(def); tt = 1; wet = cur.rain > 0.2 ? 0.8 : 0; envKey = ""; };
    atm.goTo = function (def, seconds) { from = cur; to = stateFrom(def); tt = 0; dur = seconds || CT.CONFIG.duracaoTransicaoTempo || 9; };
    atm.state = () => cur;
    atm.wetness = () => wet;
    atm.target = () => to;

    /* ---------------- objetos criados após a cidade ---------------- */
    let rain, rainMat, leaves, leafMat, puddles, puddleMat, pools, poolMat, halos, haloMat, pmrem, envRT, envScene;
    const pts = [];
    let playerLight;
    const MAX_RAIN = 2600, MAX_LEAF = 260;

    atm.finalize = function (renderer) {
      /* chuva: segmentos de linha animados no shader */
      const rg = new THREE.BufferGeometry();
      const pos = new Float32Array(MAX_RAIN * 2 * 3), end = new Float32Array(MAX_RAIN * 2), rnd = new Float32Array(MAX_RAIN * 2);
      const r = U.rng(5);
      for (let i = 0; i < MAX_RAIN; i++) {
        const x = (r() - 0.5) * 70, y = r() * 40, z = (r() - 0.5) * 70, q = r();
        for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; rnd[i * 2 + k] = q; }
      }
      rg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      rg.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
      rg.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
      rainMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uColor: { value: C("#C9D6EA") }, uLen: { value: 0.9 } },
        vertexShader: `uniform float uTime, uLen; uniform vec3 uCenter; attribute float aEnd; attribute float aRand; varying float vA;
          void main(){ vec3 p = position; float y = mod(p.y - uTime * (22.0 + 9.0 * aRand), 40.0);
            vec3 w = vec3(uCenter.x + p.x, uCenter.y - 6.0 + y, uCenter.z + p.z);
            w += vec3(0.18, -1.0, 0.08) * aEnd * uLen * (0.8 + 0.5 * aRand);
            vA = 1.0 - aEnd * 0.85; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
        fragmentShader: "uniform float uOpacity; uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, uOpacity * vA); }",
      });
      rain = new THREE.LineSegments(rg, rainMat); rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);

      /* folhas (outono) e pétalas (primavera) */
      const lg = new THREE.BufferGeometry();
      const lp = new Float32Array(MAX_LEAF * 3), lr = new Float32Array(MAX_LEAF);
      for (let i = 0; i < MAX_LEAF; i++) { lp.set([(r() - 0.5) * 60, r() * 22, (r() - 0.5) * 60], i * 3); lr[i] = r(); }
      lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
      lg.setAttribute("aRand", new THREE.BufferAttribute(lr, 1));
      leafMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uAutumn: { value: 1 }, uScale: { value: 300 } },
        vertexShader: `uniform float uTime, uScale; uniform vec3 uCenter; attribute float aRand; varying float vR; varying float vRot;
          void main(){ vec3 p = position; float t = uTime * (0.7 + 0.6 * aRand);
            float y = mod(p.y - t * 1.6, 22.0);
            vec3 w = vec3(uCenter.x + p.x + sin(t * 1.3 + aRand * 6.28) * 1.4, uCenter.y - 3.0 + y, uCenter.z + p.z + cos(t * 0.9 + aRand * 9.0) * 1.1);
            vec4 mv = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv;
            float dz = -mv.z; gl_PointSize = dz < 2.5 ? 0.0 : min((0.32 + aRand * 0.18) * uScale / dz, 16.0); vR = aRand; vRot = t * 2.0 + aRand * 6.0; }`,
        fragmentShader: `uniform float uOpacity, uAutumn; varying float vR; varying float vRot;
          void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot); c = mat2(co, -s, s, co) * c;
            float d = length(vec2(c.x * 2.1, c.y)); if (d > 0.5) discard;
            vec3 au = vR < 0.33 ? vec3(0.91, 0.55, 0.16) : (vR < 0.66 ? vec3(0.82, 0.32, 0.14) : vec3(0.95, 0.76, 0.22));
            vec3 pe = vR < 0.5 ? vec3(1.0, 0.72, 0.82) : vec3(1.0, 0.95, 0.97);
            gl_FragColor = vec4(mix(pe, au, uAutumn), uOpacity * (1.0 - d * 0.6));
            #include <encodings_fragment>
          }`,
      });
      leaves = new THREE.Points(lg, leafMat); leaves.frustumCulled = false; scene.add(leaves);

      /* poças nas ruas */
      const C0 = CT.WORLD_CONST;
      const spots = [];
      W.zones.forEach((z, zi) => {
        if (zi === 8) return;
        for (let i = 0; i < 12; i++) {
          const along = (r() - 0.5) * 2 * (C0.IN - 2), across = (r() - 0.5) * 2 * (C0.RD - 1.2);
          if (Math.abs(along) < 8) continue;
          spots.push(r() < 0.5 ? [z.x + along, z.z + across] : [z.x + across, z.z + along]);
        }
      });
      puddleMat = new THREE.MeshStandardMaterial({ color: "#1A2030", roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: 0.85 });
      const pg = new THREE.CircleGeometry(1, 22); pg.rotateX(-Math.PI / 2);
      puddles = new THREE.InstancedMesh(pg, puddleMat, spots.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      spots.forEach(([x, z], i) => {
        q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0));
        m4.compose(new THREE.Vector3(x, 0.025, z), q, new THREE.Vector3(1.1 + r() * 2.2, 1, 0.7 + r() * 1.4));
        puddles.setMatrixAt(i, m4);
      });
      puddles.receiveShadow = true; puddles.frustumCulled = false; puddles.renderOrder = 1; scene.add(puddles);

      /* luz dos postes: manchas no chão + halos (instâncias) */
      const lamps = R.lamps;
      poolMat = new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,214,150,0.9)", "rgba(255,200,120,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
      const plg = new THREE.PlaneGeometry(1, 1); plg.rotateX(-Math.PI / 2);
      pools = new THREE.InstancedMesh(plg, poolMat, Math.max(1, lamps.length));
      lamps.forEach((l, i) => { m4.compose(new THREE.Vector3(l.x, l.g + 0.04, l.z), new THREE.Quaternion(), new THREE.Vector3(10, 1, 10)); pools.setMatrixAt(i, m4); });
      pools.count = lamps.length; pools.frustumCulled = false; pools.renderOrder = 2; scene.add(pools);
      const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(lamps.flatMap((l) => [l.x, l.y, l.z]), 3));
      haloMat = new THREE.PointsMaterial({ map: radialTex("rgba(255,236,190,1)", "rgba(255,220,160,0)"), size: 3.4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      halos = new THREE.Points(hg, haloMat); halos.frustumCulled = false; scene.add(halos);

      /* 3 luzes reais que acompanham os postes mais próximos + luz do jogador */
      for (let i = 0; i < 3; i++) { const l = new THREE.PointLight("#FFD9A0", 0, 17, 2); scene.add(l); pts.push(l); }
      playerLight = new THREE.PointLight("#FFE8CC", 0, 11, 2); scene.add(playerLight);

      /* reflexos: mapa de ambiente gerado a partir do céu */
      pmrem = new THREE.PMREMGenerator(renderer);
      envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), skyMat));
      atm.renderer = renderer;
    };

    function updateEnv(force) {
      if (!pmrem) return;
      const key = [Math.round(cur.hour * 3), Math.round(cur.cloud * 6), Math.round(cur.rain * 4)].join(",");
      if (!force && (key === envKey || time - envT < 0.9)) return;
      envKey = key; envT = time;
      const old = envRT;
      envRT = pmrem.fromScene(envScene, 0, 1, 300);
      puddleMat.envMap = envRT.texture; puddleMat.needsUpdate = !old;
      R.wet.forEach((w) => { w.mat.envMap = envRT.texture; if (!old) w.mat.needsUpdate = true; });
      if (old) old.dispose();
    }

    /* ---------------- áudio de chuva e trovão ---------------- */
    let rainGain = null;
    function ensureAudio() {
      const A = CT.Audio;
      if (rainGain || !A || !A.ctx) return;
      const ctx = A.ctx, len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.55 + last * 2.4; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      src.connect(hp).connect(lp).connect(rainGain).connect(ctx.destination); src.start();
    }
    function thunder() {
      const A = CT.Audio; if (!A || !A.ctx || A.muted) return;
      const ctx = A.ctx, len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 6 * Math.pow(1 - i / len, 2); }
      const s = ctx.createBufferSource(); s.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
      const g = ctx.createGain(); g.gain.value = 0.5;
      s.connect(lp).connect(g).connect(ctx.destination); s.start(ctx.currentTime + 0.9);
    }

    /* ---------------- rótulo para a interface ---------------- */
    atm.label = function () {
      const st = tt < 1 ? to : cur;
      const h = cur.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
      const def = st.def || {};
      const night = h >= 18.6 || h < 5.5;
      const cl = def.clima || "sol";
      let icon = cl === "chuva-forte" || cl === "chuva-fraca" ? "rain" : cl === "nublado" ? "cloud" : cl === "parcial" ? "partly" : "sun";
      if (night && icon === "sun") icon = "moon";
      if (night && icon === "partly") icon = "moon";
      return { hora: String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"), estacao: SEASON_LABEL[def.estacao] || "", clima: night && cl === "sol" ? "Céu limpo" : ((CT.CLIMAS[cl] || {}).rotulo || ""), icon, estacaoId: def.estacao };
    };

    /* ---------------- atualização por quadro ---------------- */
    const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
    let lampT = 0;
    atm.update = function (dt, center, opts) {
      opts = opts || {};
      time += dt;
      if (tt < 1) { tt = Math.min(1, tt + dt / dur); cur = lerpState(from, to, U.easeInOut(tt)); }
      const S = cur, sw = S.season; // pesos das estações
      const [spring, summer, autumn, winter] = sw;
      // chão molhado acompanha a chuva (seca devagar)
      const wantWet = U.clamp(S.rain * 1.4, 0, 1);
      wet += (wantWet - wet) * Math.min(1, dt * (wantWet > wet ? 0.35 : 0.06));

      /* sol e lua */
      const ang = Math.PI * (S.hour - 6) / 12;
      sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.42).normalize();
      moonDir.set(-sunDir.x * 0.6, Math.max(0.35, -sunDir.y + 0.25), -0.5).normalize();
      const sy = sunDir.y;
      const day = smooth(-0.12, 0.2, sy), night = 1 - day;
      const sunset = (1 - smooth(0.06, 0.38, sy)) * smooth(-0.16, 0.02, sy);
      const cloud = S.cloud, rainK = S.rain;

      // luz do sol
      tmpC.set("#FFF3DE").lerp(C("#FF7F32"), sunset * 0.92);
      if (summer > 0) tmpC.lerp(C("#FFE9BE"), summer * 0.35);
      if (winter > 0) tmpC.lerp(C("#DCE6FF"), winter * 0.5);
      let sunI = day * (1.2 + 0.45 * summer - 0.2 * winter) * (1 - 0.8 * cloud) * (1 - 0.15 * sunset);
      const moonI = night * 0.32 * (1 - 0.55 * cloud);
      const useSun = sy > -0.05;
      sun.color.copy(useSun ? tmpC : C("#A9BEFF"));
      sun.intensity = (useSun ? sunI : moonI) + flash * 0.5;
      const dir = useSun ? sunDir : moonDir;
      sun.position.set(center.x + dir.x * 120, dir.y * 120 + 2, center.z + dir.z * 120);
      sun.target.position.set(center.x, 0, center.z);

      // luz ambiente (hemisfério): mais difusa com nuvens, mais escura à noite
      tmpC.set("#DDF0FF").lerp(C("#B9C2CE"), cloud).lerp(C("#FFAE78"), sunset * 0.75).lerp(C("#2E3E6E"), night);
      hemi.color.copy(tmpC);
      hemi.groundColor.set("#9C8A6A").lerp(C("#6F7468"), cloud * 0.6).lerp(C("#C4704A"), sunset * 0.45).lerp(C("#1E2233"), night);
      hemi.intensity = (0.64 + 0.04 * cloud - 0.14 * summer + 0.06 * sunset) * day * (1 - 0.22 * rainK) + 0.4 * night + flash * 1.2;

      // céu
      const u = skyMat.uniforms;
      const base = (k) => tmpC2.copy(SKY.clear[k]).lerp(SKY.summer[k], summer).lerp(SKY.over[k], U.clamp(cloud * 1.05, 0, 1) * (0.55 + 0.45 * cloud)).lerp(SKY.sunset[k], sunset * (1 - cloud * 0.6)).lerp(SKY.night[k], night);
      u.uTop.value.copy(base("top")); u.uHor.value.copy(base("hor")); u.uBot.value.copy(base("bot"));
      if (flash > 0) { u.uTop.value.lerp(C("#C9D3FF"), flash * 0.6); u.uHor.value.lerp(C("#E6EAFF"), flash * 0.6); }
      u.uSunDir.value.copy(sunDir);
      u.uSunColor.value.copy(useSun ? sun.color : C("#000000"));
      u.uSunAmt.value = day * (1 - cloud * 0.95);
      u.uGlow.value = day * (1 - cloud * 0.8) + sunset * 0.6;
      scene.fog.color.copy(u.uHor.value);
      scene.background.copy(u.uHor.value);
      scene.fog.near = U.lerp(110, 38, rainK) * U.lerp(1, 0.75, night);
      scene.fog.far = U.lerp(330, 170, rainK);
      starMat.opacity = night * (1 - cloud * 0.92);
      moon.material.opacity = night * (1 - cloud * 0.75);
      moon.position.copy(moonDir).multiplyScalar(400);
      group.position.set(center.x, 0, center.z);

      // nuvens
      tmpC.set("#FFFFFF").lerp(C("#A2AAB4"), Math.pow(cloud, 1.4)).lerp(C("#727A86"), rainK * 0.7).lerp(C("#FFB98A"), sunset * 0.55 * (1 - cloud * 0.5)).lerp(C("#252C42"), night * 0.92);
      cloudMat.color.copy(tmpC); cloudMat.emissive.copy(tmpC); cloudMat.emissiveIntensity = 0.28 * (1 - night * 0.7);
      clouds.forEach((c) => {
        const d = c.userData;
        const a = smooth(d.th - 0.09, d.th + 0.06, cloud * 1.08);
        c.visible = a > 0.01;
        if (!c.visible) return;
        d.a += dt * (0.004 + d.spin * 0.2);
        const sc = d.base * a * (1 + cloud * 0.55);
        c.scale.set(sc, sc * (0.9 + cloud * 0.4), sc);
        c.position.set(Math.cos(d.a) * d.d, d.h - cloud * 18, Math.sin(d.a) * d.d);
      });

      // exposição e relâmpagos
      if (atm.renderer) atm.renderer.toneMappingExposure = 1.0 + 0.08 * summer - 0.05 * winter + 0.12 * night - 0.18 * cloud * day - 0.06 * sunset;
      if (rainK > 0.75 && !opts.inside) {
        nextThunder -= dt;
        if (nextThunder <= 0) { nextThunder = 9 + Math.random() * 10; flash = 1; setTimeout(() => (flash = 0.7), 180); thunder(); }
      }
      flash = Math.max(0, flash - dt * 5);

      /* estações: folhagem, grama e flores */
      const mixPal = (pal, out) => { out.setRGB(0, 0, 0); for (let i = 0; i < 4; i++) { out.r += pal[i].r * sw[i]; out.g += pal[i].g * sw[i]; out.b += pal[i].b * sw[i]; } return out; };
      R.leaf.forEach((l) => mixPal(LEAF[l.i % 4], l.mat.color));
      R.pine.forEach((m) => mixPal(PINE, m.color));
      R.grass.forEach((g) => mixPal(GRASS[g.kind] || GRASS.park, g.mat.color));
      const fa = sw.reduce((s, w, i) => s + w * FLOWER_ALPHA[i], 0);
      R.flower.forEach((m) => { m.opacity = fa; m.visible = fa > 0.02; });

      /* chuva, folhas e poças */
      if (rain) {
        rainMat.uniforms.uTime.value = time;
        rainMat.uniforms.uCenter.value.set(center.x, center.y, center.z);
        rainMat.uniforms.uOpacity.value = 0.55 * smooth(0.02, 0.3, rainK);
        rainMat.uniforms.uColor.value.set("#C9D6EA").lerp(C("#5D6A88"), night * 0.6);
        rain.geometry.setDrawRange(0, Math.floor(MAX_RAIN * U.clamp(rainK, 0, 1)) * 2);
        rain.visible = rainK > 0.01 && !opts.inside;
        const leafAmt = autumn * (1 - rainK * 0.8) + spring * 0.45 * (1 - rainK);
        leafMat.uniforms.uTime.value = time;
        leafMat.uniforms.uCenter.value.set(center.x, center.y, center.z);
        leafMat.uniforms.uOpacity.value = U.clamp(leafAmt * 1.3, 0, 0.95) * (1 - night * 0.5);
        leafMat.uniforms.uAutumn.value = autumn / Math.max(0.001, autumn + spring);
        leafMat.uniforms.uScale.value = (atm.renderer ? atm.renderer.domElement.height : 800) * 0.75;
        leaves.geometry.setDrawRange(0, Math.floor(MAX_LEAF * U.clamp(leafAmt, 0, 1)));
        leaves.visible = leafAmt > 0.02 && !opts.inside;
        puddleMat.opacity = wet * 0.7;
        puddles.visible = wet > 0.02;
        R.wet.forEach((w) => {
          w.mat.roughness = U.lerp(w.rough, w.wetRough, wet);
          w.mat.color.copy(w.base).lerp(w.wetColor, wet);
          w.mat.envMapIntensity = wet * (w.env || 0.7);
        });
        if (wet > 0.02) updateEnv(false); // reflexos só importam com o chão molhado

        /* noite: postes, janelas e luzes reais */
        const nl = smooth(0.15, 0.85, night);
        const dusk = U.clamp(nl + rainK * 0.25 * day + cloud * 0.08 * day, 0, 1);
        R.bulb.forEach((m) => (m.emissiveIntensity = 0.35 + dusk * 2.4));
        R.window.forEach((m) => (m.emissiveIntensity = U.clamp(nl * 1.15 + rainK * 0.3 * day, 0, 1.25)));
        poolMat.opacity = nl * 0.6 + rainK * 0.12 * day;
        haloMat.opacity = dusk * 0.85;
        pts.forEach((l) => (l.intensity = nl * 1.6));
        playerLight.intensity = nl * (opts.inside ? 0 : 0.7);
        playerLight.position.set(center.x, center.y + 3.2, center.z);
        lampT -= dt;
        if (lampT <= 0 && nl > 0.01) {
          lampT = 0.4;
          const near = R.lamps.map((l) => ({ l, d: (l.x - center.x) ** 2 + (l.z - center.z) ** 2 })).sort((a, b) => a.d - b.d);
          pts.forEach((p, i) => { const l = near[i] && near[i].l; if (l) p.position.set(l.x, l.y - 0.4, l.z); });
        }
      }

      /* som da chuva */
      ensureAudio();
      if (rainGain) {
        const muted = CT.Audio.muted;
        const target = muted ? 0 : rainK * (opts.inside ? 0.05 : 0.16);
        rainGain.gain.value += (target - rainGain.gain.value) * Math.min(1, dt * 2);
      }
    };

    /* registro feito pela cidade durante a construção */
    atm.leafMat = (mat, i) => { if (!R.leaf.some((l) => l.mat === mat)) R.leaf.push({ mat, i }); };
    atm.pineMat = (mat) => { if (!R.pine.includes(mat)) R.pine.push(mat); };
    atm.grassMat = (mat, kind) => { if (!R.grass.some((g) => g.mat === mat)) R.grass.push({ mat, kind }); };
    atm.flowerMat = (mat) => { if (!R.flower.includes(mat)) R.flower.push(mat); };
    atm.windowMat = (mat) => { if (!R.window.includes(mat)) R.window.push(mat); };
    atm.bulbMat = (mat) => { if (!R.bulb.includes(mat)) R.bulb.push(mat); };
    atm.lamp = (x, y, z, g) => R.lamps.push({ x, y, z, g: g || 0 });
    atm.wetMat = (mat, o) => { if (!R.wet.some((w) => w.mat === mat)) R.wet.push(Object.assign({ mat, base: mat.color.clone(), rough: mat.roughness, wetRough: 0.32, wetColor: mat.color.clone().multiplyScalar(0.62), env: 0.8 }, o || {})); };

    return atm;
  };
})();
