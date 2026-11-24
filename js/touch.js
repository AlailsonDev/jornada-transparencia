/* =====================================================================
 * CONTROLES DE TOQUE — smartphones e tablets
 *
 * Troca automática: ao tocar na tela, os controles de toque aparecem;
 * ao usar o teclado ou o mouse, somem e tudo volta a ser como no PC.
 * (classe "touch" no <body>; o CSS mostra/esconde o que é de cada modo
 * com .only-touch e .only-kbd)
 *
 *  - joystick (metade esquerda da tela): andar e girar; empurrado até a
 *    borda, corre
 *  - arrastar na metade direita: girar a personagem e olhar para cima/baixo
 *  - pinça com dois dedos: aproximar/afastar a câmera
 *  - toque duplo na metade direita: recentrar a câmera
 *  - botão de ação: pular, ou entrar/conversar quando houver algo perto
 *  - botão de menu (pausa)
 *
 * O jogo (game.js) lê CT.Touch.joy a cada quadro e consome os movimentos
 * de câmera com CT.Touch.consumeLook(). Os botões simulam as teclas do PC
 * (ESPAÇO, ESC, C), então toda a lógica do jogo é a mesma.
 * ===================================================================== */
(function () {
  const T = {
    ativo: false,
    // primário "grosso" (dedo): celular ou tablet — usado para a qualidade gráfica inicial
    movel: !!(window.matchMedia && matchMedia("(pointer: coarse)").matches),
    joy: { ativo: false, x: 0, y: 0, m: 0 },
  };
  CT.Touch = T;
  const look = { dx: 0, dy: 0, zoom: 1 };
  /** movimentos de câmera acumulados desde o último quadro */
  T.consumeLook = function () {
    const r = { dx: look.dx, dy: look.dy, zoom: look.zoom };
    look.dx = 0; look.dy = 0; look.zoom = 1;
    return r;
  };

  /* ---------- troca automática toque ⇄ teclado/mouse ---------- */
  function set(v) {
    if (T.ativo === v) return;
    T.ativo = v;
    document.body.classList.toggle("touch", v);
    if (!v) soltarTudo();
    if (typeof T.onchange === "function") T.onchange(v);
  }
  window.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") set(true); }, true);
  let mx = -1, my = -1;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    // só movimento de verdade (alguns navegadores repetem a posição depois de um toque)
    if (mx >= 0 && (Math.abs(e.clientX - mx) > 3 || Math.abs(e.clientY - my) > 3)) set(false);
    mx = e.clientX; my = e.clientY;
  }, true);
  window.addEventListener("keydown", (e) => {
    if (!e.isTrusted) return; // teclas simuladas pelos próprios botões de toque
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return; // teclado virtual do celular
    if (e.key === "Unidentified" || e.key === "Process") return;
    set(false);
  }, true);

  /* ---------- teclas simuladas ---------- */
  const CODES = { " ": "Space", Escape: "Escape", c: "KeyC", m: "KeyM" };
  function tecla(key) {
    const o = { key, code: CODES[key] || key, bubbles: true, cancelable: true };
    window.dispatchEvent(new KeyboardEvent("keydown", o));
    window.dispatchEvent(new KeyboardEvent("keyup", o));
  }
  T.tecla = tecla;

  /* ---------- camada de controles ---------- */
  const ui = document.createElement("div");
  ui.id = "touch-ui";
  ui.innerHTML = `
    <div class="tc-joy" aria-hidden="true"><div class="tc-knob"></div></div>
    <button class="tc-btn tc-action" type="button" aria-label="Ação"><span class="tc-action-label">PULAR</span></button>
    <button class="tc-btn tc-pause" type="button" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg></button>`;
  document.body.appendChild(ui);
  const joyEl = ui.querySelector(".tc-joy"), knob = ui.querySelector(".tc-knob");
  const actBtn = ui.querySelector(".tc-action"), actLabel = ui.querySelector(".tc-action-label");
  const RAIO = 56; // px até a borda do joystick

  /** rótulo do botão de ação (null: pular) — chamado pela interface junto com o aviso na tela */
  T.setAcao = function (label) {
    actBtn.classList.toggle("ready", !!label);
    actLabel.textContent = label || "PULAR";
  };

  // botões: respondem no toque (sem esperar o "click", que atrasa no celular)
  function botao(el, fn) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      el.classList.add("down");
      fn();
    });
    const up = () => el.classList.remove("down");
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("pointerleave", up);
  }
  botao(actBtn, () => tecla(" "));
  botao(ui.querySelector(".tc-pause"), () => tecla("Escape"));

  /* ---------- joystick e câmera ---------- */
  const ptrs = new Map(); // pointerId → { papel: "joy" | "look", x, y, x0, y0, t0 }
  let joyId = null, ultimoToque = { t: 0, x: 0, y: 0 }, pinca = 0;

  function posJoy(x, y) { joyEl.style.left = x + "px"; joyEl.style.top = y + "px"; }
  function atualizarJoy(p) {
    let dx = p.x - p.x0, dy = p.y - p.y0;
    const d = Math.hypot(dx, dy);
    if (d > RAIO) { dx *= RAIO / d; dy *= RAIO / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / RAIO);
    T.joy.x = dx / RAIO; T.joy.y = dy / RAIO; T.joy.m = m;
  }
  function soltarJoy() {
    joyId = null;
    T.joy.ativo = false; T.joy.x = 0; T.joy.y = 0; T.joy.m = 0;
    knob.style.transform = "";
    joyEl.classList.remove("on");
    joyEl.style.left = ""; joyEl.style.top = ""; // volta à posição de descanso
  }
  function soltarTudo() { ptrs.clear(); soltarJoy(); pinca = 0; look.dx = look.dy = 0; look.zoom = 1; }
  T.soltar = soltarTudo;
  const looks = () => [...ptrs.values()].filter((p) => p.papel === "look");

  ui.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".tc-btn")) return;
    e.preventDefault();
    try { ui.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
    const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() };
    if (joyId === null && e.clientX < innerWidth * 0.45) {
      // joystick nasce onde o dedo tocou
      p.papel = "joy"; joyId = e.pointerId;
      T.joy.ativo = true; joyEl.classList.add("on"); posJoy(p.x0, p.y0); atualizarJoy(p);
    } else {
      p.papel = "look";
    }
    ptrs.set(e.pointerId, p);
    const ls = looks();
    if (ls.length === 2) pinca = Math.hypot(ls[0].x - ls[1].x, ls[0].y - ls[1].y);
  });
  ui.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.papel === "joy") { atualizarJoy(p); return; }
    const ls = looks();
    if (ls.length >= 2) {
      const d = Math.hypot(ls[0].x - ls[1].x, ls[0].y - ls[1].y);
      if (pinca > 0 && d > 0) look.zoom *= pinca / d; // afastar os dedos aproxima a câmera
      pinca = d;
    } else {
      look.dx += dx; look.dy += dy;
    }
  });
  function fim(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    if (p.papel === "joy") { soltarJoy(); return; }
    if (looks().length < 2) pinca = 0;
    // toque rápido e parado; dois seguidos recentram a câmera
    const agora = performance.now();
    if (e.type === "pointerup" && agora - p.t0 < 250 && Math.hypot(p.x - p.x0, p.y - p.y0) < 12) {
      if (agora - ultimoToque.t < 320 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < 40) { tecla("c"); ultimoToque.t = 0; }
      else ultimoToque = { t: agora, x: p.x, y: p.y };
    }
  }
  ui.addEventListener("pointerup", fim);
  ui.addEventListener("pointercancel", fim);
  ui.addEventListener("contextmenu", (e) => e.preventDefault());
  // jogo pausado, aba trocada, menu aberto: nada fica "preso"
  window.addEventListener("blur", soltarTudo);
  document.addEventListener("visibilitychange", () => { if (document.hidden) soltarTudo(); });

  /** o jogo avisa a cada quadro se os controles devem aparecer */
  let visivel = false;
  T.mostrar = function (v) {
    v = !!v;
    if (v === visivel) return;
    visivel = v;
    document.body.classList.toggle("controls-on", v);
    if (!v) soltarTudo();
  };

  // o aviso "TOQUE EM ENTRAR" também funciona como botão
  const prompt = document.getElementById("prompt");
  if (prompt) botao(prompt, () => { if (T.ativo && prompt.classList.contains("acao")) tecla(" "); });
  // ao começar uma partida no celular/tablet: tela cheia e paisagem (onde o navegador permite)
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("#btn-start, #phase-grid [data-fase], #cs-go")) T.telaCheia();
  }, true);

  // começa no modo de toque em celulares e tablets (sem mouse)
  set(T.movel && !(matchMedia("(any-pointer: fine)").matches && matchMedia("(any-hover: hover)").matches));

  /* ---------- tela cheia (celular e tablet) ---------- */
  /** forcar: o gesto já é um toque (ex.: abertura, antes de o modo toque ser detectado) */
  T.telaCheia = function (forcar) {
    if ((!T.ativo && !forcar) || document.fullscreenElement || document.webkitFullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return; // iPhone: só instalando na tela inicial
    try {
      const r = req.call(el, { navigationUI: "hide" });
      const travar = () => { try { const o = screen.orientation; if (o && o.lock) o.lock("landscape").catch(() => {}); } catch (err) { /* sem trava */ } };
      if (r && r.then) r.then(travar, () => {}); else travar();
    } catch (err) { /* recusado */ }
  };
})();
