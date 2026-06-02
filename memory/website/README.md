# 📦 Site estático Besord — pronto para cPanel (besord.eu)

## O que está aqui dentro
```
website/
├── index.html         ← landing principal (www.besord.eu)
├── terms.html         ← termos de uso (URL público — pedido pelo Google Play)
├── privacy.html       ← política de privacidade (URL público — OBRIGATÓRIO Play Store)
├── support.html       ← contactos e RGPD
├── style.css          ← estilo único partilhado
├── robots.txt         ← regras para motores de busca
├── sitemap.xml        ← mapa do site
└── assets/
    ├── beetle.png     ← mascote (também usada como ícone OG/Apple touch)
    └── favicon.png    ← ícone do separador
```

## Como carregar no teu cPanel (Webdomain, 5 minutos)

### 1. Entra no cPanel
- Abre o link no email que recebeste do Webdomain (algo como `webdomain03.dnscpanel.com:2083`)
- Login com as credenciais do alojamento

### 2. Abre o File Manager
- No cPanel procura **"Administrador de ficheiros"** (Files / File Manager)
- Vai à pasta **`public_html/`** (é a raiz pública do besord.eu)

### 3. (opcional) Limpa o conteúdo default
- Se existir um `index.html`/`default.html` da Webdomain, podes apagar.

### 4. Upload de TODOS estes ficheiros
- Botão **"Upload"** no topo
- Faz upload de:
  - `index.html`, `terms.html`, `privacy.html`, `support.html`, `style.css`, `robots.txt`, `sitemap.xml`
- Depois, dentro de `public_html/`, **cria a pasta `assets/`** e faz upload dos 2 PNGs aí dentro.

A estrutura final em cPanel deve ser:
```
public_html/
├── index.html
├── terms.html
├── privacy.html
├── support.html
├── style.css
├── robots.txt
├── sitemap.xml
└── assets/
    ├── beetle.png
    └── favicon.png
```

### 5. (Importante) Forçar HTTPS
- No cPanel procura **"SSL/TLS Status"** ou **"Let's Encrypt"** → instala/renova certificado para `besord.eu` e `www.besord.eu` (deve estar automático na Webdomain).
- Depois, em **".htaccess"** dentro de `public_html`, adiciona este snippet (ou cria o ficheiro):

```apache
RewriteEngine On
# Force HTTPS
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Force www
RewriteCond %{HTTP_HOST} ^besord\.eu$ [NC]
RewriteRule ^ https://www.besord.eu%{REQUEST_URI} [L,R=301]

# Default page
DirectoryIndex index.html
```

### 6. Testa
Abre num browser anónimo:
- https://www.besord.eu — deve mostrar o landing com o besouro
- https://www.besord.eu/privacy.html — privacy policy
- https://www.besord.eu/terms.html — termos
- https://www.besord.eu/support.html — suporte

✅ O **URL público** da política de privacidade que o Google Play vai exigir é: **`https://www.besord.eu/privacy.html`**

---

## Email — configuração rápida

O teu cPanel já tem 1 conta criada (na captura vi "1/1"). Confirma que é **support@besord.eu**:

1. cPanel → **"Email Accounts"** (Contas de Email)
2. Se ainda não existe `support@besord.eu`, cria
3. (Recomendado) cria também aliases que reencaminham para `support@`:
   - `legal@besord.eu` → encaminha para `support@besord.eu`
   - `privacy@besord.eu` → encaminha para `support@besord.eu`
   - `info@besord.eu` → encaminha para `support@besord.eu`
   - `press@besord.eu` → encaminha para `support@besord.eu`
4. cPanel → **"Forwarders"** (Reencaminhamentos) → adicionar cada alias

Assim só geres 1 inbox e o resto chega lá.

### Resend — quando estiveres pronto para emails da app
Os emails de marcos de campanha (50/75/100%) ainda estão a sair de `Besord <onboarding@resend.dev>` (sandbox).
Para passar para produção:
1. Vai a https://resend.com/domains → **Add Domain** → escreve `besord.eu`
2. A Resend dá-te 3 registos DNS para colar no cPanel:
   - DNS Zone Editor → adiciona 1× MX, 2× TXT (SPF / DKIM)
3. Quando o domínio aparecer "Verified" no painel Resend, diz-me e eu mudo o `EMAIL_FROM` no `.env` para:
   ```
   EMAIL_FROM="Besord <support@besord.eu>"
   ```
   (ou outro endereço que prefiras como remetente)

---

## Próximos passos sugeridos

1. ⏳ **Upload do site** → mais 5 min e tens `www.besord.eu` online
2. ⏳ **Verifica DNS Resend** → para emails saírem do sandbox
3. ⏳ **Webhook Stripe** → cria em https://dashboard.stripe.com/test/webhooks com URL `https://api.besord.eu/api/stripe/webhook` (mas só depois de publicar o backend!) e manda-me o webhook signing secret
4. ⏳ **Conta Google Play Developer** ($25) — só tu podes criar
5. ⏳ **Publicar** o app via botão "Publish" do Emergent → gera o AAB para a Play Store

---

## Quando submeteres no Google Play, usa exactamente isto

| Campo | Valor |
|------|-------|
| Privacy Policy URL | `https://www.besord.eu/privacy.html` |
| Support email | `support@besord.eu` |
| Website | `https://www.besord.eu` |
| Categoria | Social |
| Classificação | 13+ |
| País de operação | Portugal |
