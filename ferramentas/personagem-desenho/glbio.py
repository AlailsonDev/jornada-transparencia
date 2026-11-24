"""Minimal GLB read/write with numpy accessors."""
import json, struct, numpy as np
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
class GLB:
    def __init__(self, path):
        b = open(path, 'rb').read()
        jl = struct.unpack_from('<I', b, 12)[0]
        self.j = json.loads(b[20:20 + jl]); off = 20 + jl
        bl = struct.unpack_from('<I', b, off)[0]
        self.bin = bytearray(b[off + 8: off + 8 + bl])
    def acc(self, i):
        a = self.j['accessors'][i]; bv = self.j['bufferViews'][a['bufferView']]
        dt = CT[a['componentType']]; n = NC[a['type']]; cnt = a['count']
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
        if stride and stride != isz:
            raw = np.frombuffer(bytes(self.bin[off: off + stride * cnt]), dtype=np.uint8).reshape(cnt, stride)[:, :isz]
            arr = np.frombuffer(raw.tobytes(), dtype=dt).reshape(cnt, n)
        else:
            arr = np.frombuffer(bytes(self.bin[off: off + isz * cnt]), dtype=dt).reshape(cnt, n)
        return arr.copy() if n > 1 else arr.copy().reshape(cnt)
    def add_acc(self, arr, typ, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        ctmap = {np.dtype(np.float32): 5126, np.dtype(np.uint16): 5123, np.dtype(np.uint32): 5125, np.dtype(np.uint8): 5121}
        while len(self.bin) % 4: self.bin.append(0)
        off = len(self.bin); data = arr.tobytes(); self.bin += data
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: bv["target"] = target
        self.j['bufferViews'].append(bv)
        a = {"bufferView": len(self.j['bufferViews']) - 1, "componentType": ctmap[arr.dtype], "count": arr.shape[0], "type": typ}
        if minmax:
            a["min"] = arr.reshape(arr.shape[0], -1).min(0).tolist(); a["max"] = arr.reshape(arr.shape[0], -1).max(0).tolist()
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1
    def set_acc(self, i, arr):
        """overwrite accessor data in place (same size, tightly packed assumed)"""
        a = self.j['accessors'][i]; bv = self.j['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        data = np.ascontiguousarray(arr.astype(CT[a['componentType']])).tobytes()
        assert not bv.get('byteStride') or bv['byteStride'] == len(data) // a['count']
        self.bin[off: off + len(data)] = data
        if 'min' in a: a['min'] = arr.reshape(a['count'], -1).min(0).tolist(); a['max'] = arr.reshape(a['count'], -1).max(0).tolist()
    def image_bytes(self, img_index):
        im = self.j['images'][img_index]; bv = self.j['bufferViews'][im['bufferView']]
        return bytes(self.bin[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])
    def set_image(self, img_index, data, mime='image/jpeg'):
        while len(self.bin) % 4: self.bin.append(0)
        off = len(self.bin); self.bin += data
        self.j['bufferViews'].append({"buffer": 0, "byteOffset": off, "byteLength": len(data)})
        im = self.j['images'][img_index]; im['bufferView'] = len(self.j['bufferViews']) - 1; im['mimeType'] = mime
    def mesh(self, name):
        return next(m for m in self.j['meshes'] if m['name'] == name)
    def mat_image(self, mat_name):
        m = next(i for i, x in enumerate(self.j['materials']) if x['name'] == mat_name)
        t = self.j['materials'][m]['pbrMetallicRoughness']['baseColorTexture']['index']
        return m, self.j['textures'][t]['source']
    def save(self, path):
        while len(self.bin) % 4: self.bin.append(0)
        self.j['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(self.bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)
