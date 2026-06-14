# ⚙️ Regras de Negócio
## Actualizado: 14 Junho 2026

---

## ⏱️ Time-Gate (NOVO)

### O mecanismo mais importante do produto

| Regra | Valor |
|---|---|
| **Limite diário** | 10 interacções por utilizador |
| **Reset** | Meia-noite UTC |
| **Mensagem de encerramento** | *"O mundo já te deu o suficiente por hoje. Vá viver."* |
| **O que conta como interacção** | Voto (Aprovo/Desaprovo) |
| **O que não conta** | Navegar, ver perfis, abrir eventos |

**Porquê é imutável**: sem Time-Gate, o Besord é um feed qualquer. Com Time-Gate, cada interacção tem peso real — para o utilizador e para os dados B2B.

---

## 🪙 B$ (Besord Coins) — Actualizado

### Como se acumula B$
| Acção | B$ ganho |
|---|---|
| Votar (Aprovo/Desaprovo) | +1 B$ |
| Best Word do dia (mais votada) | +5 B$ (bónus Word of the Day) |
| Check-in em evento | +2 B$ |
| Publicação recebe 10+ votos | +3 B$ |
| Completar sessão diária (10 interacções) | +2 B$ |

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

## 💼 Besord Primeiro Olhar — Produto B2B (NOVO — 11 Jun 2026)

### O que é
Evento B2B simplificado de 48 horas. Uma marca sobe 5 imagens, a comunidade Besord vota e escolhe palavras, a marca recebe o Relatório de Sincronia.

### Regras
- Duração fixa: 48 horas
- Máximo 5 imagens por evento
- Sem mapa, sem QR code, sem check-in físico — apenas link directo
- Criado pelo admin (semi-manual inicialmente)
- Relatório entregue em PDF por email

### Conteúdo do Relatório de Sincronia — Primeiro Olhar
1. Imagem com maior taxa de aprovação
2. Top 10 palavras escolhidas pela comunidade
3. **Diagnóstico de desalinhamento** — palavra pretendida pela marca vs. palavra escolhida pelo público
4. Distribuição geográfica dos votantes

O diagnóstico de desalinhamento é a linha que fecha a venda:
> *"A marca pretendia transmitir 'Inovação'. O público respondeu 'Complexo'. Desalinhamento de 73%."*

### Tabela de preços aprovada (11 Jun 2026)
| Produto | Preço | Condição |
|---|---|---|
| Primeiro Olhar — 1º cliente | **€500** | Troca por testemunho escrito + autorização dados anónimos |
| Primeiro Olhar — 2º–3º cliente | **€1.200** | Com case study do 1º cliente |
| Evento Singular completo | **€2.500** | Com dashboard Sincronia Reports |
| Evento Plural (por expositor) | **€800/slot** | Feiras, congressos |

### Argumento de venda
> *"Focus group tradicional: €5.000–€20.000, 3 semanas. Besord Primeiro Olhar: €800, 48 horas, com público que foi forçado a pensar."*

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

## 🗓️ Eventos — 3 Tipos (ACTUALIZADO)

### Tipo 1 — Evento Pessoal ("O Clube de Sentido")
| Regra | Valor |
|---|---|
| **Quem cria** | Utilizador com ≥ 1.000 B$ |
| **Financiamento** | Empresas patrocinam em faixas (Bronze/Prata/Ouro) |
| **Split de receita** | 70-80% para o criador / 20-30% para o Besord |
| **Condição de repasse** | Evento concluído + Relatório de Sincronia entregue |
| **Sistema de escrow** | Besord retém o pagamento até condições cumpridas |

### Tipo 2 — Evento Empresarial Singular ("O Espaço de Imersão")
| Regra | Valor |
|---|---|
| **Quem cria** | Empresa |
| **Modelo de pagamento** | Por slots de posts/sorteios |
| **Qualificação para sorteio** | Voto + permanência mínima de 5 segundos |
| **Relatório** | Sincronia Report entregue após conclusão |
| **Receita** | 100% Besord |

### Tipo 3 — Evento Empresarial Plural ("O Ecossistema Avalizado")
| Regra | Valor |
|---|---|
| **Quem cria** | Promotor (feira, congresso) |
| **Modelo de pagamento** | Múltiplas empresas expositoras pagam slots |
| **Relatório do promotor** | Apenas se o evento gerou receita de anúncios |
| **Relatório por empresa** | Individual, independente do promotor |
| **Receita** | 100% Besord |

### Regras Gerais de Eventos
- **Check-in físico**: raio máximo de 2km da localização do evento
- **QR Code**: gerado automaticamente no momento da criação
- **Barra de progresso**: visível para todos os participantes
- **Sorteio**: participantes = todos os votantes (Aprovo + Desaprovo)
- **Fluxo de criação B2B**: máximo 4 passos, máximo 3 minutos

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

## 🏢 Campanhas de Empresa (Actualizado)

### Faixas para Eventos (substituem tiers antigos de campanha)
| Faixa | Inclui |
|---|---|
| **Bronze** | Slot básico de post num evento |
| **Prata** | Post + destaque no mapa + notificação regional |
| **Ouro** | Post + destaque + Relatório de Sincronia completo |

### Relatório de Sincronia (NOVO — Fase 4)
- Nuvem de palavras dos votantes
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
