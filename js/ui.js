/* =====================================================================
 * INTERFACE: tela inicial, painel de pontuação, minimapa, avisos,
 * caixa de diálogo com perguntas, efeitos e tela de vitória.
 * ===================================================================== */
window.CT = window.CT || {};

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LETTERS = ["A", "B", "C", "D"];

  const UI = {};
  CT.UI = UI;

  /* Emblema da CGM (substituível por imagem em CT.CONFIG.logoImagem). */
  UI.emblem = function () {
    if (CT.CONFIG.logoImagem) return `<img src="${esc(CT.CONFIG.logoImagem)}" alt="${esc(CT.CONFIG.orgao)}">`;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(CT.CONFIG.orgao)}">
      <circle cx="60" cy="60" r="56" fill="#16305C" stroke="#FFB020" stroke-width="6"/>
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-dasharray="3 5"/>
      <path d="M26 62 Q60 30 94 62 Q60 94 26 62Z" fill="#F4F7FC"/>
      <circle cx="60" cy="62" r="13" fill="#1E6FD9"/><circle cx="60" cy="62" r="6" fill="#0F2242"/>
      <circle cx="64" cy="58" r="3" fill="#fff"/>
      <text x="60" y="104" text-anchor="middle" font-family="Bricolage Grotesque, Arial" font-weight="800" font-size="17" fill="#FFB020">${esc(CT.CONFIG.orgaoSigla)}</text>
    </svg>`;
  };

  /** logos da Prefeitura e do CRI (CT.CONFIG.logosApoio) */
  UI.supportLogos = function () {
    return (CT.CONFIG.logosApoio || []).map((l, i) => (i ? '<span class="logo-sep" aria-hidden="true"></span>' : "") + `<img class="logo-${esc(l.id || (l.arquivo.split("/").pop() || "").replace(/\.\w+$/, ""))}" src="${esc(l.arquivo)}" alt="${esc(l.nome)}" title="${esc(l.nome)}">`).join("");
  };
  UI.init = function () {
    // textos da tela inicial vindos de data.js
    $("title-logos").innerHTML = UI.supportLogos();
    $("title-lead").textContent = CT.CONFIG.chamada;
    $("title-foot").innerHTML = `${esc(CT.CONFIG.evento)} · <b>${esc(CT.CONFIG.dataEvento)}</b>`;
    // créditos
    const dd = (v) => Array.isArray(v) ? `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : esc(v);
    $("credits-body").innerHTML =
      (CT.CREDITOS_AVISO ? `<p class="credits-note"><b>Uso livre</b>${esc(CT.CREDITOS_AVISO)}</p>` : "") +
      CT.CREDITOS.map((c) => `<dl class="row"><dt>${esc(c[0])}</dt><dd>${dd(c[1])}</dd></dl>`).join("");
    // seleção de fases: os 8 prédios + o chefe final
    const SEASON = { primavera: "Primavera", verao: "Verão", outono: "Outono", inverno: "Inverno" };
    const when = (k) => { const t = CT.TEMPO[Math.min(k, CT.TEMPO.length - 1)]; const h = Math.floor(t.hora), m = Math.round((t.hora - h) * 60); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · ${SEASON[t.estacao] || ""}`; };
    $("phase-grid").innerHTML = CT.PREDIOS.map((p, i) =>
      `<button class="menu-btn phase-card" data-fase="${i}" style="--c:${esc(p.cor)}"><span class="ph-num">${i + 1}</span><span class="ph-text"><b>${esc(p.nome)}</b><small>${esc(p.npc.nome)} · ${when(i)}</small></span></button>`).join("") +
      `<button class="menu-btn phase-card boss" data-fase="${CT.PREDIOS.length}" style="--c:#8E44FF"><span class="ph-num"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg></span><span class="ph-text"><b>${esc(CT.BOSS.nome)}</b><small>${esc(CT.BOSS.predio)} · ${(CT.BOSS.perguntas || []).length} perguntas</small></span></button>`;
    // fechar janelas pelo botão VOLTAR
    document.querySelectorAll(".modal [data-close]").forEach((b) => (b.onclick = () => UI.closeModal(b.closest(".modal").id)));
    UI.fx = new FX($("fx"));
    UI.mini = $("minimap").getContext("2d");
    sizeCanvas($("minimap"), 210);
  };

  function sizeCanvas(c, css) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(c.clientWidth * dpr || css * dpr);
    c.height = c.width;
  }
  window.addEventListener("resize", () => { if ($("minimap")) sizeCanvas($("minimap"), 210); });

  UI.showTitle = function (v) {
    $("title-screen").hidden = !v;
    if (v) setTimeout(() => { const b = $("btn-start"); if (b && !b.disabled) b.focus(); }, 30);
  };

  /* ---------------- escolha de personagem ---------------- */
  UI.charSelect = {
    portraits: {},
    /* monta os cartões; onPick(id) ao escolher */
    build(onPick) {
      $("cs-grid").innerHTML = CT.PERSONAGENS.map((p) =>
        `<button class="cs-card" role="radio" aria-checked="false" data-id="${esc(p.id)}" aria-label="${esc(p.nome)}, ${esc(p.papel)}">
          <span class="cs-portrait">${this.portraits[p.id] ? `<img src="${this.portraits[p.id]}" alt="">` : `<i>${esc(p.nome[0])}</i>`}</span>
          <span class="cs-card-name">${esc(p.nome)}</span></button>`).join("");
      $("cs-grid").querySelectorAll(".cs-card").forEach((b) => (b.onclick = () => onPick(b.dataset.id, true)));
    },
    select(id) {
      const p = CT.PERSONAGENS.find((x) => x.id === id) || CT.PERSONAGENS[0];
      $("cs-grid").querySelectorAll(".cs-card").forEach((b) => { const on = b.dataset.id === p.id; b.setAttribute("aria-checked", String(on)); b.classList.toggle("on", on); });
      $("cs-name").textContent = p.nome; $("cs-role").textContent = p.papel; $("cs-desc").textContent = p.descricao;
    },
    show(v, fase) {
      $("charselect").hidden = !v;
      if (v) {
        $("cs-kicker").textContent = fase > 0 ? (fase < CT.PREDIOS.length ? `Fase ${fase + 1} · ${CT.PREDIOS[fase].nome}` : "Fase final · " + CT.BOSS.nome) : "Antes de começar";
        setTimeout(() => $("cs-go").focus(), 30);
      }
    },
  };

  /* ---------------- janelas (Como jogar, Créditos, Pausa) ---------------- */
  const modalStack = [];
  UI.openModal = function (id) {
    const el = $(id); if (!el) return;
    if (el.hidden) el._opener = document.activeElement; // devolve o foco a quem abriu
    el.hidden = false;
    if (!modalStack.includes(id)) modalStack.push(id);
    el.style.zIndex = String(45 + modalStack.indexOf(id)); // a última aberta fica por cima
    const f = el.querySelector(".menu-btn:not([hidden]), [data-close]"); if (f) setTimeout(() => f.focus(), 20);
  };
  UI.closeModal = function (id) {
    const el = $(id); if (!el) return;
    el.hidden = true;
    const i = modalStack.indexOf(id); if (i >= 0) modalStack.splice(i, 1);
    const op = el._opener; el._opener = null;
    if (op && op.offsetParent !== null && document.contains(op)) { op.focus(); return; }
    const top = modalStack[modalStack.length - 1];
    if (top) { const f = $(top).querySelector(".menu-btn"); if (f) f.focus(); }
    else if (!$("title-screen").hidden) { const b = $("btn-start"); if (b && !b.disabled) b.focus(); }
  };
  UI.topModal = () => modalStack[modalStack.length - 1] || null;
  /** setas ↑ ↓ movem o foco entre os botões visíveis de um menu */
  UI.menuNav = function (container, dir) {
    const btns = [...container.querySelectorAll(".menu-btn")].filter((b) => !b.disabled && b.offsetParent !== null);
    if (!btns.length) return;
    let i = btns.indexOf(document.activeElement);
    i = i < 0 ? 0 : (i + dir + btns.length) % btns.length;
    btns[i].focus();
    CT.Audio.play("click");
  };
  /** menu de pausa: dados da partida */
  UI.setPause = function (st) {
    $("pause-stats").innerHTML = `<div><b>${st.score.toLocaleString("pt-BR")}</b><span>pontos</span></div><div><b>${st.done}/${st.total}</b><span>prédios</span></div><div><b>${esc(st.hora)}</b><span>${esc(st.estacao)}</span></div>`;
    $("pause-sound").textContent = st.muted ? "SOM: DESLIGADO" : "SOM: LIGADO";
    $("pause-confirm").hidden = true;
    $("pause-menu").hidden = false;
  };
  UI.showHUD = function (v) { $("hud").hidden = !v; };

  /* ---------------- Barra de vida do chefe ---------------- */
  UI.bossBar = {
    max: 1,
    show(nome, cargo, max, hp) {
      this.max = Math.max(1, max);
      $("bb-name").textContent = nome; $("bb-role").textContent = cargo;
      $("bb-segs").innerHTML = Array.from({ length: this.max - 1 }, (_, i) => `<i style="left:${((i + 1) / this.max) * 100}%"></i>`).join("");
      $("boss-bar").hidden = false;
      $("boss-bar").classList.remove("down");
      this.set(hp, true);
    },
    set(hp, instant) {
      const el = $("boss-bar"), pct = (Math.max(0, hp) / this.max) * 100 + "%";
      el.style.setProperty("--hp", pct);
      if (instant) el.style.setProperty("--trail", pct);
      else { setTimeout(() => el.style.setProperty("--trail", pct), 420); el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
      $("bb-count").textContent = hp > 0 ? `${hp}/${this.max}` : "DERROTADO";
      el.classList.toggle("down", hp <= 0);
      $("bb-track").setAttribute("aria-valuenow", String(Math.max(0, hp)));
      $("bb-track").setAttribute("aria-valuemax", String(this.max));
    },
    hide() { $("boss-bar").hidden = true; },
  };
  /* clarão vermelho nas bordas da tela (golpe) */
  UI.hitFlash = function () { const f = $("hit-flash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); };

  /* ---------------- Painel de pontuação ---------------- */
  let lastScore = -1;
  UI.setHUD = function (s) {
    if (s.score !== lastScore) {
      $("score").textContent = s.score.toLocaleString("pt-BR");
      if (lastScore >= 0 && s.score > lastScore) { const e = $("score"); e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }
      lastScore = s.score;
    }
    const segs = $("journey").children;
    s.statuses.forEach((st, i) => { segs[i].className = (i === 8 ? "boss " : "") + st; segs[i].title = (i < 8 ? CT.PREDIOS[i].nome : CT.BOSS.predio) + " — " + ({ locked: "bloqueado", available: "disponível", done: "concluído" }[st]); });
    $("done-count").innerHTML = `<b>${s.done}</b> de ${s.total} prédios`;
    $("challenge-count").innerHTML = `<b>${s.challenges}</b> desafios concluídos`;
    $("objective").innerHTML = s.objective;
  };

  /* ---------------- Tempo de partida ---------------- */
  UI.setPlaytime = function (s) { $("playtime").textContent = CT.Ranking.tempoTexto(s); };

  /* ---------------- Relógio, estação e clima ---------------- */
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4.5" fill="#FFC12E"/><g stroke="#FFC12E" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>',
    partly: '<circle cx="9" cy="9" r="3.6" fill="#FFC12E"/><g stroke="#FFC12E" stroke-width="1.8" stroke-linecap="round"><path d="M9 2.5v1.6M2.5 9h1.6M4.4 4.4l1.1 1.1M13.6 4.4l-1.1 1.1"/></g><path d="M7.5 19h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 7.5 19z" fill="#E8EEF7"/>',
    cloud: '<path d="M6.5 18.5h11a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 18.5z" fill="#C9D3E2"/>',
    rain: '<path d="M6.5 14.5h11a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 14.5z" fill="#AEB9CB"/><g stroke="#6FB7FF" stroke-width="1.8" stroke-linecap="round"><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></g>',
    moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15 7 7 0 0 1-5-15z" fill="#E6ECFF"/><circle cx="19" cy="5" r=".9" fill="#E6ECFF"/><circle cx="21" cy="10" r=".6" fill="#E6ECFF"/>',
  };
  UI.setClock = function (lb) {
    const el = $("clock"); if (!el) return;
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[lb.icon] || ICONS.sun}</svg><span class="clock-time">${esc(lb.hora)}</span><span class="clock-meta"><b>${esc(lb.estacao)}</b> · ${esc(lb.clima)}</span>`;
    el.dataset.season = lb.estacaoId || "";
  };

  /* ---------------- Aviso de interação ---------------- */
  let promptKey = "";
  UI.prompt = function (text, kind, key) {
    const el = $("prompt");
    const k = (text || "") + (kind || "") + (key || "");
    if (k === promptKey) return;
    promptKey = k;
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.className = kind || "";
    el.innerHTML = key ? `<span>PRESSIONE</span><span class="kbd">${esc(key)}</span><span>${esc(text)}</span>` : `<span>${esc(text)}</span>`;
  };

  /* ---------------- Notificações ---------------- */
  let toastTimer = 0;
  UI.toast = function (html, kind, ms) {
    const el = $("toast");
    el.className = kind || "";
    el.innerHTML = html;
    el.hidden = false; el.removeAttribute("data-hiding");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.setAttribute("data-hiding", ""); setTimeout(() => (el.hidden = true), 320); }, ms || 3800);
  };
  UI.banner = function (title, small) {
    const old = $("banner"); if (old) old.remove();
    const b = document.createElement("div"); b.id = "banner";
    b.innerHTML = (small ? `<small>${esc(small)}</small>` : "") + esc(title);
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1900);
  };

  UI.fade = function (on) {
    return new Promise((res) => { $("fade").classList.toggle("on", on); setTimeout(res, 480); });
  };

  /* =================================================================
   * CAIXA DE DIÁLOGO
   * cfg: { speaker:{nome,cargo,cor}, paginas[], baseLegal, pergunta,
   *        alternativas[4], correta, explicar(i), onAcerto(), textoAcerto,
   *        extraAcerto, rotuloFinal, onFim(), onFechar(), etiqueta }
   * =============================================================== */
  const D = { open: false };
  UI.dialog = D;
  let typer = 0;

  D.show = function (cfg) {
    D.cfg = cfg; D.open = true; D.page = 0; D.wrong = new Set(); D.focus = -1;
    D.step = cfg.paginas && cfg.paginas.length ? "intro" : "question"; // sem falas: vai direto à pergunta
    D.tBase = cfg.tempoInicial || 0; D.tStart = null;
    $("dialog").hidden = false;
    $("dialog").style.setProperty("--speaker", cfg.speaker.cor);
    if (D.step === "question") startTimer();
    render();
  };
  D.close = function (silent) {
    clearInterval(typer); stopTimer();
    D.open = false; $("dialog").hidden = true;
    const c = D.cfg; D.cfg = null;
    if (!silent && c && c.onFechar) c.onFechar(D.step === "right", D.elapsed());
  };
  /* Cronômetro da pergunta: começa quando a caixa com a pergunta aparece e
   * para na resposta certa. Se o diálogo for fechado e aberto de novo, ele
   * continua de onde parou (cfg.tempoInicial). */
  let speedTimer = 0;
  D.elapsed = () => D.tBase + (D.tStart != null ? (performance.now() - D.tStart) / 1000 : 0);
  function startTimer() {
    if (D.tStart == null) D.tStart = performance.now();
    clearInterval(speedTimer);
    speedTimer = setInterval(() => { const el = document.querySelector("#dialog .speed-chip b"); if (el && D.cfg && D.cfg.bonusAgora) el.textContent = "+" + D.cfg.bonusAgora(D.elapsed()); }, 200);
  }
  function stopTimer() {
    clearInterval(speedTimer);
    if (D.tStart != null) { D.tBase += (performance.now() - D.tStart) / 1000; D.tStart = null; }
  }

  const paras = (t) => String(t || "").split(/\n\n/).map((p) => `<span class="par">${esc(p)}</span>`).join("");
  function head(stepLabel) {
    const s = D.cfg.speaker;
    const ini = s.nome.replace(/^(Dr\.ª?|Dra\.|Eng\.ª|Seu|Dona)\s+/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("");
    return `<div class="dlg-head"><div class="avatar">${esc(ini)}</div><div><div class="dlg-name">${esc(s.nome)}</div><div class="dlg-role">${esc(s.cargo)}</div></div><div class="dlg-step">${esc(stepLabel)}</div></div>`;
  }

  // escreve o texto (falas com vários parágrafos: separados por uma linha em branco, "\n\n")
  function setParas(el, t) {
    el.innerHTML = t.split(/\n\n/).map((p) => `<span class="par">${esc(p)}</span>`).join("");
  }
  function typeInto(el, text) {
    clearInterval(typer);
    D.typing = true; D.full = text;
    let i = 0;
    el.textContent = "";
    typer = setInterval(() => {
      i += 3;
      setParas(el, text.slice(0, i));
      if (i % 9 === 0) CT.Audio.play("type");
      if (i >= text.length) { clearInterval(typer); D.typing = false; setParas(el, text); }
    }, 22);
  }
  function finishTyping() {
    if (!D.typing) return false;
    clearInterval(typer); D.typing = false;
    const el = document.querySelector("#dialog .dlg-text"); if (el) setParas(el, D.full);
    return true;
  }

  function render() {
    const c = D.cfg, el = $("dialog");
    const tag = c.etiqueta || "Desafio";
    if (D.step === "intro") {
      const last = D.page >= c.paginas.length - 1;
      el.innerHTML = head(c.rotuloIntro || "Curiosidade") + `<div class="dlg-body"><p class="dlg-text"></p>${last && c.baseLegal ? `<span class="legal">Base legal: ${esc(c.baseLegal)}</span>` : ""}</div>
        <div class="dlg-foot"><span class="hint"><span class="kbd">ESC</span> fechar</span><span class="hint" style="margin-right:0">${D.page + 1}/${c.paginas.length}</span>
        <button class="btn-dlg" id="dlg-next">${last ? (c.pergunta ? "VER A PERGUNTA" : (c.rotuloFim || "VAMOS LÁ!")) : "CONTINUAR"} <span class="kbd">ESPAÇO</span></button></div>`;
      typeInto(el.querySelector(".dlg-text"), c.paginas[D.page]);
      $("dlg-next").onclick = () => advance();
    } else if (D.step === "question" || D.step === "wrong") {
      const wrongNow = D.step === "wrong";
      el.innerHTML = head(tag) + `<div class="dlg-body"><p class="dlg-text question">${esc(c.pergunta)}</p>
        <div class="options">${c.alternativas.map((a, i) => `<button class="opt ${D.wrong.has(i) ? "wrong" : ""} ${i === D.focus ? "focus" : ""}" data-i="${i}" ${D.wrong.has(i) || wrongNow ? "disabled" : ""}><span class="letter">${LETTERS[i]}</span><span>${esc(a)}</span></button>`).join("")}</div>
        ${wrongNow ? `<div class="feedback bad"><div class="badge">✕</div><div><h3>Resposta incorreta</h3><p>${paras(D.explain)}</p></div></div>` : ""}
        </div>
        <div class="dlg-foot">${wrongNow
            ? `<span class="hint">Releia a explicação e tente de novo. O tempo continua correndo.</span>${speedChip(c)}<button class="btn-dlg" id="dlg-retry">TENTAR NOVAMENTE <span class="kbd">ESPAÇO</span></button>`
            : `<span class="hint"><span class="kbd">A</span><span class="kbd">B</span><span class="kbd">C</span><span class="kbd">D</span> ou clique para responder · <span class="kbd">ESC</span> fechar</span>${speedChip(c)}`}</div>`;
      el.querySelectorAll(".opt").forEach((b) => (b.onclick = () => answer(+b.dataset.i)));
      if (wrongNow) $("dlg-retry").onclick = () => retry();
    } else if (D.step === "right") {
      el.innerHTML = head(tag) + `<div class="dlg-body"><p class="dlg-text question">${esc(c.pergunta)}</p>
        <div class="options">${c.alternativas.map((a, i) => `<button class="opt ${i === c.correta ? "right" : D.wrong.has(i) ? "wrong" : ""}" disabled><span class="letter">${LETTERS[i]}</span><span>${esc(a)}</span></button>`).join("")}</div>
        <div class="feedback ok"><div class="badge">✓</div><div><h3>${esc(c.tituloAcerto || "Resposta correta!")} <span class="points">${c.pontosTexto ? esc(c.pontosTexto) : ""}</span></h3><p>${paras(c.textoAcerto)}</p>${c.extraAcerto ? `<p style="margin-top:6px"><b>${esc(c.extraAcerto)}</b></p>` : ""}</div></div>
        </div>
        <div class="dlg-foot"><button class="btn-dlg go" id="dlg-finish">${esc(c.rotuloFinal || "VOLTAR À CIDADE")} <span class="kbd">ESPAÇO</span></button></div>`;
      $("dlg-finish").onclick = () => finish();
    }
  }

  // bônus de rapidez ao vivo (diminui enquanto a pergunta está na tela)
  const speedChip = (c) => c.bonusAgora ? `<span class="speed-chip" title="Quanto mais rápido responder, mais pontos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>Rapidez <b>+${c.bonusAgora(D.elapsed())}</b></span>` : "";
  function advance() {
    if (finishTyping()) return;
    CT.Audio.play("click");
    if (D.page < D.cfg.paginas.length - 1) { D.page++; render(); }
    else if (!D.cfg.pergunta) D.close();   // só conversa (sem pergunta): fecha no fim
    else { D.step = "question"; D.focus = -1; startTimer(); render(); }
  }
  function retry() { D.step = "question"; D.focus = -1; CT.Audio.play("click"); startTimer(); render(); }
  function answer(i) {
    if (D.step !== "question" || D.wrong.has(i)) return;
    const c = D.cfg;
    if (i === c.correta) {
      stopTimer();
      D.step = "right";
      if (c.onAcerto) c.onAcerto(D.wrong.size === 0, D.elapsed());
      render();
    } else {
      D.wrong.add(i);
      D.explain = c.explicar(i);
      D.step = "wrong";
      if (c.onErro) c.onErro(i, D.elapsed());
      render();
    }
  }
  function finish() {
    clearInterval(typer); stopTimer();
    const c = D.cfg;
    D.open = false; $("dialog").hidden = true; D.cfg = null;
    if (c && c.onFim) c.onFim();
  }

  /* Teclado dentro do diálogo. Retorna true se consumiu a tecla. */
  D.key = function (e) {
    if (!D.open) return false;
    const k = e.key;
    if (k === "Escape") { if (D.step === "right") finish(); else D.close(); return true; }
    if (D.step === "intro") { if (k === " " || k === "Enter") advance(); return true; }
    if (D.step === "wrong") { if (k === " " || k === "Enter") retry(); return true; }
    if (D.step === "right") { if (k === " " || k === "Enter") finish(); return true; }
    if (D.step === "question") {
      const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
      const lk = k.toLowerCase();
      if (lk in map) { answer(map[lk]); return true; }
      const nav = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 };
      if (k in nav) {
        let f = D.focus < 0 ? 0 : D.focus + nav[k];
        f = Math.max(0, Math.min(3, f));
        D.focus = f;
        document.querySelectorAll("#dialog .opt").forEach((b, i) => b.classList.toggle("focus", i === f));
        return true;
      }
      if ((k === " " || k === "Enter") && D.focus >= 0) { answer(D.focus); return true; }
      return true;
    }
    return false;
  };

  /* =================================================================
   * MINIMAPA
   * =============================================================== */
  const MAPR = 114;
  UI.drawMap = function (ctx, W, G, player, target, t) {
    const size = ctx.canvas.width;
    const sc = size / (MAPR * 2);
    const X = (x) => (x + MAPR) * sc, Z = (z) => (z + MAPR) * sc;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0B1730"; ctx.fillRect(0, 0, size, size);
    const C = CT.WORLD_CONST;
    // bairros
    W.zones.forEach((z, i) => {
      const open = i <= G.unlocked;
      ctx.fillStyle = open ? "#3B4E74" : "#18233F";
      ctx.fillRect(X(z.x - C.IN), Z(z.z - C.IN), C.IN * 2 * sc, C.IN * 2 * sc);
      if (!open) {
        ctx.save(); ctx.beginPath(); ctx.rect(X(z.x - C.IN), Z(z.z - C.IN), C.IN * 2 * sc, C.IN * 2 * sc); ctx.clip();
        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = Math.max(1, sc * 1.2);
        for (let d = -C.IN * 2; d < C.IN * 2; d += 6) { ctx.beginPath(); ctx.moveTo(X(z.x - C.IN + d), Z(z.z - C.IN)); ctx.lineTo(X(z.x - C.IN + d + C.IN * 2), Z(z.z + C.IN)); ctx.stroke(); }
        ctx.restore();
      }
    });
    // ruas (mais claras) nos bairros abertos
    W.zones.forEach((z, i) => {
      if (i > G.unlocked || i === 8) return;
      ctx.fillStyle = "#56698F";
      ctx.fillRect(X(z.x - C.IN), Z(z.z - C.RD), C.IN * 2 * sc, C.RD * 2 * sc);
      ctx.fillRect(X(z.x - C.RD), Z(z.z - C.IN), C.RD * 2 * sc, C.IN * 2 * sc);
    });
    // quadras (parques em verde)
    W.minimap.quads.forEach((q) => {
      if (W.zoneAt((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2) > G.unlocked) return;
      ctx.fillStyle = q.kind === "park" ? "#3E7A5A" : q.kind === "parking" ? "#46597E" : "#4A5D84";
      ctx.fillRect(X(q.x0 + 2), Z(q.z0 + 2), (q.x1 - q.x0 - 4) * sc, (q.z1 - q.z0 - 4) * sc);
    });
    if (G.unlocked >= 8) W.minimap.plazas.forEach((p) => { ctx.fillStyle = "#4B3F78"; ctx.fillRect(X(p.x0 + 2), Z(p.z0 + 2), (p.x1 - p.x0 - 4) * sc, (p.z1 - p.z0 - 4) * sc); });
    // fileiras de prédios
    ctx.fillStyle = "#08101F";
    W.minimap.rows.forEach((r) => ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc));
    // portões
    W.gates.forEach((g) => {
      ctx.fillStyle = g.isOpen ? "#18B26B" : "#E2574C";
      if (g.axis === "x") ctx.fillRect(X(g.x - 1.5), Z(g.z - C.RD), 3 * sc, C.RD * 2 * sc);
      else ctx.fillRect(X(g.x - C.RD), Z(g.z - 1.5), C.RD * 2 * sc, 3 * sc);
    });
    // prédios por status
    const colors = { locked: "#6B7385", available: "#FFB020", done: "#18B26B" };
    W.buildings.forEach((b, i) => {
      const st = G.statuses[i];
      ctx.fillStyle = colors[st];
      const r = b.rect;
      ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
      if (st === "available") { ctx.strokeStyle = `rgba(255,176,32,${0.5 + Math.sin(t * 5) * 0.5})`; ctx.lineWidth = Math.max(2, sc * 2); ctx.strokeRect(X(r.x0) - 3, Z(r.z0) - 3, (r.x1 - r.x0) * sc + 6, (r.z1 - r.z0) * sc + 6); }
      ctx.fillStyle = st === "available" ? "#1A1300" : "#FFFFFF";
      ctx.font = `800 ${Math.round(9 * sc)}px ${CT.U.FONT_DISPLAY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(st === "done" ? "✓" : String(i + 1), X((r.x0 + r.x1) / 2), Z((r.z0 + r.z1) / 2));
    });
    // torre do chefe
    const bs = G.statuses[8], tw = W.boss.tower;
    ctx.fillStyle = bs === "done" ? "#18B26B" : bs === "available" ? "#8E44FF" : "#6B7385";
    ctx.beginPath(); ctx.arc(X(tw.x), Z(tw.z), 8 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(9 * sc)}px ${CT.U.FONT_DISPLAY}`; ctx.fillText("★", X(tw.x), Z(tw.z) + 1);
    // destino atual
    if (target) {
      const pr = (10 + (t * 14) % 10) * sc;
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(target.x), Z(target.z), pr, 0, Math.PI * 2); ctx.stroke();
    }
    // jogador
    if (player) {
      ctx.save(); ctx.translate(X(player.x), Z(player.z)); ctx.rotate(-player.heading + Math.PI);
      const s = Math.max(6, 5 * sc);
      ctx.fillStyle = "#FFC12E"; ctx.strokeStyle = "#0B1730"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s, s); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };

  UI.toggleBigMap = function (v) {
    const el = $("bigmap");
    el.hidden = v === undefined ? !el.hidden : !v;
    if (!el.hidden) { const c = $("bigmap-canvas"); sizeCanvas(c, 600); UI.big = c.getContext("2d"); }
    return !el.hidden;
  };

  /* =================================================================
   * VITÓRIA
   * =============================================================== */
  /* =================================================================
   * FIM DA PARTIDA (vitória, Fim de Jogo ou partida encerrada)
   * 1º o jogador vê o resultado e registra o nome; 2º aparece a posição
   * dele no ranking e os botões para seguir.
   * tipo: "vitoria" | "desistiu"
   * h: { registrar(nome) → resultado de CT.Ranking.adicionar, replay, explore, home }
   * =============================================================== */
  const SEALS = {
    vitoria: '<svg class="seal" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="#FFB020"/><circle cx="60" cy="60" r="44" fill="#16305C"/><path d="M60 28 L68 50 L92 50 L73 64 L80 87 L60 73 L40 87 L47 64 L28 50 L52 50Z" fill="#FFB020"/></svg>',
    desistiu: '<svg class="seal" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="#8FA3C4"/><circle cx="60" cy="60" r="44" fill="#16305C"/><path d="M45 88V32M45 34h34l-8 12 8 12H45" fill="none" stroke="#CFE0FF" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };
  UI.showEnd = function (tipo, st, h) {
    const v = $("victory"), R = CT.Ranking;
    fimAtual = null;
    const kicker = tipo === "vitoria" ? "Jornada concluída" : "Partida encerrada";
    const title = tipo === "vitoria" ? (st.genero === "f" && CT.FINAL.tituloFeminino ? CT.FINAL.tituloFeminino : CT.FINAL.titulo) : CT.ENCERRADA.titulo;
    const msg = tipo === "vitoria" ? CT.FINAL.mensagem : CT.ENCERRADA.mensagem;
    v.className = "end-" + tipo;
    v.innerHTML = `<div class="victory-card">
      ${SEALS[tipo]}
      <div class="victory-kicker">${esc(kicker)}</div>
      <h1 class="victory-title">${esc(title)}</h1>
      <div class="stats">
        <div class="stat"><b>${st.pontos.toLocaleString("pt-BR")}</b><span>pontos</span></div>
        <div class="stat"><b>${st.acertos}/${st.perguntas}</b><span>respostas certas</span></div>
        <div class="stat"><b>${R.tempoTexto(st.tempo)}</b><span>tempo de partida</span></div>
      </div>
      <p class="victory-msg">${paras(msg)}</p>
      <div class="end-rank" id="end-rank">
        <form class="rank-form" id="rank-form" autocomplete="off" novalidate>
          <label for="rank-name">Digite seu nome para registrar a pontuação no ranking</label>
          <div class="rank-input-row">
            <input id="rank-name" name="nome" maxlength="24" placeholder="Seu nome" enterkeyhint="done" spellcheck="false">
            <button class="btn-primary" type="submit">REGISTRAR</button>
          </div>
          <small class="rank-err" id="rank-err" hidden>Digite pelo menos 2 letras.</small>
          ${st.faseInicial > 0 ? `<small class="rank-note">Partida iniciada na fase ${st.faseInicial + 1} (pela seleção de fases).</small>` : ""}
        </form>
      </div>
      <div class="victory-actions" id="end-actions" hidden>
        <button class="btn-primary" id="btn-replay">JOGAR NOVAMENTE</button>
        ${tipo === "vitoria" && h.explore ? '<button class="btn-ghost" id="btn-explore">CONTINUAR EXPLORANDO</button>' : ""}
        <button class="btn-ghost" id="btn-home">TELA INICIAL</button>
      </div>
      <div class="victory-org"><div class="victory-logos">${UI.supportLogos() || UI.emblem()}</div><span>${esc(CT.CONFIG.evento)} · ${esc(CT.CONFIG.dataEvento)}</span></div>
    </div>`;
    v.hidden = false; v.scrollTop = 0;
    const input = $("rank-name");
    $("rank-form").onsubmit = (e) => {
      e.preventDefault();
      const nome = R.limparNome(input.value);
      if (nome.replace(/[^\p{L}\p{N}]/gu, "").length < 2) { $("rank-err").hidden = false; input.focus(); CT.Audio.play("locked"); return; }
      const res = h.registrar(nome);
      CT.Audio.play("correct");
      fimAtual = { nome, id: res.registro.id };
      renderEndRank();
      $("end-actions").hidden = false;
      $("btn-replay").onclick = h.replay;
      if ($("btn-explore")) $("btn-explore").onclick = h.explore;
      $("btn-home").onclick = h.home;
      setTimeout(() => $("btn-replay").focus(), 50);
    };
    setTimeout(() => input.focus(), 400);
  };
  /* posição do jogador e top 10 (redesenhado quando o ranking online muda) */
  let fimAtual = null;
  function renderEndRank() {
    const box = $("end-rank");
    if (!fimAtual || !box || $("victory").hidden) return;
    const R = CT.Ranking, ON = R.online, res = R.resultado(fimAtual.id);
    const pos = res.posicao
      ? `${esc(fimAtual.nome)}, você está em <b>${res.posicao}º lugar</b> entre ${res.total} ${res.total === 1 ? "partida registrada" : "partidas registradas"}${ON.ativo ? " por todos os jogadores" : ""}.`
      : `${esc(fimAtual.nome)}, sua partida foi registrada.`;
    let nota = "";
    if (ON.ativo && R.pendente(fimAtual.id)) nota = ON.aoVivo ? "Enviando sua pontuação para o ranking geral…" : "Sem conexão com a internet: sua pontuação foi guardada e será enviada ao ranking geral assim que a conexão voltar.";
    else if (ON.ativo && ON.erro === "permission-denied") nota = "Não foi possível enviar sua pontuação ao ranking geral (envio recusado pelo servidor). Ela ficou guardada neste aparelho.";
    else if (!ON.ativo && !R.persistente) nota = "Atenção: este navegador não permite guardar dados; o ranking será perdido ao fechar o jogo.";
    box.innerHTML = `<p class="rank-pos">${pos}</p>
      ${UI.rankingTable(res.lista, { destaque: fimAtual.id, limite: 10 })}
      ${nota ? `<small class="rank-note">${esc(nota)}</small>` : ""}`;
  }
  // compatibilidade: tela de vitória antiga
  UI.showVictory = function (st, h) { UI.showEnd("vitoria", st, h); };

  /* tabela do ranking (top N; a linha destacada aparece mesmo fora do top) */
  UI.rankingTable = function (lista, o) {
    o = o || {};
    const R = CT.Ranking, lim = o.limite || 10;
    if (!lista.length) return '<p class="rank-empty">Nenhuma partida registrada ainda. Seja o primeiro!</p>';
    let rows = lista.slice(0, lim).map((e, i) => [e, i]);
    const di = o.destaque ? lista.findIndex((e) => e.id === o.destaque) : -1;
    if (di >= lim) rows.push(null, [lista[di], di]);
    const medal = (i) => i < 3 ? `<span class="medal m${i + 1}">${i + 1}</span>` : `<span class="pos">${i + 1}</span>`;
    const res = (r) => `<span class="res res-${r}">${esc(R.resultadoTexto(r))}</span>`;
    return `<div class="rank-wrap"><table class="rank-table">
      <thead><tr><th>#</th><th>Nome</th><th class="num">Pontos</th><th class="num">Acertos</th><th class="num">Tempo</th><th>Resultado</th>${o.data ? "<th>Data</th>" : ""}</tr></thead>
      <tbody>${rows.map((r) => r === null ? `<tr class="gap"><td colspan="${o.data ? 7 : 6}">⋯</td></tr>` : (([e, i]) => `<tr class="${e.id === o.destaque ? "me" : ""}">
        <td>${medal(i)}</td>
        <td class="name">${esc(e.nome)}${e.personagem || e.faseInicial > 0 ? `<small>${[e.personagem ? "com " + esc(e.personagem) : "", e.faseInicial > 0 ? `a partir da fase ${e.faseInicial + 1}` : ""].filter(Boolean).join(" · ")}</small>` : ""}</td>
        <td class="num"><b>${e.pontos.toLocaleString("pt-BR")}</b></td>
        <td class="num">${e.acertos}/${e.perguntas}</td>
        <td class="num">${R.tempoTexto(e.tempo)}</td>
        <td>${res(e.resultado)}</td>${o.data ? `<td class="date">${esc(R.dataTexto(e.data))}</td>` : ""}
      </tr>`)(r)).join("")}</tbody></table></div>`;
  };
  /* janela do ranking (menu principal) */
  UI.renderRanking = function () {
    const R = CT.Ranking, ON = R.online, lista = R.lista(), cfg = CT.CONFIG, br = cfg.bonusRapidez || {};
    const qtd = `<b>${lista.length}</b> ${lista.length === 1 ? "partida registrada" : "partidas registradas"}`;
    let onde = `${qtd} neste computador.`;
    if (ON.ativo) {
      const st = ON.aoVivo ? '<span class="rank-live on">● ao vivo</span>'
        : ON.lista ? '<span class="rank-live off">● sem conexão: mostrando o último ranking recebido</span>'
        : '<span class="rank-live off">● conectando…</span>';
      onde = `${st} ${qtd} por todos os jogadores.`;
    }
    $("ranking-meta").innerHTML = `${onde} Cada resposta certa vale <b>${cfg.pontosPorAcerto}</b> pontos + até <b>${br.maximo || 0}</b> de bônus de rapidez. Empate: mais acertos e, depois, menor tempo.`;
    $("ranking-body").innerHTML = UI.rankingTable(lista, { limite: 100, data: true });
    // o ranking online só pode ser apagado pelo console do Firebase
    $("rank-clear").hidden = ON.ativo;
    $("rank-clear").disabled = !lista.length; $("rank-export").disabled = !lista.length;
  };
  // ranking online: redesenha o que estiver na tela quando chega uma atualização
  CT.Ranking.onchange = function () {
    if (!$("ranking").hidden) UI.renderRanking();
    renderEndRank();
  };
  UI.hideVictory = function () { $("victory").hidden = true; $("victory").className = ""; };

  /* =================================================================
   * EFEITOS 2D: confete e fogos sobre a tela
   * =============================================================== */
  function FX(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.parts = [];
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    resize(); addEventListener("resize", resize);
  }
  FX.prototype.confetti = function (n, x, y) {
    const cols = ["#FFB020", "#18B26B", "#1E6FD9", "#E2574C", "#8E44FF", "#FFFFFF", "#6FE3FF"];
    x = x === undefined ? innerWidth / 2 : x; y = y === undefined ? innerHeight * 0.55 : y;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 7 + Math.random() * 11;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.32, life: 1, decay: 0.006 + Math.random() * 0.006, size: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: cols[i % cols.length], kind: "rect" });
    }
  };
  FX.prototype.firework = function (x, y) {
    const cols = ["#FFB020", "#6FE3FF", "#18B26B", "#FF8A7A", "#B48CFF"];
    const col = cols[Math.floor(Math.random() * cols.length)];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2, sp = 3 + Math.random() * 4;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.06, life: 1, decay: 0.012 + Math.random() * 0.01, size: 3 + Math.random() * 2, col, kind: "dot" });
    }
    CT.Audio.play("pop");
  };
  FX.prototype.clear = function () { this.parts.length = 0; };
  FX.prototype.update = function (dt) {
    const k = Math.min(3, (dt || 1 / 60) * 60); // passo independente da taxa de quadros
    const ctx = this.ctx;
    if (!this.parts.length) { if (this.dirty) { ctx.clearRect(0, 0, this.c.width, this.c.height); this.dirty = false; } return; }
    this.dirty = true;
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < this.c.height + 40);
    this.parts.forEach((p) => {
      const f = Math.pow(0.985, k);
      p.vx *= f; p.vy = p.vy * f + p.g * k; p.x += p.vx * k; p.y += p.vy * k; p.life -= p.decay * k;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.col;
      if (p.kind === "rect") { p.rot += p.vr * k; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  };
})();
