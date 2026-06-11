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
| **APK Android** | ✅ Build concluído | [Descarregar APK](https://expo.dev/artifacts/eas/jHhZhUnWDr8W5gWAxJfRGk8BDH92QnVEOwFIPISC8mY.apk) |

---

## 🗺️ Plano de Acção — Estado Actual

| Fase | Objectivo | Estado |
|---|---|---|
| **Fase 0** — Saúde & Triage | Bugs críticos, Stripe, EAS APK | ✅ Concluída (10 Jun 2026) |
| **Fase 1** — Identidade + Social | Admiradores, Time-Gate, Word Links, Onboarding, Modo Neutro, CDN | ✅ Concluída (11 Jun 2026) |
| **Fase 2** — Crescimento + Primeiro €€€ | PostHog ✅ Veredito Card ✅ Sincronia (backend) ✅ — Primeiro Olhar + Word of the Day pendentes | 🔄 Em curso |
| **Fase 3** — Camada de IA + Mapa | Espelho de Empatia, user_memory, Efeito Printável completo, Mapa de eventos | ⏳ Pendente |
| **Fase 4** — B2B Escala | Sincronia Reports dashboard, Sintonizados, Besord como Filtro do Instagram | ⏳ Pendente |

---

## 🔑 Credenciais e IDs Importantes

| Recurso | Valor |
|---|---|
| Render Service ID | `srv-d8fd8areo5us73bpep9g` |
| Expo Project ID | `83893be0-ae4d-43a8-837d-dbd441193fef` |
| Expo Robot Token | `wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd` |
| Android Package | `com.besord.app` |
| Stripe Webhook Secret (prod) | `whsec_1cThiKZTKfxIlPMlrdiLQVq5xNycMUKa` |

> ⚠️ Mover para gestor de passwords — não deixar em texto simples

---

## ⚡ Comandos Rápidos

**Publicar OTA update (após cada sessão de dev):**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd" eas update --branch main --message "descrição"
```

**Novo build APK:**
```bash
cd frontend
EXPO_TOKEN="wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd" eas build --platform android --profile preview
```

---

> **Última actualização:** 11 Junho 2026 (tarde) — PostHog ✅ Groq ✅ VeredictCard ✅ Sincronia backend ✅ — faltam: Primeiro Olhar, Word of the Day, push notifications
