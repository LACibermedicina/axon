# axon · `axon.m3d.pro`

Simulação biofísica multiescala da neuromodulação, mapeamento neuroanatômico e dosimetria computacional,
fundamentada em *Biofísica da Neuromodulação: Resolução de Fibra Única e Limiares de Segurança Tecidual*
(Teixeira LS, Ibilce/UNESP, 2026).

> **Ferramenta de pesquisa, ensino e modelagem in silico** (ASME V&V 40 — verificado, não validado; Res. CNS 510/2016).
> **Não é dispositivo médico** nem protocolo clínico. Não calcula parâmetros de estimulação para pessoas.

Versão **0.10.0-alpha** — ver [CHANGELOG](CHANGELOG.md).

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `backend/core/` | Núcleo verificado: modelo nodal de 41 nós (Anexo G), Monte Carlo (semente 42), 4 fronteiras de segurança, ruído/RE, modalidades integrativas, variações anatômicas, preditor morfométrico do axônio |
| `backend/app/` | API FastAPI (`/api/*`), IA contextual com failover (Axon Bot, tradução da tela, paciente, plano), portal (notícias, agenda, podcast, boletim, apoio) |
| `frontend/` | Portal (`index.html`), simulador (`simulador.html`), painel da coordenação (`admin.html`); Three.js r128 com cópia local em `vendor/` |
| `frontend/anatomy/` | Pacote anatômico BodyParts3D (CC BY-SA 2.1 JP): pele, 258 ossos, 157 órgãos, 56 vasos, 457 músculos, 125 trajetos nervosos |
| `docs/` | Manual do Usuário e Manual Técnico, com atlas visual (`docs/img/anat/`) |
| `research/` | Conteúdo do programa de pesquisa, pranchas e scripts reprodutíveis |
| `scripts/` | Instalação na VPS, deploy, release, builds autocontidos, captura das figuras da documentação |
| `realtime/` | Sinalização WebRTC das salas de estudo (perfil `collab`) |

## Rodar localmente

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q   # 43 testes
uvicorn app.main:app --reload --port 8000                                   # API
cd ../frontend && python3 -m http.server 8080                               # http://localhost:8080/simulador.html
```

Sem a API, o simulador funciona em modo local (sem IA). Com `docker compose up -d` sobe tudo junto.

## Implantar (VPS compartilhada)

```bash
sudo bash scripts/setup_vps.sh voce@dominio /caminho/deploy.pub
```

Depois, cada push em `main` roda **ci-axon**: testes → `sync-ai-env` (secret `SERVIDOR_ENV` e/ou secrets
individuais → `.env` da VPS, só chaves de IA da lista permitida) → deploy via SSH.
Secrets necessários: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `SERVIDOR_ENV`. Detalhes no Manual Técnico.

## Benchmarks reproduzidos (semente 42)

α = 1,1266 · razão Aδ(3 µm)/Aβ(9 µm) a 1 mm = 3,2077 (2,17 a 0,5 mm; 4,07 a 1,5 mm) ·
razão de medianas 3,10 (IC 95 % 2,98–3,22) · F_Aδ = 0,38 % com F_Aβ ≤ 10 %.

## Autoria

Modelo e programa de investigação: Lucas da Silva Teixeira — Ibilce/UNESP · lucas.silva-teixeira@unesp.br ·
ORCID 0000-0001-7541-5399. Orientação: a informar.
