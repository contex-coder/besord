# 🏠 Besord — Home

**Bem-vindo à documentação do projecto Besord.**

---

## 🎯 O que é o Besord

**Plataforma B2B2C de Inteligência de Percepção.**

Utilizadores publicam imagem+palavra, votam APROVO/DESAPROVO, e acumulam B$. O motor de receita são os eventos (3 tipos) onde empresas pagam por percepção qualificada — não por visualizações.

> *"O Instagram te conhece para te vender coisas. O Besord te ajuda a te conhecer para não precisares de mais nada."*

---

## 🔗 Navegação Rápida

| Secção | Descrição |
|---|---|
| [[visao_reinventada]] | Visão de produto final — IMUTÁVEL |
| [[🚀 Plano Final de Implementação]] | Plano de 4 fases com tarefas e critérios |
| **[[📊 Plano Estratégico de Crescimento — Junho 2026]]** | **Estratégia de negócio, retenção, aquisição e novas features — OODA completo** |
| [[🎨 Design & UX — Ecrãs e Fluxos]] | Wireframes, fluxos, guia de imagens |
| [[📐 Arquitetura]] | Stack, fluxo de dados, diagramas |
| [[👤 User Flow]] | Jornada do utilizador por tipo |
| [[🗄️ Estrutura de Dados]] | Collections MongoDB e schemas |
| [[⚙️ Regras de Negócio]] | Time-Gate, Espelho de Empatia, Eventos, B$ |
| [[🧪 Testes & QA]] | Como testar cada funcionalidade |
| [[🐛 Erros Conhecidos]] | Bugs e problemas identificados |
| [[📋 Checklist Deploy]] | Passos antes de cada deploy |
| [[🔧 Setup Local]] | Como desenvolver no PC |
| [[📅 Sessão 10 Junho 2026]] | Relatório da sessão de onboarding |
| [[📅 Sessão 11 Junho 2026]] | Revisão estratégica Red Team + redesenho Fase 2 + decisões de produto |
| [[📅 Sessão 14 Junho 2026]] | Análise unicórnio (lente dos visionários) + auditoria estabilidade + retificações aprovadas |
| [[📅 Sessão 14 Junho 2026 — Fase 2 Completa + Testes]] | Fase 2 entregue + E2E testing + 9 bugs corrigidos + DB limpa |
| [[📅 Sessão 15 Junho 2026 — Fase 3 Início + Eventos + Campanhas]] | Fase 3 iniciada — Eventos (3.A-3.D) + Primeiro Olhar + Campanhas |
| [[📅 Sessão 16 Junho 2026 — Correções pré-Fase 3 (Render, Veredito, Eventos)]] | Render keep-alive, Veredito com IA, Espelho humanizado, gestão de eventos |
| [[📅 Sessão 16 Junho 2026 — Estratégia e Plano Técnico]] | B$ dobrado, Cloudinary, Curador IA, Word Economy, plano de implementação |
| [[📋 Briefing 16 Junho 2026 — Sessão Técnica]] | Briefing detalhado da implementação (Cloudinary, Curador, bugs, commits, estado final) — verificado e corrigido contra o código real |
| [[📅 Sessão 16 Junho 2026 — Encerramento e Plano para Amanhã]] | Resumo do dia, 4 bugs do Curador resolvidos em cadeia |
| **[[📅 Sessão 22 Junho 2026 — 5 Sistemas de Retenção D7]]** | **Começar aqui** — Streak, Push, Daily Challenge, Feed Curator 4 camadas, Arquétipos |

---

## 📊 Estado dos Serviços

| Componente | Status | URL |
|---|---|---|
| **Backend** | 🟢 Live | https://besord-backend.onrender.com |
| **Frontend Web** | 🟢 Live | https://besord.vercel.app |
| **MongoDB Atlas** | 🟢 Online | Cluster: Besord (M0 Free) |
| **Stripe Webhook** | 🟢 Validado | Assina e rejeita inválidos ✓ |
| **PostHog Analytics** | 🟢 Activo | us.posthog.com — Projecto 465827 |
| **Groq AI** | 🟢 Activo | console.groq.com — llama-3.1-8b-instant (free) |
| **Cloudinary CDN** | 🟢 Activo | cloudinary.com — `ddr3zepsy` (free tier 25GB) |
| **APK Android** | ✅ Build concluído | [Descarregar APK](https://expo.dev/artifacts/eas/jHhZhUnWDr8W5gWAxJfRGk8BDH92QnVEOwFIPISC8mY.apk) |

---

## 🗺️ Plano de Acção — Estado Actual

| Fase | Objectivo | Estado |
|---|---|---|
| **Fase 0** — Saúde & Triage | Bugs críticos, Stripe, EAS APK | ✅ Concluída (10 Jun 2026) |
| **Fase 1** — Identidade + Social | Admiradores, Time-Gate, Word Links, Onboarding, Modo Neutro, CDN | ✅ Concluída (11 Jun 2026) |
| **Fase 2** — Crescimento + Primeiro €€€ | PostHog ✅ VeredictCard ✅ Sincronia ✅ WotD ✅ Espelho Sessão ✅ Sistema Fundador ✅ Primeiro Olhar (backend ✅, 1ª venda pendente Rodrigo) | ✅ Tecnicamente completa |
| **Fase 3** — Camada de IA + Mapa | Cloudinary ✅ Curador IA ✅ Feed Curator 4 camadas ✅ user_memory ✅ Arquétipos ✅ Streak ✅ Push ✅ Daily Challenge ✅ | ✅ Tecnicamente completa |
| **Fase 4** — B2B Escala | Sincronia Reports dashboard, Sintonizados, Besord como Filtro do Instagram | ⏳ Pendente |

---

## 🔑 Credenciais e IDs Importantes

| Recurso | Valor |
|---|---|
| Render Service ID | `srv-d8fd8areo5us73bpep9g` |
| Expo Project ID | `83893be0-ae4d-43a8-837d-dbd441193fef` |
| Android Package | `com.besord.app` |

> 🔒 **Segredos NÃO ficam neste documento.**
> Vivem em `backend/.env` (no `.gitignore`). Produção usa o painel Render/Vercel. Mantém cópia num gestor de passwords.

### Variáveis críticas — estado Render Dashboard

| Variável | Render | Notas |
|----------|--------|-------|
| MONGO_URL, DB_NAME | ✅ | |
| GROQ_API_KEY | ✅ | |
| CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET | ✅ | |
| POSTHOG_API_KEY | ✅ | |
| STRIPE_API_KEY / STRIPE_WEBHOOK_SECRET | ✅ | |
| GOOGLE_CLIENT_ID / SECRET | ✅ | |
| JWT_SECRET_KEY, ADMIN_EMAIL | ✅ | |
| CURATOR_API_KEY | ✅ | |
| **CRON_SECRET** | ✅ Adicionado | |
| **UNSPLASH_ACCESS_KEY** | ⚠️ A adicionar | Registar em unsplash.com/developers |

---

## ⚡ Comandos Rápidos

**Publicar OTA update (após cada sessão de dev):**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="<ver frontend/.env>" eas update --branch main --message "descrição"
```

**Novo build APK:**
```bash
cd frontend
EXPO_TOKEN="<ver frontend/.env>" eas build --platform android --profile preview
```

---

> **Última actualização:** 22 Junho 2026, 20h42 — 5 sistemas de retenção D7 entregues e em produção. Render live, OTA publicado, 3 cron jobs activos em cron-job.org. Primeira execução automática amanhã às 06h00 UTC.
> **Próxima sessão:** criar primeiro Daily Challenge (`POST /api/admin/daily-challenge`), adicionar `UNSPLASH_ACCESS_KEY` no Render, testar push notifications no APK.
