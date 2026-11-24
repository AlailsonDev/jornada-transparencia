"""Gera assets/modelos/originais/corrupson.glb — o monstro "Corrupson", modelado a partir do
desenho desenho-corrupson.jpg: corpo grande e peludo, preto, com tufos espetados no alto,
olhos amarelos zangados, boca aberta com contorno amarelo, presas brancas e língua vermelha,
braços compridos com mãos de garras e pernas curtas.

A malha é nova e fica presa ao esqueleto do robô do chefe (robot.glb, RobotExpressive, CC0),
por isso o Corrupson usa as MESMAS animações do chefe (Idle, Dance, Death, No, Wave...).

Uso:  python3 ferramentas/corrupson/gerar_corrupson.py
Depois rode  node ferramentas/embutir-modelos.js"""
import sys, os, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'personagem-desenho'))
from glbio import GLB
from pintura import normais, suave
import numpy as np

ORIG = os.path.join(HERE, '..', '..', 'assets', 'modelos', 'originais')
SAIDA = os.path.join(ORIG, 'corrupson.glb')
rng = np.random.default_rng(7)
g = GLB(os.path.join(ORIG, 'robot.glb'))
NODES = g.j['nodes']

# ---------------- pose de repouso do esqueleto (matrizes de mundo) ----------------
def trs(n):
    M = np.eye(4)
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M[:3, :3] = R * np.array(s); M[:3, 3] = t
    return M
WM = {}
def walk(i, Pm):
    WM[i] = Pm @ trs(NODES[i])
    for c in NODES[i].get('children', []): walk(c, WM[i])
raiz = g.j['scenes'][0]['nodes'][0]
walk(raiz, np.eye(4))
joints = g.j['skins'][0]['joints']
JN = {NODES[k]['name']: ji for ji, k in enumerate(joints)}
def pos(nome): return WM[joints[JN[nome]]][:3, 3].copy()

# ---------------- utilidades de malha ----------------
partes = []   # (P, I, pesos{nome: w array}, material)
def grade(F, nu, nv, fechar_u=True):
    """superfície paramétrica F(u, v) -> pontos; u em volta (0..1), v ao longo (0..1)"""
    us = np.linspace(0, 1, nu, endpoint=not fechar_u); vs = np.linspace(0, 1, nv)
    U, V = np.meshgrid(us, vs)
    P = F(U, V).reshape(-1, 3)
    I = []
    cols = nu if fechar_u else nu - 1
    for j in range(nv - 1):
        for i in range(cols):
            a = j * nu + i; b = j * nu + (i + 1) % nu; c = (j + 1) * nu + (i + 1) % nu; d = (j + 1) * nu + i
            I += [[a, c, b], [a, d, c]]
    return P, np.array(I), U.reshape(-1), V.reshape(-1)
def pelo(U, V, freq_u, freq_v, semente):
    """pelagem espetada: dentes irregulares (silhueta serrilhada, como no desenho)"""
    r = np.random.default_rng(semente)
    ph = r.random(8) * 6.28
    n = (np.sin(U * 2 * np.pi * freq_u + ph[0] + 2.2 * np.sin(V * 9 + ph[1])) * 0.5
         + np.sin(U * 2 * np.pi * freq_u * 2.3 + ph[2] + V * 17) * 0.3
         + np.sin(V * 2 * np.pi * freq_v + ph[3] + U * 11) * 0.2)
    return np.clip(n, 0, None) ** 2.2
def peso_seg(P, a, b, raio):
    """peso por distância a um segmento de osso"""
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    d = np.linalg.norm(P - (a + np.outer(t, ab)), axis=1)
    return np.exp(-(d / raio) ** 2)

# ---------------- corpo: bloco peludo (cabeça e tronco juntos, como no desenho) ----------------
CY, RY = 2.33, 1.52       # centro e meia-altura do corpo
def corpo_raio(th):       # largura ao longo da altura: um pouco mais largo embaixo
    return 1.0 + 0.08 * np.sin(th) + 0.06 * (th / np.pi)
def F_corpo(U, V):
    ph = U * 2 * np.pi; th = V * np.pi       # th: 0 = topo, pi = base
    e = 0.62                                 # expoente < 1: formato "quadradão" arredondado
    sy = np.sign(np.cos(th)) * np.abs(np.cos(th)) ** e
    sr = np.abs(np.sin(th)) ** e
    rx = 1.12 * corpo_raio(th); rz = 0.86 * corpo_raio(th)
    x = sr * np.sin(ph) * rx; z = sr * np.cos(ph) * rz - 0.06; y = CY + sy * RY
    return np.stack([x, y, z], -1)
NU, NV = 120, 72
P, I, U, V = grade(F_corpo, NU, NV)
Nn = normais(P, I)
# a pelagem: forte nas laterais/costas/topo, quase lisa no rosto (onde vão olhos e boca)
ph = U * 2 * np.pi
frente = np.cos(ph)
rosto = suave(frente, 0.55, 0.85) * suave(V, 0.12, 0.2) * suave(0.62 - V, 0, 0.08)
amp = 0.20 * (1 - 0.92 * rosto) * suave(V, 0.02, 0.1)
f = pelo(U, V, 26, 9, 1)
P = P + Nn * (amp * f)[:, None] + np.array([0, -1, 0]) * (amp * f * 0.35)[:, None]   # fios caindo para baixo
# franjas embaixo: a barra do pelo fica serrilhada
base = V > 0.9
P[base, 1] -= 0.18 * pelo(U[base], V[base], 19, 3, 2)
OS = {n: pos(n) for n in ['Hips', 'Abdomen', 'Torso', 'Neck', 'Head']}
def pesos_corpo(Q):
    alt = {'Hips': 1.2, 'Abdomen': 1.62, 'Torso': 2.12, 'Neck': 2.7, 'Head': 3.3}
    w = {k: np.exp(-((Q[:, 1] - alt[k]) / 0.42) ** 2) for k in alt}
    return w
partes.append((P, I, pesos_corpo(P), 'pelo'))

# ---------------- tufos espetados no alto da cabeça ----------------
def cone(base_c, dirv, comp, raio, curva, n=10, seg=6, ponta=1.3, redondo=False):
    dirv = dirv / np.linalg.norm(dirv)
    u = np.cross(dirv, [0, 0, 1.0]); u = u / (np.linalg.norm(u) + 1e-9); w_ = np.cross(dirv, u)
    pts = []
    for s in range(seg + 1):
        t = s / seg
        c = base_c + dirv * comp * t + curva * comp * t * t
        r = raio * (np.sqrt(max(1 - t * t, 0)) if redondo else (1 - t) ** ponta)
        if redondo: r = raio * (1.0 if t < 0.6 else math.sqrt(max(0.0, 1 - ((t - 0.6) / 0.4) ** 2)))
        for k in range(n):
            a = 2 * math.pi * k / n
            pts.append(c + (u * math.cos(a) + w_ * math.sin(a)) * r)
    I_ = []
    for s in range(seg):
        for k in range(n):
            a = s * n + k; b = s * n + (k + 1) % n; c = (s + 1) * n + (k + 1) % n; d = (s + 1) * n + k
            I_ += [[a, b, c], [a, c, d]]
    return np.array(pts), np.array(I_)
TOPO = CY + RY
tufos = [  # (x, inclinação lateral, comprimento, raio)
    (-0.45, -0.5, 1.0, 0.3), (0.08, 0.15, 0.85, 0.26), (0.48, 0.55, 1.0, 0.3),
    (-0.85, -1.05, 0.7, 0.26), (0.85, 1.05, 0.7, 0.26), (-0.2, -0.2, 0.6, 0.2), (0.28, 0.32, 0.6, 0.2),
]
for (tx, incl, comp, raio) in tufos:
    by = TOPO - 0.3 - 0.35 * (abs(tx) / 0.9) ** 2
    bc = np.array([tx, by, -0.08])
    d_ = np.array([math.sin(incl), math.cos(incl), 0.0])
    curva = np.array([math.sin(incl) * 0.5, -0.15, 0])
    Pc, Ic = cone(bc, d_, comp, raio, curva, ponta=1.8)
    partes.append((Pc, Ic, {'Head': np.ones(len(Pc))}, 'pelo'))
# tufos laterais nos "ombros" (como no desenho)
for sx in (-1, 1):
    for k, (yy, ang, comp) in enumerate(((2.75, 0.75, 0.7), (2.45, 0.95, 0.6))):
        bc = np.array([sx * 0.95, yy, -0.1])
        d_ = np.array([sx * math.sin(ang), math.cos(ang), 0.0])
        Pc, Ic = cone(bc, d_, comp, 0.26, np.array([sx * 0.25, 0.1, 0]), ponta=1.8)
        partes.append((Pc, Ic, {'Torso': np.full(len(Pc), 0.6), 'Neck': np.full(len(Pc), 0.4)}, 'pelo'))

# ---------------- braços compridos, mãos com garras ----------------
def tubo_osso(pts_osso, raios, nomes, nu=28, nv=24, semente=3, pelo_amp=0.13):
    """tubo peludo ao longo de uma cadeia de ossos"""
    seg_len = [np.linalg.norm(pts_osso[i + 1] - pts_osso[i]) for i in range(len(pts_osso) - 1)]
    L = sum(seg_len); cum = np.concatenate([[0], np.cumsum(seg_len)]) / L
    def F(Uu, Vv):
        out = np.zeros(Uu.shape + (3,))
        for idx in np.ndindex(Uu.shape):
            t = Vv[idx]; k = min(np.searchsorted(cum, t, side='right') - 1, len(seg_len) - 1)
            lt = (t - cum[k]) / (cum[k + 1] - cum[k])
            a, b = pts_osso[k], pts_osso[k + 1]
            c = a + (b - a) * lt
            dv = (b - a) / np.linalg.norm(b - a)
            u = np.cross(dv, [0, 0, 1.0]); u /= np.linalg.norm(u) + 1e-9; w_ = np.cross(dv, u)
            r = np.interp(t, np.linspace(0, 1, len(raios)), raios)
            ang = Uu[idx] * 2 * np.pi
            out[idx] = c + (u * np.cos(ang) + w_ * np.sin(ang)) * r
        return out
    Pt, It, Ut, Vt = grade(F, nu, nv)
    Nt = normais(Pt, It)
    ft = pelo(Ut, Vt, 9, 6, semente) * suave(Vt, 0.05, 0.15) * suave(0.97 - Vt, 0, 0.08)
    Pt = Pt + Nt * (pelo_amp * ft)[:, None] + np.array([0, -1, 0]) * (pelo_amp * 0.5 * ft)[:, None]
    w = {}
    for i in range(len(pts_osso) - 1):
        w[nomes[i]] = w.get(nomes[i], 0) + peso_seg(Pt, pts_osso[i], pts_osso[i + 1], 0.35)
    return Pt, It, w
for lado in ('L', 'R'):
    sh = pos('UpperArm.' + lado); el = pos('LowerArm.' + lado); wr = pos('Palm2.' + lado)
    ombro = sh + np.array([0, 0.12, 0])
    Pa, Ia, wa = tubo_osso([ombro, el, wr], [0.36, 0.3, 0.27, 0.25], ['UpperArm.' + lado, 'LowerArm.' + lado], semente=4 if lado == 'L' else 5)
    partes.append((Pa, Ia, wa, 'pelo'))
    # mão: palma achatada + 4 dedos compridos terminando em garra
    dirm = wr - el; dirm /= np.linalg.norm(dirm)
    Pm_, Im_, _, _ = grade(lambda Uu, Vv: wr + np.stack([np.sin(Vv * np.pi) * np.cos(Uu * 2 * np.pi) * 0.27, np.cos(Vv * np.pi) * 0.25, np.sin(Vv * np.pi) * np.sin(Uu * 2 * np.pi) * 0.2], -1) + dirm * 0.12, 18, 12)
    partes.append((Pm_, Im_, {'Palm2.' + lado: np.ones(len(Pm_))}, 'pelo'))
    lat = np.cross(dirm, [0, 1, 0.0]); lat /= np.linalg.norm(lat) + 1e-9
    for k, off in enumerate((-0.17, -0.06, 0.06, 0.17)):
        b0 = wr + dirm * 0.25 + lat * off
        Pd, Id = cone(b0, dirm + lat * off * 0.6 + np.array([0, -0.35, 0]), 0.42 + (0.07 if abs(off) < 0.1 else 0), 0.095, np.array([0, -0.1, 0]), redondo=True)
        partes.append((Pd, Id, {'Palm2.' + lado: np.ones(len(Pd))}, 'pelo'))

# ---------------- pernas curtas e pés grandes ----------------
for lado in ('L', 'R'):
    ul = pos('UpperLeg.' + lado); ll = pos('LowerLeg.' + lado)
    fj = WM[joints[JN['Foot.' + lado]]][:3, 3]
    tor = ll + (np.array([ll[0], 0.32, ll[2]]) - ll) * 1.0
    Pl, Il, wl = tubo_osso([ul, ll, tor], [0.42, 0.38, 0.34], ['UpperLeg.' + lado, 'LowerLeg.' + lado], semente=8 if lado == 'L' else 9, pelo_amp=0.1)
    partes.append((Pl, Il, wl, 'pelo'))
    # pé: meia esfera achatada, apontando para a frente
    cpe = np.array([tor[0], 0.16, tor[2] + 0.16])
    Pf, If_, _, _ = grade(lambda Uu, Vv: cpe + np.stack([np.sin(Vv * np.pi) * np.cos(Uu * 2 * np.pi) * 0.36, np.cos(Vv * np.pi) * 0.2, np.sin(Vv * np.pi) * np.sin(Uu * 2 * np.pi) * 0.5], -1), 22, 12)
    Pf[:, 1] = np.maximum(Pf[:, 1], 0.0)
    partes.append((Pf, If_, {'Foot.' + lado: np.ones(len(Pf))}, 'pelo'))

# ---------------- rosto: olhos zangados e boca com presas (decalques sobre o corpo) ----------------
def z_frente(x, y):
    """z da frente do corpo (sem pelo) para (x, y), resolvendo a superfície"""
    best = None
    th = np.linspace(0.02, np.pi - 0.02, 900); ph_ = np.linspace(-1.2, 1.2, 241)
    TH, PH = np.meshgrid(th, ph_)
    S = F_corpo(PH / (2 * np.pi) % 1.0, TH / np.pi)
    d = (S[..., 0] - x) ** 2 + (S[..., 1] - y) ** 2
    i = np.unravel_index(np.argmin(d), d.shape)
    return S[i][2]
ZF = {}
def decal(mask_fn, x0, x1, y0, y1, eps, mat, n=70):
    xs = np.linspace(x0, x1, n); ys = np.linspace(y0, y1, n)
    X, Y = np.meshgrid(xs, ys)
    key = (round(x0, 3), round(x1, 3), round(y0, 3), round(y1, 3))
    if key not in ZF:
        zc = np.array([[z_frente(x, y) for x in xs[::7]] for y in ys[::7]])
        from scipy.interpolate import RectBivariateSpline
        ZF[key] = RectBivariateSpline(ys[::7], xs[::7], zc, kx=2, ky=2)
    Z = ZF[key](ys, xs) + eps
    Pd = np.stack([X, Y, Z], -1).reshape(-1, 3)
    M = mask_fn(X, Y).reshape(-1)
    I_ = []
    for j in range(n - 1):
        for i in range(n - 1):
            a = j * n + i; b = a + 1; c = a + n + 1; d = a + n
            if M[a] and M[b] and M[c] and M[d]: I_ += [[a, b, c], [a, c, d]]
    I_ = np.array(I_)
    used = np.unique(I_); remap = -np.ones(len(Pd), int); remap[used] = np.arange(len(used))
    Pd = Pd[used]; I_ = remap[I_]
    partes.append((Pd, I_, pesos_corpo(Pd), mat))
EY, EX, ER = 3.08, 0.36, 0.205
for sx in (-1, 1):
    cx = sx * EX
    def cut(X, Y, cx=cx, sx=sx):   # sobrancelha zangada: alta do lado de fora, baixa no meio
        return Y < EY + 0.085 + 0.45 * (X - cx) * sx
    decal(lambda X, Y, cx=cx: (np.hypot(X - cx, Y - EY) < ER) & cut(X, Y), cx - 0.25, cx + 0.25, EY - 0.25, EY + 0.25, 0.012, 'amarelo')
    pcx, pcy = cx + sx * -0.01, EY + 0.025
    decal(lambda X, Y, pcx=pcx, pcy=pcy: (np.hypot(X - pcx, Y - pcy) < 0.135) & cut(X, Y), cx - 0.25, cx + 0.25, EY - 0.25, EY + 0.25, 0.02, 'preto')
    hx = cx - sx * 0.06
    decal(lambda X, Y, hx=hx: (np.hypot(X - hx, Y - (EY + 0.02)) < 0.028) | (np.hypot(X - (hx - sx * 0.045), Y - (EY - 0.01)) < 0.014), cx - 0.25, cx + 0.25, EY - 0.25, EY + 0.25, 0.028, 'branco')
# boca: retângulo arredondado, mais alto do lado direito da imagem
MY, MW, MH = 2.6, 0.27, 0.2
def caixa(X, Y, inset):
    h = MH * (1 + 0.18 * (X / MW)) - inset; w = MW - inset; top_inc = 0.1 * (X / MW)
    yy = Y - MY - top_inc * 0.5
    r = 0.09
    qx = np.maximum(np.abs(X) - (w - r), 0); qy = np.maximum(np.abs(yy) - (h - r), 0)
    return np.hypot(qx, qy) < r
decal(lambda X, Y: caixa(X, Y, 0), -0.4, 0.4, MY - 0.35, MY + 0.4, 0.012, 'amarelo')
decal(lambda X, Y: caixa(X, Y, 0.045), -0.4, 0.4, MY - 0.35, MY + 0.4, 0.02, 'boca')
def presas(X, Y):
    m = np.zeros_like(X, bool)
    topo = MY + (MH - 0.045) * (1 + 0.18 * (X / MW)) + 0.1 * (X / MW) * 0.5
    for k in range(5):
        cxk = -0.17 + k * 0.085 + 0.01
        larg = 0.036
        comp = 0.12 + 0.02 * (k % 2)
        dy = topo - Y
        m |= (dy > 0) & (dy < comp) & (np.abs(X - cxk) < larg * (1 - dy / comp))
    return m & caixa(X, Y, 0.045)
decal(presas, -0.4, 0.4, MY - 0.35, MY + 0.4, 0.028, 'branco')
def lingua(X, Y):
    fundo = MY - (MH - 0.045) * (1 + 0.18 * (X / MW)) + 0.1 * (X / MW) * 0.5
    topo_l = fundo + 0.12 - 0.035 * np.exp(-(X / 0.04) ** 2) + 0.02 * np.abs(X) / MW
    return (Y < topo_l) & caixa(X, Y, 0.045)
decal(lingua, -0.4, 0.4, MY - 0.35, MY + 0.4, 0.028, 'vermelho')

# =====================================================================
# MONTA O GLB: uma malha só, presa ao esqueleto do robô
# =====================================================================
MATS = {'pelo': ('#161517', 0.92, 0, True), 'amarelo': ('#FFD12E', 0.45, 0.35, True), 'preto': ('#121113', 0.95, 0, True),
        'branco': ('#FFFFFF', 0.35, 0.15, True), 'vermelho': ('#E8404B', 0.45, 0.1, True), 'boca': ('#120607', 0.6, 0, True)}
def lin(hexa):
    c = np.array([int(hexa[i:i + 2], 16) for i in (1, 3, 5)]) / 255
    return [float(x) for x in c ** 2.2]
g.j['materials'] = []
mi = {}
for k, (hx, rough, emis, ds) in MATS.items():
    m = {'name': k, 'doubleSided': ds, 'pbrMetallicRoughness': {'baseColorFactor': lin(hx) + [1.0], 'metallicFactor': 0.0, 'roughnessFactor': rough}}
    if emis: m['emissiveFactor'] = [float(x * emis) for x in lin(hx)]
    g.j['materials'].append(m); mi[k] = len(g.j['materials']) - 1
Wroot = WM[raiz]; Winv = np.linalg.inv(Wroot)
prims = []
porm = {}
for P_, I_, w_, mat in partes:
    porm.setdefault(mat, []).append((P_, I_, w_))
for mat, lst in porm.items():
    Ps, Is, Js, Ws = [], [], [], []
    off = 0
    for P_, I_, w_ in lst:
        n = len(P_)
        nomes = list(w_.keys())
        Wm = np.stack([np.broadcast_to(np.asarray(w_[k], float), (n,)) for k in nomes], 1)
        o = np.argsort(-Wm, 1)[:, :4]
        Jm = np.array([[JN[nomes[c]] for c in row] for row in o]) if len(nomes) >= 4 else None
        if Jm is None:
            pad = 4 - len(nomes)
            Wm = np.c_[Wm, np.zeros((n, pad))]; o = np.argsort(-Wm, 1)[:, :4]
            Jm = np.array([[JN[nomes[c]] if c < len(nomes) else 0 for c in row] for row in o])
        Wt = np.take_along_axis(Wm, o, 1); Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
        Ps.append(P_); Is.append(I_ + off); Js.append(Jm); Ws.append(Wt); off += n
    P_ = np.vstack(Ps); I_ = np.vstack(Is); J_ = np.vstack(Js); W_ = np.vstack(Ws)
    PL = (np.c_[P_, np.ones(len(P_))] @ Winv.T)[:, :3]
    NL = normais(PL, I_)
    prims.append({'attributes': {
        'POSITION': g.add_acc(PL.astype(np.float32), 'VEC3', 34962, minmax=True),
        'NORMAL': g.add_acc(NL.astype(np.float32), 'VEC3', 34962),
        'JOINTS_0': g.add_acc(J_.astype(np.uint8), 'VEC4', 34962),
        'WEIGHTS_0': g.add_acc(W_.astype(np.float32), 'VEC4', 34962)},
        'indices': g.add_acc(I_.reshape(-1).astype(np.uint32 if len(P_) > 65000 else np.uint16), 'SCALAR', 34963), 'material': mi[mat]})
    print(mat, len(P_), 'vértices')
IBM = np.stack([np.linalg.inv(WM[k]).T for k in joints]).astype(np.float32)
g.j['skins'] = [{'name': 'Corrupson', 'joints': joints, 'inverseBindMatrices': g.add_acc(IBM.reshape(-1, 16), 'MAT4'), 'skeleton': joints[0]}]
g.j['meshes'] = [{'name': 'Corrupson', 'primitives': prims}]
for n in NODES:
    n.pop('mesh', None); n.pop('skin', None)
NODES.append({'name': 'Corrupson', 'mesh': 0, 'skin': 0})
NODES[raiz].setdefault('children', []).append(len(NODES) - 1)
for a in g.j['animations']:   # sem as expressões do rosto do robô (malha removida)
    keep = [c for c in a['channels'] if c['target']['path'] != 'weights']
    used = {c['sampler'] for c in keep}
    remap = {}; samp = []
    for i, s in enumerate(a['samplers']):
        if i in used: remap[i] = len(samp); samp.append(s)
    for c in keep: c['sampler'] = remap[c['sampler']]
    a['channels'] = keep; a['samplers'] = samp
g.j.pop('textures', None); g.j.pop('images', None); g.j.pop('samplers', None)
tmp = SAIDA + '.tmp.glb'
g.save(tmp)
subprocess.run([sys.executable, os.path.join(HERE, '..', 'personagem-desenho', 'enxugar_glb.py'), tmp, SAIDA, '512'], check=True)
os.remove(tmp)
print('ok', SAIDA)
