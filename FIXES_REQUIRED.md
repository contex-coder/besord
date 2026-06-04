# Fixes Necessárias — Besord

## 1. 🔴 CRÍTICO: Remover Emergent Agent Auth Redirect

**Problema:**
- URL de login aponta para `auth.emergentagent.com` (caminho obsoleto)
- Referência em `frontend/app/index.tsx` (linha 19) — imagem do mascote
- Referência em `frontend/app/admin.tsx` (linha 154) — link público

**Impacto:**
- Login falha porque tenta redirecionar para domínio descontinuado
- URLs hardcoded impedem independência da app

**Ação:**
```
1. frontend/app/index.tsx — Remover BEETLE_URL hardcoded
2. frontend/app/admin.tsx — Atualizar URLs de admin para besord.vercel.app
3. backend/tests/* — Atualizar BASE_URL em conftest.py e test_iteration6.py
4. memory/LAUNCH_CHECKLIST.md — Atualizar referências Emergent
```

---

## 2. ⚠️ WARNINGS: Resolver Dependências Desatualizadas

### Babel Plugins Obsoletos
Aparecem warnings sobre propostas Babel que agora são padrão ECMAScript:
- `@babel/plugin-proposal-*` → usar `@babel/plugin-transform-*`
- Afeta: class-properties, numeric-separator, optional-chaining, etc.

**Arquivo:** `frontend/package.json`
**Solução:** Atualizar `babel-preset-expo` para versão que já usa as novas plugins

### WebSocket Version Mismatch
```
ws@8.17.0 incompatible with ws@^6.2.3 e ws@^7.5.10
```
**Causa:** Múltiplas dependências requerem versões diferentes de `ws`
**Impacto:** Warnings não-bloqueadores, mas indica dependências desatualizadas

**Solução:**
- Revisar quais dependências precisam `ws`
- Atualizar `react-native-dotenv` para versão compatível
- Remover a resolution hack `ws: 8.17.0` se possível

---

## 3. 📱 UX: Auth Callback Path Clarification

**Estado actual:**
- URL de callback: `/auth/callback?token=<session_token>`
- AuthContext captura o token do URL e limpa a barra com `replaceState`
- Mobile usa `Linking.createURL("auth/callback")` com WebBrowser

**Melhorias recomendadas:**
- Adicionar logging melhorado (já existe, mas pode ser mais explícito)
- Tratar casos de erro na callback (token expirado, inválido)
- Implementar timeout se callback demorar muito

---

## 4. 🔧 CONFIG: Melhorias de Infraestrutura

### Backend
- [ ] Validar `GOOGLE_REDIRECT_URI` é `${BACKEND_URL}/api/auth/google/callback`
- [ ] Adicionar rate limiting em `/api/auth/google/callback`
- [ ] Implementar refresh token (token atual expira em 7 dias)
- [ ] Log estruturado em vez de prints

### Frontend
- [ ] Usar variáveis de ambiente para domínios (não hardcode)
- [ ] Adicionar retry logic em `apiFetch` com exponential backoff
- [ ] Melhorar error boundaries em páginas críticas
- [ ] Implementar session recovery graceful

### CI/CD
- [ ] Vercel env vars validadas na build
- [ ] Tests rodando antes de deploy (actualmente vazio)
- [ ] Secret rotation policy para tokens

---

## Summary das Prioridades

| Prioridade | Tarefa | Impacto |
|---|---|---|
| 🔴 CRÍTICA | Remover emergentagent.com refs | Login quebrado |
| 🟠 ALTA | Resolver dependency warnings | Build limpo |
| 🟡 MÉDIA | Auth callback error handling | UX melhorada |
| 🟢 BAIXA | Infrastructure config | Segurança/escalabilidade |

