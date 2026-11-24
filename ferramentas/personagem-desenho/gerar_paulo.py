"""Gera assets/modelos/originais/paulo.glb — o Paulo, feito a partir do desenho desenho-paulo.png
(rapaz de pele morena, cabelo preto curto, sorriso largo mostrando os dentes, terno azul, camisa
branca e gravata vinho), a partir do avatar rpm-homem-a.glb (o do antigo Rafael, que já veste terno):

  * rosto: sorriso aberto (sorriso-paulo.npz = expressões "mouthSmile" e "mouthOpen" do avatar
    original já misturadas), pele morena, sobrancelhas pretas, sem bigode;
  * cabelo preto curto (pintado + "casca" de volume), sem o chapéu e o cabelo cacheado;
  * terno: a casaca vira paletó azul (sem as abas compridas), o colete vira a frente da camisa
    branca, sem gravata-borboleta, rosa e botões; gravata vinho nova; bolso no peito;
  * calça azul do terno e sapatos escuros.

Uso:  python3 ferramentas/personagem-desenho/gerar_paulo.py
Depois rode  node ferramentas/embutir-modelos.js  para atualizar a versão embutida."""
import sys, io, os, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glbio import GLB
from pintura import mapa_uv, preencher, suave, rgb2hsv, cor, blur
import numpy as np
from PIL import Image

ORIG = os.path.join(HERE, '..', '..', 'assets', 'modelos', 'originais')
SAIDA = os.path.join(ORIG, 'paulo.glb')
rng = np.random.default_rng(53)
g = GLB(os.path.join(ORIG, 'rpm-homem-a.glb'))
sk = g.j['skins'][0]
nomes = [g.j['nodes'][k]['name'] for k in sk['joints']]
JI = {n: i for i, n in enumerate(nomes)}
PELE = cor('#C27E45'); TERNO = cor('#2C4A80'); CAMISA = cor('#F3EEE2'); GRAVATA = cor('#7A1E26'); CABELO = cor('#121010')

# =====================================================================
# ROSTO
# =====================================================================
H = g.mesh('Wolf3D_Head')['primitives'][0]
P = g.acc(H['attributes']['POSITION']); N = g.acc(H['attributes']['NORMAL']); UV = g.acc(H['attributes']['TEXCOORD_0'])
SM = np.load(os.path.join(HERE, 'sorriso-paulo.npz'))
P = P + SM['Wolf3D_Head_P']
N = N + SM['Wolf3D_Head_N']; N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
H['attributes']['POSITION'] = g.add_acc(P.astype(np.float32), 'VEC3', 34962, minmax=True)
H['attributes']['NORMAL'] = g.add_acc(N.astype(np.float32), 'VEC3', 34962)
TT = g.mesh('Wolf3D_Teeth')['primitives'][0]
tP = g.acc(TT['attributes']['POSITION']) + SM['Wolf3D_Teeth_P']
tN = g.acc(TT['attributes']['NORMAL']) + SM['Wolf3D_Teeth_N']; tN = tN / np.maximum(np.linalg.norm(tN, axis=1, keepdims=True), 1e-6)
TT['attributes']['POSITION'] = g.add_acc(tP.astype(np.float32), 'VEC3', 34962, minmax=True)
TT['attributes']['NORMAL'] = g.add_acc(tN.astype(np.float32), 'VEC3', 34962)
IDX = g.acc(H['indices']).reshape(-1, 3)
x, y, z = P[:, 0], P[:, 1], P[:, 2]
ax = np.abs(x)
f = np.cos(np.arctan2(x, z - 0.02))
# cabelo curto: franja curta e reta um pouco acima da testa, laterais curtas acima das orelhas, nuca baixa
yh_frente = 1.786 + 0.004 * np.sin(x * 260) * 0.5
yh = np.where(f >= 0, 1.755 + (yh_frente - 1.755) * f ** 2, 1.755 + (1.690 - 1.755) * (-f))
ear = (ax > 0.081) & (y < 1.752) & (y > 1.64)
Fh = np.where(ear, -0.02, y - yh)
eb = ((ax - 0.037) / 0.031) ** 2 + ((y - 1.7445 + (ax - 0.037) * 0.08) / 0.0062) ** 2
Fbr = np.where(z > 0.075, (1 - eb) * 0.004, -0.01)

mi, ii = g.mat_image('Wolf3D_Skin')
skin = Image.open(io.BytesIO(g.image_bytes(ii))).convert('RGB').resize((1024, 1024), Image.LANCZOS)
W = 1024
Pm, cov = mapa_uv(UV, IDX, np.c_[P, Fh, Fbr, N[:, 2]], W)
Pm = preencher(Pm, cov)
X, Y, Z, FH, FB, NZ = [Pm[..., i] for i in range(6)]
AX = np.abs(X)
sk_ = np.asarray(skin, np.float32)
def apaga(reg, raio, q=60, fator=0.9):
    global sk_
    lum = sk_.mean(2)
    dark = reg & (lum < np.percentile(lum[cov & reg] if (cov & reg).any() else lum[cov], q) * fator)
    known = ((~dark) & cov).astype(np.float32)
    den = blur(known, raio)[..., None]
    fill = np.stack([blur(sk_[..., c] * known, raio) for c in range(3)], -1) / np.maximum(den, 1e-4)
    m = np.clip(blur(dark.astype(np.float32), 2.0) * 1.8, 0, 1)[..., None]
    sk_ = np.where(den > 0.05, sk_ * (1 - m) + fill * m, sk_)
apaga((Z > 0.06) & (Y > 1.72) & (Y < 1.772) & (AX > 0.004) & (AX < 0.088), 8, 72, 0.95)     # sobrancelhas originais
apaga((Z > 0.06) & (Y > 1.64) & (Y < 1.70) & (AX < 0.06), 10)                       # sombra do bigode
t = sk_ / 255
h, s, v = rgb2hsv(t)
vm = np.median(v[cov])
fpel = np.clip(v / vm, 0.5, 1.3) ** 0.85
labio = (Z > 0.09) & (np.hypot(X / 0.028, (Y - 1.6565) / 0.0112) < 1)
out = PELE[None, None, :] * fpel[..., None]
noise = rng.normal(0, 1, (W, W)).astype(np.float32)
fio = blur(noise, 0.7); fio = (fio - fio.min()) / (fio.max() - fio.min())
def pinta(a, c):
    global out
    a = np.clip(np.nan_to_num(a), 0, 1)[..., None]
    out = out * (1 - a) + c * a
cabc = CABELO[None, None, :] * (0.7 + 0.9 * fio[..., None])
pinta(np.clip((FH + 0.004) / 0.004, 0, 1) * (0.85 + 0.15 * fio), cabc)
pinta(np.clip((FB + 0.0012) / 0.0024, 0, 1), CABELO[None, None, :] * (0.85 + 0.4 * fio[..., None]))
skin2 = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))
buf = io.BytesIO(); skin2.save(buf, 'JPEG', quality=90); g.set_image(ii, buf.getvalue())
mb_, ib_ = g.mat_image('Wolf3D_Body')
tom = (PELE * np.median(fpel[cov & (FH < -0.03) & (Y < 1.62) & (Y > 1.56)])).clip(0, 1)
buf = io.BytesIO(); Image.new('RGB', (4, 4), tuple(int(c * 255) for c in tom)).save(buf, 'PNG'); g.set_image(ib_, buf.getvalue(), 'image/png')

# casca de volume do cabelo (mais alto em cima, rente dos lados)
J_h = g.acc(H['attributes']['JOINTS_0']); W_h = g.acc(H['attributes']['WEIGHTS_0'])
tri = IDX[(Fh[IDX] > 0.0005).all(1)]
used = np.unique(tri)
remap = -np.ones(len(P), dtype=np.int64); remap[used] = np.arange(len(used))
taper = np.clip((Fh - 0.0005) / 0.03, 0, 1) ** 1.5
d = 0.001 + (0.005 + 0.010 * np.clip((y - 1.78) / 0.05, 0, 1) * np.clip(f + 0.7, 0.3, 1)) * taper
d += (rng.random(len(P)) - 0.5) * 0.0012 * taper
Ps = P[used] + N[used] * d[used, None]
g.mesh('Wolf3D_Head')['primitives'].append({'attributes': {
    'POSITION': g.add_acc(Ps.astype(np.float32), 'VEC3', 34962, minmax=True),
    'NORMAL': g.add_acc(N[used].astype(np.float32), 'VEC3', 34962),
    'TEXCOORD_0': g.add_acc(UV[used].astype(np.float32), 'VEC2', 34962),
    'JOINTS_0': g.add_acc(J_h[used].astype(J_h.dtype), 'VEC4', 34962),
    'WEIGHTS_0': g.add_acc(W_h[used].astype(np.float32), 'VEC4', 34962)},
    'indices': g.add_acc(remap[tri].reshape(-1).astype(np.uint16), 'SCALAR', 34963), 'material': H['material']})

# =====================================================================
# TERNO
# =====================================================================
T = g.mesh('Wolf3D_Outfit_Top')['primitives'][0]
TP = g.acc(T['attributes']['POSITION']); TI = g.acc(T['indices']).reshape(-1, 3)
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
cnt = np.bincount(roots)
manter = np.zeros(len(TP), bool)
for r in np.unique(roots):
    q = TP[roots == r]; n = cnt[r]
    if n in (943, 289, 124, 88): manter[roots == r] = True   # paletó, camisa/gola, colete (vira camisa), punhos
TI = TI[manter[TI].all(1)]
principal = roots == np.argmax(cnt)
# paletó na altura do quadril: tira as abas da casaca
TI = TI[~(principal[TI].all(1) & (TP[TI][:, :, 1] < 0.925).any(1))]
T['indices'] = g.add_acc(TI.reshape(-1).astype(np.uint16), 'SCALAR', 34963)

mt, it = g.mat_image('Wolf3D_Outfit_Top')
top = Image.open(io.BytesIO(g.image_bytes(it))).convert('RGB')
TW = top.size[0]
tex0 = np.asarray(top, np.float32) / 255
TUV = g.acc(T['attributes']['TEXCOORD_0'])
Tm, tcov = mapa_uv(TUV, TI, np.c_[TP, roots.astype(np.float32)], TW)
Tm = preencher(Tm, tcov)
X, Y, Z, R = [Tm[..., i] for i in range(4)]
AX = np.abs(X)
h, s, v = rgb2hsv(tex0)
branco = (s < 0.16) & (v > 0.62)
roxo = (h > 255) & (h < 350) & (s > 0.12)
lumv = np.clip(blur(v, 1.2) / np.median(v[~branco & ~roxo]), 0.6, 1.12)
ct = TERNO[None, None, :] * lumv[..., None]
raiz_camisa = [r for r in np.unique(roots) if cnt[r] in (289, 124, 88)]
camisa_m = np.isin(np.round(R).astype(np.int64), raiz_camisa) | (branco & ~roxo)
ct = np.where((roxo & ~camisa_m)[..., None], ct * 0.82, ct)   # gola e lapelas de veludo: azul mais escuro
lc = np.clip(blur(v, 1.5) / max(np.median(v[branco]) if branco.any() else 1, 1e-3), 0.75, 1.05)
ct = np.where(camisa_m[..., None], CAMISA[None, None, :] * lc[..., None], ct)
def mix(mask, c, a=1.0):
    global ct
    a = np.clip(np.nan_to_num(mask * a), 0, 1)[..., None]
    ct = ct * (1 - a) + np.asarray(c)[None, None, :] * a
# bolso do peito (lado esquerdo dele = +x) e barra do paletó
frente = (Z > 0.05) & ~camisa_m
bx = X - 0.098; by = Y - 1.355
mix(frente, TERNO * 0.6, (np.abs(bx) < 0.034) * (np.abs(by) < 0.0035) * 0.9)
mix(frente, TERNO * 1.25, (np.abs(bx) < 0.034) * (np.abs(by - 0.004) < 0.0012) * 0.5)
mix(~camisa_m, TERNO * 0.7, np.exp(-((Y - 0.93) / 0.003) ** 2) * 0.5)
top2 = Image.fromarray((ct.clip(0, 1) * 255).astype(np.uint8))
buf = io.BytesIO(); top2.save(buf, 'JPEG', quality=90); g.set_image(it, buf.getvalue())
tm = g.j['materials'][mt]; tm.pop('normalTexture', None)
pb = tm['pbrMetallicRoughness']; pb.pop('metallicRoughnessTexture', None); pb['metallicFactor'] = 0.0; pb['roughnessFactor'] = 0.8
tm['doubleSided'] = True

# ---------------- gravata vinho ----------------
TJ = g.acc(T['attributes']['JOINTS_0']); TWt = g.acc(T['attributes']['WEIGHTS_0'])
frontais = np.unique(TI[(np.isin(roots[TI], [r for r in np.unique(roots) if cnt[r] in (289, 124)])).all(1)])
QF = TP[frontais]
def sup_z(yy):
    m = (np.abs(QF[:, 0]) < 0.012) & (np.abs(QF[:, 1] - yy) < 0.012)
    return QF[m, 2].max() if m.any() else None
ys = np.linspace(1.515, 1.12, 22)
zs = [sup_z(yy) for yy in ys]
okz = [zz for zz in zs if zz is not None]
zs = np.array([zz if zz is not None else okz[-1] for zz in zs])
for _ in range(6): zs[1:-1] = (zs[:-2] + 2 * zs[1:-1] + zs[2:]) / 4
gvP, gvN, gvJ, gvW, gvI = [], [], [], [], []
def peso(px, py, pz):
    k_ = np.argmin(np.linalg.norm(TP[frontais] - np.array([px, py, pz]), axis=1)); return TJ[frontais[k_]], TWt[frontais[k_]]
for i_, (yy, zz) in enumerate(zip(ys, zs)):
    tq = (1.515 - yy) / (1.515 - 1.12)
    w = 0.012 + 0.024 * tq if tq > 0.08 else 0.020
    for sx in (-1, 1):
        q = [sx * w, yy, zz + 0.006 + 0.004 * tq]
        gvP.append(q); gvN.append([0, 0, 1]); jj_, ww_ = peso(*q); gvJ.append(jj_); gvW.append(ww_)
# ponta
gvP.append([0.0, 1.12 - 0.03, zs[-1] + 0.01]); gvN.append([0, 0, 1]); jj_, ww_ = peso(*gvP[-1]); gvJ.append(jj_); gvW.append(ww_)
nr = len(ys)
for i_ in range(nr - 1):
    a0, a1 = 2 * i_, 2 * (i_ + 1)
    gvI += [[a0, a0 + 1, a1 + 1], [a0, a1 + 1, a1]]
tip = len(gvP) - 1
gvI += [[2 * (nr - 1), 2 * (nr - 1) + 1, tip]]
# nó: caixa logo abaixo da gola
nk = len(gvP)
c_n = np.array([0, 1.518, zs[0] + 0.012])
for dy in (-0.009, 0.009):
    for dx in (-0.013 if dy > 0 else -0.009, 0.013 if dy > 0 else 0.009):
        for dz in (-0.006, 0.005):
            q = c_n + np.array([dx, dy, dz]); gvP.append(q.tolist()); gvN.append([dx, dy, dz]); jj_, ww_ = peso(*q); gvJ.append(jj_); gvW.append(ww_)
fs = [[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]]
gvI += (np.array(fs) + nk).tolist()
gvP = np.array(gvP, np.float32); gvN = np.array(gvN, np.float32); gvI = np.array(gvI)

# ---------------- calça do terno e sapatos ----------------
def tingir_mat(nome, alvo_hex, rough, contraste=1.0):
    m_i, im_i = g.mat_image(nome)
    t_ = np.asarray(Image.open(io.BytesIO(g.image_bytes(im_i))).convert('RGB'), np.float32) / 255
    _, _, v_ = rgb2hsv(t_)
    fv = np.clip((blur(v_, 1.0) / np.median(v_) - 1) * contraste + 1, 0.55, 1.25)
    o_ = (cor(alvo_hex)[None, None, :] * fv[..., None]).clip(0, 1)
    b_ = io.BytesIO(); Image.fromarray((o_ * 255).astype(np.uint8)).save(b_, 'JPEG', quality=88); g.set_image(im_i, b_.getvalue())
    mm = g.j['materials'][m_i]; pb_ = mm['pbrMetallicRoughness']; pb_.pop('metallicRoughnessTexture', None)
    pb_['metallicFactor'] = 0.0; pb_['roughnessFactor'] = rough
tingir_mat('Wolf3D_Outfit_Bottom', '#3F63A8', 0.8)
tingir_mat('Wolf3D_Outfit_Footwear', '#231713', 0.45, 0.8)

# ---------------- monta ----------------
mats = g.j['materials']
mats.append({'name': 'Gravata', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in GRAVATA ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.55}})
iGr = len(mats) - 1
g.mesh('Wolf3D_Outfit_Top')['primitives'].append({'attributes': {
    'POSITION': g.add_acc(gvP, 'VEC3', 34962, minmax=True),
    'NORMAL': g.add_acc((gvN / np.maximum(np.linalg.norm(gvN, axis=1, keepdims=True), 1e-6)).astype(np.float32), 'VEC3', 34962),
    'JOINTS_0': g.add_acc(np.array([np.asarray(j_) for j_ in gvJ]).astype(TJ.dtype), 'VEC4', 34962),
    'WEIGHTS_0': g.add_acc(np.array([np.asarray(w_) for w_ in gvW]).astype(np.float32), 'VEC4', 34962)},
    'indices': g.add_acc(gvI.reshape(-1).astype(np.uint16), 'SCALAR', 34963), 'material': iGr})
for nd in g.j['nodes']:
    if nd.get('name') in ('Wolf3D_Beard', 'Wolf3D_Headwear'):
        nd.pop('mesh', None); nd.pop('skin', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
