# Briefing: Sessão 16 Junho 2026 — Implementação Cloudinary + Curador Automático

**Data:** 16 Junho 2026
**Objectivo:** Implementar Cloudinary CDN (armazenamento de imagens) e Curador Automático (pipeline 5 estágios para povoar o mapa de eventos)
**Resultado:** Ambos implementados no backend. 10 eventos seed (não confirmados em produção — ver Secção 6). Cron job não confirmável no código (ver Secção 2.6). 7 documentos Obsidian actualizados.

> ⚠️ **Verificação independente feita em 16 Jun (tarde) — ver anotações `[VERIFICADO]` / `[CORRIGIDO]` / `[NÃO VERIFICÁVEL]` ao longo do documento.** Foi encontrado um **bug crítico não documentado**: o Curador insere eventos com um schema incompatível com o resto da app — ver Secção 9, item 0. Sem essa correcção, o Curador não entrega eventos visíveis aos utilizadores mesmo depois do deploy bem sucedido.

---

## 1. Cloudinary — Armazenamento de Imagens

### 1.1 O que foi construído

Ficheiro **`backend/storage.py`** — módulo novo com 4 funções:

| Função | Descrição |
|---|---|
| `is_configured()` | Verifica se as 3 env vars Cloudinary existem |
| `upload_image(base64_str, public_id=None)` | Upload de 1 imagem via `cloudinary.uploader.upload()` |
| `upload_images(base64_list)` | Upload em batch (paralelo) |
| `delete_image(public_id)` | Remove imagem do Cloudinary |

### 1.2 Integração no `server.py`

Três endpoints alterados para usar Cloudinary com fallback automático:

- **`POST /api/posts`** (criar post): imagem → `storage.upload_image()` → `image_url` Cloudinary. Se Cloudinary não configurado, fallback para `image_base64`.
- **`POST /api/events`** (criar evento): mesma lógica para imagem de capa.
- **`POST /api/campaigns`** (criar campanha): mesma lógica.
- **`serialize_post()`**: prefere `image_url` (CDN) sobre `image_base64` (legado).

### 1.3 Campos novos na BD

- `posts.image_url` — URL Cloudinary (string). Preferencial sobre `image_base64`.
- `events.image_url` — URL Cloudinary (string).
- Quando Cloudinary activo: `image_url = "https://res.cloudinary.com/ddr3zepsy/..."` e `image_base64 = ""`.

### 1.4 Configuração (Render env vars)

```
CLOUDINARY_CLOUD_NAME=ddr3zepsy
CLOUDINARY_API_KEY=<fornecida pelo Rodrigo>
CLOUDINARY_API_SECRET=<fornecida pelo Rodrigo>
```

### 1.5 Dependência nova

`backend/requirements.txt`: `cloudinary==1.43.0`

---

## 2. Curador Automático — Pipeline de 5 Estágios

### 2.1 Arquitectura

Dois ficheiros novos:

| Ficheiro | Descrição |
|---|---|
| **`backend/sources.py`** | Fontes whitelist — 15 queries Google News RSS para Lisboa/Porto |
| **`backend/curator.py`** | Pipeline 5 estágios + endpoints admin + router FastAPI |

### 2.2 `sources.py` — detalhe

**[CORRIGIDO 16 Jun, tarde]** A lista abaixo no documento original já não correspondia ao código (foi reescrita pelo commit `6cadf62`). Lista actual, confirmada linha a linha em `sources.py` (15 queries, **6** Lisboa curto-prazo + **5** Porto curto-prazo + **4** longo prazo):

```python
GOOGLE_NEWS_QUERIES = [
    # Lisboa — curto prazo (hoje, esta semana)
    "agenda lisboa hoje", "eventos lisboa esta semana", "o que fazer lisboa hoje",
    "lisboa noite hoje", "festas lisboa este fim de semana", "concertos lisboa esta semana",
    # Porto — curto prazo
    "agenda porto hoje", "eventos porto esta semana", "o que fazer porto hoje",
    "porto noite hoje", "festas porto este fim de semana",
    # Longo prazo (agenda mensal, planeamento)
    "agenda lisboa junho 2026", "agenda porto junho 2026",
    "festivais lisboa 2026", "festivais porto 2026",
]
```

**Constantes de controlo:**
- `MAX_SOURCE_EVENTS = 80` — amostra máxima enviada ao Groq. **[CORRIGIDO]** vive em `curator.py`, não em `sources.py`.
- ~~`GOOGLE_NEWS_MAX_PER_QUERY = 100`~~ — **[CORRIGIDO] esta constante não existe no código.** Não há limite de itens por query aplicado pela app; `_fetch_rss()` itera todos os `<item>` que o Google News devolver, sem cap próprio.

**Modelo `RawEvent`** — dataclass com campos: `title`, `description`, `source_url`, `source_type`, `source_name`, `city_hint`, `fetched_at`, `content_hash` (SHA256 para dedup), `article_text` (preenchido async). **[VERIFICADO]**

**Deduplicação**: `content_hash = sha256(title|source_url|description)[:16]`. Apenas 1 evento por hash único.

**`_enrich_article_texts()`** — adicionado nesta sessão (ver secção 4.2). Busca texto real do artigo seguindo o link do Google News, porque o RSS só tem título.

### 2.3 `curator.py` — detalhe do pipeline

#### Stage 1: FETCH
- Chama `sources.fetch_all_sources()` — 15 requests RSS em paralelo
- Dedup por `content_hash`
- Limita a `MAX_SOURCE_EVENTS` (80)
- **NOVO (16 Jun):** Chama `sources._enrich_article_texts()` para buscar texto real dos artigos

#### Stage 2: EXTRACT
- Modelo Groq: `llama-3.1-8b-instant` (free tier)
- Prompt: extrai o primeiro evento concreto de cada texto, mesmo de artigos de compilação/agenda
- JSON schema de output: `{title, date, location_name, city, theme, confidence_overall, extracted}`
- Rate limiting: semáforo de 2 requests concorrentes, 3 tentativas com exponential backoff
- Timeout Groq: 15s

#### Stage 3: VALIDATE
Regras Python (NUNCA por tipo/categoria de evento):

| Regra | Acção |
|---|---|
| `extracted == false` ou confiança < `MIN_CONFIDENCE_REVIEW` (50) | Rejeita — **[CORRIGIDO]** este corte acontece no loop principal de `run_curator()`, antes de chamar `_validate_structural()`, não dentro dela |
| Data no passado | Rejeita — **[CORRIGIDO]** tolerância real é de **7 dias**, não "1 dia" (`event_date < today - timedelta(days=7)`) |
| Cidade não é Lisboa nem Porto | Rejeita |
| Padrão de spam no título | Rejeita |
| Título vazio ou `location_name` vazio | Rejeita |

#### Stage 4: IMAGE
- Validação com Pillow: mínimo 400×400px, proporção < 1:3
- Sem imagem válida → evento entra sem capa (não bloqueia)

#### Stage 5: REVIEW
Thresholds de decisão:

| Janela temporal | Confiança necessária | Destino |
|---|---|---|
| 0–7 dias (urgente) | ≥ 60 (com +10 bónus) | Insere direto na BD |
| 8–60 dias | ≥ 70 | Insere direto na BD |
| > 60 dias | Qualquer | Fila de revisão |
| 50–69 (q.q. janela) | — | Fila de revisão |

Constantes:
- `URGENT_DAYS = 7`
- `QUEUE_DAYS = 60`
- `MIN_CONFIDENCE_AUTO = 70`
- `URGENT_CONFIDENCE_BOOST = 10`
- `MIN_CONFIDENCE_REVIEW = 50`

**[NOVO — achado da verificação]** `curator.py` também define `MAX_DAYS_FUTURE = 180` e `MAX_FUTURE_DAYS_REVIEW = 120` — confirmei que **nenhuma das duas é usada em lado nenhum do pipeline actual**. São resíduos de uma versão anterior da lógica, substituída por `URGENT_DAYS`/`QUEUE_DAYS`/`effective_confidence`. Não fazem mal a correr (código morto, não chamado), mas confundem quem ler o ficheiro — candidatas a remover numa limpeza futura.

#### Funções auxiliares

- **`_insert_event(db, groq_ev, raw)`**: insere na collection `events`. **[CORRIGIDO — ERRO GRAVE]** O schema descrito aqui originalmente (`location.{address, city, country_code, lat, lon}`, com `date` e `expires_at`) **não corresponde ao código real**. O que `_insert_event()` realmente grava:
  - `location`: **string** (= `ev.location_name`), não objecto aninhado
  - `city`, `lat`, `lon`: campos **separados ao nível raiz** do documento (não dentro de `location`), e `lat`/`lon` ficam sempre `None` (não há geocoding)
  - **Sem campo `country_code`**
  - **Sem campo `date`** (só tem `start_date`/`end_date`)
  - **Sem campo `expires_at`**

  **Porque é que isto importa:** `GET /api/events` e `GET /api/events/nearby` filtram ambos por `"expires_at": {"$gt": now}` — como os eventos curados nunca têm `expires_at`, **nunca aparecem em nenhum dos dois endpoints**, independentemente de quantos o Curador inserir. Mesmo que esse filtro fosse corrigido, `GET /api/events/nearby` faz `loc = event.get("location", {}); loc.get("lat")` — esperando um dicionário; como `location` é uma string, isto rebentaria com `AttributeError: 'str' object has no attribute 'get'` para **todos** os utilizadores a chamar esse endpoint, não só para o evento problemático. E `serialize_event()` acede `doc["date"]` directamente (sem `.get()`) — outro `KeyError` latente, da mesma família do bug 4.3 já corrigido no `seed_events.py` mas nunca replicado para o `curator.py`.

  **Conclusão prática:** o Curador, tal como está, pode correr sem erros e inserir eventos na BD — mas esses eventos ficam invisíveis na app. O objectivo da sessão (povoar o mapa) não está cumprido, mesmo com o deploy a funcionar. Ver correcção proposta na Secção 9, item 0.

  Restante do schema confirmado correcto: `event_id`, `company_id="curator_ai"`, `company_name="Curador Besord"`, `event_type="curated"`, `source="curator_ai"`, `curator_confidence`, `curator_source_url`, `curator_source_type`, `image_base64=""`, `status="active"`, `sponsorships_enabled=False`, `checkins_count=0`, `posts_count=0`.
- **`_queue_for_review(db, groq_ev, raw, reason)`**: insere na collection `event_queue` com TTL 48h. **[VERIFICADO]**

### 2.4 Nova collection: `event_queue`

```json
{
  "queue_id": "que_xxx",
  "title": "...",
  "date": "2026-07-15",
  "location_name": "...",
  "city": "Lisboa",
  "theme": "Música | null",
  "source_url": "https://news.google.com/...",
  "source_type": "google_news",
  "confidence_overall": 65,
  "reason": "Confiança 65% | Evento distante (90 dias)",
  "status": "pending_review",
  "event_id": null,
  "created_at": "ISO timestamp",
  "expires_at": "ISO timestamp (created_at + 48h)"
}
```

Índices: `{status: 1}` (filtrar pendentes), `{expires_at: 1}` (TTL index, auto-delete após 48h). **[VERIFICADO — confirmados em `server.py`: `db.event_queue.create_index("status")` e `create_index("expires_at", expireAfterSeconds=0)`]**

### 2.5 Endpoints admin

Registados via `curator_router(db)` em `server.py`:

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/curator/run?api_key=...` | POST | Executa pipeline manualmente |
| `/api/admin/event-queue` | GET | Lista eventos pendentes de revisão |
| `/api/admin/event-queue/{id}/approve` | POST | Aprova → insere na BD, marca `status=approved` |
| `/api/admin/event-queue/{id}/reject` | POST | Rejeita → `status=rejected` |

### 2.6 Cron job Render

- **Nome:** `besord-curador`
- **Schedule:** `0 8,20 * * *` (2×/dia, 8h e 20h UTC = 9h e 21h Lisboa)
- **Comando:** `curl -X POST "https://besord-backend.onrender.com/api/curator/run?api_key=besord-curator-2026"`
- **Dockerfile:** mesmo do backend
- **Tier:** Starter (512MB RAM)

**[NÃO VERIFICÁVEL pelo código]** Este cron job **não está em `render.yaml`** — só existe `besord-backend` (o serviço web). Se foi criado, foi directamente no dashboard do Render, fora do controlo de versões. Não tenho acesso ao dashboard para confirmar se existe, qual o schedule real, ou se está activo — o que é exactamente a dúvida já registada no item 1 da Secção 9. Dado o bug da Secção 2.3 (eventos curados ficam invisíveis), confirmar o cron é secundário até esse bug ser corrigido — corrigir o schema sem o cron a correr não tem efeito, mas o cron a correr sem o schema corrigido só gera mais eventos invisíveis na BD.

---

## 3. B$ — Voto com Palavra (Best Word)

### 3.1 O que mudou

- Voto **sem** palavra: utilizador ganha **+1 B$**
- Voto **com** palavra (`best_word`): utilizador ganha **+2 B$** (+100% bónus)
- `best_word` é guardada no documento `votes`
- **[CORRIGIDO]** O B$ só é pago no **voto novo** (1ª vez que o utilizador vota nesse post). Há duas situações distintas que a versão original do briefing confundia como uma só "toggle":
  - **Toggle off** (clicar no mesmo voto outra vez, para remover): apaga o voto, não há qualquer alteração de B$ (nem ganha nem perde o que já tinha).
  - **Switch** (mudar de Aprovo para Desaprovo ou vice-versa, sem remover primeiro): **não paga B$ de novo** — isto foi um fix de segurança feito mais tarde na mesma sessão (commit `e00b69e`), porque sem ele dava para trocar de voto repetidamente e gerar B$ ilimitado sem consumir Time-Gate.

### 3.2 Código alterado

Em `server.py`, função **`vote_post()`** **[CORRIGIDO — não existe nenhuma `create_vote()` no código; o nome correcto é `vote_post`]**:
- Campo `best_word` extraído do payload (`VoteRequest.best_word: Optional[str]`)
- Atribuição de B$: variável `bw = 2 if best else 1` **[CORRIGIDO — a variável chama-se `bw`, não `bw_earned`]**, só no ramo de voto novo
- `best_word` guardado no documento `votes` (tanto no voto novo como ao fazer switch — mas o switch não volta a pagar B$, mesmo que mude a palavra)

---

## 4. Bugs Corrigidos Durante a Sessão

### 4.1 Cron job exit 128 — `curl` ausente no Dockerfile

**Diagnóstico:** O Dockerfile `python:3.11-slim` não inclui `curl`. O cron job do Render executa `curl -X POST ...` dentro do container. Exit 128 = comando não encontrado.

**Correcção** (`Dockerfile`, commit `439b014`):
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser && chown -R appuser:appuser /app
```

### 4.2 Curador 0% yield — Google News RSS não tem texto

**Diagnóstico:** O RSS do Google News (`news.google.com/rss/search`) devolve apenas `<title>`, `<link>` (URL de redirect) e `<guid>`. O campo `<description>` contém APENAS um `<a href="...">` sem texto. Resultado: `full_text()` enviava apenas o título (50–100 chars) ao Groq, que não conseguia extrair dados de eventos.

**Correcção** (`sources.py` + `curator.py`, commit `48a672b`):

1. Adicionado campo `article_text` ao `RawEvent`
2. Nova função `_enrich_article_texts(events, max_concurrent=4)`:
   - Segue o link do Google News com `follow_redirects=True`
   - Extrai texto de tags `<p>` com `BeautifulSoup`
   - Filtra parágrafos com < 30 chars
   - Limita a 2000 chars por artigo
   - Semáforo de 4 requests concorrentes
   - Timeout 8s por request
   - Silencia erros (artigo atrás de paywall, timeout, etc.)
3. `full_text()` usa `article_text` com precedência sobre `description`
4. Convocada no curator entre Stage 1 (FETCH) e Stage 2 (EXTRACT)

### 4.3 API `/api/events` devolvia 500 Internal Server Error

**Diagnóstico:** `serialize_event()` acede `doc["image_base64"]` e `doc["date"]` com acesso directo (sem `.get()`). Os eventos seed não tinham estes campos → `KeyError` → 500.

**Correcção** (`seed_events.py`, commit `62fd61c`):
- Adicionado `image_base64: ""` a todos os seed events
- Adicionado `date: ev["start_date"]` (cópia de `start_date`)
- Adicionado `location: {address, city, country_code, lat, lon}` (nested object)
- Adicionado `expires_at: end_dt`

### 4.4 API não filtrava por cidade com `?city=Lisboa`

**Diagnóstico:** O endpoint `GET /api/events` tem parâmetro `scope` com default `"world"`. O filtro `city` só é aplicado quando `scope="city"`. Query `?city=Lisboa` sem `scope=city` devolve todos os eventos.

**Query correcta:** `GET /api/events?scope=city&city=Lisboa`

(Não requer correcção de código — é comportamento esperado. O frontend deve passar `scope=city`.)

### 4.5 `motor` (async MongoDB) hang na máquina local

**Diagnóstico:** `AsyncIOMotorClient` com `mongodb+srv://` hang indefinidamente no ambiente local (DNS SRV + network). `pymongo` síncrono funciona.

**Correcção** (`seed_events.py`): script alterado de `motor` (async) para `pymongo` (sync).

### 4.6 `.env` path errado no seed script

**Diagnóstico:** `load_dotenv(Path(__file__).resolve().parent / ".env")` resolvia para `backend/scripts/.env` em vez de `backend/.env`.

**Correcção:** `load_dotenv(Path(__file__).resolve().parent.parent / ".env")`

---

## 5. Seed de Eventos

### 5.1 Script `backend/scripts/seed_events.py`

10 eventos manuais para Lisboa (6) e Porto (4), Junho–Agosto 2026:

| # | Evento | Cidade | Data | Tema |
|---|---|---|---|---|
| 1 | Feira do Livro de Lisboa | Lisboa | 18 Jun – 4 Jul | Literatura |
| 2 | Santos Populares — Arraial de Alfama | Lisboa | 19–20 Jun | Música |
| 3 | MAAT — Exposição Joana Vasconcelos | Lisboa | 1 Jul – 30 Set | Arte |
| 4 | Mercado de Santa Clara — Sábado | Lisboa | 20 Jun | Gastronomia |
| 5 | Jazz em Agosto — Gulbenkian | Lisboa | 1–15 Ago | Música |
| 6 | Noite de Fados — Mesa de Frades | Lisboa | 21–22 Jun | Música |
| 7 | Serralves em Festa | Porto | 4–5 Jul | Arte |
| 8 | Mercado Porto Belo — Sábado | Porto | 20 Jun | Gastronomia |
| 9 | São João do Porto | Porto | 23–24 Jun | Música |
| 10 | Exposição Muralismo — Rua das Flores | Porto | 20 Jun – 20 Ago | Arte |

### 5.2 Como executar

```bash
cd backend
python scripts/seed_events.py
```

Liga-se ao MongoDB Atlas de produção via `.env`. Usa `pymongo` síncrono.

---

## 6. Estado Final da BD (16 Jun 2026 20:00 UTC)

**[NÃO VERIFICÁVEL — auto mode bloqueou ligação directa à BD de produção nesta verificação, por ser uma leitura em produção não pedida explicitamente.]** Os números abaixo são os que o briefing original reportava; não os confirmei eu próprio. Se precisares de confirmação exacta, ou pedes-me autorização explícita para consultar a BD directamente, ou confirmas no MongoDB Atlas / Compass.

| Collection | Documentos (não confirmado nesta verificação) | Notas |
|---|---|---|
| `events` | 12 | 2 Copa FIFA (teste) + 10 seed |
| `event_queue` | 0 | Curador ainda não inseriu (yield 0 pré-fix) |
| `posts` | ~300+ | Não alterado |
| `votes` | ~500+ | Campo `best_word` já existe |

---

## 7. Documentação Obsidian Actualizada

7 ficheiros actualizados para reflectir o estado pós-implementação:

| Ficheiro | Alterações principais |
|---|---|
| **📅 Sessão 16 Junho 2026 — Estratégia e Plano Técnico** | +Secção 7: resultados Cloudinary, Curador, decisões |
| **🗄️ Estrutura de Dados** | `image_url` em posts/events, `event_queue` collection, `best_word` em votes, `curated` event_type, índices actualizados |
| **📐 Arquitetura** | Cloudinary no stack, `storage.py`/`curator.py`/`sources.py` nos ficheiros, `event_queue` nas collections, `curated` nos tipos, endpoints curador |
| **⚙️ Regras de Negócio** | +Secção Cloudinary (regras, config, porquê), +Secção Curador Automático (pipeline, thresholds, princípios, fontes futuras) |
| **👤 User Flow** | +Fluxo Curador Automático (5 stages), +Fluxo Upload de Imagens (Cloudinary fallback), data actualizada |
| **🏠 Home** | Cloudinary no estado de serviços, Fase 3 actualizada (Cloudinary ✅ Curador ✅), footer com próximos passos |
| **🚀 Plano Final de Implementação** | +Item 3.H (Cloudinary — IMPLEMENTADO), +Item 3.I (Curador Automático — IMPLEMENTADO), data actualizada |

---

## 8. Commits no GitHub

**[CORRIGIDO — lista original estava incompleta e tinha uma mensagem trocada.]** Ordem cronológica real (mais antigo → mais recente), confirmada em `git log`:

```
53091fd feat: Cloudinary storage — upload de imagens para CDN
c467029 feat: Curador Automático — pipeline de 5 estágios para eventos
f929fbe fix: curator_router — remove async (não precisa, causava AttributeError no include_router)
1ea335b fix: adicionar MAX_SOURCE_EVENTS que faltava na config
6cadf62 refactor: curador agnóstico a temas, sensível a janelas curtas
85e23ed fix: adicionar curl ao Dockerfile (cron job Render)
439b014 fix: Dockerfile +curl, seed script com 10 eventos Lisboa/Porto
48a672b fix: sources.py fetch article text from linked URLs (Google News RSS vazio)
62fd61c fix: seed events schema matching API (image_base64, date, location nested, expires_at)
dcbd315 fix: adiciona beautifulsoup4 ao requirements.txt (deploy crashava no Render)
```

`6cadf62` tinha sido listada com a mensagem "feat: Curador Automático pipeline 5 estágios + Cloudinary storage" — essa mensagem pertence na realidade ao conjunto `53091fd` + `c467029`; o commit `6cadf62` é o refactor que reescreveu as queries de `sources.py` (Secção 2.2).

`dcbd315` não fazia parte do trabalho original desta sessão, mas é essencial: sem ela, **nenhum dos 9 commits acima chegou a correr em produção** — o deploy falhava com `ModuleNotFoundError: No module named 'bs4'` desde o commit `48a672b` (que introduziu `from bs4 import BeautifulSoup` em `sources.py` sem adicionar `beautifulsoup4` ao `requirements.txt`). O Render manteve a versão anterior no ar a cada falha, por isso o serviço nunca pareceu "em baixo" — mas também nenhuma das correcções estava de facto live até este commit, publicado às 19:1x.

---

## 9. Problemas Conhecidos / Pendentes

| # | Problema | Impacto | Próximo passo |
|---|---|---|---|
| **0** | **[NOVO — achado crítico desta verificação]** `curator.py: _insert_event()` grava `location` como string + `lat`/`lon`/`city` soltos na raiz, sem `date` nem `expires_at` — schema diferente do resto da app (ver Secção 2.3) | **Eventos curados nunca aparecem em `GET /api/events` nem `/events/nearby`** (filtro `expires_at` exclui-os sempre). Se esse filtro for corrigido sem corrigir o `location`, `/events/nearby` passa a rebentar (500) para todos os utilizadores. O mapa de eventos continua vazio mesmo com o Curador a correr sem erros. | Reescrever `_insert_event()` para usar o mesmo schema do `seed_events.py`: `location: {address, city, country_code, lat, lon}` (objecto aninhado) + campos `date` e `expires_at` ao nível raiz. Recomendo corrigir antes de confirmar o cron job (item 1) — sem isto, o cron só vai gerar mais eventos invisíveis. |
| 1 | Cron job schedule pode estar `*/5 * * * *`; **não confirmável no código** — não está em `render.yaml`, só pode ter sido criado manualmente no dashboard | Executa a cada 5 min em vez de 2×/dia (gasta quota Groq/Render sem necessidade) | Rodrigo: verificar no dashboard Render se o serviço de cron existe e qual o schedule real; mudar para `0 8,20 * * *` se necessário |
| 2 | Curador yield 0 (aguardava deploy `48a672b`) | **[ACTUALIZADO]** O deploy de `48a672b` só ficou live depois do fix `dcbd315` (Secção 8) — antes disso o Render estava a servir uma versão anterior do código. Mesmo agora que está live, o item 0 acima continua a impedir que os eventos inseridos sejam visíveis. | Confirmar deploy actual primeiro (✅ feito, ver Secção 8), depois corrigir item 0 |
| 3 | Migração de imagens base64 existentes para Cloudinary | Posts antigos ainda em base64 | Script `migrate_images.py` pendente — **[CORRIGIDO] não encontrei este ficheiro em `backend/scripts/` — ainda não foi criado, apesar de planeado na sessão de estratégia** |
| 4 | `event_type: "curated"` não está no `Literal` do `EventCreate` | API rejeita `event_type=curated` no POST | **[VERIFICADO]** confirmado em `server.py`: `Literal["private", "public", "pessoal", "singular", "plural"]`. Adicionar ao schema Pydantic quando necessário (eventos curados são inseridos directamente na BD, não via API) |
| 5 | Seed events não são `source: "curator_ai"` | Tracking menos preciso | Irrelevante — são seed data. Curador real usa `source: "curator_ai"` |
| 6 | **[NOVO]** Constantes mortas em `curator.py`: `MAX_DAYS_FUTURE`, `MAX_FUTURE_DAYS_REVIEW` | Nenhum (não são chamadas), mas confundem leitura do código | Remover numa limpeza futura, ou documentar porque ficaram |

---

## 10. Próximos Passos (Fase 3)

1. **Perception Forecast** — `GET /api/perception-forecast?event_id=...` — prevê palavra ideal para evento
2. ~~Frontend `evento/[id].tsx` — botões publicar imagem e entrar como expositor~~ **[CORRIGIDO — já feito, noutra frente de trabalho do mesmo dia]** botão "PUBLICAR IMAGEM" e botão "APAGAR EVENTO" confirmados no código; "QUERO ANUNCIAR AQUI" (entrar como expositor) já existia antes de hoje
3. **Landing page** — `/landing`
4. **Printable Effect** — Fase 3 original
5. **Espelho de Empatia completo** — `user_memory` + `ai_provider.py`
6. **Fontes curador adicionais** — Eventbrite API, Sympla (Brasil)
