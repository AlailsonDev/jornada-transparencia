"""Gera assets/modelos/originais/helena.glb — a Helena, feita a partir do desenho desenho-helena.png
(moça de cabelo preto liso e comprido, repartido de lado e sem franja, sorriso discreto de boca fechada,
delineado e colar dourado com pingente de coração; no jogo ela usa roupa social: blazer preto, camisa branca, calça e salto), a partir
da Michelle (Mixamo), com o mesmo processo de gerar_mulher.py:

  * tira o cabelo de coques, os fones e os óculos da Michelle;
  * cria o cabelo novo (malha própria, presa à cabeça e às costas) sem franja;
  * pinta pele, boca, delineado, camisa branca (gola em V, carcela e botões) e calça social preta com vinco;
  * afina a calça bufante da Michelle (perna reta, barra até o sapato) e faz o sapato preto de salto bloco;
  * cria o blazer preto: "casca" sobre o tronco e os braços, aberta em V, com lapelas e um botão;
  * colar dourado com pingente de coração (malha nova);
  * óculos de grau de armação preta fina, estilo gatinho (malha nova).

Uso:  python3 ferramentas/personagem-desenho/gerar_helena.py
Depois rode  node ferramentas/embutir-modelos.js  para atualizar a versão embutida."""
import sys, io, os, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glbio import GLB
from pintura import mapa_uv, preencher, suave, rgb2hsv, cor, blur, normais
import numpy as np
from PIL import Image
from scipy import ndimage

ORIG = os.path.join(HERE, '..', '..', 'assets', 'modelos', 'originais')
SAIDA = os.path.join(ORIG, 'helena.glb')
rng = np.random.default_rng(41)
g = GLB(os.path.join(ORIG, 'michelle.glb'))
pr = g.j['meshes'][0]['primitives'][0]
P = g.acc(pr['attributes']['POSITION']); N = g.acc(pr['attributes']['NORMAL'])
UV = g.acc(pr['attributes']['TEXCOORD_0'])
J = g.acc(pr['attributes']['JOINTS_0']); Wt = g.acc(pr['attributes']['WEIGHTS_0'])
I = g.acc(pr['indices']).reshape(-1, 3)
nomes = [g.j['nodes'][k]['name'].replace('mixamorig:', '') for k in g.j['skins'][0]['joints']]
JI = {n: i for i, n in enumerate(nomes)}

# ---------------- peças soltas da malha (componentes conectados) ----------------
par = np.arange(len(P))
def find(a):
    while par[a] != a:
        par[a] = par[par[a]]; a = par[a]
    return a
for t in I:
    ra, rb, rc = find(t[0]), find(t[1]), find(t[2]); par[ra] = rc; par[rb] = rc
seen = {}
for i, p in enumerate(np.round(P, 4)):
    k = tuple(p)
    if k in seen: par[find(i)] = find(seen[k])
    else: seen[k] = i
roots = np.array([find(i) for i in range(len(P))])
comp = {}
for r in np.unique(roots):
    s = roots == r; q = P[s]
    comp[r] = dict(n=int(s.sum()), lo=q.min(0), hi=q.max(0))
corpo = max(comp, key=lambda r: comp[r]['n'])
tipo = {}
for r, c in comp.items():
    lo, hi, n = c['lo'], c['hi'], c['n']
    if r == corpo: tipo[r] = 'corpo'
    elif hi[0] - lo[0] > 0.4 and lo[1] > 1.3: tipo[r] = 'cabelo'
    elif lo[1] > 1.39 and n > 2000: tipo[r] = 'fones'
    elif lo[1] > 1.40 and n < 400 and lo[2] > 0.075: tipo[r] = 'oculos'
    elif lo[1] > 1.40 and n < 40: tipo[r] = 'oculos'
    elif lo[1] > 1.40 and hi[1] - lo[1] < 0.04 and lo[2] < 0.06 and n > 300: tipo[r] = 'sobrancelha'
    elif lo[1] > 1.40: tipo[r] = 'olho'
    else: tipo[r] = 'tenis'
print({t: sum(1 for v in tipo.values() if v == t) for t in set(tipo.values())})
TV = np.array([tipo[r] for r in roots])
for r_, t_ in tipo.items():
    if t_ != 'sobrancelha': continue
    m_ = roots == r_
    cy_ = P[m_, 1].mean()
    P[m_, 1] = cy_ + (P[m_, 1] - cy_) * 0.55
# o cabelo antigo sai inteiro (o cabelo novo fecha a cabeça, que na Michelle não tem nuca)
fora = np.isin(TV, ['fones', 'oculos', 'cabelo'])
I = I[~fora[I].any(1)]

# ---------------- calça social: perna reta até o sapato (a calça da Michelle é bufante, com punho) ----------------
cp_ = TV == 'corpo'
perna = np.where(cp_ & (P[:, 1] < 0.64) & (P[:, 1] > 0.10) & (np.abs(P[:, 0]) > 0.012))[0]
P0 = P.copy()
for i in perna:
    lado_ = np.sign(P0[i, 0])
    anel = perna[(np.abs(P0[perna, 1] - P0[i, 1]) < 0.003) & (np.sign(P0[perna, 0]) == lado_)]
    cx_, cz_ = P0[anel, 0].mean(), P0[anel, 2].mean()
    r_anel = np.hypot(P0[anel, 0] - cx_, P0[anel, 2] - cz_).mean()
    yy = P0[i, 1]
    r_alvo = np.interp(yy, [0.10, 0.22, 0.36, 0.50, 0.64], [0.061, 0.060, 0.061, 0.066, r_anel])
    w_ = suave(yy, 0.50, 0.64)
    k_ = ((1 - w_) * r_alvo + w_ * r_anel) / max(r_anel, 1e-4)
    P[i, 0] = cx_ + (P0[i, 0] - cx_) * k_
    P[i, 2] = cz_ + (P0[i, 2] - cz_) * k_
    P[i, 1] = yy - 0.085 * (1 - suave(yy, 0.22, 0.36))        # a barra desce até cobrir o sapato
# ---------------- sapato de salto: preto, bico mais fino e vão debaixo do arco (salto bloco atrás) ----------------
for r_, t_ in tipo.items():
    if t_ != 'tenis': continue
    m_ = roots == r_
    q = P[m_]; cxs = q[:, 0].mean()
    sola = comp[r_]['lo'][1] < 0.0
    xx, yy, zz = q[:, 0].copy(), q[:, 1].copy(), q[:, 2].copy()
    afina = 0.88 * (1 - 0.38 * suave(zz, 0.12, 0.206))           # mais estreito e de bico fino
    xx = cxs + (xx - cxs) * afina
    if sola:
        vao = suave(zz, 0.0, 0.025) * (1 - suave(zz, 0.085, 0.12))
        yy = np.where(yy < 0.046, np.maximum(yy, 0.044 * vao), yy)   # o arco sobe; o salto fica atrás
        salto = zz < 0.002
        xx = np.where(salto, cxs + (xx - cxs) * 0.72, xx)            # salto bloco mais estreito
    P[m_] = np.c_[xx, yy, zz]
sap_tri = I[TV[I[:, 0]] == 'tenis']
I = I[TV[I[:, 0]] != 'tenis']
CODE = {'corpo': 0, 'touca': 1, 'sobrancelha': 2, 'olho': 3, 'tenis': 4}
code = np.array([CODE.get(t, 9) for t in TV], np.float32)

# =====================================================================
# TEXTURA DO CORPO (1024): pele, boca, delineado, blusa, calça, cabelo
# =====================================================================
mi = pr['material']; mat = g.j['materials'][mi]
img_cor = g.j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
W = 1024
orig = Image.open(io.BytesIO(g.image_bytes(img_cor))).convert('RGB').resize((W, W), Image.LANCZOS)
tx = np.asarray(orig, np.float32) / 255
Pm, cov = mapa_uv(UV, I, np.c_[P, N[:, 2], code], W)
Pm = preencher(Pm, cov)
X, Y, Z, NZ, C = Pm[..., 0], Pm[..., 1], Pm[..., 2], Pm[..., 3], np.round(Pm[..., 4])
h, s, v = rgb2hsv(tx)
ehcorpo = C == 0
braco = np.abs(X) > 0.20

PELE = cor('#D49866'); BLUSA = cor('#F4F2EE'); CALCA = cor('#1E1E24'); CABELO = cor('#17141A')
pele_m = ehcorpo & (h > 8) & (h < 36) & (s > 0.3) & (v > 0.12) & (v < 0.82)
rosto = ehcorpo & (Y > 1.33) & (np.abs(X) < 0.11)
vm = v[pele_m].mean()
out = tx.copy()
# pele: mesma luz e sombra da original, no tom novo (rosto inteiro, inclusive blush e lábios antigos)
alvo_pele = pele_m | (rosto & (v > 0.12) & ~((C == 0) & (s < 0.2) & (v < 0.25)))
vs = np.where(rosto, blur(v, 1.6), v)   # rosto: tira o pontilhado da textura original
palp = rosto & (Y > 1.457) & (Y < 1.50) & (np.abs(X) > 0.012) & (np.abs(X) < 0.075) & (Z > 0.03)
vs = np.where(palp, blur(np.maximum(v, np.median(v[palp]) * 0.95), 5.0), vs)
alvo_pele |= palp    # pálpebras: sem os cílios pintados (viram o delineado)
boca_v = ehcorpo & (Y > 1.335) & (Y < 1.415) & (np.abs(X) < 0.065) & (Z > -0.01)
alvo_pele |= boca_v   # boca aberta da Michelle some (a boca nova é fechada)
vs = np.where(boca_v, np.maximum(blur(vs, 3.0), np.median(v[rosto & pele_m]) * 0.92), vs)
f = np.clip(vs / vm, 0.45, 1.5) ** 0.9
rosado = np.clip(((h < 12) | (h > 330)) * (s - 0.3) * 1.2, 0, 0.35)[..., None]   # blush vira um rosado leve
pele_cor = PELE[None, None, :] * f[..., None]
pele_cor = pele_cor * (1 - rosado * 0.5) + cor('#D9725F')[None, None, :] * f[..., None] * rosado * 0.5
out[alvo_pele] = pele_cor[alvo_pele]
# calça social preta: lisa (sem os bolsos e joelheiras da calça da Michelle), com vinco na frente
calca_m = ehcorpo & (Y < 1.03) & (Y > 0.0) & ~(pele_m & (Y > 0.26))   # tornozelo: vira calça (a barra desceu)
fc = blur(np.clip(0.8 + v * 0.3, 0.85, 1.1), 8.0)
out[calca_m] = (CALCA[None, None, :] * fc[..., None])[calca_m]
cxl = 0.103 - 0.03 * np.clip((Y - 0.2) / 0.4, 0, 1)
vinco = calca_m & (Z > 0.0) & (Y < 0.88) & (np.abs(np.abs(X) - cxl) < 0.0016)
out[vinco] = (CALCA * 1.9)[None, :]
cos_ = calca_m & (Y > 0.995) & (~braco)               # cós
out[cos_] = (CALCA * 0.75)[None, :]
# blusa amarela de tricô: a regata cinza + a barriga até a cintura da calça
cinza = ehcorpo & (s < 0.25) & (v > 0.3) & (Y > 1.0) & ~rosto
barriga = ehcorpo & (Y > 1.0) & (Y < 1.20) & ~braco & ~cinza & ~calca_m
faixa_azul = ehcorpo & (h > 170) & (h < 210) & (Y > 1.0)
blusa = cinza | barriga | faixa_azul
# camisa branca lisa, por dentro da calça
fb = np.where(cinza, np.clip(v / np.median(v[cinza]), 0.85, 1.08), 1.0)
out[blusa] = (BLUSA[None, None, :] * fb[..., None])[blusa]
# vivos escuros da regata (gola e cavas) viram ribana amarela mais escura
vivo = ehcorpo & ~braco & (Y > 1.0) & (Y < 1.34) & (s < 0.35) & (v < 0.32) & ~rosto
out[vivo] = (BLUSA * 0.95)[None, :]
# queixo e pescoço: as sombras escuras da textura original caíam na regra dos "vivos"
out[boca_v] = pele_cor[boca_v]
# camisa: decote em V (primeiro botão aberto), gola de pontas, carcela e botões
fr_c = ehcorpo & ~braco & (Z > 0.02) & ~rosto
v_lim = (Y - 1.228) * 0.55                                     # meia largura do V
decote_v = fr_c & (np.abs(X) < v_lim) & (Y > 1.228) & (Y < 1.345)
out[decote_v] = pele_cor[decote_v]
dg = np.abs(X) - v_lim
larg_g = 0.020 + 0.012 * suave(1.29 - Y, 0, 0.05)
gola_c = fr_c & (dg >= 0) & (dg < larg_g) & (Y > 1.238) & (Y < 1.335)
out[gola_c] = BLUSA[None, :]
out[fr_c & (np.abs(dg - larg_g) < 0.0012) & (Y > 1.238) & (Y < 1.335)] = cor('#B9B4AC')[None, :]
out[fr_c & (np.abs(dg) < 0.0010) & (Y > 1.228) & (Y < 1.345)] = cor('#C9C4BC')[None, :]
out[fr_c & (Y > 1.0) & (Y < 1.228) & (np.abs(X - 0.004) < 0.0009)] = cor('#CFCAC2')[None, :]   # carcela
for by in (1.045, 1.105, 1.165, 1.215):
    bt_ = np.hypot(X, Y - by)
    out[fr_c & (bt_ < 0.0024)] = cor('#E2DED6')[None, :]
    out[fr_c & (np.abs(bt_ - 0.0024) < 0.0006)] = cor('#A8A39B')[None, :]
# gola canelada (gola redonda na base do pescoço)
gola = ehcorpo & ~braco & (Y > 1.27) & (Y < 1.33) & (cinza | (np.abs(Y - 1.305 + 0.25 * np.maximum(Z, 0) ** 1) < 0.01))
# olhos: branco mais limpo (como no desenho)
olho = (C == 3) & (s < 0.2) & (v > 0.35) & (Y < 1.4635)
out[olho] = np.clip(out[olho] * 1.25 + 0.08, 0, 0.97)
# pálpebra pintada na malha do olho: vira pele (sem os cílios) com um traço grosso na borda
palp_o = (C == 3) & (Y >= 1.4635)
out[palp_o] = (PELE * np.median(f[pele_m & rosto]))[None, :]
traco = (C == 3) & (Y > 1.4605) & (Y < 1.4685)
out[traco] = cor('#0E0B0D')[None, :]

# ---- rosto (pintado pela posição na frente da cabeça) ----
frente = ehcorpo & (Z > 0.05) & (Y > 1.36) & (Y < 1.52)
def pinta(m, c, a=1.0):
    a = np.nan_to_num(np.clip(a, 0, 1)) * m
    out[:] = out * (1 - a[..., None]) + np.asarray(c, np.float32)[None, None, :] * a[..., None]
x = X; y = Y
w = 0.0240                      # meia largura da boca
q = np.clip(np.abs(x) / w, 0, 1.5)
aa = 0.0006                     # suavização da borda (m)
# sorriso discreto, de boca fechada: a linha da boca sobe um pouco nos dois cantos
My = 1.3958 + 0.0062 * q ** 2.2
esp_s = 0.0036 * np.clip(1 - q ** 2.5, 0, 1) ** 0.6           # lábio de cima
esp_i = 0.0052 * np.clip(1 - q ** 2, 0, 1) ** 0.7             # lábio de baixo, mais cheio
lab_sup = suave(My + esp_s - y, -aa, aa) * suave(y - My, -aa, aa) * (q < 1)
lab_inf = suave(My - y, -aa, aa) * suave(y - (My - esp_i), -aa, aa) * (q < 1)
labios = np.maximum(lab_sup, lab_inf)
# contorno escuro fino (traço do desenho) em volta dos lábios
envolve = suave(My + esp_s + 0.0009 - y, -aa, aa) * suave(y - (My - esp_i - 0.0009), -aa, aa) * (q < 1.06)
pinta(frente, cor('#5A2418'), envolve * 0.75)
pinta(frente, cor('#A9483F'), labios)
hl = suave(y - (My - esp_i * 0.75), -aa, aa) * suave((My - esp_i * 0.3) - y, -aa, aa) * (np.abs(x) < 0.009)
pinta(frente, cor('#C66A60'), hl * 0.5)
# linha da boca (escura) e covinhas leves nos dois cantos
pinta(frente, cor('#3E1712'), suave(0.0007 - np.abs(y - My), 0, 0.0004) * (q < 1.08))
cov_ = np.hypot((np.abs(x) - w * 1.08) / 0.0015, (y - (My + 0.0004)) / 0.0032) < 1
pinta(frente, cor('#8A5236'), cov_ * 0.4)
# risquinhos dos cantos do sorriso
# delineado gatinho: traço grosso sobre a borda de cima do olho (cobre os cílios pintados) + "asa"
# borda de cima do buraco do olho na malha do rosto (medida na malha, x positivo)
BX = np.array([0.0234, 0.0286, 0.034, 0.046, 0.0564, 0.064, 0.070])
BY = np.array([1.4471, 1.4534, 1.4553, 1.4567, 1.4555, 1.4517, 1.4526])
ax_ = np.abs(x)
ue = np.interp(ax_, BX, BY)
esp = 0.0042 + 0.0032 * suave(ax_, 0.032, 0.066)
linha = (ax_ > 0.0225) * (ax_ < 0.071) * suave(y - (ue - 0.0008), 0, 0.0004) * suave(ue + esp - y, 0, 0.0005)
def tri(px, py, A, B_, C_):
    v0 = np.subtract(C_, A); v1 = np.subtract(B_, A)
    w0 = px - A[0]; w1 = py - A[1]
    d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
    d20 = w0 * v0[0] + w1 * v0[1]; d21 = w0 * v1[0] + w1 * v1[1]
    den = d00 * d11 - d01 * d01
    a1 = (d11 * d20 - d01 * d21) / den; a2 = (d00 * d21 - d01 * d20) / den
    return (a1 >= 0) & (a2 >= 0) & (a1 + a2 <= 1)
asa = tri(ax_, y, (0.058, 1.4517 + 0.0074), (0.0835, 1.4635), (0.068, 1.4512)).astype(np.float32)
pinta(frente & (Z > 0.03), cor('#0E0B0D'), np.maximum(linha, asa))

body_img = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# BLAZER PRETO: casca sobre tronco e braços, aberta em V na frente, até o quadril
# =====================================================================
x, y, z = P[:, 0], P[:, 1], P[:, 2]
w_aberta = 0.006 + 0.076 * suave(y, 1.085, 1.30) + 0.026 * suave(1.07 - y, 0, 0.12)
sel = (TV == 'corpo') & (np.abs(x) < 0.53) & (y > 0.93) & ~((y > 1.31) & (np.abs(x) < 0.095)) & (y < 1.36)
sel &= ~((z > 0.0) & (np.abs(x) < w_aberta) & (y < 1.36))
tri = I[sel[I].all(1)]
# só a maior parte conectada (sem pedacinhos soltos)
usados = np.unique(tri)
off = np.where(np.abs(x) > 0.2, 0.010, 0.0125).astype(np.float32)
off += 0.004 * suave(-z, 0.0, 0.06) * (np.abs(x) < 0.2)          # um pouco mais solta nas costas
off += 0.010 * suave(1.02 - y, 0, 0.07) * (np.abs(x) < 0.2)       # barra mais solta (por cima do quadril)
Nj = normais(P, I)
# vértices repetidos nas costuras do UV: mesma normal, senão a casca abre uma fresta
_, grp = np.unique(np.round(P, 4), axis=0, return_inverse=True)
grp = grp.ravel(); acc_n = np.zeros((grp.max() + 1, 3)); np.add.at(acc_n, grp, Nj)
Nj = acc_n[grp] / np.maximum(np.linalg.norm(acc_n[grp], axis=1, keepdims=True), 1e-9)
JP = P + Nj * off[:, None]
remap = -np.ones(len(P), np.int64); remap[usados] = np.arange(len(usados))
jP = JP[usados]; jN = Nj[usados]; jUV = UV[usados]; jJ = J[usados]; jW = Wt[usados]
jI = remap[tri]
# gola: segue a borda de cima da casca (pescoço e lapelas)
arestas = {}
for t in jI:
    for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        k = (min(a, b), max(a, b)); arestas[k] = arestas.get(k, 0) + 1
borda = [k for k, c in arestas.items() if c == 1]
# bordas retas: abertura da frente, barra e punhos (a seleção por triângulos deixa degraus)
bv = np.unique(np.array(borda))
for i in bv:
    px_, py_, pz_ = jP[i]
    if abs(px_) > 0.40: jP[i, 0] = np.sign(px_) * 0.537
    elif py_ < 0.99 and abs(px_) < 0.21: jP[i, 1] = 0.938
    elif pz_ > 0.0 and abs(px_) < 0.10 and py_ < 1.30:
        jP[i, 0] = np.sign(px_) * (0.006 + 0.076 * suave(py_, 1.085, 1.30) + 0.026 * suave(1.07 - py_, 0, 0.12))
pp = jP
cand = lambda i: pp[i, 1] > 1.09 and abs(pp[i, 0]) < 0.13 and not (pp[i, 1] < 1.27 and pp[i, 2] < 0)
adj = {}
for a, b in borda:
    if cand(a) and cand(b):
        adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
# maior caminho entre pontas
vist = set(); melhor = []
for s0 in adj:
    if s0 in vist: continue
    # componente
    comp_v = []; st = [s0]
    while st:
        u = st.pop()
        if u in vist: continue
        vist.add(u); comp_v.append(u); st += adj[u]
    pontas = [u for u in comp_v if len(adj[u]) == 1] or comp_v[:1]
    cam = [pontas[0]]; prev = None
    while True:
        nx = [u for u in adj[cam[-1]] if u != prev and u not in cam]
        if not nx: break
        prev = cam[-1]; cam.append(nx[0])
    if len(cam) > len(melhor): melhor = cam
cam = np.array(melhor)
print('gola: pontos', len(cam))
for _ in range(4):   # alisa a linha da gola
    sm = jP[cam].copy(); sm[1:-1] = (jP[cam][:-2] + 2 * jP[cam][1:-1] + jP[cam][2:]) / 4; jP[cam] = sm
cp = jP[cam]
cz0 = -0.01
o = np.c_[cp[:, 0], np.zeros(len(cp)), cp[:, 2] - cz0]
o /= np.maximum(np.linalg.norm(o, axis=1, keepdims=True), 1e-6)
frente_g = suave(o[:, 2], -0.4, 0.6)
up = np.array([0, 1, 0])
lat = np.c_[np.sign(cp[:, 0]), np.zeros(len(cp)), np.zeros(len(cp))]
bn = suave(cp[:, 1], 1.27, 1.31)[:, None]              # 1 = gola no pescoço, 0 = lapela no peito
larg = suave(cp[:, 1], 1.10, 1.21)[:, None]            # a lapela afina até sumir no botão
g1 = cp + up * (0.016 + 0.010 * frente_g)[:, None] + o * 0.004
g2 = cp + up * (0.006 + 0.004 * frente_g)[:, None] + o * (0.016 + 0.016 * frente_g)[:, None]
l1 = cp + o * 0.004 + lat * 0.003 * larg
l2 = cp + o * 0.007 + lat * 0.030 * larg + up * 0.004 * larg
c1 = g1 * bn + l1 * (1 - bn)
c2 = g2 * bn + l2 * (1 - bn)
n0 = len(jP); m = len(cam)
jP = np.vstack([jP, c1, c2]); jN = np.vstack([jN, o, o]); jUV = np.vstack([jUV, jUV[cam], jUV[cam]])
jJ = np.vstack([jJ, jJ[cam], jJ[cam]]); jW = np.vstack([jW, jW[cam], jW[cam]])
gi = []
for k in range(m - 1):
    a0, a1 = cam[k], cam[k + 1]; b0, b1 = n0 + k, n0 + k + 1; d0, d1 = n0 + m + k, n0 + m + k + 1
    gi += [[a0, a1, b1], [a0, b1, b0], [b0, b1, d1], [b0, d1, d0]]
jI = np.vstack([jI, np.array(gi)])

# ---- textura do blazer (mesmo UV do corpo) ----
JW = 1024
Jm, jcov = mapa_uv(UV, I, np.c_[P, N[:, 2]], JW, tri_ok=(TV[I[:, 0]] == 'corpo'))
Jm = preencher(Jm, jcov)
X, Y, Z = Jm[..., 0], Jm[..., 1], Jm[..., 2]
AX = np.abs(X)
ruido = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 0.8); ruido /= ruido.std()
manchas = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 16); manchas /= manchas.std()
PRETO_B = cor('#222228')
jt = PRETO_B[None, None, :] * (1 + 0.035 * ruido[..., None] + 0.03 * manchas[..., None])
def mix(mask, c, a=1.0):
    global jt
    a = np.clip(mask * a, 0, 1)[..., None]
    jt = jt * (1 - a) + np.asarray(c)[None, None, :] * a
def linha_em(d, larg=0.0013):
    return suave(larg - np.abs(d), 0, 0.0005)
tronco = AX < 0.2
frente_j = tronco & (Z > 0.0)
wa = 0.006 + 0.076 * suave(Y, 1.085, 1.30) + 0.026 * suave(1.07 - Y, 0, 0.12)
db = AX - wa
# lapela (cetim um pouco mais claro) e a borda da abertura
lap_w = 0.030 * suave(Y, 1.10, 1.22)
mix(frente_j & (db > 0) & (db < lap_w) & (Y > 1.09), cor('#2E2E36'), 0.9)
mix(frente_j & (Y > 1.09), cor('#111114'), linha_em(db - lap_w, 0.0012) * (lap_w > 0.004))
mix(frente_j, cor('#111114'), linha_em(db - 0.0008, 0.0012))
# botão na cintura (um só, como blazer feminino)
bt = np.hypot(X - 0.012, Y - 1.072)
mix(frente_j, cor('#0C0C0E'), suave(0.0058 - bt, 0, 0.0008))
mix(frente_j, cor('#55555E'), linha_em(bt - 0.0046, 0.0008))
# lapelas dos bolsos e pences
for sx_ in (-1, 1):
    mix(frente_j & (np.abs(X - sx_ * 0.10) < 0.032), cor('#121216'), linha_em(Y - 1.0, 0.0014))
    mix(frente_j & (Y > 1.0) & (Y < 1.16), cor('#1A1A1F'), linha_em(X - sx_ * 0.065, 0.0011) * 0.7)
# costura dos ombros e punhos
mix(np.ones_like(AX, bool), cor('#141418'), linha_em(AX - 0.17, 0.0012) * (Y > 1.2) * 0.8)
mix(AX > 0.505, cor('#161619'), 0.25)
mix(np.ones_like(AX, bool), cor('#0F0F12'), linha_em(AX - 0.505, 0.0012))
mix(tronco & (Y < 0.955), cor('#141418'), 0.25)
jac_img = Image.fromarray((jt.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# CABELO NOVO: liso, preto e comprido, risca de lado e franja varrida
# =====================================================================
cab = TV != 'tenis'
Cc = np.array([0.0, 1.455, 0.005])
# envelope da cabeça (tudo que existe acima do queixo), por direção
viv = np.unique(I)
ok = np.zeros(len(P), bool); ok[viv] = True
cabeca = ok & (P[:, 1] > 1.36) & (np.abs(P[:, 0]) < 0.15)
D = P[cabeca] - Cc; r = np.linalg.norm(D, axis=1)
th = np.degrees(np.arccos(np.clip(D[:, 1] / r, -1, 1))); ph = np.degrees(np.arctan2(D[:, 0], D[:, 2]))
BT, BP = 46, 90
env = np.zeros((BT, BP), np.float32)
it_ = np.clip((th / 180 * BT).astype(int), 0, BT - 1); ip_ = ((ph + 180) / 360 * BP).astype(int) % BP
np.maximum.at(env, (it_, ip_), r)
env = ndimage.gaussian_filter(ndimage.maximum_filter(env, size=(5, 5), mode='wrap'), 1.2, mode='wrap')
def env_cab(t, p):
    a = np.clip((t / 180 * BT).astype(int), 0, BT - 1); b = ((p + 180) / 360 * BP).astype(int) % BP
    return env[a, b]
# envelope do tronco (sem os braços), por ângulo e altura
dom = J[np.arange(len(J)), Wt.argmax(1)]
arm_j = [JI[n] for n in nomes if ('Arm' in n or 'Hand' in n)]
tronco_v = ok & ~np.isin(dom, arm_j) & (P[:, 1] > 1.0) & (P[:, 1] < 1.40) & (TV == 'corpo')
Dt = P[tronco_v]; pht = np.degrees(np.arctan2(Dt[:, 0], Dt[:, 2] - Cc[2])); rt = np.hypot(Dt[:, 0], Dt[:, 2] - Cc[2])
CY0, CYS, CN, CP_ = 1.0, 0.01, 40, 90
envc = np.zeros((CN, CP_), np.float32)
np.maximum.at(envc, (np.clip(((Dt[:, 1] - CY0) / CYS).astype(int), 0, CN - 1), ((pht + 180) / 360 * CP_).astype(int) % CP_), rt)
envc = ndimage.gaussian_filter(ndimage.maximum_filter(envc, size=(5, 5), mode='wrap'), 1.2, mode='wrap')
def env_tr(yy, p):
    a = np.clip(((yy - CY0) / CYS).astype(int), 0, CN - 1); b = ((p + 180) / 360 * CP_).astype(int) % CP_
    return envc[a, b]

NPH, NS, NC = 120, 34, 44
phis = np.linspace(-180, 180, NPH + 1)
FACE = 57.0
TH0 = 98.0
def th_franja(p):
    # sem franja: testa à mostra, risca do lado direito dela (-x); o cabelo desce pelos lados do rosto
    a = np.abs(p)
    return 45 + 15 * (a / 57.0) ** 2 + 3 * suave(-p, -40, 30)
def y_fim(p):
    a = np.abs(p)
    y = 1.215 + (1.30 - 1.215) * suave(a, 84, 92) + (1.115 - 1.30) * suave(a, 112, 124)
    y -= 0.012 * suave(a, 150, 180)
    dente = 0.014 * np.abs(((p / 9.0) % 2) - 1)
    return y + dente
def r_ell(d):
    az = np.where(d[..., 2] > 0, 0.090, 0.106)
    return 1 / np.sqrt((d[..., 0] / 0.096) ** 2 + (d[..., 1] / 0.112) ** 2 + (d[..., 2] / az) ** 2)
R = np.zeros((NS + NC, NPH + 1), np.float32); Rmin = np.zeros_like(R)
DIR = np.zeros((NS + NC, NPH + 1, 3), np.float32); BASE = np.zeros_like(DIR)
valid = np.zeros((NS + NC, NPH + 1), bool); Wh = np.zeros((NS + NC, NPH + 1), np.float32)
for j, p in enumerate(phis):
    rosto_col = abs(p) < FACE
    tend = th_franja(p) + (TH0 - th_franja(p)) * suave(abs(p), FACE - 24, FACE) ** 1.5 if rosto_col else TH0
    ts = np.linspace(0, tend, NS)
    for i, t in enumerate(ts):
        d = np.array([math.sin(math.radians(t)) * math.sin(math.radians(p)), math.cos(math.radians(t)), math.sin(math.radians(t)) * math.cos(math.radians(p))])
        vol = 0.009 + 0.006 * suave(math.cos(math.radians(t)), 0.2, 1.0)
        if rosto_col: vol *= 0.3 + 0.7 * suave(tend - t, 0, 14)   # a franja encosta na testa
        ev = env_cab(np.array([t]), np.array([p]))[0]
        R[i, j] = max(r_ell(d) + 0.003, ev + vol); Rmin[i, j] = ev + 0.6 * vol
        DIR[i, j] = d; BASE[i, j] = Cc; valid[i, j] = True; Wh[i, j] = 1.0
    if rosto_col: continue
    top = Cc + DIR[NS - 1, j] * R[NS - 1, j]
    rho0 = math.hypot(top[0], top[2] - Cc[2]); y0 = top[1]
    ye = y_fim(p)
    ys = np.linspace(y0, ye, NC + 1)[1:]
    dirp = np.array([math.sin(math.radians(p)), 0, math.cos(math.radians(p))])
    for k, yy in enumerate(ys):
        conv = rho0 * (1 - 0.12 * suave(y0 - yy, 0, 0.09))
        folga = 0.022 + 0.026 * suave(1.35 - yy, 0, 0.05) * suave(yy, 1.20, 1.26) + 0.012 * suave(1.24 - yy, 0, 0.03)
        et = env_tr(np.array([yy]), np.array([p]))[0]
        R[NS + k, j] = max(conv, et + folga); Rmin[NS + k, j] = et + folga * 0.85
        DIR[NS + k, j] = dirp; BASE[NS + k, j] = (0, yy, Cc[2]); valid[NS + k, j] = True
        Wh[NS + k, j] = suave(yy, 1.31, 1.40)
# alisa os raios (sem deixar entrar na cabeça/corpo): tira as ondulações do envelope
for _ in range(10):
    acc = np.zeros_like(R); cnt = np.zeros_like(R)
    Rc = R[:, :NPH]; Vc = valid[:, :NPH]
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        Rs = np.roll(Rc, (di, dj), (0, 1)); Vs = np.roll(Vc, (di, dj), (0, 1))
        if di == 1: Vs[0] = False
        if di == -1: Vs[-1] = False
        acc[:, :NPH] += Rs * Vs; cnt[:, :NPH] += Vs
    Rn = np.where(cnt > 0, (R + acc) / (1 + cnt), R)
    R = np.where(valid, np.maximum(Rn, Rmin), R)
    R[:, NPH] = R[:, 0]
V = BASE + DIR * R[..., None]
# malha: quadrados com os 4 cantos válidos
ids = -np.ones(valid.shape, np.int64); ids[valid] = np.arange(valid.sum())
hv = V[valid]; hwh = Wh[valid]
tris = []
for i in range(NS + NC - 1):
    for j in range(NPH):
        a, b, c_, d_ = ids[i, j], ids[i, j + 1], ids[i + 1, j + 1], ids[i + 1, j]
        if min(a, b, c_, d_) < 0: continue
        tris += [[a, b, c_], [a, c_, d_]]
# a coluna do rosto termina antes: fecha o degrau entre a franja e a lateral
hI = np.array(tris, np.int64)
hN = normais(hv, hI)
rad = hv - Cc; rad[:, 1] *= 0.3
flip = (hN * rad).sum(1) < 0
hN[flip] *= -1   # normais para fora (o material é dupla face)
# UV: u em volta da cabeça (fios repetem), v descendo
gi_, gj_ = np.nonzero(valid)
hu = (phis[gj_] + 180) / 360 * 6.0
hvv = gi_ / (NS + NC - 1)
hUV = np.c_[hu, hvv].astype(np.float32)
# pesos: cabeça em cima, parte de cima das costas embaixo
hJ = np.zeros((len(hv), 4), np.uint8); hWt = np.zeros((len(hv), 4), np.float32)
hJ[:, 0] = JI['Head']; hJ[:, 1] = JI['Spine2']; hJ[:, 2] = JI['Neck']
hWt[:, 0] = hwh; hWt[:, 1] = 1 - hwh
print('cabelo: vértices', len(hv), 'triângulos', len(hI))
# textura dos fios
HW, HH = 256, 512
fio = blur(rng.normal(0, 1, (HH, HW)).astype(np.float32), 0.8)
fio = ndimage.uniform_filter1d(fio, 60, axis=0, mode='wrap')
fio = (fio - fio.min()) / (fio.max() - fio.min())
brilho = np.exp(-((np.arange(HH)[:, None] / HH - 0.30) / 0.07) ** 2) * 0.5
hc = CABELO[None, None, :] * (0.7 + 0.75 * fio[..., None]) + cor('#3B3A48')[None, None, :] * (brilho * fio)[..., None]
hair_img = Image.fromarray((hc.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# COLAR DOURADO COM PINGENTE DE CORAÇÃO
# =====================================================================
_js = JP[usados]
Qn = np.vstack([P[(TV == 'corpo') & (P[:, 2] > 0) & (P[:, 1] < 1.385) & (np.abs(P[:, 0]) < 0.09)], _js[(_js[:, 2] > 0) & (_js[:, 1] < 1.34) & (np.abs(_js[:, 0]) < 0.1)]])
def frente_z(px, py):
    m = (np.abs(Qn[:, 0] - px) < 0.01) & (np.abs(Qn[:, 1] - py) < 0.01)
    return Qn[m, 2].max() if m.any() else 0.08
cad = []
for tq in np.linspace(0, math.pi, 31):
    px = 0.047 * math.cos(tq); py = 1.352 - 0.044 * math.sin(tq) ** 1.2
    cad.append([px, py, frente_z(px, py) + 0.0025])
back = [[0.049 * math.sin(an), 1.352 + 0.03 * math.cos(an), -0.010 - 0.055 * math.cos(an)] for an in np.linspace(-math.pi / 2 + 0.1, math.pi / 2 - 0.1, 22)]
loop = np.vstack([np.array(cad), np.array(back), np.array(cad)[:1]])
for _ in range(8): loop[1:-1] = (loop[:-2] + 2 * loop[1:-1] + loop[2:]) / 4
colP, colN, colI, colJ, colW = [], [], [], [], []
NCs, rc = 5, 0.0012
for i in range(len(loop)):
    d_ = loop[min(i + 1, len(loop) - 1)] - loop[max(i - 1, 0)]; d_ /= max(np.linalg.norm(d_), 1e-9)
    u_ = np.cross(d_, [0, 1, 0.0]); u_ = u_ / np.linalg.norm(u_) if np.linalg.norm(u_) > 1e-6 else np.array([1, 0, 0.0]); v_ = np.cross(d_, u_)
    fr = loop[i, 2] > 0.0
    for kq in range(NCs):
        an = 2 * math.pi * kq / NCs; dirr = u_ * math.cos(an) + v_ * math.sin(an)
        colP.append(loop[i] + dirr * rc); colN.append(dirr)
        colJ.append([JI['Spine2'], JI['Neck'], 0, 0]); w_ = 0.8 if fr else 0.2; colW.append([w_, 1 - w_, 0, 0])
for i in range(len(loop) - 1):
    for kq in range(NCs):
        k2 = (kq + 1) % NCs; p0 = i * NCs
        colI += [[p0 + kq, p0 + NCs + kq, p0 + NCs + k2], [p0 + kq, p0 + NCs + k2, p0 + k2]]
# coração: contorno extrudado (2 mm), pendurado no ponto mais baixo
fundo = np.array(cad)[len(cad) // 2]
tt_ = np.linspace(0, 2 * math.pi, 40, endpoint=False)
hx = 16 * np.sin(tt_) ** 3; hy = 13 * np.cos(tt_) - 5 * np.cos(2 * tt_) - 2 * np.cos(3 * tt_) - np.cos(4 * tt_)
esc = 0.0105 / 32
hc0 = fundo + np.array([0, -0.0085, 0.0025])
b0 = len(colP)
for dz in (0.0, 0.0022):
    for k_ in range(len(tt_)):
        colP.append(hc0 + np.array([hx[k_] * esc, hy[k_] * esc, dz])); colN.append([hx[k_], hy[k_], 0.0 if dz == 0 else 30])
        colJ.append([JI['Spine2'], JI['Neck'], 0, 0]); colW.append([0.9, 0.1, 0, 0])
nH = len(tt_)
for k_ in range(nH):
    k2 = (k_ + 1) % nH
    colI += [[b0 + k_, b0 + k2, b0 + nH + k2], [b0 + k_, b0 + nH + k2, b0 + nH + k_]]
cf = len(colP); colP.append(hc0 + np.array([0, -0.001, 0.0022])); colN.append([0, 0, 1.0]); colJ.append([JI['Spine2'], JI['Neck'], 0, 0]); colW.append([0.9, 0.1, 0, 0])
cb = len(colP); colP.append(hc0 + np.array([0, -0.001, 0.0])); colN.append([0, 0, -1.0]); colJ.append([JI['Spine2'], JI['Neck'], 0, 0]); colW.append([0.9, 0.1, 0, 0])
for k_ in range(nH):
    k2 = (k_ + 1) % nH
    colI += [[b0 + nH + k_, b0 + nH + k2, cf], [b0 + k2, b0 + k_, cb]]
colP = np.array(colP, np.float32); colN = np.array(colN, np.float32); colI = np.array(colI)
colJ = np.array(colJ, np.uint8); colW = np.array(colW, np.float32)

# =====================================================================
# ÓCULOS DE GRAU: armação preta fina, estilo gatinho (canto de fora puxado para cima), ponte e hastes
# =====================================================================
corpoP = P[TV == 'corpo']
def zfrente(px, py, raio=0.006):
    m_ = (np.abs(corpoP[:, 0] - px) < raio) & (np.abs(corpoP[:, 1] - py) < raio) & (corpoP[:, 2] > 0.02)
    return corpoP[m_, 2].max() if m_.any() else 0.08
def xlado(py, pz, raio=0.008):
    m_ = (np.abs(corpoP[:, 1] - py) < raio) & (np.abs(corpoP[:, 2] - pz) < raio)
    return np.abs(corpoP[m_, 0]).max() if m_.any() else 0.075
ocP, ocI = [], []
def tubo_oc(pts, r=0.0019, fechado=False, ns=8):
    pts = np.asarray(pts, float)
    if fechado: pts = np.vstack([pts, pts[:1]])
    b0 = len(ocP)
    for i_ in range(len(pts)):
        d_ = pts[min(i_ + 1, len(pts) - 1)] - pts[max(i_ - 1, 0)]; d_ /= max(np.linalg.norm(d_), 1e-9)
        u_ = np.cross(d_, [0, 0, 1.0]); u_ = u_ / np.linalg.norm(u_) if np.linalg.norm(u_) > 1e-6 else np.array([0, 1, 0.0]); v_ = np.cross(d_, u_)
        for k_ in range(ns):
            an = 2 * math.pi * k_ / ns; ocP.append(pts[i_] + (u_ * math.cos(an) + v_ * math.sin(an) * 1.3) * r)
    for i_ in range(len(pts) - 1):
        for k_ in range(ns):
            k2 = (k_ + 1) % ns; p0 = b0 + i_ * ns
            ocI.extend([[p0 + k_, p0 + ns + k_, p0 + ns + k2], [p0 + k_, p0 + ns + k2, p0 + k2]])
ZL = max(zfrente(0.012, 1.462), zfrente(0.043, 1.476), zfrente(0.043, 1.436)) + 0.006
def z_aro(px, py):
    zc = ZL - 0.016 * max((abs(px) - 0.012) / 0.058, 0) ** 2         # acompanha a curva do rosto
    return max(zc, zfrente(px, py, 0.005) + 0.0045)
CXo, CYo, HWo, HHo = 0.0425, 1.4555, 0.0280, 0.0190
def gatinho(a_, sx):
    # oval; no alto do lado de fora (perto de 35°) o aro é puxado para cima e para fora, em ponta
    ar = math.radians(a_)
    ponta = max(math.cos(math.radians(a_ - 36)), 0) ** 14
    px = CXo + HWo * math.cos(ar) + 0.0068 * ponta
    py = CYo + HHo * math.sin(ar) + 0.0110 * ponta - 0.0015 * max(math.sin(ar), 0) * (1 - ponta)   # alto de dentro mais reto
    return sx * px, py
for sx in (-1, 1):
    aro = []
    for a_ in np.linspace(0, 360, 72, endpoint=False):          # aro oval com a pontinha de gatinho
        px, py = gatinho(a_, sx)
        aro.append([px, py, z_aro(px, py)])
    tubo_oc(aro, fechado=True)
    # haste: da borda de fora, rente à lateral da cabeça, até atrás da orelha
    x0, y0 = gatinho(18, sx); z0 = z_aro(x0, y0)   # a haste sai logo abaixo da ponta
    hs = []
    for t_ in np.linspace(0, 1, 9):
        zz = z0 + (-0.030 - z0) * t_
        yy = y0 - 0.004 * t_ ** 2
        xx = max(abs(x0) + 0.006 * t_, xlado(yy, zz) + 0.0045)
        hs.append([sx * xx, yy, zz])
    hs.append([sx * (hs[-1][0] * sx - 0.002), yy - 0.014, -0.040])   # ponta curva atrás da orelha
    tubo_oc(hs, r=0.0016)
pz_ = max(zfrente(0.0, 1.462), ZL) + 0.002
tubo_oc([[-(CXo - HWo) - 0.001, CYo + 0.006, z_aro(CXo - HWo, CYo + 0.006)], [0, CYo + 0.009, pz_], [(CXo - HWo) + 0.001, CYo + 0.006, z_aro(CXo - HWo, CYo + 0.006)]], r=0.0018)   # ponte
ocP = np.array(ocP, np.float32); ocI = np.array(ocI)
ocN = ocP - np.array([0, CYo, 0.0], np.float32); ocN[:, 1] *= 0.3
ocJ = np.tile([JI['Head'], 0, 0, 0], (len(ocP), 1)).astype(np.uint8); ocW = np.tile([1.0, 0, 0, 0], (len(ocP), 1)).astype(np.float32)
print('oculos: vertices', len(ocP), 'ZL', round(ZL, 4))

# =====================================================================
# MONTA O GLB
# =====================================================================
def jpg(im, q=88):
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); return b.getvalue()
img_normal = g.j['textures'][mat['normalTexture']['index']]['source']
normal_png = g.image_bytes(img_normal)
g.j['images'] = []; g.j['textures'] = []
def add_img(data, nome):
    g.j['images'].append({'name': nome, 'mimeType': 'image/jpeg', 'bufferView': 0})
    g.set_image(len(g.j['images']) - 1, data)
    g.j['textures'].append({'source': len(g.j['images']) - 1, 'sampler': 0})
    return len(g.j['textures']) - 1
t_corpo = add_img(jpg(body_img), 'corpo')
# mapa de normais: boca e queixo lisos (o relevo da boca aberta da Michelle aparecia sob a boca fechada)
nimg = np.asarray(Image.open(io.BytesIO(normal_png)).convert('RGB').resize((W, W), Image.LANCZOS), np.float32)
liso = blur(boca_v.astype(np.float32), 2.0)[..., None]
nimg = nimg * (1 - liso) + np.array([128, 128, 255], np.float32) * liso
t_normal = add_img(jpg(Image.fromarray(nimg.clip(0, 255).astype(np.uint8)), 90), 'corpo_normal')
t_jaq = add_img(jpg(jac_img, 86), 'jaqueta')
t_cab = add_img(jpg(hair_img, 85), 'cabelo')
g.j['materials'] = [
    {'name': 'Corpo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_corpo}, 'metallicFactor': 0.0, 'roughnessFactor': 0.78}, 'normalTexture': {'index': t_normal}},
    {'name': 'Blazer', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_jaq}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}},
    {'name': 'Cabelo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_cab}, 'metallicFactor': 0.0, 'roughnessFactor': 0.55}},
    {'name': 'Ouro', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#E5B64E') ** 2.2] + [1.0], 'metallicFactor': 0.85, 'roughnessFactor': 0.3}},
    {'name': 'Oculos', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#141215') ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.3}},
    {'name': 'Sapato', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#141216') ** 2.2] + [1.0], 'metallicFactor': 0.1, 'roughnessFactor': 0.22}},
]
g.j.pop('extensionsUsed', None); g.j.pop('extensionsRequired', None)
pr['attributes']['POSITION'] = g.add_acc(P.astype(np.float32), 'VEC3', 34962, minmax=True)   # (sobrancelhas mais finas)
pr['material'] = 0
pr['indices'] = g.add_acc(I.reshape(-1).astype(np.uint16), 'SCALAR', 34963)
def prim(Pv, Nv, UVv, Jv, Wv, Iv, mat_i):
    return {'attributes': {
        'POSITION': g.add_acc(Pv.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(Nv.astype(np.float32), 'VEC3', 34962),
        'TEXCOORD_0': g.add_acc(UVv.astype(np.float32), 'VEC2', 34962),
        'JOINTS_0': g.add_acc(Jv.astype(np.uint8), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(Wv.astype(np.float32), 'VEC4', 34962)},
        'indices': g.add_acc(Iv.reshape(-1).astype(np.uint16 if len(Pv) < 65535 else np.uint32), 'SCALAR', 34963), 'material': mat_i}
jN = jN / np.maximum(np.linalg.norm(jN, axis=1, keepdims=True), 1e-6)
# sapatos: primitiva própria (preto envernizado)
sv = np.unique(sap_tri); rm_ = -np.ones(len(P), np.int64); rm_[sv] = np.arange(len(sv))
sI = rm_[sap_tri]; sP = P[sv]; sN = normais(P, sap_tri)[sv]
sN = sN / np.maximum(np.linalg.norm(sN, axis=1, keepdims=True), 1e-6)
sapato_prim = prim(sP, sN, UV[sv], J[sv], Wt[sv], sI, 5)
g.j['meshes'][0]['primitives'] += [prim(jP, jN, jUV, jJ, jW, jI, 1), prim(hv, hN, hUV, hJ, hWt, hI, 2), prim(colP, colN, np.zeros((len(colP), 2), np.float32), colJ, colW, colI, 3), prim(ocP, ocN / np.linalg.norm(ocN, axis=1, keepdims=True), np.zeros((len(ocP), 2), np.float32), ocJ, ocW, ocI, 4), sapato_prim]
g.j.pop('animations', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
