# 📐 Arquitetura

## Stack Tecnológica

```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │  HTTP   │   Backend        │
│   React Native  │◄───────►│   FastAPI        │
│   Expo Router   │  REST   │   Python 3.11    │
│   TypeScript    │         │   Uvicorn        │
│   Vercel        │         │   Render (Docker)│
└─────────────────┘         └────────┬────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   MongoDB Atlas    │
                            │   (M0 Free Tier)   │
                            └───────────────────┘
```

## URLs Ativas

| Componente | URL | Status |
|---|---|---|
| **Frontend** | https://besord.vercel.app | ✅ Online |
| **Backend API** | https://besord-backend.onrender.com | ✅ Live |
| **Stripe Webhook** | `POST /api/stripe/webhook` | ✅ 200 OK |

## Dependências Principais

### Frontend (`frontend/package.json`)
- `expo ~54.0.35` — SDK mais recente
- `expo-router ~6.0.24` — Navegação baseada em ficheiros
- `react-native 0.81.5` — Última versão estável
- `react 19.1.0` — React mais recente
- `react-native-reanimated ~4.1.1` — Animações
- `expo-video` — Reprodução de vídeos
- `expo-image` — Imagens otimizadas

### Backend (`backend/requirements.txt`)
- `fastapi 0.110.1` — Framework web
- `uvicorn 0.25.0` — Servidor ASGI
- `pymongo 4.5.0` — Driver MongoDB
- `motor 3.3.1` — Driver async MongoDB
- `stripe 14.4.1` — Pagamentos
- `Pillow 12.2.0` — Processamento de imagens
- `resend 2.30.1` — Emails transacionais

## Ficheiros Importantes

| Ficheiro | Descrição |
|---|---|
| `backend/server.py` | Todo o backend FastAPI (~2000 linhas) |
| `backend/workspaces.py` | Lógica de empresas, VIES, CNPJ, NIF |
| `backend/pricing.py` | Tiers de preços (Bronze/Silver/Gold/Platinum) |
| `backend/email_alerts.py` | Notificações por email via Resend |
| `frontend/src/contexts/AuthContext.tsx` | Autenticação, User type, API fetch |
| `frontend/src/theme.ts` | Tema global: cores, brutalShadow |
| `Dockerfile` | Build Docker do backend (Python 3.11) |
| `render.yaml` | Configuração do Render |
