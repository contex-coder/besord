# 🎨 Design & UX — Ecrãs e Fluxos
## Referência de produto — 10 Junho 2026

---

## PRINCÍPIOS DE DESIGN (Imutáveis)

| Princípio | Regra |
|---|---|
| **Estilo** | Neo-Brutalist: preto/branco, sombras hard offset, bordas grossas, sem gradientes |
| **Tipografia** | Negrito, tamanho generoso, máximo 2 pesos de fonte por ecrã |
| **Espaço** | Muito espaço negativo — o silêncio é parte do design |
| **Cor de acento** | Amarelo (#FFD700) para acções primárias — nunca mais de 1 cor de acento por ecrã |
| **Imagens** | Sempre a cheio — sem molduras, sem cantos arredondados |
| **Feedback** | Sombra desloca-se no clique (efeito "carimbo") — referência: `brutalShadow` em `theme.ts` |
| **Nunca redesenhar** | O design é identidade. Ajustes pontuais sim; redesign não. |

---

## ARQUITECTURA DE NAVEGAÇÃO

```
App
├── (auth)
│   ├── index.tsx          — Splash + guard de navegação
│   ├── onboarding.tsx     — 3 ecrãs de apresentação
│   ├── account-type.tsx   — Pessoal / Empresa
│   ├── login.tsx          — Login / Registo
│   └── age-gate.tsx       — Verificação de idade
│
├── (tabs)                 — Navegação principal (5 tabs)
│   ├── feed.tsx           — Feed global + Admirados + Word of the Day
│   ├── mapa.tsx           — Radar de eventos
│   ├── criar.tsx          — Criar publicação
│   ├── hypes.tsx          — Hypes por tema
│   └── perfil.tsx         — Perfil do utilizador
│
├── evento/[id].tsx        — Detalhe de evento
├── post/[id].tsx          — Detalhe de publicação
├── word/[word].tsx        — Feed filtrado por palavra (NOVO)
├── user/[id].tsx          — Perfil público (NOVO)
├── trends.tsx             — Trends regionais
│
└── business/
    ├── dashboard.tsx      — Painel de empresa
    ├── create-event.tsx   — Wizard 4 passos (REDESENHAR)
    └── sincronia-report.tsx — Relatório de Sincronia (NOVO)
```

---

## ECRÃS — ESPECIFICAÇÃO DETALHADA

---

### 🖥️ ONBOARDING (3 ecrãs)

**Ecrã 1 — A Proposta**
```
┌─────────────────────────────┐
│                             │
│   [IMAGEM SEED — silêncio]  │
│   (full screen)             │
│                             │
│   ┌─────────────────────┐   │
│   │ Chega de ruído.     │   │
│   │ Cada dia,           │   │
│   │ uma palavra.        │   │
│   └─────────────────────┘   │
│                             │
│          [→ Avançar]        │
└─────────────────────────────┘
```

**Ecrã 2 — O Social**
```
┌─────────────────────────────┐
│                             │
│   [IMAGEM — dois olhares]   │
│                             │
│   ┌─────────────────────┐   │
│   │ Não segues pessoas. │   │
│   │ Admiras olhares.    │   │
│   └─────────────────────┘   │
│                             │
│          [→ Avançar]        │
└─────────────────────────────┘
```

**Ecrã 3 — O Valor**
```
┌─────────────────────────────┐
│                             │
│   [IMAGEM — minimalismo]    │
│                             │
│   ┌─────────────────────┐   │
│   │ 5 minutos que valem │   │
│   │ mais do que 5 horas │   │
│   │ no TikTok.          │   │
│   └─────────────────────┘   │
│                             │
│       [Começar →]           │
└─────────────────────────────┘
```

---

### 🖥️ FEED PRINCIPAL

**Layout com Tab interna: Global | Admirados**

```
┌─────────────────────────────┐
│ BESORD          🔔  [perfil]│
├─────────────────────────────┤
│  [Global]  |  [Admirados]   │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ ★ PALAVRA DO DIA        │ │
│ │ [imagem full]           │ │
│ │ "SAUDADE"               │ │
│ │ 47 pessoas · +2 BW      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ @utilizador · 2h        │ │
│ │ [imagem]                │ │
│ │ ══════════════          │ │
│ │ "DISTANTE"              │ │
│ │ 👍 Aprovo  👎 Desaprovo │ │
│ └─────────────────────────┘ │
│                             │
│  8 interacções restantes ▓░ │
└─────────────────────────────┘
```

**Notas UX**:
- Contador de Time-Gate é subtil (barra de progresso no rodapé, não texto grande)
- Word of the Day tem destaque visual (borda amarela ou selo ★)
- Palavra é elemento dominante — fonte grande, negrito
- Botões Aprovo/Desaprovo: estilo brutalShadow, desloca no clique

---

### 🖥️ ECRÃ DE ENCERRAMENTO DE SESSÃO (Time-Gate)

```
┌─────────────────────────────┐
│                             │
│                             │
│   ┌─────────────────────┐   │
│   │ ██████████████████  │   │
│   │  O mundo já te deu  │   │
│   │  o suficiente       │   │
│   │  por hoje.          │   │
│   │                     │   │
│   │  Vá viver.          │   │
│   └─────────────────────┘   │
│                             │
│   [Ver o meu Espelho hoje]  │
│   [Fechar]                  │
│                             │
└─────────────────────────────┘
```

**Notas UX**:
- Overlay sobre o feed (semi-transparente)
- Botão "Ver o meu Espelho hoje" — abre Espelho de Empatia (opcional)
- "Fechar" fecha o overlay mas mantém o app aberto (pode navegar para perfil, eventos, etc.)

---

### 🖥️ ESPELHO DE EMPATIA (pós-sessão)

```
┌─────────────────────────────┐
│ ← Voltar                    │
│                             │
│   ┌─────────────────────┐   │
│   │ SEU ESPELHO DE HOJE │   │
│   └─────────────────────┘   │
│                             │
│   "Sessão finalizada.       │
│   Aprovaste visuais de      │
│   movimento mas rejeitaste  │
│   acção explícita. Buscas   │
│   o impulso sem o ruído.    │
│   Isso é uma escolha ou     │
│   um escape?"               │
│                             │
│   ─────────────────────     │
│   PADRÃO DETECTADO          │
│   Blindagem mental · 3 dias │
│   consecutivos              │
│                             │
│   [Partilhar Card]          │
│   [Guardar]                 │
└─────────────────────────────┘
```

**Notas UX**:
- Fundo preto, texto branco — máximo contraste, tom sério
- "Padrão detectado" só aparece quando há histórico suficiente (≥ 5 sessões)
- "Partilhar Card" → gera Printable Card (Fase 3)

---

### 🖥️ RADAR DE EVENTOS (Mapa)

```
┌─────────────────────────────┐
│ EVENTOS             [Lista] │
├─────────────────────────────┤
│ [Prémios] [Novidades] [Net] │
├─────────────────────────────┤
│                             │
│   [   MAPA INTERACTIVO   ]  │
│   [  com pins de eventos  ] │
│   [  ● Evento A (2km)    ]  │
│   [  ● Evento B (500m)   ]  │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ ● Lançamento Marca X    │ │
│ │ 500m · Hoje até 20h     │ │
│ │ 🎁 iPhone 15 em sorteio │ │
│ │ 23 participantes        │ │
│ │         [Entrar →]      │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Notas UX**:
- Filtros por intenção no topo (não por categoria abstracta)
- Pin do mapa diferenciado por tipo: pessoal/singular/plural
- Card de evento no bottom sheet do mapa (arrasta para ver mais)
- "Entrar →" abre o evento directamente

---

### 🖥️ DETALHE DE EVENTO

```
┌─────────────────────────────┐
│ ← Voltar         [Partilhar]│
│                             │
│ [IMAGEM DO EVENTO — full]   │
│                             │
│ Lançamento Coleção X        │
│ Curador: @artista_y         │
│ Patrocinador: Marca Z       │
│                             │
│ ██████████░░░░  67%         │
│ Faltam 2 dias · 48 votos    │
│                             │
│ ─────────────────────────── │
│ PUBLICAÇÕES DO EVENTO       │
│                             │
│ [post 1] [post 2] [post 3]  │
│                             │
│ 🎁 Prémio: Voucher €50      │
│ Condição: vota em 3 posts   │
│                             │
│  [APROVO]       [DESAPROVO] │
└─────────────────────────────┘
```

---

### 🖥️ PERFIL PÚBLICO (user/[id])

```
┌─────────────────────────────┐
│ ← Voltar                    │
│                             │
│ [avatar]  @utilizador       │
│           Designer · Lisboa │
│                             │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │  47  │ │  12  │ │ 3.2k │ │
│ │posts │ │eventos│ │  B$  │ │
│ └──────┘ └──────┘ └──────┘ │
│                             │
│   [Admirar]                 │  ← botão principal
│   (admiradores: ver mais)   │  ← link subtil, não destaque
│                             │
│ ─────────────────────────── │
│ MUSEU DE SENTIDOS           │
│ (últimas publicações)       │
│                             │
│ [post] [post] [post]        │
│ [post] [post] [post]        │
└─────────────────────────────┘
```

**Notas UX**:
- Contagem de admiradores é link subtil, não metric em destaque
- "Museu de Sentidos" — linguagem intencional, não "publicações"
- Grid de posts com palavra visível por cima da imagem

---

### 🖥️ WIZARD DE CRIAÇÃO DE EVENTO B2B (4 passos)

**Passo 1 — Tipo e Nome**
```
┌─────────────────────────────┐
│ CRIAR EVENTO          1 / 4 │
├─────────────────────────────┤
│                             │
│ Que tipo de evento?         │
│                             │
│ ┌─────────────────────────┐ │
│ │ 👤 Pessoal              │ │
│ │ O meu clube de sentido  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🏢 Empresa              │ │
│ │ Lançamento ou imersão   │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🎪 Promotor             │ │
│ │ Feira ou congresso      │ │
│ └─────────────────────────┘ │
│                             │
│                  [→ Avançar]│
└─────────────────────────────┘
```

**Passo 2 — Imagem**
```
┌─────────────────────────────┐
│ CRIAR EVENTO          2 / 4 │
├─────────────────────────────┤
│                             │
│   [  + Adicionar imagem  ]  │
│   (Galeria ou câmara)       │
│                             │
│   Filtro Besord aplicado    │
│   automaticamente ✓         │
│                             │
│              [→ Avançar]    │
└─────────────────────────────┘
```

**Passo 3 — Prémio**
```
┌─────────────────────────────┐
│ CRIAR EVENTO          3 / 4 │
├─────────────────────────────┤
│                             │
│ Qual é o prémio? (opcional) │
│                             │
│ [________________________]  │
│  ex: Voucher €50 na loja    │
│                             │
│ Sem prémio → menos          │
│ participação.               │
│                             │
│ [Saltar]      [→ Avançar]   │
└─────────────────────────────┘
```

**Passo 4 — Confirmar + QR**
```
┌─────────────────────────────┐
│ CRIAR EVENTO          4 / 4 │
├─────────────────────────────┤
│                             │
│ [preview do evento]         │
│                             │
│ ┌─────────────────────────┐ │
│ │   [ QR CODE GERADO ]    │ │
│ │   Imprime e coloca      │ │
│ │   no teu stand.         │ │
│ └─────────────────────────┘ │
│                             │
│ [Copiar link]  [Partilhar]  │
│                             │
│        [✓ Publicar]         │
└─────────────────────────────┘
```

---

### 🖥️ PRINTABLE CARD (Efeito Printável)

**Output visual** (formato 1080×1080 para Instagram Stories):

```
┌─────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░                           ░│
│░   [IMAGEM DO POST]        ░│
│░   (full, sem bordas)      ░│
│░                           ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│█████████████████████████████│
│  DISTANTE                   │  ← palavra, fonte brutalista grande
│  ─────────────────────────  │
│  "Buscas a substância,      │  ← insight da IA (max 1 linha)
│  não a ilusão."             │
│                    BESORD   │  ← logo subtil
│█████████████████████████████│
└─────────────────────────────┘
```

---

## FLUXOS COMPLETOS

### Fluxo 1 — Utilizador Novo (Onboarding → Feed)
```
Instalar APK
    ↓
Onboarding (3 ecrãs)
    ↓
account-type: Pessoal / Empresa
    ↓
Login Google / Apple / Email
    ↓
Age-gate (se < 18: bloqueado)
    ↓
Feed principal
    ↓ (primeira sessão)
Word of the Day em destaque
    ↓
Vota (10 interacções)
    ↓
Ecrã Time-Gate: "O mundo já te deu o suficiente"
    ↓ (opcional)
Espelho de Empatia (análise da primeira sessão)
```

### Fluxo 2 — Evento In-Loco (QR Code)
```
Utilizador numa feira
    ↓
Vê QR Code no stand da empresa
    ↓
Scan → besord://evento/xyz
    ↓
App abre directamente no evento (< 2 segundos)
    ↓
Vê imagem do produto
    ↓
Escolhe palavra ("Robusto")
    ↓
Concorre ao sorteio
    ↓
App: "Definiste este produto como Robusto. Por quê? (opcional)"
    ↓
Empresa recebe dado em tempo real no dashboard
```

### Fluxo 3 — Criador com Admiradores
```
Criador publica no seu "Museu de Sentidos"
    ↓
Admiradores recebem notificação
    ↓
Admiradores entram no feed, votam, deixam a sua palavra
    ↓
Criador vê engagement qualificado (não likes — palavras)
    ↓
Empresa descobre criador com 500+ admiradores
    ↓
Empresa patrocina evento do criador (Evento Pessoal)
    ↓
Escrow: Besord retém pagamento
    ↓
Evento conclui + relatório entregue
    ↓
Criador recebe 70-80% do valor
```

### Fluxo 4 — Espelho de Empatia (com Memória)
```
Utilizador vota em 10 posts (Time-Gate)
    ↓
Ecrã de encerramento
    ↓ (clica "Ver o meu Espelho")
Backend agrega sessão de hoje + personality_snapshot
    ↓
Chamada à IA (Gemini 1.5 Flash)
    ↓
Insight em 3 frases (Tom estoico, directo)
    ↓
user_memory actualizado com nova sessão
    ↓ (após 5+ sessões)
"Padrão detectado: Blindagem mental · 3 dias consecutivos"
    ↓ (opcional)
Utilizador gera Printable Card e partilha no Instagram
```

---

## GUIA DE IMAGENS (Filtro Besord)

### Categorias aprovadas para o banco de imagens seed

| Arquétipo | Descrição | Exemplo |
|---|---|---|
| **Contraste Ético** | Dois mundos lado a lado sem legenda | Criança em lixão com telemóvel na mão |
| **Minimalismo de Detalhe** | Objecto comum em ângulo estranho | Relógio parado numa vitrine de luxo |
| **Natureza Brutal** | Poder sem esforço | Raiz rompendo o asfalto |
| **Solidão Conectada** | Introspecção sem performance | Pessoa a ler num vagão de comboio vazio |

### 3 Regras (imutáveis para todas as imagens)
1. **Sem texto** na imagem — a palavra vem do utilizador
2. **Sem performance** — sem poses de selfie ou venda directa
3. **Espaço de respiro** — pelo menos 20% de área sem elemento focal

### Prompt padrão para geração IA (DALL-E / Stable Diffusion)
> *"Gera uma imagem minimalista e provocativa que capture o sentimento de [TEMA], sem representar figuras políticas ou locais específicos. Foca em texturas, sombras e metáforas visuais. A imagem deve convidar à reflexão existencial. Sem texto. Alta qualidade, estilo editorial."*

---

> **Última actualização:** 10 Junho 2026
