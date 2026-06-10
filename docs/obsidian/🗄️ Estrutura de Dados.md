# 🗄️ Estrutura de Dados
## Actualizado: 10 Junho 2026
### Legenda: ✅ Existe | 🆕 Novo (a implementar) | 🔄 Actualizar campo existente

---

## MongoDB — Collections

---

### `users` ✅ + 🔄 Campos novos

```json
{
  "_id": "ObjectId",
  "user_id": "google_xxx | apple_xxx | email_xxx",
  "email": "user@email.com",
  "name": "Nome do Utilizador",
  "avatar": "url_imagem",
  "auth_provider": "google | apple | email",
  "bw_balance": 0,
  "bw_total_earned": 0,
  "age_confirmed_at": "ISO timestamp",

  "daily_interactions": {                   
    "count": 0,
    "reset_date": "2026-06-10"
  },

  "admirers_count": 0,                      

  "bio": "Texto de apresentação",           
  "location": "Lisboa, Portugal",           

  "business_profile": {
    "company_name": "Empresa X",
    "tax_id": "PT123456789",
    "verified": true,
    "marketing_consent": false
  },

  "created_at": "ISO timestamp"
}
```

---

### `posts` ✅ + 🔄 Campos novos

```json
{
  "_id": "ObjectId",
  "post_id": "post_xxx",
  "user_id": "user_xxx",
  "word": "palavra",
  "media": [
    { "type": "image", "data": "base64..." }
  ],
  "vote_count": { "aprovo": 10, "desaprovo": 5 },
  "hype": 5,
  "hype_score": 23,                         
  "theme": "tema_id | null",
  "is_hype": true,
  "is_polarized": false,                    
  "prize": "descrição | null",
  "campaign_id": "camp_xxx | null",
  "event_id": "event_xxx | null",           
  "printable_card_url": "url | null",       
  "created_at": "ISO timestamp"
}
```

---

### `votes` ✅

```json
{
  "_id": "ObjectId",
  "post_id": "post_xxx",
  "user_id": "user_xxx",
  "vote": "aprovo | desaprovo",
  "geo": {
    "country": "Portugal",
    "country_code": "PT",
    "city": "Lisboa",
    "lat": 38.7223,
    "lon": -9.1393
  },
  "created_at": "ISO timestamp"
}
```

---

### `events` ✅ + 🔄 Campos novos

```json
{
  "_id": "ObjectId",
  "event_id": "event_xxx",
  "name": "Festival X",
  "description": "...",
  "type": "personal | enterprise_singular | enterprise_plural",  
  "date_start": "ISO timestamp",
  "date_end": "ISO timestamp",
  "location": {
    "address": "Rua X, Lisboa",
    "lat": 38.7223,
    "lon": -9.1393
  },
  "intent_tags": ["premios", "novidades", "networking"],         
  "qr_code_url": "url_do_qr_code",                              
  "checkins": ["user_id_1"],
  "posts_count": 0,
  "participants_count": 0,
  "prize": "descrição | null",
  "created_by": "user_xxx",
  "sponsor_tier": "bronze | prata | ouro | null",               
  "escrow_status": "pending | held | released | null",          
  "escrow_amount_cents": 0,                                      
  "sincronia_report_id": "report_xxx | null",                   
  "created_at": "ISO timestamp"
}
```

---

### `admirers` 🆕 (Fase 1)

```json
{
  "_id": "ObjectId",
  "user_id": "user_xxx",           
  "admired_user_id": "user_yyy",   
  "followed_at": "ISO timestamp"
}
```

**Índices necessários**:
- `{ user_id: 1 }` — "quem admiro"
- `{ admired_user_id: 1 }` — "quem me admira"
- `{ user_id: 1, admired_user_id: 1 }` — unique (não duplicar admirações)

---

### `user_memory` 🆕 (Fase 3)

```json
{
  "_id": "ObjectId",
  "user_id": "user_xxx",
  "personality_snapshot": {
    "dominant_themes": ["natureza", "tecnologia", "arte"],
    "avg_approval_rate": 0.72,
    "word_patterns": ["Silêncio", "Robusto", "Distante"],
    "behavioral_mode": "busca_por_ordem | exploração | blindagem"
  },
  "session_history": [
    {
      "date": "2026-06-10",
      "words_seen": 10,
      "votes": { "aprovo": 6, "desaprovo": 4 },
      "best_word": "Distante",
      "dominant_theme": "natureza"
    }
  ],
  "ai_summary": "Texto gerado por IA — perfil evolutivo. Max 500 chars.",
  "sessions_total": 12,
  "updated_at": "ISO timestamp"
}
```

**Notas**:
- `session_history`: máximo 30 entradas (FIFO — remove a mais antiga quando cheia)
- `personality_snapshot`: re-calculado após cada sessão
- `ai_summary`: re-gerado semanalmente pela IA com base no snapshot

---

### `user_insights` 🆕 (Fase 3)

```json
{
  "_id": "ObjectId",
  "user_id": "user_xxx",
  "date": "2026-06-10",
  "insight_text": "Texto do Espelho de Empatia. Max 3 frases.",
  "archetype": "contradicao_estrutural | eficiencia_percepcao | provocacao_realidade",
  "session_snapshot": { },   
  "generated_at": "ISO timestamp"
}
```

---

### `editorial_posts` 🆕 (Fase 2)

```json
{
  "_id": "ObjectId",
  "type": "word_of_day | trend_image | seed_content",
  "word": "Saudade",
  "image_url": "url",
  "theme": "tema_id | null",
  "suggested_by": "admin | ai_trend_motor",
  "bw_bonus": 5,                     
  "active_date": "2026-06-10",       
  "winning_post_id": "post_xxx | null",
  "created_at": "ISO timestamp"
}
```

---

### `sincronia_reports` 🆕 (Fase 4)

```json
{
  "_id": "ObjectId",
  "report_id": "report_xxx",
  "event_id": "event_xxx",
  "workspace_id": "ws_xxx",
  "generated_at": "ISO timestamp",
  "summary": {
    "total_votes": 247,
    "aprovo_pct": 68,
    "top_words": ["Inovador", "Robusto", "Distante"],
    "alignment_score": 0.72,
    "diagnosis": "A marca queria transmitir 'Inovação'. O público respondeu 'Complexo'."
  },
  "word_cloud_data": [ { "word": "Inovador", "count": 89 } ],
  "geo_heatmap": [ { "city": "Lisboa", "votes": 120, "aprovo_pct": 71 } ],
  "sentiment_by_day": [ { "date": "2026-06-10", "aprovo_pct": 65 } ]
}
```

---

### `campaigns` ✅

```json
{
  "_id": "ObjectId",
  "campaign_id": "camp_xxx",
  "user_id": "user_xxx",
  "workspace_id": "ws_xxx",
  "word": "palavra_alvo",
  "theme": "tema | null",
  "tier": "bronze | silver | gold | platinum",
  "status": "pending | active | completed | cancelled",
  "stripe_session_id": "cs_test_xxx",
  "payment_intent": "pi_test_xxx",
  "paid_at": "ISO timestamp | null",
  "starts_at": "ISO timestamp",
  "ends_at": "ISO timestamp",
  "amount_cents": 5000,
  "currency": "eur",
  "votes_collected": 0,
  "votes_target": 100,
  "created_at": "ISO timestamp"
}
```

---

### `workspaces` ✅

```json
{
  "_id": "ObjectId",
  "workspace_id": "ws_xxx",
  "user_id": "user_xxx",
  "company_name": "Empresa X",
  "email": "empresa@email.com",
  "tax_id": "PT123456789",
  "tax_country": "PT",
  "verified": false,
  "verification_token": "token_xxx",
  "marketing_consent": false,
  "created_at": "ISO timestamp"
}
```

---

### `themes` ✅

```json
{
  "_id": "ObjectId",
  "theme_id": "theme_1",
  "name": "Tecnologia",
  "icon": "code-outline",
  "color": "#FF6B6B"
}
```

---

### `notifications` ✅ + 🔄 Novos tipos

```json
{
  "_id": "ObjectId",
  "user_id": "user_xxx",
  "type": "milestone | prize_won | campaign_active | new_admirer | word_of_day_won | event_nearby | insight_ready",
  "title": "...",
  "body": "...",
  "read": false,
  "data": { },
  "created_at": "ISO timestamp"
}
```

**Novos tipos de notificação**:
- `new_admirer` — alguém te admirou
- `word_of_day_won` — a tua Best Word ganhou o dia
- `event_nearby` — evento abriu perto de ti
- `insight_ready` — Espelho de Empatia disponível

---

### `followed_styles` ✅ (seguir hypes/palavras — mantém-se)

```json
{
  "_id": "ObjectId",
  "user_id": "user_xxx",
  "word": "Minimalismo",
  "followed_at": "ISO timestamp"
}
```

---

## Resumo de Índices Recomendados

| Collection | Campo | Tipo |
|---|---|---|
| `users` | `user_id` | unique |
| `posts` | `user_id`, `created_at` | compound |
| `posts` | `word` | index (word links) |
| `votes` | `post_id`, `user_id` | compound unique |
| `admirers` | `user_id`, `admired_user_id` | compound unique |
| `user_memory` | `user_id` | unique |
| `user_insights` | `user_id`, `date` | compound unique |
| `editorial_posts` | `active_date` | index |
| `events` | `location` | 2dsphere (geo) |
