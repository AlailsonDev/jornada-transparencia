"""Gera assets/modelos/originais/ana.glb — a Ana, feita a partir do desenho desenho-ana.png
(moça negra de tranças nagô puxadas para trás num rabo de tranças onduladas com degradê do
castanho-escuro ao caramelo, caindo sobre o ombro esquerdo; argolas douradas, pinta na testa,
delineado gatinho, batom vermelho, camisa social bege listrada de mangas compridas com gola e
decote em V, relógio prateado no pulso esquerdo, calça marrom com cinto e correntes douradas),
a partir da Michelle (Mixamo), com o mesmo processo de gerar_mulher.py:

  * tira o cabelo de coques, os fones e os óculos da Michelle;
  * pinta a textura: pele, boca, delineado, pinta na testa, calça marrom com cinto e correntes;
  * camisa: "casca" sobre o tronco e os braços, com gola, lapela do decote, listras e botões;
  * cabelo: touca de tranças nagô (malha própria) + rabo de tranças (tubos) preso à cabeça
    e às costas no esqueleto; argolas e relógio (malhas novas).

Uso:  python3 ferramentas/personagem-desenho/gerar_ana.py
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
SAIDA = os.path.join(ORIG, 'ana.glb')
rng = np.random.default_rng(31)
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
# sobrancelhas mais finas e arqueadas (como no desenho): achata cada uma em volta do próprio centro
for r_, t_ in tipo.items():
    if t_ != 'sobrancelha': continue
    m_ = roots == r_
    cy_ = P[m_, 1].mean()
    P[m_, 1] = cy_ + (P[m_, 1] - cy_) * 0.55
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

PELE = cor('#985A2F'); BLUSA = cor('#B9A189'); CALCA = cor('#5A3822'); CABELO = cor('#1B120D')
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
pon = 1 + 0.07 * np.sin(np.arange(W)[None, :] * 2 * np.pi / 4.0) * np.sin(np.arange(W)[:, None] * 2 * np.pi / 6.0)
fb = np.where(cinza, np.clip(v / np.median(v[cinza]), 0.7, 1.2), 1.0) * pon
# barra canelada logo acima da calça
barra = blusa & (Y < 1.045)
fb = np.where(barra, fb * (0.86 + 0.1 * (np.sin(X * 2 * np.pi / 0.006) > 0)), fb)
out[blusa] = (BLUSA[None, None, :] * fb[..., None])[blusa]
# vivos escuros da regata (gola e cavas) viram ribana amarela mais escura
vivo = ehcorpo & ~braco & (Y > 1.0) & (Y < 1.34) & (s < 0.35) & (v < 0.32) & ~rosto
out[vivo] = (BLUSA * 0.8)[None, :]
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
w = 0.0262                      # meia largura da boca
q = np.clip(np.abs(x) / w, 0, 1.5)
Uy = 1.4012 + 0.0032 * q ** 2   # borda de cima da boca aberta (cantos sobem: sorriso)
Ly = 1.3885 + 0.0159 * q ** 2   # borda de baixo
aa = 0.0006                     # suavização da borda (m)
dentro = suave(Uy - y, -aa, aa) * suave(y - Ly, -aa, aa) * (q < 1)
lab_sup = suave(Uy + 0.0032 * (1 - q ** 4) + 0.0008 - y, -aa, aa) * (q < 1.04)
lab_inf = suave(y - (Ly - 0.0058 * np.clip(1 - q ** 2, 0, 1) ** 0.7 - 0.0007), -aa, aa) * (q < 1.04)
labios = np.maximum(lab_sup * suave(y - Uy, -aa, aa), lab_inf * suave(Ly - y, -aa, aa))
contorno_m = np.clip(np.maximum(lab_sup, lab_inf) * 1.0, 0, 1)
# contorno escuro fino (traço do desenho) em volta dos lábios
envolve = suave(Uy + 0.0032 * (1 - q ** 4) + 0.0018 - y, -aa, aa) * suave(y - (Ly - 0.0058 * np.clip(1 - q ** 2, 0, 1) ** 0.7 - 0.0017), -aa, aa) * (q < 1.1)
pinta(frente, cor('#5A2418'), envolve * 0.85)
pinta(frente, cor('#C42A33'), labios)
hl = suave(y - (Ly - 0.0032), -aa, aa) * suave((Ly - 0.0012) - y, -aa, aa) * (np.abs(x) < 0.01) * (q < 1)
pinta(frente, cor('#E0646A'), hl * 0.6)
# boca aberta: dentes de cima brancos, fundo escuro, dentes de baixo
dentes_c = suave((Uy - 0.0062 * np.clip(1 - q ** 2, 0, 1) ** 0.5) - y, 0.0004, -0.0004)
pinta(frente, cor('#5E1A20'), dentro)
pinta(frente, cor('#F6F2EA'), dentro * dentes_c)
lingua = np.hypot(x / 0.014, (y - Ly) / 0.0055) < 1
pinta(frente, cor('#A8343C'), dentro * lingua * (1 - dentes_c) * 0.9)
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

# decote em V: pele (a camisa fica aberta até o meio do peito)
def w_v(yy): return 0.054 * suave(yy, 1.185, 1.315)
fpele = np.median(f[pele_m & rosto])
dec = ehcorpo & (Z > 0.0) & (np.abs(X) < w_v(Y) + 0.012) & (Y > 1.17) & (Y < 1.36) & ~rosto
out[dec] = (PELE[None, None, :] * np.clip(f, 0.75, 1.2)[..., None])[dec]
# cinto marrom com fivela dourada, logo abaixo da barra da camisa
cinto = calca_m & (Y > 0.972) & (Y < 1.006)
out[cinto] = (cor('#3E2414')[None, None, :] * (0.9 + 0.15 * (np.abs(Y - 0.989) < 0.012)[..., None]))[cinto]
pinta(cinto & (Z > 0.05) & (np.abs(X - 0.03) < 0.012), cor('#C9A23E'), 1.0)
# correntes douradas penduradas na frente (duas, em "U")
for xa, xb, fundo_y in ((-0.13, 0.11, 0.935), (-0.15, 0.13, 0.892)):
    xm = (xa + xb) / 2; hw = (xb - xa) / 2
    tq = np.clip((X - xm) / hw, -1, 1)
    yc_ = 0.985 - (0.985 - fundo_y) * (1 - tq ** 2)
    elo = (np.sin((X - xa) * 2 * np.pi / 0.0085) > -0.2).astype(np.float32)
    ch_ = (Z > 0.04) & (X > xa) & (X < xb) & calca_m
    pinta(ch_, cor('#7A5A18'), suave(0.0034 - np.abs(Y - yc_), 0, 0.0008))
    pinta(ch_, cor('#E3B94E'), suave(0.0026 - np.abs(Y - yc_), 0, 0.0007) * (0.55 + 0.45 * elo))
# pinta na testa (do lado direito dela)
pinta(frente & (Z > 0.07), cor('#3A1E12'), suave(0.0024 - np.hypot(x + 0.011, y - 1.512), 0, 0.0006))
# tênis viram marrom-escuros
ten = C == 4
out[ten] = (cor('#3B2618')[None, None, :] * np.clip(v / max(np.median(v[ten]), 1e-3), 0.5, 1.4)[..., None])[ten]
body_img = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))

# =====================================================================
# JAQUETA JEANS: casca sobre tronco e braços, aberta na frente
# =====================================================================
x, y, z = P[:, 0], P[:, 1], P[:, 2]
w_aberta = 0.054 * suave(y, 1.185, 1.315)
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
    elif pz_ > 0.0 and abs(px_) < 0.10 and py_ < 1.30 and py_ > 1.19:
        if py_ > 1.19: jP[i, 0] = np.sign(px_) * (0.054 * suave(py_, 1.185, 1.315))
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

# ---- textura da camisa (mesmo UV do corpo): bege com listras finas brancas e taupe ----
JW = 1024
Jm, jcov = mapa_uv(UV, I, np.c_[P, N[:, 2]], JW, tri_ok=(TV[I[:, 0]] == 'corpo'))
Jm = preencher(Jm, jcov)
X, Y, Z = Jm[..., 0], Jm[..., 1], Jm[..., 2]
AX = np.abs(X)
ruido = blur(rng.normal(0, 1, (JW, JW)).astype(np.float32), 1.0); ruido /= ruido.std()
# coordenada que corre "em volta" do corpo: listras verticais no tronco e ao longo dos braços
vb = np.unique(I[(TV[I[:, 0]] == 'corpo')])
Qa = P[vb]; armv = np.abs(Qa[:, 0]) > 0.22
xb_ = np.linspace(0.22, 0.56, 18)
ya_ = np.array([np.median(Qa[armv & (np.abs(np.abs(Qa[:, 0]) - q) < 0.02), 1]) if (armv & (np.abs(np.abs(Qa[:, 0]) - q) < 0.02)).any() else 1.35 for q in xb_])
za_ = np.array([np.median(Qa[armv & (np.abs(np.abs(Qa[:, 0]) - q) < 0.02), 2]) if (armv & (np.abs(np.abs(Qa[:, 0]) - q) < 0.02)).any() else 0.0 for q in xb_])
ang_t = np.arctan2(X, Z + 0.01) * 0.15
ang_b = np.arctan2(Y - np.interp(AX, xb_, ya_), Z - np.interp(AX, xb_, za_)) * 0.045
sc_ = np.where(AX > 0.2, ang_b, ang_t)
per = 0.0115
fase = (sc_ / per) % 1.0
listra_b = blur(suave(0.085 - np.abs(fase - 0.25), 0, 0.04) * 0.85, 0.7)      # branca
listra_t = blur(suave(0.05 - np.abs(fase - 0.72), 0, 0.03), 0.7)       # taupe fininha
# onde a textura não tem resolução para a listra (costas, braços), ela vira um tom médio (sem moiré)
gy_, gx_ = np.gradient(sc_)
dens = per / np.maximum(np.hypot(gx_, gy_), 1e-7)        # texels por listra
kq = np.clip((blur(dens, 2.0) - 2.6) / 1.6, 0, 1)
listra_b = listra_b * kq + np.mean(listra_b) * (1 - kq)
listra_t = listra_t * kq + np.mean(listra_t) * (1 - kq)
jt = BLUSA[None, None, :] * (1 + 0.025 * ruido[..., None])
jt = jt * (1 - listra_b[..., None]) + cor('#F7F2EA')[None, None, :] * listra_b[..., None]
jt = jt * (1 - 0.7 * listra_t[..., None]) + cor('#A99079')[None, None, :] * 0.7 * listra_t[..., None]
def linha_em(d, larg=0.0013):
    return suave(larg - np.abs(d), 0, 0.0005)
def mix(mask, c, a=1.0):
    global jt
    a = np.clip(mask * a, 0, 1)[..., None]
    jt = jt * (1 - a) + np.asarray(c)[None, None, :] * a
tronco = AX < 0.2
frente_j = tronco & (Z > -0.0)
SOMBRA = cor('#9C8670')
# carcela e botões brancos (do decote até a barra)
mix(frente_j & (Y < 1.19), SOMBRA, linha_em(X - 0.009, 0.0009) * 0.8)
for by in np.arange(1.165, 1.03, -0.066):
    bt = np.hypot(X, Y - by)
    mix(frente_j, cor('#FBFAF7'), suave(0.0052 - bt, 0, 0.0008)); mix(frente_j, cor('#B8B0A6'), linha_em(bt - 0.0045, 0.0008))
# costura do ombro e punhos
mix(np.ones_like(AX, bool), SOMBRA, linha_em(AX - 0.17, 0.0012) * (Y > 1.2) * 0.6)
pun = (AX > 0.488)
mix(pun, SOMBRA, 0.12)
mix(np.ones_like(AX, bool), SOMBRA, linha_em(AX - 0.489, 0.0014) * 0.8)
mix(tronco, SOMBRA, linha_em(Y - 1.012, 0.0014) * 0.5)   # barra por dentro da calça
jac_img = Image.fromarray((jt.clip(0, 1) * 255).astype(np.uint8))
jac_img.save('/tmp/claude-0/-home-claude/5ee43f9e-2c04-5b2b-9834-001a1c21dd13/scratchpad/shots/ana_camisa_tex.png') if os.environ.get('DEBUG_TEX') else None

# =====================================================================
# CABELO: touca de tranças nagô + rabo de tranças sobre o ombro esquerdo
# =====================================================================
Cc = np.array([0.0, 1.455, 0.005])
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
def env_dir(d):
    t = np.degrees(np.arccos(np.clip(d[1], -1, 1))); p = np.degrees(np.arctan2(d[0], d[2]))
    return env[min(int(t / 180 * BT), BT - 1), int((p + 180) / 360 * BP) % BP]
def r_ell(d):
    az = 0.090 if d[2] > 0 else 0.106
    return 1 / math.sqrt((d[0] / 0.096) ** 2 + (d[1] / 0.112) ** 2 + (d[2] / az) ** 2)
# linha do cabelo (em coordenadas normais da cabeça): testa alta, contorna as orelhas, nuca
def dentro_cabelo(d):
    t = math.degrees(math.acos(max(-1, min(1, d[1])))); p = abs(math.degrees(math.atan2(d[0], d[2])))
    return t < np.interp(p, [0, 28, 50, 75, 95, 125, 180], [50, 52, 61, 74, 100, 128, 138])
# as tranças correm da linha do cabelo até o ponto do rabo (alto, atrás, puxado para a esquerda)
kp = np.array([0.10, 0.62, -0.78]); kp /= np.linalg.norm(kp)
e1 = np.cross(kp, [1.0, 0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(kp, e1)
def dir_tp(t, p):
    t, p = math.radians(t), math.radians(p)
    return math.cos(t) * kp + math.sin(t) * (math.cos(p) * e1 + math.sin(p) * e2)
NPH, NS = 120, 30
phis = np.linspace(-180, 180, NPH + 1)
R = np.zeros((NS, NPH + 1), np.float32); Rmin = np.zeros_like(R)
DIRS = np.zeros((NS, NPH + 1, 3), np.float32)
for j, p in enumerate(phis):
    lo, hi = 0.0, 179.0          # até onde vai a coluna (bisseção na linha do cabelo)
    for _ in range(22):
        mid = (lo + hi) / 2
        if dentro_cabelo(dir_tp(mid, p)): lo = mid
        else: hi = mid
    for i, t in enumerate(np.linspace(0, lo, NS)):
        d = dir_tp(t, p)
        vol = 0.0042 + 0.0018 * (1 - i / (NS - 1))
        ev = env_dir(d)
        R[i, j] = max(r_ell(d) + 0.0015, ev + vol); Rmin[i, j] = ev + 0.7 * vol
        DIRS[i, j] = d
for _ in range(8):
    acc = np.zeros_like(R); cnt = np.zeros_like(R)
    Rc = R[:, :NPH]
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        Rs = np.roll(Rc, (di, dj), (0, 1)); Vs = np.ones_like(Rs, bool)
        if di == 1: Vs[0] = False
        if di == -1: Vs[-1] = False
        acc[:, :NPH] += Rs * Vs; cnt[:, :NPH] += Vs
    R = np.maximum(np.where(cnt > 0, (R + acc) / (1 + cnt), R), Rmin); R[:, NPH] = R[:, 0]
V = Cc + DIRS * R[..., None]
ids = np.arange(NS * (NPH + 1)).reshape(NS, NPH + 1)
hv = V.reshape(-1, 3)
tris = []
for i in range(NS - 1):
    for j in range(NPH):
        a_, b_, c_, d_ = ids[i, j], ids[i, j + 1], ids[i + 1, j + 1], ids[i + 1, j]
        tris += [[a_, b_, c_], [a_, c_, d_]]
hI = np.array(tris, np.int64)
hN = normais(hv, hI)
flip = (hN * (hv - Cc)).sum(1) < 0
hN[flip] *= -1
gi_, gj_ = np.meshgrid(np.arange(NS), np.arange(NPH + 1), indexing='ij')
hUV = np.c_[(phis[gj_.ravel()] + 180) / 360 * 22.0, 1 - gi_.ravel() / (NS - 1)].astype(np.float32)
hJ = np.zeros((len(hv), 4), np.uint8); hWt = np.zeros((len(hv), 4), np.float32)
hJ[:, 0] = JI['Head']; hWt[:, 0] = 1
print('touca: vértices', len(hv))
# textura das tranças nagô: uma trança por faixa (u), trançado em espinha de peixe (v)
HW, HH = 128, 512
uu = (np.arange(HW)[None, :] + 0.5) / HW; vv = (np.arange(HH)[:, None] + 0.5) / HH
perfil = np.clip(np.cos((uu - 0.5) * np.pi * 1.15), 0, 1)
espinha = 0.5 + 0.5 * np.sin((vv * 46 + np.abs(uu - 0.5) * 2.2) * 2 * np.pi)
fio = blur(rng.normal(0, 1, (HH, HW)).astype(np.float32), 0.7)
lum_ = (0.35 + 0.9 * perfil * (0.55 + 0.45 * espinha)) * (0.9 + 0.08 * fio)
tc = cor('#1E140F')[None, None, :] * lum_[..., None] + cor('#5A3A28')[None, None, :] * (perfil ** 6 * espinha * 0.35)[..., None]
risca = np.clip((np.abs(uu - 0.5) - 0.44) / 0.06, 0, 1)    # repartido entre as tranças (couro cabeludo)
tc = tc * (1 - risca[..., None]) + (PELE * 0.55)[None, None, :] * risca[..., None]
hair_img = Image.fromarray((np.broadcast_to(tc, (HH, HW, 3)).clip(0, 1) * 255).astype(np.uint8))

# ---------------- rabo de tranças ----------------
tie = Cc + kp * (env_dir(kp) + 0.006)
# envelope do tronco/pescoço por altura e ângulo (sem os braços), para o rabo não entrar no corpo
dom = J[np.arange(len(J)), Wt.argmax(1)]
arm_j = [JI[n] for n in nomes if ('Arm' in n or 'Hand' in n)]
tronco_v = ok & ~np.isin(dom, arm_j) & (P[:, 1] > 1.0) & (P[:, 1] < 1.50) & (TV == 'corpo')
Dt = P[tronco_v]; pht = np.degrees(np.arctan2(Dt[:, 0], Dt[:, 2] - Cc[2])); rt = np.hypot(Dt[:, 0], Dt[:, 2] - Cc[2])
CY0, CYS, CN, CP_ = 1.0, 0.01, 50, 90
envc = np.zeros((CN, CP_), np.float32)
np.maximum.at(envc, (np.clip(((Dt[:, 1] - CY0) / CYS).astype(int), 0, CN - 1), ((pht + 180) / 360 * CP_).astype(int) % CP_), rt)
envc = ndimage.gaussian_filter(ndimage.maximum_filter(envc, size=(3, 5), mode='wrap'), 1.0, mode='wrap')
def env_tr(yy, p):
    return envc[min(max(int((yy - CY0) / CYS), 0), CN - 1), int((p + 180) / 360 * CP_) % CP_]
ctrl = np.array([tie, [0.05, 1.455, -0.112], [0.105, 1.395, -0.075], [0.135, 1.345, 0.01], [0.13, 1.28, 0.085], [0.12, 1.17, 0.108], [0.112, 1.065, 0.11]])
def catmull(Pc, n):
    Pp = np.vstack([2 * Pc[0] - Pc[1], Pc, 2 * Pc[-1] - Pc[-2]]); out_ = []
    for k_ in range(1, len(Pp) - 2):
        p0, p1, p2, p3 = Pp[k_ - 1], Pp[k_], Pp[k_ + 1], Pp[k_ + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out_.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out_.append(Pc[-1]); return np.array(out_)
path = catmull(ctrl, 10)
seg = np.linalg.norm(np.diff(path, axis=0), axis=1); sarc = np.r_[0, np.cumsum(seg)]; sarc /= sarc[-1]
def rb_(sv): return 0.010 + 0.028 * suave(sv, 0.0, 0.22) - 0.008 * suave(sv, 0.8, 1.0)
# afasta do corpo (raio do feixe + folga)
for k_ in range(len(path)):
    q = path[k_]
    if q[1] < 1.47:
        p_ = math.degrees(math.atan2(q[0], q[2] - Cc[2])); rr = math.hypot(q[0], q[2] - Cc[2])
        need = env_tr(q[1], p_) + rb_(sarc[k_]) + 0.006
        if rr < need:
            sc = need / rr; path[k_, 0] *= sc; path[k_, 2] = Cc[2] + (q[2] - Cc[2]) * sc
for _ in range(6):
    path[1:-1] = (path[:-2] + 2 * path[1:-1] + path[2:]) / 4
# referencial ao longo do caminho (transporte paralelo)
Tg = np.gradient(path, axis=0); Tg /= np.linalg.norm(Tg, axis=1, keepdims=True)
Nr = [np.cross(Tg[0], [0, 0, 1.0])]; Nr[0] /= np.linalg.norm(Nr[0])
for k_ in range(1, len(path)):
    n_ = Nr[-1] - Tg[k_] * (Nr[-1] @ Tg[k_]); Nr.append(n_ / np.linalg.norm(n_))
Nr = np.array(Nr); Br = np.cross(Tg, Nr)
NSTR, NSIDE = 24, 5
tp_, tn_, tuv_, tj_, tw_, ti_ = [], [], [], [], [], []
for si in range(NSTR):
    psi = si * 2.399; rho = math.sqrt((si + 0.5) / NSTR)
    fase = rng.random() * 6.28; s_end = 0.86 + 0.14 * rng.random()
    base_i = len(tp_); nring = 0
    for k_ in range(len(path)):
        sv = sarc[k_]
        if sv > s_end: break
        rb = rb_(sv)
        onda = 0.0038 * suave(sv, 0.08, 0.25) * math.sin(sv * 2 * math.pi * 13 + fase)
        c_ = path[k_] + Nr[k_] * (math.cos(psi) * rho * rb + onda) + Br[k_] * (math.sin(psi) * rho * rb)
        rs = 0.0066 * (1 - 0.3 * suave(sv, 0.7, s_end))
        if sv > s_end - 0.02: rs *= 0.5
        wh = 1 - suave(sv, 0.06, 0.3)
        for kk in range(NSIDE):
            an = 2 * math.pi * kk / NSIDE
            dirr = Nr[k_] * math.cos(an) + Br[k_] * math.sin(an)
            tp_.append(c_ + dirr * rs); tn_.append(dirr)
            tuv_.append([kk / NSIDE + si * 0.13, sv * 9.0])
            tj_.append([JI['Head'], JI['Spine2'], 0, 0]); tw_.append([wh, 1 - wh, 0, 0])
        nring += 1
    for k_ in range(nring - 1):
        for kk in range(NSIDE):
            k2 = (kk + 1) % NSIDE; p0 = base_i + k_ * NSIDE
            ti_ += [[p0 + kk, p0 + NSIDE + kk, p0 + NSIDE + k2], [p0 + kk, p0 + NSIDE + k2, p0 + k2]]
tp_ = np.array(tp_, np.float32); tn_ = np.array(tn_, np.float32); tuv_ = np.array(tuv_, np.float32)
tj_ = np.array(tj_, np.uint8); tw_ = np.array(tw_, np.float32); ti_ = np.array(ti_)
print('tranças: vértices', len(tp_))
# textura das tranças: degradê do castanho-escuro (raiz) ao caramelo (pontas), em v (0..9)
TW2, TH2 = 64, 1024
v2 = (np.arange(TH2)[:, None] + 0.5) / TH2 * 9.0 / 9.0
u2 = (np.arange(TW2)[None, :] + 0.5) / TW2
grad = np.clip((v2 - 0.30) / 0.6, 0, 1)
c_raiz, c_meio, c_ponta = cor('#1E140E'), cor('#6A3A18'), cor('#B06A2A')
base_c = c_raiz[None, None, :] * (1 - grad[..., None]) + c_meio[None, None, :] * grad[..., None]
base_c = base_c * (1 - (grad ** 3)[..., None]) + c_ponta[None, None, :] * (grad ** 3)[..., None]
torcao = 0.5 + 0.5 * np.sin((u2 * 2 + (np.arange(TH2)[:, None] / TH2) * 9.0 * 40) * 2 * np.pi)
fio2 = blur(rng.normal(0, 1, (TH2, TW2)).astype(np.float32), 0.8)
tr_c = base_c * (0.82 + 0.3 * torcao[..., None]) * (0.95 + 0.06 * fio2[..., None])
tranca_img = Image.fromarray((np.broadcast_to(tr_c, (TH2, TW2, 3)).clip(0, 1) * 255).astype(np.uint8))
# elástico do rabo
ep, en, eI = [], [], []
for i_ in range(2):
    for kk in range(16):
        an = 2 * math.pi * kk / 16
        dirr = Nr[2] * math.cos(an) + Br[2] * math.sin(an)
        ep.append(path[2] + Tg[2] * (i_ - 0.5) * 0.012 + dirr * (rb_(sarc[2]) + 0.006)); en.append(dirr)
for kk in range(16):
    k2 = (kk + 1) % 16; eI += [[kk, 16 + kk, 16 + k2], [kk, 16 + k2, k2]]
ep = np.array(ep, np.float32); en = np.array(en, np.float32); eI = np.array(eI)
eJ = np.tile([JI['Head'], 0, 0, 0], (len(ep), 1)).astype(np.uint8); eW = np.tile([1, 0, 0, 0], (len(ep), 1)).astype(np.float32)

# ---------------- argolas douradas (duas em cada orelha) ----------------
orelha = ok & (TV == 'corpo') & (P[:, 1] > 1.40) & (P[:, 1] < 1.48) & (np.abs(P[:, 0]) > 0.066) & (P[:, 2] < 0.04) & (P[:, 2] > -0.04)
argP, argN, argI = [], [], []
for sx in (-1, 1):
    m_ = orelha & (P[:, 0] * sx > 0)
    Q = P[m_]
    lobo = Q[np.argmin(Q[:, 1] + 0.3 * (0.09 - np.abs(Q[:, 0])))]
    for k_, (R0, dx) in enumerate(((0.0115, 0.0), (0.0105, 0.0042))):
        cen = lobo + np.array([sx * (0.002 + dx), -R0 + 0.002, 0.0])
        b0 = len(argP)
        for i_ in range(28):
            a1 = 2 * math.pi * i_ / 28
            cc = cen + np.array([0, math.cos(a1), math.sin(a1)]) * R0
            for j_ in range(6):
                a2 = 2 * math.pi * j_ / 6
                nn = np.array([0, math.cos(a1), math.sin(a1)]) * math.cos(a2) + np.array([sx, 0, 0]) * math.sin(a2)
                argP.append(cc + nn * 0.0026); argN.append(nn)
        for i_ in range(28):
            for j_ in range(6):
                i2 = (i_ + 1) % 28; j2 = (j_ + 1) % 6
                argI += [[b0 + i_ * 6 + j_, b0 + i2 * 6 + j_, b0 + i2 * 6 + j2], [b0 + i_ * 6 + j_, b0 + i2 * 6 + j2, b0 + i_ * 6 + j2]]
argP = np.array(argP, np.float32); argN = np.array(argN, np.float32); argI = np.array(argI)
argJ = np.tile([JI['Head'], 0, 0, 0], (len(argP), 1)).astype(np.uint8); argW = np.tile([1, 0, 0, 0], (len(argP), 1)).astype(np.float32)

# ---------------- relógio prateado de mostrador quadrado no pulso esquerdo ----------------
xw = 0.505
cuff = (TV == 'corpo') & (np.abs(P[:, 0] - xw) < 0.012)
Qc = JP[cuff] if 'JP' in dir() else P[cuff]
yc_w, zc_w = np.median(Qc[:, 1]), np.median(Qc[:, 2])
r_w = np.percentile(np.hypot(Qc[:, 1] - yc_w, Qc[:, 2] - zc_w), 90) + 0.004
relP, relN, relI = [], [], []
NA = 24
for side in (-0.008, 0.008):
    for i_ in range(NA):
        an = 2 * math.pi * i_ / NA
        dd = np.array([0, math.cos(an), math.sin(an)])
        relP.append([xw + side, yc_w + dd[1] * r_w, zc_w + dd[2] * r_w]); relN.append(dd)
for i_ in range(NA):
    j_ = (i_ + 1) % NA; relI += [[i_, j_, NA + j_], [i_, NA + j_, NA + i_]]
# caixa quadrada em cima (dorso do pulso = +y)
cx_, cy_, cz_ = xw, yc_w + r_w + 0.004, zc_w
b0 = len(relP)
for dy in (-0.004, 0.004):
    for dx in (-0.013, 0.013):
        for dz in (-0.012, 0.012):
            relP.append([cx_ + dx, cy_ + dy, cz_ + dz]); relN.append([dx, dy * 3, dz])
fs = [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]]
relI += (np.array(fs) + b0).tolist()
mosP = np.array([[cx_ - 0.010, cy_ + 0.0042, cz_ - 0.009], [cx_ + 0.010, cy_ + 0.0042, cz_ - 0.009], [cx_ + 0.010, cy_ + 0.0042, cz_ + 0.009], [cx_ - 0.010, cy_ + 0.0042, cz_ + 0.009]], np.float32)
mosI = np.array([[0, 2, 1], [0, 3, 2]])
relP = np.array(relP, np.float32); relN = np.array(relN, np.float32); relI = np.array(relI)
jfa = JI['LeftForeArm'] if 'LeftForeArm' in JI else JI['LeftHand']
relJ = np.tile([jfa, 0, 0, 0], (len(relP), 1)).astype(np.uint8); relW = np.tile([1, 0, 0, 0], (len(relP), 1)).astype(np.float32)
mosJ = np.tile([jfa, 0, 0, 0], (4, 1)).astype(np.uint8); mosW = np.tile([1, 0, 0, 0], (4, 1)).astype(np.float32)

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
t_normal = add_img(jpg(Image.open(io.BytesIO(normal_png)).convert('RGB'), 90), 'corpo_normal')
t_jaq = add_img(jpg(jac_img, 86), 'jaqueta')
t_cab = add_img(jpg(hair_img, 88), 'cabelo')
t_tr = add_img(jpg(tranca_img, 88), 'trancas')
g.j['materials'] = [
    {'name': 'Corpo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_corpo}, 'metallicFactor': 0.0, 'roughnessFactor': 0.78}, 'normalTexture': {'index': t_normal}},
    {'name': 'Camisa', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_jaq}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}},
    {'name': 'Cabelo', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_cab}, 'metallicFactor': 0.0, 'roughnessFactor': 0.6}},
    {'name': 'Trancas', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': t_tr}, 'metallicFactor': 0.0, 'roughnessFactor': 0.6}},
    {'name': 'Ouro', 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#E0AE45') ** 2.2] + [1.0], 'metallicFactor': 0.85, 'roughnessFactor': 0.3}},
    {'name': 'Prata', 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#C9CDD2') ** 2.2] + [1.0], 'metallicFactor': 0.9, 'roughnessFactor': 0.28}},
    {'name': 'Mostrador', 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#ECEDEF') ** 2.2] + [1.0], 'metallicFactor': 0.1, 'roughnessFactor': 0.2}},
    {'name': 'Elastico', 'pbrMetallicRoughness': {'baseColorFactor': [0.02, 0.015, 0.012, 1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.7}},
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
zuv = lambda n: np.zeros((n, 2), np.float32)
g.j['meshes'][0]['primitives'] += [prim(jP, jN, jUV, jJ, jW, jI, 1), prim(hv, hN, hUV, hJ, hWt, hI, 2), prim(tp_, tn_, tuv_, tj_, tw_, ti_, 3),
    prim(argP, argN, zuv(len(argP)), argJ, argW, argI, 4), prim(relP, relN, zuv(len(relP)), relJ, relW, relI, 5),
    prim(mosP, np.tile([0, 1, 0], (4, 1)).astype(np.float32), zuv(4), mosJ, mosW, mosI, 6), prim(ep, en, zuv(len(ep)), eJ, eW, eI, 7)]
g.j.pop('animations', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
