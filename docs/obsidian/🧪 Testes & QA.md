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
