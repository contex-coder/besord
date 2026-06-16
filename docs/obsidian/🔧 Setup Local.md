# 🔧 Setup Local

## 🎯 Objetivo

Desenvolver sem precisar de deploys no Render/Vercel. Código alterado → aparece **instantaneamente** no telemóvel.

---

## 📦 Pré-requisitos

| Ferramenta | Como verificar |
|---|---|
| Python 3.10+ | `python3 --version` |
| Node.js 20+ | `node --version` |
| Expo Go | App no telemóvel (Play Store / App Store) |
| Stripe CLI (opcional) | `stripe --version` |

---

## 🚀 Passo a Passo

### 1. Backend Local

```bash
cd backend

# Criar e ativar virtual environment
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Criar .env local (copia do template ou cria manual)
cat > .env << 'EOF'
MONGO_URL="mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net"
DB_NAME="besord"
STRIPE_API_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
RESEND_API_KEY="re_..."
EMAIL_FROM="Besord <onboarding@resend.dev>"
FRONTEND_BASE_URL="http://localhost:8081"
APP_BASE_URL="http://localhost:8000"
ADMIN_EMAIL="rodrigocontecunha@gmail.com"
JWT_SECRET_KEY="qualquer_chave_secreta"
LOG_LEVEL="DEBUG"
EOF

# Correr servidor
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

O backend fica acessível em: **`http://192.168.x.x:8000`** (IP do teu PC na rede)

### 2. Frontend Local

```bash
cd frontend

# Criar .env.local para apontar para backend local
cat > .env.local << 'EOF'
EXPO_PUBLIC_BACKEND_URL="http://192.168.x.x:8000"
EXPO_PUBLIC_FRONTEND_URL="http://localhost:8081"
EXPO_PUBLIC_GOOGLE_CLIENT_ID=""
EOF

# Instalar dependências
yarn install

# Correr Expo — USAR LAN (não --tunnel)
npx expo start
```

> **Nota:** Substitui `192.168.x.x` pelo IP do teu PC na rede WiFi:
> ```bash
> hostname -I | awk '{print $1}'
> ```
> ⚠️ `--tunnel` (ngrok) requer autenticação desde 2024 — usar LAN ou EAS Update

### 3. Telemóvel — Duas opções

**Opção A — Expo Go + WiFi (para desenvolvimento rápido):**
1. Instala **Expo Go** (Play Store)
2. Garante que telemóvel e PC estão na **mesma rede WiFi**
3. Abre a app → Lê o QR code do terminal
4. ✅ App a funcionar com hot-reload

**Opção B — APK Preview + EAS Update (para testes do fundador):**
1. Instala o APK gerado pelo EAS Build (link enviado pelo CTO)
2. App instalada como app normal no Android
3. Quando o CTO faz mudanças:
   ```bash
   export PATH="$HOME/.npm-global/bin:$PATH"
   cd frontend
   EXPO_TOKEN="<ver frontend/.env>" eas update --branch main --message "descrição"
   ```
4. ✅ APK actualiza automaticamente (OTA — sem reinstalar)

### 4. Stripe Webhook Local (para testar pagamentos)

```bash
# Noutro terminal
stripe listen --forward-to localhost:8000/api/stripe/webhook

# Isto mostra um webhook signing secret tipo whsec_xxx
# Copia esse secret para o .env do backend como STRIPE_WEBHOOK_SECRET
```

Para testar um pagamento:
```bash
stripe trigger checkout.session.completed
```

---

## 🔄 Workflow Diário

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend && npx expo start --tunnel
```

1. Alteras código no VSCode
2. Expo faz hot-reload → telemóvel atualiza **instantaneamente**
3. Testas no telemóvel como user real

---

## ⚠️ Limitações do Local

| Funcionalidade | Local | Produção |
|---|---|---|
| Feed, votos, posts | ✅ | ✅ |
| Email/password login | ✅ | ✅ |
| Google/Apple Login | ❌ (precisa HTTPS) | ✅ |
| Stripe pagamento real | ✅ (com Stripe CLI) | ✅ |
| Notificações push | ✅ (Expo Go) | ✅ |
| Geolocalização real | ✅ (GPS do telemóvel) | ✅ |
| Outros users acederem | ❌ | ✅ |

---

## 🐛 Debug

```bash
# Ver logs do backend em tempo real
uvicorn server:app --reload --host 0.0.0.0 --port 8000 --log-level debug

# Testar endpoint rápido
curl http://localhost:8000/api/posts?limit=1

# Ver IP do PC
hostname -I
```
