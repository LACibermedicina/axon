#!/usr/bin/env python3
"""axon · gestão de versões e registro de alterações (Keep a Changelog + SemVer).

Fonte da verdade: VERSION e CHANGELOG.md. Usado pelo CI e pela VPS.

  python3 scripts/release.py json [--sha SHA]       # gera frontend/release.json e frontend/js/release.js
  python3 scripts/release.py bump [--auto]          # nova versão a partir dos commits desde a última tag
  python3 scripts/release.py notes [VERSAO]         # notas da versão (Markdown) para o GitHub Release
  python3 scripts/release.py current                # imprime a versão atual

Regras do bump:
  • Se a versão do arquivo VERSION ainda não tem tag (o desenvolvedor já subiu a versão e escreveu o
    changelog à mão), nada é alterado — usa-se a entrada escrita.
  • Caso contrário, incrementa: "feat"/"BREAKING" → minor (0.x) ; demais → patch. O sufixo de estágio
    (-alpha, -beta) é preservado. A seção nova do CHANGELOG é montada com os assuntos dos commits,
    classificados pelo prefixo convencional (feat, fix, docs, perf, refactor, ci, chore, test).
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION_F, CHANGELOG_F = ROOT / "VERSION", ROOT / "CHANGELOG.md"
SECTION = {"feat": "Adicionado", "fix": "Corrigido", "perf": "Alterado", "refactor": "Alterado", "style": "Alterado",
           "docs": "Documentação", "test": "Testes", "ci": "Infraestrutura", "build": "Infraestrutura", "chore": "Infraestrutura",
           "sci": "Científico"}
ORDER = ["Adicionado", "Alterado", "Científico", "Corrigido", "Documentação", "Testes", "Infraestrutura", "Removido", "Segurança", "Limitações conhecidas", "Outros"]
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.]+)?$")


def sh(*a: str) -> str:
    return subprocess.run(a, cwd=ROOT, capture_output=True, text=True).stdout.strip()


def current() -> str:
    return VERSION_F.read_text().strip()


def parse_changelog(text: str | None = None) -> list[dict]:
    text = text if text is not None else CHANGELOG_F.read_text(encoding="utf-8")
    rel, out, sec = None, [], None
    for line in text.splitlines():
        m = re.match(r"^## \[([^\]]+)\](?:\s*[—-]\s*(\S+))?", line)
        if m:
            rel = {"version": m.group(1), "date": m.group(2) or "", "summary": "", "sections": {}}; out.append(rel); sec = None; continue
        if rel is None:
            continue
        m = re.match(r"^### (.+)", line)
        if m:
            sec = m.group(1).strip(); rel["sections"].setdefault(sec, []); continue
        m = re.match(r"^- (.+)", line)
        if m and sec:
            rel["sections"][sec].append(m.group(1).strip()); continue
        if m := re.match(r"^\s{2,}(\S.*)", line):
            if sec and rel["sections"][sec]:
                rel["sections"][sec][-1] += " " + m.group(1).strip()
            continue
        if line.strip() and not sec and not line.startswith("#"):
            rel["summary"] = (rel["summary"] + " " + line.strip()).strip()
    return out


def strip_md(s: str) -> str:
    return re.sub(r"\*\*|`", "", re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s))


def cmd_json(sha: str = "") -> None:
    rels = parse_changelog()
    cur = current()
    data = {"version": cur, "sha": sha or sh("git", "rev-parse", "--short", "HEAD") or "dev",
            "built_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "releases": [{**r, "sections": {k: [strip_md(i) for i in v] for k, v in r["sections"].items()}} for r in rels[:20]]}
    if not any(r["version"] == cur for r in rels):
        sys.exit(f"CHANGELOG.md não tem entrada para a versão {cur}")
    (ROOT / "frontend" / "release.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    (ROOT / "frontend" / "js" / "release.js").write_text(
        "/* gerado por scripts/release.py — não editar */\nwindow.AXON_RELEASE=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"release.json · {cur} · {data['sha']}")


def next_version(v: str, kind: str) -> str:
    m = SEMVER.match(v)
    if not m:
        sys.exit(f"versão inválida: {v}")
    ma, mi, pa, pre = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4) or ""
    if kind == "major":
        return f"{ma + 1}.0.0{pre}"
    if kind == "minor":
        return f"{ma}.{mi + 1}.0{pre}"
    return f"{ma}.{mi}.{pa + 1}{pre}"


def cmd_bump(auto: bool) -> None:
    v = current()
    tags = sh("git", "tag", "--list", "v*").split()
    if f"v{v}" not in tags:
        print(f"VERSION {v} ainda sem tag: usando a entrada escrita no CHANGELOG."); return
    last = f"v{v}"
    log = [l for l in sh("git", "log", f"{last}..HEAD", "--pretty=%s").splitlines() if l and "[skip ci]" not in l and not l.startswith("chore(release)")]
    if not log:
        print("Nenhum commit novo desde", last); return
    kind = "minor" if any(re.match(r"^feat(\(.+\))?!?:", l) or "BREAKING" in l for l in log) else "patch"
    nv = next_version(v, kind)
    groups: dict[str, list[str]] = {}
    for l in log:
        m = re.match(r"^(\w+)(\([^)]*\))?!?:\s*(.+)", l)
        sec = SECTION.get(m.group(1).lower(), "Outros") if m else "Outros"
        text = m.group(3) if m else l
        groups.setdefault(sec, []).append(text[0].upper() + text[1:])
    today = dt.date.today().isoformat()
    block = [f"## [{nv}] — {today}", "", f"Atualização automática gerada a partir de {len(log)} commit(s) desde {last}.", ""]
    for sec in ORDER:
        if sec in groups:
            block += [f"### {sec}"] + [f"- {i}" for i in groups[sec]] + [""]
    text = CHANGELOG_F.read_text(encoding="utf-8")
    i = text.index("## [")
    CHANGELOG_F.write_text(text[:i] + "\n".join(block) + "\n" + text[i:], encoding="utf-8")
    VERSION_F.write_text(nv + "\n")
    print(f"{v} → {nv} ({kind})")


def cmd_notes(v: str | None) -> None:
    v = v or current()
    rel = next((r for r in parse_changelog() if r["version"] == v), None)
    if not rel:
        sys.exit(f"sem entrada para {v}")
    out = [rel["summary"], ""] if rel["summary"] else []
    for sec, items in rel["sections"].items():
        out += [f"### {sec}"] + [f"- {i}" for i in items] + [""]
    print("\n".join(out).strip())


if __name__ == "__main__":
    a = sys.argv[1:] or ["current"]
    if a[0] == "json":
        cmd_json(a[a.index("--sha") + 1] if "--sha" in a else "")
    elif a[0] == "bump":
        cmd_bump("--auto" in a)
    elif a[0] == "notes":
        cmd_notes(a[1] if len(a) > 1 else None)
    else:
        print(current())
