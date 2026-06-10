# 🏠 Besord — Home

**Bem-vindo à documentação do projeto Besord.**

## 🎯 O que é o Besord

Plataforma social de votação onde users publicam **palavras**, outros votam **APROVO 👍 / DESAPROVO 👎**, e quem recebe hype acumula **B$ (Besord coins)**.

## 🔗 Navegação Rápida

| Secção | Descrição |
|---|---|
| [[📐 Arquitetura]] | Stack, fluxo de dados, diagramas |
| [[👤 User Flow]] | Fluxo de ecrãs e jornada do utilizador |
| [[🗄️ Estrutura de Dados]] | Collections do MongoDB e schemas |
| [[⚙️ Regras de Negócio]] | Hype, B$, sorteios, campanhas |
| [[🧪 Testes & QA]] | Como testar cada funcionalidade |
| [[🐛 Erros Conhecidos]] | Bugs e problemas identificados |
| [[📋 Checklist Deploy]] | Passos antes de cada deploy |
| [[🔧 Setup Local]] | Como desenvolver no PC |

## 📊 Estado dos Serviços

| Componente | Status | URL |
|---|---|---|
| **Backend** | 🟢 Live | https://besord-backend.onrender.com |
| **Frontend** | 🟢 Live | https://besord.vercel.app |
| **MongoDB Atlas** | 🟢 Online | Cluster: Besord |
| **Stripe (teste)** | 🟢 Ativo | Dashboard Stripe |

## 🗺️ Plano de Acção (4 Fases)

Ver detalhes completos em: [[📅 Sessão 10 Junho 2026]]

| Fase | Objectivo | Estado |
|---|---|---|
| **Fase 0** — Saúde & Triage | Estabilidade técnica, bugs críticos, EAS APK | ✅ Concluída |
| **Fase 1** — Reposicionamento | Onboarding novo, feed com eventos, perfil renovado | ⏳ A seguir |
| **Fase 2** — Arquitectura de Eventos | 3 tipos de evento, revenue sharing, mapa melhorado | ⏳ Pendente |
| **Fase 3** — B2B Reinventado | Relatórios de Sincronia, eventos enterprise, novo pricing | ⏳ Pendente |
| **Fase 4** — IA & Social | Printable Effect, B$ redemption, Empathy Mirror | ⏳ Pendente |

## 📌 Próximos Passos Imediatos

- [ ] Instalar APK no Android do fundador (link enviado quando build terminar)
- [ ] Testar fluxo completo de campanhas (criar → pagar → activar)
- [ ] Testar sorteio (`POST /posts/{id}/draw-prize`)
- [ ] Testar verificação de empresa
- [ ] Iniciar Fase 1 — Redesign onboarding e feed

---

> **Última atualização:** 10 Junho 2026
