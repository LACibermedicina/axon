#!/usr/bin/env python3
"""Gera o conteúdo inicial do portal (backend/app/seed_portal.json e frontend/data/portal-seed.json).

Fontes: research/conteudo-programa.json (registro de evolução, marcos, fases), frontend/release.json (versões do
simulador) e as pranchas em frontend/img/programa. Os episódios do podcast nascem como rascunho: só aparecem no
site depois que o administrador os libera no painel. O seed só é usado quando o servidor ainda não tem portal.json.
"""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
P = json.loads((root / "research" / "conteudo-programa.json").read_text(encoding="utf-8"))
R = json.loads((root / "frontend" / "release.json").read_text(encoding="utf-8"))
CAT = {"entrega": "novidade", "publicacao": "publicacao", "correcao": "atualizacao", "decisao": "bastidores", "nota": "novidade"}
IMG = {"entrega": "img/programa/lei_escala.jpg", "publicacao": "img/programa/timeline.jpg", "correcao": "img/programa/janela.jpg", "decisao": "img/programa/fases.jpg", "nota": "img/programa/metodos.jpg"}
TS = "2026-11-23T00:00:00Z"
news, timeline, events, media, episodes = [], [], [], [], []

for k, r in sorted(P["registros"].items(), key=lambda kv: kv[1]["data"]):
    news.append({"id": f"nw-{k}", "title": r["titulo"], "summary": r["corpo"].split(". ")[0].rstrip(".") + ".", "body": r["corpo"], "category": CAT.get(r["tipo"], "novidade"),
                 "image": IMG.get(r["tipo"], ""), "date": r["data"], "tags": ["programa", r["tipo"]], "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
CAPS = ["img/app/sim-st36.jpg", "img/app/sim-corpo.jpg", "img/app/sim-regiao.jpg", "img/app/sim-fasciculo.jpg", "img/app/sim-monitor.jpg"]
for i, rel in enumerate(R["releases"]):
    body = "\n\n".join(f"**{sec}**\n" + "\n".join("- " + i for i in items) for sec, items in rel.get("sections", {}).items())
    news.append({"id": f"nw-v{rel['version']}", "title": f"Simulador v{rel['version']}", "summary": rel.get("summary", ""), "body": body, "category": "atualizacao",
                 "image": CAPS[i % len(CAPS)], "date": rel["date"], "tags": ["simulador", "versão"], "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
for k, m in P["marcos"].items():
    timeline.append({"id": f"tl-{k}", "title": m["titulo"], "description": m["descricao"], "date": m["data"], "track": m.get("trilha", "in-silico"),
                     "phase": "", "state": m["estado"], "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
    if m.get("trilha") != "vinculado" and m["estado"] != "feito":
        events.append({"id": f"ev-{k}", "title": m["titulo"], "description": m["descricao"], "start": m["data"], "end": m["data"], "location": "",
                       "kind": "prazo", "link": "", "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
for rel in R["releases"]:
    timeline.append({"id": f"tl-v{rel['version']}", "title": f"Simulador v{rel['version']}", "description": rel.get("summary", ""), "date": rel["date"], "track": "in-silico",
                     "phase": "Fase 1", "state": "feito", "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
FIGS = [("problema", "A régua do campo"), ("proposta", "Duas réguas"), ("lei_escala", "Limiar × calibre"), ("janela", "Janela de seletividade"), ("difracao", "Resolução × penetração"),
        ("via_dor", "A via da dor"), ("janela_terap", "Janela terapêutica"), ("timeline", "Noventa anos de um mesmo obstáculo"), ("fases", "Escada de evidência"),
        ("cronograma", "Cronograma"), ("metodos", "Três métodos declarados"), ("selecao", "Seleção da literatura")]
for f, c in FIGS:
    media.append({"id": f"me-{f}", "title": c, "caption": "Prancha gerada por código (research/figuras).", "kind": "foto", "url": f"img/programa/{f}.jpg", "mime": "image/jpeg",
                  "date": "2026-11-21", "category": "galeria", "status": "publicado", "created": TS, "updated": TS, "source": "seed"})
for f, c in [("sim-corpo", "Simulador · corpo inteiro com pontos reflexos"), ("sim-st36", "Simulador · ST36 e as estruturas associadas"), ("sim-regiao", "Simulador · região e tronco nervoso"),
             ("sim-fasciculo", "Simulador · fascículo e ramificações"), ("sim-monitor", "Simulador · modo simulação com monitor")]:
    if (root / "frontend" / "img" / "app" / f"{f}.jpg").exists():
        media.append({"id": f"me-{f}", "title": c, "caption": "Captura do simulador em execução.", "kind": "foto", "url": f"img/app/{f}.jpg", "mime": "image/jpeg",
                      "date": "2026-11-23", "category": "galeria", "status": "publicado", "created": TS, "updated": TS, "source": "seed"})

EP = [
    ("Por que o tato chega antes da dor", "O problema central do programa em cinco minutos: calibre, internodo e o campo do eletrodo.",
     "Olá, este é o resumo em áudio do projeto axon. Hoje, a pergunta que dá origem a tudo: por que, sob um eletrodo na pele, a sensação de tato aparece antes da dor? "
     "A resposta está no calibre das fibras. As fibras grossas, do tipo A beta, têm os nós de Ranvier mais afastados. O campo elétrico do eletrodo cria uma diferença de potencial entre dois nós vizinhos, e quanto maiores as distâncias, maior esse degrau. Por isso as fibras grossas atingem o limiar primeiro. "
     "No modelo nodal que o projeto implementou, o limiar cai com o diâmetro elevado a menos um vírgula treze. A um milímetro do eletrodo, as fibras finas da dor precisam de cerca de três vezes e duas décimas a corrente das fibras do tato. "
     "Essa é uma previsão de modelo, com semente fixa e reprodutível; ainda não é uma medida. Validar esse número contra dados publicados é a próxima etapa da parte in silico. Até o próximo resumo."),
    ("Duas réguas: resolução contra penetração", "Por que focalizar energia na escala de um único axônio esbarra na física do ultrassom.",
     "Neste resumo, as duas réguas do problema. Para escolher uma fibra fina sem tocar as vizinhas, seria preciso concentrar energia numa região do tamanho de um axônio, cerca de dez micrômetros. "
     "Com ultrassom, isso exige um comprimento de onda dessa ordem, o que corresponde a algo perto de cento e cinquenta megahertz. Nessa frequência, a atenuação no tecido passa de setenta e cinco decibéis por centímetro. "
     "Em outras palavras: a mesma física que daria a resolução impede a penetração. O projeto mapeia essa fronteira com números derivados, e o simulador mostra onde ficam os limites de segurança térmica e mecânica. "
     "Este é um projeto de simulação in silico; nenhuma intervenção em pessoas faz parte dele."),
    ("O que há no simulador axon", "Um passeio pelo simulador: cinco escalas, pontos reflexos, modo simulação e o assistente.",
     "Bem-vindo ao passeio pelo simulador axon. Ele começa no corpo inteiro, com anatomia real de pele, ossos, músculos, órgãos e nervos, e desce em cinco escalas até a membrana do axônio. "
     "Nos pontos reflexos, cada cor indica uma família: acupontos, auriculares, pontos-gatilho e zonas de dor referida. Ao clicar num ponto, o simulador acende o dermátomo, o nervo, o músculo e o órgão associados. "
     "No modo simulação, você escolhe um instrumento, aplica sobre a pele e acompanha um monitor com a resposta estimada. Tudo traz etiquetas de procedência: literatura, premissa, derivado ou resultado de modelo. "
     "É uma ferramenta de pesquisa e ensino. Não é dispositivo médico. Até a próxima."),
]
for i, (t, s, sc) in enumerate(EP):
    episodes.append({"id": f"ep-{i + 1:02d}", "title": t, "summary": s, "script": sc, "audio": "", "duration": 0, "date": "", "sources": ["research/conteudo-programa.json", "manual do usuário"],
                     "status": "rascunho", "created": TS, "updated": TS, "source": "seed"})

seed = {"news": news, "events": events, "timeline": timeline, "media": media, "episodes": episodes, "subscribers": [], "tickets": [], "log": []}
(root / "backend" / "app" / "seed_portal.json").write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding="utf-8")
pub = {k: [x for x in v if x.get("status") == "publicado"] for k, v in seed.items() if k in ("news", "events", "timeline", "media", "episodes")}
(root / "frontend" / "data").mkdir(exist_ok=True)
(root / "frontend" / "data" / "portal-seed.json").write_text(json.dumps(pub, ensure_ascii=False), encoding="utf-8")
print({k: len(v) for k, v in seed.items()})
