# 🐛 Erros Conhecidos

## 🔴 Críticos

### 1. Stripe Webhook Secret
- **Problema:** Se `STRIPE_WEBHOOK_SECRET` no Render não corresponder ao Stripe Dashboard, o webhook rejeita com 400
- **Solução:** Verificar no Render Dashboard → Environment → `STRIPE_WEBHOOK_SECRET` e copiar do Stripe Dashboard → Webhooks → signing secret

### 2. Deploys "update_failed" no Render
- **Problema:** Render faz rolling update; se o container crasha ao iniciar (SyntaxError), o deploy falha
- **Solução:** **Sempre compilar antes de push:**
  ```bash
  for f in backend/*.py; do python3 -m py_compile "$f" || echo "❌ ERRO: $f"; done
  ```

### 3. Variáveis de ambiente no Render
- **Problema:** Se faltar alguma env var, o backend pode crashar
- **Verificar:** `MONGO_URL`, `DB_NAME`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET_KEY`, `FRONTEND_BASE_URL`, `APP_BASE_URL`, `ADMIN_EMAIL`, `LOG_LEVEL`

---

## 🟡 Moderados

### 4. Cache Docker no Render
- **Problema:** `pip install` não re-instala se `requirements.txt` não mudou
- **Solução:** Deploy com `{"clearCache": "clear"}`:
  ```bash
  curl -X POST "https://api.render.com/v1/services/srv-d8fd8areo5us73bpep9g/deploys" \
    -H "Authorization: Bearer <API_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"clearCache": "clear"}'
  ```

### 5. Python 3.11 Limitações
- **Problema:** Python 3.11 não suporta:
  - `\u{...}` dentro de f-strings
  - `re.sub(r'\D', ...)` diretamente em f-strings
- **Solução:** Usar variáveis temporárias em vez de expressões dentro de f-strings

### 6. MongoDB M0 Free (512MB)
- **Problema:** As `images_base64` nos posts são pesadas
- **Monitorizar:** https://cloud.mongodb.com → cluster → Metrics
- **Solução futura:** Comprimir imagens ou migrar para S3

### 7. API Key do Render expira
- **Problema:** O token pode expirar
- **Solução:** Dashboard Render → Account → API Keys → Generate new key

---

## 🟢 Leves

### 8. `campaigns.tsx` — Propriedade duplicada
- `emptyBtnText` estava definido duas vezes (linhas 151 e 160)
- ✅ **Já corrigido**

### 9. `verify-empresa.tsx` — Ficheiro sem imports
- Faltavam imports de `useRouter`, `useState`, `useEffect`, etc.
- ✅ **Já corrigido**

### 10. `age_confirmed` vs `age_confirmed_at` (LOOP CRÍTICO — corrigido)
- **Problema:** Backend retorna `age_confirmed: bool` no JSON (`UserOut`), mas o frontend esperava `age_confirmed_at: string` no type `User`.
- **Efeito:** `!user.age_confirmed_at` era SEMPRE `undefined` → redirecionava para `/age-gate` mesmo após confirmar idade → **LOOP INFINITO**
- **Ficheiros afetados:** `AuthContext.tsx` (type), `index.tsx`, `perfil.tsx`
- **Solução aplicada (10/jun/2026):**
  - `AuthContext.tsx` → Adicionado `age_confirmed?: boolean` ao type `User` (mantendo `age_confirmed_at?` para compatibilidade)
  - `index.tsx` → `!user.age_confirmed_at` → `!user.age_confirmed`
  - `perfil.tsx` → `!user.age_confirmed_at` → `!user.age_confirmed`
- ✅ **Corrigido**

### 11. Navegação — Fluxo de onboarding sem coordinator/guard central
- **Problema:** `index.tsx` redireciona para `/account-type` ou `/age-gate` diretamente, mas `perfil.tsx` também tem verificações redundantes de idade. `account-type.tsx` depende de `storage.getItem` assíncrono sem estado global. Navegação espalhada por vários componentes sem um ponto central de orquestração.
- **Efeito:** Possíveis race conditions, redirecionamentos inesperados, lógica duplicada.
- **Solução proposta:** Criar guard centralizado no `_layout.tsx` raiz que orquestre:
  ```
  Login → user?
    → age_confirmed?
      → onboarding feito (besord_onboarded)?
        → account_type escolhido?
          → feed
          → não → account-type
        → não → onboarding slides
      → não → age-gate
    → não → landing page (index)
  ```
- 🔄 **Pendente** — Aguardando implementação

### 12. `forque` em vez de `for`
- `forque k, v` em vez de `for k, v` no `server.py`
- ✅ **Já corrigido**

### 13. `elif` sem `if` no webhook
- Estrutura condicional quebrada causava `UnboundLocalError`
- ✅ **Já corrigido** no commit `5cb9595`
