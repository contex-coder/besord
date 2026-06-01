# 📡 Resend — registos DNS exactos para `besord.eu`

> Status actual no Resend: **`pending`** (estava "failed", agora a re-validar).
> DNS público: **nenhum dos 3 registos foi detectado** ainda.
> 👉 Adiciona os 3 registos abaixo no teu cPanel → DNS Zone Editor.

## Passos exactos no cPanel (Webdomain)

1. Login no cPanel
2. Procura **"Zone Editor"** ou **"Editor da Zona DNS"** (em Domains)
3. Carrega no **+ Add Record** ao lado de `besord.eu`
4. Adiciona cada um destes 3 registos. Em cada caso, o **"Name"** vai aceitar tanto a versão relativa (ex.: `send`) como a completa (`send.besord.eu`). O cPanel da Webdomain auto-completa.

---

### ① TXT (DKIM)

| Campo | Valor |
|------|-------|
| **Type** | TXT |
| **Name** | `resend._domainkey` |
| **TTL** | Auto (ou 3600) |
| **Value** | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCv5A6cyZry4NSE/hLslDzqx/zp08Ok3MDD40WsQgsGmTsv1MzBLj9l+aJl63cfhGThSkYKnK0u3C2OIvGDsHPT/2Gv8qEyyH4FnCCKGqJzlvYqt6dhRz8NgiIlUg/UmvLv9E8ytdgKYIjN/UMbVfUttEsseioDnCw+LDwGjFHPXwIDAQAB` |

⚠ Se o cPanel não aceitar o valor todo de uma vez (alguns têm limite de 255 chars), divide em strings de 255 entre aspas: `"p=MIGfMA0..." "uLv9E8..." "...QAB"` — o DNS junta tudo. Mas a maioria aceita direto, tenta primeiro.

### ② MX (SPF — receção AmazonSES)

| Campo | Valor |
|------|-------|
| **Type** | MX |
| **Name** | `send` |
| **TTL** | Auto |
| **Priority** | 10 |
| **Value** | `feedback-smtp.eu-west-1.amazonses.com` |

### ③ TXT (SPF)

| Campo | Valor |
|------|-------|
| **Type** | TXT |
| **Name** | `send` |
| **TTL** | Auto |
| **Value** | `v=spf1 include:amazonses.com ~all` |

---

## Depois de adicionar:
- Aguarda **5-30 min** para propagação DNS
- Diz-me "DNS pronto" e eu peço re-verify ao Resend + troco `EMAIL_FROM` para `Besord <support@besord.eu>` + envio email de teste para validar

## Verificar manualmente (opcional)
Abre no browser https://dnschecker.org e procura:
- `TXT resend._domainkey.besord.eu` → deve mostrar `p=MIGfM...`
- `TXT send.besord.eu` → `v=spf1 include:amazonses.com ~all`
- `MX send.besord.eu` → `feedback-smtp.eu-west-1.amazonses.com`
