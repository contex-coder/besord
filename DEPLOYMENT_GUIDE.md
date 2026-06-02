# 🚀 Guia de Deploy — Opção 2 (Prática)

**Tempo total estimado**: 1.5 horas (30 min preparação + 60 min deploys)  
**Custo**: USD 0 (free-tier)  
**Resultado**: Besord em produção, independente do Emergent

---

## ✅ Pré-Requisitos (Já Feitos)

- ✅ Código pronto e testado (5/6 testes passam)
- ✅ Dockerfile preparado
- ✅ render.yaml pronto para deploy automático
- ✅ vercel.json configurado
- ✅ .env.production.template criado

---

## 📋 O QUE VOCÊ PRECISA FAZER

### PASSO 1️⃣ — Criar Conta GitHub (5 min)
**Seu objetivo**: Ter o código em Git para Render e Vercel puxarem

**Link**: https://github.com/signup

**Passos**:
1. Abra https://github.com/signup
2. Preencha: Email, Password, Username
3. Confirme email (vai receber confirmação)
4. **Pronto!**

**Depois**: Me avise quando tiver GitHub criado (username: `@seu_username`)

---

### PASSO 2️⃣ — Fazer Push do Código para GitHub (10 min)

Depois de criar GitHub, execute ISTO no terminal:

```bash
cd /app

# Configure Git com seu email GitHub
git config --global user.email "seu_email@example.com"
git config --global user.name "Seu Nome"

# Criar repositório no GitHub via CLI (se tiver GitHub CLI instalado)
# OU criar manualmente em: https://github.com/new

# Exemplo com CLI:
# gh auth login  (depois siga os prompts)
# gh repo create besord --source=. --remote=origin --push

# Se criar manualmente:
# 1. Abra https://github.com/new
# 2. Nome: "besord"
# 3. Clique "Create repository"
# 4. Siga os comandos que aparecem:

git remote add origin https://github.com/SEU_USERNAME/besord.git
git branch -M main
git push -u origin main
```

**Resultado esperado**: Código aparecer em `https://github.com/SEU_USERNAME/besord`

**Depois**: Avise quando o código estiver em GitHub

---

### PASSO 3️⃣ — Criar Conta MongoDB Atlas (5 min)

**Seu objetivo**: Banco de dados gratuito (5GB)

**Link**: https://www.mongodb.com/cloud/atlas/register

**Passos**:
1. Clique no link, crie conta com Email/Google/GitHub
2. Preencha dados básicos (empresa: "pessoal", função: "developer")
3. **Criar cluster**: Clique em "Build a Database" → "M0 Free"
4. **Configurar**:
   - Cloud: AWS (padrão OK)
   - Region: `eu-central-1` (Portugal próxima)
5. **Criar usuário BD**: 
   - Nome: `besord_user`
   - Senha: algo seguro (guarde!)
   - Click "Create User"
6. **Network**: Adicionar IP `0.0.0.0/0` (permite qualquer IP) — mude depois para Render IP
7. **Copiar string de conexão**: Clique "Drivers" → Node.js → Copie string
   - Substituir `<password>` pela senha criada
   - Ficará assim: `mongodb+srv://besord_user:PASSWORD@cluster0.xxxxx.mongodb.net/besord?retryWrites=true&w=majority`

**Guardar**: Esta string será `MONGO_URL` em Render

**Depois**: Avise quando cluster estiver criado + string de conexão guardada

---

### PASSO 4️⃣ — Criar Conta Render (5 min)

**Seu objetivo**: Hosting gratuito para o backend

**Link**: https://render.com/register

**Passos**:
1. Clique no link, crie com GitHub (mais fácil)
2. Autorize Render a acessar seu GitHub
3. Vá para Dashboard
4. **Conectar repositório**: "New +" → "Web Service"
5. Selecione repositório `besord`
6. Configure:
   - **Name**: `besord-backend`
   - **Runtime**: `Docker`
   - **Region**: `Frankfurt` (eu-central-1) — perto de Portugal
   - **Branch**: `main`
   - **Auto-deploy**: Sim (sempre que fizer push)
7. **Ambiente**: Clique "Environment" e adicione:

| Chave | Valor |
|-------|-------|
| `MONGO_URL` | `mongodb+srv://besord_user:PASSWORD@cluster0...` |
| `STRIPE_API_KEY` | `sk_test_...` (por agora, mudamos depois) |
| `RESEND_API_KEY` | `re_...` |
| `FRONTEND_BASE_URL` | `https://besord.vercel.app` (preenchera depois) |
| `JWT_SECRET_KEY` | (gere uma: `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `LOG_LEVEL` | `info` |

8. **Deploy**: Clique "Create Web Service"

**Aguarde**: ~5 min para primeiro deploy  
**Resultado**: URL como `https://besord-backend.onrender.com`

**Depois**: Copie URL do backend (será usada no Vercel)

---

### PASSO 5️⃣ — Criar Conta Vercel (5 min)

**Seu objetivo**: Hosting gratuito para frontend

**Link**: https://vercel.com/signup

**Passos**:
1. Clique no link, crie com GitHub
2. Autorize Vercel
3. Vá para Dashboard → "New Project"
4. Selecione repositório `besord` → pasta `./frontend`
5. Configure:
   - **Project name**: `besord`
   - **Framework**: `Expo` (ou Next.js se sugerir)
   - **Root directory**: `./frontend`
6. **Environment variables**: Adicione:

| Chave | Valor |
|-------|-------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://besord-backend.onrender.com` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | (deixar vazio por agora) |

7. **Deploy**: Clique "Deploy"

**Aguarde**: ~3-5 min  
**Resultado**: URL como `https://besord.vercel.app`

---

### PASSO 6️⃣ — Testar Fluxo Completo (15 min)

Abra `https://besord.vercel.app` e teste:

1. **Registar negócio**:
   - Email: seu email real
   - Espere receber email de confirmação (Resend)
   - Clique no link
   - Confirme

2. **Criar campanha**:
   - Preencha dados básicos
   - Publique

3. **Testar Stripe**:
   - Vá para anúncio publicado
   - Clique "Promover" ou upgrade
   - Use cartão de teste Stripe: `4242 4242 4242 4242` (data: 12/25, CVC: 123)
   - Confirme pagamento

**Se tudo funcionar**: ✅ Está em produção!

---

## 📞 Se Algo Não Funcionar

| Problema | Solução |
|----------|---------|
| Render não faz deploy | Verifique: (1) Código está em GitHub? (2) Dockerfile existe? (3) Logs em Render → "Logs" |
| Vercel erro | Verifique: (1) `frontend/` folder existe? (2) `EXPO_PUBLIC_BACKEND_URL` definida? (3) Logs |
| Email não chega | Verifique: (1) `RESEND_API_KEY` configurada em Render? (2) Email em spam? (3) Logs |
| Stripe erro | Verifique: (1) `STRIPE_API_KEY` (sk_test_...) em Render? (2) Usando cartão teste? |
| MongoDB erro | Verifique: (1) IP `0.0.0.0/0` adicionado em Atlas Network? (2) Username/password correto? |

---

## ⏭️ Próximos Passos (Depois de Deployado)

1. **Registar domínio `besord.eu`** (USD 10/ano)
   - Configurar DNS em Render + Vercel
   - Ativar HTTPS

2. **Ativar Stripe LIVE** (1-3 dias)
   - Preencher dados Stripe
   - Trocar `sk_test_...` por sua chave live do Stripe
   - Aguardar validação Stripe

3. **Monitorização** (opcional mas recomendado)
   - Sentry para erros
   - Prometheus para métricas

---

## 📊 Resumo do Estado

| Serviço | Antes | Depois |
|---------|-------|--------|
| Backend | Emergent (USD 200/mês) | Render free-tier |
| Frontend | Emergent | Vercel free-tier |
| BD | Local MongoDB | MongoDB Atlas (5GB free) |
| Custo total | USD 200+ | USD 0 |
| Tempo de setup | - | ~1.5 horas |

---

## ✨ Você Está Aqui

Você escolheu **Opção 2**: Eu preparo tudo, você cria as contas e eu guio.

**Próximo passo IMEDIATO**: 
1. Criar GitHub (5 min)
2. Fazer push do código (5 min)
3. Me avisar quando GitHub estiver pronto

Depois você faz MongoDB + Render + Vercel (25 min total), e pronto! 🎉
