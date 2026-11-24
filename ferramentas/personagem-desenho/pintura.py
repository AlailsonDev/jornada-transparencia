"""Ferramentas de pintura em espaço UV usadas pelos geradores de personagens.

mapa_uv(): rasteriza a malha no espaço da textura e devolve, para cada texel,
um atributo interpolado dos vértices (posição 3D, normal, id de peça...).
Assim a pintura é decidida pela posição no corpo (ex.: "acima do quadril e
na frente do peito"), não pela forma das ilhas de UV."""
import numpy as np
from scipy import ndimage


def mapa_uv(UV, IDX, attr, W, tri_ok=None):
    """attr: (n, k) por vértice -> (W, W, k) por texel + máscara de cobertura."""
    attr = np.asarray(attr, np.float32)
    if attr.ndim == 1: attr = attr[:, None]
    k = attr.shape[1]
    out = np.zeros((W, W, k), np.float32); cov = np.zeros((W, W), bool)
    for ti, t in enumerate(IDX):
        if tri_ok is not None and not tri_ok[ti]: continue
        U = UV[t] * W
        u0, v0 = np.maximum(np.floor(U.min(0)).astype(int), 0); u1, v1 = np.minimum(np.ceil(U.max(0)).astype(int), W - 1)
        if u1 < u0 or v1 < v0: continue
        uu, vv = np.meshgrid(np.arange(u0, u1 + 1) + 0.5, np.arange(v0, v1 + 1) + 0.5)
        M = np.array([[U[1, 0] - U[0, 0], U[2, 0] - U[0, 0]], [U[1, 1] - U[0, 1], U[2, 1] - U[0, 1]]])
        if abs(np.linalg.det(M)) < 1e-12: continue
        rel = np.stack([uu - U[0, 0], vv - U[0, 1]], -1) @ np.linalg.inv(M).T
        b1, b2 = rel[..., 0], rel[..., 1]; b0 = 1 - b1 - b2
        ins = (b0 >= -0.02) & (b1 >= -0.02) & (b2 >= -0.02)
        if not ins.any(): continue
        val = b0[..., None] * attr[t[0]] + b1[..., None] * attr[t[1]] + b2[..., None] * attr[t[2]]
        ys, xs = (vv - 0.5).astype(int), (uu - 0.5).astype(int)
        out[ys[ins], xs[ins]] = val[ins]; cov[ys[ins], xs[ins]] = True
    return out, cov


def preencher(arr, cov):
    """copia para os texels não cobertos o valor do texel coberto mais próximo
    (evita costuras escuras nas bordas das ilhas de UV)."""
    idx = ndimage.distance_transform_edt(~cov, return_distances=False, return_indices=True)
    return arr[idx[0], idx[1]]


def suave(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rgb2hsv(a):
    """a: (..., 3) em 0..1 -> h (graus), s, v"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx


def cor(hexa):
    hexa = hexa.lstrip('#')
    return np.array([int(hexa[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def blur(a, r):
    """desfoque gaussiano (FFT, bordas circulares)"""
    hh, ww = a.shape
    fy = np.fft.fftfreq(hh)[:, None]; fx = np.fft.rfftfreq(ww)[None, :]
    k = np.exp(-2 * (np.pi * r) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * k, s=a.shape).astype(np.float32)


def normais(P, IDX):
    n = np.zeros_like(P, dtype=np.float64)
    a, b, c = P[IDX[:, 0]], P[IDX[:, 1]], P[IDX[:, 2]]
    fn = np.cross(b - a, c - a)
    for i in range(3): np.add.at(n, IDX[:, i], fn)
    return (n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)).astype(np.float32)
