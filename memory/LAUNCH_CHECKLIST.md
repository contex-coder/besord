# 🚀 Besord — Checklist de Lançamento (atualizado 1 jun 2026)

Legenda: ✅ pronto • ⏳ pendente (acção tua) • ⚙️ pendente (acção minha) • 🟡 opcional

---

## 1. Stripe (pagamentos) 💳

### Estado actual
- Stripe **TEST mode** (`sk_test_*` no `.env`)
- Moeda: EUR
- Tiers: LOCAL 19€, REGIONAL 49€, NACIONAL 99€, GLOBAL 199€ (editáveis no painel admin)
- Sucesso/cancel URLs: server-side, não fiáveis ao cliente
- Verificação pós-redirect: re-busca a sessão na Stripe e confirma `payment_status=="paid"`
- Audit log de criação de campanhas: `campaign_audit` collection
- Webhook signature scaffold: pronto, falta secret

### Por fazer
- ⏳ **Activar conta Stripe real** (modo Live): https://dashboard.stripe.com → Activate
  - Requer NIF, dados da empresa Besord, IBAN PT
  - Tempo estimado: 30 min (preenchimento) + 1-3 dias úteis (validação Stripe)
- ⏳ **Substituir `STRIPE_API_KEY`** no `.env` por `sk_live_*` depois da activação
- ⏳ **Criar webhook em Live**: https://dashboard.stripe.com/webhooks → Add endpoint
  - URL: `https://api.besord.eu/api/stripe/webhook` (depois do deploy do backend) — ou usa o URL do Emergent enquanto não migras
  - Eventos: `checkout.session.completed`, `charge.refunded`, `checkout.session.expired`
  - Copia o `whsec_...` e envia-me; eu coloco no `.env`
- 🟡 **Configurar branding na Stripe**: logo, cor, email de recibo (`support@besord.eu`)
- 🟡 **Activar Stripe Tax** se faturação ≥ 10k€ (IVA automático)

---

## 2. Google Play Store 🤖

### 🔴 Bloqueadores
- ⏳ **Conta Google Play Developer** ($25 único): https://play.google.com/console/signup — só tu podes
  - Identidade verificada (passaporte/CC)
  - Tempo estimado: 1-2 dias para Google aprovar
- ✅ **Ícone 512×512** PNG → `/app/frontend/assets/images/icon.png`
- ✅ **Adaptive icon** (Android 8+) → `/app/frontend/assets/images/adaptive-icon.png`
- ✅ **Splash screen** 2048×2048 → `/app/frontend/assets/images/splash-image.png`
- ✅ **5 screenshots** (Android phone, mínimo) → `/app/memory/play_store_assets/screenshots/`
- ✅ **Textos PT-PT** (toda a app em pt-PT)
- ⏳ **URL público de política de privacidade**: `https://www.besord.eu/privacy.html` — depende do upload do site
- ⏳ **Build AAB** (Android App Bundle): usa o botão **"Publish"** do Emergent (canto superior direito)

### Metadados da listagem (já redigidos)
| Campo | Valor |
|---|---|
| **Nome curto** | Besord |
| **Título completo** | Besord — 1 imagem, 1 palavra, 1 veredito |
| **Descrição curta** (80 chars) | Posta foto, recebe veredito em 1 palavra. Aprovo ou desaprovo. |
| **Categoria** | Social |
| **Tags** | social, feedback, communidade, polls |
| **Classificação** | 13+ (PEGI 12 / ESRB Teen) |
| **País principal** | Portugal |
| **Idiomas** | pt-PT, en, fr, de, zh |
| **Email de contacto** | support@besord.eu |
| **Política de privacidade** | https://www.besord.eu/privacy.html |
| **Website** | https://www.besord.eu |

### 🟡 Recomendados (não-bloqueadores)
- 🟡 Vídeo promocional (YouTube, 30 seg) — sobe conversão ~30%
- 🟡 Feature graphic 1024×500 (banner da loja)
- 🟡 Tradução dos metadados (EN/FR/DE/ZH)

---

## 3. Apple App Store 🍎

### Bloqueadores
- ⏳ **Conta Apple Developer** ($99/ano): https://developer.apple.com/programs
- ⏳ **Sign in with Apple** já está implementado (`expo-apple-authentication`) — Apple EXIGE em apps com login social
- ⏳ **Build IPA**: botão **"Publish"** do Emergent
- ⏳ **Privacy nutrition labels** (preencher no App Store Connect)
- ✅ Ícone 1024×1024 (mesmo `icon.png`)

---

## 4. Domínio besord.eu 🌐

- ⏳ **Upload do site estático**: descompactar `besord-site.zip` para `public_html/` no cPanel
  - Link de download dentro da app: **Admin → Site público besord.eu (ZIP)** OU directamente em `https://<preview-url>/api/download/besord-site.zip`
- ⏳ **Ativar HTTPS** (Let's Encrypt no cPanel)
- ⏳ **Configurar `.htaccess`** (força HTTPS + www) — snippet pronto no `README.md` dentro do zip

---

## 5. Email 📧 (Resend)

- ✅ Resend API key configurada
- ✅ Templates HTML (50/75/100% marcos) prontos
- ⏳ **Verificar domínio besord.eu** em https://resend.com/domains
  - DNS Records: 1 MX + 2 TXT (SPF, DKIM) — adiciona no cPanel DNS Editor
  - Tempo: ~5 min DNS + 15-30 min propagação
- ⚙️ Depois de verificado, eu troco `EMAIL_FROM="Besord <onboarding@resend.dev>"` para `"Besord <support@besord.eu>"`

---

## 6. Backend (servidor) ☁️

### Estado actual
- A correr em **preview Emergent** (kubernetes interno)
- MongoDB local
- ⚠️ **Não está em produção real ainda** — preview pode reciclar dados a qualquer momento

### Para lançar oficialmente
- ⏳ Decidir host produção (3 opções):
  - **A) Continuar no Emergent + Deploy**: clica "Publish" e o Emergent trata. Mais rápido.
  - **B) Migrar para Railway/Vercel/AWS**: mais flexível, mas mais trabalho.
- ⏳ **MongoDB → MongoDB Atlas** (cluster gerido):
  - 512MB grátis suficiente para começar
  - `mongodump` local → `mongorestore` Atlas
- ⏳ Apontar subdomínio `api.besord.eu` para o backend (DNS A record)

---

## 7. Conteúdo & Moderação ⚖️

- ✅ Filtro automático de palavras (PT/EN/PT-BR)
- ✅ Auto-hide a 3 reports
- ✅ Painel admin com fila de moderação
- ✅ Gate de idade (13+)
- ✅ Audit log de campanhas
- 🟡 Resposta automática de email a `support@besord.eu` (fora do scope desta ronda)
- 🟡 Plano de resposta a incidentes legais (PIA RGPD, breach de dados)

---

## 8. Análise / Métricas 📊

- 🟡 Google Analytics 4 / Plausible no site `besord.eu`
- 🟡 Firebase Crashlytics no app (opcional — Sentry funciona melhor com Expo)
- 🟡 Mixpanel / Posthog para funnel de conversão B2B

---

## Resumo das tuas próximas 5 acções (ordem sugerida)

1. 📦 **Baixar `besord-site.zip`** via admin do app (já tens o botão) ou directamente:
   `https://image-feedback-app.preview.emergentagent.com/api/download/besord-site.zip`
2. 🌐 **Upload via cPanel** → `https://www.besord.eu` online
3. 📧 **Verificar domínio Resend** → emails saem com `@besord.eu`
4. 💳 **Activar Stripe Live** → modo real para receber dinheiro
5. 📱 **Conta Google Play Developer** → enquanto Stripe valida, prepara a loja

Quando tiveres o `whsec_...` da Stripe Live e o domínio Resend verificado, manda-me que actualizo o `.env`.
