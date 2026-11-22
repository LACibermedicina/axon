# axon · `axon.m3d.pro`

Simulação biofísica multiescala da neuromodulação, mapeamento neuroanatômico e dosimetria computacional,
fundamentada em *Biofísica da Neuromodulação: Resolução de Fibra Única e Limiares de Segurança Tecidual*
(Teixeira LS, Ibilce/UNESP, 2026).

> **Ferramenta de pesquisa, ensino e modelagem in silico** (ASME V&V 40 — verificado, não validado; Res. CNS 510/2016).
> **Não é dispositivo médico** nem protocolo clínico. Não calcula parâmetros de estimulação para pessoas.

Versão **0.2.0-alpha** (atualização automática — ver CHANGELOG) — ver [CHANGELOG](CHANGELOG.md).

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `backend/core/` | Núcleo verificado: modelo nodal de 41 nós (Anexo G), Monte Carlo (semente 42), 4 fronteiras de segurança, ruído/RE, modalidades integrativas, variações anatômicas |
| `backend/app/` | API FastAPI (`/api/*`) e IA contextual com failover entre provedores |
| `frontend/` | Desktop macOS 3D (Three.js r128): zoom semântico em 5 escalas, 8 mini-apps, painéis retráteis, 5 idiomas |
| `realtime/` | Sinalização WebRTC das salas de estudo (perfil `collab`) |
| `docs/` | Manual do Usuário e Manual Técnico (HTML ilustrado) |
| `site/` | Página de apresentação do projeto |
| `scripts/` | `setup_vps.sh`, `deploy.sh`, `merge-env.sh`, `ci-sync-ai-env.sh`, builds autocontidos |

## Rodar localmente

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q   # 28 testes de regressão
uvicorn app.main:app --reload                                               # API em :8000
python3 -m http.server -d ../frontend 8080                                  # desktop (funciona offline)
```

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
