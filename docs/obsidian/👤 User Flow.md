# 👤 User Flow

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
    │   ├── Vê palavras em feed
    │   ├── Vota APROVO 👍 / DESAPROVO 👎
    │   ├── Filtra por: recente, hype, tema
    │   └── Clica num post para ver detalhes
    │
    ├── [Criar Post]
    │   ├── Escreve palavra (max 20 chars)
    │   ├── Adiciona imagem/vídeo (carrossel)
    │   └── Publica → outros users votam
    │
    ├── [Explorar Eventos]
    │   ├── Mapa com eventos geolocalizados
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
