# 📅 Sessão 22 Junho 2026 — 5 Sistemas de Retenção D7

**Objectivo:** Construir os mecanismos que transformam uma boa primeira experiência em hábito diário. Meta: D7 retention ≥ 35%.

---

## O que foi construído

### Sistema 1 — Streak Counter (RICE 63, +10pp D7)
- `_update_streak()` no `backend/server.py` — idempotente, UTC, milestones 3/7/14/30 dias
- Badge 🔥 no header do feed (streak ≥ 2)
- StatBox "STREAK 🔥" na página de perfil
- Linha "🔥 DIA N DE STREAK" no VeredictCard
- `GET /api/users/me/daily-status` retorna `streak_count`, `best_streak`, `last_session_date`

### Sistema 2 — Push Notifications via Expo (RICE 55)
- `backend/push_notifications.py` — Expo Push API real, invalida tokens `DeviceNotRegistered`
- `notify_user()` agora envia push real + notificação in-app em simultâneo
- **Correcção crítica:** URL mismatch `/api/push/register` → `/api/notifications/register-device`
- `AuthContext.tsx` sincroniza token Expo após cada login
- Cron `POST /api/admin/cron/streak-reminders` (20h UTC) para utilizadores com streak ≥ 2 que ainda não completaram
- `notify_user()` na Sincronia quando `agreement_rate ≥ 70%`

### Sistema 3 — Daily Challenge "Wordle da Percepção" (RICE 43, +15pp D7)
- `backend/routes/daily_challenge.py` — 4 endpoints: GET, POST vote, admin create, cron reveal
- Reveal às 20h UTC com análise Groq + notificação aos votantes
- `frontend/src/components/DailyChallengeCard.tsx` — card no topo do feed
- +1 BW por voto no challenge (separado do Time-Gate)

### Sistema 4 — Feed Curator Diário (pipeline 4 camadas)
- `backend/feed_curator.py` reescrito com:
  - **Camada 1** — Community signal: top posts Besord últimos 7 dias com APROVO ≥ 65%
  - **Camada 2** — Google Trends PT/BR RSS (público, sem API key)
  - **Camada 3** — Reddit RSS: DesignPorn, minimalism, brutalism, streetphotography
  - **Camada 4** — Banco estático de 28 temas curados (fallback)
- **Auto-scale progressivo:** < 5 posts naturais/dia → 3 curados; 5-9 → 2; 10-19 → 1; ≥ 20 → 0
- Campo `curator_source` nos posts para debug
- Endpoint `POST /api/admin/cron/feed-curator`
- Utilizador `besord_system` criado no startup

### Sistema 5 — user_memory + 10 Arquétipos (Semana 2)
- `backend/archetypes.py` — 10 arquétipos determinísticos (curador, generoso, explorador, esteticista, analista, rebelde, naturalista, urbanista, intuitivo, crítico)
- `_update_user_memory()` — agrega sessões em janela deslizante de 10, detecta arquétipo na sessão 10
- `_groq_session_insight()` enriquecido com historial das últimas 3 sessões
- `GET /api/users/me/veredito` retorna `archetype_id` + `total_sessions`
- `VeredictCard.tsx` mostra secção "O TEU PERFIL DE PERCEPÇÃO" a partir da sessão 10
- Notificação push no desbloqueio do arquétipo

---

## Ficheiros criados (novos)
| Ficheiro | Sistema |
|----------|---------|
| `backend/push_notifications.py` | 2 |
| `backend/archetypes.py` | 5 |
| `backend/feed_curator.py` | 4 |
| `backend/routes/daily_challenge.py` | 3 |
| `frontend/src/components/DailyChallengeCard.tsx` | 3 |
| `docs/obsidian/📊 Plano Estratégico de Crescimento — Junho 2026.md` | — |

## Ficheiros modificados
| Ficheiro | O que mudou |
|----------|-------------|
| `backend/server.py` | +252 linhas: streak, push, curador, user_memory, arquétipos, crons |
| `frontend/src/contexts/AuthContext.tsx` | Sincroniza push token após login |
| `frontend/src/utils/notifications.ts` | Correcção URL mismatch |
| `frontend/src/app/(tabs)/feed.tsx` | Badge streak + DailyChallengeCard |
| `frontend/src/app/(tabs)/perfil.tsx` | StatBox streak |
| `frontend/src/components/VeredictCard.tsx` | Streak + arquétipo |
| `render.yaml` | Declaração de 8 variáveis em falta (Groq, Cloudinary, PostHog, crons) |

---

## Variáveis de ambiente — estado

| Variável | Local (.env) | Render Dashboard | Notas |
|----------|-------------|-----------------|-------|
| GROQ_API_KEY | ✅ | ✅ (estava em falta no render.yaml, já declarada) | |
| CLOUDINARY_* | ✅ | ✅ | |
| POSTHOG_API_KEY | ✅ | ✅ | |
| CURATOR_API_KEY | ✅ | ✅ | |
| CRON_SECRET | ✅ | ⚠️ **A adicionar manualmente** | Valor no backend/.env |
| UNSPLASH_ACCESS_KEY | ✅ (vazio) | ⚠️ **A adicionar manualmente** | Registar em unsplash.com/developers |

---

## Cron jobs — estado

| Job | Endpoint | Schedule | Plataforma | Estado |
|-----|----------|----------|-----------|--------|
| Feed Curator | `POST /api/admin/cron/feed-curator` | 06h, 10h, 16h UTC | cron-job.org | ⚠️ A configurar |
| Streak Reminders | `POST /api/admin/cron/streak-reminders` | 20h UTC | cron-job.org | ⚠️ A configurar |
| Daily Challenge Reveal | `POST /api/admin/cron/daily-challenge-reveal` | 20h UTC | cron-job.org | ⚠️ A configurar |
| Curador de Eventos | `GET /api/curator/run?api_key=...` | Já configurado | Render | ✅ |

**Header de autenticação para todos os crons:**
```
Authorization: Bearer <CRON_SECRET do backend/.env>
```

---

## Próximos passos operacionais

1. ✅ Push GitHub feito (commits `136cbf0`, `e0bf513`, `3c05077`)
2. ✅ OTA update Expo publicado (update group `50038d4f`)
3. ✅ Render deploy confirmado — `3c05077` live às 20h42 de 22 Jun
4. ✅ `CRON_SECRET` adicionado no painel Render
5. ⚠️ `UNSPLASH_ACCESS_KEY` — a adicionar (Feed Curator sem imagem até lá)
6. ✅ 3 cron jobs criados em cron-job.org:
   - **Feed Curator (3x/dia)** — amanhã às 06h00 UTC
   - **Revelação do Desafio Diário (1x/dia)** — amanhã às 20h00 UTC
   - **Lembretes de Sequência (1x/dia)** — amanhã às 20h00 UTC
7. ⚠️ Criar primeiro Daily Challenge via `POST /api/admin/daily-challenge`
8. ⚠️ Testar push notifications no APK Android

---

## Decisões de produto tomadas

- **Auto-scale do curador:** mantém 3 posts/dia enquanto comunidade < 5 posts naturais/dia; reduz progressivamente. Quando ≥ 20 posts naturais/dia, curador inactivo.
- **Camada 1 (community)** é a mais importante e dominante no longo prazo.
- **Pipeline definido para depois:** quando comunidade crescer, a camada 1 absorve tudo e as camadas 2-4 tornam-se fallback cada vez mais raro.

---

> **Commits desta sessão:** `136cbf0` (5 sistemas) · `e0bf513` (pipeline 4 camadas curador)
