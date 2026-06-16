# 📋 Checklist Deploy

## 🔴 Antes de cada push/deploy

### 1. Compilar Backend
```bash
for f in backend/*.py; do python3 -m py_compile "$f" || echo "❌ ERRO: $f"; done
```
✅ **Não fazer push se houver erros de compilação**

### 2. Verificar TypeScript no Frontend
```bash
cd frontend
npx tsc --noEmit
```
✅ **Corrigir todos os erros de tipo antes de push**

### 3. Testar Localmente
```bash
# 1. Backend local
cd backend && source venv/bin/activate && uvicorn server:app --reload --host 0.0.0.0 --port 8000

# 2. Frontend local (outro terminal)
cd frontend && npx expo start --tunnel

# 3. Testar endpoints principais
curl http://localhost:8000/
curl http://localhost:8000/api/themes
curl http://localhost:8000/api/posts?limit=1
```

---

## 🟡 Antes de deploy em produção

### 4. Verificar Variáveis de Ambiente no Render
- [ ] `MONGO_URL` — string de conexão do MongoDB Atlas
- [ ] `DB_NAME` — nome da base de dados
- [ ] `STRIPE_API_KEY` — chave secreta do Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` — signing secret do webhook
- [ ] `RESEND_API_KEY` — chave da API Resend
- [ ] `EMAIL_FROM` — email de envio
- [ ] `GOOGLE_CLIENT_ID` — ID do Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` — segredo do Google OAuth
- [ ] `JWT_SECRET_KEY` — chave para JWT
- [ ] `FRONTEND_BASE_URL` — `https://besord.vercel.app`
- [ ] `APP_BASE_URL` — `https://besord-backend.onrender.com`
- [ ] `ADMIN_EMAIL` — `rodrigocontecunha@gmail.com`
- [ ] `LOG_LEVEL` — `INFO` (ou `DEBUG` para troubleshooting)

### 5. Verificar GitHub Actions
- [ ] O branch `main` tem auto-deploy ativo?
- [ ] Último deploy foi bem sucedido?

---

## ✅ Após deploy

### 6. Testar Produção
```bash
# Backend
curl https://besord-backend.onrender.com
curl https://besord-backend.onrender.com/api/themes
curl https://besord-backend.onrender.com/api/posts?limit=1

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://besord.vercel.app

# Webhook
curl -X POST https://besord-backend.onrender.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"type":"test"},"id":"test","payment_intent":"test"}}}'
```

### 7. Verificar Logs
- **Render:** Dashboard → Service → Logs
- **Vercel:** Dashboard → Deployment → Functions Logs

---

## 🔄 Rollback (se algo falhar)

```bash
# Reverter para commit anterior
git revert HEAD
git push origin main

# Ou deploy manual de um commit específico no Render
curl -X POST "https://api.render.com/v1/services/srv-d8fd8areo5us73bpep9g/deploys" \
  -H "Authorization: Bearer <RENDER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "clear"}'
```

---

## ⚠️ Tier Render — Ponto de Atenção Futuro (16 Jun 2026)

**Estado actual:** `besord-backend` está no tier **free** do Render (sem `plan:` definido em `render.yaml`). O tier free faz spin-down do serviço após inatividade — quando alguém abre a app depois de um período parado, vê um ecrã de "a reiniciar serviço" por 30-50 segundos. Pouco profissional para utilizadores reais.

**Mitigação actual (pré-lançamento):** `.github/workflows/keep-alive.yml` faz `curl` a `GET /api/health` a cada ~10 minutos para manter o serviço sempre activo. É um remendo gratuito, não 100% garantido (pode falhar sob carga do GitHub Actions, e não evita o spin-down durante os próprios deploys).

**Acção a tomar no lançamento oficial (decisão já aprovada por Rodrigo):**
1. Fazer upgrade do serviço `besord-backend` para o plano **Starter** (~7 USD/mês) no dashboard do Render — elimina o spin-down por completo. Pode ser feito directamente no dashboard, ou adicionando `plan: starter` ao serviço em `render.yaml`.
2. Depois do upgrade, desligar/remover `.github/workflows/keep-alive.yml` — deixa de ser necessário e passa a gastar minutos de GitHub Actions sem propósito.

**Nota lateral:** o GitHub pausa automaticamente workflows agendados (`schedule`) em repositórios sem nenhum commit nos últimos 60 dias. Se o repo ficar parado muito tempo antes do lançamento, é preciso reactivar manualmente o workflow (ou fazer um commit trivial) para o ping voltar a correr.
