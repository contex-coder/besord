# 🚀 Plano de Migração — Sair do Emergent e Montar Independente

**Data**: 2 Jun 2026  
**Objetivo**: Sair do sandbox caro Emergent e criar ambiente independente com custo zero inicial  
**Tempo estimado**: 2–3 dias (inclui testes)  

---

## 📊 Situação Atual

| Item | Status |
|------|--------|
| **Código** | ✅ Pronto (backend + frontend + BD) |
| **Stripe** | ✅ Testado em modo TEST, pronto |
| **Email** | ✅ Resend configurado |
| **Testes** | ⚠️ Não rodados (pytest não instalado) |
| **Ambiente** | 🔴 Caro (Emergent sandbox) |
| **Custo mensal** | ❌ USD 200+ (Emergent) → ✅ USD 0–30 (independente) |

---

## 🎯 Fase 1: Validação Local (Hoje — 2h)

### 1.1 Instalar dependências e rodar testes
```bash
cd /app
pip install pytest pytest-asyncio
python3 -m pytest backend/tests/ -q --tb=short
```
**Resultado esperado**: 80%+ testes passam. Se houver falhas, listar e corrigir.

### 1.2 Testar fluxo local (manualmente)
```bash
# Terminal 1: MongoDB local
docker run -d --name besord-mongo -p 27017:27017 mongo:6

# Terminal 2: Backend
cd /app/backend
MONGO_URL="mongodb://localhost:27017" python3 -m uvicorn server:app --reload --port 8000

# Terminal 3: Frontend (se quiser testar)
cd /app/frontend
npm start
```
**Validar**: criar workspace business → receber email → criar campanha → Stripe checkout → webhook.

---

## 🏗️ Fase 2: Setup Independente — Escolhe um Caminho

### **Opção A: Vercel (Frontend) + Render (Backend) + Mongo Atlas — RECOMENDADO (zero custo)**

**Vantagem**: free tiers, fácil deploy, automático.  
**Custo**: USD 0 inicialmente (upgrade se crescer).  

#### A1. Preparar código para produção
```bash
# Backend: criar .env.production
cat > /app/backend/.env.production << 'EOF'
MONGO_URL="mongodb+srv://USER:PASS@cluster.mongodb.net/besord?retryWrites=true"
DB_NAME="besord"
STRIPE_API_KEY="sk_test_..."
RESEND_API_KEY="re_..."
EMAIL_FROM="Besord <support@besord.eu>"
APP_BASE_URL="https://besord-api.render.com"
FRONTEND_BASE_URL="https://besord.vercel.app"
EOF

# Frontend: .env.production
cat > /app/frontend/.env.production << 'EOF'
EXPO_PUBLIC_BACKEND_URL="https://besord-api.render.com"
EOF
```

#### A2. Deploy Backend (Render.com — free)
1. Criar conta em https://render.com
2. Conectar repositório GitHub (ou fazer push manual)
3. New Web Service → GitHub repo → selecionar `/app/backend`
4. Runtime: Python 3.11
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn server:app --host 0.0.0.0 --port 8000`
7. Deploy — obterá URL como `https://besord-api.render.com`

#### A3. Deploy Frontend (Vercel — free)
1. Criar conta em https://vercel.com
2. Importar `/app/frontend` (Next.js/Expo Web)
3. Set env vars (copiar de `.env.production`)
4. Deploy — obterá URL como `https://besord.vercel.app`

#### A4. MongoDB Atlas (free M0 cluster)
1. Criar conta em https://www.mongodb.com/cloud/atlas
2. Create cluster (M0 free)
3. Whitelist IP (0.0.0.0 para começar; restringir depois)
4. Connection string: `mongodb+srv://user:pass@cluster.mongodb.net/besord`
5. Colar em `.env.production` do backend

#### A5. Testar em produção
- Abrir https://besord.vercel.app
- Criar workspace business
- Validar email de confirmação
- Criar campanha
- Clicar "Pagar"
- Validar webhook no Render logs

---

### **Opção B: VPS (DigitalOcean / Linode) — Mais controlo, USD 5–10/mês**

**Vantagem**: completo controlo, pronto para escalar.  
**Custo**: USD 5–15/mês (VPS pequeno).  

#### B1. Provisionar VPS
```bash
# DigitalOcean droplet: Ubuntu 22.04, 1GB RAM, USD 5/mês
# SSH para o servidor
ssh root@YOUR_VPS_IP

# Instalar dependências
apt update && apt install -y python3-pip docker.io docker-compose git

# Clonar código
cd /home
git clone https://github.com/YOUR_USER/besord.git
cd besord
```

#### B2. Docker Compose em produção
```yaml
# docker-compose.prod.yml
version: "3.8"
services:
  backend:
    build: ./backend
    environment:
      MONGO_URL: "mongodb://mongo:27017"
      DB_NAME: "besord"
      STRIPE_API_KEY: "$STRIPE_API_KEY"
      RESEND_API_KEY: "$RESEND_API_KEY"
    ports:
      - "8000:8000"
    depends_on:
      - mongo
  
  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongo_data:
```

#### B3. Deployar
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 💳 Fase 3: Stripe Modo LIVE (Quando Pronto)

### 3.1 Ativar conta Stripe Live
1. Ir a https://dashboard.stripe.com
2. Settings → Account details → Ativar
3. Preencher dados (NIF, IBAN, dados da empresa)
4. Stripe valida em 1–3 dias úteis

### 3.2 Trocar chaves
```bash
# Quando ativado, no backend/.env.production
STRIPE_API_KEY="<stripe_live_key>" # copiar do dashboard
STRIPE_WEBHOOK_SECRET="<stripe_webhook_secret>" # criar webhook
```

### 3.3 Configurar webhook
1. Dashboard Stripe → Developers → Webhooks
2. Add endpoint → URL: `https://besord-api.render.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `charge.refunded`
4. Copiar signing secret (`<stripe_webhook_secret>`) e colocar em `.env.production`

---

## 🔒 Fase 4: Segurança (Antes de Aceitar Anúncios Reais)

- [ ] HTTPS: Domínio + Let's Encrypt (automático em Vercel/Render)
- [ ] CORS: Restringir ao frontend só (em `backend/server.py`)
- [ ] Secrets: Não commitar `.env`; usar variáveis de ambiente no provider
- [ ] Dependências: Rodar `pip check` + Dependabot (GitHub)
- [ ] Rate limits: Configurados (em `backend/server.py`)
- [ ] Logging: Sentry (grátis até certos limites)
- [ ] Backups: MongoDB Atlas automático

---

## 📋 Checklist Rápido (Hoje)

- [ ] Instalar pytest e rodar testes localmente
- [ ] Copiar código para repo GitHub (se não estiver)
- [ ] Criar conta Render (backend) + Vercel (frontend) + MongoDB Atlas
- [ ] Deployar backend em Render
- [ ] Deployar frontend em Vercel
- [ ] Testar fluxo ponta a ponta (registar → verificar email → pagar)
- [ ] Se OK, configurar Stripe LIVE (2–3 dias úteis)
- [ ] Revisar segurança (CORS, secrets, etc)

---

## 💰 Custos Finais

| Item | Custo |
|------|-------|
| Render Backend (free tier, 750h/mês) | USD 0 |
| Vercel Frontend (free) | USD 0 |
| MongoDB Atlas M0 | USD 0 |
| Resend (primeiros 100 emails) | USD 0 |
| Stripe (sem fee mensal) | Paga por transação (~1.4% + 0.30€) |
| **Total** | **USD 0** ✅ (só pagará Stripe quando receber) |

---

## ⚠️ Notas Importantes

1. **Free tiers têm limites**: Render free tier para 750 horas/mês (~25h/dia). Se usar 24/7, upgrade para USD 5+/mês.
2. **Produção**: Depois de tração, migra para VPS (USD 5+/mês) para controlo total.
3. **Domínio**: Registar `besord.eu` separado (USD 10–15/ano em Namecheap/GoDaddy).
4. **Monitorização**: Considere Sentry (free) para alertas de erro em produção.

---

## 📞 Próximos Passos Recomendados

1. **Agora**: Instalar pytest, rodar testes, listar qualquer falha.
2. **Amanhã**: Criar contas (Render, Vercel, MongoDB Atlas), deployar backend/frontend.
3. **Dia 3**: Testar em produção, ativar Stripe LIVE, revisar segurança.
4. **Dia 4+**: Monitorização contínua, melhorias baseadas em feedback.

---

**Tudo claro? Quer que eu execute algum destes passos agora?**
