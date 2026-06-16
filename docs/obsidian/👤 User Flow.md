# 👤 User Flow
## Atualizado: 16 Junho 2026

## Fluxo Principal — Utilizador Pessoal

```
Abrir App
    │
    ▼
[Onboarding]
    │
    ├── Escolhe "Pessoal"
    │
    ▼
    [Login / Registo]
    │   ├── Google OAuth
    │   ├── Apple Sign In
    │   └── Email + Password
    │
    ▼
    [Age Gate] ─── Se < 18 anos? → Bloqueado
    │
    ▼
    [Feed Principal]
    │   ├── Vê palavras em feed (imagens via Cloudinary CDN)
    │   ├── Vota APROVO 👍 / DESAPROVO 👎
    │   ├── Filtra por: recente, hype, tema
    │   └── Clica num post para ver detalhes
    │
    ├── [Criar Post]
    │   ├── Escreve palavra (max 20 chars)
    │   ├── Adiciona imagem/vídeo (carrossel)
    │   └── Publica → imagem vai para Cloudinary CDN
    │
    ├── [Explorar Eventos]
    │   ├── Mapa com eventos geolocalizados
    │   ├── Eventos curados (fonte: Curador Automático)
    │   ├── Filtra por raio (2km)
    │   └── Faz check-in no evento
    │
    ├── [Criar Evento]
    │   ├── Passo 1: Informação (nome, descrição)
    │   ├── Passo 2: Data e hora
    │   └── Passo 3: Localização no mapa
    │
    └── [Perfil]
        ├── Estatísticas: B$ total, hype acumulado
        ├── Eventos visitados
        ├── Posts que criei
        └── Configurações
```

## Fluxo — Utilizador Empresa

```
Abrir App
    │
    ▼
[Onboarding]
    │
    ├── Escolhe "Empresa"
    │
    ▼
    [Login / Registo (empresarial)]
    │
    ▼
    [Verificação de Email]
    │   └── Clica link recebido por email
    │
    ▼
    [Página /verify-empresa]
    │   └── Consentimento marketing
    │
    ▼
    [Dashboard Business]
    │
    ├── [Criar Campanha]
    │   ├── Escolhe tier: Bronze | Silver | Gold | Platinum
    │   ├── Define palavra alvo
    │   ├── Define tema
    │   ├── Stripe Checkout para pagar
    │   └── Webhook ativa campanha quando pago
    │
    ├── [Ver Anúncios] ─── Posts patrocinados ativos
    │
    └── [Relatórios]
        ├── Votos recolhidos
        ├── Geolocalização dos votos
        └── Métricas de campanha
```

## Fluxo — Administrador

```
Login (email = rodrigocontecunha@gmail.com)
    │
    ▼
[Admin Panel]
    ├── CRUD de eventos
    ├── Reset de tiers
    ├── Configuração geral
    └── Sorteio de prémios manual
```

## Fluxo — Curador Automático (16 Jun 2026)

```
Cron Job Render (9h + 21h Lisboa, 2×/dia)
    │
    ▼
[POST /api/curator/run?api_key=...]
    │
    ├── STAGE 1: FETCH (sources.py)
    │   └── 15 queries Google News RSS
    │       "agenda lisboa hoje", "porto noite hoje", ...
    │       ~500 raw events → dedup → 80 amostra
    │
    ├── STAGE 2: EXTRACT (Groq llama-3.1-8b-instant)
    │   └── Extrai JSON: {title, date, location, city, theme, confidence}
    │       Prompt: extrai 1º evento concreto mesmo de compilações
    │
    ├── STAGE 3: VALIDATE (regras Python)
    │   ├── Data no passado → rejeita
    │   ├── Cidade fora cobertura → rejeita
    │   ├── Padrão spam → rejeita
    │   └── Título/location vazios → rejeita
    │
    ├── STAGE 4: IMAGE (Pillow)
    │   └── Valida qualidade (≥400×400, proporção < 1:3)
    │
    └── STAGE 5: REVIEW
        ├── ≤7 dias + conf ≥60 → insere direto ✅
        ├── 8-60 dias + conf ≥70 → insere direto ✅
        ├── >60 dias → fila revisão 🟡
        └── conf 50-69 → fila revisão 🟡
            │
            ▼
    [Admin revisa fila]
    ├── GET /api/admin/event-queue
    ├── POST /api/admin/event-queue/{id}/approve → insere
    └── POST /api/admin/event-queue/{id}/reject → descarta
```

## Fluxo — Upload de Imagens (16 Jun 2026)

```
Utilizador cria post com imagem base64
    │
    ▼
[POST /api/posts]
    │
    ├── Cloudinary configurado?
    │   ├── SIM → storage.upload_image(base64) → URL Cloudinary
    │   │        image_url = "https://res.cloudinary.com/..."
    │   │        image_base64 = ""
    │   └── NÃO → fallback automático
    │            image_url = ""
    │            image_base64 = dados originais
    │
    ▼
[serialize_post()]
    │
    └── Prefere image_url (CDN) sobre image_base64 (legacy)
    └── Cliente recebe URL CDN → carrega rápido via 200+ edge locations
```
