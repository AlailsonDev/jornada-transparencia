/* =====================================================================
 * LÓGICA PRINCIPAL DO JOGO
 * Estados: title → city ⇄ interior (diálogo) → boss → victory
 * Progressão: o prédio i só fica disponível depois do prédio i-1;
 * concluir o prédio i abre o portão i (passagem para o bairro i+1).
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const U = CT.U, UI = CT.UI, A = CT.Audio;
  const CFG = CT.CONFIG;
  /** texto do teclado ou do toque; o CSS mostra o do modo atual (troca na hora) */
  const K = (teclado, toque) => `<span class="only-kbd">${teclado}</span><span class="only-touch">${toque}</span>`;
  const N = CT.PREDIOS.length; // 8 prédios

  let renderer, camera, world, interiors, player, arrow;
  const keys = {};
  const clock = new THREE.Clock();
  const ray = new THREE.Raycaster();

  /* ---------------- estado do jogo ---------------- */
  const G = {
    mode: "loading", paused: false,        // loading | title | city | interior | dialog | transition | cutscene | victory | explore
    scene: "city",          // city | interior
    score: 0, completed: [], firstTry: 0, bossDefeated: false, bossHits: 0, shake: 0,
    correct: 0, answered: false, playTime: 0, qTime: {}, startPhase: 0, over: false, // acertos, tempo e fim da partida
    unlocked: 0, statuses: [], current: -1, mapOpen: false, explore: false,
  };
  const P = { x: 0, z: 0, y: 0, heading: 0, speed: 0, jy: 0, vy: 0 }; // jy/vy: altura e velocidade do pulo
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), mode: "follow" };
  const tweens = [];
  let time = 0;

  /* ---------------- inicialização ---------------- */
  CT.boot = async function () {
    UI.init();
    setupMusic();
    const startBtn = document.getElementById("btn-start");
    startBtn.disabled = true;
    // aguarda as fontes (os letreiros 3D são desenhados com elas)
    try {
      await Promise.race([
        Promise.all([document.fonts.load('800 40px "Bricolage Grotesque"'), document.fonts.load('600 20px "Figtree"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* segue com fontes do sistema */ }

    // celulares e tablets: qualidade própria (CT.CONFIG.celular)
    if (CT.Touch && CT.Touch.movel && CFG.celular) Object.assign(CFG, CFG.celular);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("game"), antialias: true, powerPreference: "high-performance" });
    quality.max = quality.pr = Math.min(window.devicePixelRatio || 1, CFG.pixelRatioMaximo);
    renderer.setPixelRatio(quality.pr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !!CFG.sombras;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
    // modelos 3D (personagens com esqueleto e objetos urbanos)
    const label = startBtn.querySelector(".label-text");
    try { await CT.Assets.load((p) => { label.textContent = "CARREGANDO MODELOS 3D… " + Math.round(p * 100) + "%"; }); }
    catch (e) { console.warn("[modelos] seguindo com personagens provisórios", e); }
    label.textContent = "MONTANDO A CIDADE…";
    await new Promise((r) => setTimeout(r, 30));
    world = CT.buildCity(new THREE.Scene());
    world.atm.finalize(renderer);
    world.atm.set(CT.TEMPO[0]);
    interiors = CT.createInteriors();

    // personagem escolhida da última vez (ou a primeira da lista)
    try { G.charId = localStorage.getItem("jt-personagem") || ""; } catch (e) { G.charId = ""; }
    if (!charDef(G.charId, true)) G.charId = CT.PERSONAGENS[0].id;
    player = CT.createPlayer(charDef(G.charId));
    world.scene.add(player.root);
    UI.charSelect.portraits = makePortraits();
    UI.charSelect.build((id) => { pickCharacter(id); });
    arrow = makeArrow();
    world.scene.add(arrow);

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    setupMouseCamera(renderer.domElement);
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
    window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
    document.getElementById("mute").onclick = toggleMute;
    document.getElementById("bigmap").onclick = (e) => { if (e.target.id === "bigmap" || e.target.closest("[data-close-map]")) setMap(false); };
    // tocar/clicar no minimapa abre o mapa ampliado
    document.getElementById("map-panel").onclick = () => { if ((G.mode === "city" || G.mode === "interior") && !G.paused && !UI.dialog.open) setMap(true); };

    resetProgress();
    G.mode = "title";
    UI.showTitle(true); UI.showHUD(false);
    startBtn.disabled = false;
    startBtn.querySelector(".label-text").textContent = "INICIAR A AVENTURA";
    startBtn.onclick = () => openCharSelect(0);
    document.getElementById("cs-go").onclick = () => confirmCharSelect();
    document.getElementById("cs-back").onclick = () => closeCharSelect();
    document.getElementById("btn-ranking").onclick = () => { A.init(); A.play("click"); UI.renderRanking(); UI.openModal("ranking"); };
    document.getElementById("rank-export").onclick = () => { A.play("click"); CT.Ranking.baixarCSV(); };
    const clearBtn = document.getElementById("rank-clear");
    let clearArm = 0;
    clearBtn.onclick = () => { // dois cliques para apagar tudo
      if (Date.now() - clearArm < 4000) { CT.Ranking.limpar(); clearArm = 0; A.play("wrong"); UI.renderRanking(); clearBtn.querySelector("span").textContent = "LIMPAR RANKING"; return; }
      clearArm = Date.now(); A.play("locked");
      clearBtn.querySelector("span").textContent = "CLIQUE DE NOVO PARA APAGAR TUDO";
      setTimeout(() => { if (clearArm && Date.now() - clearArm >= 3900) { clearArm = 0; clearBtn.querySelector("span").textContent = "LIMPAR RANKING"; } }, 4000);
    };
    document.getElementById("btn-phases").onclick = () => { A.init(); A.play("click"); UI.openModal("phases"); };
    document.querySelectorAll("#phase-grid [data-fase]").forEach((b) => (b.onclick = () => {
      if (startBtn.disabled) return; // cidade ainda carregando
      UI.closeModal("phases"); openCharSelect(+b.dataset.fase);
    }));
    document.getElementById("btn-howto").onclick = () => { A.init(); A.play("click"); UI.openModal("howto"); };
    document.getElementById("btn-credits").onclick = () => { A.init(); A.play("click"); UI.openModal("credits"); };
    document.querySelectorAll("#pause [data-act]").forEach((b) => (b.onclick = () => pauseAction(b.dataset.act)));
    startBtn.focus();
    renderer.setAnimationLoop(loop);
  };

  /* Resolução adaptativa: mede a taxa de quadros durante o jogo; abaixo de
   * ~40 qps reduz a resolução, com folga sobe de novo (sem passar de um
   * nível que já se mostrou pesado demais). */
  const quality = { pr: 1, max: 1, teto: 99, t: 0, n: 0, min: 0.6 };
  function adaptQuality(raw) {
    if (!CFG.resolucaoAdaptativa || raw > 0.25) return; // aba em segundo plano, carregamento
    quality.t += raw; quality.n++;
    if (quality.t < 2.5) return;
    const fps = quality.n / quality.t;
    quality.t = 0; quality.n = 0;
    let pr = quality.pr;
    if (fps < 40 && pr > quality.min) { quality.teto = pr - 0.01; pr = Math.max(quality.min, pr - 0.2); }
    else if (fps > 56 && pr + 0.1 <= Math.min(quality.max, quality.teto)) pr += 0.1;
    if (pr !== quality.pr) { quality.pr = pr; renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function makeArrow() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.9); s.lineTo(0.75, -0.2); s.lineTo(0.28, -0.2); s.lineTo(0.28, -0.8); s.lineTo(-0.28, -0.8); s.lineTo(-0.28, -0.2); s.lineTo(-0.75, -0.2); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: "#FFB020", transparent: true, opacity: 0.9, depthWrite: false }));
    m.geometry.rotateX(-Math.PI / 2); // aponta para -Z
    const g = new THREE.Group(); g.add(m);
    return g;
  }

  /* ---------------- progresso ---------------- */
  function resetProgress() {
    G.score = 0; G.completed = new Array(N).fill(false); G.firstTry = 0; G.bossDefeated = false; G.bossHits = 0; G.explore = false;
    G.correct = 0; G.answered = false; G.playTime = 0; G.qTime = {}; G.startPhase = 0; G.over = false;
    UI.setPlaytime(0);
    UI.bossBar.hide(); document.body.classList.remove("boss-fight");
    world.gates.forEach((g) => g.reset());
    world.boss.reset();
    P.x = world.start.x; P.z = world.start.z; P.heading = world.start.heading; P.speed = 0; P.y = world.groundHeight(P.x, P.z); P.jy = 0; P.vy = 0;
    world.atm.set(CT.TEMPO[0]);
    lastClock = "";
    camCtl.yaw = 0; camCtl.pitch = 0; camCtl.dist = 7.6;
    refreshStatuses();
  }
  /* seleção de fases: libera as anteriores (sem pontos) e leva o jogador
   * até a porta da fase escolhida, no horário e na estação dela */
  function startAtPhase(k) {
    G.startPhase = k;
    for (let i = 0; i < k; i++) { G.completed[i] = true; if (world.gates[i]) world.gates[i].open(false); }
    refreshStatuses();
    world.atm.set(timeDef());
    lastClock = "";
    if (k < N) {
      const b = world.buildings[k];
      P.x = b.trigger.x; P.z = b.trigger.z + b.facing * 3.2; P.heading = b.facing > 0 ? Math.PI : 0;
    } else {
      const B = world.boss;
      P.x = B.trigger.x - 4; P.z = B.trigger.z; P.heading = Math.atan2(B.x - P.x, B.z - P.z);
    }
    P.y = world.groundHeight(P.x, P.z); P.speed = 0;
  }
  function nextIndex() { const i = G.completed.indexOf(false); return i < 0 ? N : i; }
  function refreshStatuses() {
    const nx = nextIndex();
    G.unlocked = nx; // bairros 0..nx acessíveis
    G.statuses = [];
    for (let i = 0; i < N; i++) G.statuses.push(G.completed[i] ? "done" : i === nx ? "available" : "locked");
    G.statuses.push(G.bossDefeated ? "done" : nx >= N ? "available" : "locked");
    world.buildings.forEach((b, i) => { if (b.status !== G.statuses[i]) b.setStatus(G.statuses[i]); });
    if (world.boss.status !== G.statuses[N]) world.boss.setStatus(G.statuses[N]);
    updateHUD();
  }
  function challengesDone() { return G.completed.filter(Boolean).length + (G.bossDefeated ? 1 : 0); }

  function objectiveHTML() {
    if (G.bossDefeated) return "A cidade está totalmente liberada. Explore à vontade!";
    if (G.festa) return "Você achou a <b>Casa de Festas</b>, uma área secreta! Dance com o dinossauro e saia pela <b>porta</b> quando quiser.";
    if (G.scene === "interior" && G.current >= 0) {
      const d = CT.PREDIOS[G.current];
      return G.completed[G.current] ? `Desafio concluído! Volte à cidade pela <b>saída</b> (${K("ESPAÇO", "VOLTAR")} na porta).` : `Converse com <b>${d.npc.chamado || d.npc.nome}</b> ${d.npc.local || "no balcão"}.`;
    }
    const nx = nextIndex();
    if (nx >= N) return `Enfrente o <b>${CT.BOSS.nome}</b> na ${CT.BOSS.predio}.`;
    return `Vá até o prédio <b>${nx + 1} · ${CT.PREDIOS[nx].nome}</b>. Siga a seta amarela.`;
  }
  function updateHUD() {
    UI.setHUD({ score: G.score, statuses: G.statuses, done: G.completed.filter(Boolean).length, total: N, challenges: challengesDone(), objective: objectiveHTML() });
  }

  /* ---------------- início ---------------- */
  /* ---------------- escolha de personagem ---------------- */
  function charDef(id, strict) { return CT.PERSONAGENS.find((p) => p.id === id) || (strict ? null : CT.PERSONAGENS[0]); }
  /* troca o modelo da protagonista (mesma posição e cena) */
  function setCharacter(id) {
    if (id === G.charId && player) return;
    G.charId = id;
    try { localStorage.setItem("jt-personagem", id); } catch (e) {}
    const parent = player.root.parent;
    if (parent) parent.remove(player.root);
    player = CT.createPlayer(charDef(id));
    player.root.position.set(P.x, P.y, P.z); player.root.rotation.y = P.heading;
    if (parent) parent.add(player.root);
  }
  function pickCharacter(id) {
    setCharacter(id);
    UI.charSelect.select(id);
    A.play("pop");
    player.mode = "wave"; // cumprimenta ao ser escolhida
    clearTimeout(pickCharacter.t);
    pickCharacter.t = setTimeout(() => { if (G.selecting) player.mode = "idle"; }, 1800);
  }
  function openCharSelect(fase) {
    if (G.mode !== "title" || document.getElementById("btn-start").disabled) return;
    A.init(); A.play("click");
    G.selecting = true; G.pendingPhase = fase | 0;
    P.x = world.start.x; P.z = world.start.z; P.heading = world.start.heading; P.y = world.groundHeight(P.x, P.z);
    UI.showTitle(false);
    UI.charSelect.select(G.charId);
    UI.charSelect.show(true, G.pendingPhase);
  }
  function closeCharSelect() {
    if (!G.selecting) return;
    A.play("click");
    G.selecting = false; player.mode = "idle";
    UI.charSelect.show(false);
    UI.showTitle(true);
  }
  function confirmCharSelect() {
    if (!G.selecting) return;
    G.selecting = false; player.mode = "idle";
    UI.charSelect.show(false);
    startGame(G.pendingPhase);
  }
  function moveCharSelect(d) {
    const L = CT.PERSONAGENS, i = L.findIndex((p) => p.id === G.charId);
    pickCharacter(L[(i + d + L.length) % L.length].id);
    const b = document.querySelector(`#cs-grid [data-id="${G.charId}"]`); if (b) b.focus();
  }
  /* retratos dos cartões: cada personagem renderizada uma vez, em um
   * renderizador separado (não interfere na cena principal) */
  function makePortraits(lista, W, H, rot) {
    const out = {};
    W = W || 200; H = H || 250;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(W, H, false);
      r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = renderer.toneMapping; r.toneMappingExposure = renderer.toneMappingExposure;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x7c8ca8, 1.15));
      const dl = new THREE.DirectionalLight(0xfff4e6, 1.6); dl.position.set(1.2, 2.6, 3); sc.add(dl);
      const cm = new THREE.PerspectiveCamera(22, W / H, 0.1, 20);
      cm.position.set(0, 1.52, 2.15); cm.lookAt(0, 1.4, 0);
      (lista || CT.PERSONAGENS).forEach((d) => {
        const ch = CT.createPlayer(d);
        ch.root.rotation.y = rot == null ? 0.3 : rot; sc.add(ch.root);
        ch.update(0.016); ch.update(0.4);
        r.render(sc, cm);
        out[d.id] = r.domElement.toDataURL("image/png");
        sc.remove(ch.root);
      });
      r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
    } catch (e) { console.warn("[personagens] sem retratos", e); }
    return out;
  }

  async function startGame(fase) {
    if (G.mode !== "title") return;
    fase = Math.max(0, Math.min(N, fase | 0));
    A.init(); A.play("enter");
    CT.Music.play("jogo", 2.4); // a música do menu dá lugar à trilha da cidade
    G.mode = "transition"; lockPointer(); // gesto do jogador: já esconde o ponteiro
    await UI.fade(true);
    UI.showTitle(false); UI.hideVictory();
    resetProgress();
    if (fase > 0) startAtPhase(fase);
    setScene("city");
    cam.mode = "follow";
    snapCamera();
    UI.showHUD(true);
    await UI.fade(false);
    G.mode = "city";
    if (fase === 0) UI.toast(`${charDef(G.charId).genero === "f" ? "Bem-vinda" : "Bem-vindo"}, ${charDef(G.charId).nome}! Comece pelo prédio <b>1 · ${CT.PREDIOS[0].nome}</b>. ${K("Use as <b>setas</b> para andar.", "Use o <b>joystick</b> à esquerda para andar.")}`, "", 5200);
    else if (fase < N) UI.toast(`Fase <b>${fase + 1} · ${CT.PREDIOS[fase].nome}</b>. ${K("Aperte <b>ESPAÇO</b>", "Toque em <b>ENTRAR</b>")} na porta para entrar.`, "", 5200);
    else UI.toast(`Fase final! ${K("Aperte <b>ESPAÇO</b>", "Toque em <b>ENFRENTAR</b>")} para enfrentar o <b>${CT.BOSS.nome}</b>.`, "boss", 5200);
  }

  function setScene(which) {
    G.scene = which;
    P.jy = 0; P.vy = 0;
    if (which === "city") { world.scene.add(player.root); world.scene.add(arrow); }
    else { interiors.scene.add(player.root); }
  }

  /* ---------------- teclado ---------------- */
  function onKeyDown(e) {
    const k = e.key;
    const tg = e.target;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return; // digitando o nome do ranking
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
    // janelas abertas (Como jogar, Créditos, Pausa): setas navegam, ESC volta
    const top = UI.topModal();
    if (top) {
      if (k === "Escape") { e.preventDefault(); if (Date.now() - pauseOpenedAt < 300) return; if (top === "pause") pauseAction(document.getElementById("pause-confirm").hidden ? "continuar" : "cancelar-sair"); else UI.closeModal(top); }
      else if (k === "ArrowDown" || k === "ArrowUp") UI.menuNav(document.getElementById(top), (k === "ArrowDown" ? 1 : -1) * (top === "phases" ? 2 : 1));
      else if (top === "phases" && (k === "ArrowLeft" || k === "ArrowRight")) UI.menuNav(document.getElementById(top), k === "ArrowRight" ? 1 : -1);
      return; // ENTER/ESPAÇO acionam o botão em foco normalmente
    }
    if (G.selecting) {
      if (k === "ArrowLeft" || k === "ArrowUp") moveCharSelect(-1);
      else if (k === "ArrowRight" || k === "ArrowDown") moveCharSelect(1);
      else if (k === "Escape") closeCharSelect();
      else if (k === "Enter" && !(document.activeElement && document.activeElement.id === "cs-back")) { e.preventDefault(); confirmCharSelect(); }
      return;
    }
    if (G.mode === "title") {
      const menu = document.getElementById("title-menu");
      if (k === "ArrowDown" || k === "ArrowUp") UI.menuNav(menu, k === "ArrowDown" ? 1 : -1);
      else if ((k === "Enter" || k === " ") && !menu.contains(document.activeElement)) { e.preventDefault(); openCharSelect(0); }
      return;
    }
    if (UI.dialog.open) { if (UI.dialog.key(e)) { e.preventDefault(); return; } }
    if (k === "Escape" && !G.mapOpen && (G.mode === "city" || G.mode === "interior")) { openPause(); return; }
    if (G.mode === "victory" || G.mode === "ended") return;
    if ((k === "c" || k === "C") && (G.mode === "city" || G.mode === "interior")) { recenterCamera(); return; }
    if (k === "m" || k === "M") { if (G.mode === "city" || G.mode === "interior") setMap(!G.mapOpen); return; }
    if (G.mapOpen) { if (k === "Escape") setMap(false); return; }
    keys[e.code] = true;
    lockPointer();
    if (e.repeat) return;
    if (k === " ") { if (actionAvailable()) interact(); else jump(); }
  }

  /* ---------------- menu de pausa (ESC) ---------------- */
  let pauseOpenedAt = 0;
  function openPause() {
    if (G.paused || UI.dialog.open || G.mapOpen || !(G.mode === "city" || G.mode === "interior")) return;
    G.paused = true; pauseOpenedAt = Date.now();
    for (const kk in keys) keys[kk] = false;
    P.speed = 0; player.speed = 0;
    unlockPointer();
    UI.prompt(null);
    const lb = world.atm.label();
    UI.setPause({ score: G.score, done: G.completed.filter(Boolean).length, total: N, hora: lb.hora, estacao: lb.estacao, muted: A.muted });
    UI.openModal("pause");
    A.play("click");
  }
  function closePause() {
    UI.closeModal("pause");
    G.paused = false;
    clock.getDelta(); // não "pula" o tempo que ficou pausado
    lockPointer();    // o clique/tecla que fechou o menu volta a prender o ponteiro
  }
  // a partida já vale para o ranking? (alguma resposta dada e ainda não registrada)
  function matchCounts() { return !G.over && !G.explore && G.answered; }
  function pauseAction(act) {
    A.play("click");
    const confirm = document.getElementById("pause-confirm"), menu = document.getElementById("pause-menu");
    if (act === "continuar") closePause();
    else if (act === "howto") UI.openModal("howto");
    else if (act === "som") { toggleMute(); document.getElementById("pause-sound").textContent = A.muted ? "SOM: DESLIGADO" : "SOM: LIGADO"; }
    else if (act === "musica") toggleMusic();
    else if (act === "sair") {
      document.getElementById("pause-confirm-text").innerHTML = matchCounts()
        ? "<b>Encerrar a partida?</b> Sua pontuação até aqui vai para o ranking."
        : "<b>Sair para a tela inicial?</b> Nenhuma pergunta foi respondida, então nada vai para o ranking.";
      menu.hidden = true; confirm.hidden = false; confirm.querySelector(".menu-btn").focus();
    }
    else if (act === "cancelar-sair") { confirm.hidden = true; menu.hidden = false; menu.querySelector('[data-act="sair"]').focus(); }
    else if (act === "confirmar-sair") { if (matchCounts()) endMatch("desistiu"); else quitToTitle(); }
  }
  /* Sair do jogo: volta para a tela inicial e zera a partida. */
  async function quitToTitle() {
    G.mode = "transition";
    unlockPointer();
    await UI.fade(true);
    ["pause", "howto", "credits", "ranking", "phases"].forEach((id) => UI.closeModal(id));
    G.paused = false;
    if (UI.dialog.open) UI.dialog.close(true);
    setMap(false);
    UI.hideVictory(); UI.showHUD(false); UI.prompt(null); UI.fx.clear();
    player.mode = "idle"; player.speed = 0;
    G.current = -1; G.festa = false;
    resetProgress();
    setScene("city");
    cam.mode = "orbit";
    G.mode = "title";
    UI.showTitle(true);
    CT.Music.play("menu");
    await UI.fade(false);
  }
  function setMap(v) { G.mapOpen = UI.toggleBigMap(v); }
  /* ---------------- trilha sonora ---------------- */
  function setupMusic() {
    const M = CT.Music, cfg = CT.CONFIG.musicas && CT.CONFIG.musicas.menu, btn = document.getElementById("title-music");
    try { M.off = localStorage.getItem("ct-musica") === "off"; } catch (e) {}
    M.onchange = musicChip;
    M.preload();
    // a música do menu começa quando a abertura termina (ou já, se não houver abertura)
    (CT.Intro ? CT.Intro.done : Promise.resolve()).then(() => M.play("menu"));
    if (!cfg || !cfg.arquivo) return;
    document.getElementById("music-title").textContent = cfg.titulo || "Música";
    document.getElementById("music-sub").textContent = cfg.autor || "";
    btn.hidden = false;
    btn.onclick = () => { toggleMusic(); document.getElementById("btn-start").focus(); };
    musicChip();
  }
  /* Liga/desliga só as músicas (os efeitos sonoros continuam). */
  function toggleMusic() {
    let on;
    if (A.muted) { // som geral estava mudo: liga tudo
      CT.Music.off = false; toggleMute(); on = true;
      document.getElementById("pause-sound").textContent = "SOM: LIGADO";
    } else on = CT.Music.toggle();
    try { localStorage.setItem("ct-musica", on ? "on" : "off"); } catch (e) {}
    musicChip();
  }
  function musicChip() {
    const on = !CT.Music.off && !A.muted;
    const ps = document.getElementById("pause-music");
    if (ps) ps.textContent = on ? "MÚSICA: LIGADA" : "MÚSICA: DESLIGADA";
    const btn = document.getElementById("title-music"); if (!btn) return;
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", (on ? "Desligar" : "Ligar") + " a música");
    document.getElementById("music-state").textContent = on ? "MÚSICA LIGADA" : "MÚSICA DESLIGADA";
    btn.classList.toggle("playing", CT.Music.current === "menu" && CT.Music.playing());
  }

  function toggleMute() {
    A.muted = !A.muted;
    CT.Music.refresh(); musicChip();
    document.getElementById("mute").setAttribute("aria-pressed", String(A.muted));
    document.getElementById("mute").innerHTML = A.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/></svg>';
  }

  /* ---------------- interações ---------------- */
  function nearestBuilding() {
    let best = null, bd = 3.8;
    world.buildings.forEach((b) => { const d = Math.hypot(P.x - b.trigger.x, P.z - b.trigger.z); if (d < bd) { bd = d; best = b; } });
    return best;
  }
  // Casa de Festas: perto do dinossauro, ESPAÇO faz o personagem dançar junto
  function nearDino() {
    const room = interiors.current;
    if (!G.festa || !room || !room.festa) return false;
    const d = room.npc.root.position;
    return Math.hypot(P.x - d.x, P.z - d.z) < 4.8 && !(P.z > room.exitZ - 1.8);
  }
  function toggleDance() {
    const room = interiors.current;
    if (player.mode === "dance") { player.mode = "idle"; return; }
    const d = room.npc.root.position;
    P.speed = 0; player.speed = 0;
    P.heading = Math.atan2(d.x - P.x, d.z - P.z);          // de frente para o dinossauro
    player.dancaBatida = CT.CasaFestas.BEAT; player.dancaTempo = () => room.npc.tempo();
    player.mode = "dance";
    A.play("pop");
  }
  function nearFesta() { const f = world.casaFestas; return !!f && Math.hypot(P.x - f.trigger.x, P.z - f.trigger.z) < 2.4; }
  function nearBoss() { const t = world.boss.trigger; return !world.boss.defeated && Math.hypot(P.x - t.x, P.z - t.z) < 4.8; }
  function nearGate() {
    for (const g of world.gates) if (!g.isOpen && Math.hypot(P.x - g.approach.x, P.z - g.approach.z) < 6.5) return g;
    return null;
  }

  /* ESPAÇO: interage quando há algo para fazer ali (porta liberada, chefe,
   * personagem, saída); no resto do tempo, pula */
  const nearLima = () => world.seuLima && Math.hypot(P.x - world.seuLima.x, P.z - world.seuLima.z) < 2.6;
  function actionAvailable() {
    if (G.mode === "city") {
      if (nearLima() || nearFesta()) return true;
      const b = nearestBuilding();
      if (b) return b.status === "available";
      return nearBoss() && G.statuses[N] === "available";
    }
    if (G.mode === "interior") {
      const room = interiors.current;
      return Math.hypot(P.x - room.talk.x, P.z - room.talk.z) < room.talk.r || P.z > room.exitZ - 1.8 || nearDino();
    }
    return false;
  }
  function jump() {
    if (!(G.mode === "city" || G.mode === "interior") || G.mapOpen || P.jy > 0 || P.vy !== 0) return;
    P.vy = (CFG.pulo && CFG.pulo.forca) || 7.5;
    A.play("jump");
  }
  /* ---------------- Seu Lima: boas-vindas e história do jogo ---------------- */
  function talkToLima() {
    const L = world.seuLima, d = CT.SEU_LIMA;
    // "bem-{vindo|vinda}": escolhe a forma pelo gênero da personagem escolhida
    const fem = (charDef(G.charId).genero || "f") === "f";
    const genero = (t) => t.replace(/\{([^|{}]*)\|([^{}]*)\}/g, (_, m, f) => (fem ? f : m));
    G.mode = "dialog"; UI.prompt(null);
    P.heading = Math.atan2(L.x - P.x, L.z - P.z);
    L.falando = true;
    // ele recebe o jogador batendo continência, depois conversa
    L.ch.mode = "salute"; L.ch.afterSalute = "talk"; L.ch.root.rotation.y = Math.atan2(P.x - L.x, P.z - L.z);
    cam.talkTo = L.ch.root.position; cam.mode = "dialog";
    A.play("click");
    UI.dialog.show({
      speaker: { nome: d.nome, cargo: d.cargo + " · Pórtico de boas-vindas", cor: "#16305C" },
      rotuloIntro: "Boas-vindas", paginas: d.falas.map(genero), rotuloFim: "VAMOS LÁ!",
      onFechar: () => { L.falando = false; L.ch.mode = "wave"; L.t = 0; cam.talkTo = null; G.mode = "city"; cam.mode = "follow"; },
    });
  }
  function interact() {
    if (G.mode === "city") {
      if (nearLima()) return talkToLima();
      if (nearFesta()) return enterFesta();
      const b = nearestBuilding();
      if (b) {
        if (b.status === "available") return enterBuilding(b.index);
        if (b.status === "done") { A.play("click"); return UI.toast(`Você já concluiu <b>${b.def.nome}</b>. Siga para o próximo prédio!`, "success"); }
        A.play("locked"); return UI.toast(`Prédio bloqueado. Conclua primeiro: <b>${CT.PREDIOS[nextIndex()].nome}</b>.`, "warn");
      }
      if (nearBoss()) {
        if (G.statuses[N] === "available") return startBoss();
        A.play("locked"); return UI.toast("O desafio final só abre depois dos 8 prédios.", "warn");
      }
      const g = nearGate();
      if (g) { A.play("locked"); UI.toast(`Passagem bloqueada. Conclua <b>${CT.PREDIOS[g.k].nome}</b> para liberar.`, "warn"); }
    } else if (G.mode === "interior") {
      const room = interiors.current;
      if (Math.hypot(P.x - room.talk.x, P.z - room.talk.z) < room.talk.r) return talkToNPC();
      if (nearDino()) return toggleDance();
      if (P.z > room.exitZ - 1.8) return exitBuilding();
    }
  }

  /* ---------------- entrar / sair de prédios ---------------- */
  async function enterBuilding(idx) {
    const b = world.buildings[idx];
    G.mode = "transition"; G.current = idx;
    UI.prompt(null); setMap(false);
    A.play("enter");
    // personagem se vira para a porta e caminha; câmera faz zoom na entrada
    const want = Math.atan2(b.door.x - P.x, b.door.z - P.z);
    const fromPos = cam.pos.clone(), fromLook = cam.look.clone();
    const toPos = new THREE.Vector3(b.trigger.x, 2.4, b.trigger.z + b.facing * 4.5);
    const toLook = new THREE.Vector3(b.door.x, 2.2, b.door.z);
    const h0 = P.heading;
    cam.mode = "script";
    await tween(0.9, (p, dt) => {
      const e = U.easeInOut(p);
      P.heading = h0 + U.angleDiff(h0, want) * Math.min(1, p * 2.5);
      cam.pos.lerpVectors(fromPos, toPos, e); cam.look.lerpVectors(fromLook, toLook, e);
      if (p > 0.35) { P.x += Math.sin(P.heading) * 2.4 * dt; P.z += Math.cos(P.heading) * 2.4 * dt; player.speed = 0.6; }
    });
    await UI.fade(true);
    player.speed = 0;
    const room = interiors.enter(idx);
    setScene("interior");
    P.x = room.spawn.x; P.z = room.spawn.z; P.heading = room.spawn.heading; P.y = 0; P.speed = 0;
    cam.mode = "interior"; snapCamera();
    G.mode = "interior";
    updateHUD();
    await UI.fade(false);
    UI.toast(`${(room.def.npc.chamado || room.def.npc.nome).replace(/^./, (c) => c.toUpperCase())} está esperando por você ${room.def.npc.local || "no balcão"}.`, "", 3000);
  }

  /* ---------------- Casa de Festas (área secreta, sem missão) ---------------- */
  async function enterFesta() {
    const f = world.casaFestas;
    G.mode = "transition"; G.current = -1; G.festa = true;
    UI.prompt(null); setMap(false);
    A.play("enter");
    const want = Math.atan2(f.door.x - P.x, f.door.z - P.z), h0 = P.heading;
    const fromPos = cam.pos.clone(), fromLook = cam.look.clone();
    const toPos = new THREE.Vector3(f.trigger.x, 2.4, f.trigger.z + f.facing * 4.5), toLook = new THREE.Vector3(f.door.x, 2.2, f.door.z);
    cam.mode = "script";
    await tween(0.9, (p, dt) => {
      const e = U.easeInOut(p);
      P.heading = h0 + U.angleDiff(h0, want) * Math.min(1, p * 2.5);
      cam.pos.lerpVectors(fromPos, toPos, e); cam.look.lerpVectors(fromLook, toLook, e);
      if (p > 0.35) { P.x += Math.sin(P.heading) * 2.4 * dt; P.z += Math.cos(P.heading) * 2.4 * dt; player.speed = 0.6; }
    });
    await UI.fade(true);
    player.speed = 0;
    const room = interiors.enterFesta();
    setScene("interior");
    P.x = room.spawn.x; P.z = room.spawn.z; P.heading = room.spawn.heading; P.y = 0; P.speed = 0;
    cam.mode = "interior"; snapCamera();
    G.mode = "interior";
    CT.Music.play("festa", 0.8); // música animada só aqui dentro
    updateHUD();
    await UI.fade(false);
    UI.toast("Você encontrou uma <b>área secreta</b>: a Casa de Festas!", "success", 3200);
  }
  async function exitFesta() {
    const f = world.casaFestas;
    G.mode = "transition"; UI.prompt(null); setMap(false); player.mode = "idle";
    await UI.fade(true);
    setScene("city");
    P.x = f.trigger.x; P.z = f.trigger.z + f.facing * 0.8; P.heading = f.facing > 0 ? 0 : Math.PI; P.y = world.groundHeight(P.x, P.z); P.speed = 0;
    cam.mode = "follow"; snapCamera();
    G.festa = false;
    CT.Music.play("jogo", 2);
    updateHUD();
    await UI.fade(false);
    G.mode = "city";
  }

  async function exitBuilding() {
    if (G.mode !== "interior") return;
    if (G.festa) return exitFesta();
    const idx = G.current, b = world.buildings[idx];
    G.mode = "transition"; UI.prompt(null); setMap(false);
    await UI.fade(true);
    setScene("city");
    P.x = b.trigger.x; P.z = b.trigger.z + b.facing * 1.2; P.heading = b.facing > 0 ? 0 : Math.PI; P.y = world.groundHeight(P.x, P.z); P.speed = 0;
    cam.mode = "follow"; snapCamera();
    G.current = -1;
    updateHUD();
    await UI.fade(false);
    const gate = world.gates[idx];
    if (G.completed[idx] && gate && !gate.isOpen) await gateCutscene(gate);
    G.mode = "city";
  }

  /* ---------------- pontuação e fim da partida ---------------- */
  // bônus de rapidez para uma resposta certa dada em t segundos
  function speedBonus(t) {
    const b = CFG.bonusRapidez || { maximo: 0 };
    return Math.max(0, Math.round(b.maximo - b.perdaPorSegundo * Math.max(0, t - b.carencia)));
  }
  function totalQuestions() { return N + bossQuestions().length; }
  /* opções comuns a todas as perguntas (prédios e chefe) */
  function questionOpts(key) {
    return {
      tempoInicial: G.qTime[key] || 0,
      bonusAgora: (t) => speedBonus(t),
    };
  }
  /* resposta certa: 100 pontos + bônus de rapidez */
  function scoreCorrect(key, t) {
    G.qTime[key] = t; G.answered = true;
    const base = CFG.pontosPorAcerto, bonus = speedBonus(t), gain = base + bonus;
    G.score += gain; G.correct++;
    return { gain, texto: `+${gain} pontos`, detalhe: `${base} pelo acerto + ${bonus} de rapidez (${Math.round(t)} s)` };
  }
  /* resposta errada: sem perda de pontos, mas o tempo segue correndo */
  function markWrong(key, t) { G.qTime[key] = t; G.answered = true; }
  function matchStats(tipo) {
    return { pontos: G.score, acertos: G.correct, perguntas: totalQuestions(), tempo: G.playTime, faseInicial: G.startPhase, resultado: tipo, personagem: charDef(G.charId).nome, genero: charDef(G.charId).genero };
  }
  function endHandlers(tipo) {
    return {
      registrar: (nome) => CT.Ranking.adicionar(Object.assign(matchStats(tipo), { nome })),
      replay, home: quitToTitle, explore: tipo === "vitoria" ? explore : null,
    };
  }
  /* partida encerrada pelo menu (ESC → SAIR DO JOGO) */
  function endMatch(tipo) {
    if (G.over) return;
    G.over = true;
    if (G.paused) { UI.closeModal("pause"); G.paused = false; }
    if (UI.dialog.open) UI.dialog.close(true);
    G.mode = "ended";
    unlockPointer(); setMap(false); UI.prompt(null);
    for (const kk in keys) keys[kk] = false;
    P.speed = 0; player.speed = 0; player.mode = "idle";
    UI.bossBar.hide(); document.body.classList.remove("boss-fight");
    if (cam.mode === "boss") world.boss.ch.mode = "celebrate"; // o Corrupson comemora
    if (G.scene === "interior" && interiors.current) interiors.current.npc.mode = "idle";
    CT.Music.stop(1.2);
    UI.showHUD(false);
    UI.showEnd(tipo, matchStats(tipo), endHandlers(tipo));
  }

  /* ---------------- conversa com o NPC ---------------- */
  function talkToNPC() {
    const idx = G.current, d = CT.PREDIOS[idx], room = interiors.current;
    if (G.completed[idx]) { room.npc.mode = "wave"; return UI.toast(d.falaConcluido ? `${d.npc.nome}: ${d.falaConcluido}` : `${d.npc.nome}: “Parabéns de novo! A próxima etapa já está liberada.”`, "success", d.falaConcluido ? 6000 : undefined); }
    G.mode = "dialog";
    UI.prompt(null);
    P.heading = Math.atan2(room.npc.root.position.x - P.x, room.npc.root.position.z - P.z);
    room.npc.mode = "talk";
    cam.mode = "dialog";
    const key = "predio-" + idx;
    UI.dialog.show(Object.assign(questionOpts(key), {
      speaker: { nome: d.npc.nome, cargo: d.npc.cargo + " · " + d.nome, cor: d.cor },
      paginas: d.curiosidade, baseLegal: d.baseLegal,
      pergunta: d.pergunta, alternativas: d.alternativas, correta: d.correta,
      etiqueta: `Pergunta · Estação ${idx + 1}`,
      explicar: () => d.explicacao,
      onErro: (i, t) => { A.play("wrong"); room.npc.mode = "wrong"; markWrong(key, t); },
      onAcerto: (first, t) => {
        const sc = scoreCorrect(key, t);
        if (first) G.firstTry++;
        G.completed[idx] = true;
        refreshStatuses();
        A.play("correct");
        UI.fx.confetti(140);
        room.npc.mode = "celebrate"; player.mode = "celebrate";
        const c = UI.dialog.cfg;
        c.pontosTexto = sc.texto;
        c.extraAcerto = sc.detalhe + ". " + (idx < N - 1 ? `Próximo prédio liberado: ${idx + 2} · ${CT.PREDIOS[idx + 1].nome}.` : `Todos os prédios concluídos! O desafio final aguarda na ${CT.BOSS.predio}.`);
      },
      tituloAcerto: "Resposta correta!",
      textoAcerto: d.mensagemAcerto,
      rotuloFinal: "VOLTAR À CIDADE",
      onFim: () => { player.mode = "idle"; room.npc.mode = "wave"; G.mode = "interior"; cam.mode = "interior"; exitBuilding(); },
      onFechar: (r, t) => { G.qTime[key] = t; player.mode = "idle"; room.npc.mode = "wave"; G.mode = "interior"; cam.mode = "interior"; updateHUD(); },
    }));
  }

  /* ---------------- cena do portão abrindo ---------------- */
  /* estado de tempo/clima correspondente ao progresso atual */
  function timeDef() { const k = Math.min(G.completed.filter(Boolean).length, CT.TEMPO.length - 1); return CT.TEMPO[k]; }
  async function gateCutscene(gate) {
    G.mode = "cutscene";
    const before = world.atm.label();
    world.atm.goTo(timeDef());
    const dirx = Math.sin(gate.ry), dirz = Math.cos(gate.ry);
    const fromPos = cam.pos.clone(), fromLook = cam.look.clone();
    const toPos = new THREE.Vector3(gate.x + dirx * 15, 8, gate.z + dirz * 15);
    const toLook = new THREE.Vector3(gate.x, 1.6, gate.z);
    cam.mode = "script";
    await tween(1.5, (p) => {
      const e = U.easeInOut(p);
      cam.pos.lerpVectors(fromPos, toPos, e); cam.pos.y += Math.sin(p * Math.PI) * 22;
      cam.look.lerpVectors(fromLook, toLook, e);
    });
    gate.open(true);
    A.play("gate");
    UI.banner("Passagem liberada!", "Nova área desbloqueada");
    await tween(2.4, () => {});
    const nx = nextIndex();
    const td = timeDef(), lb = world.atm.label();
    const seasonMsg = before.estacaoId !== td.estacao ? ` Chegou o <b>${lb.estacao.toLowerCase()}</b>!` : "";
    UI.toast((nx < N ? `Siga para o prédio <b>${nx + 1} · ${CT.PREDIOS[nx].nome}</b>.` : `Todos os prédios concluídos! Vá até a <b>${CT.BOSS.predio}</b> e enfrente o <b>${CT.BOSS.nome}</b>.`) + seasonMsg, nx < N ? "success" : "boss", 5500);
    const backFrom = cam.pos.clone(), backLook = cam.look.clone();
    const tgt = followTarget();
    await tween(1.2, (p) => { const e = U.easeInOut(p); cam.pos.lerpVectors(backFrom, tgt.pos, e); cam.look.lerpVectors(backLook, tgt.look, e); });
    cam.mode = "follow";
  }

  /* ---------------- chefe final ----------------
   * O Corrupson faz várias perguntas (CT.BOSS.perguntas). A vida dele é o
   * número de perguntas: cada acerto é um golpe. Se o jogador sair no meio,
   * o dano já causado fica guardado. */
  function bossQuestions() { return CT.BOSS.perguntas || []; }
  function startBoss() {
    const B = world.boss, D = CT.BOSS, Q = bossQuestions();
    G.mode = "dialog"; UI.prompt(null); setMap(false);
    A.play("boss");
    CT.Music.play("chefe", 1.2); // trilha épica da batalha
    P.heading = Math.atan2(B.x - P.x, B.z - P.z);
    cam.mode = "boss";
    B.ch.mode = "rage"; // pula e sacode os braços, furioso
    B.marker.visible = false;
    document.body.classList.add("boss-fight");
    UI.bossBar.show(D.nome, D.cargo, Q.length, Q.length - G.bossHits);
    bossQuestion(G.bossHits === 0);
  }
  function bossQuestion(withIntro) {
    const B = world.boss, D = CT.BOSS, Q = bossQuestions();
    const i = G.bossHits, q = Q[i], last = i === Q.length - 1, key = "chefe-" + i;
    UI.dialog.show(Object.assign(questionOpts(key), {
      speaker: { nome: D.nome, cargo: D.cargo, cor: "#3D1782" },
      paginas: withIntro ? D.falasIniciais : [], rotuloIntro: D.nome,
      pergunta: q.pergunta, alternativas: q.alternativas, correta: q.correta,
      etiqueta: `Pergunta ${i + 1} de ${Q.length}` + (q.titulo ? ` — ${q.titulo}` : ""),
      explicar: (k) => (q.explicacoesErro || [])[k < q.correta ? k : k - 1] || "Resposta incorreta. Tente novamente!",
      onErro: (k, t) => { A.play("wrong"); B.ch.mode = "celebrate"; markWrong(key, t); }, // erro: ele comemora
      onAcerto: (first, t) => {
        const sc = scoreCorrect(key, t);
        if (first) G.firstTry++;
        G.bossHits++;
        const hp = Q.length - G.bossHits, c = UI.dialog.cfg;
        // golpe: barra de vida, som de dano, tremor e faíscas
        UI.bossBar.set(hp);
        UI.hitFlash();
        A.bossHit();
        B.hit();
        G.shake = last ? 0.9 : 0.6;
        B.ch.mode = last ? "defeat" : "hurt"; // acerto: ele sente o golpe, recua e nega com a cabeça
        if (last) G.bossDefeated = true;
        refreshStatuses();
        c.pontosTexto = sc.texto;
        c.extraAcerto = sc.detalhe + ".";
        c.tituloAcerto = last ? (D.tituloGolpeFinal || "Golpe final!") : (D.tituloGolpe || `Golpe certeiro! O ${D.nome} perdeu vida.`);
        c.textoAcerto = last ? D.falaDerrota : (q.falaDano || "Argh! Você me acertou!");
      },
      rotuloFinal: last ? "DERROTAR O " + D.nome.toUpperCase() : "PRÓXIMA PERGUNTA",
      onFim: () => (last ? bossFinale() : bossQuestion(false)),
      onFechar: (r, t) => { G.qTime[key] = t; leaveBoss(); },
    }));
  }
  /* o jogador saiu da batalha (ESC): o dano fica guardado */
  function leaveBoss() {
    const B = world.boss, hp = bossQuestions().length - G.bossHits;
    CT.Music.play("jogo", 2.4);
    G.mode = "city"; cam.mode = "follow"; B.ch.mode = "rage"; B.marker.visible = true;
    UI.bossBar.hide(); document.body.classList.remove("boss-fight");
    if (G.bossHits > 0) UI.toast(`O <b>${CT.BOSS.nome}</b> ainda tem <b>${hp}</b> de vida. Volte quando quiser para terminar a batalha!`, "boss", 4500);
  }
  /* golpe final: o chefe vira fumaça e a cidade é libertada */
  async function bossFinale() {
    const B = world.boss;
    G.mode = "cutscene";
    B.smoke();
    A.bossDie();
    UI.hitFlash();
    G.shake = 1.2;
    await tween(0.9, () => {});
    UI.bossBar.hide();
    await tween(1.3, () => {});
    document.body.classList.remove("boss-fight");
    victorySequence();
  }

  async function victorySequence() {
    G.mode = "cutscene";
    G.over = true; // o cronômetro da partida para aqui
    const B = world.boss;
    B.defeat();
    player.mode = "celebrate";
    world.gates.forEach((g) => { if (!g.isOpen) g.open(false); });
    const fromPos = cam.pos.clone(), fromLook = cam.look.clone();
    const toPos = new THREE.Vector3(B.tower.x - 38, 22, B.tower.z + 26);
    const toLook = new THREE.Vector3(B.tower.x, 22, B.tower.z);
    cam.mode = "script";
    world.atm.goTo(CT.TEMPO_VITORIA, 4.5);
    A.play("victory");
    CT.Music.stop(2.2); // silêncio para a fanfarra da vitória
    UI.banner(CT.FINAL.faixa || "Transparência restaurada!", CT.BOSS.nome + " foi derrotado");
    let fwT = 0;
    await tween(4.2, (p, dt) => {
      const e = U.easeInOut(p);
      cam.pos.lerpVectors(fromPos, toPos, e); cam.look.lerpVectors(fromLook, toLook, e);
      fwT -= dt;
      if (fwT <= 0 && p > 0.3) { fwT = 0.35; UI.fx.firework(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.12 + Math.random() * 0.3)); }
    });
    G.mode = "victory";
    UI.showHUD(false);
    UI.showEnd("vitoria", matchStats("vitoria"), endHandlers("vitoria"));
    UI.fx.confetti(200);
    CT.Music.play("jogo", 3);
  }

  async function replay() {
    G.mode = "transition";
    await UI.fade(true);
    UI.hideVictory();
    player.mode = "idle";
    UI.fx.clear();
    resetProgress();
    G.current = -1; G.festa = false;
    setScene("city"); cam.mode = "follow"; snapCamera();
    UI.showHUD(true);
    CT.Music.play("jogo", 2);
    await UI.fade(false);
    G.mode = "city";
    UI.toast(`Nova jornada! Comece pelo prédio <b>1 · ${CT.PREDIOS[0].nome}</b>.`, "", 4000);
  }
  function explore() {
    UI.hideVictory(); UI.showHUD(true);
    player.mode = "idle";
    G.explore = true; G.mode = "city"; cam.mode = "follow";
    updateHUD();
  }

  /* ---------------- tweens (animações por tempo) ---------------- */
  function tween(dur, fn) { return new Promise((resolve) => tweens.push({ t: 0, dur, fn, resolve })); }
  function runTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(p, dt);
      if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
  }

  /* ---------------- movimento do personagem ---------------- */
  function movePlayer(dt) {
    const canMove = (G.mode === "city" || G.mode === "interior") && !G.mapOpen;
    let fwd = canMove && (keys.ArrowUp || keys.KeyW) ? 1 : 0;
    let back = canMove && (keys.ArrowDown || keys.KeyS) ? 1 : 0;
    const left = canMove && (keys.ArrowLeft || keys.KeyA) ? 1 : 0;
    const right = canMove && (keys.ArrowRight || keys.KeyD) ? 1 : 0;
    let run = keys.ShiftLeft || keys.ShiftRight;
    let turn = left - right;
    // joystick de toque: para frente/trás anda, para os lados gira (proporcional); na borda, corre
    const tj = CT.Touch && CT.Touch.joy;
    if (canMove && tj && tj.ativo && tj.m > 0.15) {
      if (tj.y < -0.3) fwd = 1; else if (tj.y > 0.5) back = 1;
      if (Math.abs(tj.x) > 0.2) turn = -Math.sign(tj.x) * Math.min(1, (Math.abs(tj.x) - 0.2) / 0.6);
      if (fwd && tj.m > 0.92) run = true;
    }
    if (player.mode === "dance" && (fwd || back || turn)) player.mode = "idle";   // andou: para de dançar
    P.heading += turn * CFG.velocidadeGiro * dt;
    const target = fwd ? (run ? CFG.velocidadeCorrida : CFG.velocidadeCaminhada) : back ? -CFG.velocidadeCaminhada * 0.55 : 0;
    P.speed = U.damp(P.speed, target, 10, dt);
    if (Math.abs(P.speed) < 0.01 && !fwd && !back) P.speed = 0;

    if (canMove || G.mode === "transition") {
      let nx = P.x + Math.sin(P.heading) * P.speed * dt;
      let nz = P.z + Math.cos(P.heading) * P.speed * dt;
      if (G.scene === "city") {
        let r = world.colliders.resolve(nx, nz, 0.55);
        // pedestres
        world.pedestrians.forEach((pd) => {
          const dx = r.x - pd.ch.root.position.x, dz = r.z - pd.ch.root.position.z, d = Math.hypot(dx, dz);
          if (d < 0.95 && d > 1e-4) { r.x = pd.ch.root.position.x + (dx / d) * 0.95; r.z = pd.ch.root.position.z + (dz / d) * 0.95; }
        });
        P.x = r.x; P.z = r.z;
        P.y = U.damp(P.y, world.groundHeight(P.x, P.z), 18, dt);
      } else if (interiors.current) {
        const room = interiors.current;
        const r = room.colliders.resolve(nx, nz, 0.5);
        P.x = U.clamp(r.x, room.bounds.x0, room.bounds.x1);
        P.z = U.clamp(r.z, room.bounds.z0, room.bounds.z1);
        P.y = 0;
      }
    }
    // pulo
    if (P.vy !== 0 || P.jy > 0) {
      P.vy -= ((CFG.pulo && CFG.pulo.gravidade) || 24) * dt;
      P.jy += P.vy * dt;
      if (P.jy <= 0) {
        P.jy = 0; P.vy = 0; player.landed = true;
        let surf = G.scene === "interior" ? "interno" : world.surfaceAt(P.x, P.z);
        if (surf !== "interno" && surf !== "grama" && world.atm.wetness() > 0.3) surf = "molhado";
        A.step(surf, 1); setTimeout(() => A.step(surf, 0.8), 45);
      }
    }
    player.air = P.jy > 0.001; player.vy = P.vy;
    player.root.position.set(P.x, P.y + P.jy, P.z);
    player.root.rotation.y = P.heading;
    if (G.mode !== "transition") { player.speed = Math.abs(P.speed) / CFG.velocidadeCaminhada; player.backward = P.speed < -0.05; }
    player.update(dt);
    footsteps(dt);
  }

  /* ---------------- som dos passos ----------------
   * Com esqueleto: cada vez que um pé desce até perto do chão toca uma
   * pisada (fica sincronizado com a animação). Sem esqueleto: pelo ciclo
   * da animação procedural. O timbre depende do piso e da chuva. */
  const feetState = [{ up: true }, { up: true }];
  let stepCooldown = 0, lastPhaseSign = 0;
  const fv = new THREE.Vector3();
  function footsteps(dt) {
    stepCooldown -= dt;
    const moving = player.speed > 0.15 && !player.air && (G.mode === "city" || G.mode === "interior" || G.mode === "transition");
    if (!moving) { feetState.forEach((f) => (f.up = true)); return; }
    let step = false;
    if (player.feet && player.feet.length === 2 && player.footRest != null) {
      const rest = player.footRest;
      player.feet.forEach((foot, i) => {
        const y = foot.getWorldPosition(fv).y - player.root.position.y;
        const st = feetState[i];
        if (st.up && y < rest + 0.035) { st.up = false; step = true; }
        else if (!st.up && y > rest + 0.09) st.up = true;
      });
    } else {
      const sg = Math.sign(Math.sin(player.phase || 0));
      if (sg !== lastPhaseSign) { step = lastPhaseSign !== 0; lastPhaseSign = sg; }
    }
    if (step && stepCooldown <= 0) {
      stepCooldown = 0.16;
      let surf = G.scene === "interior" ? "interno" : world.surfaceAt(P.x, P.z);
      if (surf !== "interno" && surf !== "grama" && world.atm.wetness() > 0.3) surf = "molhado";
      A.step(surf, U.clamp((player.speed - 0.4) / 1.4, 0, 1));
    }
  }

  /* ---------------- câmera ---------------- */
  /* ---------------- controle pelo mouse ----------------
   * Mover o mouse para os lados gira a personagem no próprio eixo (a câmera
   * acompanha por trás); para cima/baixo inclina a câmera. Não é preciso
   * clicar. Na cidade e dentro dos prédios o ponteiro fica escondido e
   * "preso" à tela (Pointer Lock); ele volta em diálogos, mapa e telas com
   * botões. A roda aproxima/afasta e "C" recentra a câmera. */
  const camCtl = { yaw: 0, pitch: 0, dist: 7.6, idle: 99, locked: false };
  const BASE_PITCH = Math.atan2(2.2, 7.6);
  // limites da inclinação (ângulo da câmera em relação ao horizonte):
  // positivo = câmera acima olhando para baixo; negativo = olhando para o céu
  const EL_MIN = -1.38, EL_MAX = 1.25;
  let gameCanvas = null;
  // o mouse controla a personagem quando ela pode andar
  const camActive = () => (G.mode === "city" || G.mode === "interior") && !G.mapOpen && !UI.dialog.open;
  // o ponteiro fica preso também durante as transições e cenas
  const lockAllowed = () => (G.mode === "city" || G.mode === "interior" || G.mode === "transition" || G.mode === "cutscene") && !G.mapOpen && !UI.dialog.open;
  /** prende o ponteiro (precisa partir de um clique ou tecla do jogador) */
  function lockPointer() {
    if (CT.Touch && CT.Touch.ativo) return; // no toque não há ponteiro para prender
    if (!gameCanvas || camCtl.locked || G.paused || !lockAllowed() || !gameCanvas.requestPointerLock) return;
    try { const r = gameCanvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* navegador recusou */ }
  }
  /** o ponteiro só fica escondido/preso durante o jogo; em qualquer menu ele volta */
  const cursorHidden = () => !G.paused && lockAllowed() && !UI.topModal();
  function syncCursor() {
    const hide = cursorHidden();
    if (camCtl.locked && !hide) unlockPointer();
    document.body.classList.toggle("hide-cursor", hide);
    // controles de toque: só enquanto a personagem pode andar
    if (CT.Touch) CT.Touch.mostrar(camActive() && !G.paused && !UI.topModal());
  }
  /* câmera pelo toque: arrastar gira e inclina, pinça aproxima/afasta */
  function applyTouchCamera() {
    if (!CT.Touch) return;
    const t = CT.Touch.consumeLook();
    if (!camActive()) return;
    const s = CFG.sensibilidadeToque || 0.006;
    if (t.dx || t.dy) lookBy(t.dx * s, t.dy * s);
    if (t.zoom !== 1) { camCtl.dist = U.clamp(camCtl.dist * t.zoom, 3.6, 16); camCtl.idle = 0; camCtl.recenter = false; }
  }
  /** gira a personagem (dx) e inclina a câmera (dy), em radianos */
  function lookBy(dx, dy) {
    camCtl.idle = 0; camCtl.recenter = false;
    P.heading -= dx;               // gira a personagem no eixo
    // para cima = olhar para cima (até quase o zênite); para baixo = olhar o chão
    camCtl.pitch = U.clamp(camCtl.pitch + dy * 0.9, EL_MIN - BASE_PITCH, EL_MAX - BASE_PITCH);
  }
  let expectedUnlock = false;
  function unlockPointer() {
    if (document.pointerLockElement && document.exitPointerLock) { expectedUnlock = true; document.exitPointerLock(); }
  }
  function setupMouseCamera(canvas) {
    gameCanvas = canvas;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("click", lockPointer);
    document.addEventListener("pointerlockchange", () => {
      camCtl.locked = document.pointerLockElement === canvas;
      // pedido de trava que chegou atrasado, quando já estamos num menu: solta de novo
      if (camCtl.locked && !cursorHidden()) { unlockPointer(); return; }
      // o navegador solta o ponteiro quando o jogador aperta ESC: abre o menu
      if (!camCtl.locked && !expectedUnlock && (G.mode === "city" || G.mode === "interior")) openPause();
      expectedUnlock = false;
    });
    document.addEventListener("mousemove", (e) => {
      if (!camActive()) return;
      // com o ponteiro preso usamos o deslocamento bruto; sem ele, o movimento sobre a tela
      if (!camCtl.locked && e.target !== canvas) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; // ignora saltos do navegador
      if (!dx && !dy) return;
      lookBy(dx * CFG.sensibilidadeMouse, dy * CFG.sensibilidadeMouse);
    });
    canvas.addEventListener("wheel", (e) => {
      if (!camActive()) return;
      e.preventDefault();
      camCtl.dist = U.clamp(camCtl.dist * Math.exp(e.deltaY * 0.0012), 3.6, 16);
      camCtl.idle = 0;
    }, { passive: false });
  }
  function recenterCamera(instant) {
    if (instant) { camCtl.yaw = 0; camCtl.pitch = 0; } else camCtl.idle = 99;
    camCtl.recenter = true;
  }
  function updateMouseCamera(dt) {
    camCtl.idle += dt;
    // "C" recentra a inclinação e o zoom
    if (camCtl.recenter) camCtl.dist = U.damp(camCtl.dist, 7.6, 2.2, dt);
    if (camCtl.recenter) {
      camCtl.yaw = U.damp(camCtl.yaw, 0, 2.2, dt);
      camCtl.pitch = U.damp(camCtl.pitch, 0, 2.2, dt);
      if (Math.abs(camCtl.yaw) < 0.01 && Math.abs(camCtl.pitch) < 0.01 && Math.abs(camCtl.dist - 7.6) < 0.05) camCtl.recenter = false;
    }
    // mantém o ângulo entre -π e π
    camCtl.yaw = Math.atan2(Math.sin(camCtl.yaw), Math.cos(camCtl.yaw));
  }

  /* Câmera em órbita ao redor da cabeça da personagem, guiada pelo mouse.
   * Inclinando para cima: até EL_POS a câmera desce atrás da personagem;
   * daí em diante ela fica baixa e só o OLHAR sobe, até quase o zênite.
   * Assim a personagem sai de baixo da vista e o céu fica livre. */
  const EL_POS = -0.2, AIM_MAX = 1.4;
  function followTarget() {
    const a = P.heading + camCtl.yaw;
    const el = U.clamp(BASE_PITCH + camCtl.pitch, EL_MIN, EL_MAX);
    const elPos = Math.max(el, EL_POS);
    const ce = Math.cos(elPos), se = Math.sin(elPos);
    const f = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const view = new THREE.Vector3(f.x * ce, -se, f.z * ce);
    let dist = camCtl.dist + Math.max(0, P.speed - CFG.velocidadeCaminhada) * 0.25;
    const py = P.y + P.jy * 0.35; // a câmera acompanha só um pouco o pulo
    const head = new THREE.Vector3(P.x, py + 1.7, P.z);
    // câmera baixa: encurta a distância para não descer abaixo do chão
    const floor = P.y + 0.3;
    if (se < 0) dist = Math.max(1.6, Math.min(dist, (head.y - floor) / -se));
    let pos = head.clone().addScaledVector(view, -dist);
    if (pos.y < floor) pos.y = floor;
    // evita que a câmera entre nos prédios
    const dir = pos.clone().sub(head); const len = dir.length(); dir.normalize();
    ray.set(head, dir); ray.far = len;
    if (G.scene === "interior") {
      // dentro dos prédios: a câmera não atravessa as paredes nem o teto da sala
      const b = interiors.current && interiors.current.bounds;
      if (b) { pos.x = U.clamp(pos.x, b.x0 - 0.2, b.x1 + 0.2); pos.z = U.clamp(pos.z, b.z0 - 0.2, b.z1 + 1.2); }
      pos.y = Math.min(pos.y, 6.3);
    } else {
      const hit = ray.intersectObjects(world.cameraBlockers, false)[0];
      if (hit) pos = head.clone().add(dir.multiplyScalar(Math.max(1.2, hit.distance - 0.5)));
    }
    // mira um pouco acima da cabeça (a personagem fica na parte de baixo da tela)
    let look = head.clone().addScaledVector(view, 6).add(new THREE.Vector3(0, 0.9 * ce, 0));
    if (el < EL_POS) {
      // olhar para o alto: gira só a mira, a partir da posição baixa da câmera
      const d0 = look.clone().sub(pos).normalize();
      const aim = Math.min(AIM_MAX, Math.asin(U.clamp(d0.y, -1, 1)) + (EL_POS - el));
      look = pos.clone().add(new THREE.Vector3(f.x * Math.cos(aim) * 10, Math.sin(aim) * 10, f.z * Math.cos(aim) * 10));
    }
    return { pos, look };
  }
  function snapCamera() { const t = followTarget(); cam.pos.copy(t.pos); cam.look.copy(t.look); }

  function updateCamera(dt) {
    if (cam.mode === "follow" || cam.mode === "interior") {
      // na cidade e dentro dos prédios: câmera livre, guiada pelo mouse
      updateMouseCamera(dt);
      const t = followTarget();
      const rp = camCtl.idle < 0.3 ? 14 : 6; // responde rápido enquanto o mouse se move
      cam.pos.x = U.damp(cam.pos.x, t.pos.x, rp, dt); cam.pos.y = U.damp(cam.pos.y, t.pos.y, rp, dt); cam.pos.z = U.damp(cam.pos.z, t.pos.z, rp, dt);
      cam.look.x = U.damp(cam.look.x, t.look.x, 9, dt); cam.look.y = U.damp(cam.look.y, t.look.y, 9, dt); cam.look.z = U.damp(cam.look.z, t.look.z, 9, dt);
    } else if (cam.mode === "dialog") {
      const npc = cam.talkTo || interiors.current.npc.root.position;
      const mid = new THREE.Vector3((P.x + npc.x) / 2, (cam.talkTo ? P.y : 0) + 1.3, (P.z + npc.z) / 2);
      let off = new THREE.Vector3(4.6, 1.8, 3.4);
      if (cam.talkTo) { // na cidade: de lado para os dois, um pouco atrás do jogador
        const dx = npc.x - P.x, dz = npc.z - P.z, dl = Math.hypot(dx, dz) || 1;
        off = new THREE.Vector3((dz / dl) * 3.6 - (dx / dl) * 1.6, 1.5, (-dx / dl) * 3.6 - (dz / dl) * 1.6);
      }
      const tp = mid.clone().add(off);
      const tl = mid.clone().add(new THREE.Vector3(0, -0.5, 0));
      cam.pos.lerp(tp, 1 - Math.exp(-3.5 * dt)); cam.look.lerp(tl, 1 - Math.exp(-4 * dt));
    } else if (cam.mode === "select") {
      // escolha de personagem: câmera de frente para ela; a "lente" a desloca
      // para a direita (telas largas) ou para cima (celular), longe do painel
      const fx = Math.sin(P.heading), fz = Math.cos(P.heading), wide = innerWidth > 900;
      const dd = wide ? 3.0 : 4.6; // no celular, mais longe (o painel ocupa a parte de baixo)
      const tp = new THREE.Vector3(P.x + fx * dd - fz * 0.25, P.y + 1.3, P.z + fz * dd + fx * 0.25);
      const tl = new THREE.Vector3(P.x, P.y + 0.98, P.z);
      cam.pos.lerp(tp, 1 - Math.exp(-3.5 * dt)); cam.look.lerp(tl, 1 - Math.exp(-3.5 * dt));
      cam.lensX = wide ? -innerWidth * 0.17 : 0; cam.lensY = wide ? 0 : innerHeight * 0.2;
    } else if (cam.mode === "boss") {
      // enquadra o chefe inteiro na faixa livre entre a barra de vida e o diálogo
      const B = world.boss, by = B.ch.root.position.y, f = bossFrame();
      let dx = P.x - B.x, dz = P.z - B.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const a = 0.55, rx = dx * Math.cos(a) - dz * Math.sin(a), rz = dx * Math.sin(a) + dz * Math.cos(a); // de lado, sem a protagonista na frente
      const tp = new THREE.Vector3(B.x + rx * f.d, by + f.h, B.z + rz * f.d);
      const tl = new THREE.Vector3(B.x, by + f.lookY, B.z);
      cam.pos.lerp(tp, 1 - Math.exp(-3 * dt)); cam.look.lerp(tl, 1 - Math.exp(-3.5 * dt));
      cam.lensX = f.ox; cam.lensY = f.oy;
    } else if (cam.mode === "orbit") {
      const a = time * 0.05;
      cam.pos.set(Math.cos(a) * 125, 58, Math.sin(a) * 125);
      cam.look.set(0, 4, 0);
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (cam.mode === "boss" || cam.mode === "select") updateLens(cam.lensX || 0, cam.lensY || 0, dt);
    else if (lens.x || lens.y) updateLens(0, 0, dt);
    // tremor de câmera (golpes no chefe)
    if (G.shake > 0) {
      const a = G.shake * 0.35;
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; camera.position.z += (Math.random() - 0.5) * a;
      G.shake = Math.max(0, G.shake - dt * 1.6);
    }
  }

  /* Enquadramento do chefe: acha a área livre da tela (fora do diálogo e da
   * barra de vida), centraliza a "lente" nela (setViewOffset) e calcula a
   * distância e a inclinação para o chefe (world.boss.altura) caber inteiro nessa área. */
  function bossFrame() {
    const W = innerWidth, H = innerHeight, T = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dlg = document.getElementById("dialog"), bar = document.getElementById("boss-bar");
    let x0 = 0, x1 = W, y0 = bar.hidden ? 0.08 * H : bar.getBoundingClientRect().bottom + 0.04 * H, y1 = 0.9 * H;
    if (!dlg.hidden) {
      const r = dlg.getBoundingClientRect();
      if (r.left > W * 0.35) x1 = r.left - 0.02 * W;          // diálogo à direita: chefe à esquerda
      else { y1 = r.top - 0.02 * H; if (y1 - y0 < 0.22 * H) y1 = y0 + 0.22 * H; } // diálogo embaixo
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // o chefe ocupa parte da área (pés perto da base), sobrando cenário em volta
    const frac = dlg.hidden ? 0.5 : 0.66, top = y1 - frac * (y1 - y0);
    const nh = (cy - top) / (H / 2), nf = (cy - y1) / (H / 2);
    const Hb = (world.boss && world.boss.altura) || 3.4, h = Math.min(3.2, Hb * 0.5), want = Math.atan(nh * T) - Math.atan(nf * T);
    let lo = 4, hi = 60;
    for (let i = 0; i < 22; i++) { const d = (lo + hi) / 2; if (Math.atan((Hb - h) / d) - Math.atan(-h / d) > want) lo = d; else hi = d; }
    const d = Math.min(22, (lo + hi) / 2), phi = Math.atan(-h / d) - Math.atan(nf * T);
    return { d, h, lookY: h + d * Math.tan(phi), ox: W / 2 - cx, oy: H / 2 - cy };
  }
  /* desloca a "lente" suavemente (0 fora da batalha) */
  const lens = { x: 0, y: 0 };
  function updateLens(tx, ty, dt) {
    lens.x = U.damp(lens.x, tx, 4, dt); lens.y = U.damp(lens.y, ty, 4, dt);
    if (Math.abs(lens.x) < 0.5 && Math.abs(lens.y) < 0.5 && tx === 0 && ty === 0) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); lens.x = lens.y = 0; return; }
    camera.setViewOffset(innerWidth, innerHeight, lens.x, lens.y, innerWidth, innerHeight);
  }

  /* ---------------- destino e seta-guia ---------------- */
  function currentTarget() {
    if (G.bossDefeated) return null;
    const nx = nextIndex();
    const pz = world.zoneAt(P.x, P.z);
    if (pz === nx) return nx < N ? world.buildings[nx].trigger : world.boss.trigger;
    if (pz < nx) { const g = world.gates[pz]; return { x: g.x, z: g.z }; }
    const g = world.gates[pz - 1]; return g ? { x: g.x, z: g.z } : null;
  }

  function updatePrompts() {
    if (G.mode === "city") {
      if (nearLima()) return UI.prompt("PARA CONVERSAR COM SEU LIMA", "", "ESPAÇO");
      if (nearFesta()) return UI.prompt("PARA ENTRAR NA CASA DE FESTAS", "", "ESPAÇO");
      const b = nearestBuilding();
      if (b) {
        if (b.status === "available") return UI.prompt("PARA ENTRAR", "", "ESPAÇO");
        if (b.status === "done") return UI.prompt("✓ " + b.def.nome + " — concluído", "done");
        return UI.prompt("Prédio bloqueado — conclua a etapa anterior", "locked");
      }
      if (nearBoss()) {
        if (G.statuses[N] === "available") return UI.prompt("PARA ENFRENTAR O " + CT.BOSS.nome.toUpperCase(), "boss", "ESPAÇO");
        return UI.prompt("Desafio final bloqueado", "locked");
      }
      const g = nearGate();
      if (g) return UI.prompt("Bloqueado — conclua: " + CT.PREDIOS[g.k].nome, "locked");
      return UI.prompt(null);
    }
    if (G.mode === "interior") {
      const room = interiors.current;
      if (Math.hypot(P.x - room.talk.x, P.z - room.talk.z) < room.talk.r) return UI.prompt("PARA CONVERSAR COM " + (room.def.npc.chamado || room.def.npc.nome).toUpperCase(), "", "ESPAÇO");
      if (nearDino()) return UI.prompt(player.mode === "dance" ? "PARA PARAR DE DANÇAR" : "PARA DANÇAR COM O DINOSSAURO", "", "ESPAÇO");
      if (P.z > room.exitZ - 1.8) return UI.prompt("PARA VOLTAR À CIDADE", "", "ESPAÇO");
      return UI.prompt(null);
    }
    UI.prompt(null);
  }

  /* ---------------- laço principal ---------------- */
  let hudT = 0, lastClock = "";
  const ORIGIN = { x: 0, y: 0, z: 0 }, INSIDE = { x: 0, y: 0, z: 0 };
  function loop() {
    const raw = clock.getDelta();
    const dt = Math.min(raw, CT.debug.dtMax || 0.05);
    syncCursor(); // vale para todos os estados, inclusive menu de pausa e tela inicial
    if (G.paused) { // jogo congelado atrás do menu
      renderer.render(G.scene === "city" ? world.scene : interiors.scene, camera);
      return;
    }
    time += dt;
    runTweens(dt);

    if (G.mode === "title") {
      cam.mode = G.selecting ? "select" : "orbit";
      if (G.selecting) player.root.rotation.y = P.heading;
      world.update(dt, time, null);
      world.atm.update(dt, ORIGIN);
      player.root.position.set(P.x, P.y, P.z); player.update(dt);
      updateCamera(dt);
      renderer.render(world.scene, camera);
      UI.fx.update(dt);
      return;
    }

    // tempo de partida (para o ranking): conta durante o jogo, não no menu de pausa
    if (!G.over && !G.explore && G.mode !== "ended" && G.mode !== "victory") G.playTime += Math.min(raw, 1);
    applyTouchCamera();
    adaptQuality(raw);
    movePlayer(dt);

    if (G.scene === "city") {
      world.update(dt, time, P);
      world.atm.update(dt, P);   // céu, sol, clima e luzes acompanham o jogador
      // seta-guia
      const tgt = currentTarget();
      const showArrow = tgt && (G.mode === "city") && Math.hypot(tgt.x - P.x, tgt.z - P.z) > 5;
      arrow.visible = !!showArrow;
      if (showArrow) {
        const a = Math.atan2(tgt.x - P.x, tgt.z - P.z);
        arrow.position.set(P.x + Math.sin(a) * 2.1, P.y + 0.12, P.z + Math.cos(a) * 2.1);
        arrow.rotation.y = a + Math.PI;
        arrow.children[0].material.opacity = 0.65 + Math.sin(time * 5) * 0.25;
      }
    } else {
      interiors.update(dt, time, P);
      const b = G.festa ? world.casaFestas : world.buildings[G.current];
      if (b) { INSIDE.x = b.trigger.x; INSIDE.z = b.trigger.z; }
      world.atm.update(dt, INSIDE, { inside: true }); // o tempo segue passando lá fora
    }

    updateCamera(dt);
    updatePrompts();
    renderer.render(G.scene === "city" ? world.scene : interiors.scene, camera);
    UI.fx.update(dt);

    hudT -= dt;
    if (hudT <= 0) {
      hudT = 1 / 20;
      UI.setPlaytime(G.playTime);
      const tgt = G.scene === "city" ? currentTarget() : null;
      const fb = G.festa ? world.casaFestas : (G.current >= 0 ? world.buildings[G.current] : null);
      const pl = G.scene === "city" ? P : (fb ? { x: fb.center.x, z: fb.center.z, heading: P.heading } : null);
      UI.drawMap(UI.mini, world, G, pl, tgt, time);
      const lb = world.atm.label(), key = lb.hora + lb.estacao + lb.clima + lb.icon;
      if (key !== lastClock) { lastClock = key; UI.setClock(lb); }
      if (G.mapOpen) UI.drawMap(UI.big, world, G, pl, tgt, time);
    }
  }

  /* Ganchos para testes e para a equipe do evento (console do navegador). */
  CT.debug = {
    G, P,
    concluirProximo() { const i = nextIndex(); if (i < N) { G.completed[i] = true; G.score += CFG.pontosPorAcerto; refreshStatuses(); world.gates[i].open(false); } },
    teleportar(x, z) { P.x = x; P.z = z; snapCamera(); },
    irPara(i) { const t = i < N ? world.buildings[i].trigger : world.boss.trigger; P.x = t.x; P.z = t.z; snapCamera(); },
    player: () => player,
    world: () => world,
    interiors: () => interiors,
    renderer: () => renderer,
    cam: () => camera,
    girarCamera(yaw) { camCtl.yaw = yaw; },
    retrato(id, W, H, rot) { return makePortraits([charDef(id)], W || 480, H || 600, rot)[id]; },
    inclinarCamera(el) { camCtl.pitch = U.clamp(el - BASE_PITCH, EL_MIN - BASE_PITCH, EL_MAX - BASE_PITCH); camCtl.recenter = false; },
    get camCtl() { return { yaw: +camCtl.yaw.toFixed(2), pitch: +camCtl.pitch.toFixed(2), dist: +camCtl.dist.toFixed(1), locked: camCtl.locked }; },
    /** simula a caminhada a 60 quadros/s e conta as pisadas (teste) */
    simularPassos(seg, vel) {
      const real = A.step; let n = 0; A.step = () => { n++; };
      const m = G.mode; G.mode = "city";
      for (let i = 0; i < seg * 60; i++) { player.speed = vel; player.update(1 / 60); footsteps(1 / 60); }
      A.step = real; G.mode = m; player.speed = 0;
      return n / seg;
    },
    /** muda o tempo/clima: CT.debug.tempo(0..8) ou CT.debug.tempo("vitoria") */
    tempo(i, seg) { world.atm.goTo(i === "vitoria" ? CT.TEMPO_VITORIA : CT.TEMPO[i], seg == null ? 3 : seg); },
  };
})();

window.addEventListener("DOMContentLoaded", () => CT.boot());
