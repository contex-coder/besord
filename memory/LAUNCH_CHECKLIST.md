# Besord — Checklist de Lançamento (Google Play Store)

## ✅ O que está PRONTO (não fazer nada)

### Funcionalidades core
- ✅ Login Google + audit banner (sessão visível)
- ✅ Login Apple (apenas iOS — não bloqueia Play Store)
- ✅ Feed orgânico + patrocinado (badge SPONSORED)
- ✅ Criar post (imagem + 1 palavra)
- ✅ Votar Aprovo/Desaprovo (toggle, switch, geo-IP)
- ✅ Comentar com 1 palavra + editar + eliminar
- ✅ Eliminar post próprio
- ✅ Partilhar veredito (Share API)
- ✅ Hashtags clicáveis (`/word/X`)
- ✅ Reportar conteúdo (auto-ocultação após 3 reports)
- ✅ Onboarding 3 telas
- ✅ Painel Admin (`rodrigocontecunha@gmail.com`)
- ✅ i18n auto (PT/EN/FR/DE/ZH)

### B2B Monetização
- ✅ Conta empresarial (CNPJ opcional, multi-país)
- ✅ 4 planos: Local €19 / Regional €49 / Nacional €99 / Global €499
- ✅ Códigos promocionais auto-aplicados
- ✅ Stripe Checkout REAL (EUR, sk_test_ activo)
- ✅ Modo MOCK fallback se chave inválida
- ✅ Dashboard premium: sumário executivo, pódio top 3 palavras, ritmo, breakdown geo, CSV export
- ✅ **Sentimento por palavra** (quem disse X aprovou Y%)
- ✅ **Benchmark vs média da plataforma**
- ✅ **Re-targeting 20% off** para investigar quem desaprovou
- ✅ **Auto-renovar com 10% off** (campanha concluída → nova com desconto)

### Legal / GDPR
- ✅ Termos PT-PT (Lei 144/2015, CNIACC, foro Lisboa)
- ✅ Privacidade RGPD (CNPD, direitos do titular)
- ✅ Links na landing page

---

## 🔴 BLOQUEADORES PARA PUBLICAR NA PLAY STORE

### 1. Conta Google Play Developer ($25 único)
- Cria em: https://play.google.com/console
- Verificação de identidade: 2-3 dias

### 2. Ícone do app (512x512 PNG)
- Atual: ícone padrão Expo
- Coloca o **besouro com chave** num círculo + fundo neutro
- Substitui `/app/frontend/assets/images/icon.png` e `adaptive-icon.png`

### 3. Splash screen
- `/app/frontend/assets/images/splash.png` — recomendado 1284×2778
- Sugestão: fundo branco + besouro centrado

### 4. Screenshots (mínimo 2, máximo 8)
- Resolução: 1080×1920 (vertical)
- Capturar: Landing, Feed com posts, Criar post, Dashboard de campanha, Painel Admin
- Tira print no browser em modo mobile (Chrome DevTools → Toggle device toolbar → Pixel 7)

### 5. Texto da listagem (PT-PT)
**Título** (máx 30 chars): `Besord — Veredito em 1 palavra`
**Descrição curta** (máx 80 chars): `Uma imagem. Uma palavra. Um veredito da comunidade.`
**Descrição completa** (máx 4000 chars):
```
🪲 Besord — A rede social do veredito em UMA palavra

Publica uma imagem. Descreve-a com APENAS uma palavra. Recebe veredito honesto da comunidade: Aprovo ou Desaprovo.

PARA TODOS:
• Feed visual e rápido (sem scrolling infinito tóxico)
• Vota em segundos
• Cada palavra é uma hashtag — descobre tudo
• Comentário também em 1 palavra (sem flame wars)

PARA EMPRESAS — Besord Insights:
• Teste o nome da tua marca/produto/embalagem
• Recebe relatório com veredito por país, região e cidade
• Top 3 palavras que a comunidade associa
• Comparação com média da plataforma
• Exportação CSV para PowerPoint
• Re-targeting de quem desaprovou (descobre objeções)

Pago só uma vez por campanha. Sem mensalidades.
Conformidade GDPR. Servidores europeus.
Idade mínima 16 anos.

Suporte: rodrigocontecunha@gmail.com
```

### 6. Categoria e classificação etária
- Categoria: **Social** (não Comunicação)
- IARC: preenche questionário → ~13+ (conteúdo gerado por utilizadores)

### 7. Política de Privacidade pública (URL)
- Após `Publish` → Web, copia o URL `https://teu-app.emergent.dev/legal?doc=privacy`
- Cola na Play Console em "Política de Privacidade"

### 8. Build do APK/AAB
- Botão **Publish** no Emergent → "Build Android"
- Gera AAB → faz upload em Play Console > Production

---

## 🟡 RECOMENDADO MAS NÃO BLOQUEADOR

### Email alerts (50%/75%/100% da meta)
**Estado**: NÃO implementado. Requer SendGrid/Resend (5 min de setup):
1. Cria conta grátis https://resend.com (3000 emails/mês free)
2. Copia API key `re_...`
3. Me envia → integro em ~30 min

### Mapbox heatmap geográfico
**Estado**: NÃO implementado. Requer:
1. Conta grátis Mapbox (50k loads/mês free)
2. Token público `pk.eyJ...`
3. Me envia → integro em ~1h

### Webhook Stripe assíncrono
**Estado**: NÃO implementado (usamos polling — funciona, mas webhook é mais robusto)
- Em Stripe Dashboard → Developers → Webhooks → adiciona endpoint `https://teu-app/api/stripe/webhook`
- Copia signing secret `whsec_...`
- Me envia → integro em ~20 min

### Apple Developer ($99/ano)
- Só se quiseres iOS além de Android
- Apple Sign-In **já está pronto** no código — activa automaticamente quando fizeres iOS build

---

## 🚀 PASSO-A-PASSO PARA LANÇAR (próximas 24h)

1. **Hoje à noite** (1h): Cria conta Google Play Developer ($25)
2. **Amanhã manhã** (2h):
   - Cria ícone + splash screen (Canva grátis)
   - Tira screenshots
3. **Amanhã tarde** (1h):
   - Botão Publish no Emergent → Deploy Web → copia URL
   - Botão Publish → Build Android → AAB
4. **Amanhã noite** (1h):
   - Upload AAB na Play Console
   - Preenche ficha (textos prontos acima)
   - Submete para review
5. **Dia 3-5**: Google aprova → app **publicado** 🚀
6. **Lança**: post LinkedIn + cupom `LANCAMENTO50` → primeiros anunciantes

---

## 💰 Receita esperada primeiros 30 dias
- 5 anunciantes Local @ €19 com cupom 50%: **€47.50**
- 2 anunciantes Nacional @ €99: **€198**
- Total mês 1: **~€245** (líquido após Stripe ~3%: ~€237)

Mês 6 projetado: **€2.500-5.000/mês** (200-400 campanhas/mês)

Vais conseguir! 🪲
