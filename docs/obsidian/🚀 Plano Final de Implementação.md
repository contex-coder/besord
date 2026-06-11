# 🚀 Plano Final de Implementação
## IMUTÁVEL — 10 Junho 2026
### Qualquer alteração de scope requer decisão explícita do fundador

---

> **Contexto**: O Besord é uma Plataforma B2B2C de Inteligência de Percepção. O plano abaixo é a sequência de entrega que maximiza a chance de lançamento com produto diferenciado. Cada fase tem um objectivo claro, tarefas concretas, ficheiros críticos e critérios de aceitação.

---

## ✅ FASE 0 — Saúde & Triage (CONCLUÍDA — 10 Jun 2026)

| Tarefa | Estado |
|---|---|
| Restaurar `perfil.tsx` (substituído por AuthContext) | ✅ |
| Fix race condition em `index.tsx` | ✅ |
| Fix `age_confirmed_at` no guard de navegação | ✅ |
| Fix iOS shadow (`shadowRadius: 0.5`) | ✅ |
| `STRIPE_WEBHOOK_SECRET` no Render | ✅ |
| Webhook rejeita assinaturas inválidas | ✅ |
| EAS Build configurado (`eas.json`, `android.package`) | ✅ |

---

## ⏳ FASE 1 — Identidade + Social Graph + Hooks de Retenção
### Semanas 3-5 | Objectivo: Razão para voltar todos os dias

**Princípio da fase**: sem grafo social (Admiradores) e sem Time-Gate, o Besord é apenas uma app de votação. Estas duas peças são a fundação de tudo o que se segue.

---

### 1.1 Sistema de Admiradores (user → user)

**O que é**: utilizadores podem admirar outros utilizadores e ver as suas publicações num feed dedicado. "Admirar" um *olhar*, não uma pessoa.

**Backend** — `backend/server.py`:
- `POST /api/users/{user_id}/admire` — admirar utilizador
- `DELETE /api/users/{user_id}/admire` — deixar de admirar
- `GET /api/users/{user_id}/admirers` — listar quem admira este utilizador
- `GET /api/users/me/admiring` — listar quem eu admiro
- `GET /api/feed/admired` — feed de publicações de quem admiro

**Nova collection**: `admirers { user_id, admired_user_id, followed_at }`

**Campo novo em `users`**: `admirers_count: int` (denormalizado para performance)

**Frontend**:
- Botão "Admirar / Admirando" em perfis e em posts
- Tab "Admirados" no feed principal (ao lado de "Global")
- Contador de admiradores no perfil (não em destaque — só visível ao entrar no perfil)

**Ficheiros críticos**:
- `frontend/src/app/(tabs)/feed.tsx` — tab Admirados
- `frontend/src/app/(tabs)/perfil.tsx` — botão + contagem
- `frontend/src/app/user/[id].tsx` — perfil público com botão Admirar

**Critérios de aceitação**:
- [ ] Posso admirar um utilizador e ver os seus posts num feed separado
- [ ] Contagem de admiradores é visível mas não é o elemento dominante do perfil
- [ ] Feed Admirados funciona sem posts de utilizadores que deixei de admirar

---

### 1.2 Word Links

**O que é**: clicar numa palavra em qualquer publicação navega para um feed filtrado com todas as publicações que usaram essa palavra.

**Implementação**: wrapper `TouchableOpacity` em torno do campo `word` em todos os componentes de post.

**Navegação**: `router.push('/word/' + word)` → ecrã `frontend/src/app/word/[word].tsx`

**Critérios de aceitação**:
- [ ] Clicar numa palavra abre feed filtrado por essa palavra
- [ ] Feed mostra todas as publicações com aquela palavra, ordenadas por hype

---

### 1.3 Time-Gate (10 interacções/dia)

**O que é**: cada utilizador tem 10 votos/interacções por dia. Quando esgota, o app encerra a sessão com mensagem.

**Backend**:
- Campo novo em `users`: `daily_interactions: { count: 0, reset_date: "ISO date" }`
- Middleware verifica limite antes de processar cada voto
- Reset automático à meia-noite UTC

**Frontend**:
- Contador subtil no topo do feed: "8 restantes hoje"
- Quando chega a 0: overlay com mensagem *"O mundo já te deu o suficiente por hoje. Vá viver."* + botão fechar app

**Critérios de aceitação**:
- [ ] Após 10 interacções o utilizador vê mensagem de encerramento
- [ ] Contador é visível mas não intrusivo
- [ ] Reset às meia-noite funciona correctamente

---

### 1.4 Onboarding Reposicionado

**O que é**: substituir linguagem de "rede social" por "diário de percepções".

**Copy novo** (substituir em `frontend/src/app/onboarding.tsx`):
- Ecrã 1: *"Chega de ruído. Cada dia, uma palavra. Cada palavra, uma percepção."*
- Ecrã 2: *"Não segues pessoas. Admiras olhares."*
- Ecrã 3: *"5 minutos que valem mais do que 5 horas no TikTok."*

**Ficheiro**: `frontend/src/app/onboarding.tsx`

**Critérios de aceitação**:
- [ ] Nenhum ecrã do onboarding menciona "rede social"
- [ ] A proposta de valor "diário de percepções" é clara para um utilizador novo

---

### 1.5 Modo Neutro (Moderação Básica)

**O que é**: posts com temas polémicos mostram UI diferente — sem comentários, só Aprovo/Desaprovo.

**Backend**:
- Campo novo em `posts`: `is_polarized: bool`
- Endpoint admin para marcar/desmarcar
- Futuramente: detecção automática por IA

**Frontend**:
- Se `is_polarized: true` → ocultar secção de comentários
- Badge subtil: "Modo Neutro — Só percepções aqui."

**Critérios de aceitação**:
- [ ] Posts marcados como polarizados não mostram comentários
- [ ] Admin pode activar/desactivar Modo Neutro por post

---

### 1.6 Migração CDN emergentagent.com

**O que é**: imagens em `onboarding.tsx` e `account-type.tsx` apontam para CDN externo que pode ficar offline.

**Acção**: substituir URLs por assets no repositório ou por serviço próprio (Cloudinary free tier ou Supabase Storage).

**Ficheiros**:
- `frontend/src/app/onboarding.tsx`
- `frontend/src/app/account-type.tsx`

---

## 🔄 FASE 2 — Crescimento + Primeiro Revenue
### Semanas 6-9 | Objectivo: 100 utilizadores diários activos e primeira receita B2B

> **ATENÇÃO — Fase 2 foi redesenhada em 11 Jun 2026** após revisão estratégica Red Team.
> Ver documento completo: [[📅 Sessão 11 Junho 2026]]
>
> **Princípio da nova Fase 2**: cada feature deve fazer uma de duas coisas — trazer utilizadores ou gerar receita. O que não faz nenhuma das duas, adia.
>
> **O que foi movido para Fase 3**: mapa com geolocalização, filtros de intenção, notificações push de proximidade, ranking dinâmico de Hypes, fluxo B2B self-serve completo. Estes itens requerem massa crítica que ainda não existe.

---

### 2.1 Instrumentação Analytics (PostHog) — FAZER PRIMEIRO

**Porquê antes de tudo:** sem dados, não sabemos o que está a funcionar. A D7 retention é a única métrica que valida se o produto tem futuro.

**Ferramenta:** PostHog (open source, self-hosted no Render, custo €0)

**Eventos críticos a instrumentar:**
```
install → onboarding_complete → first_vote → session_complete
→ veredito_viewed → veredito_shared → sincronia_received
→ d2_open → d7_open (MÉTRICA NORTE)
```

**North Star Metric:** `daily_active_words` — número de palavras únicas publicadas por dia.

**Thresholds de decisão:**
- D7 retention ≥ 35% → produto saudável, escalar
- D7 retention < 20% → problema de produto, não escalar antes de resolver

**Ficheiros críticos:**
- `frontend/src/app/_layout.tsx` — inicialização PostHog
- `backend/server.py` — eventos server-side nos endpoints críticos

**Critérios de aceitação:**
- [ ] Dashboard PostHog mostra funil completo de activação
- [ ] D7 retention é calculável após 7 dias de utilizadores reais

---

### 2.2 Veredito Card — Motor de Crescimento Orgânico

**O que é:** Card visual gerado automaticamente quando o Time-Gate fecha. Partilhável com um toque para Instagram Stories e WhatsApp.

**Porquê é prioritário:** é o mecanismo de crescimento orgânico. Sem isto, os utilizadores chegam mas não trazem amigos.

**Conteúdo do card:**
```
┌─────────────────────────────────┐
│   A MINHA PALAVRA DE HOJE       │
│                                 │
│   S I L Ê N C I O              │
│                                 │
│   73% APROVARAM                 │
│   8 em 10 votos: Natureza       │
│                                 │
│   BESORD — 10 VOTOS. UM DIA.   │
└─────────────────────────────────┘
```

**Implementação:**
- Trigger: quando `daily_interactions.count` atinge 10
- Overlay de encerramento de sessão mostra o card + botão "PARTILHAR"
- Partilha: React Native `Share.share()` + `react-native-view-shot` para capturar o card como imagem
- Backend: `GET /api/users/me/veredito` — retorna `{ word, approval_rate, dominant_theme, date }`

**Ficheiros críticos:**
- `frontend/src/components/VeredictCard.tsx` (novo)
- `frontend/src/app/(tabs)/feed.tsx` — overlay de sessão encerrada
- `backend/server.py` — endpoint `/api/users/me/veredito`

**Critérios de aceitação:**
- [ ] Card aparece automaticamente quando Time-Gate fecha
- [ ] Partilha abre Instagram Stories / WhatsApp com o card como imagem
- [ ] Design é Neo-Brutalist e distinguível num feed de Instagram

---

### 2.3 Sincronia — Motor de Retenção Social

**O que é:** Quando dois utilizadores que se admiram mutuamente completam sessão no mesmo dia, o sistema compara os seus padrões de voto e notifica ambos.

**Tipos de notificação:**
- Convergência (≥ 6 votos iguais): *"Tu e [Nome] estiveram em sincronia hoje."*
- Divergência (≥ 7 votos opostos): *"Tu e [Nome] viram o mundo de forma completamente diferente hoje."*

**Porquê é poderoso:** esta notificação leva o utilizador a abrir o WhatsApp e falar ao amigo. Essa conversa privada converte em novos utilizadores muito mais do que um story público.

**Condições:**
- Apenas entre admiradores mútuos
- Ambos completaram sessão no mesmo dia (UTC)
- Máximo 3 notificações Sincronia por dia por utilizador
- Activar apenas quando ≥ 50 utilizadores activos com ≥ 3 admiradores mútuos em média

**Implementação:**
- Nova collection: `sincronia_logs { user_a, user_b, date, type, score }`
- Função `calculate_sincronia(user_id)` chamada após session complete
- Backend: lógica em `backend/server.py` ou novo `backend/sincronia.py`

**Critérios de aceitação:**
- [ ] Notificação enviada quando dois admiradores mútuos completam sessão no mesmo dia
- [ ] Taxa de abertura da notificação Sincronia ≥ 40%

---

### 2.4 Besord Primeiro Olhar — Primeiro Produto Comercial B2B

**O que é:** Evento B2B simplificado de 48 horas. Uma marca sobe 5 imagens, a comunidade vota e escolhe palavras, a marca recebe o Relatório de Sincronia.

**Posicionamento:**
> "Em 48 horas, sabe que palavra o teu público escolheria para a tua nova colecção."

**Target:** Marcas de moda portuguesa e brasileira a lançar colecções.

**Preços aprovados:**
| Produto | Preço |
|---|---|
| Primeiro cliente | €500 (troca por testemunho) |
| 2º–3º cliente | €1.200 |
| Evento Singular completo | €2.500 |

**Fluxo (semi-manual inicialmente):**
1. Admin cria evento via painel admin
2. Partilha link com a marca
3. 48 horas de votação
4. Relatório entregue por email (PDF gerado por `backend/reports.py`)

**Relatório inclui:**
- Imagem com maior aprovação
- Top 10 palavras escolhidas pela comunidade
- **Diagnóstico de desalinhamento** (chave de venda): *"A marca pretendia transmitir 'Inovação'. O público respondeu 'Complexo'. Desalinhamento de 73%."*

**Ficheiros críticos:**
- `backend/server.py` — novo tipo de evento `"primeiro_olhar"`
- `backend/reports.py` (novo) — geração do relatório PDF
- `backend/server.py` — endpoint `GET /api/events/{id}/primeiro-olhar-report`

**Critérios de aceitação:**
- [ ] Admin consegue criar evento "Primeiro Olhar" em menos de 5 minutos
- [ ] Relatório PDF gerado automaticamente após 48h
- [ ] Diagnóstico de desalinhamento aparece no relatório
- [ ] Primeiro cliente paga e recebe relatório

---

### 2.5 Word of the Day + Conteúdo Seed

**Word of the Day:**

**Endpoint admin**: `POST /api/editorial/word-of-day { image_url, suggested_theme, bw_bonus }`

**Frontend**: card especial no topo do feed com label "PALAVRA DO DIA"

**Mecânica**:
- Qualquer utilizador pode votar
- Best Word mais votada às 23:59 UTC recebe +5 B$
- Razão diária para abrir o app

**Conteúdo Seed:**

**Script**: `backend/scripts/seed_content.py`
- 50 imagens curadas (Unsplash/Pexels — regras do Filtro Besord: sem texto, sem poses, espaço de respiro)
- Publicadas pela conta `@besord`
- Distribuídas pelos principais temas

**Critério**: feed global tem ≥ 30 posts activos antes de convidar os primeiros Fundadores.

**Ficheiros críticos:**
- `backend/server.py` — endpoint word-of-day
- `frontend/src/app/(tabs)/feed.tsx` — card especial no topo
- `backend/scripts/seed_content.py` (novo)

**Critérios de aceitação:**
- [ ] Word of the Day aparece no topo do feed com destaque visual
- [ ] Feed tem ≥ 30 posts antes do lançamento aos Fundadores

---

### O que foi movido para Fase 3

| Item | Razão do adiamento |
|---|---|
| Mapa com geolocalização completa | Requer eventos reais existentes |
| Filtros de intenção no mapa | Requer massa crítica |
| Notificações push de proximidade | Requer eventos físicos reais |
| Ranking dinâmico de Hypes | Requer volume de votos suficiente |
| Fluxo B2B self-serve (4 passos automatizados) | Automatizar só após 3 clientes validados |

---

## ⏳ FASE 3 — Camada de IA
### Semanas 10-12 | Objectivo: O Besord "aprende" o utilizador

**Princípio da fase**: a IA não substitui o utilizador — provoca, o utilizador escolhe. É o motivo de voltar amanhã.

---

### 3.1 user_memory Collection

**Nova collection MongoDB**:
```json
{
  "user_id": "user_xxx",
  "personality_snapshot": {
    "dominant_themes": ["natureza", "tecnologia"],
    "avg_approval_rate": 0.72,
    "word_patterns": ["Silêncio", "Robusto"],
    "behavioral_mode": "busca_por_ordem"
  },
  "session_history": [
    { "date": "ISO", "words_seen": 10, "votes": { "aprovo": 6, "desaprovo": 4 }, "best_word": "Distante" }
  ],
  "ai_summary": "Texto gerado por IA — perfil evolutivo",
  "updated_at": "ISO timestamp"
}
```

**Actualizado automaticamente** após cada sessão (quando o utilizador atinge o Time-Gate ou fecha o app)

---

### 3.2 Espelho de Empatia

**Endpoint**: `POST /api/insights/daily` (chamado pelo utilizador, opcional)

**Input para a IA** (compacto, minimiza tokens):
```
personality_snapshot + sessão_de_hoje (palavras vistas, votos, padrões)
```

**Prompt do sistema** (imutável):
> "Atue como analista comportamental estoico. Analise as escolhas do utilizador nesta sessão e escreva um feedback de no máximo 3 frases. Tom directo, desprovido de sentimentalismo, focado em contradições lógicas ou padrões de valor observados. Não use palavras como 'esperança', 'coração' ou 'bem-estar'. Seja clínico e assertivo."

**Provider**: `backend/ai_provider.py` (Gemini 1.5 Flash → Groq fallback)

**Frontend**: botão "Ver o meu Espelho de hoje" no ecrã de encerramento de sessão (Time-Gate)

---

### 3.3 ai_provider.py (Abstracção de IA)

```python
# Interface unificada — qualquer provider, mesmo código
async def generate_insight(prompt: str, context: dict) -> str:
    # Tenta Gemini → Groq → Mistral
    # Retorna string com o insight
```

**Providers suportados**: Gemini 1.5 Flash, Groq + Llama 3.1, Mistral

---

### 3.4 Printable Effect

**Endpoint**: `POST /api/posts/{post_id}/printable-card`

**Output**: imagem PNG com:
- A imagem original do post (crop quadrado)
- A palavra em tipografia Neo-Brutalist
- Insight da IA (max 1 linha)
- Logo Besord subtil no canto

**Biblioteca**: Pillow (já instalada)

**Frontend**: botão "Criar card" em posts; partilha directa para Instagram/WhatsApp

---

## ⏳ FASE 4 — B2B + Escala
### Semanas 13-16 | Objectivo: Produto B2B vendável

**Princípio da fase**: só faz sentido com audiência estabelecida. Não avançar antes de Fase 3 estar completa.

---

### 4.1 Relatórios de Sincronia

**Endpoint**: `GET /api/events/{event_id}/sincronia-report`

**Output**:
- Nuvem de palavras dos votantes
- Índice de sentimento: % aprovação + palavras dominantes
- Heatmap geolocalizado de votos
- Diagnóstico: "A marca queria X, o público disse Y"

**Frontend**: `frontend/src/app/business/sincronia-report.tsx`

---

### 4.2 Faixas de Patrocínio Actualizadas

**Actualizar** `backend/pricing.py`:

| Faixa | Inclui |
|---|---|
| Bronze | Slot básico de post num evento |
| Prata | Post + destaque no mapa + notificação regional |
| Ouro | Post + destaque + Relatório de Sincronia completo |

---

### 4.3 Sintonizados

**Algoritmo**: comparar `personality_snapshot` entre utilizadores (similaridade de word_patterns + dominant_themes)

**Endpoint**: `GET /api/users/me/sintonizados` — lista de utilizadores com perfil similar

**Frontend**: secção "Sintonizados" no perfil — "Estes utilizadores vêem o mundo de forma parecida à tua"

---

### 4.4 Besord como Filtro do Instagram

**Deep link**: `besord://analyze?image_url=...`

Permite enviar imagem de qualquer app para o Besord → utilizador dá Best Word → recebe insight imediato.

**Landing page externa para eventos**: quando alguém clica no link de um evento partilhado no Instagram → página web responsiva do Besord → mostra o evento mas para participar requer instalação.

---

## 📋 REGRAS DO PROCESSO (Para Cada Sessão de Desenvolvimento)

1. **Fase 0 antes de tudo** — qualquer bug crítico detectado bloqueia o avanço
2. **Uma fase de cada vez** — não começar Fase 2 sem Fase 1 concluída e testada
3. **Após cada sessão**:
   ```bash
   export PATH="$HOME/.npm-global/bin:$PATH"
   cd frontend
   EXPO_TOKEN="wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd" eas update --branch main --message "descrição"
   ```
4. **Design**: nunca alterar `theme.ts` sem aprovação do fundador
5. **IA**: sempre usar `ai_provider.py` — nunca chamar uma API de IA directamente

---

> **Última actualização:** 10 Junho 2026
