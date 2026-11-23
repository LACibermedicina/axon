#!/usr/bin/env python3
"""Gera versões autocontidas (CSS/JS inline) das páginas para publicação como artefatos,
trocando os links relativos do repositório pelas URLs públicas informadas em links.json."""
import json, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent
links = json.loads((root / "dist" / "links.json").read_text()) if (root / "dist" / "links.json").exists() else {}
def inline(page: pathlib.Path) -> str:
    html = page.read_text(encoding="utf-8"); base = page.parent
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + (base / m.group(1)).read_text(encoding="utf-8") + "\n</style>", html)
    def js(m):
        f = base / m.group(1)
        if not f.exists():
            f = root / "frontend" / m.group(1).lstrip("./")
        return "<script>\n" + f.read_text(encoding="utf-8") + "\n</script>"
    html = re.sub(r'<script src="((?!https?:)[^"]+)"></script>', js, html)
    if page.parent.name == "docs":   # figuras do atlas embutidas (artefatos não servem arquivos relativos)
        import base64
        def img(m):
            f = base / m.group(1)
            return f'src="data:image/jpeg;base64,{base64.b64encode(f.read_bytes()).decode()}"' if f.exists() else m.group(0)
        html = re.sub(r'src="(img/[^"]+\.jpg)"', img, html)
    for rel, url in links.items():
        html = html.replace(f'href="{rel}"', f'href="{url}"')
    return html
out = root / "dist"; out.mkdir(exist_ok=True)
for src, name in [("docs/manual-usuario.html", "manual-usuario.html"), ("docs/manual-tecnico.html", "manual-tecnico.html"), ("site/index.html", "site.html"), ("frontend/simulador.html", "axon-standalone.html"), ("frontend/index.html", "inicio.html")]:
    p = root / src
    if p.exists():
        (out / name).write_text(inline(p), encoding="utf-8"); print(out / name)
# pacote anatômico para artefatos (que não servem .bin): base64 em .txt + manifesto apontando para eles
src_an = root / "frontend" / "anatomy"
if (src_an / "anatomy.json").exists():
    import base64, shutil
    dst = out / "anatomy"; dst.mkdir(exist_ok=True)
    man = json.loads((src_an / "anatomy.json").read_text(encoding="utf-8"))
    for k, layer in man["layers"].items():
        b = (src_an / pathlib.Path(layer["file"]).name)
        if b.suffix == ".bin":
            (dst / (b.stem + ".b64.txt")).write_text(base64.b64encode(b.read_bytes()).decode())
            layer["file"] = f"anatomy/{b.stem}.b64.txt"
    (dst / "anatomy.json").write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if (src_an / "LICENSE.txt").exists(): shutil.copy(src_an / "LICENSE.txt", dst / "LICENSE.txt")
    print(dst)
