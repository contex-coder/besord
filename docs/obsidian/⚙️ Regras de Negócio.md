# ⚙️ Regras de Negócio
## Actualizado: 16 Junho 2026

---

## ⏱️ Time-Gate (NOVO)

### O mecanismo mais importante do produto

| Regra | Valor |
|---|---|
| **Limite diário** | 10 interacções por utilizador |
| **Reset** | Meia-noite UTC |
| **Mensagem de encerramento** | *"O mundo ainda tem muito para lhe dar e podes sair para encontrar ainda hoje."* |
| **O que conta como interacção** | Voto (Aprovo/Desaprovo) |
| **O que não conta** | Navegar, ver perfis, abrir eventos |

**Porquê é imutável**: sem Time-Gate, o Besord é um feed qualquer. Com Time-Gate, cada interacção tem peso real — para o utilizador e para os dados B2B.

---

## 🪙 B$ (Besord Coins) — Actualizado (16 Jun 2026)

### Como se acumula B$
| Acção | B$ ganho |
|---|---|
| Votar (Aprovo/Desaprovo) | +1 B$ |
| Votar **e** comentar uma palavra (Best Word) no mesmo gesto | +2 B$ |
| Best Word do dia (mais votada) | +5 B$ (bónus Word of the Day) |
| Check-in em evento | +2 B$ |
| Publicação recebe 10+ votos | +3 B$ |
| Completar sessão diária (10 interacções) | +2 B$ |

**Porquê o bónus de comentar palavra:** comentar uma palavra ao votar é o gesto que gera o activo de dados central do produto (Daily Active Words, palavras mais comentadas nos dashboards de campanha e no diagnóstico do Primeiro Olhar). O bónus incentiva esse gesto sem criar uma acção nova — acontece no mesmo voto.

**Regra anti-exploit:** o B$ só é pago no voto **novo** num post (1ª vez que esse utilizador vota nesse post). Trocar de voto (Aprovo↔Desaprovo) no mesmo post **não** paga B$ de novo — é a mesma interacção, só mudou de sentido, e não consome Time-Gate. Sem esta regra, trocar de voto repetidamente geraria B$ ilimitado.

### Limiar para criar Evento Pessoal
- **≥ 1.000 B$** — meritocracia cognitiva — garante que só utilizadores engajados criam eventos
- Evita spam de eventos sem audiência

### O que fazer com B$ (a definir em Fase 4)
- Acesso a faixas de patrocínio mais baratas
- Descontos em eventos premium
- Templates premium para Printable Card

---

## ✨ Espelho de Sessão Simplificado (NOVO — 14 Jun 2026)

> Movido da Fase 3 para Fase 2. Versão sem user_memory — usa apenas dados da sessão do dia.
> **Justificativa:** O produto precisa de valor solitário. Este é o único elemento que funciona com um único utilizador.

### Regras
- **Activação:** Automática, no fim de cada sessão (quando Time-Gate atinge 10 interacções)
- **Input:** Dados da sessão actual — palavras dos posts votados, taxa de aprovação, tema dominante
- **Output:** 1–2 frases geradas por Groq (llama-3.1-8b-instant), tom estoico
- **Visibilidade:** Exibido no ecrã de encerramento de sessão, abaixo de "O mundo já te deu o suficiente"
- **Fallback:** Se Groq falhar — silêncio. Nunca mostrar mensagem de erro ao utilizador.
- **Privacidade:** Análise é privada. Utilizador pode partilhar se quiser (via VeredictCard).

### Tom obrigatório
Igual ao Espelho de Empatia completo:
> Analista comportamental estoico. Máximo 2 frases. Directo. Sem sentimentalismo. Foca em contradições ou padrões. Nunca usa: "jornada", "luz", "coração", "bem-estar", "caminho".

### Diferença em relação ao Espelho de Empatia completo (Fase 3)
| | Espelho de Sessão (Fase 2) | Espelho de Empatia (Fase 3) |
|---|---|---|
| Input | Apenas sessão do dia | Sessão + user_memory (histórico 30 sessões) |
| Padrões detectados | Não | Sim (≥ 5 sessões) |
| Arquétipo comportamental | Não | Sim |
| Custo Groq | 1 req/sessão | 1 req/sessão |

---

## 🤖 Espelho de Empatia — IA (Fase 3)

### Regras
- **Activação**: opcional, pelo utilizador, no fim da sessão diária
- **Timing**: apenas após atingir o Time-Gate (10 interacções)
- **Frequência**: máximo 1 análise por dia por utilizador
- **Privacidade**: análise é privada e criptografada — nunca partilhada automaticamente

### Tom obrigatório do insight
> Analista comportamental estoico. Máximo 3 frases. Directo. Sem sentimentalismo. Foca em contradições lógicas ou padrões de valor. Nunca usa: "jornada", "luz", "coração", "bem-estar".

### Arquitectura de Memória
- `user_memory` collection — actualizada após cada sessão
- `personality_snapshot` — compacto, max 500 chars — é o que vai para a IA
- Histórico de 30 sessões guardado
- `ai_summary` — resumo evolutivo gerado pela IA, actualizado semanalmente

---

## 📊 Métricas e Analytics (NOVO — 11 Jun 2026)

### North Star Metric
> **Daily Active Words** — número de palavras únicas publicadas por dia.

Captura actividade real, qualidade do asset de dados e saúde do produto.

### Thresholds de decisão
| Métrica | Verde | Amarelo | Vermelho |
|---|---|---|---|
| Retenção D7 | ≥ 35% | 20–35% | < 20% |
| Taxa de partilha Veredito | ≥ 25% | 10–25% | < 10% |
| Abertura notif. Sincronia | ≥ 40% | 25–40% | < 25% |
| Conversão brand manager → Primeiro Olhar | ≥ 1/3 | 1/5 | 0 |

**Regra:** abaixo de 35% de retenção D7, não escalar. Resolver o produto primeiro.

**Ferramenta:** PostHog (open source, self-hosted no Render, custo €0)

---

## 🃏 Veredito Card (NOVO — 11 Jun 2026)

### O que é
Card visual gerado automaticamente quando o Time-Gate fecha (10 interacções atingidas). Partilhável para Instagram Stories e WhatsApp Status.

### Conteúdo
- Palavra publicada pelo utilizador nesse dia
- Taxa de aprovação que a palavra recebeu
- Tema dominante nos votos do utilizador
- Data + marca Besord

### Regras
- Gerado **sempre** que o Time-Gate fecha — não é opcional
- Mostrado no ecrã de encerramento de sessão
- Utilizador pode escolher partilhar ou fechar
- Design: Neo-Brutalist puro, preto/branco, sem gradientes

### Porquê existe
É o mecanismo de crescimento orgânico. Alguém que partilha o card convida implicitamente amigos ao criar FOMO: "Como sabes a tua palavra de hoje?"

---

## 🔔 Sincronia (NOVO — 11 Jun 2026)

### O que é
Quando dois utilizadores que se admiram mutuamente completam a sessão no mesmo dia, o sistema compara os seus padrões de voto e notifica ambos.

### Tipos de resultado
| Tipo | Condição | Mensagem |
|---|---|---|
| Convergência | ≥ 6 votos iguais em 10 | *"Tu e [Nome] estiveram em sincronia hoje."* |
| Divergência | ≥ 7 votos opostos em 10 | *"Tu e [Nome] viram o mundo de forma completamente diferente hoje."* |
| Neutro | Entre 4–6 coincidências | Sem notificação |

### Condições de activação
- Apenas entre admiradores **mútuos** (ambos se admiram)
- Ambos completaram sessão (10 votos) no mesmo dia UTC
- Máximo 3 notificações Sincronia por dia por utilizador
- Activar apenas quando ≥ 50 utilizadores activos com ≥ 3 admiradores mútuos em média

### Porquê existe
Esta notificação leva o utilizador a falar ao amigo fora da app (WhatsApp). Essa conversa privada converte em novos utilizadores mais do que qualquer story público.

---

## 💼 Besord Primeiro Olhar — Produto B2B (ACTUALIZADO — 15 Jun 2026)

### O que é
Evento B2B simplificado de 48 horas. Uma marca sobe 5 imagens, a comunidade Besord vota e escolhe palavras, a marca recebe o Relatório de Sincronia com **diagnóstico de desalinhamento gerado por IA**.

### Regras
- Duração fixa: 48 horas
- Máximo 5 imagens por evento
- Sem mapa, sem QR code, sem check-in físico — apenas link directo
- Criado pelo admin (semi-manual, venda feita por Rodrigo directamente)
- Relatório entregue via página web partilhável (URL única) — PDF em Fase 4

### Conteúdo do Relatório de Sincronia — Primeiro Olhar
1. Imagem com maior taxa de aprovação
2. Top 10 palavras escolhidas pela comunidade (agregadas de todos os comentários)
3. **Diagnóstico de desalinhamento** — gerado por Groq comparando `brand_intended_word` (palavra que a marca pretendia transmitir) com as palavras mais votadas pelo público
4. Distribuição geográfica dos votantes

O diagnóstico de desalinhamento é **o argumento de venda central** e **obrigatório** no relatório:
> *"A marca pretendia transmitir 'Inovação'. O público respondeu 'Complexo'. Desalinhamento de 73%."*

### Tabela de preços aprovada (15 Jun 2026)
| Produto | Preço | Condição |
|---|---|---|
| Primeiro Olhar — 1.º cliente | **€79,90** | Troca por testemunho escrito + autorização dados anónimos |
| Primeiro Olhar — sessão avulso | **€149** | Sem case study (clientes recorrentes) |
| Primeiro Olhar — 2.º–3.º cliente | **€299** | Com case study do 1.º cliente |

### Argumento de venda
> *"Focus group tradicional: €5.000–€20.000, 3 semanas. Besord Primeiro Olhar: €79,90, 48 horas, com público que foi forçado a pensar."*

### Estratégia de lançamento
1. Vender 1.º cliente a €79,90 → obter testemunho
2. Usar testemunho para vender 2.º e 3.º clientes a €299
3. Usar case study para justificar sessão avulso a €149
4. Após 3 clientes: self-serve na app (Fase 4)

---

## 🏷️ Sistema de Convite Fundador (NOVO — 14 Jun 2026)

### O que é
Sistema de código de convite com badge permanente e página de entrada exclusiva. Tracking de origem de cada Fundador.

### Regras
- Cada Fundador recebe um **código único** para partilhar
- Utilizador que entra via código recebe badge permanente "Fundador #N" no perfil (número sequencial, 1–100)
- Badge é visível mesmo quando a plataforma tiver 1 milhão de utilizadores
- Fundadores são os primeiros 100 utilizadores com código válido

### Fluxo de entrada
1. Rodrigo gera código via endpoint admin: `POST /api/founders/invite`
2. Rodrigo partilha o código por mensagem pessoal
3. Convidado acede a `besord://fundador/{code}` ou `/fundador/{code}` na web
4. Página mostra: "Foste convidado por [Nome]. Entras como Fundador #47 de 100."
5. Convidado faz registo normal — badge é atribuído automaticamente

### Dados guardados
- `founder_invites`: `{ code, invited_by_user_id, used_by_user_id, used_at, founder_number }`
- Campo em `users`: `founder_number: int | null`

### Porquê esta regra existe
"100 convites pessoais" sem mecanismo é uma intenção. "Fundador #47" com badge permanente é identidade. O Facebook começou em Harvard com este princípio de exclusividade percebida.

---

## 👥 Estratégia dos 100 Fundadores — ACTUALIZADA (14 Jun 2026)

> **Decisão de 14 Jun 2026:** Em vez de 100 indivíduos dispersos, seleccionar 4–6 grupos sociais densos.
> **Justificativa:** A Sincronia precisa de density social. Dois desconhecidos raramente se admiram mutuamente na primeira semana. Dentro de um grupo existente, a Sincronia activa-se desde o Dia 1 — como o Facebook começou em Harvard.

### Conceito
100 convites pessoais (não link público), organizados em **grupos sociais existentes** — não indivíduos dispersos.

### Grupos alvo (nova estrutura)
| Grupo | Qtd | Quem | Porquê funciona |
|---|---|---|---|
| 1 agência de publicidade Lisboa | 15–20 | Equipa criativa que já se conhece | Sincronia activa Dia 1 |
| 1 grupo fotógrafos/directores criativos | 10–15 | Profissionais com estética similar | Admiram-se naturalmente |
| 1 grupo copywriters (LinkedIn/WhatsApp) | 10–15 | Profissionais da palavra | Produto ressoa directamente com o trabalho deles |
| 1 turma mestrado design/comunicação | 15–20 | Estudantes avançados | Densidade social máxima |
| 1 redacção revista ou media cultural | 10–15 | Editores, jornalistas culturais | Perfil C (futuro cliente B2B) |

### Perfis individuais (mantidos para convites fora de grupos)
| Perfil | Qtd | Quem | Canal |
|---|---|---|---|
| A — Criativos | 40 | Copywriters e directores criativos | LinkedIn + grupos WhatsApp publicidade |
| B — Criadores | 30 | Criadores 2k–30k seguidores, estética conceptual | Instagram DM |
| C — Brand Managers | 30 | Gestores de marcas moda/design/cultura | LinkedIn + referências Perfil A |

O Perfil C é simultaneamente utilizador e futuro cliente B2B.

### Mensagem de convite
> *"Estamos a criar a única app que te dá 10 votos por dia — e depois fecha. Não é para toda a gente. Achei que eras das pessoas certas para os primeiros 100. Queres ser fundador?"*

---

## 🗓️ Eventos — 3 Tipos (ACTUALIZADO — 15 Jun 2026)

### Tipo 1 — Evento Pessoal ("O Clube de Sentido")

**Quem pode criar:** utilizador com ≥ 1.000 B$ (meritocracia cognitiva — garante audiência mínima)

**Criação:** gratuita.

**Feed exclusivo do evento:**
- O criador publica até **30 imagens de portfolio** no feed do evento
- Cada imagem recebe: comentário de uma palavra (Best Word) + Aprovo/Desaprovo — mecânica idêntica ao feed global
- O feed do evento aparece no feed de quem segue/admira o criador como um **card de evento único** (não como 30 posts individuais), com scroll horizontal de prévia das últimas imagens
- Toque no card → entra no feed exclusivo do evento

**Duração:** 1 a 7 dias, à escolha do criador.

**Sorteio:** opcional — o criador decide se associa um item a um sorteio no fim do evento.

**Patrocínios:** opcionais — o criador pode aceitar patrocínios de empresas em 3 faixas:
| Faixa | Inclui |
|---|---|
| Bronze | Slot básico de imagem no feed do evento |
| Prata | Slot + destaque no card do feed |
| Ouro | Slot + destaque + Relatório de Sincronia individual |

**Revenue split (quando há patrocínios):** 70–80% para o criador / 20–30% para o Besord. Besord retém em escrow até evento concluído.

**Check-in:** raio máximo de 2 km da localização declarada.

---

### Tipo 2 — Evento Empresarial Singular ("O Espaço de Imersão")

**Quem pode criar:** empresa com workspace activo.

**Criação:** **gratuita** — a empresa cria o evento sem pagar nada.

**Monetização por publicação de imagem:**
| Opção | Preço |
|---|---|
| 1 publicação avulso | €9,99 |
| Pacote de 10 publicações | €49,99 (**poupa 50%**) — **opção recomendada** |

- Cada publicação de imagem = mecânica de Best Word + Aprovo/Desaprovo para o público do evento
- Cada publicação dá direito a associar 1 item de sorteio (opcional, à escolha da empresa)
- Sem publicações, o evento não tem conteúdo — a criação gratuita é o gancho de entrada

**Duração:** até 7 dias.

**Relatório de Sincronia:** entregue automaticamente ao final do evento (ver secção [[Relatório de Sincronia]]).

**Receita:** 100% Besord.

---

### Tipo 3 — Evento Empresarial Plural ("O Ecossistema Avalizado")

**Quem cria:** promotor (feira, congresso, festival).

**Criação:** gratuita para o promotor.

**Empresas expositoras:**
- Cada empresa entra como expositora via botão "ENTRAR COMO EXPOSITOR" no detalhe do evento
- Cada expositora paga as suas publicações independentemente: €9,99/imagem ou pacote de 10 por €49,99
- Cada publicação pode ter item de sorteio associado (opcional)
- Relatório de Sincronia individual por empresa ao final

**Relatório do promotor:** agregado de todos os expositores, disponível se o evento gerou receita de anúncios.

**Receita:** 100% Besord.

---

### Regras Gerais de Eventos
- **Check-in físico**: raio máximo de 2 km da localização do evento
- **QR Code**: gerado automaticamente no momento da criação
- **Barra de progresso**: visível para todos os participantes
- **Sorteio**: participantes elegíveis = todos que fizeram check-in (ou, quando sem check-in, todos que votaram)
- **Fluxo de criação**: máximo 3 passos, máximo 3 minutos
- **Feed de evento no feed global**: aparece como card único (não posts individuais) — evita saturação

---

## ☁️ Cloudinary — Armazenamento de Imagens (16 Jun 2026)

### Regras
- Todas as imagens enviadas via app são automaticamente transferidas para Cloudinary CDN
- URL Cloudinary (`image_url`) é o campo preferencial sobre `image_base64`
- Se Cloudinary não estiver configurado (variáveis de ambiente em falta), fallback automático para `image_base64` — sem quebra
- Upload acontece no momento da criação: posts, campanhas e eventos
- `serialize_post()` prefere `image_url` quando disponível
- Imagens servidas via CDN global (200+ edge locations) com compressão automática

### Configuração
| Variável | Descrição |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Nome da cloud (`ddr3zepsy`) |
| `CLOUDINARY_API_KEY` | API Key do dashboard |
| `CLOUDINARY_API_SECRET` | API Secret do dashboard |

### Porquê esta regra existe
- MongoDB M0 (512MB) não comporta imagens em base64 a longo prazo
- Cada post em base64 ocupava ~500KB; em CDN ocupa ~200 bytes (URL)
- Cloudinary free tier: 25GB storage, 25 créditos/mês — suficiente para o Besord

---

## 🤖 Curador Automático — Pipeline de 5 Estágios (16 Jun 2026)

### Regras
- **Fontes whitelist**: 15 queries Google News RSS — NUNCA crawling aberto
- **Cidades cobertas**: Lisboa e Porto
- **Frequência**: executa 2×/dia (cron job Render, 9h e 21h Lisboa)
- **Collection**: eventos curados vão para a MESMA collection `events` que eventos de utilizadores
- **Identificação**: `event_type: "curated"`, `source: "curator_ai"`, campos `curator_confidence`, `curator_source_url`, `curator_source_type`

### Pipeline

| Estágio | O que faz | Thresholds |
|---|---|---|
| **1. FETCH** | Google News RSS → ~500 raw events → dedup → 80 amostra | `MAX_SOURCE_EVENTS=80` |
| **2. EXTRACT** | Groq `llama-3.1-8b-instant` extrai {title, date, location, city, theme, confidence} | `MIN_CONFIDENCE_REVIEW=50` |
| **3. VALIDATE** | Python: data passada, cidade fora cobertura, spam, título/location vazios | Apenas estruturais — NUNCA por tipo |
| **4. IMAGE** | Pillow: >=400x400, proporção < 1:3 | Sem imagem -> evento entra sem capa |
| **5. REVIEW** | Confiança + janela temporal -> insere ou queue | Ver tabela abaixo |

### Stage 5 — Decisão por janela temporal

| Janela | Confiança necessária | Destino |
|---|---|---|
| 0–7 dias (urgente) | >= 60 (com +10 bónus de urgência) | Insere direto |
| 8–60 dias | >= 70 | Insere direto |
| > 60 dias | Qualquer | Fila de revisão |
| 50–69 (q.q. janela) | — | Fila de revisão |

### Fila de Revisão (`event_queue`)
- Eventos com confiança média ou data distante vão para `event_queue`
- Admin revê via `/api/admin/event-queue` (aprova/rejeita)
- Itens expiram em 48h se não revistos (TTL index)

### Princípio
- **NÃO se filtra por tipo de evento** (música, teatro, desporto, etc.)
- Qualquer evento com pessoas + telemóveis é matéria-prima
- O Groq extrai o primeiro evento concreto mesmo de artigos de compilação/agenda
- A validação estrutural (Stage 3) é a única barreira — nunca por categoria

### Fontes futuras (Fase 4+)
- Sympla API (Brasil) — expansão geográfica
- Eventbrite API (Portugal) — fonte estruturada adicional
- RSS Angola e Cabo Verde — expansão PALOP

### Porquê esta regra existe
- O Besord é passivo: espera que alguém crie um evento. Se ninguém cria, o mapa está vazio
- O curador resolve o problema do ovo e da galinha (eventos vs. utilizadores)
- Eventos curados convivem com eventos de utilizadores — mesma collection, mesmo mapa, mesmas mecânicas

---

## 🎲 Sorteios

### Regras
- Apenas posts/eventos com campo `prize` preenchido têm sorteio
- Para sorteios de alto valor: utilizador precisa votar em ≥ 3 posts do evento
- Rate limiting: 1 vitória por utilizador por evento
- Vencedor recebe notificação in-app + email

---

## 📣 Word of the Day (NOVO)

### Regras
- Publicado diariamente pela conta admin @besord
- Aparece no topo do feed com destaque visual especial
- Qualquer utilizador pode votar
- Utilizador com Best Word mais votada às 23:59 UTC recebe +5 B$
- Gera razão diária para abrir o app

---

## 🔇 Modo Neutro (NOVO)

### Quando activar
- Conteúdo de temas polémicos (detecção manual inicialmente, IA em Fase 3)
- Imagens associadas a temas políticos ou de alta polarização

### O que muda
- Secção de comentários desactivada
- Só Aprovo/Desaprovo visíveis
- Badge: "Modo Neutro — Só percepções aqui."
- Utilizador vê % de aprovação global mas não os comentários individuais

---

## 👥 Admiradores vs. Estilos (Actualizado)

### Sistema de Admiradores (user → user) — NOVO
- Utilizador pode "Admirar" outro utilizador
- Cria feed dedicado "Admirados"
- Métricas desenfatizadas: contagem só visível ao entrar no perfil
- Notificação quando alguém te admira

### Sistema de Estilos/Hypes (tema → utilizador)
- Utilizador pode seguir Hypes (temas)
- Feed calibrado com publicações do Hype seguido
- Independente e complementar ao sistema de Admiradores

### Word Links — NOVO
- Clicar numa palavra em qualquer publicação abre feed filtrado por essa palavra
- Palavras são navegáveis em toda a app

### Sintonizados — Fase 4
- 2º nível de conexão baseado em afinidade algorítmica
- Sugerido pela IA com base em personality_snapshot similar

---

## 🏢 Campanhas de Empresa — Palavra Patrocinada (Actualizado — 15 Jun 2026)

### O que é
A empresa escolhe uma palavra e uma imagem. O post patrocinado aparece no feed dos utilizadores com filtro geográfico. Os utilizadores votam (Aprovo/Desaprovo) **e comentam com uma palavra** — exactamente como nos posts normais.

### Dashboard da campanha (obrigatório)
| Métrica | O que mostra |
|---|---|
| Votos totais | Número total de interacções |
| Taxa de aprovação | % Aprovo |
| Alcance estimado | Utilizadores únicos que viram o post |
| **Palavras mais comentadas** | Top 5 palavras de quem aprovou + top 5 de quem desaprovou |

As **palavras mais comentadas** são o diferenciador central vs. Google/Meta Ads. Exemplo:
> "68% aprovaram. Palavras de quem aprovou: CONFIANÇA, FUTURO, QUALIDADE. Palavras de quem desaprovou: CARO, DISTANTE, GENÉRICO."

### Faixas geográficas
| Faixa | Scope | Preço |
|---|---|---|
| Local | Cidade | Conforme `pricing.py` |
| Regional | Região | Conforme `pricing.py` |
| Nacional | País | Conforme `pricing.py` |
| Global | Mundial | Conforme `pricing.py` |

### Relatório de Sincronia completo (Fase 4)
- Nuvem de palavras visual dos votantes
- Índice de sentimento: % aprovação + palavras dominantes
- Heatmap geolocalizado de votos
- Diagnóstico de alinhamento de percepção

---

## 👤 Autenticação

| Método | Estado |
|---|---|
| Google OAuth | ✅ |
| Apple Sign In | ✅ (obrigatório iOS) |
| Email + Password | ✅ |

### Admin
- Email: `rodrigocontecunha@gmail.com`

---

## 📧 Notificações

### Eventos que geram notificação
- Alguém te admirou (NOVO)
- Alguém votou na tua publicação
- A tua Best Word foi a mais votada hoje (NOVO — Word of the Day)
- Evento abre perto de ti (NOVO)
- Campanha atingiu milestone (50%, 100%)
- Ganhaste um sorteio
- Espelho de Empatia disponível (NOVO)
