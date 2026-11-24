"""Enxuga um GLB: tira morph targets, regrava as texturas em JPEG (tamanho máximo) e remove dados não usados.
Uso: python3 enxugar_glb.py entrada.glb saida.glb [tamanho_max_textura]"""
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
maxsz = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
jlen = struct.unpack_from('<I', b, 12)[0]
j = json.loads(b[20:20 + jlen]); off = 20 + jlen
blen = struct.unpack_from('<I', b, off)[0]; bin_ = b[off + 8: off + 8 + blen]
for m in j.get('meshes', []):
    m.pop('weights', None)
    if 'extras' in m: m['extras'].pop('targetNames', None)
    for p in m['primitives']: p.pop('targets', None)
# referenced accessors
used = set()
for m in j.get('meshes', []):
    for p in m['primitives']:
        used.update(p['attributes'].values())
        if 'indices' in p: used.add(p['indices'])
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
for a in j.get('animations', []):
    for sm in a['samplers']: used.update([sm['input'], sm['output']])
acc_map = {}; new_acc = []
for i, a in enumerate(j['accessors']):
    if i in used: acc_map[i] = len(new_acc); new_acc.append(a)
j['accessors'] = new_acc
for m in j.get('meshes', []):
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
for a in j.get('animations', []):
    for sm in a['samplers']: sm['input'] = acc_map[sm['input']]; sm['output'] = acc_map[sm['output']]
used_bv = {a['bufferView'] for a in new_acc if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im}
bv_map = {}; new_bvs = []; new_bin = bytearray()
img_by_bv = {im['bufferView']: im for im in j.get('images', []) if 'bufferView' in im}
for i, bv in enumerate(j['bufferViews']):
    if i not in used_bv: continue
    data = bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    if i in img_by_bv:
        im = Image.open(io.BytesIO(data))
        if max(im.size) > maxsz:
            sc = maxsz / max(im.size); im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
        if im.mode in ('RGBA', 'LA') and img_by_bv[i].get('mimeType') == 'image/png':   # com transparência: continua PNG
            o = io.BytesIO(); im.save(o, 'PNG', optimize=True); data = o.getvalue()
        else:
            o = io.BytesIO(); im.convert('RGB').save(o, 'JPEG', quality=86, optimize=True); data = o.getvalue()
            img_by_bv[i]['mimeType'] = 'image/jpeg'
    while len(new_bin) % 4: new_bin.append(0)
    nb = dict(bv); nb['byteOffset'] = len(new_bin); nb['byteLength'] = len(data)
    bv_map[i] = len(new_bvs); new_bvs.append(nb); new_bin += data
while len(new_bin) % 4: new_bin.append(0)
j['bufferViews'] = new_bvs
for a in j['accessors']:
    if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
for im in j.get('images', []):
    if 'bufferView' in im: im['bufferView'] = bv_map[im['bufferView']]
j['buffers'][0]['byteLength'] = len(new_bin)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(new_bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(new_bin), 0x004E4942) + bytes(new_bin)
open(dst, 'wb').write(out); print(dst, len(b), '->', len(out))
