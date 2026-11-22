# Changelog — axon

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0-alpha] — 2026-11-21

Primeira versão executável. Ferramenta de pesquisa e ensino in silico — **não é dispositivo médico**.

### Adicionado
- **Núcleo biofísico verificado** (`backend/core/bio_model.py`): reimplementação fiel do Anexo G do livro —
  cadeia nodal de 41 nós, Euler explícito Δt = 1 µs, bordas de Neumann, pulso 100 µs + cauda 300 µs,
  Monte Carlo N = 20 000 com bootstrap 2 000 (semente 42). Recusa pedidos fora do domínio verificado
  (1–16 µm; 0,3–1,5 mm).
- **Regressão obrigatória** reproduzida: α = 1,1266; razão Aδ(3)/Aβ(9) a 1 mm = 3,2077; 2,17 a 0,5 mm;
  4,07 a 1,5 mm; razão de medianas 3,10 (IC 95 % 2,98–3,22); F_Aδ = 0,38 % com F_Aβ ≤ 10 %;
  sensibilidade a ρi 2,85–3,48. 28 testes (`pytest`).
- **4 fronteiras de segurança** (`core/safety.py`): Shannon (k), Pennes 0D + CEM43, MI/ISPTA.3, crônica.
- **Ruído térmico e ressonância estocástica** (`core/stochastic.py`): k_BT a 310 K; curva SNR × σ.
- **Modalidades integrativas** (`core/integrative.py`): eletroacupuntura, taVNS (mapa ABVN), acupressão —
  com etiquetas de procedência por saída.
- **Variações anatômicas** (`core/anatomy.py`): motor de regras [HIPÓTESE]; perfis anônimos (LGPD).
- **IA contextual** (`backend/app/ai.py`): tradutor (5 idiomas) e Axon Bot com failover entre provedores;
  fallback offline; a IA nunca gera números.
- **API FastAPI** (`/api/*`) com envelope de procedência, versão e semente em toda resposta.
- **Desktop macOS 3D** (`frontend/`): palco multiescala de 5 níveis, 8 mini-apps em janelas, painéis
  retráteis, Dock, seletor de 5 idiomas, Axon Bot.
- **Infra**: `docker-compose.yml`, `scripts/setup_vps.sh` (VPS compartilhada, proxy do host + certbot,
  Traefik opcional), `.github/workflows/deploy.yml` (testes → sync IA via `SERVIDOR_ENV` → deploy SSH).
- **Documentação**: manual do usuário, manual técnico e página de apresentação (`docs/`, `site/`).

### Limitações conhecidas
- Modelo **verificado, não validado** (ASME V&V 40). Membrana passiva; meio homogêneo; eletrodo pontual.
- Fibras C fora do modelo nodal mielinizado.
- Acupressão e preditor anatômico são regras ilustrativas [HIPÓTESE]; IA preditiva ainda não treinada.
- Salas WebRTC e grafos Neo4j são perfis opcionais em esqueleto.
