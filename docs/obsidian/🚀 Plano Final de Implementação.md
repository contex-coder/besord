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

## ⏳ FASE 2 — Motor de Eventos + Conteúdo Editorial
### Semanas 6-9 | Objectivo: O painel de eventos funciona com magistralidade

**Princípio da fase**: o painel de eventos é o produto físico do Besord — leva o utilizador ao mundo real. Tem de funcionar sem fricção. O conteúdo editorial resolve o Cold Start.

---

### 2.1 Painel de Eventos Redesenhado

**Mapa com filtros de intenção** (não apenas por proximidade):
- "Quero ganhar prémios"
- "Quero conhecer novidades"
- "Quero networking"
- "Quero experiências culturais"

**QR Code de entrada** gerado automaticamente para cada evento.

**Fluxo de participação via QR**:
```
Scan QR → Deep link besord://evento/{id} → App abre directamente no evento → Utilizador vota e participa
```

**Barra de progresso** do evento: "Faltam 2 dias" / "47 participantes"

**Notificação push** quando evento abre perto de ti (raio configurável pelo utilizador)

**Ficheiros críticos**:
- `frontend/src/app/(tabs)/mapa.tsx` — redesign do mapa
- `backend/server.py` — endpoint QR Code + filtros de intenção

---

### 2.2 Fluxo B2B de Criação de Evento (4 passos, ≤ 3 minutos)

**CONSTRAINT IMUTÁVEL: máximo 4 passos, zero campos opcionais obrigatórios, QR Code gerado automaticamente no fim.**

```
Passo 1: Nome + Tipo (Personal / Singular / Plural)
Passo 2: Subir foto (Filtro Besord aplicado automaticamente)
Passo 3: Definir prémio do sorteio (opcional mas sugerido)
Passo 4: Confirmar → QR Code gerado → Partilhar
```

**Ficheiro**: `frontend/src/app/business/create-event.tsx`

---

### 2.3 3 Tipos de Evento no Schema

**Campo novo em `events`**: `type: "personal" | "enterprise_singular" | "enterprise_plural"`

**Campo novo em `events`**: `escrow_status: "pending" | "held" | "released" | null`

**Regras de escrow para eventos Pessoais**:
- Pagamento retido pelo Besord até conclusão do evento
- Repasse ao criador após: evento terminado + relatório entregue
- Split: 70-80% criador / 20-30% Besord

---

### 2.4 Conteúdo Seed

**Script admin**: `backend/scripts/seed_content.py`
- Ingere 200 imagens do banco curado (Unsplash/Pexels, filtro Besord aplicado)
- Publica como posts da conta `@besord`
- Distribuídas pelos principais temas/hypes

**Critério**: no dia de lançamento, o feed global tem ≥ 50 posts activos

---

### 2.5 Word of the Day

**Endpoint admin**: `POST /api/editorial/word-of-day { image_url, suggested_theme, bw_bonus }`

**Frontend**: card especial no topo do feed com label "Palavra do Dia"

**Mecânica**:
- Qualquer utilizador pode votar
- Best Word mais votada às 23:59 recebe BW bónus (configurável pelo admin)
- Razão diária para abrir o app

---

### 2.6 Hypes com Ranking Dinâmico

**Score temporal** (substituir lógica actual de `is_hype: bool`):
```python
hype_score = (votes_last_48h * 2) + total_votes
```

**Distinção visual**: Hypes "em chamas" (últimas 48h) vs. Hypes "clássicos" (all-time)

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
