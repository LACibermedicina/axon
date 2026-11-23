#!/usr/bin/env python3
"""Pacote completo para download: axon-<versão>.zip

  fonte/    código-fonte do commit atual (git archive): backend, frontend, docs, research, scripts, infra
  offline/  simulador, portal e manuais autocontidos + anatomia + three.js local (abre com servir.sh/.bat)
  LEIA-ME.txt, SHA256SUMS.txt

Uso: python3 scripts/build_package.py [repo_git] [saida]
Não inclui .env, chaves, tokens nem dados de inscritos (o portal sai só com o conteúdo-semente).
"""
import base64
import hashlib
import io
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
GIT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
OUTDIR = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "dist"
V = (ROOT / "VERSION").read_text().strip()
NAME = f"axon-{V}"
STAGE = pathlib.Path("/tmp") / f"pkg-{NAME}" / NAME
CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
LOCAL = {"./": "inicio.html", "../": "inicio.html", "../#novidades": "inicio.html#novidades", "./#novidades": "inicio.html#novidades",
         "simulador.html": "simulador.html", "../simulador.html": "simulador.html", "./simulador.html": "simulador.html",
         "docs/manual-usuario.html": "manual-usuario.html", "../docs/manual-usuario.html": "manual-usuario.html",
         "docs/manual-tecnico.html": "manual-tecnico.html", "../docs/manual-tecnico.html": "manual-tecnico.html",
         "manual-usuario.html": "manual-usuario.html", "manual-tecnico.html": "manual-tecnico.html"}
FORBID = re.compile(r"(^|/)\.env($|\.)(?!example)|id_rsa|\.pem$|axon_deploy|subscribers|secrets?\.json", re.I)


def inline(page: pathlib.Path) -> str:
    html = page.read_text(encoding="utf-8")
    base = page.parent
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + (base / m.group(1)).read_text(encoding="utf-8") + "\n</style>", html)

    def js(m):
        f = base / m.group(1)
        if not f.exists():
            f = ROOT / "frontend" / m.group(1).lstrip("./")
        return "<script>\n" + f.read_text(encoding="utf-8") + "\n</script>"
    html = re.sub(r'<script src="((?!https?:)[^"]+)"></script>', js, html)
    html = html.replace(f'<script src="{CDN}"></script>', '<script src="vendor/three.min.js"></script>')

    def img(m):
        f = base / m.group(1)
        return f'src="data:image/jpeg;base64,{base64.b64encode(f.read_bytes()).decode()}"' if f.exists() else m.group(0)
    html = re.sub(r'src="(img/[^"]+\.jpg)"', img, html)
    for rel, loc in LOCAL.items():
        html = html.replace(f'href="{rel}"', f'href="{loc}"')
    return html


def main():
    if STAGE.parent.exists():
        shutil.rmtree(STAGE.parent)
    (STAGE / "fonte").mkdir(parents=True)
    # 1. fonte (só arquivos versionados)
    tar = subprocess.run(["git", "-C", str(GIT), "archive", "--format=tar", "HEAD"], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        bad = [m.name for m in t.getmembers() if FORBID.search(m.name)]
        if bad:
            sys.exit(f"arquivos sensíveis no repositório, pacote não gerado: {bad}")
        t.extractall(STAGE / "fonte", filter="data")
    sha = subprocess.run(["git", "-C", str(GIT), "rev-parse", "--short", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    # 2. offline
    off = STAGE / "offline"
    (off / "vendor").mkdir(parents=True)
    for src, name in [("frontend/simulador.html", "simulador.html"), ("frontend/index.html", "inicio.html"),
                      ("docs/manual-usuario.html", "manual-usuario.html"), ("docs/manual-tecnico.html", "manual-tecnico.html")]:
        (off / name).write_text(inline(ROOT / src), encoding="utf-8")
    shutil.copy(ROOT / "frontend/vendor/three.min.js", off / "vendor")
    shutil.copy(ROOT / "frontend/vendor/LICENSE-three.txt", off / "vendor")
    shutil.copy(ROOT / "frontend/release.json", off)
    for d in ("img", "data"):
        if (ROOT / "frontend" / d).exists():
            shutil.copytree(ROOT / "frontend" / d, off / d)
    shutil.copytree(ROOT / "frontend/anatomy", off / "anatomy")   # .bin + manifesto (servidos por http.server)
    (off / "index.html").write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=inicio.html"><a href="inicio.html">axon</a>', encoding="utf-8")
    (off / "servir.sh").write_text('#!/bin/sh\n# abre o axon offline em http://localhost:8080\ncd "$(dirname "$0")"\n'
                                   '( sleep 1; (xdg-open http://localhost:8080/simulador.html || open http://localhost:8080/simulador.html) >/dev/null 2>&1 ) &\n'
                                   'python3 -m http.server 8080 --bind 127.0.0.1\n', encoding="utf-8")
    (off / "servir.sh").chmod(0o755)
    (off / "servir.bat").write_text('@echo off\r\nrem abre o axon offline em http://localhost:8080\r\ncd /d "%~dp0"\r\n'
                                    'start "" http://localhost:8080/simulador.html\r\npython -m http.server 8080 --bind 127.0.0.1\r\n', encoding="utf-8")
    # 3. leia-me
    (STAGE / "LEIA-ME.txt").write_text(f"""axon {V} · commit {sha}
Simulação biofísica multiescala da neuromodulação (in silico).
Ferramenta de pesquisa, ensino e modelagem — NÃO é dispositivo médico nem protocolo clínico.

CONTEÚDO
  offline/   pronto para usar, sem instalar nada além do Python 3
             simulador.html · inicio.html (portal) · manual-usuario.html · manual-tecnico.html
             anatomy/ (BodyParts3D, CC BY-SA 2.1 JP) · vendor/three.min.js (MIT)
  fonte/     código-fonte completo: backend (FastAPI + núcleo verificado + 43 testes),
             frontend, docs (com atlas visual), research, scripts de instalação e build, infra

USAR OFFLINE
  Linux/macOS:  sh offline/servir.sh
  Windows:      offline\\servir.bat   (clique duas vezes)
  Depois abra http://localhost:8080/simulador.html
  Os navegadores não leem a anatomia direto do disco (file://); por isso o pequeno servidor local.
  Sem a API, a IA (Axon Bot, tradução da tela, paciente por texto, justificativa do plano) fica em modo local.

RODAR COMPLETO (com API e IA)
  cd fonte/backend && pip install -r requirements-dev.txt && python -m pytest -q
  uvicorn app.main:app --port 8000
  cd ../frontend && python3 -m http.server 8080
  Chaves de IA: copie fonte/.env.example para .env e preencha (nunca publique o .env).

IMPLANTAR NA VPS
  sudo bash fonte/scripts/setup_vps.sh seu@email /caminho/deploy.pub
  Detalhes: offline/manual-tecnico.html (seções Infraestrutura e CI/CD).

Verifique a integridade com SHA256SUMS.txt.
""", encoding="utf-8")
    # 4. somas
    lines = []
    for f in sorted(STAGE.rglob("*")):
        if f.is_file():
            lines.append(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(STAGE)}")
    (STAGE / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    # 5. zip
    OUTDIR.mkdir(parents=True, exist_ok=True)
    zp = OUTDIR / f"{NAME}.zip"
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(STAGE.rglob("*")):
            z.write(f, f.relative_to(STAGE.parent))
    print(zp, f"{zp.stat().st_size / 1e6:.1f} MB", len(lines), "arquivos", sha)


if __name__ == "__main__":
    main()
