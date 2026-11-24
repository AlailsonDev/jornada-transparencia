"""Recorta o cartaz da porta da foto da Ouvidoria (foto-ouvidoria.jpg), corrige a
perspectiva, salva em assets/texturas/ouvidoria-porta.jpg e embute todas as
texturas de assets/texturas/ em assets/texturas/js/texturas.js (data:), para o
jogo funcionar também aberto direto do computador (file://).
Uso (na pasta do projeto):  python3 ferramentas/ouvidoria/gerar_texturas.py"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
import base64, json

R = Path(__file__).resolve().parents[2]
im = Image.open(R / "ferramentas/ouvidoria/foto-ouvidoria.jpg").convert("RGB")
# vidro da porta, por dentro do caixilho: cantos (sup. esq., inf. esq., inf. dir., sup. dir.)
quad = (358, 705, 357, 1136, 541, 1135, 541, 705)
porta = im.transform((384, 900), Image.QUAD, quad, Image.BICUBIC)
porta = porta.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
porta = ImageEnhance.Color(porta).enhance(1.1)
(R / "assets/texturas").mkdir(exist_ok=True)
porta.save(R / "assets/texturas/ouvidoria-porta.jpg", quality=88)

emb = {}
for f in sorted((R / "assets/texturas").glob("*.jpg")):
    emb[f"assets/texturas/{f.name}"] = "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
(R / "assets/texturas/js").mkdir(exist_ok=True)
(R / "assets/texturas/js/texturas.js").write_text(
    "/* Texturas embutidas (data:) para funcionar também abrindo o index.html direto (file://).\n"
    " * Gerado por ferramentas/ouvidoria/gerar_texturas.py a partir de assets/texturas/*.jpg. */\n"
    "window.CT_TEXTURAS_EMBUTIDAS=" + json.dumps(emb) + ";\n")
print("ok:", list(emb))
