#!/usr/bin/env python3
"""Gera dist/axon-standalone.html: um único arquivo (CSS/JS inline), Three.js r128 via cdnjs.
Uso: python3 scripts/build_standalone.py  — útil para demonstração offline (Decisão 6 do livro)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "frontend"
html = (root / "index.html").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="css/axon.css">', "<style>\n" + (root / "css/axon.css").read_text(encoding="utf-8") + "\n</style>")
def inline(m):
    src = m.group(1)
    return "<script>\n" + (root / src).read_text(encoding="utf-8") + "\n</script>"
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = root.parent / "dist" / "axon-standalone.html"
out.parent.mkdir(exist_ok=True); out.write_text(html, encoding="utf-8")
print(out, len(html))
