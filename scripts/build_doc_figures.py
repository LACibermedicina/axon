#!/usr/bin/env python3
"""Figuras anatômicas da documentação: render hiper-realista do simulador + camada esquemática.

1. Capturas (PNG com fundo transparente + âncoras projetadas em JSON):
     cd frontend && python3 -m http.server 8765 &
     OUT=/tmp/cap node scripts/doc_capture/cap.js
2. Este script compõe cada PNG sobre um fundo de estúdio, grava docs/img/anat/<id>.jpg e
   insere/atualiza nos manuais os blocos <figure class="anat" data-id="<id>"> com a camada
   SVG (rótulos, linhas de chamada, numeração, cores por tipo) e a legenda.
     python3 scripts/build_doc_figures.py [/tmp/cap]
"""
import html
import json
import math
import pathlib
import re
import sys

from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cap")
OUT = ROOT / "docs" / "img" / "anat"
W, H = 1600, 1000

COL = {"nerve": "#ffd166", "muscle": "#ff9a5c", "point": "#ff6fa8", "organ": "#c99bff", "auto": "#6ee7a8",
       "axon": "#e08cff", "derm": "#7fe3ff", "label": "#e9f6f8"}
GNAME = {"nerve": "nervo", "muscle": "músculo", "point": "ponto reflexo", "organ": "órgão", "auto": "autonômico",
         "axon": "axônio / placa motora", "derm": "dermátomo", "label": "estrutura"}

FIG = {
    "corpo": ("Nível 1 · corpo inteiro com pele realista",
              "Malha BodyParts3D com pele opaca (tom do fototipo, brilho e espalhamento aproximado). A camada esquemática sobrepõe o mapa de dermátomos calculado por vértice e marca o centro de cada faixa.",
              "corpo-derm"),
    "perna": ("Membro inferior direito: músculos, nervos e o axônio motor até a placa",
              "Profundidade “Músculos”: pele quase transparente, músculos, vasos e trajetos nervosos (em amarelo os nervos do plexo lombossacral). Em lilás, o prolongamento do axônio α da raiz L5 pelo nervo fibular até a placa motora do tibial anterior, traçado pelo preditor morfométrico.",
              None),
    "braco": ("Membro superior direito: plexo braquial e nervos terminais",
              "Plexo braquial e nervos mediano, ulnar, radial e musculocutâneo destacados sobre a musculatura; acupontos PC6 e LI4 sobre os respectivos trajetos.",
              None),
    "tronco": ("Tronco: vísceras, vago e cadeia simpática",
               "Profundidade “Vísceras e nervos”: sem pele e sem músculos. Vago e tronco simpático na cor autonômica; nervos intercostais segmentares; zonas de Head ativas.",
               None),
    "cabeca": ("Cabeça em perfil: trigêmeo, facial e ramo auricular do vago",
               "Ramos V1, V2 e V3 do trigêmeo, nervo facial e ramo auricular do vago destacados; músculos da mastigação e esternocleidomastoideo; marcadores de pontos auriculares e acupontos.",
               None),
    "nivel2": ("Nível 2 · região: camadas teciduais sob o eletrodo",
               "Epiderme, derme com papilas e capilares, hipoderme com lóbulos adiposos, fáscia e músculo estriado, com o eletrodo de superfície e o feixe neurovascular.",
               None),
    "nivel3": ("Nível 3 · fascículo com calibres previstos para o paciente",
               "Corte do nervo com epineuro, perineuro em lamelas e endoneuro. A composição e o calibre das fibras seguem o preditor morfométrico (Aα lilás, Aβ azul, Aγ verde-água, Aδ laranja); fibras recrutadas brilham.",
               None),
    "nivel4": ("Nível 4 · nó de Ranvier e condução saltatória",
               "Mielina compacta com lamelas, paranodo, nó com canais NaV agrupados, célula de Schwann e potencial de ação saltando de nó em nó.",
               None),
    "nivel5": ("Nível 5 · membrana e canais iônicos",
               "Bicamada fosfolipídica com colesterol e canais NaV, Piezo2, TRPV1 e TRAAK; íons atravessando cada canal.",
               None),
}
# onde inserir cada figura (manual, âncora antes da qual entra o bloco do atlas)
PLACE = {
    "docs/manual-usuario.html": (["corpo", "perna", "braco", "tronco", "cabeca", "nivel2", "nivel3", "nivel4", "nivel5"], '<section id="mesa">'),
    "docs/manual-tecnico.html": (["perna", "nivel3", "tronco"], '<section id="v09">'),
}


def studio():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - W * .5) / W, (y - H * .42) / H)
            t = min(1.0, d * 1.45)
            px[x, y] = (int(40 * (1 - t) + 8 * t), int(62 * (1 - t) + 15 * t), int(70 * (1 - t) + 19 * t))
    return bg


def compose(fid, bg):
    im = Image.open(SRC / f"{fid}.png").convert("RGBA")
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    a = im.split()[3].filter(ImageFilter.GaussianBlur(14))
    shadow.putalpha(a.point(lambda v: int(v * .45)))
    out = bg.copy().convert("RGBA")
    out.alpha_composite(shadow, (0, 10))
    out.alpha_composite(im)
    out.convert("RGB").save(OUT / f"{fid}.jpg", quality=86, optimize=True, progressive=True)


def layout(anns):
    vis = [a for a in anns if a.get("vis")]
    for i, a in enumerate(vis):
        a["n"] = i + 1
    left = sorted([a for a in vis if a["x"] < W / 2], key=lambda a: a["y"])
    right = sorted([a for a in vis if a["x"] >= W / 2], key=lambda a: a["y"])
    gap = 50
    for col in (left, right):
        ys = [min(H - 40, max(40, a["y"])) for a in col]
        for _ in range(200):
            moved = False
            for i in range(1, len(ys)):
                if ys[i] - ys[i - 1] < gap:
                    d = (gap - (ys[i] - ys[i - 1])) / 2
                    ys[i - 1] -= d
                    ys[i] += d
                    moved = True
            ys = [min(H - 30, max(30, y)) for y in ys]
            if not moved:
                break
        for a, y in zip(col, ys):
            a["ly"] = y
    for a in left:
        a["side"] = "l"
    for a in right:
        a["side"] = "r"
    return vis


def svg(fid, anns):
    vis = layout(anns)
    out = [f'<svg class="anat-sv" viewBox="0 0 {W} {H}" aria-hidden="true">']
    for a in vis:
        c = COL.get(a.get("g"), "#fff")
        txt = a["t"] if len(a["t"]) <= 52 else a["t"][:50] + "…"
        tw = len(txt) * 11.6 + 52
        if a["side"] == "l":
            lx, ex = 36, 36 + tw
        else:
            lx, ex = W - 36 - tw, W - 36 - tw
        ey = a["ly"]
        elbow = ex + 26 if a["side"] == "l" else ex - 26
        out.append(f'<g class="ac" style="--c:{c}"><path d="M{a["x"]:.0f},{a["y"]:.0f} L{elbow:.0f},{ey:.0f} L{ex:.0f},{ey:.0f}" class="ld"/>'
                   f'<circle cx="{a["x"]:.0f}" cy="{a["y"]:.0f}" r="7" class="an"/><circle cx="{a["x"]:.0f}" cy="{a["y"]:.0f}" r="15" class="ar"/>'
                   f'<rect x="{lx:.0f}" y="{ey - 19:.0f}" width="{tw:.0f}" height="38" rx="19" class="lb"/>'
                   f'<circle cx="{lx + 20:.0f}" cy="{ey:.0f}" r="13" class="nb"/><text x="{lx + 20:.0f}" y="{ey + 6:.0f}" class="nt">{a["n"]}</text>'
                   f'<text x="{lx + 42:.0f}" y="{ey + 7:.0f}" class="tx">{html.escape(txt)}</text></g>')
    out.append("</svg>")
    return "".join(out), vis


def figure(fid, base="img/anat/"):
    anns = json.loads((SRC / f"{fid}.json").read_text())
    title, cap, ov = FIG[fid]
    s, vis = svg(fid, anns)
    groups = sorted({a.get("g") for a in vis})
    leg = " ".join(f'<span><i style="background:{COL[g]}"></i>{GNAME[g]}</span>' for g in groups if g in COL)
    ovimg = f'<img class="anat-ov" src="{base}{ov}.jpg" alt="" loading="lazy">' if ov else ""
    return (f'<figure class="anat" data-id="{fid}"><input type="checkbox" class="anat-cb" id="anat-{fid}" checked>'
            f'<div class="anat-st"><img src="{base}{fid}.jpg" alt="{html.escape(title)}" loading="lazy">{ovimg}{s}</div>'
            f'<figcaption><div class="anat-h"><b>{html.escape(title)}</b><label for="anat-{fid}" class="anat-tg">camada esquemática</label></div>'
            f'<p>{html.escape(cap)}</p><div class="anat-lg">{leg}<span class="tag t-mod">CAPTURA DO SIMULADOR</span><span class="tag t-pre">ANATOMIA BODYPARTS3D · TRAJETOS NERVOSOS: PREMISSA DIDÁTICA</span></div></figcaption></figure>')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bg = studio()
    ids = set(FIG) | {v[2] for v in FIG.values() if v[2]}
    for fid in sorted(ids):
        compose(fid, bg)
        print("img", fid)
    for page, (ids, anchor) in PLACE.items():
        p = ROOT / page
        t = p.read_text(encoding="utf-8")
        t = re.sub(r'\n?<section id="atlas">.*?</section>\n', "\n", t, flags=re.S)
        intro = ("Capturas em alta resolução do próprio simulador, com a camada esquemática sobreposta: números, linhas de chamada e cores por tipo de estrutura. "
                 "Use “camada esquemática” para ver a imagem limpa.") if "usuario" in page else \
                "Capturas geradas por <span class=\"mono\">scripts/doc_capture/cap.js</span> (Playwright, câmera e âncoras 3D projetadas) e compostas por <span class=\"mono\">scripts/build_doc_figures.py</span>."
        block = (f'<section id="atlas">\n  <h2>Atlas visual: anatomia renderizada com camada esquemática</h2>\n  <p class="lead">{intro}</p>\n  '
                 + "\n  ".join(figure(i) for i in ids) + "\n</section>\n")
        t = t.replace(anchor, block + anchor, 1)
        if 'href="#atlas"' not in t:
            t = re.sub(r'(<nav class="toc"[^>]*>.*?<div class="grp">[^<]*</div>)', r'\1<a href="#atlas">Atlas visual</a>', t, count=1, flags=re.S)
        p.write_text(t, encoding="utf-8")
        print("doc", page, len(ids))


if __name__ == "__main__":
    main()
