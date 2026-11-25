"""Gera assets/modelos/originais/ana-beatriz.glb — a Ana Beatriz, feita a partir do desenho
desenho-anabeatriz.png (no jogo, com o cabelo preto liso preso em rabo de cavalo; pele
morena dourada, sobrancelhas grossas, delineado, sorriso de lado de boca fechada e colar dourado
com pingente), a partir da Michelle (Mixamo), com o mesmo processo da Luana (gerar_mulher.py):

  * tira o cabelo de coques, os fones e os óculos da Michelle;
  * cria o cabelo novo: liso, puxado para trás e preso num rabo de cavalo (malhas próprias);
  * pinta pele, sorriso de lado com batom rosado, delineado, blusa preta canelada e calça escura;
  * cria o casaco de oncinha: "casca" sobre o tronco e os braços, aberta na frente, com gola
    e lapelas; as rosetas são calculadas na posição 3D (não deformam com o UV);
  * colar dourado fino com pingente de florzinha (malha nova);
  * óculos de grau com armação rosa-clara (aros, ponte e hastes; malha nova).

Uso:  python3 ferramentas/personagem-desenho/gerar_anabeatriz.py
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
SAIDA = os.path.join(ORIG, 'ana-beatriz.glb')
rng = np.random.default_rng(23)
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
    P[m_, 1] = cy_ + (P[m_, 1] - cy_) * 0.72 - 0.002
# o cabelo antigo sai inteiro (o cabelo novo fecha a cabeça, que na Michelle não tem nuca)
fora = np.isin(TV, ['fones', 'oculos', 'cabelo'])
I = I[~fora[I].any(1)]
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

PELE = cor('#D49866'); BLUSA = cor('#1E1D22'); CALCA = cor('#24252C'); CABELO = cor('#17120F')
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
boca_v = ehcorpo & (Y > 1.30) & (Y < 1.415) & (np.abs(X) < 0.065) & (Z > -0.01)
alvo_pele |= boca_v   # boca aberta da Michelle some (a boca nova é fechada)
vs = np.where(boca_v, np.maximum(blur(vs, 3.0), np.median(v[rosto & pele_m]) * 0.92), vs)
f = np.clip(vs / vm, 0.45, 1.5) ** 0.9
rosado = np.clip(((h < 12) | (h > 330)) * (s - 0.3) * 1.2, 0, 0.35)[..., None]   # blush vira um rosado leve
pele_cor = PELE[None, None, :] * f[..., None]
pele_cor = pele_cor * (1 - rosado * 0.5) + cor('#D9725F')[None, None, :] * f[..., None] * rosado * 0.5
out[alvo_pele] = pele_cor[alvo_pele]
# calça: a amarela e os detalhes azuis viram uma calça escura
calca_m = ehcorpo & (Y < 1.03) & (Y > 0.12) & ~pele_m
amarelo = (h > 36) & (h < 66) & (s > 0.42)
fc = np.where(amarelo, np.clip(v / 0.9, 0.5, 1.2), np.clip(0.55 + v * 0.5, 0.5, 1.0))
fc = blur(fc, 1.0)
out[calca_m] = (CALCA[None, None, :] * fc[..., None])[calca_m]
# blusa amarela de tricô: a regata cinza + a barriga até a cintura da calça
cinza = ehcorpo & (s < 0.25) & (v > 0.3) & (Y > 1.0) & ~rosto
barriga = ehcorpo & (Y > 1.0) & (Y < 1.20) & ~braco & ~cinza & ~calca_m
faixa_azul = ehcorpo & (h > 170) & (h < 210) & (Y > 1.0)
blusa = cinza | barriga | faixa_azul
# malha canelada: listras verticais (pela posição x no corpo), com luz e sombra da original
pon = 1 + 0.22 * (np.sin(X * 2 * np.pi / 0.009) > 0.1)
fb = np.where(cinza, np.clip(v / np.median(v[cinza]), 0.75, 1.25), 1.0) * pon
barra = blusa & (Y < 1.045)
fb = np.where(barra, fb * 0.85, fb)
out[blusa] = (BLUSA[None, None, :] * fb[..., None])[blusa]
# vivos escuros da regata (gola e cavas) somem no preto da blusa
vivo = ehcorpo & ~braco & (Y > 1.0) & (Y < 1.34) & (s < 0.35) & (v < 0.32) & ~rosto
out[vivo] = (BLUSA * 0.9)[None, :]
# decote quadrado: pele do colo acima de uma linha reta, com faixa lisa na borda
colo = ehcorpo & ~braco & (Z > 0.02) & (Y > 1.285) & (Y < 1.36) & (np.abs(X) < 0.075)
out[colo] = (PELE * np.median(f[pele_m & rosto]) * 0.97)[None, :]
borda_dec = ehcorpo & ~braco & (Z > 0.02) & (np.abs(Y - 1.283) < 0.005) & (np.abs(X) < 0.077)
out[borda_dec] = (BLUSA * 0.8)[None, :]
peito_pele = ehcorpo & ~braco & (Y > 1.0) & (Y < 1.281) & pele_m & ~rosto
out[peito_pele] = BLUSA[None, :] * 0.95
# queixo e pescoço: as sombras escuras da textura original caíam na regra dos "vivos" e ficavam pretas
out[boca_v] = pele_cor[boca_v]
# gola canelada (gola redonda na base do pescoço)
gola = ehcorpo & ~braco & (Y > 1.27) & (Y < 1.33) & (cinza | (np.abs(Y - 1.305 + 0.25 * np.maximum(Z, 0) ** 1) < 0.01))
# olhos: branco mais limpo (como no desenho)
olho = (C == 3) & (s < 0.2) & (v > 0.35) & (Y < 1.4635)
out[olho] = np.clip(out[olho] * 1.25 + 0.08, 0, 0.97)
# sobrancelhas grossas e bem escuras (como no desenho)
sob = C == 2
out[sob] = np.minimum(out[sob], 1) * 0.25 + cor('#1A120E')[None, :] * 0.6
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
w = 0.0245                      # meia largura da boca
q = np.clip(np.abs(x) / w, 0, 1.5)
aa = 0.0006                     # suavização da borda (m)
# sorriso de lado, de boca fechada: a linha da boca sobe mais no canto esquerdo dela (+x)
lado = np.clip(x / w, -1, 1)
My = 1.3965 + 0.0030 * q ** 2 + 0.0060 * np.maximum(lado, 0) ** 2 - 0.0006 * np.maximum(-lado, 0)
esp_s = 0.0040 * np.clip(1 - q ** 2.5, 0, 1) ** 0.6           # lábio de cima
esp_i = 0.0058 * np.clip(1 - q ** 2, 0, 1) ** 0.7             # lábio de baixo, mais cheio
lab_sup = suave(My + esp_s - y, -aa, aa) * suave(y - My, -aa, aa) * (q < 1)
lab_inf = suave(My - y, -aa, aa) * suave(y - (My - esp_i), -aa, aa) * (q < 1)
labios = np.maximum(lab_sup, lab_inf)
# contorno escuro fino (traço do desenho) em volta dos lábios
envolve = suave(My + esp_s + 0.0009 - y, -aa, aa) * suave(y - (My - esp_i - 0.0009), -aa, aa) * (q < 1.06)
pinta(frente, cor('#4A2016'), envolve * 0.8)
pinta(frente, cor('#B4544F'), labios)
hl = suave(y - (My - esp_i * 0.75), -aa, aa) * suave((My - esp_i * 0.3) - y, -aa, aa) * (np.abs(x - 0.003) < 0.009)
pinta(frente, cor('#D58A86'), hl * 0.55)
# linha da boca (escura) e covinha no canto que sobe
pinta(frente, cor('#3A1612'), suave(0.0007 - np.abs(y - My), 0, 0.0004) * (q < 1.08))
cov_ = np.hypot((x - w * 1.08) / 0.0016, (y - (My + 0.0004)) / 0.0035) < 1
pinta(frente, cor('#7A4630'), cov_ * 0.5 * (x > 0))
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
# CASACO DE ONCINHA: casca sobre tronco e braços, aberta na frente
# =====================================================================
x, y, z = P[:, 0], P[:, 1], P[:, 2]
w_aberta = 0.040 + 0.040 * suave(y, 1.19, 1.31)
sel = (TV == 'corpo') & (np.abs(x) < 0.53) & (y > 1.0) & ~((y > 1.31) & (np.abs(x) < 0.095)) & (y < 1.36)
sel &= ~((z > 0.0) & (np.abs(x) < w_aberta) & (y < 1.36))
tri = I[sel[I].all(1)]
# só a maior parte conectada (sem pedacinhos soltos)
usados = np.unique(tri)
off = np.where(np.abs(x) > 0.2, 0.010, 0.0125).astype(np.float32)
off += 0.004 * suave(-z, 0.0, 0.06) * (np.abs(x) < 0.2)          # um pouco mais solta nas costas
off += 0.006 * suave(1.08 - y, 0, 0.06) * (np.abs(x) < 0.2)       # barra mais solta (por cima da calça)
Nj = normais(P, I)
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
    elif py_ < 1.06 and abs(px_) < 0.21: jP[i, 1] = 1.008
    elif pz_ > 0.0 and abs(px_) < 0.10 and py_ < 1.30:
        jP[i, 0] = np.sign(px_) * (0.040 + 0.040 * suave(py_, 1.19, 1.31))
pp = jP
cand = lambda i: pp[i, 1] > 1.16 and abs(pp[i, 0]) < 0.13 and not (pp[i, 1] < 1.27 and pp[i, 2] < 0)
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
larg = suave(cp[:, 1], 1.17, 1.25)[:, None]            # a lapela afina até sumir
g1 = cp + up * (0.016 + 0.010 * frente_g)[:, None] + o * 0.004
g2 = cp + up * (0.006 + 0.004 * frente_g)[:, None] + o * (0.016 + 0.016 * frente_g)[:, None]
l1 = cp + o * 0.004 + lat * 0.003 * larg
l2 = cp + o * 0.007 + lat * 0.024 * larg + up * 0.004 * larg
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

# ---- textura do casaco (mesmo UV do corpo) ----
JW = 1024
Jm, jcov = mapa_uv(UV, I, np.c_[P, N[:, 2]], JW, tri_ok=(TV[I[:, 0]] == 'corpo'))
Jm = preencher(Jm, jcov)
X, Y, Z = Jm[..., 0], Jm[..., 1], Jm[..., 2]
AX = np.abs(X)
ruido = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 1.0); ruido /= ruido.std()
manchas = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 22); manchas /= manchas.std()
# oncinha: rosetas calculadas no espaço 3D (sementes espalhadas em volta do tronco e dos braços);
# cada texel pega a semente mais próxima, então as manchas não esticam com o UV
from scipy.spatial import cKDTree
PASSO = 0.028
gx, gy, gz = np.meshgrid(np.arange(-0.58, 0.58, PASSO), np.arange(0.96, 1.46, PASSO), np.arange(-0.20, 0.22, PASSO), indexing='ij')
sem = np.c_[gx.ravel(), gy.ravel(), gz.ravel()] + rng.uniform(-0.45, 0.45, (gx.size, 3)) * PASSO
tam = rng.uniform(0.75, 1.25, len(sem)).astype(np.float32)      # tamanho de cada roseta
fase = rng.uniform(0, 2 * np.pi, len(sem)).astype(np.float32)
cheia = rng.random(len(sem)) < 0.22                             # algumas são pintas cheias, menores
pts = np.c_[X.ravel(), Y.ravel(), Z.ravel()]
dist, idx = cKDTree(sem).query(pts)
d = (dist / tam[idx]).reshape(JW, JW)
rel = (pts - sem[idx]).reshape(JW, JW, 3)
ang = np.arctan2(rel[..., 1], rel[..., 0] + rel[..., 2])
# borda da roseta quebrada em 3 a 4 pedaços (como a pelagem de onça)
quebra = np.sin(ang * 3.5 + fase[idx].reshape(JW, JW)) > -0.35
ondula = 1 + 0.10 * np.sin(ang * 5 + fase[idx].reshape(JW, JW) * 2)
R_IN, R_OUT = 0.0076, 0.0122
anel = suave(d * ondula - R_IN, -0.0006, 0.0006) * suave(R_OUT - d * ondula, -0.0006, 0.0006) * quebra
miolo = suave(R_IN - d * ondula, -0.0008, 0.0008)
pinta_c = cheia[idx].reshape(JW, JW)
ponto = suave(0.0068 - d * ondula, -0.0006, 0.0006) * pinta_c
anel = anel * ~pinta_c; miolo = miolo * ~pinta_c
FUNDO = cor('#C4904F'); MIOLO = cor('#9E5E24'); PRETO = cor('#1E140D')
jt = FUNDO[None, None, :] * (1 + 0.012 * ruido[..., None] + 0.025 * manchas[..., None])
def mix(mask, c, a=1.0):
    global jt
    a = np.clip(mask * a, 0, 1)[..., None]
    jt = jt * (1 - a) + np.asarray(c)[None, None, :] * a
tudo = np.ones((JW, JW), bool)
mix(tudo, MIOLO, miolo * 0.85)
mix(tudo, PRETO, np.maximum(anel, ponto))
# pelo curto: fios finos e sombra leve nas costas e debaixo dos braços
fios = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 0.6)
fios = ndimage.uniform_filter1d(fios, 5, axis=0); fios /= fios.std()
jt *= (1 + 0.02 * fios[..., None])
jt *= (1 - 0.10 * suave(-Z, 0.02, 0.10) * (AX < 0.2))[..., None]
# punhos e barra com acabamento um pouco mais escuro
mix(AX > 0.505, PRETO, 0.12)
mix((AX < 0.2) & (Y < 1.03), PRETO, 0.12)
jac_img = Image.fromarray((jt.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# CABELO NOVO: liso, preto, puxado para trás e preso num rabo de cavalo
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
TH0 = 94.0
def th_franja(p):
    # sem franja: testa à mostra, cabelo puxado para trás
    a = np.abs(p)
    return 42 + 18 * (a / 57.0) ** 2
def y_fim(p):
    a = np.abs(p)
    y = 1.19 + (1.30 - 1.19) * suave(a, 84, 92) + (1.09 - 1.30) * suave(a, 112, 124)
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
    # atrás o cabelo desce até a nuca (fecha a cabeça da Michelle, que não tem nuca)
    tend = th_franja(p) + (TH0 - th_franja(p)) * suave(abs(p), FACE - 24, FACE) ** 1.5 if rosto_col else TH0 - 6 * math.exp(-((abs(p) - 84) / 10) ** 2) + 42 * suave(abs(p), 94, 136)
    ts = np.linspace(0, tend, NS)
    for i, t in enumerate(ts):
        d = np.array([math.sin(math.radians(t)) * math.sin(math.radians(p)), math.cos(math.radians(t)), math.sin(math.radians(t)) * math.cos(math.radians(p))])
        vol = 0.005 + 0.004 * suave(math.cos(math.radians(t)), 0.2, 1.0)   # rente à cabeça (cabelo preso)
        if rosto_col: vol *= 0.3 + 0.7 * suave(tend - t, 0, 14)   # a franja encosta na testa
        ev = env_cab(np.array([t]), np.array([p]))[0]
        R[i, j] = max(r_ell(d) + 0.003, ev + vol); Rmin[i, j] = ev + 0.6 * vol
        DIR[i, j] = d; BASE[i, j] = Cc; valid[i, j] = True; Wh[i, j] = 1.0
    continue   # cabelo preso: sem a cortina de cabelo solto
    top = Cc + DIR[NS - 1, j] * R[NS - 1, j]
    rho0 = math.hypot(top[0], top[2] - Cc[2]); y0 = top[1]
    ye = y_fim(p)
    ys = np.linspace(y0, ye, NC + 1)[1:]
    dirp = np.array([math.sin(math.radians(p)), 0, math.cos(math.radians(p))])
    for k, yy in enumerate(ys):
        conv = rho0 * (1 - 0.12 * suave(y0 - yy, 0, 0.09))
        folga = 0.016 + 0.026 * suave(1.35 - yy, 0, 0.05) * suave(yy, 1.20, 1.26) + 0.012 * suave(1.24 - yy, 0, 0.03)
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
# UV: u em volta da cabeça (fios repetem), v descendo
gi_, gj_ = np.nonzero(valid)
hu = (phis[gj_] + 180) / 360 * 6.0
hvv = gi_ / (NS - 1) * 0.45
hUV = np.c_[hu, hvv].astype(np.float32)
ref = np.tile(Cc, (len(hv), 1)); ref[:, 1] = Cc[1] + (hv[:, 1] - Cc[1]) * 0.7   # centro p/ orientar as normais

# ---- rabo de cavalo: tubo que sai do alto da nuca e cai pelas costas ----
def ponto_cap(t, p):
    d = np.array([math.sin(math.radians(t)) * math.sin(math.radians(p)), math.cos(math.radians(t)), math.sin(math.radians(t)) * math.cos(math.radians(p))])
    return Cc + d * max(r_ell(d) + 0.003, env_cab(np.array([t]), np.array([p]))[0] + 0.006)
base_t = ponto_cap(88, 180)                      # onde o elástico prende
ctrl = np.array([base_t + [0, 0, 0.004], base_t + [0, -0.004, -0.030], base_t + [0, -0.045, -0.050],
                 [0, 1.33, base_t[2] - 0.045], [0, 1.24, base_t[2] - 0.040], [0, 1.16, base_t[2] - 0.034]])
NL, NR = 40, 18
tt = np.linspace(0, 1, NL)
# curva suave pelos pontos de controle (Catmull-Rom)
segs = len(ctrl) - 1
eixo = []
for u in tt:
    k = min(int(u * segs), segs - 1); w_ = u * segs - k
    p0, p1, p2, p3 = ctrl[max(k - 1, 0)], ctrl[k], ctrl[k + 1], ctrl[min(k + 2, segs)]
    eixo.append(0.5 * ((2 * p1) + (-p0 + p2) * w_ + (2 * p0 - 5 * p1 + 4 * p2 - p3) * w_ ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * w_ ** 3))
eixo = np.array(eixo)
# afasta das costas (casaco + folga), para não atravessar o corpo
for k in range(NL):
    yy = eixo[k, 1]
    if yy < 1.40:
        et = env_tr(np.array([yy]), np.array([180.0]))[0]
        eixo[k, 2] = min(eixo[k, 2], Cc[2] - (et + 0.040))
for _ in range(6): eixo[1:-1] = (eixo[:-2] + 2 * eixo[1:-1] + eixo[2:]) / 4
# raio: preso no elástico, cheio logo abaixo e afinando na ponta
raio = 0.013 + 0.022 * suave(tt, 0.02, 0.18) * (1 - 0.75 * suave(tt, 0.35, 1.0)) - 0.009 * suave(tt, 0.85, 1.0)
raio = np.maximum(raio, 0.003)
tP, tU, tR, tW = [], [], [], []
for k in range(NL):
    dk = eixo[min(k + 1, NL - 1)] - eixo[max(k - 1, 0)]; dk /= np.linalg.norm(dk)
    ex = np.array([1.0, 0, 0]); ex -= dk * (ex @ dk); ex /= np.linalg.norm(ex)
    ey = np.cross(dk, ex)
    for m in range(NR + 1):
        an = 2 * math.pi * m / NR
        rr = raio[k] * (1 + 0.06 * math.sin(an * 5 + k * 0.4))      # mechas
        tP.append(eixo[k] + (ex * math.cos(an) * 1.0 + ey * math.sin(an) * 0.85) * rr)
        tU.append([m / NR * 2.0, 0.45 + 0.55 * tt[k]]); tR.append(eixo[k])
        tW.append(1.0 - 0.8 * suave(tt[k], 0.25, 0.9))               # a ponta acompanha as costas
tP = np.array(tP, np.float32); tR = np.array(tR, np.float32)
tI = []
for k in range(NL - 1):
    for m in range(NR):
        a, b = k * (NR + 1) + m, k * (NR + 1) + m + 1
        tI += [[a, b, b + NR + 1], [a, b + NR + 1, a + NR + 1]]
# elástico: anel escuro no ponto preso
eP, eR = [], []
for k, (yy_off, rr) in enumerate(((0.0, 0.0155), (0.006, 0.0155))):
    for m in range(NR + 1):
        an = 2 * math.pi * m / NR
        c0 = eixo[1] + (eixo[2] - eixo[1]) * (k * 0.9)
        dk = eixo[3] - eixo[0]; dk /= np.linalg.norm(dk)
        ex = np.array([1.0, 0, 0]); ex -= dk * (ex @ dk); ex /= np.linalg.norm(ex); ey = np.cross(dk, ex)
        eP.append(c0 + (ex * math.cos(an) + ey * math.sin(an) * 0.85) * rr); eR.append(c0)
eI = [[m, m + 1, m + NR + 2] for m in range(NR)] + [[m, m + NR + 2, m + NR + 1] for m in range(NR)]
n0 = len(hv); n1 = n0 + len(tP)
hv = np.vstack([hv, tP, np.array(eP, np.float32)])
hI = np.vstack([hI, np.array(tI) + n0, np.array(eI) + n1])
hUV = np.vstack([hUV, np.array(tU, np.float32), np.tile([[0.99, 0.02]], (len(eP), 1)).astype(np.float32)])
hwh = np.concatenate([hwh, np.array(tW, np.float32), np.ones(len(eP), np.float32)])
ref = np.vstack([ref, tR, np.array(eR, np.float32)])
hN = normais(hv, hI)
flip = (hN * (hv - ref)).sum(1) < 0
hN[flip] *= -1   # normais para fora (o material é dupla face)
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
brilho = (np.exp(-((np.arange(HH)[:, None] / HH - 0.22) / 0.06) ** 2) + np.exp(-((np.arange(HH)[:, None] / HH - 0.62) / 0.06) ** 2)) * 0.45
hc = cor('#141217')[None, None, :] * (0.75 + 0.7 * fio[..., None]) + cor('#3B3A48')[None, None, :] * (brilho * fio)[..., None]
hc[:12, -12:] = cor('#0A090B')   # canto usado pelo elástico (UV 0.99, 0.02)
hair_img = Image.fromarray((hc.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# COLAR DOURADO FINO COM PINGENTE DE FLORZINHA
# =====================================================================
_js = JP[usados]
Qn = np.vstack([P[(TV == 'corpo') & (P[:, 2] > 0) & (P[:, 1] < 1.385) & (np.abs(P[:, 0]) < 0.09)], _js[(_js[:, 2] > 0) & (_js[:, 1] < 1.34) & (np.abs(_js[:, 0]) < 0.1)]])
def frente_z(px, py):
    m = (np.abs(Qn[:, 0] - px) < 0.01) & (np.abs(Qn[:, 1] - py) < 0.01)
    return Qn[m, 2].max() if m.any() else 0.08
cad = []
for tq in np.linspace(0, math.pi, 31):
    px = 0.043 * math.cos(tq); py = 1.352 - 0.044 * math.sin(tq) ** 1.2
    cad.append([px, py, frente_z(px, py) + 0.0025])
back = [[0.043 * math.sin(an), 1.352 + 0.018 * math.cos(an), -0.012 - 0.05 * math.cos(an)] for an in np.linspace(-math.pi / 2 + 0.1, math.pi / 2 - 0.1, 22)]
loop = np.vstack([np.array(cad), np.array(back), np.array(cad)[:1]])
for _ in range(8): loop[1:-1] = (loop[:-2] + 2 * loop[1:-1] + loop[2:]) / 4
colP, colN, colI, colJ, colW = [], [], [], [], []
NCs, rc = 5, 0.0009
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
# florzinha: contorno extrudado (2 mm), pendurado no ponto mais baixo
fundo = np.array(cad)[len(cad) // 2]
tt_ = np.linspace(0, 2 * math.pi, 60, endpoint=False)
rf = 0.45 + 0.55 * np.abs(np.cos(2 * tt_)) ** 0.8          # 4 pétalas
hx = rf * np.sin(tt_) * 16; hy = rf * np.cos(tt_) * 16
esc = 0.0095 / 32
hc0 = fundo + np.array([0, -0.0065, 0.0025])
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
# ÓCULOS DE GRAU: armação rosa-clara grossa, aros ovais, ponte e hastes até as orelhas
# =====================================================================
corpoP = P[TV == 'corpo']
def zfrente(px, py, raio=0.006):
    m_ = (np.abs(corpoP[:, 0] - px) < raio) & (np.abs(corpoP[:, 1] - py) < raio) & (corpoP[:, 2] > 0.02)
    return corpoP[m_, 2].max() if m_.any() else 0.08
def xlado(py, pz, raio=0.008):
    m_ = (np.abs(corpoP[:, 1] - py) < raio) & (np.abs(corpoP[:, 2] - pz) < raio)
    return np.abs(corpoP[m_, 0]).max() if m_.any() else 0.075
ocP, ocI = [], []
def tubo_oc(pts, r=0.0033, fechado=False, ns=10):
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
CXo, CYo, HWo, HHo = 0.0425, 1.4555, 0.0285, 0.0205
for sx in (-1, 1):
    aro = []
    for a_ in np.linspace(0, 360, 48, endpoint=False):          # aro oval
        ar = math.radians(a_)
        px = sx * (CXo + HWo * math.cos(ar)); py = CYo + HHo * math.sin(ar)
        aro.append([px, py, z_aro(px, py)])
    tubo_oc(aro, fechado=True)
    # haste: da borda de fora, rente à lateral da cabeça, até atrás da orelha
    x0 = sx * (CXo + HWo * 0.97); y0 = CYo + 0.005; z0 = z_aro(x0, y0)
    hs = []
    for t_ in np.linspace(0, 1, 9):
        zz = z0 + (-0.030 - z0) * t_
        yy = y0 - 0.004 * t_ ** 2
        xx = max(abs(x0) + 0.006 * t_, xlado(yy, zz) + 0.0045)
        hs.append([sx * xx, yy, zz])
    hs.append([sx * (hs[-1][0] * sx - 0.002), yy - 0.014, -0.040])   # ponta curva atrás da orelha
    tubo_oc(hs, r=0.0025)
pz_ = max(zfrente(0.0, 1.462), ZL) + 0.002
tubo_oc([[-(CXo - HWo) - 0.001, CYo + 0.006, z_aro(CXo - HWo, CYo + 0.006)], [0, CYo + 0.009, pz_], [(CXo - HWo) + 0.001, CYo + 0.006, z_aro(CXo - HWo, CYo + 0.006)]], r=0.0028)   # ponte
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
# mapa de normais: boca e queixo lisos (o relevo da boca aberta da Michelle parecia barba)
nimg = np.asarray(Image.open(io.BytesIO(normal_png)).convert('RGB').resize((W, W), Image.LANCZOS), np.float32)
liso = blur(boca_v.astype(np.float32), 2.0)[..., None]
nimg = nimg * (1 - liso) + np.array([128, 128, 255], np.float32) * liso
t_normal = add_img(jpg(Image.fromarray(nimg.clip(0, 255).astype(np.uint8)), 90), 'corpo_normal')
t_jaq = add_img(jpg(jac_img, 86), 'jaqueta')
t_cab = add_img(jpg(hair_img, 85), 'cabelo')
g.j['materials'] = [
    {'name': 'Corpo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_corpo}, 'metallicFactor': 0.0, 'roughnessFactor': 0.78}, 'normalTexture': {'index': t_normal}},
    {'name': 'Casaco', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_jaq}, 'metallicFactor': 0.0, 'roughnessFactor': 0.9}},
    {'name': 'Cabelo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_cab}, 'metallicFactor': 0.0, 'roughnessFactor': 0.55}},
    {'name': 'Ouro', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#E5B64E') ** 2.2] + [1.0], 'metallicFactor': 0.85, 'roughnessFactor': 0.3}},
    {'name': 'Oculos', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#F5B9CC') ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.35}},
]
g.j.pop('extensionsUsed', None); g.j.pop('extensionsRequired', None)
pr['attributes']['POSITION'] = g.add_acc(P.astype(np.float32), 'VEC3', 34962, minmax=True)
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
g.j['meshes'][0]['primitives'] += [prim(jP, jN, jUV, jJ, jW, jI, 1), prim(hv, hN, hUV, hJ, hWt, hI, 2), prim(colP, colN, np.zeros((len(colP), 2), np.float32), colJ, colW, colI, 3), prim(ocP, ocN / np.linalg.norm(ocN, axis=1, keepdims=True), np.zeros((len(ocP), 2), np.float32), ocJ, ocW, ocI, 4)]
g.j.pop('animations', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
