# 📊 Plano Estratégico de Crescimento — Besord
## Análise OODA | Versão 1.0 | 18 Junho 2026

> **Documento de análise e execução** — Complementa o [[🚀 Plano Final de Implementação]] com a dimensão de negócio, retenção e aquisição de utilizadores.
> **Âmbito:** Produto → Retenção → Aquisição → Receita. Por esta ordem. Não ao contrário.

---

## 🧭 DIAGNÓSTICO DE PONTO DE PARTIDA

### O que temos hoje (18 Jun 2026)

| Dimensão | Estado Real |
|---|---|
| Utilizadores activos | 0 independentes |
| Receita MRR | €0 |
| Curator yield | ~0% (bug schema `_insert_event()` não testado) |
| Render free tier | Cold start 30-60s → mata novos utilizadores |
| MongoDB | ~200 bytes/post com Cloudinary ✅ (frente crítica resolvida) |
| Groq | 14.400 req/dia gratuito — suficiente até ~5.000 DAU |
| D7 Retention | Desconhecido — precisa de 7 dias de utilizadores reais |

### A Verdade Incómoda

O Besord tem produto. Não tem distribuição, não tem dados de retenção, e não tem provas sociais. Nenhum destes três problemas se resolve com código novo — resolvem-se com utilizadores reais a usar o que já existe.

**Frase-guia desta fase:**
> Antes de construir mais, provar que o que foi construído retém pessoas.

---

## 🔁 OODA LOOP — ANÁLISE COMPLETA

### OBSERVAR

**Estado do produto (o que funciona hoje):**
- ✅ Time-Gate (10 votos/dia) — escassez forçada, urgência real
- ✅ Veredito Card — shareable, diário, neo-brutalist
- ✅ Sincronia — lógica calculada, insight Groq, aguarda push notifications e massa crítica
- ✅ Espelho de Sessão — 3 frases no encerramento da sessão
- ✅ Primeiro Olhar — backend completo, 1ª venda pendente (não executada)
- ✅ Sistema de Convite Fundador — endpoints + badge permanente
- ✅ Word of the Day — endpoint live, calendário editorial pendente
- ✅ Cloudinary CDN — imagens não saturam MongoDB
- ✅ Curator pipeline 5 estágios — código correcto, yield 0% por bug schema

**O que falta para o loop de retenção fechar:**
- ❌ Streak Counter (contador de dias consecutivos visível)
- ❌ Push Notifications (Expo expo-notifications pendente)
- ❌ Progressão revelada gradualmente (arquétipo desbloqueia na sessão 10)
- ❌ Pressão social gentil ("o teu admirador X completou sessão hoje")
- ❌ Conteúdo curado de alta qualidade no feed (Curator com bug)
- ❌ Daily Challenge (1 imagem = todos votam = momento Wordle)

**Estado do mercado 2026:**
- TikTok sob pressão regulatória (DSA Europa, banimento EUA) → criadores procuram alternativas
- Instagram algoritmo menos pessoal → utilizadores insatisfeitos com relevância
- Apps de autoconhecimento crescem 40%+ YoY (Headspace, BetterHelp)
- Wordle: prova que "momento diário partilhado" tem retenção explosiva
- B2B perception tools: todas survey-based — **nenhuma comportamental**

### ORIENTAR

**Física do negócio Besord (First Principles):**

```
RETENÇÃO = Conteúdo de Qualidade × Recompensa Emocional × Pressão Social
```

Hoje os três multiplicadores estão sub-óptimos. Com o Curator com bug e sem Streak, um utilizador que instala o Besord vê um feed fraco, completa 10 votos, recebe o Espelho, e não tem razão específica para voltar amanhã.

**O gargalo de infraestrutura antes do crescimento:**

| Componente | Risco Actual | Solução | Custo |
|---|---|---|---|
| Render free (cold start 30-60s) | Mata qualquer utilizador novo orgânico | Upgrade Starter | €7/mês |
| Curator schema bug | Mapa vazio → sem reason to return | Fix `_insert_event()` | 0€, 2-4h código |
| Groq 8K context window | Mirror trunca histórico → insights genéricos | Compressão de sessões antes de enviar | 0€, 1-2h código |
| Sorteios aleatórios | SRIJ regula em PT → risco legal | Skill-based ("palavra coincidente") | 0€, renomear conceito |
| Instagram scraping | Ilegal (ToS + GDPR) | Unsplash + Pexels + NewsAPI (gratuitos, legais) | 0€ |

### DECIDIR

**Prioridade absoluta:**

A sequência de decisões é determinada por 1 pergunta: "isto aumenta o D7 Retention?"

```
D7 Retention < 20%  → Não lançar growth, corrigir produto
D7 Retention 20-35% → Growth cauteloso, continuar a melhorar produto
D7 Retention > 35%  → Escalar. B2B. Primeiro Olhar. Investimento.
```

**A sequência que maximiza o D7 mais rápido, por RICE score:**

| RICE | Acção | Esforço | D7 Impact |
|---|---|---|---|
| 900 | Upgrade Render Starter | 5 min, €7/mês | Elimina cold start |
| 200 | Fix Curator schema bug | 2-4h código | Eventos visíveis no mapa |
| 63 | Streak Counter | 1 dia código | +10pp D7 (Duolingo data) |
| 55 | Push Notifications (Expo) | 1-2 dias | Activa Sincronia real |
| 43 | Daily Challenge | 1-2 dias | +15pp D7, viral loop |
| 11 | Curador Feed Diário | 3-4 dias | +15pp D7, conteúdo permanente |
| 9 | Espelho Humanizado assertivo | 3-4 dias | +10pp D7 |
| 9 | Time Capsule | 2 dias | Retenção long-term |

### AGIR

Ver secção "Plano de 21 Dias" abaixo.

---

## 🚦 PROBLEMA DO GALINHA E OVO — RESOLVIDO

**O dilema:**
- Para vender B2B (Primeiro Olhar), preciso de utilizadores que votem.
- Para ter utilizadores, preciso de conteúdo e razões para ficarem.
- Para ter conteúdo, preciso de utilizadores que postem.

**A saída:**

```
FASE A (agora): Conteúdo Curado Automático resolve o problema de conteúdo
     ↓
FASE B (semana 1): 1 grupo denso de 20-30 Founders resolve o problema social
     ↓
FASE C (semana 2-3): Streak + Push + Daily Challenge resolvem o problema de retenção
     ↓
FASE D (quando D7 ≥ 25% com 100+ DAU): Primeiro Olhar com dados que valem dinheiro
```

**O produto B2B que não depende de massa crítica B2C:**

→ **Besord for Teams** (novo) — workspace privado para equipa de 5-20 pessoas votar em assets internos. A empresa traz os seus próprios votantes. Não precisa de utilizadores externos.
→ **Perception Score** (novo) — €29.90 por score individual. 15-20 votantes são suficientes.

---

## 📦 FEATURES NOVAS — ANÁLISE CRÍTICA COMPLETA

### F1 — Curador de Conteúdo Diário (Feed Vivo)

**O problema que resolve:** Sem conteúdo de qualidade, o utilizador chega, vê 3 posts, sai. O Curator de Eventos (3.I) popula o mapa. Precisa de um Curator de Feed para o fluxo diário de votação.

**Arquitectura corrigida (fontes legais):**
```python
# backend/feed_curator.py (novo)
# Cron: 06h00 diário

FONTES_LEGAIS = {
    "NewsAPI": "https://newsapi.org/v2/top-headlines?country=pt&category=entertainment",
    "Unsplash": "https://api.unsplash.com/photos/random?query={tema}&orientation=squarish",
    "Pexels": "https://api.pexels.com/v1/search?query={tema}&per_page=1",
    "Reddit": "https://www.reddit.com/r/Design+EarthPorn+StreetPhotography.json"
}

# PROIBIDO: Instagram scraping (ToS violation + GDPR)
# PROIBIDO: LinkedIn scraping (ToS violation)
# PROIBIDO: Pinterest scraping sem API key

Pipeline:
1. NewsAPI → top 5 artigos PT/BR de cultura/design/moda/arte
2. Extrair tema principal (Groq, 1 call)
3. Unsplash API search por tema → imagem editorial
4. Filtros obrigatórios: licença comercial, sem rostos reconhecíveis, sem texto
5. Groq gera palavra mais relevante para votação (1 call)
6. Publicar às 08h, 12h, 18h com tag "Curado pelo Besord"

Custo total: 10 calls Groq/dia + APIs gratuitas = €0
```

**Ficheiros novos/alterados:**
- `backend/feed_curator.py` (novo, análogo a `curator.py`)
- `backend/server.py` → novo endpoint `POST /api/feed-curator/run`
- `render.yaml` → novo cron job `besord-feed-curador` (schedule `0 6 * * *`)

**Critérios de aceitação:**
- [ ] 3 posts de alta qualidade publicados automaticamente por dia
- [ ] Imagens têm licença comercial verificada (Unsplash/Pexels)
- [ ] Fallback: se NewsAPI falhar, usa banco pré-curado de 50 temas

**Impacto estimado no D7:** +15-20pp

---

### F2 — Espelho Humanizado (com compressão de contexto)

**O problema de arquitectura actual:** O Espelho de Sessão usa apenas dados da sessão do dia. Quando a `user_memory` (item 3.E do plano original) for implementada, há um problema: Groq tem janela de 8K tokens. 30 sessões de 10 votos com palavras e comentários = facilmente 15K+ tokens → truncagem → insight genérico.

**Solução obrigatória antes de activar Espelho com histórico:**
```python
# backend/server.py — função _build_mirror_context()

async def _build_mirror_context(user_id: str, db) -> dict:
    sessions = await db.user_memory.find_one({"user_id": user_id})
    history = sessions.get("session_history", [])
    
    # Tom progressivo baseado em número de sessões
    n = len(history)
    if n < 3:
        tone = "curioso, observa padrões emergentes, nunca afirma certezas"
    elif n < 10:
        tone = "confiante, identifica padrões, usa dados para fundamentar"
    else:
        tone = "assertivo, fala em certezas absolutas baseadas em comportamento"
    
    # Comprimir sessões antigas para preservar contexto
    if n > 5:
        old = history[:-3]  # sessões antigas
        recent = history[-3:]  # 3 mais recentes
        old_summary = f"Resumo das {len(old)} sessões anteriores: " \
                      f"aprovação média {sum(s['votes']['aprovo'] for s in old)/len(old):.0f}/10, " \
                      f"temas dominantes: {_extract_dominant_themes(old)}, " \
                      f"palavras recorrentes: {_extract_top_words(old, n=5)}"
    else:
        old_summary = ""
        recent = history
    
    return {"tone": tone, "old_summary": old_summary, "recent_sessions": recent}
```

**10 Arquétipos Visuais a implementar no Espelho:**
```
1. Observador Periférico   — aprova detalhes que a maioria ignora
2. Minimalista Assertivo   — rejeita complexidade, aprova essência
3. Narrativo               — aprova imagens que contam histórias, rejeita abstracto puro
4. Cromático               — hipersensível à cor, menos à composição
5. Estruturalista          — aprova simetria e ordem, rejeita caos visual
6. Caótico Criativo        — aprova ruptura e tensão, rejeita equilíbrio
7. Humanista               — aprova quando há presença humana, rejeita vazio
8. Naturalista             — aprova orgânico e textura, rejeita artificial
9. Urbano                  — aprova arquitectura e cidade, rejeita natureza
10. Ecléctico              — aprovação transversal, sem padrão dominante
```

**Progressão revelada por sessão:**
```
Sessão 1-2:  "O teu perfil de percepção está em formação..."
Sessão 3-5:  "Detectámos uma tendência: {padrão emergente}"
Sessão 6-9:  "O teu estilo visual tem uma assinatura. Quase a revelar..."
Sessão 10:   "Arquétipo desbloqueado: {nome}. {descrição de 3 frases assertivas}. Partilha?"
Sessão 30:   "A tua percepção mudou {X}% desde o dia 1. O que aconteceu?"
```

**Ficheiros alterados:**
- `backend/server.py` → `GET /api/insights/daily` (expandir para histórico)
- `frontend/src/components/VeredictCard.tsx` → mostrar progresso para arquétipo
- `frontend/src/app/(tabs)/perfil.tsx` → arquétipo visível no perfil após sessão 10

---

### F3 — Eventos Privados com Convites (K-factor > 1)

**O mecanismo viral que falta:** Cada utilizador que cria 1 evento privado com 20 convidados → 5-8 novos utilizadores registados a CAC €0.

**Casos de uso:**
- Fotógrafo → galeria virtual da última série → convida seguidores Instagram
- Designer de moda → evento de colecção → convida compradores e imprensa
- Aniversário → fotos da vida → convida família
- Escola → trabalhos de alunos → pais votam

**Arquitectura:**
```python
# Novo tipo de evento: "pessoal_privado"
# Campos adicionais em events:
{
  "visibility": "private" | "public" | "semi_public",
  "invite_token": "uuid único",
  "invited_emails": [],  # opcional
  "max_participants": 50,
  "gdpr_consent_required": True  # OBRIGATÓRIO para GDPR
}

# Endpoint novo:
GET /evento/{invite_token}  → landing page pública (sem auth)
# Landing page mostra: título, nr de votos, "Para participar, cria conta em 30s"
# OBRIGATÓRIO: aviso GDPR antes de mostrar qualquer imagem
```

**Atenção legal — GDPR:**
- A landing page de convite deve mostrar aviso de consentimento ANTES de carregar imagens
- "Ao continuar, aceitas que as tuas escolhas de votação são guardadas pelo Besord"
- Utilizadores anónimos (sem conta) não podem votar — apenas ver

**Atenção legal — Sorteios:**
- Sorteios aleatórios (voto = bilhete) requerem autorização SRIJ em Portugal
- **Alternativa legal:** "Desafio de Percepção" — ganha quem escolheu a palavra mais votada pela comunidade (skill-based → não é jogo de azar → sem registo necessário)
- Renomear "Sorteio" para "Desafio de Percepção" em toda a UI

**Ficheiros novos/alterados:**
- `backend/server.py` → novo campo `visibility` + `invite_token` em `POST /api/events`
- `frontend/src/app/evento/convite/[token].tsx` (novo)
- `frontend/src/app/evento/convite/[token].tsx` → banner GDPR obrigatório

---

### F4 — Páginas de Eventos Dinâmicas

**O que adicionar às páginas de eventos existentes:**
- Cover image gerada por IA via Cloudinary transformations (não DALL-E — evita custo)
- Contador de votos em tempo real (polling a cada 60s — sem WebSocket)
- "Top 3 imagens mais comentadas"
- Actividade recente: "Marta votou há 5 minutos"
- Desafio de Percepção (ver F3 — skill-based, não aleatório)
- Share button com card do evento (PNG via Pillow — já instalado)

**Nota sobre cover image:** Usar Cloudinary image transformations com `e_art:` ou `l_text:` em vez de DALL-E 3 ($0.04/imagem). Cloudinary é gratuito e já configurado.

---

### M1 — Daily Challenge ("Wordle da Percepção")

**Conceito:** Às 08h00, 1 imagem igual para TODOS. Ao completar 10 votos, o utilizador vê: "X% aprovaram. A palavra mais usada foi Y. A tua foi Z." Às 08h00 seguinte, reveal completo com análise.

**Por que funciona:**
- Não depende de outros utilizadores (funciona com 10 ou 10.000)
- Resultado partilhável: "Votei diferente de 73%"
- É o conteúdo orgânico para LinkedIn/Instagram: "A imagem do dia no Besord"

**Quem escolhe a imagem:** IA pré-selecciona 5 candidatas → admin aprova 1 em < 5 min/dia. Após 30 dias, os Top 5 Founders votam na imagem do dia (cria sentido de propriedade).

**Dependência crítica:** Push Notifications obrigatórias ANTES do lançamento. Sem notificação às 20h ("Resultado de hoje disponível"), o momento de reveal passa despercebido.

**Implementação:**
```python
# backend/server.py
# Colecção nova: daily_challenges
{
  "date": "2026-06-18",
  "image_url": "cloudinary_url",
  "image_word": "Resistência",  # palavra dada pelo admin
  "reveal_at": "2026-06-19T08:00:00Z",
  "votes": {"aprovo": 0, "desaprovo": 0},
  "best_words": {},  # {"Liberdade": 12, "Força": 8}
  "analysis": ""  # gerado por Groq no reveal
}

# Endpoint:
GET /api/daily-challenge → imagem do dia
POST /api/daily-challenge/vote → regista voto
GET /api/daily-challenge/result → resultado (só após reveal_at)
```

---

### S1 — Besord Live (Sessão de Votação em Tempo Real)

**Conceito:** O criador lança uma sessão Live sincronizada. Todos os participantes votam na mesma sequência de imagens em tempo real. Resultados aparecem simultaneamente para todos.

**Casos de uso B2B:**
- Agência apresenta 5 conceitos ao cliente → cliente e equipa votam em tempo real → resultado imediato (substituição do focus group presencial, €49.90/sessão)
- Marca lança colecção num evento físico → convidados votam com telemóvel → resultado no ecrã

**Implementação técnica:** SSE (Server-Sent Events) — FastAPI suporta nativamente via `EventSourceResponse`. Não requer WebSocket.
```python
# backend/server.py
@app.get("/api/live/{session_id}/stream")
async def live_stream(session_id: str):
    async def event_generator():
        while True:
            data = await get_live_state(session_id)
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(1)
    return EventSourceResponse(event_generator())
```

**Ficheiros novos:** `frontend/src/app/live/[session_id].tsx` + endpoints SSE no `server.py`.

---

### S2 — Besord Embed (Widget para Websites)

**Conceito:** Snippet JavaScript que marcas embebem no próprio site/newsletter. Visitantes votam sem sair. Resultados fluem para o dashboard Besord.

**Modelo de preços:** Gratuito até 100 votos/mês → €19.90/mês ilimitado.

**Implementação:**
```html
<!-- Código de embed mínimo -->
<script src="https://besord.com/embed.js" 
        data-event-id="[event-id]"
        data-theme="light|dark">
</script>
```

**Por que gera novos utilizadores:** Após votar no embed, aparece: "Os teus resultados estão no Besord. Cria conta gratuita para ver o teu perfil completo." → CAC €0.

---

### S3 — Perception Score para Criadores (Micro-B2B, €29.90)

**Conceito:** Criador cola URL do seu post Instagram/LinkedIn → Besord scrape a imagem (legal via URL pública) → Comunidade vota nas próximas 24h → Score entregue por email.

**Por que resolve o problema do galinha-e-ovo:** 15-20 utilizadores activos já são suficientes para 1 score com valor real. **É a única receita possível ANTES de ter 100 DAU independentes.**

**Fluxo:**
```
Landing page simplificada →
Utilizador cola URL da imagem →
Stripe one-time payment €29.90 →
Evento Besord criado automaticamente (48h) →
Email com relatório ao fim das 48h
```

**Ficheiros novos:** `frontend/src/app/perception-score.tsx` + `backend/server.py` endpoint de score.

---

### S4 — Besord for Teams (B2B sem massa crítica B2C)

**Conceito:** Workspace privado fechado onde equipa de 5-20 pessoas vota em assets internos. Não é público. Resultados num dashboard partilhado.

**Por que é o produto B2B mais rápido:** A empresa é auto-suficiente em votantes. Não precisas de utilizadores externos. Cada empresa é o seu próprio focus group.

**Casos de uso:**
- Agência criativa: equipa de 8 vota nos 3 conceitos finais antes de apresentar ao cliente
- Startup: equipa faz "logo vote" nas 5 opções do designer
- Marca de moda: equipa comercial vota nas peças da nova colecção

**Preços:** €49/mês até 20 membros | €99/mês até 50.

**Nota técnica:** A colecção `workspaces` e `workspaces.py` já existem no código. Adicionar modo "privado" + convite por email + dashboard de equipa.

---

### S5 — Anonymous Mode (Modo Confessional)

**Conceito:** Utilizador activa "modo anónimo" para 1 post. A imagem e a palavra aparecem no feed mas o perfil fica oculto (exibido como "Anónimo #347"). Após 48h, notificação: "O teu post anónimo teve X votos. Queres revelar-te?"

**Por que aumenta a qualidade do conteúdo:**
- Remove o medo de partilhar trabalho em progresso
- Cria um espaço de experimentação genuína
- "Quem é o Anónimo #347?" cria curiosidade e engagement

**Implementação:** Campo `anonymous: bool` (default: false) no schema de `posts`. Lógica de display oculta `user_id` quando `anonymous=true`.

---

## 📅 PLANO DE 21 DIAS — EXECUÇÃO DIÁRIA

### SEMANA 1 — Infraestrutura + Primeiro Hábito + Primeiro Grupo

**Objectivo:** Eliminar gargalos técnicos + primeiro grupo activo + hábito instalado

| Dia | Acção Técnica | Acção de Crescimento |
|---|---|---|
| D1-Seg | Upgrade Render Starter (€7/mês — 5 min) | Identificar "nó" do 1º grupo |
| D1-Seg | Fix `_insert_event()`: location → `{city, coordinates}`, adicionar `date` + `expires_at` | Mensagem pessoal ao nó |
| D2-Ter | Streak Counter: campo `streak_days` em `users` + UI no perfil + animação dias 3/7/14/30 | Grupo activado pelo nó via WhatsApp |
| D3-Qua | Push Notifications: instalar `expo-notifications`, pedir permissão no onboarding, endpoint `POST /api/push/register` | Mensagem pessoal a cada novo Founder |
| D4-Qui | Daily Challenge: colecção `daily_challenges` + endpoints + card no topo do feed | 1º post LinkedIn com dados reais do produto |
| D5-Sex | Feed Curator: `feed_curator.py` com NewsAPI + Unsplash + filtros legais | Review métricas D2 do grupo 1 |
| D6-Sáb | Anonymous Mode: campo `anonymous` no schema de posts | — |
| D7-Dom | — | **Verificar D7 retention do grupo 1 no PostHog** |

**Métricas de sucesso semana 1:**
- ✅ Eventos visíveis no mapa (Curator fix)
- ✅ Streak visível na app
- ✅ Daily Challenge no topo do feed
- ✅ 15-25 Founders instalados e activos
- ✅ D2 retention ≥ 40% (mínimo para continuar)

---

### SEMANA 2 — Retenção + Espelho + Primeiros €€€

**Objectivo:** Verificar D7 + Espelho assertivo + 1ª receita antes dos 100 DAU

| Dia | Acção Técnica | Acção de Crescimento |
|---|---|---|
| D8-Seg | Se D7 < 20%: sprint de correção (push schedule + streak milestones) | PostHog: análise funil D7 |
| D8-Seg | Se D7 ≥ 20%: Espelho Humanizado com compressão de contexto | Activar 2º grupo (escola ou grupo profissional) |
| D9-Ter | Time Capsule: colecção `time_capsule_votes` + cron reveal_at + email Resend | 1 post Instagram: Veredito Card do fundador |
| D10-Qua | Besord for Teams: workspace mode "private" + convite por email | Pitch Besord for Teams a 1 agência via 2º grau |
| D11-Qui | Perception Score: landing simplificada + Stripe one-time + evento auto 48h | Contactar 3 fotógrafos/criadores 5K-20K seguidores |
| D12-Sex | Besord Embed: snippet JS + endpoint público + CORS | Press release rascunhado (ângulo: percepção comportamental vs. focus groups) |
| D13-Sáb | Buffer / optimizações | Enviar press release a M&P e Briefing |
| D14-Dom | — | **Verificar: 50 Founders? D7 ≥ 25%? 1ª venda?** |

**Métricas de sucesso semana 2:**
- ✅ D7 retention ≥ 20% (mínimo viável)
- ✅ 50+ Founders activos
- ✅ 1ª receita (Perception Score €29.90 ou Teams €49/mês)
- ✅ Espelho com arquétipo emergente após sessão 10

---

### SEMANA 3 — Viral + Escala Controlada + Pré-B2B

**Objectivo:** Eventos Privados activos + 100 Founders + 3 clientes pagantes

| Dia | Acção Técnica | Acção de Crescimento |
|---|---|---|
| D15-Seg | Eventos Privados: campo `visibility` + `invite_token` + landing page + GDPR disclaimer | 3º grupo activado |
| D16-Ter | Páginas de Eventos: cover image via Cloudinary transforms + actividade recente | 1 fotógrafo cria galeria privada com 20 convidados |
| D17-Qua | Desafio de Percepção (skill-based, não sorteio): integrar em eventos privados | 2ª venda (Score ou Teams) |
| D18-Qui | 10 arquétipos visuais no Espelho (substituir placeholder por archetypes reais) | Contactar IADE/FBAUL para parceria de aula |
| D19-Sex | Besord Live SSE básico (criador controla sequência de imagens) | Proposta de aula enviada a escola de design |
| D20-Sáb | Buffer | 3ª venda |
| D21-Dom | — | **Check final: 100 Founders? D7 ≥ 25%? €300+ MRR?** |

**Métricas de sucesso semana 3:**
- ✅ 100+ Founders activos
- ✅ D7 retention ≥ 25%
- ✅ K-factor > 0.5 (cada utilizador traz pelo menos 0.5 novos via convites)
- ✅ €300+ MRR (Perception Scores + 1 Teams)
- ✅ 1 feature de imprensa iniciada

---

## 🎯 CRITÉRIOS PARA VENDER PRIMEIRO OLHAR

> O Primeiro Olhar com 8 votos de amigos vale €0 — dados enviesados e amostra inútil. Só vale quando:

```
✅ DAU ≥ 100 utilizadores INDEPENDENTES (não amigos diretos)
✅ D7 retention ≥ 25%
✅ Média ≥ 40 votos por evento nas últimas 48h
✅ 1 case study interno (evento criado pela equipa, dados reais)
✅ Besord for Teams já vendido (prova de conceito B2B)
```

Com estes 5 critérios cumpridos, cada cliente B2B paga por dados reais, não por promessas.

---

## 💰 PROJEÇÃO FINANCEIRA (realista, sem wishful thinking)

| Marco | Quando | DAU | MRR | Como |
|---|---|---|---|---|
| €0 | Hoje | 0 | €0 | — |
| €30-150 | D21 | 50-100 | €30-150 | 1-2 Perception Scores |
| €300-500 | Mês 2 | 100-200 | €300-500 | 1 Teams + 5 Scores |
| €1.000-1.500 | Mês 3 | 200-400 | €1.000-1.500 | 2 Teams + Primeiro Olhar inicial |
| €3.000-5.000 | Mês 6 | 500-1.000 | €3.000-5.000 | 5+ Teams + 15 Primeiro Olhar/mês |
| €10.000-15.000 | Mês 12 | 2.000-5.000 | €10.000-15.000 | Contratos anuais + Embed + Live |
| €83.000 | Mês 30-36 | 30.000+ | €83.000 | ARR €1M via API + Enterprise |

**Nota:** €1M ARR requer 1 evento de ruptura (artigo viral, parceria com grande agência, Product Hunt #1). Sem esse evento, crescimento orgânico a 5-15h/semana leva 4-5 anos.

---

## 🧲 AQUISIÇÃO SEM BUDGET — CANAIS POR PRIORIDADE

### Canal A — Activação de Grupo Denso (semana 1, máxima prioridade)

**Por que grupos e não indivíduos:** Confirmado nos docs do Besord (ver [[🚀 Plano Final de Implementação]] → secção 2.7). Dois desconhecidos não se admiram mutuamente na primeira semana. Sincronia requer densidade. Grupo = Sincronia activa em 48h.

**Script para o "nó" do grupo:**
> "Rodrigo está a lançar algo diferente. É um diário de percepção visual — votas em imagens com uma palavra por dia, 10 minutos. Depois vês o que isso diz sobre ti. Estou no grupo Founder #1. Quem quer entrar antes de ser público?"

**Grupos ideais (por critérios definidos nos docs):**
- 1 agência de publicidade Lisboa (15-20 pessoas que se conhecem)
- 1 colectivo fotógrafos/directores criativos
- 1 turma mestrado design ou comunicação (IADE, FBAUL, ESAD, ESCS)
- 1 redacção de media cultural/moda

### Canal B — Microinfluenciadores Visuais (semana 2)

**Proposta:** "Dou-te gratuitamente os dados de percepção dos teus seguidores sobre as tuas 5 últimas fotos. 48h. Sem custo. Em troca pedes ao teu público que vote."

**O que eles ganham:** Insights reais (nunca tiveram isto). Conteúdo para post. **O que o Besord ganha:** Utilizadores do audiência deles + case study.

**Targets:** Fotógrafos PT com 5K-50K seguidores no Instagram.

### Canal C — Comunidades de Autoconhecimento (ângulo não óbvio)

**Por que é o maior canal:** O mercado de autoconhecimento é 10x maior que o nicho criativo. "O que aprovamos e reprovamos numa imagem diz mais sobre nós do que qualquer questionário de personalidade" → posicionamento para grupos de desenvolvimento pessoal, psicologia, mindfulness.

**Alvos:**
- Facebook Groups: "Desenvolvimento Pessoal PT" (50K+), "Espiritualidade e Ciência" (30K+)
- Reddit r/portugal, r/PsychologyStudents
- Grupos de Telegram de coaching e psicologia

### Canal D — Press Especializada (timing: semana 2-3, após 50+ Founders)

**Publicações alvo:** M&P (Meios & Publicidade), Briefing, Shifter, Dinheiro Vivo, Público P3

**Ângulo do press release:**
> "Startup portuguesa cria alternativa comportamental aos focus groups: 48h, €80, dados reais de percepção — sem questionários, sem viés de resposta social."

**Timing obrigatório:** Só após ter 50+ utilizadores activos e 1 case study real. Imprensa com produto vazio = artigo que não converte.

### Canal E — Escolas de Design e Comunicação (semana 3)

**Proposta para professores:**
> "Posso dar uma aula de 45min sobre perception research usando dados reais dos vossos alunos como case study. Grátis. O resultado: os alunos têm um projecto real no portfolio."

**Targets:** IADE Lisboa, Faculdade de Belas-Artes UL, ESAD Caldas da Rainha, Escola Superior de Comunicação Social

**O que ganhas:** 20-50 utilizadores altamente qualificados de uma vez, CAC €0.

---

## 🤖 SISTEMA DE CONTEÚDO COM IA (5h/semana total)

### Máquina de 3 posts/semana com 90 min de trabalho

**Fonte de dados (automática via PostHog + Curator):**
- PostHog → exportar métricas semanais (Daily Active Words, D7, Veredito shares)
- Feed Curator → extrair os 3 posts com mais votos da semana
- Groq analisa → gera insights

**Prompt base semanal:**
```
Sou fundador do Besord — plataforma de percepção visual onde utilizadores votam 
APROVO/DESAPROVO em imagens com uma palavra, 10 votos/dia.

Esta semana:
- DAU: [X] utilizadores activos
- Top 3 palavras votadas: [A, B, C]
- Taxa aprovação global: [Y]%
- Palavra do Daily Challenge mais controversa: [Z] com [W]% aprovação

Gera 3 posts:
1. LinkedIn (300 palavras): insight de percepção baseado nestes dados. Tom: analítico, directo, sem fraseados motivacionais.
2. Instagram (legenda 150 palavras + call-to-action): provocação visual. Tom: curioso, intrigante.
3. Twitter/X (5 tweets em thread): dados da semana + o que aprendemos sobre percepção colectiva em PT/BR.

Não uses "jornada", "bem-estar", "coração", "comunidade vibrante". Fala com dados, não com entusiasmo.
```

**Templates fixos (preencher em 10 min com Claude):**

| Dia | Canal | Template |
|---|---|---|
| Seg | LinkedIn | "Esta semana [X] pessoas votaram [palavra]. [Y]% aprovaram. O que isso diz sobre [tema] em Portugal?" |
| Qua | Instagram | Veredito Card do fundador + "Hoje aprovei [palavra] com [imagem]. E tu?" |
| Sex | X/Twitter | Thread: "O que aprendemos com [N] votos esta semana sobre percepção de [tema]" |

---

## ⚠️ ALERTAS CRÍTICOS (não ignorar)

### Alertas Técnicos

1. **Curator schema bug** — `_insert_event()` cria `location` como string em vez de `{city, coordinates}`. Eventos com schema errado são invisíveis para o mapa. **Fix imediato antes de qualquer growth.**

2. **Render free tier cold start** — 30-60s de latência mata qualquer utilizador novo que chega orgânico. Upgrade Starter (€7/mês) tem ROI positivo com 1 Perception Score vendido.

3. **Groq 8K context window** — não enviar histórico raw ao modelo. Comprimir sempre antes de chamar qualquer endpoint de insights.

4. **Secrets em git history** — rotacionar todas as chaves API que apareceram em commits anteriores (ver [[🐛 Erros Conhecidos]]).

### Alertas Legais

5. **Instagram/LinkedIn scraping proibido** — usar exclusivamente Unsplash API, Pexels API, NewsAPI para Feed Curator.

6. **Sorteios aleatórios requerem SRIJ** — renomear para "Desafio de Percepção" (skill-based: ganha quem escolheu palavra coincidente com mais votada).

7. **GDPR em eventos privados** — landing page de convite deve mostrar consentimento antes de carregar qualquer imagem de utilizador não-registado.

8. **Stripe Connect KYC** — Creator Program com payout em dinheiro requer KYC de cada creator. Adiar para Fase 4; usar B$ como moeda interna até MRR ≥ €5K.

---

## 🗺️ MAPA COMPLETO DE NOVAS FEATURES — SEQUÊNCIA DEFINITIVA

| # | Feature | RICE | Semana | Effort | Dependência |
|---|---|---|---|---|---|
| 0 | Upgrade Render Starter | 900 | HOJE | 5 min | Nenhuma |
| 1 | Fix Curator `_insert_event()` | 200 | HOJE | 2-4h | Nenhuma |
| 2 | Streak Counter | 63 | S1 | 1 dia | Nenhuma |
| 3 | Push Notifications (Expo) | 55 | S1 | 1-2 dias | Nenhuma |
| 4 | Daily Challenge | 43 | S1 | 1-2 dias | Push Notifications |
| 5 | Feed Curator Diário (fontes legais) | 11 | S1-S2 | 3-4 dias | NewsAPI key |
| 6 | Anonymous Mode | 10 | S1 | 1-2 dias | Nenhuma |
| 7 | Espelho Humanizado (compressão histórico) | 9 | S2 | 3-4 dias | user_memory (3.E) |
| 8 | Time Capsule | 9 | S2 | 2 dias | Resend + cron |
| 9 | Besord for Teams (workspace privado) | 8 | S2 | 3-5 dias | workspaces.py existente |
| 10 | Perception Score (micro-B2B) | 7 | S2 | 2-3 dias | Stripe + 15 DAU |
| 11 | Besord Embed (snippet JS) | 6 | S2-S3 | 3-4 dias | Evento público existente |
| 12 | Eventos Privados + Convites | 5 | S3 | 7-10 dias | GDPR disclaimer |
| 13 | Páginas Eventos Dinâmicas | 4 | S3 | 3-4 dias | Cloudinary (✅ live) |
| 14 | Besord Live (SSE) | 3 | Mês 2 | 5-7 dias | FastAPI SSE |
| 15 | Widget iOS/Android | 1.5 | Mês 2-3 | 14+ dias | D7 ≥ 25% confirmado |
| 16 | Creator Program (cash-out) | 0.2 | Fase 4 | 14+ dias | MRR ≥ €5K + Stripe Connect |
| 17 | Collab entre utilizadores | 0.1 | Fase 4 | 3-4 dias | 200+ DAU |

---

## 🔑 O QUE TORNA O BESORD INDISPENSÁVEL

```
HÁBITO DIÁRIO:       Daily Challenge + Streak + Push às 20h
SELF-KNOWLEDGE:      Espelho Humanizado + Time Capsule + 10 Arquétipos
SOCIAL GRAVITY:      Eventos Privados com Convites + Sincronia activa
CONTEÚDO SEMPRE:     Feed Curator Diário + Word of the Day + Daily Challenge
B2B SEM BARREIRA:    Perception Score + Besord for Teams + Embed
B2B DE ESCALA:       Primeiro Olhar + Besord Live + API Percepção
```

Quando estas 6 camadas coexistirem, o Besord não concorre com Instagram.
Concorre com o espelho — e esse, toda a gente usa todos os dias.

---

> **Documento criado:** 18 Junho 2026
> **Última actualização:** 18 Junho 2026
> **Próxima revisão:** após D21 com dados reais de D7 retention
> **Links relacionados:** [[🚀 Plano Final de Implementação]] | [[⚙️ Regras de Negócio]] | [[📐 Arquitetura]] | [[🐛 Erros Conhecidos]]
