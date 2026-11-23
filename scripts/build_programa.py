"""Gera frontend/js/programa.js a partir de research/conteudo-programa.json (conteúdo do programa de pesquisa)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "research" / "conteudo-programa.json").read_text(encoding="utf-8"))
out = root / "frontend" / "js" / "programa.js"
out.write_text("/* gerado por scripts/build_programa.py a partir de research/conteudo-programa.json — não editar */\nwindow.AXON_PROGRAMA=" + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(out)
