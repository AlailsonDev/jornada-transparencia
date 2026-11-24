/* Gera assets/modelos/js/<arquivo>.glb.js para cada .glb de assets/modelos/originais/
 * (e assets/logos/js/logos.js com os logos dos outdoors).
 * Uso (com Node.js instalado), dentro da pasta do jogo:
 *   node ferramentas/embutir-modelos.js
 * Sem Node.js? Use ferramentas/embutir-modelo.html no navegador. */
const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "..", "assets", "modelos");
const src = path.join(base, "originais"), out = path.join(base, "js");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith(".glb"))) {
  const b64 = fs.readFileSync(path.join(src, f)).toString("base64");
  fs.writeFileSync(path.join(out, f + ".js"), `window.CT_MODELOS_EMBUTIDOS=window.CT_MODELOS_EMBUTIDOS||{};CT_MODELOS_EMBUTIDOS[${JSON.stringify(f)}]="${b64}";\n`);
  console.log("ok", f);
}

/* Logos (assets/logos/*.png) → assets/logos/js/logos.js, para virarem textura dos
 * outdoors da cidade mesmo com o jogo aberto direto do computador (file://). */
const logos = path.join(__dirname, "..", "assets", "logos");
const outL = path.join(logos, "js");
fs.mkdirSync(outL, { recursive: true });
const mapa = {};
for (const f of fs.readdirSync(logos).filter((f) => f.toLowerCase().endsWith(".png"))) {
  mapa["assets/logos/" + f] = "data:image/png;base64," + fs.readFileSync(path.join(logos, f)).toString("base64");
  console.log("ok logo", f);
}
fs.writeFileSync(path.join(outL, "logos.js"), `window.CT_LOGOS_EMBUTIDOS=${JSON.stringify(mapa)};\n`);
