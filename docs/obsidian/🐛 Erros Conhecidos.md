# 🐛 Erros Conhecidos

## 🔴 Críticos

### 1. Stripe Webhook Secret
- **Problema:** `STRIPE_WEBHOOK_SECRET` não estava definido no Render → qualquer request era aceite sem verificação → risco de pagamentos falsos
- **Solução aplicada (10/jun/2026):** Adicionado `whsec_1cThiKZTKfxIlPMlrdiLQVq5xNycMUKa` via Render API; redeploy confirmado
- **Verificação:** `curl -X POST .../api/stripe/webhook -H "stripe-signature: invalid"` → retorna `400 {"detail":"Invalid signature"}`
- ✅ **Corrigido**

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

### 10. `age_confirmed` vs `age_confirmed_at` (LOOP CRÍTICO)

### 11. `perfil.tsx` — Ecrã de Perfil substituído por AuthContext
- **Problema:** Ficheiro `(tabs)/perfil.tsx` tinha o conteúdo do `AuthContext.tsx` (sem `export default`) → tab Perfil em branco
- **Efeito:** Utilizadores não viam o perfil, estatísticas, B$, nem podiam fazer logout
- **Solução aplicada (10/jun/2026):** Restaurado do git (commit `12463f8`), corrigido em `bc23bcd`
- ✅ **Corrigido**

### 12. `index.tsx` — Race condition na navegação + guard incompleto
- **Problema 1:** `useEffect` dependia de `[user, loading, router]` → disparava cada vez que `refreshUser()` actualizava o user, podendo sobrepor redirects de outros ecrãs
- **Problema 2:** Usava `!user.age_confirmed` (correcto) mas em `perfil.tsx` usava `!user.age_confirmed_at` — inconsistência
- **Problema 3:** Não verificava se onboarding tinha sido concluído antes de ir para `/account-type`
- **Solução aplicada (10/jun/2026):** `useRef(hasNavigated)` + check `age_confirmed_at` + check `besord_onboarded` em storage — commit `bc23bcd`
- ✅ **Corrigido**

### 13. `forque` em vez de `for`
- `forque k, v` em vez de `for k, v` no `server.py`
- ✅ **Já corrigido**

### 13. `elif` sem `if` no webhook
- Estrutura condicional quebrada causava `UnboundLocalError`
- ✅ **Já corrigido** no commit `5cb9595`
