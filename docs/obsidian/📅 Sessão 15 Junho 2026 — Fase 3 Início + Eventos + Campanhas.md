# 📅 Sessão 15 Junho 2026 — Fase 3: Eventos, Campanhas e Correcções

> **Contexto de entrada:** Fase 2 estava completa (commits anteriores). Esta sessão iniciou a Fase 3 com o modelo de eventos correcto, o diagnóstico Groq no Primeiro Olhar, as palavras no dashboard de campanhas, e correcções de bugs críticos reportados pelo fundador.

---

## 📋 Correcções às Regras de Negócio (início da sessão)

Rodrigo corrigiu pontos do briefing anterior. As correcções foram incorporadas na documentação e na implementação:

| Ponto | Correcção |
|---|---|
| Tipo 1 — Patrocínios / Sorteio | São **opcionais**, não obrigatórios |
| Tipo 1 — Feed de portfolio | Até **30 imagens**, mecânica idêntica ao feed global (Best Word + Aprovo/Desaprovo) |
| Tipo 1 — Duração | 1 a 7 dias, à escolha do criador |
| Tipo 2 — Criação | **Gratuita** — revenue vem de €9,99/imagem ou €49,99 pack de 10 |
| Tipo 2 — Sorteio | Cada publicação de imagem dá direito a item de sorteio (opcional) |
| Tipo 3 — Preços | Iguais ao Tipo 2 por expositor |
| Campanhas | Votos incluem comentário de palavra (igual aos posts normais) |
| Dashboard campanhas | Mostra **palavras mais comentadas** — diferenciador central vs. Google/Meta |
| Primeiro Olhar | €79,90 (1.º cliente) · €149 (avulso) · €299 (2.º–3.º com case study) |

---

## 📄 Documentação Actualizada

| Ficheiro | O que mudou |
|---|---|
| `⚙️ Regras de Negócio.md` | Mensagem Time-Gate corrigida; secção Eventos reescrita com 3 tipos; preços Primeiro Olhar; Campanhas com palavras comentadas como diferenciador |
| `📐 Arquitetura.md` | Tabela de collections MongoDB (todos os campos); tabela de event_types; endpoints completos de Eventos, Campanhas, Utilizador/Feed |
| `🚀 Plano Final de Implementação.md` | Preços 2.4 actualizados; nova Fase 3 (3.A–3.G) documentada; checkboxes marcadas no fim da sessão |
| `🧪 Testes & QA.md` | Novos testes Fase 3: evento pessoal, evento empresa gratuito, publish-image, expositor, diagnóstico Groq, top_words campanhas |

---

## 🔧 Backend — `server.py`

### Modelo de Eventos Reescrito

Novo campo `event_type` aceita: `"pessoal"` · `"singular"` · `"plural"` · `"primeiro_olhar"` · `"private"` · `"public"` (legado).

Novos campos no modelo `EventCreate`:
```python
event_type: Literal["pessoal", "singular", "plural", "private", "public"] = "singular"
duration_days: int = 7
has_raffle: bool = False
sponsorships_enabled: bool = False
```

**`POST /api/events` — lógica condicional:**

| Tipo | Gate | Criação | Stripe |
|---|---|---|---|
| `pessoal` | `bw_balance >= 1000` | Gratuita, `status: "active"` | Não |
| `singular` / `plural` | workspace activo | Gratuita, `status: "active"` | Não |
| `private` / `public` (legado) | workspace activo | Paga à criação | Sim (legado) |

---

### Novo Endpoint `POST /api/events/{id}/publish-image`

```python
class PublishImageRequest(BaseModel):
    image_base64: str
    has_raffle_item: bool = False
    package: bool = False  # True → pack 10 por €49,99; False → avulso €9,99
```

**Lógica de slots pré-pagos:**
- Se `image_slots_paid > image_slots_used` → publica directamente sem Stripe
- Caso contrário → Stripe checkout (€9,99 avulso ou €49,99 pack)
- Pessoal: gratuito, verifica limite de 30 imagens

**Stripe webhook — novo handler `event_image_slot`:**
```python
elif event_type == "event_image_slot":
    quantity = int(metadata.get("quantity", "1"))
    await db.events.update_one({"event_id": event_id}, {"$inc": {"image_slots_paid": quantity}})
```

---

### Diagnóstico Groq no Primeiro Olhar

**Nova função `_groq_primeiro_olhar_diagnosis()`:**
```python
async def _groq_primeiro_olhar_diagnosis(brand_word, community_word, top_words, misalignment_pct):
    # Prompt: 2 frases directas, tom consultor branding
    # Começa com: "A marca pretendia..."
    # Model: llama-3.1-8b-instant · timeout 8s · max_tokens 80 · temp 0.6
    # Returns "" on failure — fallback silencioso
```

**Correcção crítica na agregação de top_words:**
- **Antes (errado):** agrupava por `$post.word` (a palavra da marca → sempre a mesma)
- **Depois (correcto):** agrega directamente `votes.best_word` (palavra escolhida pela comunidade)

```python
all_vote_words_cursor = db.votes.aggregate([
    {"$match": {"post_id": {"$in": post_ids}, "best_word": {"$ne": None, "$nin": ["", "N/A"]}}},
    {"$group": {"_id": "$best_word", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}},
    {"$limit": 10},
])
```

Adicionado `misalignment_pct` = % de votantes cuja Best Word difere da palavra-alvo da marca.

---

### Dashboard de Campanhas — Top Palavras

`GET /api/campaigns/{campaign_id}` agora retorna dois novos campos:

```python
result["top_words_approved"] = [{"word": d["_id"], "count": d["count"]} async for d in approved_words_cur]
result["top_words_rejected"] = [{"word": d["_id"], "count": d["count"]} async for d in rejected_words_cur]
```

Cada um com as top 5 palavras comentadas por quem aprovou / desaprovou.

---

## 📱 Frontend

### `(tabs)/perfil.tsx` — Botão Evento Pessoal

Nova secção "ESPAÇO PESSOAL" com dois botões contextuais:

| Botão | Activo quando | Acção |
|---|---|---|
| PROMOVER POST (BW) | `bw_balance >= 100` | `/personal-ad` |
| CRIAR EVENTO PESSOAL | `bw_balance >= 1000` | `/pessoal/evento/novo` |

Quando bloqueado: mostra `opacity: 0.55` + `borderStyle: "dashed"` + "Precisas de X BW para criar um evento (vota mais!)"

---

### `pessoal/evento/novo.tsx` — Wizard Novo (4 Passos)

Novo ficheiro criado. Wizard completo para evento pessoal:

| Passo | Campos |
|---|---|
| `basic` | Cover image · Título · Descrição · Data · Hora |
| `location` | EventMapPicker + raio 0.5/1.0/1.5/2.0 km |
| `options` | Duração 1/2/3/5/7 dias · Toggle Sorteio · Toggle Patrocínios |
| `review` | Resumo completo · Custo: GRÁTIS · Botão submeter |

- Valida `bw_balance >= 1000` antes de submeter
- Envia `event_type: "pessoal"` para `POST /api/events`
- Barra de BW no topo com saldo actual
- Sucesso → navega para `/evento/{event_id}`

---

### `business/evento/novo.tsx` — Reescrita Completa

Tipo mudou de `"private" | "public"` para `"singular" | "plural"`.

**Principais mudanças:**
- Banner amarelo: "CRIAÇÃO GRATUITA — paga apenas ao publicar imagens"
- Seletor de tipo: SINGULAR (A tua empresa) vs. PLURAL (Feira / Várias empresas)
- Imagem e data passaram a opcionais
- Review step mostra tabela de preços:
  ```
  Criar evento        → GRÁTIS
  1 imagem avulso     → €9,99
  Pack 10 imagens     → €49,99 (poupa 50%) ★ recomendado
  ```
- Botão "CRIAR EVENTO (GRÁTIS)" — sem Stripe à criação
- Sucesso → navega para `/evento/{event_id}` para publicar imagens

---

### `business/campaign/[id].tsx` — Secção "PALAVRAS MAIS COMENTADAS"

**Correcção crítica de paths:**
Todo o ecrã de campanhas chamava `/api/business/campaigns/...` — rota inexistente no backend. Corrigido para `/api/campaigns/...` nos três ficheiros:

| Ficheiro | Caminho antigo | Caminho correcto |
|---|---|---|
| `campaign/[id].tsx` | `/api/business/campaigns/${id}` | `/api/campaigns/${id}` |
| `campaigns.tsx` | `/api/business/campaigns` | `/api/campaigns` |
| `campaign/new.tsx` | `/api/business/campaigns` | `/api/campaigns` |

**Nova secção no dashboard:**

```tsx
// Aparece logo após o bloco de VOTOS COLETADOS
// Visível assim que existam votos com palavras comentadas
<Text>PALAVRAS MAIS COMENTADAS</Text>
// Verde — quem aprovou disse:
// [CONFIANÇA 12] [FUTURO 8] [QUALIDADE 6]
// Vermelho — quem desaprovou disse:
// [CARO 9] [DISTANTE 5] [GENÉRICO 3]
```

Tipo `Campaign` extendido com:
```typescript
top_words_approved: { word: string; count: number }[];
top_words_rejected: { word: string; count: number }[];
```

---

## 🐛 Bugs Corrigidos

### Bug 1 — Crash no perfil de utilizador (CRÍTICO)

**Ficheiro:** `user/[id].tsx`

**Causa:** `<Ionicons>` estava dentro de `<Text>` (inválido em React Native). Quando qualquer utilizador tem `location` preenchida no perfil, o ecrã crashava imediatamente e ficava branco.

```tsx
// ❌ Antes — crash
<Text style={styles.location}>
  <Ionicons name="location-outline" size={11} /> {profile.location}
</Text>

// ✅ Depois — correcto
<View style={styles.locationRow}>
  <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
  <Text style={styles.location}>{profile.location}</Text>
</View>
```

---

### Bug 2 — Spinner eterno no perfil público

**Ficheiro:** `user/[id].tsx`

**Causa:** Early return sem chamar `setLoading(false)` quando `id` era undefined — a spinner ficava permanente.

```typescript
// ❌ Antes
if (!id) return;

// ✅ Depois
if (!id) { setLoading(false); return; }
```

---

### Bug 3 — Crash se utilizador sem nome

**Ficheiros:** `user/[id].tsx`, `(tabs)/perfil.tsx`

```typescript
// ❌ Antes — TypeError: Cannot read 'charAt' of null
{profile.name.toUpperCase()}

// ✅ Depois
{(profile.name || "Utilizador").toUpperCase()}
{(user.name || "?").charAt(0).toUpperCase()}
```

---

### Bug 4 — Erro TypeScript em router.push (build warning)

**Ficheiro:** `(tabs)/perfil.tsx`

A rota `/pessoal/evento/novo` era nova e ainda não constava nos tipos gerados pelo Expo Router.

```typescript
// ❌ Antes — TS2345
onPress={() => canEvent && router.push("/pessoal/evento/novo")}

// ✅ Depois — cast seguro
onPress={() => { if (canEvent) router.push("/pessoal/evento/novo" as never); }}
```

**Resultado após fix:** `tsc --noEmit` — zero erros.

---

## 🎨 Branding — Exploração (Tarde)

Sessão de tarde dedicada a avaliação de identidade visual e correcção de 8 bugs reportados ao vivo.

### Decisão de Branding

| Tema | Decisão |
|---|---|
| **Logo** | B + Asa dourada aprovado — mantém-se |
| **Paleta** | Azul Petróleo (`#12343D`) + Dourado + Branco + Preto (4 cores máx.) |
| **Estilo geral** | "Premium Elevated" com elementos brutalistas nos cards de conteúdo |
| **Besourinho** | Eliminado de todos os ecrãs (era o `beetle.png`, já apagado) |
| **Tela Tendências** | Palavras devem ir ABAIXO das imagens — não sobrepostas. Implementação adiada. |
| **Design doc** | Actualizar de "Neo-Brutalist" para "Premium Elevated + cards brutalistas" em próxima sessão |

---

## 🐛 Bugs Corrigidos (Tarde — Commit `47640df`)

### Bug 1 — Age Gate aparecia sempre (CRÍTICO)

**Causa raiz:** Backend retorna `age_confirmed: bool` mas `AuthContext.tsx` declarava o tipo como `age_confirmed_at?: string | null` e `index.tsx` verificava `user.age_confirmed_at`. O campo nunca existia na resposta → gate sempre mostrado.

**Ficheiros:** `AuthContext.tsx` · `index.tsx`

```typescript
// ❌ Antes
age_confirmed_at?: string | null;
if (!user.age_confirmed_at) { router.replace("/age-gate"); }

// ✅ Depois
age_confirmed?: boolean;
if (!user.age_confirmed) { router.replace("/age-gate"); }
```

---

### Bug 2 — Chip CIDADE redundante no feed

**Causa:** Existiam dois chips de localização (PAÍS e CIDADE) mas o modal do PAÍS já tem campo de cidade.

**Fix:** Removido chip CIDADE. Chip PAÍS agora mostra a cidade quando filtrada (`📍 LISBOA`) e continua a abrir o mesmo modal completo (país + cidade).

**Ficheiro:** `(tabs)/feed.tsx`

---

### Bug 3 — `/business/campaign/new` tela em branco (CRÍTICO)

**Causa raiz dupla:**
1. **Endpoint inexistente:** frontend chamava `/api/business/tiers` (404). Backend só tinha `/api/admin/tiers` (protegido por admin).
2. **Sem `.catch()`:** erro no fetch de workspaces deixava `wsLoaded = false` para sempre → nada renderizava.
3. **Sem guard de array:** `setTiers({"detail":"Not Found"})` → `tiers.map()` → TypeError → crash.

**Fix:**
- Backend: criado endpoint público `GET /api/campaigns/tiers` (sem auth)
- Frontend: URL corrigido para `/api/campaigns/tiers` + `Array.isArray()` guard + `.catch(() => setWsLoaded(true))` + spinner de carregamento

**Ficheiros:** `backend/server.py` · `business/campaign/new.tsx`

---

### Bug 4 — Ícones desactualizados (beetle + logo antigo)

**Causa:** `beetle.png`, `besord_i.png`, `besord_v.mp4` e outras imagens antigas foram apagadas mas os ficheiros de código ainda as referenciavam → erro de require em runtime.

**Fix:** `onboarding.tsx` e `index.tsx` actualizados para `NewBesord.png`. `MascotVideo` simplificado para imagem estática (vídeo eliminado).

**Ficheiros:** `onboarding.tsx` · `index.tsx` · `assets/images/NewBesord.png` (adicionado ao git)

---

### Bug 5 — Criar post permitia múltiplas imagens

**Causa:** `MAX_IMAGES = 3`, estado `extraImages`, UI de carrossel extra — nunca deveria existir.

**Fix:** `criar.tsx` reescrito — 1 imagem apenas, sem estado `extraImages`, sem carrossel.

**Ficheiro:** `(tabs)/criar.tsx`

---

### Bug 6 — Apagar empresa não fazia nada (web)

**Causa:** Frontend usava `window.confirm()` na web → em muitos contextos de browser moderno é bloqueado silenciosamente (retorna `false` sem mostrar diálogo). Além disso, `doDelete()` não tinha tratamento de erro — se API retornasse erro, nada acontecia.

**Fix:** Substituído por `Alert.alert()` nativo do Expo (funciona em web + mobile) + error handling explícito com mensagem ao utilizador.

**Nota:** O endpoint `DELETE /api/workspaces/{id}` já existia no backend (`workspaces.py`) — era só o frontend.

**Ficheiro:** `workspaces.tsx`

---

### Bug 7 — Sem caminho para criar evento empresa no perfil

**Causa:** Secção ESPAÇO EMPRESA no perfil só tinha "ANUNCIAR / CAMPANHAS". O wizard `business/evento/novo.tsx` existia mas não havia botão de acesso.

**Fix:** Adicionado botão "CRIAR EVENTO EMPRESA" no topo da secção ESPAÇO EMPRESA, acima das campanhas. Rota: `/business/evento/novo`.

**Ficheiro:** `(tabs)/perfil.tsx`

---

### Typo "CAMPANHÁ" (live)

O código fonte em `campaigns.tsx` já tem `NENHUMA CAMPANHA` correcto. O live site (besord.vercel.app) estava a servir deployment antigo do Vercel. Resolve com `git push origin main`.

---

## 🗂️ Resumo de Commits

| Commit | Descrição |
|---|---|
| `1639f2e` | feat: Fase 3 — Eventos (Pessoal/Singular/Plural), Primeiro Olhar e Campanhas |
| `36df94f` | fix: perfil de utilizador + checkboxes Plano Fase 3 actualizadas |
| `47640df` | fix: 7 bugs — age gate, CIDADE chip, campaign/new blank, ícones, multi-imagem, apagar empresa, evento empresa |

---

## 📊 Estado do Plano após esta sessão

| Item | Estado |
|---|---|
| 3.A Evento Pessoal (backend + wizard) | ✅ Implementado |
| 3.B Eventos Empresa (criação gratuita + publish-image) | ✅ Backend + Frontend wizard · Botões evento/[id].tsx pendentes |
| 3.C Diagnóstico Groq Primeiro Olhar | ✅ Implementado (+ correcção crítica top_words) |
| 3.D Palavras Dashboard Campanhas | ✅ Implementado |
| 3.E user_memory Collection | ⏳ Próxima sessão |
| 3.F Espelho de Empatia Completo | ⏳ Próxima sessão |
| 3.G Printable Effect | ⏳ Próxima sessão |

---

## 🔜 Pendente para a Próxima Sessão

### Rodrigo — Acções de Produto

| Tarefa | Como fazer | Prioridade |
|---|---|---|
| **`git push origin main`** | Terminal no repo `besord/` | 🔴 URGENTE — deploy Vercel (typo + 7 bugs) |
| **OTA update** (mobile) | Ver comando abaixo | 🔴 Imediato após push |
| **Build iOS TestFlight** | `eas build --platform ios --profile preview` | 🟡 Antes dos convites |
| **Primeira venda B2B** | Contactar 1 marca → Primeiro Olhar €79,90 | 🟡 Em paralelo |

### Código — Próximas Features

| Feature | Prioridade | Estimativa |
|---|---|---|
| `evento/[id].tsx` — botões PUBLICAR IMAGEM e ENTRAR COMO EXPOSITOR | 🔴 Alta | 3–4h |
| `user_memory` collection + actualização pós-sessão | 🟠 Alta (Fase 3 core) | 4–6h |
| Espelho de Empatia completo (`POST /api/insights/daily`) | 🟠 Alta (Fase 3 core) | 4–6h |
| Printable Effect (Pillow, card PNG) | 🟡 Médio | 3–4h |
| Primeiro Olhar — página web formatada (URL partilhável) | 🟡 Médio | 4–6h |
| Push notifications (Sincronia) | 🟢 Baixo (requer expo-notifications) | 6–8h |

---

## 🔑 Comandos para a Próxima Sessão

**Deploy Vercel (FAZER HOJE):**
```bash
git push origin main
```
Corrige o typo "CAMPANHÁ" e publica os 7 bugs corrigidos no site live.

**OTA Update (para o APK mobile, após push):**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd" eas update --branch main --message "fix: 7 bugs — age gate, ícones, campaign/new, multi-imagem, apagar empresa, evento"
```

**Testar perfil de utilizador (verificar fix crash):**
```bash
# Abrir o app → feed → clicar no nome do autor de qualquer post
# Ecrã deve abrir sem crash, mesmo com location preenchida
```

**Testar campanha dashboard (verificar top palavras):**
```bash
curl https://besord-backend.onrender.com/api/campaigns/CAMP_ID \
  -H "Authorization: Bearer TOKEN"
# Verificar: response.top_words_approved e top_words_rejected presentes
```

**Testar criar evento pessoal:**
```bash
curl -X POST https://besord-backend.onrender.com/api/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"pessoal","title":"O Meu Evento","duration_days":3}'
# Requer user com bw_balance >= 1000
```

**Testar criar evento empresa (deve ser gratuito):**
```bash
curl -X POST https://besord-backend.onrender.com/api/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"singular","title":"Lançamento Produto","duration_days":7}'
# Deve retornar status "active" sem checkout_url
```

---

> **Data:** 15 Junho 2026
> **Commits:** `1639f2e` · `36df94f` · `47640df`
> **Estado da Fase 3:** 3.A ✅ · 3.B ✅ (parcial) · 3.C ✅ · 3.D ✅ · 3.E–3.G ⏳
> **Pendente (Rodrigo):** `git push origin main` + OTA update
> **Próxima sessão:** evento/[id].tsx (botões publicar imagem + expositor) → user_memory → Espelho de Empatia
