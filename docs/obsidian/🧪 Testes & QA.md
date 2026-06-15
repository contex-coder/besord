# 🧪 Testes & QA

## Testes Rápidos de Sanidade

### Backend
```bash
# Health check
curl https://besord-backend.onrender.com

# Listar temas
curl https://besord-backend.onrender.com/api/themes

# Listar posts (1 post)
curl https://besord-backend.onrender.com/api/posts?limit=1

# Webhook Stripe
curl -X POST https://besord-backend.onrender.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"type":"test"},"id":"test","payment_intent":"test"}}}'
```

### Frontend
```bash
curl -s -o /dev/null -w "%{http_code}" https://besord.vercel.app
# Deve retornar 200
```

---

## 🔥 Prioridade Alta — Testes Pendentes

### 1. Stripe Webhook com evento real
- Fazer pagamento real (€1) com cartão de teste
- Verificar webhook processa corretamente
- Confirmar: post ativo, campanha ativa, invoice guardada

### 2. Campanhas — Fluxo completo
- Criar campanha → Stripe checkout → webhook → status "active"
- Verificar `paid_at`, `starts_at`, `ends_at` atualizados
- Verificar post patrocinado aparece no feed

### 3. Sorteio
- `POST /posts/{id}/draw-prize`
- Post com `prize` configurado
- Verificar notificação ao vencedor

### 4. Verificação de Empresa
- Criar workspace
- Receber email de verificação
- Clicar link → página `/verify-empresa`
- Consentimento marketing → confirmação

---

## 🎯 Novos Testes — Fase 3 (15 Jun 2026)

### Evento Pessoal (Tipo 1)
```bash
# Criar evento pessoal (requer user com bw_balance >= 1000)
curl -X POST https://besord-backend.onrender.com/api/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"pessoal","title":"O Meu Evento","duration_days":3,"has_raffle":false}'

# Deve falhar se bw_balance < 1000
# Deve criar evento gratuito se bw_balance >= 1000
```

### Eventos Empresa — Criação Gratuita
```bash
# Criar evento singular (deve ser gratuito — sem Stripe)
curl -X POST https://besord-backend.onrender.com/api/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"singular","title":"Lançamento Produto","duration_days":7}'
# Deve retornar evento com status "active" (sem checkout_url)

# Publicar imagem num evento (paga €9,99)
curl -X POST https://besord-backend.onrender.com/api/events/EVT_ID/publish-image \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image_base64":"data:image/jpeg;base64,...","has_raffle_item":false,"package":false}'
# Deve retornar checkout_url Stripe para €9,99
# Com package=true → checkout_url Stripe para €49,99 (10 imagens)
```

### Evento Plural — Expositor
```bash
# Empresa entra como expositora em evento plural
curl -X POST https://besord-backend.onrender.com/api/events/EVT_ID/join-as-exhibitor \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
# Deve adicionar empresa à lista exhibitors do evento
```

### Primeiro Olhar — Diagnóstico Groq
```bash
# Relatório deve incluir campo "diagnosis" gerado por Groq
curl https://besord-backend.onrender.com/api/events/EVT_ID/primeiro-olhar-report \
  -H "Authorization: Bearer TOKEN"
# Verificar: response.diagnosis não é null
# Verificar: response.top_words tem ≥ 1 entrada
# Verificar: response.images[].approval_rate calculado correctamente
```

### Campanhas — Top Palavras
```bash
# Detalhe de campanha deve incluir top_words
curl https://besord-backend.onrender.com/api/campaigns/CAMP_ID \
  -H "Authorization: Bearer TOKEN"
# Verificar: response.top_words_approved é array com {word, count}
# Verificar: response.top_words_rejected é array com {word, count}
```

---

## 📱 Testes Mobile (Pendentes)

### iOS/Android Real
- [ ] Testar em iOS (Expo Go)
- [ ] Testar em Android (Expo Go)
- [ ] Testar geolocalização real (GPS)
- [ ] Testar check-in em evento com distância real
- [ ] Testar upload de foto da galeria
- [ ] Testar carrossel de imagens
- [ ] Testar vídeo

### UI/UX
- [ ] Corrigir `brutalShadow` para iOS (shadowColor, shadowOffset, shadowOpacity, shadowRadius)
- [ ] Testar onboarding completo
- [ ] Testar age gate
- [ ] Testar alterar entre conta pessoal/empresa
- [ ] Testar estado offline (sem internet)

---

## 📊 Testes Automatizados (Backend)

### Como correr todos os testes
```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

### Testes por funcionalidade
```bash
# Auth
python -m pytest tests/test_iteration4.py -v

# Posts e votos
python -m pytest tests/test_iteration1.py -v

# Campanhas
python -m pytest tests/test_iteration5.py -v

# Eventos
python -m pytest tests/test_iteration8.py -v

# Stripe
python -m pytest tests/test_iteration6.py -v
```
