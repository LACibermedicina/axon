# -*- coding: utf-8 -*-
"""Desenha as figuras do site a partir do código, e não de imagens versionadas.

Roda os módulos que produzem as pranchas em giz e os gráficos do modelo, depois
converte para JPEG no tamanho que o site usa. Saída em ./saida.
"""
import os, sys, shutil, importlib, traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, "src")
BRUTO = os.environ.get("FIG_OUT", os.path.join(AQUI, "bruto"))
SAIDA = os.path.join(AQUI, "saida")
TMP = os.path.join(AQUI, ".tmp")

os.environ["FIG_OUT"] = BRUTO
os.environ["FIG_TMP"] = TMP
os.environ.setdefault("MPLBACKEND", "Agg")
for d in (BRUTO, SAIDA, TMP):
    os.makedirs(d, exist_ok=True)
MODELO = os.path.join(AQUI, "..", "modelo")
sys.path.insert(0, SRC)
if os.path.isdir(MODELO):
    sys.path.insert(0, os.path.abspath(MODELO))

# Cada módulo desenha ao ser importado.
MODULOS = ["figs_dados", "pranchas_poster", "pranchas3", "pranchas5",
           "pranchas7", "pranchas8"]

# Nome no código  ->  nome servido pelo site
USADAS = {
    "pp1_ordem_errada":       "problema",
    "pp2_duas_reguas":        "proposta",
    "f02_limiar_diametro":    "lei_escala",
    "f03_recrutamento":       "janela",
    "f05_difracao_atenuacao": "difracao",
    "p13_via_dor":            "via_dor",
    "p17_janela_terapeutica": "janela_terap",
    "p09_timeline_campo":     "timeline",
    "d02_fases":              "fases",
    "d03_cronograma":         "cronograma",
    "d07_tres_metodos":       "metodos",
    "d08_selecao_literatura": "selecao",
}
LARGURA = 1280
QUALIDADE = 82


def desenha():
    falhas = []
    for m in MODULOS:
        print(f"[figuras] {m} …", flush=True)
        try:
            importlib.import_module(m)
        except Exception:
            falhas.append(m)
            traceback.print_exc()
    return falhas


def converte():
    from PIL import Image
    feitas, faltando = 0, []
    for origem, destino in USADAS.items():
        p = os.path.join(BRUTO, origem + ".png")
        if not os.path.exists(p):
            faltando.append(origem)
            continue
        im = Image.open(p).convert("RGB")
        if im.size[0] > LARGURA:
            im = im.resize((LARGURA, round(im.size[1] * LARGURA / im.size[0])), Image.LANCZOS)
        im.save(os.path.join(SAIDA, destino + ".jpg"), "JPEG",
                quality=QUALIDADE, optimize=True, progressive=True)
        feitas += 1
    return feitas, faltando


if __name__ == "__main__":
    falhas = desenha()
    feitas, faltando = converte()
    shutil.rmtree(TMP, ignore_errors=True)
    print(f"[figuras] {feitas} de {len(USADAS)} geradas em {SAIDA}")
    if falhas:
        print("[figuras] módulos com erro:", ", ".join(falhas))
    if faltando:
        print("[figuras] não encontradas:", ", ".join(faltando))
    # O site mostra a legenda mesmo sem a imagem, então uma falha isolada não
    # derruba o build; a ausência total, sim.
    sys.exit(0 if feitas else 1)
