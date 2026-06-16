# 📐 Arquitetura
## Atualizado: 16 Junho 2026

## Stack Tecnológica

```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │  HTTP   │   Backend        │
│   React Native  │◄───────►│   FastAPI        │
│   Expo Router   │  REST   │   Python 3.11    │
│   TypeScript    │         │   Uvicorn        │
│   Vercel        │         │   Render (Docker)│
└─────────────────┘         └────────┬────────┘
                                     │
                           ┌─────────▼─────────┐
                           │   Cloudinary CDN   │
                           │   (Imagens)         │
                           └────────┬───────────┘
                                     │
                           ┌─────────▼─────────┐
                           │   MongoDB Atlas    │
                           │   (M0 Free Tier)   │
                           └───────────────────┘
```

## URLs Ativas

| Componente | URL | Status |
|---|---|---|
| **Frontend** | https://besord.vercel.app | ✅ Online |
| **Backend API** | https://besord-backend.onrender.com | ✅ Live |
| **Stripe Webhook** | `POST /api/stripe/webhook` | ✅ 200 OK |

## Dependências Principais

### Frontend (`frontend/package.json`)
- `expo ~54.0.35` — SDK mais recente
- `expo-router ~6.0.24` — Navegação baseada em ficheiros
- `react-native 0.81.5` — Última versão estável
- `react 19.1.0` — React mais recente
- `react-native-reanimated ~4.1.1` — Animações
- `expo-video` — Reprodução de vídeos
- `expo-image` — Imagens otimizadas

### Backend (`backend/requirements.txt`)
- `fastapi 0.110.1` — Framework web
- `uvicorn 0.25.0` — Servidor ASGI
- `pymongo 4.5.0` — Driver MongoDB
- `motor 3.3.1` — Driver async MongoDB
- `stripe 14.4.1` — Pagamentos
- `Pillow 12.2.0` — Processamento de imagens
- `resend 2.30.1` — Emails transacionais
- `cloudinary 1.43.0` — CDN de imagens (16 Jun)
- `httpx` — HTTP client async (fontes curador)
- `groq` — Cliente Groq API (llama-3.1-8b-instant)

## Ficheiros Importantes

| Ficheiro | Descrição |
|---|---|
| `backend/server.py` | Todo o backend FastAPI (~3800+ linhas) |
| `backend/workspaces.py` | Lógica de empresas, VIES, CNPJ, NIF |
| `backend/pricing.py` | Tiers de preços (Bronze/Silver/Gold/Platinum) |
| `backend/email_alerts.py` | Notificações por email via Resend |
| `backend/storage.py` | Upload/delete imagens Cloudinary (16 Jun) |
| `backend/curator.py` | Curador Automático — pipeline 5 estágios (16 Jun) |
| `backend/sources.py` | Fontes whitelist — 15 queries Google News RSS (16 Jun) |
| `frontend/src/contexts/AuthContext.tsx` | Autenticação, User type, API fetch |
| `frontend/src/theme.ts` | Tema global: cores, brutalShadow |
| `Dockerfile` | Build Docker do backend (Python 3.11) |
| `render.yaml` | Configuração do Render |

---

## Collections MongoDB (estado 16 Jun 2026)

| Collection | Campos-chave | Notas |
|---|---|---|
| `users` | `user_id`, `email`, `bw_balance`, `bw_total_earned`, `daily_interactions`, `has_business`, `is_admin`, `founder_number` | `daily_interactions: {count, reset_date}` |
| `posts` | `post_id`, `author_id`, `word`, `image_url`, `image_base64`, `aprovo_count`, `desaprovo_count`, `is_sponsored`, `campaign_id`, `event_id`, `is_primeiro_olhar`, `theme` | `image_url` preferido sobre `image_base64` (Cloudinary) |
| `votes` | `post_id`, `user_id`, `vote_type`, `best_word`, `created_at` | `best_word` = palavra comentada pelo votante; +2 B$ se preenchida |
| `events` | `event_id`, `company_id`, `title`, `image_url`, `event_type`, `status`, `lat`, `lon`, `date`, `duration_days`, `has_raffle`, `sponsorships_enabled`, `source`, `curator_confidence`, `curator_source_url` | `event_type`: `pessoal` / `singular` / `plural` / `primeiro_olhar` / `curated` |
| `campaigns` | `campaign_id`, `workspace_id`, `post_id`, `word`, `tier_key`, `status`, `target_country_code`, `target_region`, `target_city` | |
| `workspaces` | `workspace_id`, `owner_user_id`, `company_name`, `nif`, `verified` | |
| `admirers` | `user_id`, `admired_user_id`, `followed_at` | |
| `sincronia_logs` | `pair_id`, `user_id_a`, `user_id_b`, `date`, `agreement_rate`, `insight_text` | |
| `event_queue` | `queue_id`, `title`, `date`, `location_name`, `city`, `theme`, `confidence_overall`, `status`, `expires_at` | Curador — TTL 48h. `status`: `pending_review` / `approved` / `rejected` |
| `founder_invites` | `code`, `invited_by_user_id`, `used_by_user_id`, `founder_number` | |
| `editorial_posts` | `type`, `word`, `image_url`, `active_date`, `bw_bonus` | Word of the Day |
| `user_memory` | `user_id`, `personality_snapshot`, `session_history`, `ai_summary` | Fase 3 |

---

## Tipos de Evento (event_type)

| Tipo | Quem cria | Criação | Pagamento | Revenue |
|---|---|---|---|---|
| `pessoal` | Utilizador >= 1.000 B$ | Gratuita | Patrocínios opcionais | 70-80% criador |
| `singular` | Empresa | Gratuita | 9,99/imagem ou pack 49,99 | 100% Besord |
| `plural` | Promotor | Gratuita | Expositoras pagam por imagem | 100% Besord |
| `curated` | Curador Automático | Automática (cron 2x/dia) | Nenhum | 100% Besord |
| `primeiro_olhar` | Admin (B2B) | Manual | 79,90 / 149 / 299 | 100% Besord |

---

## Endpoints Principais (16 Jun 2026)

### Eventos
| Endpoint | Método | Descrição |
|---|---|---|
| `POST /api/events` | POST | Criar evento (pessoal/singular/plural) — gratuito |
| `GET /api/events` | GET | Listar com filtros |
| `GET /api/events/{id}` | GET | Detalhe |
| `GET /api/events/nearby` | GET | Busca geo |
| `GET /api/events/search` | GET | Pesquisa por cidade |
| `POST /api/events/{id}/checkin` | POST | Geo check-in (raio 2km) |
| `POST /api/events/{id}/publish-image` | POST | Publicar imagem (9,99 ou pack 49,99) |
| `POST /api/events/{id}/join-as-exhibitor` | POST | Entrar como expositora (plural) |
| `POST /api/events/{id}/raffle` | POST | Executar sorteio |
| `POST /api/events/primeiro-olhar` | POST | Admin cria Primeiro Olhar |
| `GET /api/events/{id}/primeiro-olhar-report` | GET | Relatório com diagnóstico Groq |

### Campanhas
| Endpoint | Método | Descrição |
|---|---|---|
| `POST /api/campaigns` | POST | Criar campanha (Stripe checkout) |
| `GET /api/campaigns` | GET | Listar minhas campanhas |
| `GET /api/campaigns/{id}` | GET | Detalhe + top palavras aprovadas/rejeitadas |
| `POST /api/campaigns/{id}/cancel` | POST | Cancelar |

### Utilizador / Feed
| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/users/me/daily-status` | GET | Interacções restantes hoje |
| `GET /api/users/me/veredito` | GET | Dados do Veredito Card |
| `GET /api/users/me/sincronia` | GET | Logs de sincronia do dia |
| `GET /api/insights/session` | GET | Espelho de Sessão (Groq) |
| `GET /api/editorial/word-of-day/today` | GET | Palavra do Dia |

### Curador Automático (16 Jun 2026)
| Endpoint | Método | Descrição |
|---|---|---|
| `POST /api/curator/run?api_key=...` | POST | Executa pipeline completo |
| `GET /api/admin/event-queue` | GET | Lista eventos pendentes de revisão |
| `POST /api/admin/event-queue/{id}/approve` | POST | Aprova e insere na BD |
| `POST /api/admin/event-queue/{id}/reject` | POST | Rejeita da fila |
