# 📅 Sessão 11 Junho 2026 — Revisão Estratégica & Redesenho da Fase 2

## 👤 Contexto

Sessão de revisão estratégica profunda antes de arrancar a Fase 2. O assistente actuou simultaneamente como:
- **Red Team** — desafiando as premissas do produto
- **Product Manager** — definindo o que construir e em que ordem
- **Data Scientist** — definindo métricas e instrumentação
- **Growth Hacker** — desenhando mecanismos de viralidade e retenção

Fundador (Rodrigo) participou activamente nas respostas estratégicas. Todas as decisões abaixo são **aprovadas pelo fundador**.

---

## 🔴 Red Team — As 5 Objecções e as Respostas

### Objecção 1 — "Estás a convencer pessoas que fogem de apps a instalar uma nova"

**Resposta:** O utilizador-alvo foi redefinido.

Não são os "Exaustos da Superficialidade" (quem quer menos apps). São **criativos que já fazem o trabalho do Besord profissionalmente**: copywriters, directores criativos, brand managers. Para eles, o Besord não é mais uma app — é o seu trabalho gamificado.

**Decisão de produto:** O onboarding precisa de um segundo copy que ressoa com criativos:
> *"O exercício diário de reduzir qualquer coisa a uma palavra. Para quem pensa com imagens."*

O copy actual ("Chega de ruído") funciona para a segunda onda de utilizadores. O copy acima é para os primeiros 100.

---

### Objecção 2 — "Alguém voltou no Dia 2? Isso foi testado?"

**Resposta:** Dois novos mecanismos de retenção foram criados (ver secção de Novos Produtos).

**Decisão crítica:** Antes de lançar aos primeiros 100 utilizadores, **instrumentar o produto com PostHog**. Sem dados, tomamos decisões no escuro.

**Métrica de validação do produto (única que importa nesta fase):**
> **Retenção ao Dia 7 ≥ 35%**

Se abaixo de 35%: problema de produto. Não avançar com crescimento. Se acima de 35%: hábito a formar. Escalar.

---

### Objecção 3 — "O Efeito Printável está na Fase 3 mas é o motor de crescimento"

**Resposta:** O **Veredito card** (versão simplificada, sem IA) entra na Fase 2.

Distinção técnica:
- **Veredito** (Fase 2): usa dados da sessão do dia — palavra publicada, taxa de aprovação, padrão de voto. Zero IA. Construção rápida.
- **Efeito Printável completo** (Fase 3): adiciona insight do Espelho de Empatia gerado por IA. Mantém-se na Fase 3.

São o mesmo card em dois níveis de profundidade.

---

### Objecção 4 — "O B2B precisa de humanos, não de código"

**Resposta:** Os Fundadores Besord do Perfil C (brand managers) são o canal de vendas.

Um brand manager que usa o Besord durante 14 dias não precisa de ser convencido. A conversa comercial torna-se natural:
> *"Já sabes o que o Besord faz à tua percepção. Queres ver o que faz à percepção da tua marca?"*

**Regra de ouro B2B early-stage:** Faz manualmente até doer. Só automatizas o que comprovadamente vendes.

O produto comercial inicial é o **Besord Primeiro Olhar** (ver secção de Novos Produtos).

---

### Objecção 5 — "O preço está 'A definir' — o preço é produto"

**Resposta:** Tabela de preços definida (ver secção de Monetização abaixo).

**Argumento de ancoragem que fecha a venda:**
> *"Focus group tradicional: €5.000–€20.000, 3 semanas. Besord Primeiro Olhar: €800, 48 horas, com público forçado a pensar."*

---

## 🆕 Novos Produtos Definidos Nesta Sessão

### 1. Veredito Card

**O que é:** Card visual gerado automaticamente quando o Time-Gate fecha (10 interacções atingidas). Partilhável directamente para Instagram Stories e WhatsApp Status.

**Conteúdo do card:**
```
┌─────────────────────────────────┐
│                                 │
│   A MINHA PALAVRA DE HOJE       │
│                                 │
│   S I L Ê N C I O              │
│                                 │
│   73% APROVARAM                 │
│   8 em 10 votos: Natureza       │
│                                 │
│   BESORD — 10 VOTOS. UM DIA.   │
│                                 │
└─────────────────────────────────┘
```

**Design:** Neo-Brutalist puro. Preto/branco. Parece uma peça de arte, não um screenshot.

**Porquê funciona para partilha:**
1. É um espelho — as pessoas partilham coisas que as fazem parecer interessantes
2. É símbolo de status intelectual subtil — "uso uma app que me dá só 10 votos"
3. Cria FOMO — "Como sabes a tua palavra de hoje?"
4. É uma pergunta implícita ao amigo — "E tu, qual seria a tua?"

**Especificação técnica:**
- Trigger: quando `daily_interactions.count` atinge 10
- Ecrã de encerramento de sessão mostra o card + botão "PARTILHAR"
- Dados necessários: `word` do post do dia, taxa de aprovação, categoria dominante nos votos
- Backend: `GET /api/users/me/veredito` — retorna dados da sessão actual
- Frontend: novo componente `VeredictCard.tsx` mostrado no overlay de encerramento
- Partilha: React Native `Share.share()` — imagem gerada via `react-native-view-shot`
- Ficheiros críticos: `frontend/src/components/VeredictCard.tsx`, `frontend/src/app/(tabs)/feed.tsx` (overlay)

---

### 2. Sincronia — Notificação de Convergência/Divergência

**O que é:** Quando dois utilizadores que se admiram mutuamente completam a sessão no mesmo dia, o sistema compara os seus padrões de voto e envia uma notificação a ambos.

**Tipos de notificação:**
- Convergência (≥ 6 votos iguais em 10): *"Tu e [Nome] estiveram em sincronia hoje — ambos aprovaram imagens de silêncio urbano."*
- Divergência (≥ 7 votos opostos em 10): *"Tu e [Nome] viram o mundo de forma completamente diferente hoje. 8 votos divergentes em 10."*

**Porquê é o mecanismo viral mais poderoso:**
Receber esta notificação leva naturalmente a abrir o WhatsApp e escrever ao amigo. Não porque a app pediu — porque a curiosidade humana não resiste. Essa conversa privada entre duas pessoas converte em novos utilizadores muito mais do que um story público.

**Condições:**
- Apenas entre admiradores mútuos (ambos se admiram)
- Apenas quando ambos completaram sessão no mesmo dia (UTC)
- Máximo 3 notificações de Sincronia por dia por utilizador
- Opt-out possível nas definições

**Especificação técnica:**
- Trigger: quando `daily_interactions.count` atinge 10 (para qualquer utilizador)
- Backend: função `calculate_sincronia(user_id)` — busca admiradores mútuos que também completaram sessão hoje, compara votos, envia notificação se threshold atingido
- Nova collection MongoDB: `sincronia_logs { user_a, user_b, date, type, score }`
- Ficheiro crítico: `backend/server.py` — endpoint `POST /api/sincronia/calculate` chamado após session complete

---

### 3. Besord Primeiro Olhar (Produto B2B Inicial)

**O que é:** Evento B2B simplificado de 48 horas. Uma marca sobe 5 imagens da nova colecção/produto, a comunidade vota e escolhe palavras, a marca recebe o Relatório de Sincronia.

**Posicionamento:**
> "Em 48 horas, sabe que palavra o teu público escolheria para a tua nova colecção. Antes de ela existir nas lojas."

**Fluxo:**
1. Admin cria o evento via painel admin (semi-manual inicialmente)
2. Partilha link com a marca
3. Marca envia o link à sua audiência (Instagram stories, newsletter)
4. 48 horas de votação da comunidade Besord + seguidores da marca
5. Relatório entregue por email (PDF inicial, dashboard depois)

**Conteúdo do Relatório:**
- Qual das 5 imagens teve maior aprovação
- Top 10 palavras escolhidas pela comunidade
- Palavra que a marca pretendia transmitir vs. palavra que a comunidade escolheu
- **Diagnóstico de desalinhamento** (linha gerada por IA): *"A marca pretendia transmitir 'Inovação'. O público respondeu 'Complexo'. Desalinhamento de 73%."*
- Distribuição geográfica dos votantes

**Especificação técnica:**
- Novo campo em eventos: `type: "primeiro_olhar"` 
- Duração fixa: 48h
- Sem mapa, sem QR code, sem check-in físico — apenas link directo
- Endpoint relatório: `GET /api/events/{id}/primeiro-olhar-report`
- Geração de PDF: biblioteca `reportlab` (Python, já disponível no ambiente)
- Ficheiros críticos: `backend/server.py`, novo `backend/reports.py`

---

## 📊 Estratégia de Crescimento — Os Primeiros 100 Utilizadores Diários

### O conceito: "Os Fundadores Besord"

**100 convites pessoais. Não um link público.**

Cada fundador recebe:
- Badge permanente "Fundador" no perfil (visível mesmo quando a plataforma tiver 1 milhão de utilizadores)
- Primeiro acesso ao Espelho de Empatia beta
- Os seus insights anónimos tornam-se case studies para os primeiros clientes B2B

**Psicologia:** Ser o número 47 de 100 numa coisa que ainda não existe é mais poderoso do que ser o primeiro de uma lista pública. Cria identidade, não apenas interesse.

### Os 3 Perfis dos 100 Fundadores

| Perfil | Quantidade | Quem são | Canal de acesso |
|---|---|---|---|
| **A — Criativos** | 40 | Copywriters e directores criativos de agências (Lisboa, Porto, São Paulo) | LinkedIn (cargo: "Copy" ou "Brand Strategy") + grupos WhatsApp de publicidade |
| **B — Criadores** | 30 | Criadores com 2k–30k seguidores, estética minimalista/conceptual | Instagram DM directo |
| **C — Brand Managers** | 30 | Gestores de marcas de moda, design ou cultura | LinkedIn + referências do Perfil A |

**Nota estratégica:** O Perfil C é simultaneamente utilizador C e futuro cliente B. Quando vivem o produto durante 14 dias, a conversa B2B torna-se natural.

### A mensagem de convite (o tom importa)

> *"Estamos a criar a única app que te dá 10 votos por dia — e depois fecha. Não é para toda a gente. Achei que eras das pessoas certas para os primeiros 100. Queres ser fundador?"*

Nenhuma descrição de features. Nenhum link para a App Store. Apenas a escassez e o apelo à identidade intelectual.

---

## 💰 Monetização B2B — Tabela de Preços Aprovada

| Produto | Preço | Quando usar |
|---|---|---|
| Primeiro Olhar (1º cliente) | **€500** | Troca por testemunho escrito + autorização dados anónimos |
| Primeiro Olhar (2º–3º cliente) | **€1.200** | Com case study do 1º cliente |
| Evento Singular completo | **€2.500** | Com Relatório de Sincronia full + dashboard |
| Evento Plural (por expositor) | **€800/slot** | Feiras, congressos, galerias |

**Argumento de ancoragem vs. concorrência:**
> Focus group tradicional: €5.000–€20.000, 3 semanas. Besord Primeiro Olhar: €800, 48 horas, com público que foi **forçado a pensar**.

**Primeiro mercado B2B:** Marcas de moda portuguesa e brasileira a lançar colecções. Elas entendem "imagem + palavra" porque é o seu negócio. Têm orçamentos discricionários abaixo de €2.000 (sem aprovação de comité). E o output do Relatório é directamente apresentável ao CEO.

---

## 📐 North Star Metric e Framework de Medição

### North Star: Daily Active Words

> **Número de palavras únicas publicadas por dia.**

Captura actividade real, qualidade do asset de dados, e saúde do produto. Se cresce: tudo funciona. Se estagna: há um problema a resolver antes de escalar.

### Funil de métricas (PostHog)

```
install → onboarding_complete → first_vote → session_complete (10 votos)
→ veredito_viewed → veredito_shared
→ d2_open → d7_open (MÉTRICA CRÍTICA)
```

### Thresholds de decisão

| Métrica | Verde | Amarelo | Vermelho |
|---|---|---|---|
| Retenção D7 | ≥ 35% | 20–35% | < 20% |
| Taxa de partilha Veredito | ≥ 25% | 10–25% | < 10% |
| Abertura notif. Sincronia | ≥ 40% | 25–40% | < 25% |
| Conversão Fundador → Primeiro Olhar | ≥ 1/3 Perfis C | 1/5 | 0 |

**Ferramenta:** PostHog (open source, self-hosted no Render, custo €0)

---

## 🗺️ Fase 2 Redesenhada — Prioridades por Impacto

A Fase 2 foi reordenada. O critério: cada item deve ou trazer utilizadores ou trazer receita. O que não faz nenhuma das duas coisas, adia.

### Prioridade 1 — Instrumentação (antes de qualquer feature)
PostHog no frontend e backend. Sem isto, não sabemos o que está a funcionar.

### Prioridade 2 — Veredito Card
Motor de crescimento orgânico. Movido da Fase 3. Implementação: sem IA, só dados da sessão.

### Prioridade 3 — Sincronia
Motor de retenção social. Feature nova, não estava no plano original. Requer mutual admirers + comparação de votos.

### Prioridade 4 — Besord Primeiro Olhar
Primeiro produto comercial. Semi-manual inicialmente. Relatório com diagnóstico de desalinhamento.

### Prioridade 5 — Word of the Day + 50 posts seed
Conteúdo para feed não estar vazio. Mantém-se do plano original.

### O que SAI da Fase 2 (vai para Fase 3)
- Mapa com geolocalização completa
- Filtros de intenção no mapa
- Notificações push por proximidade geográfica
- Ranking dinâmico de Hypes com score temporal
- Fluxo B2B self-serve completo (4 passos automatizados)

**Razão:** Estes itens requerem massa crítica de utilizadores e eventos reais. Construí-los agora seria construir para utilizadores que ainda não existem.

---

## 🔄 O Flywheel Completo

```
100 Fundadores (precisão cirúrgica)
        ↓
Usam diariamente → geram Veredito → partilham no Instagram
        ↓
Notificações de Sincronia → convidam amigos directamente
        ↓
Novos utilizadores → mais massa crítica
        ↓
Fundadores Perfil C (brand managers) → vivem produto → conversa B2B natural
        ↓
Primeiro Olhar €500 → case study → segundo cliente €1.200
        ↓
Evento com link partilhado → seguidores da marca descarregam para participar
        ↓
Mais utilizadores C → dados mais ricos → produto B2B mais valioso → preço sobe
```

---

## 🛠️ Alterações Técnicas Feitas Nesta Sessão

| O que | Ficheiro | Commit |
|---|---|---|
| Onboarding reescrito ("diário de percepções") | `frontend/src/app/onboarding.tsx` | `ab88c66` |
| CDN migration: beetle.png local | `frontend/assets/images/beetle.png` + `onboarding.tsx` + `account-type.tsx` | `ab88c66` |
| Modo Neutro: `is_polarized` + badge + endpoint admin | `backend/server.py` + `frontend/src/components/PostCard.tsx` | `ab88c66` |
| Pasta `frontend/besord/` removida (conflito Expo Router) | — | `ab88c66` |
| `.metro-cache/` removida do git + `.gitignore` | `.gitignore` | `ab88c66` |

---

## ⚠️ Riscos Residuais Conhecidos

| Risco | Mitigação |
|---|---|
| Esforço cognitivo alto na primeira sessão | Onboarding como "ritual apetecível", não obrigação. Copy: "Tens 10 votos. Gasta-os bem." |
| D7 retention dos Fundadores pode ser artificialmente alta (perfil atípico) | Testar com 2º leva de 100 utilizadores menos seleccionados antes de escalar |
| Sincronia requer massa mínima de admiradores mútuos para funcionar | Activar só após ≥ 50 utilizadores activos com ≥ 3 admiradores mútuos em média |
| Relatório de Sincronia manual inicialmente | OK até ao 3º cliente. Automatizar na Fase 3. |

---

---

## 🛠️ Tarde — Implementação Técnica Fase 2 (11 Jun 2026)

### O que foi construído

| Feature | Ficheiros | Estado |
|---|---|---|
| **PostHog analytics** | `analytics.ts`, `_layout.tsx`, `server.py` | ✅ Live |
| **Endpoint `/veredito`** | `server.py` | ✅ Live |
| **VeredictCard.tsx** | `components/VeredictCard.tsx` | ✅ Live |
| **Overlay no feed** | `feed.tsx` — `showVeredito` state | ✅ Live |
| **Sincronia backend** | `server.py` — `calculate_sincronia()` + `GET /sincronia` | ✅ Deployed |
| **Groq insights** | `server.py` — `_groq_insight()` | ✅ Deployed |

### Decisões técnicas tomadas

- **PostHog região US** (não EU): conta criada em `us.posthog.com`. Código usa `https://us.i.posthog.com`. A chave está no Render (`POSTHOG_API_KEY`) e no Vercel (`EXPO_PUBLIC_POSTHOG_KEY`).
- **Groq em vez de Gemini**: Google AI Studio exigia cartão de crédito para activar quota. Groq oferece 14.400 req/dia grátis sem cartão. Modelo: `llama-3.1-8b-instant`.
- **Sincronia é assíncrona**: `asyncio.create_task()` — não bloqueia a resposta do voto. Corre em background após `remaining === 0`.
- **Sincronia só entre admiradores mútuos**: A e B têm de se admirar mutuamente E ambos completar sessão no mesmo dia (UTC). Resultado guardado em `sincronia_logs` com `pair_id` único por dia.
- **Share do VeredictCard**: usa `Share.share()` (texto + link). Captura como imagem (para Instagram Stories) adiada para Fase 3 — requer `react-native-view-shot`.
- **metro-cache removida do git**: 775 ficheiros eliminados do histórico, `frontend/.metro-cache/` adicionado ao `.gitignore`.

### Chaves e serviços configurados nesta sessão

| Serviço | Onde | Variável |
|---|---|---|
| PostHog | Render + Vercel | `POSTHOG_API_KEY` / `EXPO_PUBLIC_POSTHOG_KEY` |
| Groq | Render + `.env` local | `GROQ_API_KEY` |
| Resend | Já estava no Render | `RESEND_API_KEY` |
| Google OAuth | Já estava no Render | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| Stripe (test) | Já estava no Render | `STRIPE_API_KEY` |

### Commits desta sessão

| Hash | Descrição |
|---|---|
| `0cdfcc6` | feat: Fase 2 — VeredictCard, PostHog, limpeza metro-cache |
| `4d0d4f4` | fix: PostHog region EU → US |
| `77a2972` | feat: Sincronia — convergência admiradores mútuos + Groq insights |

### Pendente para próxima sessão

1. **Besord Primeiro Olhar** — tipo de evento B2B, PDF report (`reportlab`), endpoint admin
2. **Word of the Day** — endpoint `POST /api/editorial/word-of-day` + card no feed
3. **50 seed posts** — script `backend/scripts/seed_content.py`
4. **Push notifications Sincronia** — `expo-notifications` (quando ≥ 50 utilizadores activos)
5. **`eas update`** — OTA update para APK existente
6. **Testar besord.vercel.app** — validar VeredictCard + PostHog events em produção

---

> **Última actualização:** 11 Junho 2026 (tarde)
> **Próxima acção:** Besord Primeiro Olhar (2.4) → Word of the Day (2.5) → seed content
