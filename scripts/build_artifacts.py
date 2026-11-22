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
    for rel, url in links.items():
        html = html.replace(f'href="{rel}"', f'href="{url}"')
    return html
out = root / "dist"; out.mkdir(exist_ok=True)
for src, name in [("docs/manual-usuario.html", "manual-usuario.html"), ("docs/manual-tecnico.html", "manual-tecnico.html"), ("site/index.html", "site.html"), ("frontend/index.html", "axon-standalone.html")]:
    p = root / src
    if p.exists():
        (out / name).write_text(inline(p), encoding="utf-8"); print(out / name)
