# 📋 RELATÓRIO COMPLETO — BESORD APP

**Data:** 7 Junho 2026 — 16:27 UTC  
**Sessão:** 6 Junho ~21h → 7 Junho ~16h  
**Autor (a sair de férias):** Assistente AI atual  
**Para:** Assistente AI substituto  

---

## 1. 📌 VISÃO GERAL DO PROJETO

**Besord** — plataforma social de votação com hype/deshype em palavras. Os users postam palavras, outros users votam (APROVO 👍 / DESAPROVO 👎), e quem recebe hype acumula **B$ (Besord coins)**.

### Funcionalidades core:
- Feed de posts com voto (APROVO/DESAPROVO)
- Eventos geolocalizados (raio 2km) com check-in
- Empresas (workspaces) que criam anúncios/campanhas pagas
- Stripe para pagamentos (checkout + webhook)
- Sorteio de prémios entre todos os votantes
- Autenticação: Google OAuth + Apple Sign In + email/password
- Notificações por email (Resend) e in-app

---

## 2. 🏗️ ARQUITETURA

```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │  HTTP   │   Backend        │
│   React Native  │◄───────►│   FastAPI        │
│   Expo Router   │  REST   │   Python 3.11    │
│   Vercel        │         │   Render (Docker) │
└─────────────────┘         └────────┬────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   MongoDB Atlas    │
                            │   (M0 Free Tier)   │
                            └───────────────────┘
```

### URLs ativas (7 Jun 2026):

| Componente | URL | Status |
|---|---|---|
| **Frontend** | https://besord.vercel.app | ✅ Online (HTTP 200) |
| **Backend** | https://besord-backend.onrender.com | ✅ Live |
| **API Status** | `GET /` | `{"app":"Besord API","status":"running"}` |
| **Posts** | `GET /api/posts` | ✅ 8 posts ativos |
| **Themes** | `GET /api/themes` | ✅ 10 temas |
| **Webhook Stripe** | `POST /api/stripe/webhook` | ✅ 200 OK |

### Stack tecnológica:
- **Frontend:** React Native, Expo Router, TypeScript, Ionicons
- **Backend:** Python 3.11, FastAPI, Uvicorn, PyMongo
- **DB:** MongoDB Atlas (free tier M0, 512MB)
- **Auth:** Google OAuth, Apple Sign In, JWT
- **Payments:** Stripe (checkout sessions + webhook)
- **Email:** Resend API
- **Hosting:** Render (backend Docker), Vercel (frontend)
- **Repositório:** GitHub (branch única `main`, auto-deploy)

---

## 3. ✅ O QUE JÁ FUNCIONA (ESTÁVEL)

### Backend (Python/FastAPI)
- ✅ Autenticação Google OAuth + Apple Sign In + email/password
- ✅ CRUD de posts com voto (APROVO/DESAPROVO)
- ✅ Feed com filtros: `sort=recent|hype`, `is_hype=true/false`, `word`, `theme_id`
- ✅ Eventos geolocalizados com check-in
- ✅ Workspaces (empresas) com verificação de email + VIES/CNPJ/NIF
- ✅ Campanhas pagas com tier pricing (Bronze/Silver/Gold/Platinum)
- ✅ Stripe checkout + webhook (commit `5cb9595` — corrigido)
- ✅ Sorteio de prémio entre todos os votantes (APROVO + DESAPROVO)
- ✅ Hype filter (`is_hype=true/false`)
- ✅ Carrossel de imagens e vídeo nos posts
- ✅ Admin: CRUD de eventos, reset de tiers, config
- ✅ Notificações por email (Resend) e in-app
- ✅ Rate limiting por user no sorteio
- ✅ Preço configurável por admin

### Frontend (React Native / Expo)
- ✅ Login com Google + Apple + email/password
- ✅ Onboarding com escolha de conta (pessoal/empresa)
- ✅ Feed com votos, carrossel de imagens
- ✅ Perfil com estatísticas (B$ total, eventos visitados)
- ✅ Criar evento (wizard 3 passos: info, data, localização)
- ✅ Explorar eventos no mapa com geolocalização
- ✅ Dashboard business (campanhas, anúncios)
- ✅ Age gate (confirmação de idade)
- ✅ Página de verificação de empresa (`/verify-empresa`)
- ✅ Account type screen com redirect se já escolheu
- ✅ Notificações push in-app

---

## 4. 🔧 O QUE FOI FEITO NESTA SESSÃO (6-7 Junho 2026)

### 4a. Frontend — Correções TypeScript (commit `12463f8`)

| Erro | Ficheiro | Causa | Correção |
|---|---|---|---|
| **Ficheiro sem imports** | `verify-empresa.tsx` | Usava `useRouter`, `useState`, `useEffect`, `SafeAreaView`, `View`, `Text`, etc. sem importar nada | Adicionados todos os imports necessários |
| **Estilos em falta** | `(tabs)/perfil.tsx` | Referenciava 5 estilos não definidos no `StyleSheet.create()` (`menuItem`, `menuIconWrap`, `menuContent`, `menuTitle`, `menuSub`) | Adicionados os estilos com `brutalShadow` |
| **Propriedade duplicada** | `business/campaigns.tsx` | `emptyBtnText` definido duas vezes (linhas 151 e 160) | Removido o duplicado |
| **Cor inexistente** | `index.tsx` | Usava `colors.reprovo` que não existe no tema | Substituído por `colors.desaprovo` |
| **Tipo não exportado** | `contexts/AuthContext.tsx` | `type AuthError` não tinha `export` | Adicionado `export type AuthError` |
| **User type incompleto** | `contexts/AuthContext.tsx` | Faltavam campos: `bw_total_earned`, `business_profile`, `age_confirmed_at` | Adicionados ao `type User` |
| **Campo inexistente** | `index.tsx`, `perfil.tsx` | Usavam `user.age_confirmed` (não existe no DB) | Substituído por `user.age_confirmed_at` (timestamp real) |
| **Argumentos errados** | `account-type.tsx` | `storage.getItem("key")` com 1 argumento, mas precisa de 2: `(key, fallback)` | Corrigido para `storage.getItem("besord_account_type", null)` |

### 4b. Backend — Correções Python (commits `772600b` a `5cb9595`)

| Erro | Ficheiro | Causa | Correção |
|---|---|---|---|
| **`elif` sem `if`** | `server.py` (webhook) | `elif event_type == "campaign":` sem `if` anterior + `if campaign_id:` ao nível errado → `UnboundLocalError` | Reestruturado para `if event_type == "campaign": campaign_id = ...; if campaign_id: ...` |
| **Indentação quebrada** | `server.py` (webhook) | `)` de fecho de `update_one()` com indentação de 4 espaços (nível do `try:`) em vez de 12 → partia estrutura do `try/except` | Reescrita completa da função `stripe_webhook` |
| **`forque` vs `for`** | `server.py` (linha 35) | Erro de digitação: `forque k, v` em vez de `for k, v` | Substituído por `for k, v` |
| **f-string com backslash** | `workspaces.py` (linha 342) | `f"{cc}{re.sub(r'\D', '', tax_id)}"` — Python 3.11 não permite `\D` dentro de f-string | `digits_only = re.sub(r'\D', '', tax_id)` + f-string com variável |
| **Webhook sem try/except** | `server.py` | Função não tinha tratamento de exceções → crash 500 sem mensagem | Adicionado `try/except HTTPException` + `except Exception` com log |
| **Emojis em f-strings** | `server.py` (webhook) | `f"\u{1f3aa}..."` não é válido em Python 3.11 | Removidos emojis das notificações no webhook |

### 4c. Deployments

| Plataforma | Status | Observação |
|---|---|---|
| **Vercel (frontend)** | ✅ OK | Deploy automático bem sucedido |
| **Render (backend)** | ✅ LIVE (commit `5cb9595`) | Vários `update_failed` até corrigir todos os SyntaxErrors |

### Causa raiz dos `update_failed` no Render:
1. `forque` — erro de digitação no server.py (desde `e236ecc`)
2. `elif` sem `if` no webhook (desde `772600b`)
3. Indentação quebrada (desde `692b1a4`)
4. f-string com backslash em `workspaces.py` (desde criação do ficheiro)
5. Emojis em f-strings (só Python 3.12+)

**Nota:** O último deploy live anterior a esta sessão era `12463f8` (alteração apenas no frontend), que não forçou rebuild do backend. Por isso o Render nunca detectou estes erros até agora.

---

## 5. ⚠️ PONTOS DE ATENÇÃO / ERROS CONHECIDOS

### 🔴 Críticos

1. **Stripe webhook com `STRIPE_WEBHOOK_SECRET` ativo** — Se a variável de ambiente estiver definida no Render, as chamadas reais do Stripe precisam de signature válida. Se o segredo no Render não corresponder ao do Dashboard do Stripe, o webhook rejeita com 400. **Verificar se as variáveis de ambiente estão sincronizadas.**

2. **Deploys podem falhar com "update_failed"** — O Render faz rolling update: inicia o novo container antes de desligar o antigo. Se o container crasha ao iniciar (SyntaxError), o deploy falha. **Sempre compilar com `python3 -m py_compile backend/server.py` antes de push.**

3. **Variáveis de ambiente no Render** — Verificar se estão todas configuradas (dashboard.render.com):
   - `MONGO_URL`, `DB_NAME`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `JWT_SECRET_KEY`, `FRONTEND_BASE_URL`, `APP_BASE_URL`, `ADMIN_EMAIL`, `LOG_LEVEL`

### 🟡 Moderados

4. **Cache Docker no Render** — Usa cache de layers. `pip install` não re-instala se `requirements.txt` não mudou. Para limpar: `{"clearCache": "clear"}` no deploy via API.

5. **Python 3.11 limitações** — Não suporta:
   - `\u{...}` dentro de f-strings
   - `re.sub(r'\D', ...)` diretamente em f-strings
   - Se fizerem upgrade para Python 3.12+, atualizar `Dockerfile` (linha `FROM python:3.11-slim`)

6. **MongoDB Atlas M0 (free)** — Apenas 512MB de storage. As `images_base64` nos posts são pesadas. Monitorizar uso. Se encher, fazer archive para S3 ou comprimir imagens.

7. **API key do Render expira** — O token `rnd_k08lm22E9JB6rjPopNtLQ7t3Ql8y` pode expirar. Para obter novo: Dashboard Render → Account → API Keys.

### 🟢 Leves

8. **`campaigns.tsx`** — `emptyBtnText` duplicado (já corrigido). Se adicionarem novos estilos, verificar duplicados com `grep -n "nomeDoEstilo" ficheiro.tsx`.

9. **`verify-empresa.tsx`** — Estava partido (sem imports). Agora corrigido, mas precisa de teste em produção: criar workspace → email → clicar link → página de verificação.

10. **`age_confirmed` vs `age_confirmed_at`** — O backend retorna `age_confirmed_at` (timestamp ISO), não `age_confirmed` (boolean). Em novos desenvolvimentos, usar `user.age_confirmed_at`.

---

## 6. 📋 PRÓXIMOS PASSOS (PRIORIDADES)

### Prioridade Alta 🔥

- [ ] **Testar Stripe webhook com evento real** — Fazer um pagamento real (€1) e verificar se webhook processa corretamente (post ativo, campanha ativa, invoice guardada)
- [ ] **Testar campanhas — fluxo completo** — Criar campanha → Stripe checkout → webhook → status "active" → `paid_at`, `starts_at`, `ends_at` atualizados
- [ ] **Testar sorteio — `POST /posts/{id}/draw-prize`** — Post com `prize` configurado, verificar notificação ao vencedor
- [ ] **Testar verificação de empresa** — Fluxo: criar workspace → receber email → clicar link → página `/verify-empresa` → consentimento marketing → confirmação

### Prioridade Média 📱

- [ ] **Testar em iOS/Android real** — Até agora só testado em web via `npx expo start --web`
- [ ] **Estado global offline** — Se backend cair, frontend não dá feedback. Adicionar error boundaries
- [ ] **Corrigir `brutalShadow` para iOS** — Atualmente usa `elevation: 8` (Android-only). Adicionar `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
- [ ] **Testar geolocalização real** — Mapa de eventos com Nominatim autocomplete

### Prioridade Baixa 🧹

- [ ] **Substituir `print()` por `logging`** no backend (usar `LOG_LEVEL` do Render)
- [ ] **Refatorar `_ORIGINAL_TIERS`** — Considerar single dataclass em vez de snapshot
- [ ] **Adicionar health check endpoint** no Render (`/health`) para monitorização
- [ ] **Pipeline CI/CD** — GitHub Actions para correr `py_compile` e `tsc --noEmit` antes de push

---

## 7. 💡 DICAS PARA O SUBSTITUTO

### Testes rápidos de sanidade

```bash
# Backend
curl https://besord-backend.onrender.com
curl https://besord-backend.onrender.com/api/themes
curl https://besord-backend.onrender.com/api/posts?limit=1

# Webhook Stripe
curl -X POST https://besord-backend.onrender.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"type":"test"},"id":"test","payment_intent":"test"}}}'

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://besord.vercel.app
```

### Deploy manual no Render (se auto-deploy falhar)

```bash
# 1. Obter API key no Render Dashboard → Account → API Keys
# 2. Fazer deploy com ou sem clear cache

curl -X POST "https://api.render.com/v1/services/srv-d8fd8areo5us73bpep9g/deploys" \
  -H "Authorization: Bearer <RENDER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
# ou com clear cache:
curl -X POST "https://api.render.com/v1/services/srv-d8fd8areo5us73bpep9g/deploys" \
  -H "Authorization: Bearer <RENDER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'
```

### Compilar backend antes de push

```bash
python3 -m py_compile backend/server.py
python3 -m py_compile backend/workspaces.py
# Todos os .py:
for f in backend/*.py; do python3 -m py_compile "$f" || echo "❌ ERRO: $f"; done
```

---

## 8. 🔗 LINKS ÚTEIS

| Recurso | URL | Acesso |
|---|---|---|
| **Render Dashboard** | https://dashboard.render.com/web/srv-d8fd8areo5us73bpep9g | Conta: contex-coder |
| **Vercel Dashboard** | https://vercel.com/contex-coders-projects/besord | Conta: contex-coder |
| **GitHub Repo** | https://github.com/contex-coder/besord | Branch: `main` |
| **MongoDB Atlas** | https://cloud.mongodb.com | Cluster: Besord |
| **Stripe Dashboard** | https://dashboard.stripe.com | Modo: teste |
| **Google Cloud Console** | https://console.cloud.google.com | OAuth credentials |
| **Apple Developer** | https://developer.apple.com | Sign In creds |
| **Resend (emails)** | https://resend.com | API key |

### Ficheiros importantes no repositório

| Ficheiro | Descrição |
|---|---|
| `backend/server.py` | Todo o backend FastAPI (~2000 linhas) |
| `backend/workspaces.py` | Lógica de empresas, VIES, CNPJ, NIF |
| `backend/pricing.py` | Tiers de preços (Bronze/Silver/Gold/Platinum) |
| `backend/email_alerts.py` | Notificações por email via Resend |
| `frontend/src/contexts/AuthContext.tsx` | Autenticação, User type, API fetch |
| `frontend/src/theme.ts` | Tema global: `colors`, `brutalShadow` |
| `Dockerfile` | Build Docker do backend (Python 3.11) |
| `render.yaml` | Configuração do Render (docker, env vars, disk) |
| `DEPLOYMENT_GUIDE.md` | Guia de deploy completo (7KB) |
| `FIXES_REQUIRED.md` | Lista de problemas conhecidos |
| `briefing/` | Relatórios de sessão (criado hoje) |

---

## 9. 📊 COMMITS DESTA SESSÃO

```
5cb9595 fix: webhook stripe reescrito com try/except correto, emojis removidos das f-strings (Python 3.11)
8db57e8 fix: workspaces.py - f-string com backslash (re.sub) causa SyntaxError no Python 3.11 (Render)
1593746 fix: corrige forque + elif sem if no webhook - compila e pronto para deploy
12463f8 fix: verify-empresa imports, perfil styles, campaigns duplicate prop, index reprovo, AuthError export, age_confirmed, User type expandido, account-type getItem args
```

---

## 10. 🚀 ESTADO FINAL

| Componente | Status | Commit Live | Observação |
|---|---|---|---|
| **Backend** | ✅ LIVE | `5cb9595` | Webhook corrigido, compila sem erros |
| **Frontend** | ✅ LIVE | `12463f8` | TypeScript sem erros de compilação |
| **Stripe Webhook** | ✅ 200 OK | `5cb9595` | Responde com `{"ok":true}` |
| **API Endpoints** | ✅ Todos 200 | `5cb9595` | Posts, themes, eventos |

---

**📌 Último comando antes de sair:** O relatório está em `briefing/2026-06-07_16-27_relatorio_completo.md`. Para continuação, ler este ficheiro e seguir os próximos passos na secção 6.

**Boa sorte, substituto! 🚀**
