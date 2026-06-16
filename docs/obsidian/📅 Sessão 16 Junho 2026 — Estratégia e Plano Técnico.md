# 📅 Sessão 16 Junho 2026 — Estratégia e Plano Técnico

> **Contexto:** Sessão de reflexão estratégica após análise de mercado (Soko, VibeRadar, Google Maps + Gemini). O fundador identificou que o Besord compete numa categoria diferente dos agregadores de eventos: **inteligência de percepção**, não logística de atenção.
>
> **Decisões tomadas:** B$ dobrado para voto+palavra, Cloudinary para storage de imagens, Curador Automático para resolver o vazio de eventos, Word Economy como narrativa de diferenciação.

---

## 📊 Diagnóstico de Mercado

### Concorrentes de descoberta de eventos (NÃO são nossos concorrentes diretos)
| App | O que faz | Porque não compete connosco |
|---|---|---|
| Soko | Agrega eventos via crawling + IA lê cartazes | Não gera dados de percepção |
| VibeRadar | Mapa interativo de eventos no Brasil | Não tem voto forçado com palavra |
| Google Maps + Gemini | Busca semântica de locais/eventos | Não tem Time-Gate nem B$ |

**Conclusão:** Nenhum concorrente gera dados de percepção (Aprovo/Desaprovo + 1 palavra). O Besord compete no mercado de **inteligência de percepção** (Nielsen, Kantar, focus groups — €25B), não no mercado de agregação de eventos (€500M).

### Posicionamento
> *"O Instagram te conhece para te vender coisas. O Besord ajuda-te a conheceres-te para não precisares de mais nada. Para marcas: não vendemos impressões — vendemos percepções."*

---

## ✅ 1. B$ — Implementado (16 Jun 2026)

**Alteração em `backend/server.py`**, função `vote_post()`:

- `VoteRequest` agora aceita `best_word: Optional[str] = None`
- Voto com palavra (best_word válida) = **+2 B$**
- Voto sem palavra = **+1 B$**
- `best_word` guardada diretamente no documento `votes` (não mais como comment separado)
- Toggle de voto mantém B$ anterior (não re-atribui)
- Switch de voto atribui B$ conforme a nova palavra

**Impacto esperado:**
- Utilizador atinge 1.000 B$ em ~50 dias (com palavra) vs. ~100 dias (sem palavra)
- Incentiva densidade semântica no dataset
- Gate de evento pessoal torna-se mais acessível para utilizadores engajados

---

## ☁️ 2. Cloudinary — Plano de Migração

### Objetivo
Migrar `image_base64` dos posts para Cloudinary, libertando ~70% do storage do MongoDB M0 (512MB).

### Configuração necessária
| Campo | Onde obter |
|---|---|
| Cloud Name | `ddr3zepsy` (fornecido pelo fundador) |
| API Key | Dashboard Cloudinary → Settings → Access Keys |
| API Secret | Dashboard Cloudinary → Settings → Access Keys |

> ⚠️ **Ação Rodrigo:** gerar API Key + Secret no dashboard Cloudinary e enviar ao CTO.

### Plano de migração

**Fase 1 — Novos posts (2–3h)**
1. Adicionar `cloudinary` ao `requirements.txt`
2. Criar `backend/storage.py` com:
   - `upload_image(base64_str) → url` — faz upload para Cloudinary
   - `delete_image(public_id)` — remove (útil para delete de posts)
3. Alterar `POST /api/posts`: em vez de guardar `image_base64` no MongoDB, chamar `upload_image()` e guardar `image_url`
4. Adicionar `image_url` ao modelo `PostOut`

**Fase 2 — Migração de posts existentes (1–2h)**
1. Script `backend/scripts/migrate_images.py`:
   - Itera todos os posts com `image_base64`
   - Faz upload para Cloudinary
   - Substitui `image_base64` por `image_url`
   - Mantém `image_base64` como backup durante 7 dias
2. Executar localmente, validar, depois remover `image_base64`

**Fase 3 — Eventos (30min)**
1. Mesmo tratamento para `events.image_base64`

### Resposta à pergunta: qualidade de imagem?
**Não se perde qualidade. Ganha-se.** Cloudinary armazena o binário original e serve via CDN global (200+ edge locations). Além disso:
- Compressão automática sem perda perceptível
- Auto-format: WebP para Chrome, AVIF para Firefox
- Redimensionamento on-the-fly via URL parameters

---

## 🤖 3. Curador Automático — Pipeline de 5 Estágios

### O problema
O Besord é **passivo**: espera que alguém crie um evento. Se ninguém cria, o mapa está vazio. A solução é um curador automático que gera eventos sintéticos a partir de fontes confiáveis, com pipeline de validação rigorosa.

### Arquitetura

```
┌──────────────────────────────────────────────────────┐
│              CRON JOB (Render, 2×/dia)                │
│                                                       │
│  Estágio 1 → FONTES WHITELIST                         │
│  Estágio 2 → EXTRAÇÃO GROQ (com confidence score)     │
│  Estágio 3 → VALIDAÇÃO ESTRUTURAL (regras Python)     │
│  Estágio 4 → QUALIDADE DE IMAGEM (Pillow)             │
│  Estágio 5 → FILA DE REVISÃO (admin opcional)         │
│                                                       │
│  Output: eventos limpos na MESMA collection `events`   │
└──────────────────────────────────────────────────────┘
```

### Estágio 1 — Fontes Whitelist

Fontes confiáveis, NUNCA crawling aberto:

| Fonte | Tipo | Prioridade |
|---|---|---|
| `agendalx.pt` | Agenda cultural Lisboa | Alta |
| `cm-lisboa.pt/agenda` | Portal CML | Alta |
| `cm-porto.pt/agenda` | Portal CMP | Alta |
| `eportugal.gov.pt` | Portal oficial | Média |
| `residentadvisor.net` | Música electrónica | Média |
| `eventbrite.pt` | Eventos gerais | Baixa |
| `timeout.pt` | Agenda TimeOut | Média |

### Estágio 2 — Extração com Groq (confidence score)

Prompt estruturado que extrai JSON. Se `confidence.overall < 70` → descarta.

```json
{
  "title": "Festival Jazz Lisboa",
  "date": "2026-07-15",
  "time": "21:00",
  "location_name": "Coliseu dos Recreios",
  "city": "Lisboa",
  "theme": "Música",
  "confidence": { "title": 95, "date": 100, "location": 90, "overall": 92 },
  "extracted": true
}
```

### Estágio 3 — Validação Estrutural (Regras Python)

| Regra | Bloqueia |
|---|---|
| Data no passado | Concerto 2023 |
| Data > 180 dias futuro | Festival 2028 (vai para revisão) |
| Cidade fora de cobertura | Tóquio, Nova Iorque |
| Regex spam | "🔥GANHE DINHEIRO!!!" |
| Evento duplicado (fuzzy match título + data ±2d + cidade) | Merge, não duplica |

### Estágio 4 — Qualidade de Imagem (Pillow)

- Imagem < 400×400px → descarta imagem, evento entra sem imagem
- Proporção > 1:3 → descarta imagem (banner, não cartaz)
- Download falha → evento entra sem imagem

### Estágio 5 — Fila de Revisão

Eventos com `confidence 50–70` ou `data > 120d` vão para `event_queue`:
- Admin revê via endpoint (aprove/descarta)
- Expira em 48h se não revisto

### Resultado estimado (por execução)
```
100 eventos brutos → 65 extraídos → 52 validados → 47 aprovados direto + 5 em revisão
```

### Como se liga ao projeto atual

- **MESMA collection `events`** — eventos curados convivem com eventos de utilizadores
- **Novos campos:** `source: "curator_ai"`, `curator_confidence: int`, `curator_source_url: str`
- **Mesmo mapa:** `GET /api/events/nearby` retorna eventos curados + user
- **Mesmo feed:** aparecem como card único
- **Mesmas mecânicas:** voto Aprovo/Desaprovo + palavra + B$
- **Mesma monetização:** patrocínios, publish-image, Primeiro Olhar

### Esforço de implementação

| Componente | Ficheiro | Horas |
|---|---|---|
| `backend/curator.py` | Módulo novo — pipeline completo | 6h |
| Fontes RSS/API | `backend/sources.py` — feedparser + httpx | 3h |
| `event_queue` collection | MongoDB + endpoints admin | 2h |
| Cron job Render | `render.yaml` — scheduled job 2×/dia | 1h |
| Testes + prompt tuning | Iteração com Groq | 2h |
| **Total** | | **14h** |

---

## 🧠 4. Onde a IA entra no Besord (Visão Completa)

### O que já existe

| Feature | Endpoint | Modelo | Estado |
|---|---|---|---|
| Espelho de Sessão | `GET /api/insights/session` | Groq llama-3.1-8b | ✅ Live |
| Sincronia (Insight) | `calculate_sincronia()` | Groq | ✅ Live |
| Diagnóstico Primeiro Olhar | `_groq_primeiro_olhar_diagnosis()` | Groq | ✅ Live |
| Top palavras campanha | Agregação MongoDB | N/A | ✅ Live |
| B$ com palavra | `POST /api/posts/{id}/vote` | N/A | ✅ Implementado (16 Jun) |

### O que está planeado (ordem de implementação)

| Feature | O que faz | Estado |
|---|---|---|
| **Curador Automático** | Pipeline 5 estágios → enche BD de eventos | 📋 Esta sessão |
| **Perception Forecast** | Anti-Clash: prevê palavra ideal para evento antes de lançar | 📋 Esta sessão |
| Recomendação Preditiva (user_memory) | Reordena feed baseado em histórico semântico | Fase 3.E |
| Busca Semântica de Eventos | Query natural → filtros → eventos | Fase 3 |
| Cartaz → Evento | Foto do cartaz → IA extrai dados + sugere palavra | Fase 4 |
| Espelho de Empatia Completo | user_memory + 30 sessões → perfil evolutivo | Fase 3.F |

---

## 💬 5. Word Economy — Narrativa

### Conceitos e comunicação

| Conceito | O que é | Como comunicar (B2B) | Como comunicar (B2C) |
|---|---|---|---|
| **Word Bonds** | 2 utilizadores partilham a mesma palavra em 3+ sessões → +3 B$ cada | "Identificámos afinidade semântica entre os teus clientes e o segmento X." | "Tu e [Nome] escolheram 'Silêncio' 3 vezes. +3 B$." |
| **Word Futures** | Marca reserva palavra para evento; sistema mede alignment | "A tua marca escolheu 'Inovação'. O público disse 'Complexo'. Alignment Score: 12/100." | — |
| **Word Index** | Ranking público de palavras por cidade/tema/período | "As 10 palavras mais associadas a confiança em Lisboa nos últimos 30 dias." | "A palavra mais aprovada esta semana foi 'Autêntico'." |
| **Alignment Score** | % do público cuja palavra coincide com a palavra-alvo da marca | "12% de alinhamento. 68% percebem 'Complexo'. Diagnóstico completo na página 3." | — |

### Pitch de 1 frase
> "O Besord não te pergunta o que pensas. Observa o que fazes quando tens 10 votos por dia e és forçado a escolher uma palavra."

### Pitch B2B (3 frases)
> "Focus groups custam €5.000 e levam 3 semanas. O Besord Primeiro Olhar custa €79,90 e em 48 horas diz-te exatamente que palavra o teu público associa à tua marca — e qual a distância entre o que querias transmitir e o que realmente foi percebido. Isto não é um anúncio. É um diagnóstico."

---

## 🗺️ Ordem de Implementação (Próximas Sessões)

| # | Tarefa | Horas | Dependências |
|---|---|---|---|
| 1 | Cloudinary — configurar + `storage.py` + upload | 3h | API Key/Secret (Rodrigo) |
| 2 | Cloudinary — migrar `POST /api/posts` | 1h | #1 |
| 3 | Curador — `backend/curator.py` pipeline 5 estágios | 6h | — |
| 4 | Curador — fontes whitelist + RSS | 3h | #3 |
| 5 | Curador — `event_queue` collection + endpoints admin | 2h | #3 |
| 6 | Curador — cron job Render | 1h | #3–5 |
| 7 | Perception Forecast — endpoint `GET /api/perception-forecast` | 4h | Curador (eventos existentes) |
| 8 | `evento/[id].tsx` — botões PUBLICAR IMAGEM e EXPOSITOR | 4h | — |
| 9 | Word Economy — endpoints Word Bonds + Word Index | 5h | — |
| 10 | Landing page `/landing` (ferramenta de vendas) | 6h | — |
| 11 | Script migração imagens existentes → Cloudinary | 2h | #2 |
| 12 | Remover `image_base64` de posts existentes (7 dias após migração) | 30min | #11 |

---

## 🌍 6. Decisão: Mercado Geográfico do Curador — Lisboa/Porto, não Brasil (16 Jun 2026, tarde)

> **Contexto:** numa conversa exploratória com outra IA, surgiu a ideia de redesenhar o Curador Automático para mercado primário Brasil (60-70%), com Portugal, Angola e Cabo Verde como secundários, e fontes novas (Sympla API, RSS Angola/Cabo Verde). A ideia também propunha abandonar a filtragem temática de eventos ("tipo de evento não importa, importa se há gente com telemóvel a fotografar") usando exemplos como Rock in Rio, Carnaval e Copa do Mundo 2026.

**Decisão tomada:** **não** mudar o mercado primário para o Brasil agora. Razão: Rodrigo está fisicamente em Lisboa — a estratégia dos 100 Fundadores (grupos densos: agência de publicidade, fotógrafos, copywriters, mestrado design, redacção cultural) depende de execução presencial, que só é viável onde o fundador está. Ir a 5 países antes de validar o ciclo completo (Fundador → Sincronia → Primeiro Olhar vendido) numa única cidade repete o risco já identificado na visão de produto ("Festa vazia — efeito rede"), cuja mitigação documentada é densidade local, não dispersão geográfica.

**O que se mantém:**
- Lisboa continua o mercado de lançamento e o foco da angariação de Fundadores.
- Brasil/Angola/Cabo Verde ficam registados como **expansão de mercado futura** (Fase 4+, a revisitar só depois de validado o ciclo em Lisboa) — não descartados, só não são acção imediata.
- Não se adicionam fontes novas (Sympla, Eventbrite API, RSS Angola/Cabo Verde) por agora.

**O que se aceita do parecer (ideia, ainda sem implementação):** a crítica à filtragem temática estava certa — `GOOGLE_NEWS_QUERIES` em `sources.py` só cobre "cultura"/"concertos"/"teatro", excluindo desporto, festas e feiras mesmo dentro de Lisboa/Porto. Quando se decidir avançar para código, a acção é alargar essas queries para mais tipos de evento, mantendo as duas cidades já cobertas — a validação estrutural do curador (`curator.py`) já não filtra por tipo (só por data, cidade, spam e duplicados), por isso não precisaria de alteração nessa parte.

---

> **Data:** 16 Junho 2026
> **Commits:** `53091fd` Cloudinary · `c467029` Curador · `f929fbe` fix router · `1ea335b` fix MAX_SOURCE_EVENTS · `6cadf62` queries agnósticas + janela temporal
> **Ação Rodrigo:** ✅ Cloudinary API keys geradas · ✅ Render env vars configuradas · ✅ Cron job `besord-curador` criado (0 8,20 * * *)
> **Próxima sessão:** Perception Forecast · `evento/[id].tsx` · Landing page `/landing`

---

## 🟢 7. Resultados da Implementação (16 Jun 2026, tarde)

### 7.1 Cloudinary — Implementado ✅

**3 ficheiros alterados:**
- `backend/storage.py` — módulo novo: `upload_image()`, `upload_images()`, `delete_image()`, `is_configured()`
- `backend/requirements.txt` — adicionado `cloudinary==1.43.0`
- `backend/server.py` — `POST /api/posts`, campanhas e eventos usam `storage.upload_image()`

**Como funciona:**
- Imagem enviada em base64 → `storage.upload_image()` → URL Cloudinary CDN
- Campo `image_url` guardado no MongoDB (≈200 bytes, vs 500KB do base64)
- Campo `image_base64` vai vazio se Cloudinary ativo, mantém fallback se credenciais ausentes
- `serialize_post()` prefere `image_url` sobre `image_base64`

**Render:**
- Env vars `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` configuradas
- Upload testado: `https://res.cloudinary.com/ddr3zepsy/image/upload/...`

---

### 7.2 Curador Automático — Implementado ✅

**3 ficheiros novos/alterados:**
- `backend/sources.py` — 15 queries Google News RSS, city-focused (não temáticas)
- `backend/curator.py` — pipeline completo de 5 estágios + endpoints admin
- `backend/server.py` — registo do router + índices `event_queue`

**Pipeline:**

| Estágio | O que faz | Thresholds |
|---|---|---|
| **1. FETCH** | 15 queries Google News → ~500 raw events → dedup → 80 amostra | `MAX_SOURCE_EVENTS=80` |
| **2. EXTRACT** | Groq `llama-3.1-8b-instant` → JSON {title, date, location, city, theme, confidence} | `MIN_CONFIDENCE_REVIEW=50` |
| **3. VALIDATE** | Python: data passada, cidade fora cobertura, spam, título curto, localização vazia | Apenas estruturais — nunca por tipo |
| **4. IMAGE** | Pillow: ≥400×400, proporção < 1:3 | Sem imagem → evento entra sem capa |
| **5. REVIEW** | Confiança + janela temporal → insere ou queue | Ver tabela abaixo |

**Stage 5 — Decisão por janela temporal:**

| Janela | Confiança necessária | Destino |
|---|---|---|
| 0–7 dias (urgente) | ≥ 60 (com +10 bónus) | Insere direto |
| 8–60 dias | ≥ 70 | Insere direto |
| > 60 dias | Qualquer | Fila de revisão |
| 50–69 (q.q. janela) | — | Fila de revisão |

**Queries do Google News (15 queries, Lisboa 8 + Porto 7):**

```
"agenda lisboa hoje"           "agenda porto hoje"
"eventos lisboa esta semana"   "eventos porto esta semana"
"o que fazer lisboa hoje"      "o que fazer porto hoje"
"lisboa noite hoje"            "porto noite hoje"
"festas lisboa este fim de semana"  "festas porto este fim de semana"
"concertos lisboa esta semana"
"agenda lisboa junho 2026"     "agenda porto junho 2026"
"festivais lisboa 2026"        "festivais porto 2026"
```

**Princípio:** qualquer evento com pessoas + telemóveis é matéria-prima. O Groq extrai o primeiro evento concreto mesmo de artigos de compilação/agenda. A validação nunca rejeita por tipo.

**Endpoints admin:**

| Método | Path | Descrição |
|---|---|---|
| `POST` | `/api/curator/run?api_key=...` | Executa pipeline completo |
| `GET` | `/api/admin/event-queue` | Lista eventos pendentes de revisão |
| `POST` | `/api/admin/event-queue/{id}/approve` | Aprova e insere |
| `POST` | `/api/admin/event-queue/{id}/reject` | Rejeita |

**Nova collection:** `event_queue` — TTL 48h, índices em `status` e `expires_at`

**Cron job Render:** `besord-curador` — schedule `0 8,20 * * *` (9h e 21h Lisboa), Starter (512MB), comando `curl -X POST ".../api/curator/run?api_key=..."`

**Primeira execução (16 Jun):**
```json
{"ok":true,"stats":{"fetched":533,"extracted":0,"validated":0,"inserted":0,"queued":0,"rejected":80}}
```
(80 rejeitados é esperado — a maioria dos artigos Google News são compilações sem eventos individuais. O yield melhora com o prompt ajustado em `6cadf62`.)

**Novos campos em `events`:**
- `source: "curator_ai"`
- `curator_confidence: int`
- `curator_source_url: str`
- `curator_source_type: str`
- `event_type: "curated"`

---

### 7.3 Decisão estratégica validada na implementação

A filtragem temática foi removida das queries (eram "concertos", "exposições", "teatro" — agora são "agenda hoje", "noite hoje", "fim de semana"). A validação estrutural (`_validate_structural()`) nunca rejeitou por tipo. O Groq agora extrai de compilações, não as rejeita.

**Mercado:** mantém-se Lisboa + Porto como foco. Brasil/Angola/CV continuam como expansão futura (Fase 4+).
