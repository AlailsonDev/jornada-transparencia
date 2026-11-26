/* =====================================================================
 * MODELOS 3D EXTERNOS (GLB)
 * ---------------------------------------------------------------------
 * Carrega os arquivos listados em CT.MODELOS (data.js), cria personagens
 * com esqueleto (rig) e animações, e oferece objetos urbanos prontos.
 *
 * Como os navegadores bloqueiam a leitura de arquivos .glb quando o jogo
 * é aberto direto do disco (file://), cada .glb também existe embutido em
 * um arquivo .js (assets/modelos/js/<nome>.glb.js). O carregador:
 *   1) usa a versão embutida (.js), se existir;
 *   2) senão, tenta baixar o .glb (funciona em servidor http);
 *   3) se nada der certo, o jogo usa os personagens provisórios
 *      desenhados em código (characters.js). Nada quebra.
 * ===================================================================== */
window.CT = window.CT || {};
window.CT_MODELOS_EMBUTIDOS = window.CT_MODELOS_EMBUTIDOS || {};

(function () {
  const U = CT.U;
  const A = { gltf: {}, clips: {}, info: {}, failed: [] };
  CT.Assets = A;

  /* ---------------- carregamento ---------------- */
  function loadScript(src) {
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = src; s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }
  function b64ToBuffer(b64) {
    const bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  async function getBuffer(file) {
    const M = CT.MODELOS;
    if (!CT_MODELOS_EMBUTIDOS[file]) await loadScript(M.pasta + "js/" + file + ".js");
    if (CT_MODELOS_EMBUTIDOS[file]) { const b = b64ToBuffer(CT_MODELOS_EMBUTIDOS[file]); delete CT_MODELOS_EMBUTIDOS[file]; return b; }
    if (location.protocol.startsWith("http")) {
      const r = await fetch(M.pasta + "originais/" + file);
      if (r.ok) return await r.arrayBuffer();
    }
    throw new Error("arquivo não encontrado: " + file);
  }
  function parse(buffer) {
    return new Promise((res, rej) => new THREE.GLTFLoader().parse(buffer, "", res, rej));
  }

  /** Carrega todos os modelos do manifesto. onProgress(0..1) */
  A.load = async function (onProgress) {
    if (!THREE.GLTFLoader || !CT.MODELOS) return;
    const M = CT.MODELOS;
    const files = new Set();
    Object.values(M.personagens).forEach((p) => files.add(p.arquivo));
    Object.values(M.animacoes).forEach((a) => a && a.arquivo && files.add(a.arquivo));
    Object.values(M.objetos).forEach((o) => (Array.isArray(o) ? o : [o]).forEach((f) => files.add(f)));
    const list = [...files];
    let done = 0;
    for (const f of list) {
      try { A.gltf[f] = await parse(await getBuffer(f)); }
      catch (e) { A.failed.push(f); console.warn("[modelos] não carregou", f, e && e.message); }
      done++; if (onProgress) onProgress(done / list.length);
    }
    prepareClips();
  };
  A.has = (file) => !!A.gltf[file];

  /* ---------------- animações compartilhadas (rig Mixamo) ----------------
   * Os personagens Mixamo têm os mesmos nomes de ossos, mas os eixos de
   * cada osso podem mudar entre um arquivo e outro. Por isso cada animação
   * é "redirecionada" (retarget) para o esqueleto de destino:
   *   rotação no mundo (destino) = Δ da origem em relação à pose T × pose T do destino
   * O resultado é calculado uma vez por modelo e guardado em cache.
   * ----------------------------------------------------------------------- */
  function findClip(file, name) {
    const g = A.gltf[file];
    return g ? g.animations.find((c) => c.name === name) : null;
  }
  function hipsOf(scene) { let h = null; scene.traverse((n) => { if (!h && n.isBone && /Hips$/.test(n.name)) h = n; }); return h; }
  function prepareClips() {
    const an = CT.MODELOS.animacoes;
    ["parado", "andar", "correr", "concordar", "negar", "comemorar"].forEach((k) => {
      const a = an[k]; if (!a) return;
      const c = findClip(a.arquivo, a.clipe);
      if (c) A.clips[k] = { file: a.arquivo, clip: c };
    });
  }
  /* nomes de ossos comparáveis entre esqueletos: "mixamorig:Hips" (Mixamo)
   * e "Hips" (Ready Player Me) são o mesmo osso */
  const normBone = (n) => n.replace(/^mixamorig\d*:?/, "");
  /* pose de descanso (pose T) de um arquivo: rotação no mundo de cada osso */
  const restCache = new Map();
  function restPose(file) {
    if (restCache.has(file)) return restCache.get(file);
    const sc = A.gltf[file].scene; sc.updateMatrixWorld(true);
    const quats = {}, pos = {}, order = [];
    sc.traverse((n) => { if (n.isBone) { const k = normBone(n.name); quats[k] = n.getWorldQuaternion(new THREE.Quaternion()); pos[k] = n.getWorldPosition(new THREE.Vector3()); order.push(n); } });
    const hips = hipsOf(sc);
    const armQ = hips && hips.parent ? hips.parent.quaternion.clone() : new THREE.Quaternion();
    const hipsRest = hips ? hips.position.clone().applyQuaternion(armQ) : new THREE.Vector3(0, 1, 0);
    const r = { quats, pos, order, armQ, hipsRest, hipsName: hips ? hips.name : "" };
    restCache.set(file, r);
    return r;
  }
  const baked = new Map();
  function retargetClip(key, dstFile) {
    const id = key + "|" + dstFile;
    if (baked.has(id)) return baked.get(id);
    const srcInfo = A.clips[key]; if (!srcInfo) return null;
    const srcFile = srcInfo.file, clip = srcInfo.clip;
    const sr = restPose(srcFile), dr = restPose(dstFile);
    // esqueleto de origem animado (clone, com armature original)
    const src = THREE.SkeletonUtils.clone(A.gltf[srcFile].scene);
    const mixer = new THREE.AnimationMixer(src);
    mixer.clipAction(clip).play();
    const srcBones = {}; src.traverse((n) => { if (n.isBone) srcBones[normBone(n.name)] = n; });
    // ordem pai→filho dos ossos de destino
    const dstOrder = dr.order.map((b) => ({ name: b.name, key: normBone(b.name), parent: b.parent && b.parent.isBone ? b.parent.name : null, restLocal: b.quaternion.clone() }));
    const fps = 30, n = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times = new Float32Array(n);
    const qv = {}; dstOrder.forEach((b) => (qv[b.name] = new Float32Array(n * 4)));
    const pv = new Float32Array(n * 3);
    const ratio = dr.hipsRest.y / (sr.hipsRest.y || 1);
    // Poses de descanso diferentes (pose T × pose A): para braços e pernas,
    // calcula a rotação que alinha o osso de destino à direção do osso de
    // origem em repouso, e aplica antes do movimento.
    const CHILD = { Shoulder: "Arm", Arm: "ForeArm", ForeArm: "Hand", Hand: "HandMiddle1", UpLeg: "Leg", Leg: "Foot", Foot: "ToeBase" };
    const align = {};
    dstOrder.forEach((b) => {
      const m = /^(Left|Right)(Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot)$/.exec(b.key); if (!m) return;
      const ck = m[1] + CHILD[m[2]];
      if (!sr.pos[b.key] || !sr.pos[ck] || !dr.pos[b.key] || !dr.pos[ck]) return;
      const ds = sr.pos[ck].clone().sub(sr.pos[b.key]).normalize(), dd = dr.pos[ck].clone().sub(dr.pos[b.key]).normalize();
      if (ds.dot(dd) > 0.9995) return;
      align[b.key] = new THREE.Quaternion().setFromUnitVectors(dd, ds);
    });
    const W = {}, tmp = new THREE.Quaternion(), inv = new THREE.Quaternion(), v = new THREE.Vector3();
    for (let f = 0; f < n; f++) {
      const t = Math.min(clip.duration, f / fps);
      times[f] = t;
      mixer.setTime(t); src.updateMatrixWorld(true);
      for (const b of dstOrder) {
        const sb = srcBones[b.key];
        let world;
        if (sb && sr.quats[b.key] && dr.quats[b.key]) {
          // Δ = Qs(t) · Qs_rest⁻¹ ;  Qd(t) = Δ · Qd_rest
          world = sb.getWorldQuaternion(new THREE.Quaternion()).multiply(inv.copy(sr.quats[b.key]).invert());
          if (align[b.key]) world.multiply(align[b.key]);
          world.multiply(dr.quats[b.key]);
        } else {
          world = (b.parent ? W[b.parent].clone() : dr.armQ.clone()).multiply(b.restLocal);
        }
        W[b.name] = world;
        const local = b.parent ? inv.copy(W[b.parent]).invert().multiply(world) : world.clone(); // armature normalizado (sem rotação)
        local.toArray(qv[b.name], f * 4);
      }
      const sh = srcBones[normBone(sr.hipsName)];
      if (sh) { v.copy(sh.position).applyQuaternion(sr.armQ).multiplyScalar(ratio); v.toArray(pv, f * 3); }
    }
    // animação "no lugar": trava o deslocamento horizontal do quadril
    for (let f = 0; f < n; f++) { pv[f * 3] = pv[0]; pv[f * 3 + 2] = pv[2]; }
    const tracks = dstOrder.map((b) => new THREE.QuaternionKeyframeTrack(b.name + ".quaternion", times, qv[b.name]));
    if (dr.hipsName) tracks.push(new THREE.VectorKeyframeTrack(dr.hipsName + ".position", times, pv));
    const out = new THREE.AnimationClip(key, clip.duration, tracks);
    mixer.stopAllAction(); mixer.uncacheRoot(src);
    baked.set(id, out);
    return out;
  }

  /* ---------------- medidas do modelo ---------------- */
  function measure(file, scene) {
    if (A.info[file]) return A.info[file];
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3(), v = new THREE.Vector3();
    let skinned = 0;
    const mb = new THREE.Box3();
    scene.traverse((n) => {
      if (n.isMesh && !n.isSkinnedMesh) { mb.setFromObject(n); box.union(mb); return; }
      if (!n.isSkinnedMesh) return;
      skinned++;
      n.skeleton.update();
      const pos = n.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 2500));
      for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i); n.boneTransform(i, v); v.applyMatrix4(n.matrixWorld); box.expandByPoint(v); }
    });
    if (box.isEmpty()) box.setFromObject(scene);
    A.info[file] = { height: Math.max(0.001, box.max.y - box.min.y), minY: box.min.y, box };
    return A.info[file];
  }

  /* ---------------- recolorir a textura (roupas) ---------------- */
  const recolorCache = new Map();
  function rgb2hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }
  /** Troca cores na textura da Michelle: calça (amarela), blusa (cinza),
   *  cabelo (escuro) e tom de pele. */
  function recolorTexture(tex, c) {
    const key = tex.uuid + JSON.stringify(c);
    if (recolorCache.has(key)) return recolorCache.get(key);
    const img = tex.image, w = img.width, h = img.height;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h), p = d.data;
    const S = c.camisa ? new THREE.Color(c.camisa) : null, P = c.calca ? new THREE.Color(c.calca) : null;
    const Hc = c.cabelo ? new THREE.Color(c.cabelo) : null, Sk = c.pele ? new THREE.Color(c.pele) : null;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
      const [hh, s, v] = rgb2hsv(r, g, b);
      let T = null, k = 1;
      if (hh > 36 && hh < 66 && s > 0.42 && v > 0.42) { if (P) { T = P; k = v / 0.92; } }       // calça amarela
      else if (s < 0.2 && v > 0.34 && v < 0.84) { if (S) { T = S; k = 0.35 + v * 1.4; } }       // blusa cinza
      else if (s < 0.35 && v < 0.24 && v > 0.04) { if (Hc) { T = Hc; k = 0.35 + v * 2.6; } }   // cabelo escuro
      else if (hh > 12 && hh < 36 && s > 0.3 && v > 0.12 && v < 0.82) { if (Sk) { T = Sk; k = 0.25 + v * 1.85; } } // pele
      if (T) { p[i] = Math.min(255, T.r * k * 255); p[i + 1] = Math.min(255, T.g * k * 255); p[i + 2] = Math.min(255, T.b * k * 255); }
    }
    ctx.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    recolorCache.set(key, t);
    return t;
  }

  /* Tinge partes de uma textura por faixa de cor (CT.MODELOS...tingirTexturas).
   * Cada pixel que casa com uma regra recebe a cor nova, mantendo o
   * sombreado/padrão original (brilho relativo à média da região). */
  function tintTexture(tex, rules, opts) {
    const cols = rules.map((r) => (r.cor ? opts[r.cor] || (r.cor[0] === "#" ? r.cor : null) : null));
    if (!cols.some(Boolean)) return tex;
    const key = tex.uuid + "|" + JSON.stringify(rules) + "|" + cols.join(",");
    if (recolorCache.has(key)) return recolorCache.get(key);
    const img = tex.image, w = img.width, h = img.height;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h), p = d.data;
    const inR = (x, r, wrap) => !r || (wrap && r[0] > r[1] ? x >= r[0] || x <= r[1] : x >= r[0] && x <= r[1]);
    const match = new Int8Array(p.length / 4), sumV = new Float64Array(rules.length), cnt = new Float64Array(rules.length), V = new Float32Array(p.length / 4);
    for (let i = 0, k = 0; i < p.length; i += 4, k++) {
      const [hh, ss, vv] = rgb2hsv(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255);
      V[k] = vv; match[k] = -1;
      for (let r = 0; r < rules.length; r++) {
        const R = rules[r];
        if (inR(hh, R.h, true) && inR(ss, R.s) && inR(vv, R.v)) { match[k] = r; sumV[r] += vv; cnt[r]++; break; }
      }
    }
    const tgt = cols.map((c) => (c ? new THREE.Color(c) : null));
    for (let i = 0, k = 0; i < p.length; i += 4, k++) {
      const r = match[k]; if (r < 0 || !tgt[r]) continue;
      const f = V[k] / Math.max(0.02, sumV[r] / cnt[r]); // brilho relativo à média da região
      p[i] = Math.min(255, tgt[r].r * f * 255); p[i + 1] = Math.min(255, tgt[r].g * f * 255); p[i + 2] = Math.min(255, tgt[r].b * f * 255);
    }
    ctx.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    recolorCache.set(key, t);
    return t;
  }

  /* ---------------- acessórios presos aos ossos ----------------
   * Os acessórios são desenhados em metros, com +Y para cima e +Z para a
   * frente do personagem. mount() os prende ao osso já alinhados ao corpo,
   * independentemente dos eixos internos de cada esqueleto. */
  function mount(bone, obj, worldPos, root) {
    bone.updateMatrixWorld(true);
    const ws = new THREE.Vector3(); bone.getWorldScale(ws);
    const rq = root.getWorldQuaternion(new THREE.Quaternion());
    obj.scale.divideScalar(ws.x);
    obj.position.copy(bone.worldToLocal(worldPos.clone()));
    obj.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rq));
    bone.add(obj);
  }
  function headwear(kind, o) {
    const g = new THREE.Group();
    const M = (c, x) => U.mat(c, x);
    if (kind === "oculos") {
      const ring = U.geo("glass2", () => new THREE.TorusGeometry(0.036, 0.006, 6, 16));
      [-1, 1].forEach((s) => U.mesh(ring, M("#1B1B22"), s * 0.038, 0, 0, g, false));
      U.mesh(U.box(0.03, 0.006, 0.006), M("#1B1B22"), 0, 0.004, 0, g, false);
      [-1, 1].forEach((s) => U.mesh(U.box(0.006, 0.006, 0.1), M("#1B1B22"), s * 0.074, 0, -0.05, g, false));
    } else if (kind === "capacete") {
      U.mesh(U.geo("helm2", () => new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M("#FFD21F", { roughness: 0.4 }), 0, 0, 0, g);
      U.mesh(U.cyl(0.16, 0.16, 0.015, 18), M("#FFD21F", { roughness: 0.4 }), 0, 0.005, 0.02, g);
    } else if (kind === "headset") {
      U.mesh(U.geo("hs2", () => new THREE.TorusGeometry(0.115, 0.011, 6, 20, Math.PI)), M("#22252E"), 0, 0, 0, g);
      [-1, 1].forEach((s) => { const e = U.mesh(U.cyl(0.035, 0.035, 0.03, 12), M("#22252E"), s * 0.11, -0.02, 0, g); e.rotation.z = Math.PI / 2; });
      const mic = U.mesh(U.box(0.012, 0.012, 0.11), M("#22252E"), -0.1, -0.08, 0.06, g); mic.rotation.y = 0.5;
    } else if (kind === "bone") {
      U.mesh(U.geo("cap2", () => new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M(o.cor || "#16305C"), 0, 0, 0, g);
      U.mesh(U.box(0.16, 0.012, 0.11), M(o.cor || "#16305C"), 0, 0.006, 0.11, g);
    } else if (kind === "chapeu") {
      U.mesh(U.cyl(0.19, 0.19, 0.012, 22), M(o.cor || "#C9A46A"), 0, 0, 0, g);
      U.mesh(U.cyl(0.1, 0.115, 0.1, 22), M(o.cor || "#C9A46A"), 0, 0.05, 0, g);
      U.mesh(U.cyl(0.117, 0.117, 0.025, 22), M("#5A3B22"), 0, 0.02, 0, g);
    } else if (kind === "bigode") {
      [-1, 1].forEach((s) => { const m = U.mesh(U.box(0.05, 0.016, 0.02), M(o.cabelo || "#DADADA"), s * 0.026, 0, 0, g, false); m.rotation.z = s * -0.25; });
    } else if (kind === "cartola") {
      U.mesh(U.cyl(0.24, 0.24, 0.02, 24), M("#15121F"), 0, 0, 0, g);
      U.mesh(U.cyl(0.13, 0.14, 0.26, 24), M("#15121F"), 0, 0.14, 0, g);
      U.mesh(U.cyl(0.142, 0.142, 0.045, 24), M("#8E44FF", { emissive: "#5B1FB8", emissiveIntensity: 0.6 }), 0, 0.04, 0, g);
    }
    return g;
  }
  function chestwear(kind, o) {
    const g = new THREE.Group();
    if (kind === "gravata") {
      U.mesh(U.box(0.05, 0.2, 0.012), U.mat(o.corGravata || "#C0392B"), 0, -0.1, 0, g, false);
      U.mesh(U.box(0.06, 0.04, 0.016), U.mat(o.corGravata || "#C0392B"), 0, 0.01, 0, g, false);
    } else if (kind === "cracha") {
      U.mesh(U.box(0.075, 0.1, 0.008), U.mat("#FFFFFF"), 0, 0, 0, g, false);
      U.mesh(U.box(0.075, 0.028, 0.01), U.mat("#1E6FD9"), 0, 0.036, 0, g, false);
    }
    return g;
  }

  /* =================================================================
   * PERSONAGEM COM ESQUELETO
   * opts: { modelo, camisa, calca, cabelo, pele, sapato, acessorio,
   *         chapeu, peito, mochila, carimbo, altura, corpo }
   * Retorna o mesmo formato dos personagens de characters.js:
   *   { root, inner, speed, mode, update(dt) }
   * Modos: idle, talk, wave, celebrate, wrong, taunt, defeat
   * =============================================================== */
  /* Gestos do chefe (Corrupson), feitos por código sobre os clipes do esqueleto:
   *  rage      → furioso: pula (clipe Jump) sacudindo os braços acima da cabeça; a cada
   *              três pulos, dá uma pausa batendo os punhos no ar
   *  celebrate → comemora o erro do jogador: pula com os braços para cima, socando o ar,
   *              e depois volta à raiva
   *  hurt      → sente o golpe: tranco para trás, braços jogados para o alto e cabeça
   *              tombada; em seguida balança a cabeça dizendo "não" e volta à raiva */
  function bossGestures(ch, bone, root, model, aim, rotateWorld) {
    const arm = [bone(/UpperArm\.?R$/), bone(/UpperArm\.?L$/)], fore = [bone(/LowerArm\.?R$/), bone(/LowerArm\.?L$/)];
    const palm = [bone(/Palm2\.?R$/), bone(/Palm2\.?L$/)];
    const torso = bone(/Torso$/), abdomen = bone(/Abdomen$/), head = bone(/(^|[^p])Head$/);
    const rq = new THREE.Quaternion(), RIGHT = new THREE.Vector3(), FWD = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
    let wRage = 0, wCel = 0, wHurt = 0, t = 0, last = "";
    // Os clipes do esqueleto não animam todos esses ossos (o tronco, por exemplo, nunca é
    // animado). Sem restaurar a pose de repouso a cada quadro, as rotações dos gestos se
    // acumulariam e o boneco ficaria torto. A pose é guardada antes de qualquer gesto.
    const touched = [...arm, ...fore, ...palm, torso, abdomen, head].filter(Boolean);
    const rest = touched.map((b) => b.quaternion.clone());
    const L = (x, y, z, out) => out.set(x, y, z).normalize().applyQuaternion(rq);
    const g = {
      // clipe base de cada modo (null = usa o mapa padrão)
      clip() {
        if (ch.mode === "rage") return (t % 3.4) < 2.13 ? "pular" : "parado"; // 3 pulos (0,71 s cada) e uma pausa
        if (ch.mode === "celebrate") return "pular";
        if (ch.mode === "hurt") return "parado";
        return null;
      },
      // chamado ANTES do mixer: volta os ossos à pose de repouso (o mixer depois sobrescreve
      // os que o clipe anima; os outros ficam retos, sem acumular o gesto do quadro anterior)
      reset() { touched.forEach((b, i) => b.quaternion.copy(rest[i])); },
      update(dt, still) {
        if (ch.mode !== last) { last = ch.mode; t = 0; }
        t += dt;
        if (ch.mode === "celebrate" && t > 3.0) ch.mode = "rage";
        if (ch.mode === "hurt" && t > 1.5) ch.mode = "wrong"; // depois do tranco, o "não" com a cabeça
        wRage = U.damp(wRage, ch.mode === "rage" && still ? 1 : 0, 7, dt);
        wCel = U.damp(wCel, ch.mode === "celebrate" && still ? 1 : 0, 9, dt);
        const hk = ch.mode === "hurt" ? (t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 1.3)) : 0;
        wHurt = ch.mode === "hurt" ? hk : U.damp(wHurt, 0, 10, dt);
        if (wRage + wCel + wHurt < 0.01 || !arm[0] || !fore[0]) return;
        model.updateMatrixWorld(true);
        root.getWorldQuaternion(rq);
        RIGHT.set(1, 0, 0).applyQuaternion(rq); FWD.set(0, 0, 1).applyQuaternion(rq);
        // lado: 0 = direito (x local negativo), 1 = esquerdo
        [0, 1].forEach((i) => {
          const sd = i === 0 ? -1 : 1, ph = i === 0 ? 0 : Math.PI;
          if (wRage > 0.01) {
            // braços sacudindo acima da cabeça, alternados, com os antebraços chicoteando
            const s = Math.sin(ch.t * 11 + ph), c = Math.cos(ch.t * 11 + ph);
            aim(arm[i], fore[i], L(sd * (0.6 + 0.2 * c), 0.75 + 0.3 * s, 0.35 + 0.25 * c, d1), wRage);
            aim(fore[i], palm[i], L(sd * (0.15 + 0.35 * s), 1, 0.5 + 0.55 * Math.sin(ch.t * 11 + ph + 1.2), d2), wRage);
          }
          if (wCel > 0.01) {
            // "É isso aí!": braços para o alto socando o ar
            const pump = Math.max(0, Math.sin(ch.t * 9));
            aim(arm[i], fore[i], L(sd * 0.32, 1, 0.12, d1), wCel);
            aim(fore[i], palm[i], L(sd * 0.12, 1 - 0.55 * pump, 0.2 + 0.85 * pump, d2), wCel);
          }
          if (wHurt > 0.01) {
            // tranco: braços jogados para cima e para trás, tremendo
            const j = Math.sin(ch.t * 47 + ph) * 0.12;
            aim(arm[i], fore[i], L(sd * 0.85, 0.55 + j, -0.35, d1), wHurt);
            aim(fore[i], palm[i], L(sd * 0.45, 0.95, -0.25 + j, d2), wHurt);
          }
        });
        if (wHurt > 0.01) {
          // corpo vai para trás e a cabeça tomba de lado
          rotateWorld(abdomen, RIGHT, -0.22 * wHurt);
          rotateWorld(torso, RIGHT, -0.3 * wHurt);
          rotateWorld(head, RIGHT, -0.28 * wHurt);
          rotateWorld(head, FWD, 0.25 * wHurt * Math.sin(ch.t * 6));
        }
        if (wRage > 0.01) {
          // tronco chacoalhando de raiva e cabeça para a frente, encarando
          rotateWorld(torso, UP, Math.sin(ch.t * 11) * 0.12 * wRage);
          rotateWorld(head, RIGHT, 0.14 * wRage);
        }
        if (wCel > 0.01) {
          // rebolado de deboche e cabeça para trás, gargalhando
          rotateWorld(abdomen, FWD, Math.sin(ch.t * 6) * 0.12 * wCel);
          rotateWorld(torso, UP, Math.sin(ch.t * 6 + 0.8) * 0.12 * wCel);
          rotateWorld(head, RIGHT, (-0.22 + Math.sin(ch.t * 14) * 0.07) * wCel);
        }
      },
    };
    return g;
  }

  CT.createRigged = function (opts) {
    const def = CT.MODELOS.personagens[opts.modelo];
    if (!def || !A.has(def.arquivo)) return null;
    const src = A.gltf[def.arquivo];
    const model = THREE.SkeletonUtils.clone(src.scene);
    if (!def.animacoes) { const h = hipsOf(model); if (h && h.parent) h.parent.quaternion.identity(); }
    if (!A.info[def.arquivo]) {
      // mede já na pose "parado" para obter a altura real
      const tmp = new THREE.AnimationMixer(model);
      const c = def.animacoes ? src.animations.find((x) => x.name === def.animacoes.parado) : retargetClip("parado", def.arquivo);
      if (c) { tmp.clipAction(c).play(); tmp.update(0.01); }
      measure(def.arquivo, model);
      tmp.stopAllAction(); tmp.uncacheRoot(model);
    }
    const info = A.info[def.arquivo];
    const root = new THREE.Group(), inner = new THREE.Group();
    root.add(inner); inner.add(model);
    const H = opts.altura || def.altura;
    const scale = H / info.height;
    model.scale.multiplyScalar(scale);
    if (opts.corpo) { model.scale.x *= opts.corpo; model.scale.z *= opts.corpo; } // mais magro / mais largo
    model.position.y = -info.minY * scale;

    // materiais próprios (para recolorir/tingir sem afetar os outros)
    const tintMap = def.tingirMateriais || null;
    model.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true; n.receiveShadow = false; n.frustumCulled = false;
      const m = n.material.clone(); n.material = m;
      if (def.recolorir && m.map && (opts.camisa || opts.calca || opts.cabelo || opts.pele))
        m.map = recolorTexture(m.map, { camisa: opts.camisa, calca: opts.calca, cabelo: opts.cabelo, pele: opts.pele });
      if (tintMap && tintMap[m.name] && opts[tintMap[m.name]]) { m.color.set(opts[tintMap[m.name]]); m.roughness = Math.max(m.roughness, 0.7); }
      if (def.tingirTexturas && def.tingirTexturas[m.name] && m.map) m.map = tintTexture(m.map, def.tingirTexturas[m.name], opts);
      if (def.cores && def.cores[m.name]) m.color.set(def.cores[m.name]);
      if (m.map) m.map.anisotropy = 4;
    });
    root.updateMatrixWorld(true);

    const ch_extras = {};
    const bone = (re) => { let b = null; model.traverse((n) => { if (!b && n.isBone && re.test(n.name)) b = n; }); return b; };
    const head = bone(/(^|[^p])Head(_\d+)?$/), spine = bone(/Spine2$|Torso$/), handR = bone(/RightHand$|Palm2?R$|HandR$/);
    const armR = bone(/RightArm$|UpperArmR$/), foreR = bone(/RightForeArm$|LowerArmR$/);
    // dedos da mão direita (aceno de mão aberta): guarda a pose de repouso, com os dedos esticados
    const fingersR = []; model.traverse((n) => { if (n.isBone && /RightHand(Thumb|Index|Middle|Ring|Pinky)\d/.test(n.name)) fingersR.push({ b: n, q: n.quaternion.clone() }); });
    const idxR = bone(/RightHandIndex1$/), midR = bone(/RightHandMiddle1$/), pinR = bone(/RightHandPinky1$/);
    const feet = [bone(/LeftFoot$|FootL$/), bone(/RightFoot$|FootR$/)].filter(Boolean);
    // ossos usados na pose de pulo (procedural: os modelos não têm clipe de pulo)
    const legsUp = [bone(/LeftUpLeg$|UpperLegL$|ThighL$/), bone(/RightUpLeg$|UpperLegR$|ThighR$/)];
    const legsLow = [bone(/LeftLeg$|LowerLegL$|ShinL$/), bone(/RightLeg$|LowerLegR$|ShinR$/)];
    const armL = bone(/LeftArm$|UpperArmL$/);
    const foreL = bone(/LeftForeArm$|LowerArmL$/), handL = bone(/LeftHand$|Palm2?L$|^HandL$/); // (no Quaternius, "MiddleHandL" é um dedo, não a mão)
    const midL = bone(/LeftHandMiddle1$/);

    // animações
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    const own = def.animacoes; // animações do próprio arquivo (chefe, homem, aventureiro)
    const add = (key, clip) => { if (clip) actions[key] = mixer.clipAction(clip); };
    if (own) Object.entries(own).forEach(([k, name]) => add(k, src.animations.find((c) => c.name === name)));
    else Object.keys(A.clips).forEach((k) => add(k, retargetClip(k, def.arquivo)));
    ["negar", "derrota", "acenar"].forEach((k) => { if (actions[k]) { actions[k].setLoop(THREE.LoopOnce, 1); actions[k].clampWhenFinished = true; } });

    const ch = { root, inner, model, mixer, actions, head, feet, speed: 0, mode: "idle", rigged: true, t: Math.random() * 10, extras: ch_extras };
    const boss = def.gestosChefe ? bossGestures(ch, bone, root, model, aimFn, rotFn) : null;
    if (boss) ch.restMode = "rage";
    let current = null, lastMode = "";
    // modelos que já trazem um clipe de palmas (o Worker do Quaternius: "Man_Clapping") usam o
    // clipe; nos outros as palmas são feitas por código. Misturar os dois entortava os braços.
    const clapNativo = !!(own && own.comemorar && /clap/i.test(own.comemorar) && actions.comemorar);
    // Pose de repouso dos ossos mexidos por código. Antes de cada quadro eles voltam a ela
    // (os clipes sobrescrevem depois, se animarem o osso). Sem isso, nos modelos cujo clipe
    // "parado" não anima a cabeça (o Worker do Quaternius, por exemplo), o "não" com a cabeça
    // e os outros gestos se somavam a cada quadro e a cabeça girava para posições impossíveis.
    const restBones = [head, spine, armL, armR, foreL, foreR, handL, handR, ...legsUp, ...legsLow].filter(Boolean)
      .filter((b, i, a) => a.indexOf(b) === i).map((b) => ({ b, q: b.quaternion.clone() }));
    // normal da palma da mão direita, no espaço do osso, para os modelos sem ossos de dedos:
    // na pose de repouso (braços caídos) a palma fica virada para o corpo
    let palmLocalR = null;
    const childR = handR && handR.children.find((c) => c.isBone);
    if (handR && !(idxR && midR && pinR)) {
      root.updateMatrixWorld(true);
      const hp = handR.getWorldPosition(new THREE.Vector3()), rp = root.getWorldPosition(new THREE.Vector3());
      const toBody = new THREE.Vector3(rp.x - hp.x, 0, rp.z - hp.z);
      if (toBody.lengthSq() > 1e-8) palmLocalR = toBody.normalize().applyQuaternion(handR.getWorldQuaternion(new THREE.Quaternion()).invert());
    }
    mixer.addEventListener("finished", (e) => {
      if (e.action === actions.negar && ch.mode === "wrong") ch.mode = ch.restMode || "talk";
      if (e.action === actions.acenar && ch.mode === "wave") ch.mode = "idle";
    });
    function play(key, fade) {
      const a = actions[key] || actions.parado;
      if (!a || a === current) return;
      a.reset().setEffectiveWeight(1).fadeIn(fade == null ? 0.25 : fade).play();
      if (current) current.fadeOut(fade == null ? 0.25 : fade);
      current = a;
    }
    const MODE = { idle: "parado", talk: "falar", wave: "acenar", celebrate: "comemorar", wrong: "negar", taunt: "provocar", defeat: "derrota" };
    // gestos procedurais (quando o modelo não traz o clipe)
    const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), vt = new THREE.Vector3(), qp = new THREE.Quaternion();
    function aim(b, child, dirWorld, w) {
      if (!b || !child) return;
      b.getWorldPosition(va); child.getWorldPosition(vb);
      const cur = vb.sub(va).normalize();
      qa.setFromUnitVectors(cur, dirWorld);
      const target = qa.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      b.parent.getWorldQuaternion(qp).invert();
      b.quaternion.slerp(qp.multiply(target), w);
      b.updateMatrixWorld(true);
    }
    function rotateWorld(b, axis, angle) {
      if (!b || Math.abs(angle) < 1e-4) return;
      const wq = b.getWorldQuaternion(new THREE.Quaternion());
      qa.setFromAxisAngle(axis, angle).multiply(wq);
      b.parent.getWorldQuaternion(qp).invert();
      b.quaternion.copy(qp.multiply(qa));
      b.updateMatrixWorld(true);
    }
    function aimFn(b, c, d, w) { aim(b, c, d, w); }
    function rotFn(b, a, g) { rotateWorld(b, a, g); }
    let waveW = 0, wrongT = 0, airW = 0, landW = 0, salW = 0, cruzW = 0;
    const FWD = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3();

    ch.update = function (dt) {
      ch.t += dt;
      let key;
      const s = ch.speed;
      if (s > 0.62 && actions.correr && !ch.backward) key = "correr";
      else if (s > 0.08) key = "andar";
      else {
        key = (boss && boss.clip()) || MODE[ch.mode] || "parado";
        if (ch.mode === "clap") key = clapNativo ? "comemorar" : "parado";   // palmas: clipe próprio do modelo, se houver
        if (key === "falar") key = actions.falar ? "falar" : (Math.sin(ch.t * 0.9) > 0.35 && actions.concordar ? "concordar" : "parado");
        if (!actions[key]) key = "parado";
      }
      if (ch.mode !== lastMode) { lastMode = ch.mode; wrongT = 0; if (key === "negar" || key === "derrota" || key === "acenar") current = null; }
      play(key);
      if (current) {
        if (ch.air) current.timeScale = 0.25; // no ar, as pernas quase param
        else if (key === "andar") current.timeScale = U.clamp(s * 1.6, 0.6, 1.3) * (ch.backward ? -1 : 1);
        else if (key === "correr") current.timeScale = U.clamp(s * 0.95, 0.85, 1.45);
        else current.timeScale = 1;
      }
      restBones.forEach((r) => r.b.quaternion.copy(r.q));
      if (boss) boss.reset();
      mixer.update(dt);
      const still = s < 0.08;
      // pulo: joelhos dobrados e braços abertos no ar; leve agachada ao pousar
      airW = U.damp(airW, ch.air ? 1 : 0, ch.air ? 14 : 10, dt);
      if (ch.landed) { landW = 1; ch.landed = false; }
      landW = Math.max(0, landW - dt / 0.22);
      const tuck = airW * (ch.vy > 0 ? 0.75 : 1), crouch = Math.sin(landW * Math.PI) * 0.55;
      if ((tuck > 0.01 || crouch > 0.01) && legsUp[0] && legsLow[0]) {
        model.updateMatrixWorld(true);
        const rq2 = root.getWorldQuaternion(new THREE.Quaternion());
        RIGHT.set(1, 0, 0).applyQuaternion(rq2); FWD.set(0, 0, 1).applyQuaternion(rq2);
        [0, 1].forEach((i) => {
          const w = tuck * (i === 0 ? 1 : 0.8) + crouch; // pernas levemente desencontradas no ar
          rotateWorld(legsUp[i], RIGHT, -0.85 * w);
          rotateWorld(legsLow[i], RIGHT, 1.55 * w);
        });
        if (armL && armR && tuck > 0.01) { rotateWorld(armL, FWD, 0.75 * tuck); rotateWorld(armR, FWD, -0.75 * tuck); }
      }
      if (boss) boss.update(dt, still);
      // sentado (mesa do Prefeito): quadril baixa até o assento, coxas para a frente,
      // canelas na vertical e antebraços apoiados no tampo da mesa
      if (ch.sentado && ch.sit && legsUp[0] && legsLow[0] && feet.length === 2) {
        inner.position.y = -ch.sit.queda;
        model.updateMatrixWorld(true);
        const rq = root.getWorldQuaternion(new THREE.Quaternion());
        const F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), L = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
        [0, 1].forEach((i) => {
          const sx = i === 0 ? 1 : -1; // 0 = perna esquerda (lado +X do personagem)
          aim(legsUp[i], legsLow[i], F.clone().addScaledVector(L, sx * 0.1).addScaledVector(UP, -0.04).normalize(), 1);
          aim(legsLow[i], feet[i], UP.clone().negate().addScaledVector(F, 0.1).addScaledVector(L, sx * 0.03).normalize(), 1);
        });
        // braços: cotovelos para baixo e um pouco à frente, antebraços sobre a mesa
        [[armL, foreL, handL, midL, 1], [armR, foreR, handR, midR, -1]].forEach(([a, f, h, m, sx]) => {
          if (!a || !f || !h) return;
          aim(a, f, new THREE.Vector3(0, 0, 0).addScaledVector(L, sx * 0.16).addScaledVector(UP, -0.82).addScaledVector(F, 0.5).normalize(), 1);
          const fd = new THREE.Vector3(0, 0, 0).addScaledVector(L, -sx * 0.3).addScaledVector(UP, 0.02).addScaledVector(F, 1).normalize();
          aim(f, h, fd, 1);
          if (m) aim(h, m, fd.clone().addScaledVector(UP, -0.15).normalize(), 1);
        });
      } else if (ch.sit) inner.position.y = 0;
      // batendo palmas (plateia da Bia Festas): braços à frente, as mãos se
      // encontram no ritmo (ch.palmaBatida = segundos por palma) e o corpo balança
      if (ch.mode === "clap" && clapNativo) {
        ch._clapT = (ch._clapT || 0) + dt;
        inner.position.y = 0;
      } else if (ch.mode === "clap" && armL && armR && foreL && foreR && handL && handR) {
        ch._clapT = (ch._clapT || 0) + dt;
        const per = ch.palmaBatida || 0.5, k = (ch._clapT / per + (ch.palmaFase || 0)) % 1;
        const ab = Math.pow(Math.sin(Math.PI * k), 0.7);                  // 0 = palma, 1 = mãos abertas
        inner.position.y = Math.abs(Math.sin(Math.PI * (ch._clapT / per + (ch.palmaFase || 0)))) * 0.035;
        model.updateMatrixWorld(true);
        const rq = root.getWorldQuaternion(new THREE.Quaternion());
        const F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), L = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
        const alto = ch.palmaAlta ? 0.45 : 0;                                // alguns batem palmas com as mãos mais altas
        [[armL, foreL, handL, midL, 1], [armR, foreR, handR, midR, -1]].forEach(([a_, f_, h_, m_, sx]) => {
          aim(a_, f_, new THREE.Vector3().addScaledVector(F, 0.62).addScaledVector(UP, -0.55 + alto).addScaledVector(L, sx * 0.32).normalize(), 1);
          const fd = new THREE.Vector3().addScaledVector(F, 0.62).addScaledVector(UP, 0.42 + alto * 0.6).addScaledVector(L, -sx * (0.62 - 0.5 * ab)).normalize();
          aim(f_, h_, fd, 1);
          if (m_) aim(h_, m_, fd.clone().addScaledVector(UP, 0.25).normalize(), 1);
        });
        // balanço do corpo no grupo interno (absoluto): girar o osso da coluna somava a
        // rotação a cada quadro nos modelos cuja animação parada não mexe nesse osso
        inner.rotation.z = Math.sin(Math.PI * 2 * (ch._clapT / (per * 4))) * 0.05;
      } else if (ch._clapT) { inner.rotation.z = 0; ch._clapT = 0; }
      // braços cruzados (ch.bracosCruzados, ex.: a Bia na festa): braços junto ao corpo e
      // antebraços cruzados na frente da barriga, o esquerdo por cima; vale parado e conversando
      cruzW = U.damp(cruzW, ch.bracosCruzados && still && (ch.mode === "idle" || ch.mode === "talk") ? 1 : 0, 7, dt);
      if (cruzW > 0.01 && armL && armR && foreL && foreR) {
        model.updateMatrixWorld(true);
        const rq = root.getWorldQuaternion(new THREE.Quaternion());
        const F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), L = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
        [[armL, foreL, handL, midL, 1], [armR, foreR, handR, midR, -1]].forEach(([a_, f_, h_, m_, sx]) => {
          const cima = sx > 0 ? 1 : 0;
          aim(a_, f_, new THREE.Vector3().addScaledVector(F, 0.34).addScaledVector(UP, -0.9).addScaledVector(L, sx * 0.2).normalize(), cruzW);
          const fd = new THREE.Vector3().addScaledVector(L, -sx * 0.86).addScaledVector(F, 0.36 + 0.1 * cima).addScaledVector(UP, 0.3 + 0.1 * cima).normalize();
          aim(f_, h_, fd, cruzW);
          if (m_) aim(h_, m_, new THREE.Vector3().addScaledVector(L, -sx * 0.55).addScaledVector(F, -0.6).addScaledVector(UP, cima ? -0.1 : 0.15).normalize(), cruzW);
        });
      }
      // dançando como o dinossauro da Bia Festas: pulinhos no ritmo, corpo balançando,
      // passinhos com uma perna de cada vez, bracinhos de tiranossauro sacudindo e, a cada
      // 16 batidas, uma voltinha completa. ch.dancaTempo() dá o relógio da festa (assim todos
      // dançam juntos) e ch.dancaBatida, os segundos por batida.
      if (ch.mode === "dance" && still && armL && armR && foreL && foreR) {
        ch._dancando = true;
        const tt = ch.dancaTempo ? ch.dancaTempo() : (ch._dT = (ch._dT || 0) + dt);
        const bt = tt / (ch.dancaBatida || 0.5), ph = bt * Math.PI;
        const ciclo = bt % 16, giro = ciclo > 14 ? U.easeInOut((ciclo - 14) / 2) * Math.PI * 2 : 0;
        inner.position.y = Math.abs(Math.sin(ph)) * 0.07;
        inner.rotation.set(0.03 * Math.sin(ph * 2), Math.sin(ph / 4) * 0.45 + giro, Math.sin(ph) * 0.1);
        model.updateMatrixWorld(true);
        const rq = inner.getWorldQuaternion(new THREE.Quaternion());
        const F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), L = new THREE.Vector3(1, 0, 0).applyQuaternion(rq), Uw = new THREE.Vector3(0, 1, 0).applyQuaternion(rq);
        if (legsUp[0] && legsLow[0]) [0, 1].forEach((i) => {
          const lift = Math.max(0, Math.sin(ph + (i === 0 ? 0 : Math.PI)));
          rotateWorld(legsUp[i], L, -0.55 * lift);
          rotateWorld(legsLow[i], L, 0.9 * lift);
        });
        [[armL, foreL, handL, midL, 1], [armR, foreR, handR, midR, -1]].forEach(([a_, f_, h_, m_, sx]) => {
          const lado = sx > 0 ? 0 : Math.PI;
          const a1 = 0.5 + 0.55 * Math.sin(ph * 4 + lado);                       // braço (a partir de "caído")
          const a2 = a1 + 0.6 + 0.4 * Math.sin(ph * 4 + 1 + lado);                // antebraço, mais para cima
          aim(a_, f_, new THREE.Vector3().addScaledVector(Uw, -Math.cos(a1)).addScaledVector(F, Math.sin(a1)).addScaledVector(L, sx * 0.22).normalize(), 1);
          const fd = new THREE.Vector3().addScaledVector(Uw, -Math.cos(a2)).addScaledVector(F, Math.sin(a2)).addScaledVector(L, -sx * 0.12).normalize();
          aim(f_, h_, fd, 1);
          if (h_ && m_) aim(h_, m_, fd.clone().addScaledVector(Uw, -0.5).normalize(), 1);   // mãozinhas "de garra"
        });
      } else if (ch._dancando) { inner.rotation.set(0, 0, 0); inner.position.y = 0; ch._dancando = false; }
      // olhar para um ponto (ch.olharPara = {x, z}): vira a cabeça (e um pouco o tronco)
      if (ch.olharPara && head) {
        model.updateMatrixWorld(true);
        const hp = head.getWorldPosition(new THREE.Vector3());
        const d = new THREE.Vector3(ch.olharPara.x - hp.x, 0, ch.olharPara.z - hp.z);
        const rqi = root.getWorldQuaternion(new THREE.Quaternion()).invert();
        d.applyQuaternion(rqi);
        const yaw = d.lengthSq() > 1e-4 ? U.clamp(Math.atan2(d.x, d.z), -1.0, 1.0) : 0;
        ch._olharYaw = U.damp(ch._olharYaw || 0, yaw, 5, dt);
        if (spine) rotateWorld(spine, UP, ch._olharYaw * 0.3);
        rotateWorld(head, UP, ch._olharYaw * 0.7);
      }
      // aceno procedural
      if (ch.mode === "wave" && !actions.acenar) { ch._waveT = (ch._waveT || 0) + dt; if (ch._waveT > 2.8) { ch.mode = "idle"; ch._waveT = 0; } }
      else ch._waveT = 0;
      waveW = U.damp(waveW, ch.mode === "wave" && !actions.acenar && still ? 1 : 0, 8, dt);
      if (waveW > 0.01 && armR && foreR && handR) {
        // aceno como na vida real: braço aberto para o lado na altura do ombro, antebraço
        // em pé balançando de um lado para o outro, mão aberta com a palma para a frente
        model.updateMatrixWorld(true);
        const rq = root.getWorldQuaternion(new THREE.Quaternion());
        const sway = Math.sin(ch.t * 7.5);
        aim(armR, foreR, vt.set(-0.9, 0.32, 0.18).normalize().applyQuaternion(rq), waveW);
        const fdir = vb.set(-0.18 + sway * 0.42, 1, 0.12).normalize().applyQuaternion(rq).clone();
        aim(foreR, handR, fdir, waveW);
        fingersR.forEach((f) => f.b.quaternion.slerp(f.q, waveW));     // dedos esticados
        if (midR) aim(handR, midR, fdir, waveW);                       // punho reto
        else if (childR) aim(handR, childR, fdir, waveW);
        if (palmLocalR) {
          // modelos sem dedos: gira a mão em torno do próprio eixo até a palma ficar para a frente
          handR.updateMatrixWorld(true);
          const along = fdir.clone();
          const palm = palmLocalR.clone().applyQuaternion(handR.getWorldQuaternion(new THREE.Quaternion()));
          const want = new THREE.Vector3(0, 0, 1).applyQuaternion(rq);
          palm.addScaledVector(along, -palm.dot(along)).normalize();
          want.addScaledVector(along, -want.dot(along)).normalize();
          if (palm.lengthSq() > 0.5 && want.lengthSq() > 0.5) {
            let ang = Math.acos(THREE.MathUtils.clamp(palm.dot(want), -1, 1));
            if (new THREE.Vector3().crossVectors(palm, want).dot(along) < 0) ang = -ang;
            rotateWorld(handR, along, ang * waveW);
          }
        } else if (idxR && midR && pinR) {
          handR.updateMatrixWorld(true);
          const ph = handR.getWorldPosition(new THREE.Vector3()), pm = midR.getWorldPosition(new THREE.Vector3());
          const pi = idxR.getWorldPosition(new THREE.Vector3()), pp = pinR.getWorldPosition(new THREE.Vector3());
          const along = pm.sub(ph).normalize();
          const palm = new THREE.Vector3().crossVectors(pi.sub(pp), along).normalize();   // normal da palma (mão direita)
          const want = new THREE.Vector3(0, 0, 1).applyQuaternion(rq);                      // para a frente
          palm.addScaledVector(along, -palm.dot(along)).normalize();
          want.addScaledVector(along, -want.dot(along)).normalize();
          if (palm.lengthSq() > 0.5 && want.lengthSq() > 0.5) {
            let ang = Math.acos(THREE.MathUtils.clamp(palm.dot(want), -1, 1));
            if (new THREE.Vector3().crossVectors(palm, want).dot(along) < 0) ang = -ang;
            rotateWorld(handR, along, ang * waveW);
          }
        }
      }
      // continência: cotovelo aberto para o lado, antebraço subindo até a testa, mão espalmada
      // com os dedos juntos apontando para a sobrancelha direita e a palma para baixo
      if (ch.mode === "salute") { ch._salT = (ch._salT || 0) + dt; if (ch._salT > 2.3) { ch.mode = ch.afterSalute || "idle"; ch._salT = 0; } }
      else ch._salT = 0;
      salW = U.damp(salW, ch.mode === "salute" && still ? 1 : 0, 9, dt);
      if (salW > 0.01 && armR && foreR && handR && head) {
        model.updateMatrixWorld(true);
        const rq = root.getWorldQuaternion(new THREE.Quaternion());
        const Rt = new THREE.Vector3(-1, 0, 0).applyQuaternion(rq), Fw = new THREE.Vector3(0, 0, 1).applyQuaternion(rq);
        const hs = model.scale.y || 1;
        aim(armR, foreR, vt.set(-0.76, 0.14, 0.48).normalize().applyQuaternion(rq), salW);
        armR.updateMatrixWorld(true);
        const hp = head.getWorldPosition(new THREE.Vector3());
        const pulso = hp.clone().addScaledVector(Rt, 0.135 * hs).addScaledVector(UP, 0.10 * hs).addScaledVector(Fw, 0.075 * hs);
        const ep = foreR.getWorldPosition(new THREE.Vector3());
        const fdir = pulso.sub(ep).normalize();
        aim(foreR, handR, fdir, salW);
        fingersR.forEach((f) => f.b.quaternion.slerp(f.q, salW));     // dedos esticados e juntos
        if (midR) {
          handR.updateMatrixWorld(true);
          const hpos = handR.getWorldPosition(new THREE.Vector3());
          const testa = hp.clone().addScaledVector(Rt, 0.035 * hs).addScaledVector(UP, 0.118 * hs).addScaledVector(Fw, 0.105 * hs);
          const hdir = testa.sub(hpos).normalize().addScaledVector(fdir, 0.25).normalize();
          aim(handR, midR, hdir, salW);
          if (idxR && pinR) {
            handR.updateMatrixWorld(true);
            const ph = handR.getWorldPosition(new THREE.Vector3()), pm = midR.getWorldPosition(new THREE.Vector3());
            const pi = idxR.getWorldPosition(new THREE.Vector3()), pp = pinR.getWorldPosition(new THREE.Vector3());
            const along = pm.sub(ph).normalize();
            const palm = new THREE.Vector3().crossVectors(pi.sub(pp), along).normalize();
            const want = UP.clone().negate().addScaledVector(Fw, 0.35);                    // palma para baixo
            palm.addScaledVector(along, -palm.dot(along)).normalize();
            want.addScaledVector(along, -want.dot(along)).normalize();
            if (palm.lengthSq() > 0.5 && want.lengthSq() > 0.5) {
              let ang = Math.acos(THREE.MathUtils.clamp(palm.dot(want), -1, 1));
              if (new THREE.Vector3().crossVectors(palm, want).dot(along) < 0) ang = -ang;
              rotateWorld(handR, along, ang * salW);
            }
          }
        }
      }
      // "não" com a cabeça e acenos de cabeça ao falar
      if (head && still) {
        model.updateMatrixWorld(true);
        RIGHT.set(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
        if (ch.mode === "wrong" && !actions.negar) {
          wrongT += dt;
          rotateWorld(head, UP, Math.sin(wrongT * 13) * 0.42 * Math.max(0, 1 - wrongT / 1.6));
          if (wrongT > 1.6) ch.mode = "talk";
        } else if (ch.mode === "talk" && !actions.concordar && !actions.falar) {
          rotateWorld(head, RIGHT, Math.max(0, Math.sin(ch.t * 0.9)) * Math.sin(ch.t * 7) * 0.09);
        }
      }
    };
    // aplica a pose "parado" com peso total antes de posicionar acessórios
    play("parado", 0); mixer.update(0.001); lastMode = ch.mode;

    /* acessórios: posicionados já na pose "parado" */
    root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new THREE.Quaternion());
    const P = (v) => v.applyQuaternion(rq);
    const cab = def.cabeca || { abaixoDoTopo: 0.13, frente: 0.1 };
    const k = H / 1.75;
    const top = root.position.y + info.box.max.y * scale + model.position.y;
    if (head) {
      const hp = head.getWorldPosition(new THREE.Vector3());
      const center = new THREE.Vector3(hp.x, top - cab.abaixoDoTopo * k, hp.z);
      const at = (dy, dz) => center.clone().add(P(new THREE.Vector3(0, dy * k, dz * k)));
      const put = (kind, dy, dz, sc) => { const g = headwear(kind, opts); g.scale.setScalar(k * (sc || 1) * (cab.escala || 1)); mount(head, g, at(dy, dz), root); };
      const acc = [opts.acessorio, opts.extra].filter(Boolean);
      acc.forEach((a) => {
        if (a === "oculos") put("oculos", 0.005, cab.frente);
        else if (a === "capacete") put("capacete", 0.055, 0.0, 1.05);
        else if (a === "headset") put("headset", 0.02, 0);
        else if (a === "bigode") put("bigode", -0.062, cab.frente + 0.022, 1.35);
        else if (a === "chapeu") put("chapeu", 0.085, 0, 1.05);
      });
      if (opts.chapeu === "bone") put("bone", 0.055, 0.0);
      if (opts.chapeu === "chapeu") put("chapeu", 0.085, 0, 1.05);
      if (opts.chapeu === "cartola") {
        const hat = headwear("cartola", opts);
        hat.scale.setScalar(Math.pow(H / 1.75, 0.85));
        mount(head, hat, new THREE.Vector3(hp.x, top - H * 0.085, hp.z), root);
      }
    }
    if (spine && (opts.peito || opts.mochila)) {
      const sp = spine.getWorldPosition(new THREE.Vector3());
      const tor = def.torso || { frente: 0.12, altura: 0.05 };
      if (opts.peito) { const g = chestwear(opts.peito, opts); g.scale.setScalar(k); mount(spine, g, sp.clone().add(P(new THREE.Vector3(opts.peito === "cracha" ? 0.08 * k : 0, tor.altura * k, tor.frente * k))), root); }
      if (opts.mochila) {
        const bag = new THREE.Group();
        U.mesh(U.box(0.3, 0.36, 0.14), U.mat("#2D3E8F"), 0, 0, 0, bag);
        U.mesh(U.box(0.22, 0.12, 0.05), U.mat("#FFC83D"), 0, -0.06, -0.08, bag);
        bag.scale.setScalar(k);
        mount(spine, bag, sp.clone().add(P(new THREE.Vector3(0, 0, -(tor.costas || 0.17) * k))), root);
      }
    }
    if (handR && opts.carimbo) {
      const st = new THREE.Group();
      U.mesh(U.cyl(0.06, 0.07, 0.36, 10), U.mat("#6B3B1F"), 0, 0.2, 0, st);
      U.mesh(U.sph(0.1, 10, 8), U.mat("#6B3B1F"), 0, 0.4, 0, st);
      U.mesh(U.box(0.4, 0.12, 0.26), U.mat("#C0392B"), 0, 0, 0, st);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ map: U.signTex("SIGILOSO", { w: 512, h: 150, bg: "#C0392B", fg: "#fff", font: 90, radius: 10 }) }));
      lbl.position.set(0, 0, 0.131); st.add(lbl);
      st.scale.setScalar(1.7);
      mount(handR, st, handR.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.6, 0.05)), root);
      ch_extras.stamp = st;
    }
    // medidas para a pose sentada: altura do quadril e do joelho em repouso
    if (legsUp[0] && legsLow[0]) {
      const v = new THREE.Vector3();
      const hipY = legsUp[0].getWorldPosition(v).y - root.position.y, kneeY = legsLow[0].getWorldPosition(v).y - root.position.y;
      ch.sit = { queda: hipY - kneeY, assento: kneeY - 0.1 * k, coxa: hipY - kneeY };
    }
    // altura dos pés em repouso (para detectar as pisadas)
    if (feet.length) { const v = new THREE.Vector3(); ch.footRest = Math.min(...feet.map((f) => f.getWorldPosition(v).y - root.position.y)); }
    return ch;
  };

  /* =================================================================
   * OBJETOS URBANOS (KayKit): instâncias normalizadas por tamanho
   * Devolve a lista de partes {geo, mat, matrix} já escalonada para
   * que a maior dimensão indicada tenha o tamanho pedido.
   * =============================================================== */
  const propCache = new Map();
  /**
   * @param file  arquivo .glb
   * @param fit   { altura } ou { comprimento } ou { largura } em metros
   */
  A.propParts = function (file, fit) {
    const key = file + JSON.stringify(fit);
    if (propCache.has(key)) return propCache.get(key);
    const g = A.gltf[file]; if (!g) return null;
    const sc = g.scene; sc.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sc);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (fit.altura) s = fit.altura / size.y;
    else if (fit.comprimento) s = fit.comprimento / Math.max(size.x, size.z);
    else if (fit.largura) s = fit.largura / Math.max(size.x, size.z);
    // gira para que o lado mais comprido fique no eixo Z local
    const rot = fit.comprimento && size.x > size.z ? Math.PI / 2 : 0;
    const center = box.getCenter(new THREE.Vector3());
    const base = new THREE.Matrix4().makeRotationY(rot)
      .multiply(new THREE.Matrix4().makeScale(s, s, s))
      .multiply(new THREE.Matrix4().makeTranslation(fit.centralizar === false ? 0 : -center.x, -box.min.y, fit.centralizar === false ? 0 : -center.z));
    const parts = [];
    sc.traverse((n) => {
      if (!n.isMesh) return;
      if (n.material.map) { n.material.map.anisotropy = 4; }
      n.material.roughness = Math.max(0.55, n.material.roughness || 0.8);
      parts.push({ geo: n.geometry, mat: n.material, matrix: base.clone().multiply(n.matrixWorld) });
    });
    const out = { parts, size: size.clone().multiplyScalar(s), offset: center.clone().multiplyScalar(s), rot };
    propCache.set(key, out);
    return out;
  };
})();
