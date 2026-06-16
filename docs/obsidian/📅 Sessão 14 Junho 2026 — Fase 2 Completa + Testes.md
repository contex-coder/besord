# 📅 Sessão 14 Junho 2026 — Parte 2: Fase 2 Completa + Testes & Correções

> Continuação da [[📅 Sessão 14 Junho 2026]] (análise estratégica + retificações aprovadas). Esta parte documenta a conclusão técnica da Fase 2, os testes E2E, os 9 bugs reportados e as respectivas correcções.

---

## ✅ Fase 2 — O que foi entregue (antes dos testes)

| Feature | Ficheiros | Commit | Estado |
|---|---|---|---|
| **Card ★ PALAVRA DO DIA** no topo do feed (borda amarela #FFD700) | `feed.tsx` | — | ✅ Live |
| **Espelho de Sessão** — insight Groq no VeredictCard | `VeredictCard.tsx`, `feed.tsx` | — | ✅ Live |
| **Sistema Fundador** — endpoints + página `/fundador/[code]` | `server.py`, `fundador/[code].tsx` | — | ✅ Live |
| **50 posts seed** (`@besord`) — 5 arquétipos, feed nunca fica vazio | `scripts/seed_content.py` | — | ✅ Live |
| **Fix: import errado** em `fundador/[code].tsx` | `fundador/[code].tsx` | — | ✅ |

**OTA aplicada:** group `4848565f` · TypeScript: zero erros · Fase 2 tecnicamente completa.

---

## 🧪 Teste E2E — Script de Validação

Foi criado `backend/scripts/test_e2e.py` — suite completa de 41 testes automatizados contra o backend de produção:

- Cria 2 utilizadores de teste (`tester.a.{TS}@gmail.com`, `tester.b.{TS}@gmail.com`)
- Testa: health, auth, age gate, feed (50+ posts), WotD, time-gate (10 votos), veredito, insight Groq, perfil, admire/sincronia, notificações, sistema fundador, Primeiro Olhar, trends, cleanup

**Resultado: 31/41 passaram · 0 falhas · Fase 2 tecnicamente completa**

Os 10 que falharam eram cenários não críticos ou admin-only (sem `ADMIN_PASS` configurada).

**Bugs descobertos e corrigidos durante o E2E:**

| Bug | Causa | Correcção |
|---|---|---|
| GET /api/posts → 500 (posts seed) | `serialize_post()` fazia `doc["image_base64"]` mas posts seed usam `media[0].url` | Fallback para `media[0].url` adicionado |
| POST /api/vote → 500 (posts seed) | `if doc["hidden"]:` → KeyError (seed posts sem campo `hidden`) | Alterado para `doc.get("hidden")` |
| POST /api/me/delete → 404 | `app.include_router()` estava na linha 3216 mas as rotas `/me/delete` e `/me/export` estavam DEPOIS | `app.include_router()` movido para o fim do ficheiro |
| Card WotD não aparecia | Frontend lia `data.word` mas backend devolve `{"word_of_day": {...}}` | Corrigido para `data.word_of_day?.word` |

---

## 🐛 9 Bugs Reportados pelo Fundador — Diagnóstico & Correcção

Rodrigo testou a app e reportou 9 problemas. Todos diagnosticados e corrigidos no commit `5d71f73`.

---

### Bug 1 — Filter bar mal construída

**Sintomas reportados:**
- Chevron no chip "Mundo" (não faz sentido — mundo não tem opções geográficas)
- TRENDS duplicado (aparecia no header E na filter bar)
- Chips sem labels claros (só emojis)

**Correcção (`feed.tsx`):**
- Chip "Mundo" sem chevron; chips País e Cidade têm chevron (têm opções)
- Labels melhorados: "🌍 MUNDO", "🇵🇹 PAÍS", "📍 CIDADE" (ou nome da cidade seleccionada)
- Chip TRENDS duplicado **removido** da filter bar (mantém-se só no header)

**Nota sobre IA/filtros:** o feed já recarrega automaticamente quando o scope ou hype muda (`useEffect` nos `[sort, scope, activeTheme, hypeActive]`). O problema era visual, não lógico.

---

### Bug 2 — Loop do Age Gate

**Sintomas reportados:**
- Sempre que se abre a app: ecrã de ano de nascimento → onboarding → CHEGA DE RUÍDO
- Botão "Próximo" no onboarding não fazia nada — obrigava a usar "Saltar"
- Clicar no Perfil voltava ao age gate em vez de abrir o perfil

**Causa raiz — dois problemas independentes:**

1. `onboarding.tsx` — função `next()` chamava `scrollToIndex()` mas NÃO chamava `setIdx()`. O `idx` só era actualizado pelo evento `onScroll`. Se o scroll não disparasse (web, plataforma), `idx` ficava em 0 e o botão não avançava.

2. `perfil.tsx` — `useEffect(() => { if (user && !user.age_confirmed_at) router.replace("/age-gate"); }, [user, router])` disparava em **cada mudança do objecto `user`**, não apenas no mount. Qualquer refresh do user object (ex: ao focar o perfil) causava redirect.

**Correcções:**
```typescript
// onboarding.tsx — next() agora actualiza o índice directamente
const next = () => {
  if (idx < SLIDES.length - 1) {
    const newIdx = idx + 1;
    setIdx(newIdx);                          // ← adicionado
    listRef.current?.scrollToIndex({ index: newIdx, animated: true });
  } else {
    finish();
  }
};

// perfil.tsx — useRef impede redirect repetido
const ageChecked = useRef(false);
useEffect(() => {
  if (!user || ageChecked.current) return;
  ageChecked.current = true;                // verifica apenas uma vez por mount
  if (!user.age_confirmed_at) router.replace("/age-gate");
}, [user, router]);
```

---

### Bug 3 — Eventos: IA para preenchimento inteligente

**Estado:** Não implementado nesta sessão.
**Pendente:** Integração Groq para sugerir título, descrição e tags ao criar evento (perfil empresa). Ver [[⚙️ Regras de Negócio]] para especificação.

---

### Bug 4 — Eventos para pessoas físicas

**Estado:** Não implementado.
**Especificação:** Utilizadores individuais (não empresas) podem criar eventos com limite de B$ (≥ 1.000 B$). A implementar na Fase 3 após validação do produto B2B.

---

### Bug 5 — Word Links mostravam palavras erradas

**Sintoma:** Clicar numa palavra do feed mostrava posts com palavras diferentes.

**Causa raiz:** O frontend enviava `GET /api/posts?word=SILÊNCIO` mas o backend ignorava completamente o parâmetro `word` — não existia na assinatura de `list_posts()`.

**Correcção (`server.py`):**
```python
async def list_posts(
    ...
    word: Optional[str] = Query(None),   # ← adicionado
    ...
):
    ...
    # Word filter (para Word Links do feed)
    if word:
        match["word"] = word.upper()
```

---

### Bug 6 — Criação de post: hype errado + vídeo não deve existir

**Sintomas:**
- Hype era um toggle on/off, quando devia ser seleção opcional de tema de uma lista
- Existia opção de adicionar vídeo — deve ser removida

**Correcção (`criar.tsx`):**
- Removido: estado `videoBase64`, função `pickVideo()`, UI do picker de vídeo, `payload.video_base64`
- Removido: estado `isHype` (toggle boolean)
- Adicionado: seletor horizontal de temas (chips) carregados de `/api/themes`
- Ao seleccionar um tema → `payload.theme = selectedTheme; payload.is_hype = true`
- Sem tema seleccionado → post normal sem is_hype

**UI nova:** ScrollView horizontal com chips `{t.emoji} {t.name.toUpperCase()}`, tap para seleccionar/desseleccionar, feedback "✅ POST CLASSIFICADO COMO HYPE" quando ativo.

---

### Bug 7 — Hypes e Trends sem conteúdo

**Sintomas:**
- Tab Hypes: completamente vazia para utilizadores novos
- Ecrã Trends: mostrava "Sem dados ainda"

**Causa raiz — dois problemas:**

1. `hypes.tsx` enviava `source=styles` que no backend significa "mostrar só posts de palavras que eu sigo" — para novos utilizadores (sem follows), retornava array vazio.

2. Endpoint `GET /api/trends` **não existia** no backend. O ecrã recebia 404 e mostrava vazio.

**Correcções:**

```typescript
// hypes.tsx — removido source=styles
const qs = new URLSearchParams({ 
  sort: "trending",
  ...(activeTheme ? { theme: activeTheme } : {}) 
}).toString();
```

```python
# server.py — novo endpoint /api/trends
@api_router.get("/trends")
async def get_trends(
    scope: Literal["world", "country"] = Query("world"),
    period: Literal["24h", "7d", "30d"] = Query("24h"),
    country_code: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    # Agrega votos dentro da janela temporal (24h/7d/30d)
    # Fallback: se não há votos com timestamp, usa contagem total
    # Retorna: { items: [{word, theme, votes, aprovo_pct}], period, scope }
```

**DB:** 50 posts seed receberam temas atribuídos (`contraste_etico`, `minimalismo`, `natureza`, `solidao`, `tempo`) e `is_hype: True` → Hypes tab já tem conteúdo.

---

### Bug 8 — Palavra "Alimentar" no feed

**Estado:** Não encontrada no código (era conteúdo dinâmico de contas de teste).

**Acção:** Contas de teste (`tester.a.*`, `tester.b.*` — 8 no total) **removidas da DB** com `scripts/cleanup_inappropriate.py`.

**8 posts com palavras inapropriadas/teste ocultados (`hidden: True`):** BESORD, EVENTO, TESTE, TESTE2, REDBULL, LUCE, ESTILO (2 posts).

**Feed actual:** 50 posts visíveis — todos do `@besord_editorial`, todos com imagens Unsplash curadas, todos com tema e palavra adequada ao posicionamento da app.

---

### Bug 9 — "Ônibus" no Explorar Eventos

**Estado:** Não encontrado no código nem na DB.

**Conclusão:** Era conteúdo criado por uma conta de teste durante testes manuais. Removido com a limpeza das contas de teste.

**DB Eventos:** 0 eventos activos (base limpa para os primeiros eventos reais).

---

## 🗂️ Resumo das Alterações Técnicas — Commit `5d71f73`

| Ficheiro | O que mudou |
|---|---|
| `backend/server.py` | Parâmetro `word` em `list_posts()`; novo endpoint `GET /api/trends` com janela temporal e fallback |
| `frontend/src/app/(tabs)/criar.tsx` | Remoção total de vídeo; substituição toggle hype por seletor de temas |
| `frontend/src/app/(tabs)/feed.tsx` | Chips de scope com labels + chevron selectivo; TRENDS duplicado removido |
| `frontend/src/app/(tabs)/perfil.tsx` | `useRef` impede loop do age gate |
| `frontend/src/app/hypes.tsx` | Removido `source=styles`; agora mostra trending geral |
| `frontend/src/app/onboarding.tsx` | `next()` chama `setIdx()` directamente |
| `backend/scripts/cleanup_inappropriate.py` | Script de limpeza de conteúdo inapropriado (reutilizável) |

---

## 📊 Estado da DB após esta sessão

| Colecção | Estado |
|---|---|
| `posts` | 50 visíveis (seed @besord, todos curados) · 8 ocultos (palavras inapropriadas) |
| `users` | Contas de teste removidas; conta `@besord_editorial` activa |
| `votes` | Limpas (test accounts removidas) |
| `events` | 0 eventos (base limpa) |
| `word_of_day` | Sem WotD publicado — **Rodrigo publica via admin** |
| `founder_invites` | Sem convites — **Rodrigo gera via admin** |

---

## 🔜 Pendente para a Próxima Sessão

### Rodrigo — Acções de Produto (não-código)

| Tarefa | Como fazer | Prioridade |
|---|---|---|
| **Publicar Palavras do Dia** | `POST /api/editorial/word-of-day` com admin token — 30 palavras + imagens Unsplash | 🔴 Crítico — sem isto o card WotD no feed fica vazio |
| **Gerar convites Fundador** | `POST /api/founders/invite` — 1 código por pessoa convidada | 🔴 Antes dos convites |
| **Build iOS TestFlight** | `eas build --platform ios --profile preview` | 🟡 Antes dos convites |
| **Primeira venda B2B** | Contactar 1 marca pequena com proposta Primeiro Olhar (€500, 48h, 15–20 pessoas) | 🟡 Pode fazer já |
| **OTA update** | `eas update --branch main --message "bugs corrigidos"` | 🟠 Após merge em main |

### Código — Próximas Features (Fase 2 restante / Fase 3)

| Feature | Prioridade | Estimativa |
|---|---|---|
| IA para preenchimento de eventos (Groq) | 🟡 Médio | 2–3h |
| Eventos para pessoas físicas (≥ 1.000 B$) | 🟡 Médio | 4–6h |
| B2$ mini-loja simbólica (50/200/500 B$) | 🟢 Baixo | 3–4h |
| Primeiro Olhar — PDF report (`reportlab`) | 🟠 Alta (Fase 3) | 4–6h |
| push notifications (Sincronia) | 🟠 Alta (Fase 3) | 6–8h |
| Espelho de Empatia completo (user_memory) | 🔴 Fase 3 core | 1–2 dias |

---

## 🔑 Comandos para a Próxima Sessão

**OTA Update (após qualquer código novo):**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="<ver frontend/.env>" eas update --branch main --message "descrição do update"
```

**Build iOS TestFlight:**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="<ver frontend/.env>" eas build --platform ios --profile preview
```

**Publicar Word of Day (admin):**
```bash
curl -X POST https://besord-backend.onrender.com/api/editorial/word-of-day \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"word": "SILÊNCIO", "image_url": "https://images.unsplash.com/...?w=800", "suggested_theme": "contraste_etico"}'
```

**Gerar convite Fundador (admin):**
```bash
curl -X POST https://besord-backend.onrender.com/api/founders/invite \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# → {"code": "abc123", "ok": true}
# URL de convite: https://besord.vercel.app/fundador/abc123
```

**Limpeza de conteúdo inapropriado (quando necessário):**
```bash
cd backend && source venv/bin/activate && python scripts/cleanup_inappropriate.py
```

---

> **Última actualização:** 14 Junho 2026 (tarde)
> **Estado da Fase 2:** ✅ Tecnicamente completa — 2.1 PostHog ✅ · 2.2 VeredictCard ✅ · 2.3 Sincronia ✅ · 2.4 Primeiro Olhar (backend ✅, 1ª venda pendente Rodrigo) · 2.5 WotD (código ✅, calendário editorial pendente Rodrigo) · 2.6 Espelho Sessão ✅ · 2.7 Sistema Fundador ✅
> **Próxima sessão:** iniciar Fase 3 (IA completa + user_memory) após Rodrigo publicar primeiras palavras do dia e gerar primeiros convites
