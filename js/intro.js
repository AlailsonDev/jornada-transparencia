/* =====================================================================
 * ABERTURA — tela branca com o logo do Ctrl Lab e "Games Institucionais" surgindo
 * aos poucos, com o efeito sonoro de CT.CONFIG.abertura. Ao terminar,
 * some e revela o menu principal (onde a música tema começa).
 *
 * ESPAÇO pula a abertura (não há aviso na tela).
 * Navegadores só deixam tocar som depois de um clique ou tecla. Se o som
 * for bloqueado, a tela branca espera esse primeiro gesto e então começa
 * a abertura com som.
 * CT.Intro.done é uma Promise resolvida quando a abertura acaba.
 * ===================================================================== */
window.CT = window.CT || {};
(function () {
  const el = document.getElementById("intro");
  const cfg = (CT.CONFIG && CT.CONFIG.abertura) || {};
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  const I = (CT.Intro = { done, ativa: !!el });
  if (!el) { resolveDone(); return; }
  if (cfg.ativa === false) { el.remove(); I.ativa = false; resolveDone(); return; }

  const gate = el.querySelector(".intro-gate");
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = cfg.som || "assets/audio/abertura-cri-games.mp3";
  audio.volume = cfg.volume != null ? cfg.volume : 0.85;
  const DUR = (cfg.duracao || 5.4) * 1000;
  let state = "inicio", timer = 0;

  function start() {
    if (state !== "inicio" && state !== "espera" && state !== "tentando") return;
    state = "tocando";
    gate.hidden = true;
    el.classList.add("play");
    timer = setTimeout(() => finish(false), DUR);
  }
  function fadeAudio(secs) {
    if (audio.paused) return;
    const v0 = audio.volume, t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      audio.volume = v0 * (1 - k);
      if (k >= 1) { clearInterval(id); audio.pause(); }
    }, 30);
  }
  function finish(fast) {
    if (state === "saindo" || state === "fim") return;
    state = "saindo";
    clearTimeout(timer);
    if (fast) { el.classList.add("fast"); fadeAudio(0.35); }
    // no fim natural o som já está acabando: deixa a cauda tocar
    el.classList.add("out");
    setTimeout(() => {
      state = "fim"; I.ativa = false;
      el.remove();
      window.removeEventListener("keydown", onKey, true);
      GESTOS.forEach((t) => window.removeEventListener(t, onPointer, true));
      const b = document.getElementById("btn-start"); if (b) b.focus({ preventScroll: true });
      resolveDone();
    }, fast ? 380 : 750);
  }
  // primeira tentativa: tocar já (funciona quando o navegador permite)
  const p = audio.play();
  if (p && p.then) {
    p.then(start, (e) => {
      if (e && e.name === "NotAllowedError") { state = "espera"; gate.hidden = false; }
      else start(); // arquivo indisponível: abertura sem som
    });
  } else start();

  // gestos: o primeiro libera o som; ESPAÇO pula; nada passa para o menu por baixo
  // (no celular, o navegador só libera o som quando o dedo SAI da tela: pointerup/touchend)
  function fromGesture() {
    if (state !== "espera") return false;
    state = "tentando";
    audio.currentTime = 0;
    const q = audio.play();
    if (q && q.then) q.then(start, (e) => {
      if (e && e.name === "NotAllowedError") state = "espera"; // gesto não aceito: espera o próximo
      else start(); // arquivo indisponível: abertura sem som
    });
    else start();
    return true;
  }
  function onKey(e) {
    if (state === "fim") return;
    if (!fromGesture() && state === "tocando" && (e.code === "Space" || e.key === " ")) finish(true);
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function onPointer(e) {
    if (state === "fim") return;
    // mouse libera o som ao apertar; toque, só ao soltar o dedo
    if (e.type !== "pointerdown" || e.pointerType === "mouse") {
      // primeiro o som: o pedido de tela cheia "gasta" a permissão do toque
      fromGesture();
      // celular/tablet: o primeiro toque também põe o jogo em tela cheia (e na horizontal)
      const toque = e.type === "touchend" || (e.type === "pointerup" && e.pointerType !== "mouse");
      if (toque && !telaCheiaPedida && CT.Touch && CT.Touch.telaCheia) { telaCheiaPedida = true; CT.Touch.telaCheia(true); }
    }
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  }
  const GESTOS = ["pointerdown", "pointerup", "touchend", "click"];
  let telaCheiaPedida = false;
  window.addEventListener("keydown", onKey, true);
  GESTOS.forEach((t) => window.addEventListener(t, onPointer, true));
})();
