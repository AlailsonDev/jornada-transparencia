"""Gera assets/modelos/originais/caio.glb — o Caio, feito a partir do desenho desenho-caio.png
(rapaz negro de barba cheia preta com bigode e cavanhaque, cabelo curto crespo com degradê
nas laterais, sorriso largo mostrando os dentes com aparelho, camiseta vermelha de manga curta
e corrente dourada com crucifixo), a partir do avatar rpm-homem-b.glb:

  * rosto: sorriso largo com os dentes (sorriso-guarda.npz), pele negra, sobrancelhas grossas;
  * barba cheia (pintada + "casca" de volume) e cabelo curto crespo com degradê;
  * aparelho ortodôntico pintado nos dentes de cima;
  * a bata vira camiseta vermelha de manga curta, gola careca; braços de pele novos
    (o avatar original não tem braço sob a manga);
  * corrente dourada com crucifixo; calça jeans escura e tênis claro.

Uso:  python3 ferramentas/personagem-desenho/gerar_caio.py
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
SAIDA = os.path.join(ORIG, 'caio.glb')
rng = np.random.default_rng(23)
g = GLB(os.path.join(ORIG, 'rpm-homem-b.glb'))
sk = g.j['skins'][0]
nomes = [g.j['nodes'][k]['name'] for k in sk['joints']]
JI = {n: i for i, n in enumerate(nomes)}
IB = g.acc(sk['inverseBindMatrices']).reshape(-1, 4, 4)
def osso(n): return np.linalg.inv(IB[JI[n]].T)[:3, 3]
PELE = cor('#7A4422'); CAMISA = cor('#C5483B'); CABELO = cor('#0F0C0B')

# =====================================================================
# ROSTO
# =====================================================================
H = g.mesh('Wolf3D_Head')['primitives'][0]
P = g.acc(H['attributes']['POSITION']); N = g.acc(H['attributes']['NORMAL']); UV = g.acc(H['attributes']['TEXCOORD_0'])
SM = np.load(os.path.join(HERE, 'sorriso-guarda.npz'))
P = P + SM['Wolf3D_Head_P']
N = N + SM['Wolf3D_Head_N']; N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
g.set_acc(H['attributes']['POSITION'], P.astype(np.float32)); g.set_acc(H['attributes']['NORMAL'], N.astype(np.float32))
TT = g.mesh('Wolf3D_Teeth')['primitives'][0]
tP = g.acc(TT['attributes']['POSITION']) + SM['Wolf3D_Teeth_P']
tN = g.acc(TT['attributes']['NORMAL']) + SM['Wolf3D_Teeth_N']; tN = tN / np.maximum(np.linalg.norm(tN, axis=1, keepdims=True), 1e-6)
g.set_acc(TT['attributes']['POSITION'], tP.astype(np.float32)); g.set_acc(TT['attributes']['NORMAL'], tN.astype(np.float32))
IDX = g.acc(H['indices']).reshape(-1, 3)
x, y, z = P[:, 0], P[:, 1], P[:, 2]
ax = np.abs(x)
f = np.cos(np.arctan2(x, z - 0.02))   # 1 = frente, -1 = nuca
th = np.arctan2(x, z - 0.02)

# cabelo: linha reta na testa ("pezinho" marcado), degradê nas laterais e na nuca
yh_frente = 1.790 - 0.004 * suave(ax, 0.03, 0.055)
yh_top = 1.770                                       # acima disso nas laterais/nuca: cabelo cheio
yh = np.where(f >= 0, yh_top + (yh_frente - yh_top) * f ** 2, yh_top + (1.742 - yh_top) * (-f))
ear = (ax > 0.081) & (y < 1.748) & (y > 1.64)
Fh = np.where(ear, -0.02, y - yh)
# degradê: da linha do cabelo até 4 cm abaixo, só nas laterais e atrás
Ffade = np.where(ear, -0.02, y - (yh - 0.045))
# barba: limite de cima (bochecha) e de baixo (pescoço); fora a boca
yb = np.interp(ax, [0.0, 0.020, 0.032, 0.050, 0.065, 0.078, 0.086, 0.092], [1.677, 1.678, 1.680, 1.685, 1.695, 1.710, 1.735, 1.76])
ylow = np.interp(ax, [0.0, 0.03, 0.05, 0.07, 0.085], [1.603, 1.607, 1.620, 1.642, 1.668])
boca = (x / 0.0315) ** 2 + ((y - 1.6555) / 0.0118) ** 2
Fbd = np.minimum.reduce([yb - y, y - ylow, (z - 0.035) * 0.25, (boca - 1) * 0.008, (N[:, 1] + 0.6) * 0.02])   # só na frente das orelhas, sem o pescoço
Fbd = np.where(ax > 0.092, -0.01, Fbd)
el = (x / 0.027) ** 2 + ((y - 1.6565) / 0.0098) ** 2
eb = ((ax - 0.036) / 0.031) ** 2 + ((y - 1.7435 + (ax - 0.036) * 0.12 - 0.004 * (1 - ((ax - 0.036) / 0.031) ** 2)) / 0.0072) ** 2
Fbr = np.where(z > 0.075, (1 - eb) * 0.004, -0.01)

mi, ii = g.mat_image('Wolf3D_Skin')
skin = Image.open(io.BytesIO(g.image_bytes(ii))).convert('RGB').resize((1024, 1024), Image.LANCZOS)
W = 1024
Pm, cov = mapa_uv(UV, IDX, np.c_[P, Fh, Fbr, Fbd, Ffade, N[:, 2]], W)
Pm = preencher(Pm, cov)
X, Y, Z, FH, FB, FBD, FF, NZ = [Pm[..., i] for i in range(8)]
AX = np.abs(X)
sk_ = np.asarray(skin, np.float32)
# 1) tira o cavanhaque/bigode e as sobrancelhas pintados (preenche com a pele ao redor)
def apaga(reg, raio):
    global sk_
    lum = sk_.mean(2)
    dark = reg & (lum < np.percentile(lum[cov & reg] if (cov & reg).any() else lum[cov], 60) * 0.9)
    known = ((~dark) & cov).astype(np.float32)
    den = blur(known, raio)[..., None]
    fill = np.stack([blur(sk_[..., c] * known, raio) for c in range(3)], -1) / np.maximum(den, 1e-4)
    m = np.clip(blur(dark.astype(np.float32), 2.0) * 1.8, 0, 1)[..., None]
    sk_ = np.where(den > 0.05, sk_ * (1 - m) + fill * m, sk_)
apaga((Z > 0.06) & (Y > 1.585) & (Y < 1.69) & (AX < 0.06), 14)
apaga((Z > 0.065) & (Y > 1.728) & (Y < 1.762) & (AX > 0.008) & (AX < 0.075), 8)
# 2) pele negra (mesma luz e sombra)
t = sk_ / 255
h, s, v = rgb2hsv(t)
vm = np.median(v[cov])
fpel = np.clip(v / vm, 0.45, 1.35) ** 0.85
labio = (Z > 0.09) & (np.hypot(X / 0.028, (Y - 1.6565) / 0.0112) < 1)
alvo = PELE[None, None, :] * fpel[..., None]
alvo = np.where(labio[..., None], alvo * np.array([0.92, 0.72, 0.68]), alvo)
out = alvo.copy()
# 3) cabelo crespo curto, degradê, sobrancelhas e barba
noise = rng.normal(0, 1, (W, W)).astype(np.float32)
crespo = blur(noise, 0.9); crespo = (crespo - crespo.min()) / (crespo.max() - crespo.min())
pont = blur(rng.normal(0, 1, (W, W)).astype(np.float32), 0.5); pont = (pont - pont.min()) / (pont.max() - pont.min())
def pinta(a, c):
    global out
    a = np.clip(np.nan_to_num(a), 0, 1)[..., None]
    out = out * (1 - a) + c * a
cabc = CABELO[None, None, :] * (0.7 + 0.9 * crespo[..., None])
# degradê: pontilhado escuro que vai sumindo para baixo (nas laterais e na nuca)
lado_nuca = (np.cos(np.arctan2(X, Z - 0.02)) < 0.75) & cov
fade = np.clip((FF + 0.0) / 0.045, 0, 1) ** 1.3 * lado_nuca * (FH < 0)
pinta(fade * (0.35 + 0.65 * (pont > 0.45)) * 0.92, cabc)
pinta(np.clip((FH + 0.0015) / 0.003, 0, 1), cabc)
pinta(np.clip((FB + 0.0012) / 0.0024, 0, 1) * (0.75 + 0.25 * crespo), CABELO[None, None, :] * (0.8 + 0.5 * crespo[..., None]))
barba_a = np.clip((FBD + 0.0012) / 0.0028, 0, 1)
barbac = cor('#231A15')[None, None, :] * (0.55 + 1.0 * crespo[..., None])
pinta(barba_a * (0.88 + 0.12 * pont), barbac)
# sombra de barba feita em volta (bochecha)
pinta(np.clip((FBD + 0.006) / 0.006, 0, 1) * (1 - barba_a) * 0.35 * (pont > 0.5), barbac)
skin2 = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))
buf = io.BytesIO(); skin2.save(buf, 'JPEG', quality=90); g.set_image(ii, buf.getvalue())
mb_, ib_ = g.mat_image('Wolf3D_Body')
tom = (PELE * np.median(fpel[cov & (FH < -0.03) & (FBD < -0.01) & (Y < 1.575)])).clip(0, 1)
buf = io.BytesIO(); Image.new('RGB', (4, 4), tuple(int(c * 255) for c in tom)).save(buf, 'PNG'); g.set_image(ib_, buf.getvalue(), 'image/png')

# ---------------- cascas de volume: cabelo (em cima) e barba ----------------
J_h = g.acc(H['attributes']['JOINTS_0']); W_h = g.acc(H['attributes']['WEIGHTS_0'])
def casca(campo, d, lim):
    tri = IDX[(campo[IDX] > lim).all(1)]
    used = np.unique(tri)
    remap = -np.ones(len(P), dtype=np.int64); remap[used] = np.arange(len(used))
    Ps = P[used] + N[used] * d[used, None]
    attrs = {
        'POSITION': g.add_acc(Ps.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(N[used].astype(np.float32), 'VEC3', 34962),
        'TEXCOORD_0': g.add_acc(UV[used].astype(np.float32), 'VEC2', 34962),
        'JOINTS_0': g.add_acc(J_h[used].astype(J_h.dtype), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(W_h[used].astype(np.float32), 'VEC4', 34962)}
    ind = remap[tri].reshape(-1).astype(np.uint16)
    g.mesh('Wolf3D_Head')['primitives'].append({'attributes': attrs, 'indices': g.add_acc(ind, 'SCALAR', 34963), 'material': H['material']})
taper = np.clip((Fh - 0.0005) / 0.022, 0, 1) ** 1.5
dh = 0.0008 + (0.004 + 0.006 * np.clip((y - 1.79) / 0.04, 0, 1)) * taper
dh += (rng.random(len(P)) - 0.5) * 0.0012 * taper
casca(Fh, dh.astype(np.float32), 0.0005)
# barba em relevo: uma casca grossa (com "parede" na borda, colada à pele) e, por cima, camadas de
# pelos (textura com transparência, cada camada mais rala), para a barba ter volume e borda felpuda
tb_ = np.clip((Fbd - 0.0004) / 0.006, 0, 1) ** 0.7
perto_boca = np.clip((boca - 1.0) / 0.7, 0, 1)
queixo = np.clip((1.665 - y) / 0.05, 0, 1)
db = 0.0006 + (0.0030 + 0.0055 * queixo + 0.0022 * suave(ax, 0.035, 0.07)) * tb_ * (0.35 + 0.65 * perto_boca)
db += (rng.random(len(P)) - 0.5) * 0.0010 * tb_
db = db.astype(np.float32)
LIM_B = 0.0004
tri_b = IDX[(Fbd[IDX] > LIM_B).all(1)]
used_b = np.unique(tri_b)
def prim_cabeca(Pv, Nv, UVv, Jv, Wv, Iv, mat_i):
    return {'attributes': {
        'POSITION': g.add_acc(Pv.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(Nv.astype(np.float32), 'VEC3', 34962),
        'TEXCOORD_0': g.add_acc(UVv.astype(np.float32), 'VEC2', 34962),
        'JOINTS_0': g.add_acc(Jv.astype(J_h.dtype), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(Wv.astype(np.float32), 'VEC4', 34962)},
        'indices': g.add_acc(Iv.reshape(-1).astype(np.uint16), 'SCALAR', 34963), 'material': mat_i}
remap_b = -np.ones(len(P), dtype=np.int64); remap_b[used_b] = np.arange(len(used_b))
nb_ = len(used_b)
Pb = P[used_b] + N[used_b] * db[used_b, None]
# parede: liga a borda da casca à pele
ar_b = {}
for t_ in tri_b:
    for a_, b_ in ((t_[0], t_[1]), (t_[1], t_[2]), (t_[2], t_[0])):
        kk = (min(a_, b_), max(a_, b_)); ar_b[kk] = ar_b.get(kk, (0, a_, b_)); ar_b[kk] = (ar_b[kk][0] + 1, ar_b[kk][1], ar_b[kk][2])
borda_b = [(a_, b_) for (c_, a_, b_) in ar_b.values() if c_ == 1]
Pw = np.vstack([Pb, P[used_b] - N[used_b] * 0.0004])
Nw = np.vstack([N[used_b], N[used_b]])
UVw = np.vstack([UV[used_b], UV[used_b]]); Jw = np.vstack([J_h[used_b], J_h[used_b]]); Ww = np.vstack([W_h[used_b], W_h[used_b]])
Iw = [remap_b[tri_b]]
par_ = []
for a_, b_ in borda_b:
    ia, ib = remap_b[a_], remap_b[b_]
    par_ += [[ia, nb_ + ia, nb_ + ib], [ia, nb_ + ib, ib]]
Iw.append(np.array(par_)); Iw = np.vstack(Iw)
g.mesh('Wolf3D_Head')['primitives'].append(prim_cabeca(Pw, Nw, UVw, Jw, Ww, Iw, H['material']))
# camadas de pelos
PW_ = 128
pel = np.zeros((PW_, PW_), np.float32)
for _ in range(900):
    cx_, cy_ = rng.integers(0, PW_, 2)
    ang = rng.normal(-1.57, 0.5); L = rng.uniform(2, 6)
    for k in np.linspace(0, 1, 8):
        px = int(cx_ + math.cos(ang) * L * k) % PW_; py = int(cy_ + math.sin(ang) * L * k) % PW_
        pel[py, px] = max(pel[py, px], 1 - 0.5 * k)
pel = ndimage.gaussian_filter(pel, 0.7, mode='wrap'); pel = pel / pel.max()
cor_p = (cor('#2A201A')[None, None, :] * (0.65 + 0.25 * blur(rng.normal(0, 1, (PW_, PW_)).astype(np.float32), 1.0)[..., None] + 0.55 * pel[..., None])).clip(0, 1)
rgba = np.dstack([cor_p, np.clip(pel * 1.15, 0, 1)])
bpng = io.BytesIO(); Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(bpng, 'PNG')
g.j['images'].append({'name': 'pelos_barba', 'mimeType': 'image/png', 'bufferView': 0})
g.set_image(len(g.j['images']) - 1, bpng.getvalue(), 'image/png')
g.j.setdefault('samplers', []).append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497})
g.j['textures'].append({'source': len(g.j['images']) - 1, 'sampler': len(g.j['samplers']) - 1})
t_pelo = len(g.j['textures']) - 1
mats_b = []
for k_, cut in enumerate((0.22, 0.32, 0.42, 0.52, 0.62)):
    g.j['materials'].append({'name': 'BarbaPelos%d' % k_, 'doubleSided': True, 'alphaMode': 'MASK', 'alphaCutoff': cut,
        'pbrMetallicRoughness': {'baseColorTexture': {'index': t_pelo}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}})
    mats_b.append(len(g.j['materials']) - 1)
UVp = UV[used_b] * 9.0
for k_, mi_ in enumerate(mats_b):
    off = db[used_b] + (0.0011 * (k_ + 1)) * (0.25 + 0.75 * tb_[used_b]) * (0.4 + 0.6 * perto_boca[used_b])
    Pk = P[used_b] + N[used_b] * off[:, None]
    g.mesh('Wolf3D_Head')['primitives'].append(prim_cabeca(Pk, N[used_b], UVp + k_ * 0.137, J_h[used_b], W_h[used_b], remap_b[tri_b], mi_))

# ---------------- aparelho nos dentes de cima ----------------
mt_, it_ = g.mat_image('Wolf3D_Teeth')
teeth = np.asarray(Image.open(io.BytesIO(g.image_bytes(it_))).convert('RGB'), np.float32) / 255
TW0 = teeth.shape[0]
TI_ = g.acc(TT['indices']).reshape(-1, 3)
TUVt = g.acc(TT['attributes']['TEXCOORD_0'])
Tm_, tcov_ = mapa_uv(TUVt, TI_, np.c_[tP, tN[:, 2]], TW0)
Tm_ = preencher(Tm_, tcov_)
tx_, ty_, tz_, tnz = [Tm_[..., i] for i in range(4)]
sup = ty_ > np.median(tP[:, 1])
frente_d = tnz > 0.3
ymid = np.percentile(tP[tP[:, 1] > np.median(tP[:, 1]), 1], 35)
fio = np.exp(-((ty_ - ymid) / 0.0005) ** 2) * frente_d * sup
br = (np.abs(((tx_ + 0.0023) % 0.0046) - 0.0023) < 0.0011) & (np.abs(ty_ - ymid) < 0.0012) & frente_d & sup
tt_ = teeth.copy()
a_ = np.clip(np.maximum(fio * 0.9, br.astype(np.float32)), 0, 1)[..., None]
tt_ = tt_ * (1 - a_) + cor('#9AA1AA')[None, None, :] * a_
tt_ = np.where((br & (np.abs(ty_ - ymid) < 0.0004))[..., None], cor('#D8DCE0')[None, None, :], tt_)
buf = io.BytesIO(); Image.fromarray((tt_.clip(0, 1) * 255).astype(np.uint8)).save(buf, 'JPEG', quality=92); g.set_image(it_, buf.getvalue())

# =====================================================================
# CAMISETA VERMELHA DE MANGA CURTA
# =====================================================================
T = g.mesh('Wolf3D_Outfit_Top')['primitives'][0]
TP = g.acc(T['attributes']['POSITION'])
TI = g.acc(T['indices']).reshape(-1, 3)
par = np.arange(len(TP))
def find(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for t_ in TI:
    ra, rb, rc = find(t_[0]), find(t_[1]), find(t_[2]); par[ra] = rc; par[rb] = rc
seen = {}
for i, p in enumerate(np.round(TP, 5)):
    k = tuple(p)
    if k in seen: par[find(i)] = find(seen[k])
    else: seen[k] = i
roots = np.array([find(i) for i in range(len(TP))])
TI = TI[(roots[TI] == np.bincount(roots).argmax()).all(1)]   # sem os colares
# barra reta, por fora da calça
low = TP[:, 1] < 1.14
r = np.hypot(TP[:, 0], TP[:, 2] - 0.005)
k = np.clip((1.14 - TP[:, 1]) / 0.1, 0, 1)
target_r = 0.166
shrink = np.where(r > target_r, (target_r + (r - target_r) * (1 - 1.0 * k)) / np.maximum(r, 1e-6), 1.0)
TP2 = TP.copy()
sel = low & ~(np.abs(TP[:, 0]) > 0.24)
TP2[sel, 0] *= shrink[sel]; TP2[sel, 2] = 0.005 + (TP[sel, 2] - 0.005) * shrink[sel]
TP2[sel, 1] = np.where(TP[sel, 1] < 1.0, 1.0 - (1.0 - TP[sel, 1]) * 0.5, TP[sel, 1])
# camiseta caindo reta: a parte de baixo da bata (cinto e "saia") sai; no lugar entra um tubo liso
YC = 1.235
TI = TI[~((TP2[TI][:, :, 1] < YC) & (np.abs(TP2[TI][:, :, 0]) < 0.26)).any(1)]
# mangas curtas: corta no meio do braço, deixa a manga um pouco mais justa
TCUT = 0.48
cortar = np.zeros(len(TP2), bool)
for lado in ('Left', 'Right'):
    a = osso(lado + 'Arm'); b = osso(lado + 'ForeArm'); L = np.linalg.norm(b - a); axv = (b - a) / L
    tt = (TP2 - a) @ axv / L; rv = (TP2 - a) - np.outer(tt * L, axv); rn = np.linalg.norm(rv, axis=1)
    m_ = (TP2[:, 0] * a[0] > 0) & (np.abs(TP2[:, 0]) > 0.15) & (tt > 0.0)
    alvo_r = 0.068 - 0.004 * np.clip(tt / TCUT, 0, 1)
    esc = np.where(rn > alvo_r, 1 + (alvo_r / np.maximum(rn, 1e-6) - 1) * suave(tt, 0.0, 0.25), 1.0)
    TP2[m_] = (a + np.outer(tt * L, axv) + rv * esc[:, None])[m_]
    cortar |= m_ & (tt > TCUT + 0.02)
TI = TI[~cortar[TI].any(1)]
# borda da manga reta (no plano do corte)
ar = {}
for t_ in TI:
    for a_, b_ in ((t_[0], t_[1]), (t_[1], t_[2]), (t_[2], t_[0])):
        kk = (min(a_, b_), max(a_, b_)); ar[kk] = ar.get(kk, 0) + 1
bv = np.unique(np.array([kk for kk, c in ar.items() if c == 1]))
for lado in ('Left', 'Right'):
    a = osso(lado + 'Arm'); b = osso(lado + 'ForeArm'); L = np.linalg.norm(b - a); axv = (b - a) / L
    tt = (TP2[bv] - a) @ axv / L
    mm = (TP2[bv, 0] * a[0] > 0) & (np.abs(TP2[bv, 0]) > 0.17) & (tt > 0.1)
    TP2[bv[mm]] -= np.outer((tt[mm] - TCUT) * L, axv)
g.set_acc(T['attributes']['POSITION'], TP2.astype(np.float32))
T['indices'] = g.add_acc(TI.reshape(-1).astype(np.uint16), 'SCALAR', 34963)

mt, it = g.mat_image('Wolf3D_Outfit_Top')
top = Image.open(io.BytesIO(g.image_bytes(it))).convert('RGB')
TW = top.size[0]
TUV = g.acc(T['attributes']['TEXCOORD_0'])
tex0 = np.asarray(top, np.float32) / 255
Tm, tcov = mapa_uv(TUV, TI, TP2, TW)
Tm = preencher(Tm, tcov)
X, Y, Z = Tm[..., 0], Tm[..., 1], Tm[..., 2]
AX = np.abs(X)
lum = blur(tex0.mean(2), 9.0)
lum = np.clip(lum / np.median(lum[tcov]), 0.93, 1.07)
malha = 1 + 0.03 * blur(rng.normal(0, 1, (TW, TW)).astype(np.float32), 0.6)
ct = CAMISA[None, None, :] * (lum * malha)[..., None]
def mix(mask, c, a=1.0):
    global ct
    a = np.clip(np.nan_to_num(mask * a), 0, 1)[..., None]
    ct = ct * (1 - a) + np.asarray(c)[None, None, :] * a
ESC = CAMISA * 0.72
for lado in ('Left', 'Right'):   # barra das mangas
    a = osso(lado + 'Arm'); b = osso(lado + 'ForeArm'); L = np.linalg.norm(b - a); axv = (b - a) / L
    tt = ((Tm[..., :3] - a) @ axv) / L
    ok = (X * a[0] > 0) & (AX > 0.2)
    mix(ok, ESC, np.exp(-((tt - (TCUT - 0.07)) / 0.008) ** 2) * 0.8)
    mix(ok & (tt > TCUT - 0.07), CAMISA * 0.93, 0.5)
mix(AX < 0.25, ESC, np.exp(-((Y - 1.022) / 0.002) ** 2) * 0.7)   # barra
mix(AX < 0.25, ESC, np.exp(-((AX - 0.17) / 0.0015) ** 2) * (Y > 1.38) * 0.5)   # costura do ombro
top2 = Image.fromarray((ct.clip(0, 1) * 255).astype(np.uint8))
tm = g.j['materials'][mt]
tm.pop('normalTexture', None)
pbr = tm['pbrMetallicRoughness']; pbr.pop('metallicRoughnessTexture', None)
pbr['metallicFactor'] = 0.0; pbr['roughnessFactor'] = 0.9
tm['doubleSided'] = True
buf = io.BytesIO(); top2.save(buf, 'JPEG', quality=90); g.set_image(it, buf.getvalue())

# ---------------- barra da camiseta: tubo liso da cintura até o quadril ----------------
TJ0 = g.acc(T['attributes']['JOINTS_0']); TW0_ = g.acc(T['attributes']['WEIGHTS_0'])
vk = np.unique(TI); Qv = TP2[vk]
angQ = np.arctan2(Qv[:, 0], Qv[:, 2] - 0.005); rQ = np.hypot(Qv[:, 0], Qv[:, 2] - 0.005)
NBk = 48; ibQ = ((angQ + math.pi) / (2 * math.pi) * NBk).astype(int) % NBk
def env_y(yy):
    m0 = (np.abs(Qv[:, 1] - yy) < 0.015) & (np.abs(Qv[:, 0]) < 0.23)
    R_ = np.zeros(NBk); np.maximum.at(R_, ibQ[m0], rQ[m0])
    ok_ = R_ > 0; ii_ = np.arange(NBk)
    R_ = np.interp(ii_, ii_[ok_], R_[ok_], period=NBk)
    return ndimage.gaussian_filter1d(ndimage.maximum_filter1d(R_, 3, mode='wrap'), 1.2, mode='wrap')
Rtop = env_y(YC + 0.025)
_bot = g.mesh('Wolf3D_Outfit_Bottom')['primitives'][0]['attributes']
BPt_ = g.acc(_bot['POSITION']); BJ_ = g.acc(_bot['JOINTS_0']); BW_ = g.acc(_bot['WEIGHTS_0'])
angP = np.arctan2(BPt_[:, 0], BPt_[:, 2] - 0.005); rP = np.hypot(BPt_[:, 0], BPt_[:, 2] - 0.005); ibP = ((angP + math.pi) / (2 * math.pi) * NBk).astype(int) % NBk
def env_calca(yy):
    m0 = (np.abs(BPt_[:, 1] - yy) < 0.02) & (np.abs(BPt_[:, 0]) < 0.26)
    R_ = np.zeros(NBk); np.maximum.at(R_, ibP[m0], rP[m0])
    return ndimage.gaussian_filter1d(ndimage.maximum_filter1d(R_, 5, mode='wrap'), 1.0, mode='wrap')
ys_h = np.linspace(YC + 0.03, 1.02, 12)
uv_liso = TUV[vk[np.argmin(np.abs(Qv[:, 0]) + np.abs(Qv[:, 1] - 1.30) + (Qv[:, 2] < 0) * 9)]]
hp, hn, hj, hw = [], [], [], []
for i, yy in enumerate(ys_h):
    ec = np.maximum(env_calca(yy), env_calca(min(yy + 0.04, YC)))
    for b_ in range(NBk):
        an = -math.pi + (b_ + 0.5) * 2 * math.pi / NBk
        rr = Rtop[b_] + 0.003 + 0.006 * suave(np.array(YC - yy), 0.0, 0.2)
        rr = max(rr, ec[b_] + 0.008 + 0.010 * suave(np.array(1.12 - yy), 0, 0.1))
        q = np.array([math.sin(an) * rr, yy, 0.005 + math.cos(an) * rr])
        hp.append(q); hn.append([math.sin(an), 0, math.cos(an)])
        if yy < 1.10:   # a barra acompanha a cintura da calça (quadril), para a calça não atravessar
            nb_ = np.argmin(np.linalg.norm(BPt_ - np.array([q[0], 1.08, q[2]]), axis=1))
            hj.append(BJ_[nb_]); hw.append(BW_[nb_])
        else:
            near = vk[np.argmin(np.linalg.norm(Qv - np.array([q[0], YC + 0.02, q[2]]), axis=1))]
            hj.append(TJ0[near]); hw.append(TW0_[near])
hI = []
for i in range(len(ys_h) - 1):
    for b_ in range(NBk):
        b2 = (b_ + 1) % NBk; p0 = i * NBk
        hI += [[p0 + b_, p0 + NBk + b_, p0 + NBk + b2], [p0 + b_, p0 + NBk + b2, p0 + b2]]
hp = np.array(hp, np.float32); hn = np.array(hn, np.float32); hI = np.array(hI)
hUV = np.tile(uv_liso, (len(hp), 1)).astype(np.float32)

# ---------------- gola careca (ribana em volta do pescoço) ----------------
TJ = g.acc(T['attributes']['JOINTS_0']); TW_ = g.acc(T['attributes']['WEIGHTS_0'])
vid = np.unique(TI); viz = TP2[vid]
angs = np.linspace(0, 360, 61)
up = np.array([0, 1, 0])
gp, gn, gj, gw = [], [], [], []
for ang in angs:
    a = math.radians(ang)
    o = np.array([math.sin(a), 0, math.cos(a)])
    ybase = 1.532 + (1.588 - 1.532) * (1 - math.cos(a)) / 2
    def anel(rx, rz, dy):
        return np.array([rx * math.sin(a), ybase + dy, -0.012 + rz * math.cos(a)])
    base = anel(0.064, 0.068, 0.0)
    near = vid[np.argmin(np.linalg.norm(viz - base, axis=1))]
    pts = [anel(0.059, 0.063, -0.004), anel(0.062, 0.066, 0.011), anel(0.070, 0.074, 0.012), anel(0.074, 0.078, 0.0), anel(0.095, 0.098, -0.022)]
    for q in pts:
        gp.append(q); gn.append(o); gj.append(TJ[near]); gw.append(TW_[near])
gp = np.array(gp, np.float32); gn = np.array(gn, np.float32)
gI = []
for i in range(len(angs) - 1):
    for kq in range(4):
        a0, a1 = 5 * i + kq, 5 * (i + 1) + kq
        gI += [[a0, a1, a1 + 1], [a0, a1 + 1, a0 + 1]]
gI = np.array(gI)

# ---------------- braços de pele (sob a manga curta até o antebraço do avatar) ----------------
Bm = g.mesh('Wolf3D_Body')['primitives'][0]
BP = g.acc(Bm['attributes']['POSITION'])
bracos = []
for lado in ('Left', 'Right'):
    a = osso(lado + 'Arm'); e = osso(lado + 'ForeArm'); hnd = osso(lado + 'Hand')
    Lu = np.linalg.norm(e - a); au = (e - a) / Lu; Lf = np.linalg.norm(hnd - e); af = (hnd - e) / Lf
    # raio do antebraço do avatar no começo dele
    tb = (BP - e) @ af / Lf; rb = np.linalg.norm((BP - e) - np.outer(tb * Lf, af), axis=1)
    mf = (BP[:, 0] * a[0] > 0) & (rb < 0.08) & (np.abs(tb - 0.33) < 0.04)
    r_fore = np.percentile(rb[mf], 60) if mf.any() else 0.045
    # eixo: braço (t 0.25 → 1) e antebraço (0 → 0.36)
    cs, rs, ws = [], [], []
    for tq in np.linspace(0.25, 1.0, 12):
        cs.append(a + au * Lu * tq); rs.append(0.043 - 0.004 * tq); ws.append(suave(np.array(tq), 0.85, 1.0) * 0.5)
    for tq in np.linspace(0.05, 0.36, 7):
        cs.append(e + af * Lf * tq); rs.append(0.041 + (r_fore * 0.97 - 0.041) * tq / 0.36); ws.append(0.5 + 0.5 * suave(np.array(tq), 0.0, 0.15))
    cs = np.array(cs); NA_ = 20
    pts, nor, jj, ww = [], [], [], []
    for i in range(len(cs)):
        d_ = cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]; d_ /= np.linalg.norm(d_)
        u_ = np.cross(d_, [0, 0, 1.0]); u_ /= np.linalg.norm(u_); v_ = np.cross(d_, u_)
        for kq in range(NA_):
            an = 2 * math.pi * kq / NA_
            dirr = u_ * math.cos(an) + v_ * math.sin(an)
            pts.append(cs[i] + dirr * rs[i]); nor.append(dirr)
            jj.append([JI[lado + 'Arm'], JI[lado + 'ForeArm'], 0, 0]); ww.append([1 - float(ws[i]), float(ws[i]), 0, 0])
    tri_ = []
    for i in range(len(cs) - 1):
        for kq in range(NA_):
            k2 = (kq + 1) % NA_; p0 = i * NA_
            tri_ += [[p0 + kq, p0 + NA_ + k2, p0 + NA_ + kq], [p0 + kq, p0 + k2, p0 + NA_ + k2]]
    bracos.append((np.array(pts, np.float32), np.array(nor, np.float32), np.array(jj), np.array(ww, np.float32), np.array(tri_)))

# ---------------- corrente dourada com crucifixo ----------------
vtop = np.unique(TI); QT = TP2[vtop]
def frente_z(px, py):
    m = (np.abs(QT[:, 0] - px) < 0.012) & (np.abs(QT[:, 1] - py) < 0.012) & (QT[:, 2] > 0)
    return QT[m, 2].max() if m.any() else 0.12
cad = []
# frente: "U" caindo até o meio do peito
for tq in np.linspace(0, math.pi, 41):
    px = 0.071 * math.cos(tq); py = 1.552 - 0.150 * math.sin(tq) ** 1.15
    cad.append([px, py, max(frente_z(px, py), 0.05) + 0.0045])
# atrás: arco em volta da nuca, por cima da gola (do lado -x, pela nuca, até o lado +x)
back = []
for an in np.linspace(-math.pi / 2 + 0.1, math.pi / 2 - 0.1, 26):
    back.append([0.077 * math.sin(an), 1.552 + 0.05 * math.cos(an), -0.006 - 0.087 * math.cos(an)])
cad = np.array(cad); back = np.array(back)
loop = np.vstack([cad, back, cad[:1]])
# alisa
for _ in range(12):
    loop[1:-1] = (loop[:-2] + 2 * loop[1:-1] + loop[2:]) / 4
cp, cn, cj, cw, ci = [], [], [], [], []
NC = 6; rc = 0.0022
for i in range(len(loop)):
    d_ = loop[min(i + 1, len(loop) - 1)] - loop[max(i - 1, 0)]; d_ /= max(np.linalg.norm(d_), 1e-9)
    u_ = np.cross(d_, [0, 1, 0]); u_ = u_ / max(np.linalg.norm(u_), 1e-9) if np.linalg.norm(u_) > 1e-6 else np.array([1, 0, 0.0])
    v_ = np.cross(d_, u_)
    fr = loop[i, 2] > 0.02
    for kq in range(NC):
        an = 2 * math.pi * kq / NC
        dirr = u_ * math.cos(an) + v_ * math.sin(an)
        cp.append(loop[i] + dirr * rc); cn.append(dirr)
        cj.append([JI['Spine2'], JI['Neck'], 0, 0]); wv = 0.85 if fr else 0.25; cw.append([wv, 1 - wv, 0, 0])
for i in range(len(loop) - 1):
    for kq in range(NC):
        k2 = (kq + 1) % NC; p0 = i * NC
        ci += [[p0 + kq, p0 + NC + kq, p0 + NC + k2], [p0 + kq, p0 + NC + k2, p0 + k2]]
# crucifixo pendurado no ponto mais baixo
fundo = cad[len(cad) // 2]
def caixa(c, sx, sy, sz):
    vs = []
    for dx in (-sx, sx):
        for dy in (-sy, sy):
            for dz in (-sz, sz):
                vs.append(c + np.array([dx, dy, dz]))
    fs = [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]]
    return np.array(vs), np.array(fs)
cz_ = fundo[2] + 0.002
crux = [caixa(np.array([0, fundo[1] - 0.022, cz_]), 0.0032, 0.019, 0.0018), caixa(np.array([0, fundo[1] - 0.012, cz_]), 0.0115, 0.0032, 0.0018),
        caixa(np.array([0, fundo[1] - 0.003, cz_]), 0.0024, 0.0024, 0.0024)]
base_i = len(cp)
for vs, fs in crux:
    off = len(cp)
    for q in vs:
        cp.append(q); nn = q - np.array([0, fundo[1] - 0.015, cz_]); cn.append(nn / max(np.linalg.norm(nn), 1e-9))
        cj.append([JI['Spine2'], JI['Neck'], 0, 0]); cw.append([0.9, 0.1, 0, 0])
    ci += (fs + off).tolist()
cp = np.array(cp, np.float32); cn = np.array(cn, np.float32); ci = np.array(ci)

# ---------------- calça jeans escura e tênis claro ----------------
def tingir_mat(nome, alvo_hex, rough, contraste=1.0):
    m_i, im_i = g.mat_image(nome)
    t_ = np.asarray(Image.open(io.BytesIO(g.image_bytes(im_i))).convert('RGB'), np.float32) / 255
    _, _, v_ = rgb2hsv(t_)
    fv = np.clip((blur(v_, 1.0) / np.median(v_) - 1) * contraste + 1, 0.55, 1.25)
    o_ = (cor(alvo_hex)[None, None, :] * fv[..., None]).clip(0, 1)
    b_ = io.BytesIO(); Image.fromarray((o_ * 255).astype(np.uint8)).save(b_, 'JPEG', quality=88); g.set_image(im_i, b_.getvalue())
    mm = g.j['materials'][m_i]; pb = mm['pbrMetallicRoughness']; pb.pop('metallicRoughnessTexture', None)
    pb['metallicFactor'] = 0.0; pb['roughnessFactor'] = rough
tingir_mat('Wolf3D_Outfit_Bottom', '#2B3753', 0.92)
tingir_mat('Wolf3D_Outfit_Footwear', '#E4E1DA', 0.6, 0.6)
# bico do sapato original (curvado) vira um bico de tênis arredondado
FW = g.mesh('Wolf3D_Outfit_Footwear')['primitives'][0]
FP = g.acc(FW['attributes']['POSITION']).copy()
for lado, sx in (('Left', 1), ('Right', -1)):
    ladoF = FP[:, 0] * sx > 0
    zt = osso(lado + 'ToeBase')[2] + 0.05
    bico = ladoF & (FP[:, 2] > zt)
    FP[bico, 2] = zt + (FP[bico, 2] - zt) * 0.8
    FP[bico, 1] = np.minimum(FP[bico, 1], 0.072 - (FP[bico, 2] - zt) * 0.35)
g.set_acc(FW['attributes']['POSITION'], FP.astype(np.float32))

# ---------------- monta ----------------
mats = g.j['materials']
mats.append({'name': 'Gola', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in (CAMISA * 0.9) ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.9}})
mats.append({'name': 'Ouro', 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#E2B04A') ** 2.2] + [1.0], 'metallicFactor': 0.85, 'roughnessFactor': 0.3}})
iG, iO = len(mats) - 2, len(mats) - 1
def prim(Pv, Nv, Jv, Wv, Iv, mat_i):
    Nv = Nv / np.maximum(np.linalg.norm(Nv, axis=1, keepdims=True), 1e-6)
    return {'attributes': {
        'POSITION': g.add_acc(Pv.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(Nv.astype(np.float32), 'VEC3', 34962),
        'JOINTS_0': g.add_acc(np.asarray(Jv).astype(np.uint8 if np.asarray(Jv).max() < 256 else np.uint16), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(np.asarray(Wv).astype(np.float32), 'VEC4', 34962)},
        'indices': g.add_acc(np.asarray(Iv).reshape(-1).astype(np.uint16), 'SCALAR', 34963), 'material': mat_i}
pr_h = prim(hp, hn, np.array(hj), np.array(hw), hI, T['material'])
pr_h['attributes']['TEXCOORD_0'] = g.add_acc(hUV, 'VEC2', 34962)
g.mesh('Wolf3D_Outfit_Top')['primitives'].append(pr_h)
bm_ = g.mesh('Wolf3D_Body')['primitives']
for bp_, bn_, bj_, bw_, bi_ in bracos:
    bm_.append(prim(bp_, bn_, bj_, bw_, bi_, Bm['material']))
bm_.append(prim(cp, cn, np.array(cj), np.array(cw, np.float32), ci, iO))
for nd in g.j['nodes']:
    if nd.get('name') == 'Wolf3D_Hair':
        nd.pop('mesh', None); nd.pop('skin', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
