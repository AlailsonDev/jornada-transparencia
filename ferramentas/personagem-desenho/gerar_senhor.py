"""Gera assets/modelos/originais/senhor-camisa.glb — personagem feito a partir do desenho
desenho-senhor.png (senhor de cabelo grisalho curto, sobrancelhas grisalhas, rugas na testa e
nos olhos, sorriso tranquilo de boca fechada, pele morena, camisa social azul-marinho de manga
comprida com gola e botões, relógio preto no pulso esquerdo), a partir do avatar rpm-homem-b.glb:

  * rosto: sorriso leve de boca fechada (sorriso-senhor.npz = expressões faciais do avatar
    original já misturadas), sem barba, rugas pintadas, pele morena;
  * cabelo curto grisalho (pintado na textura da cabeça + "casca" de volume) e sobrancelhas;
  * camisa: a bata vira camisa azul-marinho, mangas compridas até o pulso, gola, carcela e
    botões; calça social cinza-escuro e sapatos marrom-escuros;
  * relógio de pulseira preta (malha nova presa ao antebraço esquerdo).

O mesmo script gera também o Seu Lima, guarda municipal feito a partir de uma foto
(foto-seu-lima.png): pele mais escura, sorriso largo mostrando os dentes, cabelo raspado,
farda azul-marinho escura com platinas, tarjeta de nome, brasões e cinto (o boné é um
acessório do jogo).

Uso:  python3 ferramentas/personagem-desenho/gerar_senhor.py          (Seu Antônio)
      python3 ferramentas/personagem-desenho/gerar_senhor.py guarda   (Seu Lima)
Depois rode  node ferramentas/embutir-modelos.js  para atualizar a versão embutida."""
import sys, io, os, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glbio import GLB
from pintura import mapa_uv, preencher, suave, rgb2hsv, cor, blur, normais
import numpy as np
from PIL import Image, ImageFilter

ORIG = os.path.join(HERE, '..', '..', 'assets', 'modelos', 'originais')
PERFIL = sys.argv[1] if len(sys.argv) > 1 else 'senhor'
GUARDA = PERFIL == 'guarda'
PREF = PERFIL == 'prefeito'   # o Prefeito (desenho-prefeito.png): calvo, óculos, camisa social branca
SAIDA = os.path.join(ORIG, 'guarda-lima.glb' if GUARDA else 'prefeito.glb' if PREF else 'senhor-camisa.glb')
rng = np.random.default_rng(5)
g = GLB(os.path.join(ORIG, 'rpm-homem-b.glb'))
sk = g.j['skins'][0]
nomes = [g.j['nodes'][k]['name'] for k in sk['joints']]
JI = {n: i for i, n in enumerate(nomes)}
IB = g.acc(sk['inverseBindMatrices']).reshape(-1, 4, 4)
def osso(n): return np.linalg.inv(IB[JI[n]].T)[:3, 3]
PELE = cor('#C98654'); NAVY = cor('#1A2347'); CINZA_CAB = cor('#82817C')
if GUARDA:
    PELE = cor('#704329'); NAVY = cor('#10141F'); CINZA_CAB = cor('#4A4644')
C_LINHA, C_BOT, C_BOT2 = cor('#0D1328'), cor('#0A0E1E'), cor('#4A5684')
if PREF:
    PELE = cor('#C27F4A'); NAVY = cor('#EEECE7'); CINZA_CAB = cor('#2B2521')
    C_LINHA, C_BOT, C_BOT2 = cor('#B8B3AB'), cor('#F7F6F2'), cor('#A9A49C')

# =====================================================================
# ROSTO: sorriso leve, sem barba, rugas, cabelo e sobrancelhas grisalhos
# =====================================================================
H = g.mesh('Wolf3D_Head')['primitives'][0]
P = g.acc(H['attributes']['POSITION']); N = g.acc(H['attributes']['NORMAL']); UV = g.acc(H['attributes']['TEXCOORD_0'])
SM = np.load(os.path.join(HERE, 'sorriso-guarda.npz' if GUARDA else 'sorriso-senhor.npz'))
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
# linha do cabelo: entradas leves nas têmporas, laterais curtas acima das orelhas, nuca baixa
yh_frente = 1.786 + 0.006 * np.exp(-((ax - 0.045) / 0.018) ** 2)
yh = np.where(f >= 0, 1.752 + (yh_frente - 1.752) * f ** 2, 1.752 + (1.672 - 1.752) * (-f))
ear = (ax > 0.081) & (y < 1.748) & (y > 1.64)
th = np.arctan2(x, z - 0.02)
Fh = np.where(ear, -0.01, y - yh + 0.003 * np.sin(th * 31) * np.clip(f, 0, 1) ** 2)
if PREF:
    # calvo no alto e na frente; cabelo nas laterais e atrás (como no desenho), com uns fios no topo
    topo_lim = 1.797 + 0.035 * np.clip(-f, 0, 1) ** 1.5
    Fh = np.minimum(Fh, topo_lim - y)
    Fh = np.where((f > 0.62) & (y > 1.70), -0.01, Fh)
beard_top = np.where(ax < 0.02, 1.683, np.where(ax < 0.058, 1.69 + (ax - 0.02) * 0.35, 1.703 + (ax - 0.058) * 1.7))
el = (x / 0.027) ** 2 + ((y - 1.6565) / 0.0098) ** 2
eb = ((ax - 0.037) / 0.030) ** 2 + ((y - 1.7425 + (ax - 0.037) * 0.10) / (0.0058 if GUARDA else 0.0075)) ** 2   # sobrancelhas grossas
Fbr = np.where(z > 0.075, (1 - eb) * 0.004, -0.01)
Fc = np.minimum.reduce([beard_top + 0.006 - y, y - 1.55, (f + 0.45) * 0.08])
Fc = np.where(z > 0.095, np.minimum(Fc, (el - 1) * 0.006), Fc)

mi, ii = g.mat_image('Wolf3D_Skin')
skin = Image.open(io.BytesIO(g.image_bytes(ii))).convert('RGB').resize((1024, 1024), Image.LANCZOS)
W = 1024
Pm, cov = mapa_uv(UV, IDX, np.c_[P, Fh, Fbr, Fc, N[:, 2]], W)
Pm = preencher(Pm, cov)
X, Y, Z, FH, FB, FC, NZ = [Pm[..., i] for i in range(7)]
AX = np.abs(X)
sk_ = np.asarray(skin, np.float32)
# 1) tira o cavanhaque/bigode pintado: preenche com a pele ao redor
lumk = sk_.mean(2)
balpha = np.clip((FC + 0.003) / 0.003, 0, 1)
dark = (lumk < np.percentile(lumk[cov], 60) * 0.86) & (balpha > 0.05)
known = ((~dark) & cov).astype(np.float32)
den = blur(known, 14)[..., None]
skin_mean = sk_[(known > 0) & (balpha > 0.05)].mean(0)
fill = np.where(den > 0.05, np.stack([blur(sk_[..., c] * known, 14) for c in range(3)], -1) / np.maximum(den, 1e-4), skin_mean)
bm = np.clip(blur(dark.astype(np.float32), 2.5) * 1.6, 0, 1)[..., None] * (balpha[..., None] > 0.02)
bm = np.maximum(bm, 0.9 * np.clip(blur(balpha, 3), 0, 1)[..., None])     # pele lisa onde havia barba
sk_ = sk_ * (1 - bm) + fill * bm
# sobrancelhas castanhas originais: viram pele (as novas, grisalhas, são pintadas depois)
reg_br = (Z > 0.065) & (Y > 1.728) & (Y < 1.762) & (AX > 0.008) & (AX < 0.075)
lumk = sk_.mean(2)
dark_b = reg_br & (lumk < np.percentile(lumk[cov & (Z > 0.07) & (Y > 1.75) & (Y < 1.79)], 50) * 0.9)
known_b = ((~dark_b) & cov).astype(np.float32)
den_b = blur(known_b, 8)[..., None]
fill_b = np.stack([blur(sk_[..., c] * known_b, 8) for c in range(3)], -1) / np.maximum(den_b, 1e-4)
mb2 = np.clip(blur(dark_b.astype(np.float32), 1.5) * 2, 0, 1)[..., None]
sk_ = np.where(den_b > 0.05, sk_ * (1 - mb2) + fill_b * mb2, sk_)
# 2) pele morena (mesma luz e sombra; lábios ficam um pouco mais rosados)
t = sk_ / 255
h, s, v = rgb2hsv(t)
vm = np.median(v[cov])
fpel = np.clip(v / vm, 0.4, 1.4)
labio = (Z > 0.09) & (np.hypot(X / 0.026, (Y - 1.6565) / 0.0105) < 1)
alvo = PELE[None, None, :] * fpel[..., None]
alvo = np.where(labio[..., None], alvo * np.array([1.0, 0.86, 0.82]), alvo)
olho_branco = (s < 0.12) & (v > 0.75)          # nada a ver com a pele: mantém (dentes/olhos não usam esta textura, mas por segurança)
out = np.where(olho_branco[..., None], t, alvo)
# 3) rugas: testa, pés de galinha, bolsas sob os olhos e "bigode chinês" do sorriso
def risco(d, larg):
    return np.exp(-(d / larg) ** 2)
frente = (Z > 0.06) & cov
rug = np.zeros((W, W), np.float32); luz = np.zeros((W, W), np.float32)
for k, yy in enumerate(() if GUARDA else (1.768, 1.777, 1.786)):
    onda = 0.0012 * np.sin(X * 90 + k)
    larg_x = suave(0.050 - AX, 0, 0.012) * (1 - 0.3 * (k == 2))
    rug = np.maximum(rug, risco(Y - yy - onda - 0.0045 * (AX / 0.05) ** 2, 0.0008) * larg_x * (Z > 0.07))
    luz = np.maximum(luz, risco(Y - yy - onda - 0.0045 * (AX / 0.05) ** 2 + 0.0019, 0.0012) * larg_x * (Z > 0.07))
for sx in (-1, 1):
    cx, cy = sx * 0.067, 1.726
    for ang in (-25, 0, 25):
        a = math.radians(ang)
        dxp = (X - cx) * sx; dyp = Y - cy
        al = dxp * math.cos(a) + dyp * math.sin(a); pe = -dxp * math.sin(a) + dyp * math.cos(a)
        rug = np.maximum(rug, risco(pe, 0.0009) * 0.75 * suave(al, 0.002, 0.004) * suave(0.014 - al, 0, 0.004))
    # bolsa sob o olho
    bx = (X - sx * 0.036) / 0.019
    rug = np.maximum(rug, risco(Y - (1.7065 - 0.004 * (1 - bx ** 2)), 0.0008) * (np.abs(bx) < 0.85) * 0.7 * (Z > 0.07))
    # dobra do sorriso: da asa do nariz até o canto da boca
    tt = np.clip((1.692 - Y) / (1.692 - 1.652), 0, 1)
    xc = sx * (0.022 + 0.017 * tt ** 0.8)
    rug = np.maximum(rug, risco(X - xc, 0.0011) * (Y < 1.694) * (Y > 1.648) * (Z > 0.07) * (1 - 0.6 * tt))
rug = blur(rug, 0.8); out = out * (1 - 0.24 * rug[..., None]) + 0.08 * luz[..., None] * out
# 4) cabelo grisalho e sobrancelhas
F = np.maximum(FH, FB)
alpha = np.maximum(np.clip((FH + 0.0035) / 0.0025, 0, 1), np.clip((FB + 0.0012) / 0.0024, 0, 1))   # o cabelo pintado passa um pouco da casca
alpha = np.where((FB > FH) & ~cov, 0, alpha)
noise = rng.normal(0, 1, (W, W)).astype(np.float32)
from scipy import ndimage
fio = ndimage.uniform_filter1d(blur(noise, 0.6), 9, axis=0); fio = (fio - fio.min()) / (fio.max() - fio.min())
fio2 = blur(rng.normal(0, 1, (W, W)).astype(np.float32), 3); fio2 = (fio2 - fio2.min()) / (fio2.max() - fio2.min())
cab = CINZA_CAB[None, None, :] * (0.55 + 0.8 * fio[..., None]) * (0.85 + 0.3 * fio2[..., None]) * (0.8 + 0.2 * np.clip(FH / 0.02, 0, 1))[..., None]
cab = np.where((FB > FH)[..., None], cor('#5E5D5A')[None, None, :] * (0.7 + 0.6 * fio[..., None]), cab)
if GUARDA:   # cabelo raspado: só uma sombra escura (o boné cobre o alto da cabeça)
    cab = np.where((FB > FH)[..., None], cor('#1C1816')[None, None, :] * (0.8 + 0.4 * fio[..., None]), CINZA_CAB[None, None, :] * (0.7 + 0.6 * fio[..., None]))
    alpha = np.where(FB > FH, alpha * 0.9, alpha * 0.65)
if PREF:
    fT = np.cos(np.arctan2(X, Z - 0.02))
    gris = (0.08 + 0.42 * suave(fT, 0.0, 0.4) * suave(0.85 - fT, 0, 0.2)) * (0.55 + 0.45 * (fio > 0.5))
    cab = cab * (1 - gris[..., None]) + cor('#9A9893')[None, None, :] * (0.7 + 0.5 * fio[..., None]) * gris[..., None]
    cab = np.where((FB > FH)[..., None], cor('#241E1B')[None, None, :] * (0.8 + 0.5 * fio[..., None]), cab)
m = alpha[..., None]
out = out * (1 - m) + cab * m
skin2 = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))
buf = io.BytesIO(); skin2.save(buf, 'JPEG', quality=90); g.set_image(ii, buf.getvalue())
# braços/mãos/pescoço (Wolf3D_Body) no mesmo tom da pele do rosto
mb_, ib_ = g.mat_image('Wolf3D_Body')
tom = (PELE * np.median(fpel[cov & (FH < -0.01) & (Y < 1.575)])).clip(0, 1)
buf = io.BytesIO(); Image.new('RGB', (4, 4), tuple(int(c * 255) for c in tom)).save(buf, 'PNG'); g.set_image(ib_, buf.getvalue(), 'image/png')

# ---------------- casca de volume do cabelo (mais alto em cima, curto dos lados) ----------------
tri = IDX[(Fh[IDX] > 0.0005).all(1)] if not GUARDA else IDX[:0]
used = np.unique(tri)
remap = -np.ones(len(P), dtype=np.int64); remap[used] = np.arange(len(used))
taper = np.clip((Fh - 0.0005) / 0.016, 0, 1)
d = (0.0035 + 0.012 * np.clip((y - 1.78) / 0.05, 0, 1) * np.clip(f + 0.6, 0.3, 1)).astype(np.float32)
d = 0.0008 + (d - 0.0008) * taper
d += (rng.random(len(P)).astype(np.float32) - 0.5) * 0.0010 * taper
if len(tri):   # (o guarda não tem casca: cabelo raspado)
    Ps = P[used] + N[used] * d[used, None]
    J = g.acc(H['attributes']['JOINTS_0']); Wt = g.acc(H['attributes']['WEIGHTS_0'])
    attrs = {
        'POSITION': g.add_acc(Ps.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(N[used].astype(np.float32), 'VEC3', 34962),
        'TEXCOORD_0': g.add_acc(UV[used].astype(np.float32), 'VEC2', 34962),
        'JOINTS_0': g.add_acc(J[used].astype(J.dtype), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(Wt[used].astype(np.float32), 'VEC4', 34962)}
    ind = remap[tri].reshape(-1).astype(np.uint16)
    g.mesh('Wolf3D_Head')['primitives'].append({'attributes': attrs, 'indices': g.add_acc(ind, 'SCALAR', 34963), 'material': H['material']})

# =====================================================================
# CAMISA: barra, mangas compridas, sem colares
# =====================================================================
T = g.mesh('Wolf3D_Outfit_Top')['primitives'][0]
TP = g.acc(T['attributes']['POSITION'])
TI = g.acc(T['indices']).reshape(-1, 3)
# tira os colares (peças soltas)
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
main = np.bincount(roots).argmax()
TI = TI[(roots[TI] == main).all(1)]
# barra mais curta e reta (camisa por fora da calça)
low = TP[:, 1] < 1.09
r = np.hypot(TP[:, 0], TP[:, 2] - 0.005)
k = np.clip((1.09 - TP[:, 1]) / 0.1, 0, 1)
target_r = 0.172
shrink = np.where(r > target_r, (target_r + (r - target_r) * (1 - 0.95 * k)) / np.maximum(r, 1e-6), 1.0)
arm = np.abs(TP[:, 0]) > 0.24
TP2 = TP.copy()
sel = low & ~arm
TP2[sel, 0] *= shrink[sel]; TP2[sel, 2] = 0.005 + (TP[sel, 2] - 0.005) * shrink[sel]
TP2[sel, 1] = np.where(TP[sel, 1] < 1.02, 1.02 - (1.02 - TP[sel, 1]) * 0.5, TP[sel, 1])
# mangas: a manga 3/4 boca-de-sino vai até o pulso, justa no antebraço
Bm = g.mesh('Wolf3D_Body')['primitives'][0]
BP = g.acc(Bm['attributes']['POSITION'])
T0, TEND, TPULSO = 0.12, 0.549, 0.86
for lado in ('Left', 'Right'):
    a = osso(lado + 'ForeArm'); b = osso(lado + 'Hand'); L = np.linalg.norm(b - a); axv = (b - a) / L
    def proj(Q):
        tt = (Q - a) @ axv / L; rv = (Q - a) - np.outer(tt * L, axv)
        return tt, rv
    # raio do antebraço (pele) ao longo do eixo
    tb, rb_ = proj(BP); rbn = np.linalg.norm(rb_, axis=1)
    lado_b = (BP[:, 0] * a[0] > 0) & (rbn < 0.07)
    tg = np.linspace(0, 1, 21); rg = np.array([np.percentile(rbn[lado_b & (np.abs(tb - q) < 0.06)], 99) if (lado_b & (np.abs(tb - q) < 0.06)).any() else 0.04 for q in tg])
    tt, rv = proj(TP2); rn = np.linalg.norm(rv, axis=1)
    m_ = (TP2[:, 0] * a[0] > 0) & (np.abs(TP2[:, 0]) > 0.2) & (tt > T0 - 0.3)
    novo_t = np.where(tt > T0, T0 + (tt - T0) * (TPULSO - T0) / (TEND - T0), tt)
    alvo_r = np.interp(novo_t, tg, rg) + 0.012
    tipico = 0.072
    esc = 1 + (alvo_r / tipico - 1) * suave(tt, T0 - 0.15, T0 + 0.15)
    novoP = a + np.outer(novo_t * L, axv) + rv * esc[:, None]
    TP2[m_] = novoP[m_]
g.set_acc(T['attributes']['POSITION'], TP2.astype(np.float32))
YC = 1.235
if PREF:   # camisa social caindo reta: sai a faixa e a "saia" da bata; no lugar, um tubo liso (mais abaixo)
    TI = TI[~((TP2[TI][:, :, 1] < YC) & (np.abs(TP2[TI][:, :, 0]) < 0.26)).any(1)]
T['indices'] = g.add_acc(TI.reshape(-1).astype(np.uint16), 'SCALAR', 34963)

# ---------------- farda do guarda: platinas, tarjeta, brasões, bolsos e cinto ----------------
def farda():
    from PIL import ImageDraw, ImageFont
    OURO = cor('#D2A93E'); PRETO = cor('#07090E'); AMAR = cor('#E8B923')
    frente_f = (Z > 0.0) & (AX < 0.2)
    # bolsos do peito com lapela
    for sx in (-1, 1):
        dx = X * sx
        bolso = frente_f & (dx > 0.042) & (dx < 0.112) & (Y > 1.315) & (Y < 1.405)
        mix(bolso, NAVY * 1.12, 0.5)
        borda = (np.abs(dx - 0.042) < 0.0015) | (np.abs(dx - 0.112) < 0.0015) | (np.abs(Y - 1.315) < 0.0015)
        mix(frente_f & (dx > 0.04) & (dx < 0.114) & (Y > 1.313) & (Y < 1.405), PRETO, borda * 0.8)
        lap = frente_f & (dx > 0.04) & (dx < 0.114) & (Y > 1.378 - 0.01 * (1 - np.abs(dx - 0.077) / 0.037)) & (Y < 1.405)
        mix(lap, NAVY * 1.25, 0.7)
        mix(frente_f & (dx > 0.04) & (dx < 0.114), PRETO, np.exp(-((Y - (1.378 - 0.01 * (1 - np.abs(dx - 0.077) / 0.037))) / 0.0012) ** 2) * (Y < 1.40))
    # tarjeta de nome dourada no peito direito (lado -x)
    x0, x1, y0, y1 = -0.112, -0.040, 1.410, 1.432
    tar = frente_f & (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
    im = Image.new('L', (360, 110), 0); dr = ImageDraw.Draw(im)
    fnt = None
    for fp in (os.path.join(HERE, '..', '..', 'fonts', 'bricolage-grotesque-latin-800-normal.woff2'), '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        try: fnt = ImageFont.truetype(fp, 86); break
        except Exception: pass
    fnt = fnt or ImageFont.load_default()
    bb = dr.textbbox((0, 0), 'GM LIMA', font=fnt); dr.text(((360 - bb[2] - bb[0]) / 2, (110 - bb[3] - bb[1]) / 2 - 4), 'GM LIMA', fill=255, font=fnt)
    letra = np.asarray(im, np.float32) / 255
    u = np.clip(((X - x0) / (x1 - x0) * 359).astype(int), 0, 359); v_ = np.clip(((y1 - Y) / (y1 - y0) * 109).astype(int), 0, 109)
    mix(tar, OURO * 0.9)
    mix(tar, PRETO, letra[v_, u])
    mix(frente_f & (X > x0 - 0.002) & (X < x1 + 0.002) & (Y > y0 - 0.002) & (Y < y1 + 0.002) & ~tar, PRETO, 0.9)
    # brasão no peito esquerdo (+x)
    d = np.hypot((X - 0.077) / 0.017, (Y - 1.452) / 0.02)
    mix(frente_f, OURO, suave(1 - d, 0, 0.08)); mix(frente_f, cor('#1D4FA0'), suave(0.62 - d, 0, 0.08)); mix(frente_f, cor('#F2F2F2'), suave(0.25 - d, 0, 0.08))
    # platinas nos ombros, com friso amarelo
    vt_ = np.unique(TI); Q = TP2[vt_]
    bins = np.linspace(0.06, 0.22, 17)
    hmax = np.array([Q[(np.abs(np.abs(Q[:, 0]) - b) < 0.012) & (np.abs(Q[:, 2]) < 0.07), 1].max() if ((np.abs(np.abs(Q[:, 0]) - b) < 0.012) & (np.abs(Q[:, 2]) < 0.07)).any() else 1.5 for b in bins])
    zmid = np.array([Q[(np.abs(np.abs(Q[:, 0]) - b) < 0.012) & (np.abs(Q[:, 2]) < 0.07) & (Q[:, 1] > hb - 0.02), 2].mean() if ((np.abs(np.abs(Q[:, 0]) - b) < 0.012) & (np.abs(Q[:, 2]) < 0.07) & (Q[:, 1] > hb - 0.02)).any() else 0 for b, hb in zip(bins, hmax)])
    hm = np.interp(AX, bins, hmax); zm = np.interp(AX, bins, zmid)
    pla = (AX > 0.085) & (AX < 0.205) & (Y > hm - 0.03) & (np.abs(Z - zm) < 0.03)
    mix(pla, PRETO, 0.95)
    mix(pla, AMAR, suave(0.004 - np.abs(AX - 0.198), 0, 0.001))
    bt = np.hypot(AX - 0.105, Z - zm)
    mix(pla, OURO, suave(0.007 - bt, 0, 0.001))
    # brasões redondos coloridos no alto dos braços
    for lado, sx in (('Left', 1), ('Right', -1)):
        a_ = osso(lado + 'Arm'); b_ = osso(lado + 'ForeArm')
        c_ = a_ + 0.33 * (b_ - a_) + np.array([sx * 0.05, 0.0, 0.0])
        dd = np.sqrt(((Tm[..., :3] - c_) ** 2).sum(-1))
        lado_m = (X * sx > 0.15)
        mix(lado_m, OURO, suave(0.032 - dd, 0, 0.002))
        mix(lado_m, cor('#1D4FA0'), suave(0.027 - dd, 0, 0.002))
        mix(lado_m, cor('#2E9B4A'), suave(0.018 - dd, 0, 0.002) * (Tm[..., 1] < c_[1]))
        mix(lado_m, cor('#E8B923'), suave(0.018 - dd, 0, 0.002) * (Tm[..., 1] >= c_[1]))
        mix(lado_m, cor('#C8302C'), suave(0.007 - dd, 0, 0.002))
    # cinto preto com fivela (camisa por dentro da calça)
    cinto = (AX < 0.24) & (Y < 1.058)
    mix(cinto, cor('#0A0A0C'), 0.97)
    mix(cinto & (Z > 0) & (AX < 0.02) & (Y > 1.03), cor('#B9BDC4'))
    mix(cinto & (Z > 0) & (AX < 0.012) & (Y > 1.036) & (Y < 1.052), cor('#0A0A0C'))

# ---------------- textura da camisa: azul-marinho, carcela, botões, decote em V ----------------
mt, it = g.mat_image('Wolf3D_Outfit_Top')
top = Image.open(io.BytesIO(g.image_bytes(it))).convert('RGB')
TW = top.size[0]
TUV = g.acc(T['attributes']['TEXCOORD_0'])
hem_tubo = None
if PREF:
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
    hem_tubo = (hp, hn, np.array(hj), np.array(hw), hI, hUV)
tex0 = np.asarray(top, np.float32) / 255
Tm, tcov = mapa_uv(TUV, TI, TP2, TW)
Tm = preencher(Tm, tcov)
X, Y, Z = Tm[..., 0], Tm[..., 1], Tm[..., 2]
AX = np.abs(X)
lum = blur(tex0.mean(2), 6.0)
lum = np.clip(lum / np.median(lum[tcov]), 0.75, 1.2)
tecido = 1 + 0.035 * blur(rng.normal(0, 1, (TW, TW)).astype(np.float32), 0.7)
ct = NAVY[None, None, :] * (lum * tecido)[..., None]
def mix(mask, c, a=1.0):
    global ct
    a = np.clip(np.nan_to_num(mask * a), 0, 1)[..., None]
    ct = ct * (1 - a) + np.asarray(c)[None, None, :] * a
frente = (Z > 0.0) & (AX < 0.2)
# decote em V (pele) logo abaixo da gola
Vb = 1.455
vlarg = 0.034 * np.clip((Y - Vb) / (1.51 - Vb), 0, 1)
dec = frente & (Y > Vb) & (AX < vlarg)
mix(dec, cor('#0C0F18') if GUARDA else tom * np.ones(3))
mix(frente & (Y > Vb - 0.003), C_LINHA, np.exp(-((AX - vlarg) / 0.0016) ** 2) * (Y > Vb))
# carcela
mix(frente & (Y < Vb), NAVY * 1.3, (AX < 0.011) * 0.6)
mix(frente & (Y < Vb), C_LINHA, np.exp(-((AX - 0.011) / 0.0012) ** 2))
for by in np.arange(Vb - 0.03, 1.03, -0.072):
    bt = np.hypot(X, Y - by)
    mix(frente, C_BOT, suave(0.0058 - bt, 0, 0.0008))
    mix(frente, C_BOT2, np.exp(-((bt - 0.0048) / 0.0007) ** 2) * 0.6)
# punhos (no fim da manga nova) e pesponto da barra
for lado in ('Left', 'Right'):
    a = osso(lado + 'ForeArm'); b = osso(lado + 'Hand'); L = np.linalg.norm(b - a); axv = (b - a) / L
    tt = ((Tm[..., :3] - a) @ axv) / L
    ok = (X * a[0] > 0) & (AX > 0.2)
    mix(ok & (tt > TPULSO - 0.12), NAVY * 1.15, 0.6)
    mix(ok, C_LINHA, np.exp(-((tt - (TPULSO - 0.12)) / 0.006) ** 2))
mix(AX < 0.24, C_LINHA, np.exp(-((Y - 1.032) / 0.0015) ** 2) * 0.7)
if GUARDA:
    farda()
top2 = Image.fromarray((ct.clip(0, 1) * 255).astype(np.uint8))
tm = g.j['materials'][mt]
tm.pop('normalTexture', None)
pbr = tm['pbrMetallicRoughness']; pbr.pop('metallicRoughnessTexture', None)
pbr['metallicFactor'] = 0.0; pbr['roughnessFactor'] = 0.85
tm['doubleSided'] = True
buf = io.BytesIO(); top2.save(buf, 'JPEG', quality=90); g.set_image(it, buf.getvalue())

# ---------------- gola (malha nova presa ao pescoço/peito) ----------------
TJ = g.acc(T['attributes']['JOINTS_0']); TW_ = g.acc(T['attributes']['WEIGHTS_0'])
viz = TP2[np.unique(TI)]; vid = np.unique(TI)
FS = 20.0
angs = np.linspace(FS, 360 - FS, 49)
up = np.array([0, 1, 0])
gp, gn, gj, gw = [], [], [], []
for ang in angs:
    a = math.radians(ang)
    o = np.array([math.sin(a), 0, math.cos(a)])
    yb = 1.508 + (1.594 - 1.508) * (1 - math.cos(a)) / 2
    base = np.array([0.078 * math.sin(a), yb, 0.002 + 0.077 * math.cos(a)])
    dist_f = min(ang, 360 - ang)
    ponta = float(suave(np.array(FS + 28 - dist_f), 0, 28))
    s_ = base + up * 0.021 - o * 0.004
    f_ = base + up * (0.003 - 0.030 * ponta) + o * (0.020 + 0.010 * ponta)
    near = vid[np.argmin(np.linalg.norm(viz - base, axis=1))]
    for q in (base, s_, f_):
        gp.append(q); gn.append(o); gj.append(TJ[near]); gw.append(TW_[near])
gp = np.array(gp, np.float32); gn = np.array(gn, np.float32)
gI = []
nA = len(angs)
for i in range(nA - 1):
    a0, a1 = 3 * i, 3 * (i + 1)
    gI += [[a0, a1, a1 + 1], [a0, a1 + 1, a0 + 1], [a0 + 1, a1 + 1, a1 + 2], [a0 + 1, a1 + 2, a0 + 2]]
gI = np.array(gI)

# ---------------- relógio no pulso esquerdo ----------------
a = osso('LeftForeArm'); b = osso('LeftHand'); L = np.linalg.norm(b - a); axv = (b - a) / L
tb, rb_ = (BP - a) @ axv / L, None
rbn = np.linalg.norm((BP - a) - np.outer(((BP - a) @ axv), axv), axis=1)
mpul = (BP[:, 0] > 0) & (np.abs(tb - 0.93) < 0.04) & (rbn < 0.06)
r_pulso = np.percentile(rbn[mpul], 95) if mpul.any() else 0.032
c0 = a + axv * L * 0.925
dorso = np.array([1.0, 0, 0]); dorso -= axv * (dorso @ axv); dorso /= np.linalg.norm(dorso)
lat = np.cross(axv, dorso)
rp, rn_, rj, rw = [], [], [], []
NA = 24
for side in (-0.009, 0.009):
    for i in range(NA):
        ang = 2 * math.pi * i / NA
        dirr = dorso * math.cos(ang) + lat * math.sin(ang)
        rp.append(c0 + axv * side + dirr * (r_pulso + 0.004)); rn_.append(dirr)
rI = []
for i in range(NA):
    j = (i + 1) % NA
    rI += [[i, j, NA + j], [i, NA + j, NA + i]]
# mostrador: cilindro achatado sobre o dorso do pulso
nb = len(rp)
ctr = c0 + dorso * (r_pulso + 0.006)
for hgt in (0.0, 0.0055):
    for i in range(NA):
        ang = 2 * math.pi * i / NA
        q = ctr + dorso * hgt + axv * 0.0155 * math.cos(ang) + lat * 0.0155 * math.sin(ang)
        rp.append(q); rn_.append((axv * math.cos(ang) + lat * math.sin(ang)) if hgt == 0 else dorso)
for i in range(NA):
    j = (i + 1) % NA
    rI += [[nb + i, nb + j, nb + NA + j], [nb + i, nb + NA + j, nb + NA + i]]
rp.append(ctr + dorso * 0.0056); rn_.append(dorso)
cc = len(rp) - 1
for i in range(NA):
    rI.append([nb + NA + i, nb + NA + (i + 1) % NA, cc])
rp = np.array(rp, np.float32); rn_ = np.array(rn_, np.float32); rI = np.array(rI)
# vértices do topo do mostrador: cor própria (vidro escuro) via um segundo material
rj = np.tile(np.array([JI['LeftForeArm'], 0, 0, 0], np.uint8), (len(rp), 1)); rw = np.tile(np.array([1, 0, 0, 0], np.float32), (len(rp), 1))
topo = rI[-NA:]
corpo_rel = rI[:-NA]

# ---------------- calça social cinza-escuro e sapatos marrom-escuros ----------------
def tingir_mat(nome, alvo_hex, rough):
    m_i, im_i = g.mat_image(nome)
    t_ = np.asarray(Image.open(io.BytesIO(g.image_bytes(im_i))).convert('RGB'), np.float32) / 255
    _, _, v_ = rgb2hsv(t_)
    fv = np.clip(blur(v_, 1.0) / np.median(v_), 0.55, 1.25)
    o_ = (cor(alvo_hex)[None, None, :] * fv[..., None]).clip(0, 1)
    b_ = io.BytesIO(); Image.fromarray((o_ * 255).astype(np.uint8)).save(b_, 'JPEG', quality=88); g.set_image(im_i, b_.getvalue())
    mm = g.j['materials'][m_i]; pb = mm['pbrMetallicRoughness']; pb.pop('metallicRoughnessTexture', None)
    pb['metallicFactor'] = 0.0; pb['roughnessFactor'] = rough
tingir_mat('Wolf3D_Outfit_Bottom', '#171C2A' if GUARDA else '#2E333F' if PREF else '#3B3D44', 0.88)
tingir_mat('Wolf3D_Outfit_Footwear', '#0B0B0C' if GUARDA else '#1B1512' if PREF else '#3A2A20', 0.42 if GUARDA else 0.45 if PREF else 0.6)

# ---------------- Seu Lima: boné de guarda (ajustado à cabeça) e coturnos ----------------
def anel_envelope(Q, centro, ys, folga, nang=48, sel=None):
    """raio do contorno de Q (em volta de 'centro', no plano horizontal) em cada altura/ângulo"""
    R = np.zeros((len(ys), nang), np.float32)
    ang = np.arctan2(Q[:, 0] - centro[0], Q[:, 2] - centro[2]); rad = np.hypot(Q[:, 0] - centro[0], Q[:, 2] - centro[2])
    ib = ((ang + math.pi) / (2 * math.pi) * nang).astype(int) % nang
    for i, yy in enumerate(ys):
        m = np.abs(Q[:, 1] - yy) < 0.012
        if sel is not None: m &= sel
        np.maximum.at(R[i], ib[m], rad[m])
    from scipy import ndimage as _nd
    R = _nd.maximum_filter(R, size=(1, 5), mode='wrap')
    for i in range(len(ys)):   # buracos: interpola pelos vizinhos
        r = R[i]; ok = r > 0
        if ok.any() and not ok.all():
            idx = np.arange(nang); R[i] = np.interp(idx, idx[ok], r[ok], period=nang)
    R = _nd.gaussian_filter(R, (0.8, 1.5), mode=('nearest', 'wrap'))
    return R + folga
def tubo(centro_f, ys, R, juntas, pesos, nang=48, fechar_topo=False):
    """malha de tubo: anéis em ys, raio R[i, a]; centro_f(y) -> (x, z)"""
    pts, nor = [], []
    for i, yy in enumerate(ys):
        cx, cz = centro_f(yy)
        for a in range(nang):
            t_ = -math.pi + (a + 0.5) * 2 * math.pi / nang
            d_ = np.array([math.sin(t_), 0, math.cos(t_)])
            pts.append([cx + d_[0] * R[i, a], yy, cz + d_[2] * R[i, a]]); nor.append(d_)
    tri_ = []
    for i in range(len(ys) - 1):
        for a in range(nang):
            b_ = (a + 1) % nang; p0 = i * nang
            tri_ += [[p0 + a, p0 + nang + a, p0 + nang + b_], [p0 + a, p0 + nang + b_, p0 + b_]]
    n_ = len(pts)
    return np.array(pts, np.float32), np.array(nor, np.float32), np.array(tri_), np.tile(juntas, (n_, 1)), pesos(np.array(pts))
extras_lima = []
if GUARDA:
    hj = JI['Head']
    HP = g.acc(H['attributes']['POSITION'])
    hc = np.array([0.0, 0.0, 0.025])
    def yc(phi): return 1.768 + 0.018 * math.cos(phi)       # aba na testa, mais baixo atrás
    # copa: anéis da faixa até o topo, seguindo a cabeça com folga (mais cheia em cima)
    NA_ = 48
    ys_c = np.linspace(1.745, 1.842, 16)
    Rh = anel_envelope(HP, hc, ys_c, 0.0, NA_)
    cp_, cn_ = [], []
    for i, yy in enumerate(ys_c):
        for a in range(NA_):
            t_ = -math.pi + (a + 0.5) * 2 * math.pi / NA_
            y0 = yc(t_)
            # cada coluna vai de y0 (faixa) até o topo
            k_ = i / (len(ys_c) - 1)
            yy2 = y0 + (1.852 - y0) * math.sin(k_ * math.pi / 2)
            rb0 = np.interp(y0, ys_c, Rh[:, a]) + 0.009
            r2 = max(rb0 * (math.cos(k_ * math.pi / 2) ** 0.55) * (1 + 0.04 * math.sin(k_ * math.pi)), np.interp(yy2, ys_c, Rh[:, a]) + 0.007 if k_ < 0.85 else 0)
            d_ = np.array([math.sin(t_), 0, math.cos(t_)])
            cp_.append([hc[0] + d_[0] * r2, yy2, hc[2] + d_[2] * r2]); cn_.append(d_ * (1 - k_) + np.array([0, 1, 0]) * k_)
    capP = np.array(cp_, np.float32); capN = np.array(cn_, np.float32)
    capI = []
    for i in range(len(ys_c) - 1):
        for a in range(NA_):
            b_ = (a + 1) % NA_; p0 = i * NA_
            capI += [[p0 + a, p0 + NA_ + b_, p0 + NA_ + a], [p0 + a, p0 + b_, p0 + NA_ + b_]]
    # aba curva na frente
    abaP, abaN, abaI = [], [], []
    angs_ = np.linspace(-0.95, 0.95, 21)
    for t_ in angs_:
        a = int(((t_ + math.pi) / (2 * math.pi)) * NA_ - 0.5) % NA_
        d_ = np.array([math.sin(t_), 0, math.cos(t_)])
        r0 = np.interp(yc(t_), ys_c, Rh[:, a]) + 0.009
        base = np.array([hc[0] + d_[0] * r0, yc(t_), hc[2] + d_[2] * r0])
        L_ = 0.066 * math.cos(t_ / 0.95 * math.pi / 2) ** 1.6
        abaP += [base, base + d_ * L_ + np.array([0, -0.02 * (L_ / 0.066), 0])]
    abaP = np.array(abaP, np.float32); abaN = np.tile([0, 1, 0], (len(abaP), 1)).astype(np.float32)
    for i in range(len(angs_) - 1):
        a0 = 2 * i; abaI += [[a0, a0 + 1, a0 + 3], [a0, a0 + 3, a0 + 2]]
    # brasão dourado na frente da copa (disco + centro azul)
    def disco(c, n, r, nseg=18, lift=0.0):
        n = n / np.linalg.norm(n); u = np.cross(n, [0, 1, 0]); u /= np.linalg.norm(u); v_ = np.cross(u, n)
        c = c + n * lift
        P_ = [c] + [c + (u * math.cos(2 * math.pi * k / nseg) + v_ * math.sin(2 * math.pi * k / nseg)) * r for k in range(nseg)]
        I_ = [[0, 1 + k, 1 + (k + 1) % nseg] for k in range(nseg)]
        return np.array(P_, np.float32), np.tile(n, (len(P_), 1)).astype(np.float32), np.array(I_)
    i_em = 4; a_em = NA_ // 2
    pe = capP[i_em * NA_ + a_em] * 0.5 + capP[i_em * NA_ + a_em - 1] * 0.5
    ne = capN[i_em * NA_ + a_em] * 0.5 + capN[i_em * NA_ + a_em - 1] * 0.5 + np.array([0, 0.25, 0])
    em1 = disco(pe, ne, 0.0135, lift=0.004); em2 = disco(pe, ne, 0.0072, lift=0.0055)
    um = lambda n: (np.tile([hj, 0, 0, 0], (n, 1)), np.tile([1, 0, 0, 0], (n, 1)).astype(np.float32))
    COR_BONE = cor('#0E1220')
    mats_l = {'Bone': {'name': 'Bone', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in COR_BONE ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.8}},
              'Brasao': {'name': 'Brasao', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#E2B84A') ** 2.2] + [1.0], 'metallicFactor': 0.5, 'roughnessFactor': 0.35}},
              'BrasaoAzul': {'name': 'BrasaoAzul', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#1D4FA0') ** 2.2] + [1.0], 'metallicFactor': 0.1, 'roughnessFactor': 0.4}},
              'Coturno': {'name': 'Coturno', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#1B1B1E') ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.42}}}
    extras_lima += [('Wolf3D_Head', capP, capN, *um(len(capP)), np.array(capI), 'Bone'),
                    ('Wolf3D_Head', abaP, abaN, *um(len(abaP)), np.array(abaI), 'Bone'),
                    ('Wolf3D_Head', em1[0], em1[1], *um(len(em1[0])), em1[2], 'Brasao'),
                    ('Wolf3D_Head', em2[0], em2[1], *um(len(em2[0])), em2[2], 'BrasaoAzul')]
    # coturnos: cano em volta do tornozelo, por cima da barra da calça; bico arredondado
    FW = g.mesh('Wolf3D_Outfit_Footwear')['primitives'][0]
    FP = g.acc(FW['attributes']['POSITION']).copy()
    BPt = g.acc(g.mesh('Wolf3D_Outfit_Bottom')['primitives'][0]['attributes']['POSITION'])
    for lado, sx in (('Left', 1), ('Right', -1)):
        tor = osso(lado + 'Foot'); joe = osso(lado + 'Leg')
        ladoF = FP[:, 0] * sx > 0
        zt = osso(lado + 'ToeBase')[2] + 0.05
        bico = ladoF & (FP[:, 2] > zt)
        FP[bico, 2] = zt + (FP[bico, 2] - zt) * 0.8
        FP[bico, 1] = np.minimum(FP[bico, 1], 0.072 - (FP[bico, 2] - zt) * 0.35)
        ys_b = np.linspace(0.035, 0.30, 16)
        def cf(yy, tor=tor, joe=joe):
            k_ = (yy - tor[1]) / (joe[1] - tor[1]); k_ = max(k_, 0)
            return tor[0] + (joe[0] - tor[0]) * k_, tor[2] + (joe[2] - tor[2]) * k_
        cx0, cz0 = cf(0.15)
        Q = np.vstack([FP[ladoF & (FP[:, 2] < tor[2] + 0.075)], BPt[BPt[:, 0] * sx > 0], BP[(BP[:, 0] * sx > 0) & (BP[:, 1] < 0.32)]])
        Rb = anel_envelope(Q, np.array([cx0, 0, cz0]), ys_b, 0.007, 48, sel=np.hypot(Q[:, 0] - cx0, Q[:, 2] - cz0) < 0.13)
        # embaixo o cano avança sobre o peito do pé (cobre a pele que o sapato original deixava à mostra)
        Q2 = np.vstack([FP[ladoF & (FP[:, 2] < tor[2] + 0.14)], BPt[BPt[:, 0] * sx > 0], BP[(BP[:, 0] * sx > 0) & (BP[:, 1] < 0.32)]])
        Rb2 = anel_envelope(Q2, np.array([cx0, 0, cz0]), ys_b, 0.006, 48, sel=np.hypot(Q2[:, 0] - cx0, Q2[:, 2] - cz0) < 0.2)
        mist = suave(ys_b, 0.13, 0.08)[:, None]
        Rb = Rb * (1 - mist) + np.maximum(Rb, Rb2) * mist
        Rb = np.maximum(Rb, 0.05)
        for i in range(len(ys_b) - 2, -1, -1):   # cano reto: não afina para cima
            Rb[i + 1] = np.maximum(Rb[i + 1], Rb[i] * 0.0 + np.minimum(Rb[i + 1], Rb[i]))
        jl, jf = JI[lado + 'Leg'], JI[lado + 'Foot']
        def pesos(pts, jl=jl, jf=jf, tor=tor):
            w = suave(pts[:, 1], tor[1] - 0.02, tor[1] + 0.06)
            return np.c_[w, 1 - w, np.zeros(len(pts)), np.zeros(len(pts))].astype(np.float32)
        bp, bn, bi, bj, bw = tubo(lambda yy: cf(yy), ys_b, Rb, [jl, jf, 0, 0], pesos)
        extras_lima.append(('Wolf3D_Outfit_Footwear', bp, bn, bj, bw, bi, 'Coturno'))
        # reforço na boca do cano
        Rt = Rb[-2:].copy() + 0.004
        tp, tn, ti, tj, tw = tubo(lambda yy: cf(yy), np.array([0.285, 0.305]), Rt, [jl, jf, 0, 0], lambda p: np.tile([1, 0, 0, 0], (len(p), 1)).astype(np.float32))
        extras_lima.append(('Wolf3D_Outfit_Footwear', tp, tn, tj, tw, ti, 'Coturno'))
    g.set_acc(FW['attributes']['POSITION'], FP.astype(np.float32))
    # pés (pele) dentro dos coturnos: saem, para a pele não aparecer na abertura do calçado
    BI = g.acc(Bm['indices']).reshape(-1, 3)
    BI = BI[~(BP[BI][:, :, 1] < 0.29).all(1)]
    Bm['indices'] = g.add_acc(BI.reshape(-1).astype(np.uint16), 'SCALAR', 34963)

oculos = None
if PREF:
    # sapato social: bico arredondado em vez do bico curvado do avatar
    FW = g.mesh('Wolf3D_Outfit_Footwear')['primitives'][0]
    FP = g.acc(FW['attributes']['POSITION']).copy()
    for lado, sx in (('Left', 1), ('Right', -1)):
        ladoF = FP[:, 0] * sx > 0
        zt = osso(lado + 'ToeBase')[2] + 0.05
        bico = ladoF & (FP[:, 2] > zt)
        FP[bico, 2] = zt + (FP[bico, 2] - zt) * 0.8
        FP[bico, 1] = np.minimum(FP[bico, 1], 0.072 - (FP[bico, 2] - zt) * 0.35)
    FW['attributes']['POSITION'] = g.add_acc(FP.astype(np.float32), 'VEC3', 34962, minmax=True)
    # óculos de armação fina e retangular (aros, ponte e hastes até as orelhas)
    def zfrente(px, py):
        m_ = (np.abs(P[:, 0] - px) < 0.008) & (np.abs(P[:, 1] - py) < 0.008) & (P[:, 2] > 0.03)
        return P[m_, 2].max() if m_.any() else 0.1
    zl = max(zfrente(0.031, 1.722), zfrente(0.031, 1.735)) + 0.011
    opP, opI = [], []
    def tubo_pts(pts, r=0.00155, fechado=False, ns=6):
        pts = np.asarray(pts, float)
        if fechado: pts = np.vstack([pts, pts[:1]])
        b0 = len(opP)
        for i_ in range(len(pts)):
            d_ = pts[min(i_ + 1, len(pts) - 1)] - pts[max(i_ - 1, 0)]; d_ /= max(np.linalg.norm(d_), 1e-9)
            u_ = np.cross(d_, [0, 0, 1.0]); u_ = u_ / np.linalg.norm(u_) if np.linalg.norm(u_) > 1e-6 else np.array([0, 1, 0.0]); v_ = np.cross(d_, u_)
            for k_ in range(ns):
                an = 2 * math.pi * k_ / ns; opP.append(pts[i_] + (u_ * math.cos(an) + v_ * math.sin(an)) * r)
        for i_ in range(len(pts) - 1):
            for k_ in range(ns):
                k2 = (k_ + 1) % ns; p0 = b0 + i_ * ns
                opI.extend([[p0 + k_, p0 + ns + k_, p0 + ns + k2], [p0 + k_, p0 + ns + k2, p0 + k2]])
    for sx in (-1, 1):
        cx_, cy_, hw_, hh_, rr_ = sx * 0.0325, 1.7225, 0.0235, 0.0128, 0.004
        aro = []
        for qx, qy, a0 in ((hw_ - rr_, hh_ - rr_, 0), (-(hw_ - rr_), hh_ - rr_, 90), (-(hw_ - rr_), -(hh_ - rr_), 180), (hw_ - rr_, -(hh_ - rr_), 270)):
            for a_ in np.linspace(a0, a0 + 90, 5):
                ar = math.radians(a_); px = cx_ + qx + rr_ * math.cos(ar); py = cy_ + qy + rr_ * math.sin(ar)
                aro.append([px, py, zl - 0.010 * ((abs(px) - 0.01) / 0.05) ** 2])
        tubo_pts(aro, fechado=True)
        # haste: da borda de fora até a orelha
        x0 = sx * (0.0325 + 0.0235); zx0 = zl - 0.010 * ((abs(x0) - 0.01) / 0.05) ** 2
        tubo_pts([[x0, 1.728, zx0], [sx * 0.071, 1.728, zx0 - 0.02], [sx * 0.079, 1.724, -0.005], [sx * 0.078, 1.712, -0.022]], r=0.0014)
    tubo_pts([[-0.009, 1.729, zl + 0.001], [0, 1.731, zl + 0.002], [0.009, 1.729, zl + 0.001]], r=0.0013)   # ponte
    opP = np.array(opP, np.float32); opI = np.array(opI)
    opN = opP - np.array([0, 1.72, 0.0]); opN[:, 1] *= 0.3
    oculos = (opP, opN, np.tile([JI['Head'], 0, 0, 0], (len(opP), 1)), np.tile([1.0, 0, 0, 0], (len(opP), 1)), opI)

# ---------------- monta ----------------
mats = g.j['materials']
# (baseColorFactor é linear; as texturas são sRGB: por isso o ** 2.2)
mats.append({'name': 'Gola', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in (NAVY * 0.95) ** 2.2] + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}})
mats.append({'name': 'Relogio', 'pbrMetallicRoughness': {'baseColorFactor': [0.035, 0.035, 0.04, 1], 'metallicFactor': 0.2, 'roughnessFactor': 0.5}})
mats.append({'name': 'Mostrador', 'pbrMetallicRoughness': {'baseColorFactor': [0.09, 0.09, 0.1, 1], 'metallicFactor': 0.1, 'roughnessFactor': 0.25}})
iG, iR, iM = len(mats) - 3, len(mats) - 2, len(mats) - 1
def prim(Pv, Nv, Jv, Wv, Iv, mat_i):
    Nv = Nv / np.maximum(np.linalg.norm(Nv, axis=1, keepdims=True), 1e-6)
    return {'attributes': {
        'POSITION': g.add_acc(Pv.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(Nv.astype(np.float32), 'VEC3', 34962),
        'JOINTS_0': g.add_acc(np.asarray(Jv).astype(np.uint8 if np.asarray(Jv).max() < 256 else np.uint16), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(np.asarray(Wv).astype(np.float32), 'VEC4', 34962)},
        'indices': g.add_acc(np.asarray(Iv).reshape(-1).astype(np.uint16), 'SCALAR', 34963), 'material': mat_i}
g.mesh('Wolf3D_Outfit_Top')['primitives'].append(prim(gp, gn, np.array(gj), np.array(gw), gI, iG))
bm_ = g.mesh('Wolf3D_Body')['primitives']
if not GUARDA:
    bm_.append(prim(rp, rn_, rj, rw, corpo_rel, iR))
    bm_.append(prim(rp, rn_, rj, rw, topo, iM))
else:
    idx_m = {}
    for nome_m, md in mats_l.items():
        mats.append(md); idx_m[nome_m] = len(mats) - 1
    for malha, Pv, Nv, Jv, Wv, Iv, nm in extras_lima:
        g.mesh(malha)['primitives'].append(prim(Pv, Nv, Jv, Wv, Iv, idx_m[nm]))
if hem_tubo is not None:
    pr_h = prim(*hem_tubo[:5], T['material'])
    pr_h['attributes']['TEXCOORD_0'] = g.add_acc(hem_tubo[5], 'VEC2', 34962)
    g.mesh('Wolf3D_Outfit_Top')['primitives'].append(pr_h)
if oculos is not None:
    mats.append({'name': 'Oculos', 'pbrMetallicRoughness': {'baseColorFactor': [float(c) for c in cor('#2C2420') ** 2.2] + [1.0], 'metallicFactor': 0.5, 'roughnessFactor': 0.35}})
    g.mesh('Wolf3D_Head')['primitives'].append(prim(*oculos, len(mats) - 1))
# sem o cabelo comprido do avatar
for nd in g.j['nodes']:
    if nd.get('name') == 'Wolf3D_Hair':
        nd.pop('mesh', None); nd.pop('skin', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, 'enxugar_glb.py'), tmp, SAIDA, '1024'], check=True)
os.remove(tmp)
print('ok', SAIDA)
