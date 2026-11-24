/* =====================================================================
 * RANKING — registra cada partida (nome, pontos, acertos, tempo...)
 *
 * Os registros ficam guardados no próprio navegador do computador onde o
 * jogo roda (localStorage). Assim, num totem ou computador do evento,
 * todas as partidas jogadas ali entram no mesmo ranking, mesmo sem
 * internet e mesmo depois de fechar e abrir o jogo de novo.
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
      acertos: dados.acertos | 0,
      perguntas: dados.perguntas | 0,
      tempo: Math.max(0, Math.round(dados.tempo || 0)),
      resultado: dados.resultado || "vitoria", // vitoria | desistiu
      faseInicial: dados.faseInicial | 0,
      personagem: String(dados.personagem || "").slice(0, 24),
      data: new Date().toISOString(),
    };
    mem.push(e);
    if (mem.length > MAX) mem.splice(0, mem.length - MAX);
    save();
    const lista = R.lista();
    return { registro: e, posicao: lista.findIndex((x) => x.id === e.id) + 1, total: lista.length, lista };
  };
  /** todos os registros, já ordenados */
  R.lista = () => load().slice().sort(cmp);
  R.total = () => load().length;
  R.limpar = function () { mem = []; save(); };

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
    const rows = [["Posição", "Nome", "Pontos", "Acertos", "Perguntas", "Tempo", "Resultado", "Personagem", "Fase inicial", "Data e hora"]];
    R.lista().forEach((e, i) => {
      const d = new Date(e.data);
      rows.push([i + 1, e.nome, e.pontos, e.acertos, e.perguntas, R.tempoTexto(e.tempo), R.resultadoTexto(e.resultado), e.personagem || "", (e.faseInicial | 0) + 1, isNaN(d) ? e.data : d.toLocaleString("pt-BR")]);
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
})();
