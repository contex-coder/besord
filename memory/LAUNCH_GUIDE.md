# 🚀 Besord — Guia Passo-a-Passo para Ganhar Dinheiro

**Autor da conta admin**: rodrigocontecunha@gmail.com (você)
**Status atual**: Backend + Frontend prontos. Admin panel funcionando. Login Google ✅. Apple Sign-In ⏸️ (Fase 2).

---

## 🎯 FASE 1 — Lançar e Começar a Receber (Google Login)

### Passo 1: Obter chave Stripe CORRETA (5 min) — BLOQUEADOR
A chave que você enviou (`pk_live_51RZJDY...`) é **PUBLISHABLE** (pública, frontend). Para o backend processar pagamentos, preciso da **SECRET**.

1. Vá em https://dashboard.stripe.com/apikeys
2. **REVOKE a chave pk_live que você compartilhou** publicamente (botão "Roll key" na linha dela)
3. Em "Standard keys", copie o **Secret key** (começa com `sk_live_...`) — botão "Reveal live key"
4. **Me envie em mensagem privada** apenas essa `sk_live_...` (não cole em screenshot, redes, etc.)
5. **Recomendação MVP**: Toggle "Viewing test data" no topo do Stripe → copie a `sk_test_...` em vez da live. Assim você testa tudo sem risco. Quando tiver app publicado + primeiros anunciantes, eu troco para a `sk_live_`.

### Passo 2: Push pro GitHub (5 min) — backup do código
1. Topo direito do Emergent → botão **"Save to GitHub"**
2. Conecte sua conta GitHub
3. Cria um repo `besord-app` (privado recomendado)
4. ✅ Código salvo, você é dono dele para sempre.

### Passo 3: Publicar Web pública (10 min) — primeiro link de divulgação
1. Topo direito do Emergent → botão **"Publish"**
2. Escolha "Deploy Web"
3. Você recebe uma URL tipo `https://besord.app.emergent.dev`
4. **Esse é o link inicial para divulgação** (LinkedIn, WhatsApp, Twitter, etc.)
5. **Custo**: ~$10/mês (50 créditos)

### Passo 4: Publicar Android (1 dia → aprovação)
1. Criar conta Google Play Developer: https://play.google.com/console — **US$25 pagamento ÚNICO**
2. No Emergent → "Publish" → "Build Android" → upload do AAB gerado na Play Console
3. Preencha ficha do app (descrição PT/EN, screenshots, ícone)
4. Aprovação: 1-3 dias
5. Link público: `play.google.com/store/apps/details?id=com.besord` (URL para divulgação)

### Passo 5: Marketing inicial (de graça)
1. **LinkedIn**: post anunciando o lançamento, com o link da web
2. **Twitter/X**: tweet com prints + link
3. **Communities**: Reddit (r/SideProject, r/startup), Indie Hackers, Product Hunt
4. **Network direto**: 10 amigos/colegas → pedem 10 → efeito viral
5. **Posts orgânicos** no próprio Besord: você publica imagens com palavras virais para gerar conteúdo inicial

### Passo 6: Primeiros anunciantes — sua mina de ouro
**Onde encontrar**: pequenas marcas, influencers, agências, lojinhas locais.
**Pitch**: "Teste o nome do seu produto/embalagem/logo com 1.000 pessoas em sua cidade por $19".
**Cupom de boas-vindas**: vá em **Admin → PROMOS → CRIAR CÓDIGO** → ex: `LANCAMENTO` com 50% off → divulgue nas suas redes.

---

## 🎯 FASE 2 — Escalar (após primeiros $$$)

### Apple iOS App (US$99/ano)
- Quando tiver receita recorrente que justifique
- Criar conta Apple Developer
- Emergent → Publish → Build iOS → upload App Store Connect
- Apple Sign-In **já está implementado** — ativa automático em builds iOS

### Migrar Backend (opcional, se sair do Emergent)
Tudo já é portável:
- **Vercel**: Backend FastAPI funciona via `vercel.json` (serverless)
- **Railway**: `railway up` no repo → ~$5/mês
- **Render/Fly.io**: similar, ambos free tier
- **AWS/DigitalOcean**: Docker container, mais controle, ~$10-20/mês

### Migrar MongoDB → Atlas (recomendado em produção)
1. Criar cluster grátis em https://cloud.mongodb.com (M0 free)
2. `mongodump --uri="mongodb://localhost:27017/test_database" -o ./backup`
3. `mongorestore --uri="<atlas-uri>" ./backup`
4. Trocar `MONGO_URL` no `.env` para a string Atlas
5. ✅ Migrado, com backups automáticos e alta disponibilidade

---

## 💰 PROJEÇÃO DE RECEITA (otimista mas real)

| Mês | Usuários | Anunciantes | Receita média | Total/mês |
|---|---|---|---|---|
| 1 | 500 | 5 | $50 | **$250** |
| 3 | 5k | 30 | $80 | **$2,400** |
| 6 | 25k | 150 | $120 | **$18,000** |
| 12 | 100k+ | 500+ | $150 | **$75,000+** |

**Para chegar lá**: foco em conteúdo viral + adquirir anunciantes locais (LTV alto).

---

## 🔐 PAINEL ADMIN — Como Acessar

1. **Faça login com Google usando o email** `rodrigocontecunha@gmail.com`
2. Vá em **Perfil** → o botão preto **"PAINEL ADMIN"** aparece
3. Você verá 4 abas:
   - **OVERVIEW**: receita total, KPIs, top palavras
   - **ADVERTISERS**: lista todos os anunciantes, quanto cada um gastou
   - **PROMOS**: criar/deletar códigos promocionais
   - **TOOLS**: atalhos para deploy, Stripe Dashboard, migração

⚠️ **Importante**: O email admin é fixado em `/app/backend/.env` (`ADMIN_EMAIL=rodrigocontecunha@gmail.com`). Para mudar, edita esse arquivo.

---

## ❌ Erros comuns a evitar

1. **Não compartilhe a sk_live_** com ninguém. Só comigo, em chat, e eu coloco direto no `.env` protegido.
2. **Não publique nas lojas antes de testar** o fluxo Google login + criação de campanha localmente.
3. **Não cobre em produção sem termos de uso + política de privacidade** — vou gerar templates quando publicar.
4. **Reserve 30% de cada venda** para impostos (Brasil: MEI cobre até R$81k/ano).

---

## 📞 Próximas ações (suas, agora)

1. ☐ Me envie sua `sk_test_...` ou `sk_live_...` correta do Stripe (em chat aqui)
2. ☐ Push pro GitHub (clica no botão Save to GitHub)
3. ☐ Publish Web (clica no botão Publish → Deploy Web)
4. ☐ Faça login com `rodrigocontecunha@gmail.com` → testa o Painel Admin
5. ☐ Cria um código promocional `LANCAMENTO` com 50% off
6. ☐ Divulga o link público no LinkedIn

Faça nessa ordem. **Em ≤2 horas você está com o app no ar, painel admin funcionando e código de lançamento pronto pra divulgar.**

🚀 Vamos lá!
