# 📅 Sessão 16 Junho 2026 — Encerramento e Plano para Amanhã

> **Para quem retomar a sessão:** este documento é o ponto de entrada. Resume tudo o que aconteceu hoje, o que está confirmado a funcionar em produção, e exactamente onde parámos. Os outros documentos de hoje (`📅 Sessão 16 Junho — Estratégia e Plano Técnico`, `📋 Briefing 16 Junho — Sessão Técnica`) têm mais detalhe técnico por trás de cada decisão, mas este é o que dá o contexto e a sequência lógica.

---

## 1. Resumo do dia (ordem cronológica real)

Foi um dia com **duas frentes de trabalho em paralelo** — esta sessão (correções, segurança, branding, verificação) e outra sessão/ferramenta de IA que o Rodrigo usou directamente (Cloudinary + Curador Automático + B$). As duas convergiram no mesmo repositório várias vezes ao longo do dia. Por isso a ordem dos commits no GitHub mistura as duas frentes.

### Frente A — Correcções pré-Fase 3 (esta sessão)
- Render: ping automático (GitHub Actions) contra o cold-start do tier free
- Veredito: quando o utilizador não publica nada no dia, a IA infere palavra+imagem a partir dos votos
- Espelho de Sessão: tom mudou de 3ª pessoa fria ("Essa pessoa...") para "Você", e parou de cortar a frase a meio
- Eventos: botão "APAGAR EVENTO" (soft-delete), botão "PUBLICAR IMAGEM" (ecrã novo), correcção da extracção de cidade no `EventMapPicker`, correcção de duplo-submit ao criar evento
- Segurança: removidos segredos em texto simples (Expo Token, Stripe Webhook Secret) de 8 ficheiros de documentação — movidos para `frontend/.env`/`backend/.env` (git-ignored). **Risco residual aceite pelo Rodrigo:** os valores antigos continuam no histórico do Git; só rotar os segredos elimina isso por completo, e ele decidiu não fazer isso por agora.
- Tradução do ecrã de erro de autenticação (estava sempre em inglês, dependia da tradução automática do Chrome)
- Branding: logo novo (`NewBesord_free.png`) + cor petróleo (`#12343D`) aplicados em 6 ecrãs (feed, login, onboarding, conta, convite Fundador, VeredictCard); logo aumentado +50% depois de feedback de que estava pequeno
- Bug de navegação: ecrã "Minhas Empresas" sem saída quando aberto via redirect automático; utilizadores com empresa deixaram de ser forçados a abrir aí em vez do feed

### Frente B — Cloudinary + Curador Automático (sessão paralela, revista e corrigida por mim)
- Cloudinary: upload de imagens para CDN com fallback automático para base64 (`storage.py`) — **confirmado correcto**
- B$: +2 B$ ao votar com palavra em vez de +1 — **confirmado correcto**, e eu próprio corrigi um exploit que a mesma sessão tinha deixado passar (trocar de voto repetidamente gerava B$ ilimitado)
- Curador Automático: pipeline de 5 estágios para popular o mapa de eventos a partir de notícias do Google — **construído, mas com vários bugs que só foram aparecendo um a um ao longo da tarde** (ver Secção 3)

### Discussão de estratégia (sem código)
- Avaliámos uma proposta (de outra conversa com IA) de mudar o mercado primário do Besord para o Brasil (60-70%) e abandonar a filtragem temática de eventos. **Decisão do Rodrigo:** manter Lisboa como mercado de lançamento (ele está fisicamente lá, a angariação de Fundadores exige presença física); Brasil/Angola/Cabo Verde ficam registados como expansão futura, não acção imediata. Aceitou a parte tecnicamente correcta da proposta (não filtrar por tipo de evento na fonte).

---

## 2. O que está confirmado a funcionar em produção, agora

Testado directamente contra a API ao vivo (`besord-backend.onrender.com`), não só lido no código:

- ✅ Backend e frontend respondem normalmente (200 OK)
- ✅ `git log` local e `origin/main` perfeitamente sincronizados — nada perdido
- ✅ Vercel a fazer deploy automático com sucesso a cada push (confirmado via API do GitHub)
- ✅ `GET /api/events` devolve 11 eventos reais (10 seed + 1 evento de utilizador "Copa FIFA"), todos com `location` bem formado
- ✅ `GET /api/events/search?q=Lisboa` devolve 7 eventos — **corrigido hoje**, estava partido desde sempre (ver Secção 3)
- ✅ O Cron Job `besord-curador` no Render corre de ponta a ponta sem erro — **corrigido hoje**, depois de 3 causas diferentes (ver Secção 3)
- ✅ GitHub Actions activo no repositório (estava desligado, o Rodrigo activou)

---

## 3. A saga do Curador — 4 bugs, um a seguir ao outro

Vale registar esta sequência porque é um caso de estudo de "cada camada escondia a seguinte":

1. **Dependência em falta (`bs4`)** — o deploy do backend estava a falhar (`ModuleNotFoundError`) desde o commit que adicionou o enriquecimento de texto dos artigos. O Render mantinha sempre a versão anterior no ar, por isso nada parecia estar "em baixo" — mas nenhuma correcção do dia estava de facto live. Corrigido (`dcbd315`).
2. **Schema incompatível (`curator.py`)** — a função que insere eventos curados gravava `location` como texto simples em vez de objecto com coordenadas, e não tinha os campos `date`/`expires_at` que o resto da app exige. Resultado: mesmo inserindo eventos com sucesso, ficavam invisíveis em todos os lados. Corrigido (`24724c4`), testado isoladamente sem tocar na BD real.
3. **Bug de rotas (`/events/search`)** — `GET /api/events/{event_id}` estava registado antes de `GET /api/events/search` no FastAPI. Qualquer pesquisa por cidade era interpretada como "procura o evento com ID = 'search'", devolvia 404 sempre, nunca chegava ao código de pesquisa real. Isto **não tinha nada a ver com o Curador** — é um bug antigo que afectava qualquer pesquisa por cidade, mesmo com dados bons na BD. Corrigido (`747b2b2`), confirmado em produção (7 eventos em Lisboa).
4. **Configuração do Render (não é código)** — o Cron Job tinha "Auto-Deploy: Off", por isso corria sempre a imagem Docker mais antiga, sem nenhuma das correcções acima. E mesmo depois de activar o Auto-Deploy e reconstruir, o campo "Docker Command" tinha o URL entre aspas (`curl -X POST "https://..."`) — esse campo não passa por uma shell, por isso as aspas ficavam coladas ao URL literal e o `curl` rejeitava-o (`URL rejected: Port number was not a decimal`). O Rodrigo corrigiu os dois directamente no dashboard.

**Resultado depois dos 4 fixes:** o cron corre, chega ao backend, processa — mas devolveu `{"fetched":980,"extracted":3,"validated":0,"inserted":0,"queued":0,"rejected":80}`. Zero eventos novos inseridos.

---

## 4. Onde paramos — começar amanhã por aqui

### 4.1 Prioridade imediata — diagnosticar o yield 0% do Curador

Dos 80 candidatos processados nesta execução: só 3 tiveram um evento extraído pela IA com confiança suficiente, e **as 3 falharam a validação estrutural** (Estágio 3 — data no passado, cidade fora de Lisboa/Porto, spam, ou título/local demasiado curto). Não sabemos qual motivo exacto sem ver os logs.

**Próximo passo concreto:** o Rodrigo ia trazer os **Logs** (não os "Events") do serviço `besord-curador` no Render, à volta das 20:17 UTC, à procura das linhas `Rejeitado: ...` — essas têm o motivo exacto de cada uma das 3 tentativas. Ficou pendente quando a sessão foi interrompida.

Hipóteses a testar com esse log:
- Se for "Cidade fora de cobertura": a IA pode estar a extrair cidades vizinhas (Cascais, Almada, Matosinhos) em vez de "Lisboa"/"Porto" exactamente — pode precisar de normalização de cidade, não só comparação exacta.
- Se for "Data no passado": as notícias do Google News tendem a ser sobre eventos que já aconteceram (cobertura editorial pós-evento), não anúncios de eventos futuros — pode ser preciso ajustar as queries de pesquisa para termos mais prospectivos ("este fim de semana", "próxima semana") em vez de "hoje"/"esta semana" que também trazem recapitulações.
- Se for "Título/local demasiado curto": pode ser um problema de extracção da IA, não das fontes.

### 4.2 Outras pendências já identificadas (sem urgência)

| # | Item | Onde ver detalhe |
|---|---|---|
| 1 | Confirmar se o yield melhora depois do diagnóstico da Secção 4.1 | — |
| 2 | `migrate_images.py` (migração de posts antigos para Cloudinary) ainda não foi criado | `📋 Briefing 16 Junho`, Secção 9 |
| 3 | Constantes mortas em `curator.py` (`MAX_DAYS_FUTURE`, `MAX_FUTURE_DAYS_REVIEW`) — não usadas, podem confundir | `📋 Briefing 16 Junho`, Secção 2.3 |
| 4 | `event_type: "curated"` não está no `Literal` do `EventCreate` (irrelevante — eventos curados não passam pela API) | `📋 Briefing 16 Junho`, Secção 9 |
| 5 | **Achado novo, não corrigido:** `geocode_address()` é chamado em `POST /api/events` (linha ~2723 de `server.py`) mas **não existe definição nem import desta função em lado nenhum do backend** — se algum dia esse caminho de código for executado (evento criado com endereço mas sem lat/lon directos), vai dar `NameError`. Não verifiquei se já foi accionado em produção. |
| 6 | Risco residual de segredos antigos no histórico do Git (Secção "Frente A" acima) — só rotar os valores resolve, decisão pendente do Rodrigo |
| 7 | Fase 3 original continua pendente: `user_memory`, Espelho de Empatia completo, Printable Effect, Perception Forecast |

### 4.3 O que NÃO precisa de mais trabalho (já validado)
- Cloudinary, B$ com palavra, branding, navegação de "Minhas Empresas", tradução do ecrã de erro, segredos fora dos docs — todos confirmados e estáveis.

---

## 5. Commits de hoje (ordem cronológica completa)

```
73df128 fix: Render keep-alive, Veredito/Espelho humanizados, gestão e monetização de eventos
248b4b3 security: remove segredos em texto simples da documentação
ca72b21 fix: traduz ecrã de erro de autenticação (estava fixo em inglês)
fe0f47d feat: permite comentar palavra ao votar + bónus de BW
e00b69e fix: remove exploit de B$ ilimitado ao trocar de voto
8d45cb2 feat: novo logo + cor petróleo no cabeçalho do feed
4907b29 feat: uniformiza logo + cor petróleo no ecrã de tipo de conta
f16191b feat: uniformiza logo + cor petróleo no login e onboarding
53091fd feat: Cloudinary storage — upload de imagens para CDN
a947fe8 feat: aplica cor petróleo na marca do convite Fundador e VeredictCard
c467029 feat: Curador Automático — pipeline de 5 estágios para eventos
f929fbe fix: curator_router — remove async (não precisa, causava AttributeError no include_router)
1ea335b fix: adicionar MAX_SOURCE_EVENTS que faltava na config
6cadf62 refactor: curador agnóstico a temas, sensível a janelas curtas
85e23ed fix: adicionar curl ao Dockerfile (cron job Render)
439b014 fix: Dockerfile +curl, seed script com 10 eventos Lisboa/Porto
48a672b fix: sources.py fetch article text from linked URLs (Google News RSS vazio)
62fd61c fix: seed events schema matching API (image_base64, date, location nested, expires_at)
ab7d94a fix: ecrã Minhas Empresas sem saída quando aberto via redirect
517a7d7 fix: utilizadores com empresa entram sempre no feed, não em Minhas Empresas
dcbd315 fix: adiciona beautifulsoup4 ao requirements.txt (deploy crashava no Render)
ce778b4 docs: verifica e corrige Briefing 16 Junho — Cloudinary + Curador
24724c4 fix: schema dos eventos curados incompatível com GET /api/events e /nearby
a0e3c1f feat: aumenta logo ao lado de BESORD em +50% (feed e onboarding)
747b2b2 fix: GET /api/events/search nunca era alcançado (ordem de rotas)
```

Mais 2 alterações feitas directamente no dashboard do Render (não em código): `besord-curador` → Auto-Deploy ligado, e campo "Docker Command" sem aspas à volta do URL.

---

## 6. Nota sobre o processo desta sessão

Houve várias vezes hoje em que a documentação escrita (pela outra sessão de IA) descrevia algo como "implementado e a funcionar" e a verificação directa contra o código/produção mostrou que não estava. Isto não é um problema de uma sessão específica — é o motivo para continuar a verificar contra o código real antes de aceitar um relatório como verdade, mesmo quando o relatório é bem escrito e detalhado. Vale manter este hábito nas próximas sessões.

---

> **Data:** 16 Junho 2026, encerrada ~21h
> **Estado:** Sessão fechada a meio do diagnóstico do yield do Curador — falta ver os logs do Render
> **Próxima sessão:** começar pela Secção 4.1 deste documento
