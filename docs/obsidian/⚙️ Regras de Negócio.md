# ⚙️ Regras de Negócio
## Actualizado: 10 Junho 2026

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

## 🤖 Espelho de Empatia — IA (NOVO)

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
