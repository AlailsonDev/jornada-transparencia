/* =====================================================================
 * RANKING — registra cada partida (nome, pontos, acertos, tempo...)
 *
 * Dois modos:
 *  - ONLINE (CT.CONFIG.rankingOnline preenchido): o ranking fica no
 *    Firebase Firestore e é o mesmo em todos os aparelhos, atualizado ao
 *    vivo. Sem internet, a partida fica na fila e é enviada quando a
 *    conexão voltar (mesmo que o jogo seja fechado e aberto de novo).
 *  - LOCAL (sem configuração ou sem o Firebase): os registros ficam no
 *    navegador deste computador (localStorage), como num totem.
 * Nos dois modos, cada partida também é guardada no navegador, como cópia
 * de segurança.
 *
 * Cada partida guarda também "extra": os pontos extras ganhos na Bia Festas
 * (já incluídos em "pontos"), para o ranking mostrar de onde vieram.
 *
 * Ordem do ranking: mais pontos → mais acertos → menor tempo → quem
 * jogou primeiro.
 * ===================================================================== */
(function () {
  const KEY = "jornada-transparencia-ranking-v1";
  const MAX = 5000; // registros guardados (os mais antigos saem primeiro)
  const R = { persistente: true };
  CT.Ranking = R;
  let mem = null;

  /* ---------- modo online ---------- */
  // ativo: Firebase configurado e carregado · lista: último ranking recebido
  // (null até chegar o primeiro) · aoVivo: conectado ao servidor agora ·
  // pendentes: ids enviados e ainda não confirmados pelo servidor
  const ON = { ativo: false, lista: null, aoVivo: false, pendentes: new Set(), erro: "" };
  R.online = ON;
  R.onchange = null; // a interface redesenha o ranking quando algo muda
  const avisar = () => { if (typeof R.onchange === "function") try { R.onchange(); } catch (e) { /* interface */ } };
  let col = null;
  const CAMPOS = ["id", "nome", "pontos", "extra", "acertos", "perguntas", "tempo", "resultado", "faseInicial", "personagem", "data"];

  /** registro vindo de fora (servidor ou navegador): só os campos esperados, nos tipos certos */
  function normal(d, id) {
    if (!d || typeof d.pontos !== "number") return null;
    return {
      id: String(d.id || id || "").slice(0, 40),
      nome: R.limparNome(d.nome) || "Anônimo",
      pontos: Math.max(0, Math.round(d.pontos)),
      extra: Math.max(0, Math.min(Math.round(+d.extra || 0), Math.round(d.pontos))),
      acertos: d.acertos | 0, perguntas: d.perguntas | 0,
      tempo: Math.max(0, Math.round(+d.tempo || 0)),
      resultado: String(d.resultado || "vitoria").slice(0, 20),
      faseInicial: d.faseInicial | 0,
      personagem: String(d.personagem || "").slice(0, 24),
      data: String(d.data || "").slice(0, 40),
    };
  }
  function iniciarOnline() {
    const cfg = (CT.CONFIG && CT.CONFIG.rankingOnline) || {}, fb = cfg.firebase || {};
    if (!fb.apiKey || !fb.projectId) return;
    if (!window.firebase || !firebase.firestore) { console.warn("Ranking online: Firebase não carregou; usando o ranking local."); return; }
    try {
      const app = firebase.initializeApp(fb, "ranking");
      const db = firebase.firestore(app);
      // fila de envio que sobrevive a fechar o jogo sem internet
      db.enablePersistence({ synchronizeTabs: true }).catch(() => { /* navegador sem IndexedDB: a fila fica só na memória */ });
      col = db.collection(cfg.colecao || "ranking");
      ON.ativo = true;
      col.onSnapshot({ includeMetadataChanges: true }, (snap) => {
        ON.lista = snap.docs.map((d) => normal(d.data(), d.id)).filter(Boolean);
        ON.aoVivo = !snap.metadata.fromCache;
        ON.pendentes = new Set(snap.docs.filter((d) => d.metadata.hasPendingWrites).map((d) => d.id));
        if (ON.aoVivo) { ON.erro = ""; reenviarPendentes(); }
        avisar();
      }, (err) => {
        console.warn("Ranking online:", err);
        ON.erro = err && err.code || "erro"; ON.aoVivo = false;
        avisar();
      });
    } catch (e) {
      console.warn("Ranking online indisponível:", e);
      ON.ativo = false; col = null;
    }
  }
  function enviar(e, semExtra) {
    const doc = {};
    CAMPOS.forEach((k) => (doc[k] = e[k]));
    // "extra" só vai quando há pontos extras; e, se as regras publicadas no Firebase ainda
    // forem as antigas (sem esse campo), a partida é reenviada sem ele em vez de se perder
    if (semExtra || !doc.extra) delete doc.extra;
    ON.pendentes.add(e.id); tentados.add(e.id);
    col.doc(e.id).set(doc)
      .then(() => { e.pendente = false; save(); })
      .catch((err) => {
        if (!semExtra && "extra" in doc && err && err.code === "permission-denied") return enviar(e, true);
        console.warn("Ranking online: envio recusado", err); ON.erro = err && err.code || "erro"; avisar();
      });
  }
  /* partidas feitas no modo online que o servidor ainda não tem (ex.: o jogo
   * foi fechado sem internet e sem a fila do navegador) */
  const tentados = new Set(); // uma tentativa por partida a cada abertura do jogo (um envio recusado não entra em laço)
  function reenviarPendentes() {
    const tem = new Set(ON.lista.map((e) => e.id));
    load().forEach((e) => {
      if (!e.pendente) return;
      if (tem.has(e.id)) { if (!ON.pendentes.has(e.id)) { e.pendente = false; save(); } }
      else if (!ON.pendentes.has(e.id) && !tentados.has(e.id)) enviar(e);
    });
  }
  /** a partida ainda não chegou ao servidor? */
  R.pendente = (id) => ON.ativo && ON.pendentes.has(id);

  function load() {
    if (mem) return mem;
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "[]");
      mem = Array.isArray(v) ? v.filter((e) => e && typeof e.pontos === "number") : [];
    } catch (e) { mem = []; R.persistente = false; }
    return mem;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); R.persistente = true; }
    catch (e) { R.persistente = false; }
  }
  const cmp = (a, b) => b.pontos - a.pontos || b.acertos - a.acertos || a.tempo - b.tempo || String(a.data).localeCompare(String(b.data));

  /** limpa o nome digitado: sem espaços sobrando, até 24 caracteres */
  R.limparNome = (s) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);

  /** registra uma partida; devolve a posição dela no ranking */
  R.adicionar = function (dados) {
    load();
    const e = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nome: R.limparNome(dados.nome) || "Anônimo",
      pontos: Math.max(0, Math.round(dados.pontos || 0)),
      extra: Math.max(0, Math.min(Math.round(dados.extra || 0), Math.round(dados.pontos || 0))),
      acertos: dados.acertos | 0,
      perguntas: dados.perguntas | 0,
      tempo: Math.max(0, Math.round(dados.tempo || 0)),
      resultado: dados.resultado || "vitoria", // vitoria | desistiu
      faseInicial: dados.faseInicial | 0,
      personagem: String(dados.personagem || "").slice(0, 24),
      data: new Date().toISOString(),
    };
    if (ON.ativo) e.pendente = true;
    mem.push(e);
    if (mem.length > MAX) mem.splice(0, mem.length - MAX);
    save();
    if (ON.ativo) {
      enviar(e);
      // aparece na hora, mesmo antes de o servidor confirmar
      if (ON.lista && !ON.lista.some((x) => x.id === e.id)) ON.lista.push(normal(e));
    }
    return R.resultado(e.id);
  };
  /** posição de uma partida no ranking atual */
  R.resultado = function (id) {
    const lista = R.lista(), i = lista.findIndex((x) => x.id === id);
    const registro = i >= 0 ? lista[i] : load().find((x) => x.id === id);
    return { registro, posicao: i + 1, total: lista.length, lista };
  };
  /** todos os registros, já ordenados (no modo online: os de todos os aparelhos) */
  R.lista = () => {
    if (!ON.ativo) return load().slice().sort(cmp);
    const l = (ON.lista || []).slice();
    // antes de o ranking chegar do servidor, ao menos as partidas deste aparelho
    if (!ON.lista) load().forEach((e) => { if (e.pendente) l.push(normal(e)); });
    return l.sort(cmp);
  };
  R.total = () => R.lista().length;
  /** apaga o ranking deste navegador (o online só pelo console do Firebase) */
  R.limpar = function () { if (ON.ativo) return; mem = []; save(); };

  R.tempoTexto = function (s) {
    s = Math.max(0, Math.round(s || 0));
    const m = Math.floor(s / 60), r = s % 60;
    return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };
  R.resultadoTexto = (r) => ({ vitoria: "Venceu", "sem-coracoes": "Sem corações", desistiu: "Encerrou" }[r] || r);
  R.dataTexto = function (iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  /** planilha CSV (abre no Excel/LibreOffice) com todas as partidas */
  R.csv = function () {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Posição", "Nome", "Pontos", "Extras da Bia Festas", "Acertos", "Perguntas", "Tempo", "Resultado", "Personagem", "Fase inicial", "Data e hora"]];
    R.lista().forEach((e, i) => {
      const d = new Date(e.data);
      rows.push([i + 1, e.nome, e.pontos, e.extra | 0, e.acertos, e.perguntas, R.tempoTexto(e.tempo), R.resultadoTexto(e.resultado), e.personagem || "", (e.faseInicial | 0) + 1, isNaN(d) ? e.data : d.toLocaleString("pt-BR")]);
    });
    return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  };
  R.baixarCSV = async function () {
    const nome = `ranking-jornada-da-transparencia-${new Date().toISOString().slice(0, 10)}.csv`, csv = R.csv();
    // versão publicada no claude.ai: o download passa pela confirmação do visualizador
    if (window.claude && typeof window.claude.use === "function") {
      const dl = await window.claude.use("downloads");
      if (dl) {
        try { await dl.save({ filename: nome, data: csv }); } catch (e) { /* recusado ou indisponível */ }
        return;
      }
    }
    // jogo aberto direto do computador: download comum do navegador
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  iniciarOnline();
})();
