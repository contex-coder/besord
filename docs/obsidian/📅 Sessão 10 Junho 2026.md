# 📅 Sessão 10 Junho 2026 — CTO onboarding & Fase 0

## 👤 Contexto

Primeira sessão com assistente a assumir papel de **CTO/dev senior**. O fundador (Rodrigo, leigo) estudou o projecto completo e definiu um plano de acção de 4 fases baseado no ficheiro `visao_reinventada`.

---

## 🔍 O que foi estudado

- Toda a vault Obsidian (11 ficheiros)
- Ficheiro `visao_reinventada` — reposicionamento do produto
- Estrutura completa do frontend (React Native / Expo Router)
- Backend (FastAPI / server.py ~2000 linhas)
- Configuração EAS, Render, Stripe, MongoDB

---

## 🛠️ O que foi corrigido (Fase 0)

### 1. `perfil.tsx` — Ecrã de perfil estava completamente quebrado
- **Problema:** O ficheiro `frontend/src/app/(tabs)/perfil.tsx` tinha sido acidentalmente substituído pelo conteúdo do `AuthContext.tsx` (modificado em 10/jun às 10:15)
- **Efeito:** Tab de Perfil estava em branco — sem `export default`
- **Fix:** Restaurado do git (commit `12463f8`)
- ✅ **Corrigido** — commit `bc23bcd`

### 2. `index.tsx` — Race condition na navegação
- **Problema:** `useEffect` disparava múltiplas vezes sempre que `user` mudava (ex: após `refreshUser()` no age-gate), podendo sobrepor redirects e prender utilizador no ecrã errado
- **Problema secundário:** Usava `user.age_confirmed` mas o campo correcto é `user.age_confirmed_at`
- **Problema terciário:** Não verificava se onboarding foi concluído antes de ir para `/account-type`
- **Fix:** `useRef(hasNavigated)` para disparar uma única vez + check `age_confirmed_at` + check `besord_onboarded` em storage
- ✅ **Corrigido** — commit `bc23bcd`

### 3. `theme.ts` — iOS não renderizava as sombras brutalShadow
- **Problema:** `shadowRadius: 0` faz o iOS não renderizar qualquer sombra (comportamento documentado)
- **Fix:** `shadowRadius: 0.5` — imperceptível visualmente mas iOS aceita e renderiza
- ✅ **Corrigido** — commit `bc23bcd`

### 4. `STRIPE_WEBHOOK_SECRET` — Webhook sem segurança em produção
- **Problema:** Variável não estava definida no Render → qualquer request era aceite sem verificação de assinatura → alguém poderia simular pagamentos falsos
- **Confirmação:** Teste com assinatura inválida retornou `200 {"ok":true}` antes do fix
- **Fix:** Adicionado `whsec_1cThiKZTKfxIlPMlrdiLQVq5xNycMUKa` via Render API
- **Verificação:** Após redeploy, mesma request retorna `400 {"detail":"Invalid signature"}` ✅
- ✅ **Corrigido** — via Render API, redeploy `dep-d8klrfn7f7vs73e04ndg`

### 5. EAS Build — Setup para APK Android
- **Contexto:** Não existia forma de o fundador testar a app no telemóvel sem WiFi partilhada e sem tunnel (ngrok exige auth desde 2024)
- **Fix:** Criado `frontend/eas.json` com perfil `preview` (APK directo) e `production` (AAB para Play Store)
- **Conta Expo:** `expo.dev/accounts/besord` — projecto `@besord/besord` (ID: `83893be0-ae4d-43a8-837d-dbd441193fef`)
- **Android package:** `com.besord.app` (adicionado a `app.json`)
- **Problema no build 1:** `engines.node: "24.x"` — EAS não suporta Node 24 → corrigido para `>=20.0.0`
- **Build 2 em curso:** `3dcad0df-27e0-4198-b8df-4efcd91b7432` — aguardar APK

---

## 🔑 Credenciais e IDs importantes (descobertos nesta sessão)

| Recurso | Valor |
|---|---|
| Render Service ID | `srv-d8fd8areo5us73bpep9g` |
| Render API Key | `rnd_BMJv2XXNp3QTLzkzpgUiZus10FQY` |
| Expo Robot Token | `wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd` |
| Expo Project ID | `83893be0-ae4d-43a8-837d-dbd441193fef` |
| Android Package | `com.besord.app` |
| Stripe Webhook Secret (prod) | `whsec_1cThiKZTKfxIlPMlrdiLQVq5xNycMUKa` |

> ⚠️ Guardar num gestor de passwords — não deixar em texto simples

---

## 🗺️ Plano de Acção Completo (aprovado pelo fundador)

### Visão reinventada
O Besord passa de "plataforma social de votação genérica" para **Plataforma de Inteligência de Perceção B2B2C** — diário minimalista para criativos + motor analítico para marcas. Ficheiro de referência: `visao_reinventada` (raiz do repo).

### Decisões de produto confirmadas
- **Design:** Manter Neo-Brutalist (preto/branco, sombras hard offset, bordas grossas) — não redesenhar
- **Prioridade:** Estabilidade técnica (Fase 0) antes de novas features visíveis

---

### Fase 0 — Saúde & Triage ✅ CONCLUÍDA (10 Jun 2026)

| Tarefa | Estado |
|---|---|
| Restaurar `perfil.tsx` (substituído por AuthContext) | ✅ |
| Fix race condition em `index.tsx` | ✅ |
| Fix `age_confirmed_at` no guard de navegação | ✅ |
| Fix iOS shadow (`shadowRadius: 0.5`) | ✅ |
| `STRIPE_WEBHOOK_SECRET` no Render | ✅ |
| Webhook rejeita assinaturas inválidas | ✅ |
| EAS Build configurado (`eas.json`, `android.package`) | ✅ |
| APK Android disponível para o fundador | 🔄 Build em curso |

---

### Fase 1 — Reposicionamento & Design (Semana 3-5)

Objectivo: mudar a identidade do produto para reflectir a `visao_reinventada`.

- [ ] **Redesign do onboarding** — novo copy: "diário de perceções", não "rede social"
- [ ] **Redesign do feed** — eventos em destaque no topo, feed global abaixo
- [ ] **Perfil como "biblioteca de perceções"** — histórico de palavras, padrões de votação
- [ ] **Novo copy em toda a app** — alinhado com nova identidade
- [ ] **Auditoria visual** — screenshots de todos os ecrãs, lista de problemas UX

Ficheiros críticos:
- `frontend/src/app/onboarding.tsx`
- `frontend/src/app/(tabs)/feed.tsx`
- `frontend/src/app/(tabs)/perfil.tsx`

---

### Fase 2 — Arquitectura de Eventos (Semana 6-9)

Objectivo: eventos tornam-se o motor central de engajamento.

- [ ] **Schema de eventos** actualizado — campo `type: "personal" | "enterprise_singular" | "enterprise_plural"`
- [ ] **Wizard de criação redesenhado** — fluxo diferente por tipo de evento
- [ ] **Interface de votação por evento** — imersiva, diferente do feed global
- [ ] **Revenue sharing** — backend: evento Personal divide receita 70/30 com criador
- [ ] **Mapa de descoberta melhorado** — filtros por tipo, raio, tema

Ficheiros críticos:
- `frontend/src/app/evento/[id].tsx`
- `backend/server.py` (novos endpoints de evento)

---

### Fase 3 — B2B Reinventado (Semana 10-13)

Objectivo: produto analítico para empresas.

- [ ] **Relatórios de Sincronia** — endpoint `GET /api/campaigns/{id}/sincronia-report` + dashboard
- [ ] **Eventos Enterprise** no painel de negócios — fluxo Singular e Plural
- [ ] **Pricing reformulado** — `backend/pricing.py` baseado em slots de eventos
- [ ] **Analytics avançados** — heatmap geolocalizado, funil de perceção

Ficheiros críticos:
- `frontend/src/app/business/dashboard.tsx`
- `backend/pricing.py`

---

### Fase 4 — IA & Social (Semana 14+)

Objectivo: diferenciação e viralidade.

- [ ] **Printable Effect** — cards visuais exportáveis (imagem + palavra + insight)
- [ ] **B$ Redemption** — loja básica (descontos em eventos, templates premium)
- [ ] **Empathy Mirror** — análise de padrões com Claude API → insight pessoal
- [ ] **Notificações inteligentes** — trigger por padrão de votação

---

## 📱 Workflow de desenvolvimento a seguir (após APK instalado)

```
CTO faz mudança → git push → EAS Update (OTA) → APK do fundador actualiza automaticamente
```

Comandos para o CTO após cada sessão de desenvolvimento:
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd frontend
EXPO_TOKEN="wuDfkdsHl1HsebQpuuTCS3eV0UuGjDhAB9_mbugd" eas update --branch main --message "descrição da mudança"
```

---

> **Última atualização:** 10 Junho 2026

---

## 🔧 2ª Sessão (10 Junho 2026, tarde) — Debug Expo Router (NÃO RESOLVIDO)

### Contexto
Fundador reportou que ao fazer scan do QR code no Expo Go, a app mostrava o ecrã "Start by creating a file in the src/app directory" em vez da Landing page.

### Diagnóstico

| Teste | Resultado |
|---|---|
| Metro inicia? | Sim, `Using src/app as the root directory for Expo Router` |
| Bundle compila (web)? | Sim, HTTP 200, 773 módulos, 5403ms |
| Bundle compila (Android)? | Sim, HTTP 200, 1109 módulos, 9410ms |
| Manifest acessível via IP? | Sim, `http://192.168.1.202:8081` responde JSON correto |
| HTML shell carrega? | Sim, `<title>Besord</title>`, `<div id="root">` |
| Código da app no bundle? | Sim, 35+ matches para strings do projeto |
| `node_modules` reinstalados? | Sim, `npm install` (1048 pacotes, 14s) |
| Cache Metro limpo? | Sim, `.metro-cache` apagado + `--clear` |
| `_layout.tsx` mínimo funciona? | Não — mesmo com `<Stack>` vazio, mesmo problema |
| `index.tsx` mínimo funciona? | Não — mesmo com `<Text>BESORD</Text>`, mesmo problema |

### Hipótese principal
Existe um segundo projeto Expo em `frontend/besord/src/app/` com rotas próprias. O `metro.config.js` tenta bloqueá-lo:
```js
const nestedProject = path.join(__dirname, 'besord'); // path ABSOLUTO
config.resolver.blockList = [
  new RegExp(`^${nestedProject.replace(...)}.*`),
];
```
Se o Metro espera paths **relativos** no `blockList`, o regex absoluto nunca faz match → projeto aninhado interfere com a resolução de rotas.

### Outras notas
- `yarn` não está instalado no sistema → `npm install` usado como fallback
- `.env.local`: `EXPO_PUBLIC_FRONTEND_URL=http://localhost:8083` mas Metro corre em 8081
- Backend responde em `http://192.168.1.202:8000` (ping OK: `{"status":"ok"}`)

### Próximo passo
Mover/remover `frontend/besord/` ou corrigir regex do `blockList` para `^\.\/besord\/.*`, limpar tudo e testar de novo.

### Arquivos alterados nesta sessão
- `frontend/app.json`: removido `newArchEnabled: false`, adicionado `checkAutomatically: "ON_ERROR_RECOVERY"` (revertido no final)
- `frontend/src/app/_layout.tsx`: testado versão mínima (revertido)
- `frontend/src/app/index.tsx`: testado versão mínima (revertido)
- `frontend/.metro-cache`: apagado
- `frontend/node_modules`: apagado e reinstalado via npm

> **Ficheiros restaurados** com `git checkout` no final da sessão.
