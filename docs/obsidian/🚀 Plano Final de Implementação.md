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

## ✅ FASE 1 — Identidade + Social Graph + Hooks de Retenção (CONCLUÍDA — 11 Jun 2026)
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
- [x] Dashboard PostHog mostra funil completo de activação *(conta criada, chave configurada no Render + Vercel, eventos a disparar: app_opened, vote_cast, session_complete, onboarding_complete, veredito_shared)*
- [ ] D7 retention é calculável após 7 dias de utilizadores reais *(aguarda utilizadores reais — calculável a partir de 18 Jun 2026)*

**Provider:** Groq (llama-3.1-8b-instant) — conta gratuita, sem cartão de crédito. Região PostHog: US Cloud.

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
- [x] Card aparece automaticamente quando Time-Gate fecha *(VeredictCard.tsx + showVeredito state no feed.tsx)*
- [ ] Partilha abre Instagram Stories / WhatsApp com o card como imagem *(Share.share() funciona como texto; captura como imagem requer react-native-view-shot — Fase 3)*
- [x] Design é Neo-Brutalist e distinguível num feed de Instagram

---

### 2.3 Sincronia — Motor de Retenção Social

**O que é:** Quando dois utilizadores que se admiram mutuamente completam sessão no mesmo dia, o sistema compara os seus padrões de voto e notifica ambos.

**Tipos de resultado (conf. ⚙️ Regras de Negócio):**
| Tipo | Condição | Acção |
|---|---|---|
| Convergência | ≥ 6 votos iguais | Notificar ambos |
| Divergência | ≥ 7 votos opostos | Notificar ambos |
| Neutro | 4–6 coincidências | Sem notificação — registo guardado mas silencioso |

> ⚠️ **Gap actual**: a implementação de 11 Jun guarda todos os resultados (incluindo Neutro) em `sincronia_logs`. O filtro Neutro deve ser aplicado na Fase 3 quando as notificações push forem activadas.

**Porquê é poderoso:** esta notificação leva o utilizador a abrir o WhatsApp e falar ao amigo. Essa conversa privada converte em novos utilizadores muito mais do que um story público.

**Condições:**
- Apenas entre admiradores mútuos
- Ambos completaram sessão no mesmo dia (UTC)
- Máximo 3 notificações Sincronia por dia por utilizador
- Activar apenas quando ≥ 50 utilizadores activos com ≥ 3 admiradores mútuos em média

**Implementação (realizada 11 Jun 2026):**
- Collection: `sincronia_logs { pair_id, user_id_a, user_id_b, date, agreement_rate, posts_in_common, agreements, insight_text, created_at }`
- `calculate_sincronia(user_id, date)` — chamada como `asyncio.create_task()` em `vote_post` quando `remaining == 0`
- `_groq_insight(agreement_rate, posts_in_common)` — gera frase poética via Groq `llama-3.1-8b-instant`
- `GET /api/users/me/sincronia` — devolve registos do dia com nome do outro utilizador

**Critérios de aceitação:**
- [x] Lógica de convergência calculada quando dois admiradores mútuos completam sessão no mesmo dia *(calculate_sincronia() + sincronia_logs collection + Groq insight)*
- [x] Endpoint GET /api/users/me/sincronia implementado
- [ ] Notificação push enviada ao utilizador *(push notifications — Fase 3, requer expo-notifications)*
- [ ] Taxa de abertura da notificação Sincronia ≥ 40% *(métricas só com utilizadores reais)*

---

### 2.4 Besord Primeiro Olhar — Primeiro Produto Comercial B2B

**O que é:** Evento B2B simplificado de 48 horas. Uma marca sobe 5 imagens, a comunidade vota e escolhe palavras, a marca recebe o Relatório de Sincronia com **diagnóstico de desalinhamento gerado por Groq**.

**Posicionamento:**
> "Em 48 horas, sabe que palavra o teu público escolheria para a tua nova colecção."

**Target:** Marcas de moda portuguesa e brasileira a lançar colecções.

**Preços aprovados (conf. ⚙️ Regras de Negócio — 15 Jun 2026):**
| Produto | Preço | Condição |
|---|---|---|
| Primeiro Olhar — 1.º cliente | **€79,90** | Troca por testemunho + autorização dados anónimos |
| Primeiro Olhar — sessão avulso | **€149** | Clientes recorrentes, sem case study |
| Primeiro Olhar — 2.º–3.º cliente | **€299** | Com case study do 1.º cliente |

**Fluxo (semi-manual, venda directa por Rodrigo):**
1. Admin cria evento via endpoint admin
2. Partilha link com a marca
3. 48 horas de votação
4. Relatório entregue via URL partilhável (página web formatada)

**Relatório inclui:**
- Imagem com maior aprovação
- Top 10 palavras escolhidas pela comunidade
- **Diagnóstico de desalinhamento** (gerado por Groq, obrigatório): *"A marca pretendia transmitir 'Inovação'. O público respondeu 'Complexo'. Desalinhamento de 73%."*
- Distribuição geográfica dos votantes

**Ficheiros críticos:**
- `backend/server.py` — tipo de evento `"primeiro_olhar"` (já implementado)
- `backend/server.py` — endpoint `GET /api/events/{id}/primeiro-olhar-report` (diagnóstico Groq a implementar em Fase 3)

**Critérios de aceitação:**
- [x] Admin consegue criar evento "Primeiro Olhar" via endpoint
- [x] Relatório JSON gerado após 48h
- [x] Diagnóstico de desalinhamento gerado por Groq aparece no relatório *(implementado 15 Jun)*
- [ ] Página web formatada com relatório (URL partilhável) *(Fase 4)*
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

### 2.6 Espelho de Sessão Simplificado — Diferenciador Crítico

> **⚠️ MOVIDO DA FASE 3 — Decisão aprovada em 14 Jun 2026**
> **Justificativa:** O "momento Jobs" do produto estava na Fase 3. Um utilizador nas Fases 1 e 2 não percebia porque o Besord era diferente de qualquer app de votação. O produto precisa de valor solitário — o Espelho funciona com um único utilizador, ao contrário de Sincronia e Admiradores.

**O que é:** Versão simplificada do Espelho de Empatia — sem `user_memory`, usando apenas dados da sessão do dia. 1 chamada Groq. 3 frases no ecrã de encerramento do Time-Gate.

**Dados de input (apenas sessão actual):**
- Palavras vistas (lista dos posts votados)
- Taxa de aprovação (% Aprovo vs. Desaprovo)
- Tema dominante nos votos

**Output:** Frase gerada por Groq no tom do Espelho de Empatia (estoico, directo, sem sentimentalismo).

**Ficheiros críticos:**
- `backend/server.py` — endpoint `GET /api/insights/session`
- `frontend/src/app/(tabs)/feed.tsx` — exibir frase no overlay de encerramento
- `frontend/src/components/VeredictCard.tsx` — opcionalmente incluir no card

**Critérios de aceitação:**
- [ ] Frase gerada por Groq aparece no ecrã de encerramento (após 10 votos)
- [ ] Tom é estoico e directo (não usa "jornada", "coração", "bem-estar")
- [ ] Fallback silencioso se Groq falhar (sem mensagem de erro)

---

### 2.7 Sistema de Convite Fundador — Tracking & Cerimónia

> **⚠️ ADICIONADO EM 14 Jun 2026 — Não estava no plano original**
> **Justificativa:** "100 convites pessoais" sem mecanismo de tracking é uma intenção, não um plano. Badge "Fundador #47" cria efeito de pertença muito superior a um link público. Tracking de origem permite perceber qual grupo social converte melhor.

**O que é:** Sistema mínimo de código de convite + badge permanente + página de entrada.

**Backend:**
- Nova collection: `founder_invites { code, invited_by_user_id, used_by_user_id, used_at, founder_number }`
- `POST /api/founders/invite` (admin) — gera código único
- `GET /api/founders/validate/{code}` — valida e retorna info do convidante
- Campo novo em `users`: `founder_number: int | null`

**Frontend:**
- `frontend/src/app/fundador/[code].tsx` — página de entrada: "Foste convidado por [Nome]. Entra nos primeiros 100."
- Badge "Fundador #47" visível no perfil (permanente, mesmo com 1M utilizadores)

**Critérios de aceitação:**
- [ ] Admin consegue gerar código de convite em < 30 segundos
- [ ] Utilizador que entra via código recebe badge permanente com número sequencial
- [ ] Página de convite mostra nome do convidante e número disponível ("Entras como Fundador #47")

---

### Estratégia de Aquisição dos 100 Fundadores — ACTUALIZADA (14 Jun 2026)

> **Decisão aprovada:** Em vez de 100 indivíduos dispersos, seleccionar 4–6 grupos sociais densos.

**Porquê grupos e não indivíduos:** Dois desconhecidos raramente se admiram mutuamente na primeira semana. A Sincronia precisa de densidade social. Dentro de um grupo existente, a Sincronia activa-se na primeira semana — exactamente como o Facebook começou em Harvard.

**Grupos alvo:**
- 1 agência de publicidade em Lisboa (15–20 pessoas que já se conhecem)
- 1 grupo de fotógrafos/directores criativos
- 1 grupo de copywriters (LinkedIn ou WhatsApp)
- 1 turma de mestrado de design ou comunicação
- 1 redacção de revista ou media cultural

### Build iOS TestFlight — ADICIONADO (14 Jun 2026)

> **Decisão aprovada:** Gerar build iOS antes de lançar convites. O utilizador-alvo (criativos, copywriters) tem taxa de iPhone muito acima da média.

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="<ver frontend/.env>" eas build --platform ios --profile preview
```

### Primeira Venda B2B — NÃO AGUARDAR 100 FUNDADORES (14 Jun 2026)

> **Decisão aprovada:** O Primeiro Olhar pode ser vendido com 15–20 utilizadores testadores.

**Sequência:**
1. Instalar app em 15–20 pessoas conhecidas (Semana 1)
2. Contactar 1 marca pequena com proposta Primeiro Olhar (Semana 1 — simultaneamente)
3. Fazer evento com os 15–20 (Semana 2)
4. Entregar relatório PDF manual (Semana 2)
5. Usar caso para convencer segundo cliente (Semana 3)

---

### O que foi movido para Fase 3

### Estado final da Fase 2 (14 Jun 2026)

| Item | Estado |
|---|---|
| 2.1 PostHog analytics | ✅ Live |
| 2.2 VeredictCard + overlay Time-Gate | ✅ Live |
| 2.3 Sincronia (backend + Groq insight) | ✅ Live |
| 2.4 Besord Primeiro Olhar | ✅ Backend live — 1ª venda pendente (Rodrigo) |
| 2.5 Word of the Day + 50 posts seed | ✅ Código live — calendário editorial pendente (Rodrigo) |
| 2.6 Espelho de Sessão Simplificado | ✅ Live (Groq, VeredictCard) |
| 2.7 Sistema de Convite Fundador | ✅ Live (endpoints + página /fundador/[code]) |
| iOS TestFlight | ⏳ Pendente — `eas build --platform ios --profile preview` |
| Word Links (filtro por palavra) | ✅ Corrigido 14 Jun — `?word=` agora funciona no backend |
| GET /api/trends | ✅ Implementado 14 Jun — 24h/7d/30d + scope |
| Hypes tab | ✅ Corrigido 14 Jun — removido source=styles |

---

### O que foi movido para Fase 3

| Item | Razão do adiamento |
|---|---|
| Mapa com geolocalização completa | Requer eventos reais existentes |
| Filtros de intenção no mapa | Requer massa crítica |
| Notificações push de proximidade | Requer eventos físicos reais |
| Ranking dinâmico de Hypes | Requer volume de votos suficiente |
| Fluxo B2B self-serve (4 passos automatizados) | Automatizar só após 3 clientes validados |
| Espelho de Empatia completo (com user_memory) | Versão simplificada entra na Fase 2 (2.6) |

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

**Provider**: `backend/ai_provider.py` (Groq llama-3.1-8b-instant → Gemini fallback quando disponível)

**Frontend**: botão "Ver o meu Espelho de hoje" no ecrã de encerramento de sessão (Time-Gate)

---

### 3.3 ai_provider.py (Abstracção de IA)

```python
# Interface unificada — qualquer provider, mesmo código
async def generate_insight(prompt: str, context: dict) -> str:
    # Tenta Gemini → Groq → Mistral
    # Retorna string com o insight
```

**Providers suportados**: Groq + Llama 3.1 (✅ configurado, primário), Gemini 1.5 Flash (pendente activação), Mistral (reserva)

> **Decisão 11 Jun 2026**: Gemini exige cartão de crédito para activar quota. Groq adoptado como provider primário — 14.400 req/dia grátis, sem cartão.

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
   EXPO_TOKEN="<ver frontend/.env>" eas update --branch main --message "descrição"
   ```
4. **Design**: nunca alterar `theme.ts` sem aprovação do fundador
5. **IA**: sempre usar `ai_provider.py` — nunca chamar uma API de IA directamente

---

> **Última actualização:** 16 Junho 2026 — **Fase 3 em curso. Cloudinary ✅ Curador ✅ (items 3.H–3.I).**
> Fase 2 (items 2.1–2.7): entregues. 9 bugs corrigidos. DB limpa.
> Fase 3 (items 3.A–3.G): em implementação activa — ver secção abaixo.
> Ver [[📅 Sessão 14 Junho 2026 — Fase 2 Completa + Testes]] para relatório Fase 2.

---

## 🔄 FASE 3 — Eventos Completos + IA Avançada (EM CURSO — 15 Jun 2026)
### Objectivo: produto completo para utilizadores e B2B

> **Decisão 15 Jun 2026:** Antes de avançar para `user_memory` e Espelho de Empatia completo, implementar os fluxos de eventos para pessoa física e jurídica — são o motor de receita imediato.

---

### 3.A Evento Pessoal — Pessoa Física (IMPLEMENTADO — 15 Jun 2026)

**O que é:** Utilizador com ≥ 1.000 B$ cria um evento com feed exclusivo de até 30 imagens de portfolio.

**Backend:**
- `event_type: "pessoal"` — novo tipo aceite no `POST /api/events`
- Validação: `bw_balance >= 1000` antes de criar
- Duração: 1–7 dias (campo `duration_days`)
- Sorteio: opcional (campo `has_raffle`)
- Patrocínios: opcional (campo `sponsorships_enabled`)
- Campo `portfolio_images`: array de ObjectIds dos posts do evento (máx 30)

**Frontend:**
- `perfil.tsx` — botão "CRIAR EVENTO PESSOAL" na secção "ESPAÇO PESSOAL"
  - Activo se `bw_balance >= 1000`
  - Bloqueado com contador se `bw_balance < 1000` ("Faltam X BW")
- `frontend/src/app/pessoal/evento/novo.tsx` — wizard de criação (4 passos: dados, localização, opções, revisão)
- Feed: evento aparece como card único no feed (não posts individuais)

**Critérios de aceitação:**
- [x] Utilizador com ≥ 1.000 B$ vê botão activo em perfil
- [x] Utilizador com < 1.000 B$ vê botão bloqueado com contador
- [x] Wizard cria evento `pessoal` gratuito
- [ ] Feed do evento mostra card único no feed global *(requer evento/[id].tsx — Fase 4)*

---

### 3.B Eventos Empresa — Criação Gratuita + Pagamento por Imagem (IMPLEMENTADO — 15 Jun 2026)

**Backend:**
- [x] `POST /api/events` — criação gratuita para `singular` e `plural` (sem Stripe)
- [x] `POST /api/events/{id}/publish-image` — cobra €9,99 avulso ou €49,99 pack de 10
- [x] `POST /api/events/{id}/join-as-exhibitor` — empresa entra como expositora sem pagamento

**Frontend:**
- [x] `business/evento/novo.tsx` — criação gratuita, seletor Singular/Plural, banner informativo de preços
- [ ] `evento/[id].tsx` — botão "PUBLICAR IMAGEM" e "ENTRAR COMO EXPOSITOR" *(pendente)*

**Critérios de aceitação:**
- [x] Criar evento tipo singular/plural é gratuito (sem Stripe)
- [x] Publicar imagem abre checkout (avulso €9,99 ou pacote €49,99)
- [x] Empresa pode entrar como expositora em evento plural (backend)
- [x] Pacote é apresentado em destaque como opção recomendada
- [ ] Botões de publicar imagem / entrar como expositor no evento/[id].tsx *(Fase 4)*

---

### 3.C Diagnóstico Groq no Primeiro Olhar (IMPLEMENTADO — 15 Jun 2026)

**Backend:**
- [x] `GET /api/events/{id}/primeiro-olhar-report` — chama Groq após calcular top palavras
- [x] Correção crítica: top_words agora usa `votes.best_word` (palavra da comunidade) e não `post.word` (palavra da marca)
- [x] `misalignment_pct` calculado: % de votantes cujas palavras diferem da palavra-alvo da marca

**Critérios de aceitação:**
- [x] Relatório inclui `diagnosis` gerado por Groq
- [x] Fallback silencioso se Groq falhar (relatório sem diagnóstico, não erro)

---

### 3.D Palavras no Dashboard de Campanhas (IMPLEMENTADO — 15 Jun 2026)

**Backend:**
- [x] `GET /api/campaigns/{id}` — retorna `top_words_approved` e `top_words_rejected`
- [x] Correcção de paths: frontend chamava `/api/business/campaigns/` (inexistente) → corrigido para `/api/campaigns/`

**Frontend:**
- [x] `campaign/[id].tsx` — secção "PALAVRAS MAIS COMENTADAS" com pills verde (aprovo) e vermelho (desaprovo)

**Critérios de aceitação:**
- [x] Detalhe de campanha mostra top palavras aprovadas e rejeitadas
- [x] Apresentação visual clara e distinguível (pills com contagem)

---

### 3.E user_memory Collection (Fase 3 original)

*(Mantém-se como planeado — ver secção 3.1 abaixo)*

---

### 3.F Espelho de Empatia Completo (Fase 3 original)

*(Mantém-se como planeado — ver secção 3.2 abaixo)*

---

### 3.G Printable Effect (Fase 3 original)

*(Mantém-se como planeado — ver secção 3.4 abaixo)*

---

### 3.H Cloudinary — Migração de Imagens para CDN (IMPLEMENTADO — 16 Jun 2026)

**O que é:** Todas as imagens enviadas para posts, campanhas e eventos são automaticamente transferidas para Cloudinary CDN em vez de guardadas em base64 no MongoDB.

**Backend:**
- `backend/storage.py` — módulo novo: `upload_image()`, `upload_images()`, `delete_image()`, `is_configured()`
- `POST /api/posts` — imagem → `storage.upload_image()` → `image_url` Cloudinary (com fallback base64)
- `POST /api/events` — imagem de capa → Cloudinary
- `POST /api/campaigns` — imagem da campanha → Cloudinary
- `serialize_post()` — prefere `image_url` (CDN) sobre `image_base64` (legado)
- Campo novo em `posts` e `events`: `image_url` (string, URL Cloudinary)

**Configuração Render:**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — env vars no serviço `besord-backend`

**Impacto:** MongoDB ocupa ~200 bytes por post (URL) em vez de ~500KB (base64). CDN global com compressão automática.

**Ficheiros:** `backend/storage.py` (novo), `backend/server.py` (alterado), `backend/requirements.txt` (+cloudinary)

**Critérios de aceitação:**
- [x] Imagem enviada no post → URL Cloudinary no MongoDB
- [x] Fallback para base64 se Cloudinary não configurado
- [x] `serialize_post()` prefere `image_url`
- [ ] Migração de posts existentes (script `migrate_images.py` — pendente)

---

### 3.I Curador Automático — Pipeline de 5 Estágios (IMPLEMENTADO — 16 Jun 2026)

**O que é:** Sistema automático que povoa o mapa de eventos com curadoria de fontes confiáveis. Resolve o problema do "ovo e da galinha": sem eventos não há check-ins, sem check-ins ninguém cria eventos.

**Arquitetura:**
- `backend/sources.py` — 15 queries Google News RSS para Lisboa e Porto (agnóstico a temas)
- `backend/curator.py` — pipeline 5 estágios (fetch → extract → validate → image → review)
- Nova collection: `event_queue` — fila de revisão com TTL 48h
- Campos novos em `events`: `source`, `curator_confidence`, `curator_source_url`, `curator_source_type`
- `event_type: "curated"` — identifica eventos do pipeline

**Pipeline:**

| Estágio | O que faz |
|---|---|
| 1. FETCH | 15 queries Google News → ~500 raw → dedup → 80 amostra |
| 2. EXTRACT | Groq extrai {title, date, location, city, theme, confidence} |
| 3. VALIDATE | Python: data, cidade, spam — NUNCA por tipo de evento |
| 4. IMAGE | Pillow: >=400x400, proporção < 1:3 |
| 5. REVIEW | <=7d + conf >=60 → insere; >=70 normal → insere; >60d → queue |

**Endpoints admin:**
- `POST /api/curator/run?api_key=...` — trigger manual
- `GET /api/admin/event-queue` — lista pendentes
- `POST /api/admin/event-queue/{id}/approve|reject` — aprova/rejeita

**Cron job Render:** `besord-curador`, schedule `0 8,20 * * *`, Starter (512MB)

**Ficheiros:** `backend/curator.py` (novo), `backend/sources.py` (novo), `backend/server.py` (+router +índices)

**Critérios de aceitação:**
- [x] Pipeline executa sem erros (200 OK no Render)
- [x] Cron job configurado e a correr 2×/dia
- [x] Fontes são agnósticas a tema (qualquer evento com pessoas + telemóveis)
- [x] Validação estrutural nunca rejeita por tipo
- [x] Fila de revisão funcional com approve/reject
- [ ] Primeiro evento curado inserido na BD (yield actual é 0 — aguarda melhoria de fontes)
- [ ] Fontes adicionais: Eventbrite API, Sympla (Brasil)

---
