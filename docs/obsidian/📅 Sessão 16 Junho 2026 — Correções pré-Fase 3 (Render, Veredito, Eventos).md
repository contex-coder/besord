# 📅 Sessão 16 Junho 2026 — Correções pré-Fase 3 (Render, Veredito, Eventos)

> **Contexto de entrada:** Fase 3 tinha 3.A–3.D entregues (sessão de 15 Jun). Antes de avançar para `user_memory`/Espelho de Empatia completo (3.E/3.F), Rodrigo testou a app como utilizador real e reportou 6 problemas concretos que comprometiam a percepção de profissionalismo e a monetização de eventos. Esta sessão corrigiu todos antes de retomar a Fase 3.

---

## 🔴 Problemas Reportados e Corrigidos

### 1. Render — "ecrã de reinício" (cold start)

**Causa:** `besord-backend` está no tier free do Render — spin-down após inatividade, mostra ecrã "SERVIÇO SENDO ATIVADO..." por 30-50s.

**Decisão (Rodrigo, 16 Jun):** manter tier free até ao lançamento oficial; mitigar com ping automático gratuito. No lançamento a sério, upgrade para o plano Starter (~7 USD/mês).

**Fix:**
- Novo `.github/workflows/keep-alive.yml` — `cron */10 * * * *` chama `GET /api/health` para manter o serviço sempre activo.
- Ponto de atenção documentado em `📋 Checklist Deploy.md` (secção nova) para o upgrade pago no lançamento.

---

### 2. Veredito sem palavra/imagem quando não há post no dia

**Causa:** `GET /api/users/me/veredito` só mostrava a palavra/imagem se o utilizador tivesse publicado um post nesse dia. Sem post → card vazio.

**Fix (`backend/server.py`):**
- Nova função `_groq_session_keyword()` — quando não há post próprio mas há votos no dia, pede à IA (Groq) UMA palavra positiva que resuma o padrão da sessão.
- Lógica de selecção de imagem fallback: post aprovado do tema dominante → aprovado mais recente → mais recente entre todos os votados.
- Novo campo `word_source: "own_post" | "ai_inferred" | "none"` na resposta.
- `VeredictCard.tsx`: label muda para "A IA VIU ISTO EM TI HOJE" quando a palavra vem da IA; card agora mostra a imagem (`<Image>` adicionado, antes não existia nenhuma).

---

### 3. Espelho de Sessão — tom frio ("Essa pessoa...") + frase cortada

**Causa:** prompt usava 3ª pessoa ("alguém"), produzindo efeito distante. `max_tokens=60` cortava a frase a meio.

**Fix (`backend/server.py`, `_groq_session_insight`):**
- Prompt reescrito: trata directamente por "Você", proíbe explicitamente 3ª pessoa, mantém tom estoico/directo (regra de negócio imutável).
- `max_tokens` 60 → 120, mais um guard-rail em Python que corta no último ponto final caso a IA ignore a instrução.
- `VeredictCard.tsx`: `scrollArea.maxHeight` 380 → 460 para dar espaço ao texto mais longo.

---

### 4. Evento criado — acesso/gestão difícil, sem botão de apagar

**Fix:**
- Novo endpoint `DELETE /api/events/{event_id}` (`backend/server.py`) — soft-delete (`status: "cancelled"`), valida ownership ou admin. Preserva histórico de quem já participou (posts/check-ins não são apagados).
- Novo botão "APAGAR EVENTO" em `evento/[id].tsx`, visível só para o criador, com confirmação destrutiva (padrão `Alert.alert` já usado em `workspaces.tsx`).
- Edição de evento ficou fora de scope — não foi pedida.

---

### 5. Sem caminho para publicar imagem no evento (monetização)

**Causa:** o backend (`POST /api/events/{id}/publish-image`) já estava completo desde 15 Jun, mas não havia nenhum botão/ecrã que levasse a essa acção.

**Fix:**
- Novo ecrã `frontend/src/app/evento/[id]/publicar.tsx` — imagem + palavra + toggle de item de sorteio; para eventos `singular`/`plural` mostra as duas opções (avulso €9,99 / pacote 10 €49,99), para `pessoal` é só "PUBLICAR (GRÁTIS)".
- Novo botão "PUBLICAR IMAGEM" em `evento/[id].tsx`, visível ao criador.
- Corrigido também um bug pré-existente no `success_url` do Stripe (`?publicacao=sucesso` não correspondia ao parâmetro `anuncio` que o ecrã do evento já esperava) — sem isto, o banner de sucesso pós-pagamento nunca apareceria.

---

### 6. Evento criado não aparecia na pesquisa por cidade (Lisboa)

**Causa:** `EventMapPicker.tsx` só lia `address.city`/`address.town` do Nominatim. Para endereços específicos (ex: "Vale do Silêncio, Olivais"), esses campos vêm vazios e a cidade era gravada como `""` — a busca por "Lisboa" nunca dava match.

**Fix:** fallback ampliado para `village`/`municipality`/`county`/`suburb` em `EventMapPicker.tsx`.

---

### 7. Evento duplicado no painel ADMIN ("ATIVOS (2)")

**Causa:** duplo-clique no botão "CRIAR" — a prevenção via `useState` é assíncrona e não bloqueia cliques quase simultâneos.

**Fix:** `submittingRef` (síncrono, `useRef`) em `business/evento/novo.tsx`, bloqueia chamadas concorrentes antes de qualquer re-render.

**Limpeza do duplicado em produção:** usar o novo botão "APAGAR EVENTO" (ponto 4) directamente no evento a remover.

---

## 🗂️ Ficheiros Alterados

| Ficheiro | Mudança |
|---|---|
| `.github/workflows/keep-alive.yml` | **Novo** — ping automático ao Render |
| `docs/obsidian/📋 Checklist Deploy.md` | Secção "Tier Render — Ponto de Atenção Futuro" |
| `backend/server.py` | `DELETE /api/events/{id}`, `get_veredito` com fallback IA, `_groq_session_keyword`, `_groq_session_insight` (tom + tokens), fix `success_url` |
| `frontend/src/components/VeredictCard.tsx` | Imagem no card, label dinâmica, `maxHeight` maior |
| `frontend/src/components/EventMapPicker.tsx` | Fallback de cidade ampliado |
| `frontend/src/app/evento/[id].tsx` | Botões "APAGAR EVENTO" e "PUBLICAR IMAGEM", `isExpired` inclui `cancelled` |
| `frontend/src/app/evento/[id]/publicar.tsx` | **Novo** — ecrã de publicação de imagem no evento |
| `frontend/src/app/business/evento/novo.tsx` | `submittingRef` anti-duplo-submit |

---

## ✅ Verificação Feita

- `for f in backend/*.py; do python3 -m py_compile "$f"; done` — sem erros
- `cd frontend && npx tsc --noEmit` — sem erros

## ⏳ Verificação Pendente (precisa de ambiente live)

- Tom e corte de frase do Espelho de Sessão (Groq real)
- Checkout Stripe ao publicar imagem (avulso/pacote)
- Pesquisa por "Lisboa" a encontrar evento com endereço específico
- Apagar o evento duplicado já existente em produção

---

## 🔜 Próxima Sessão

Retomar a Fase 3 onde tinha ficado: **3.E `user_memory` collection → 3.F Espelho de Empatia completo → 3.G Printable Effect**.

---

> **Data:** 16 Junho 2026
> **Estado:** 7 problemas corrigidos, build limpo (backend + frontend)
> **Próxima sessão:** Fase 3 — `user_memory` + Espelho de Empatia completo
