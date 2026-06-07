# Fase 2B — Verificação de Identidade com Stripe Identity

> **Status:** ⏳ Por implementar
> **Prioridade:** Média (após validação fiscal automática)
> **Custo estimado:** ~$1.50/verificação (50 primeiras grátis/mês)
> **Referência:** [Stripe Identity Docs](https://stripe.com/docs/identity)

## Objetivo

Validar a identidade do representante legal da empresa através de:
1. Documento oficial (frente e verso) — BI/CC, Passaporte, Carta de Condução
2. Selfie com liveness detection (não é foto estática — o sistema pede para piscar, virar a cabeça)
3. Face match — compara a selfie com a foto do documento
4. Relação com a empresa — verificar se o utilizador é representante legal

## Porquê Stripe Identity?

| Critério | Stripe Identity | Veriff | Ondato | Trulioo (Enterprise) |
|----------|----------------|--------|--------|---------------------|
| **Preço** | $1.50/verif (50 grátis/mês) | ~$1.50-$3.00 | ~€1.50 | Enterprise ($$$) |
| **Documentos** | 100+ países | 190+ países | 100+ países | 200+ países |
| **Face match + Liveness** | ✅ | ✅ | ✅ | ✅ |
| **Integração Stripe** | ✅ Nativa | ❌ | ❌ | ❌ |
| **React Native SDK** | ✅ | ✅ | ✅ | ✅ |
| **Web SDK** | ✅ | ✅ | ✅ | ✅ |

**Decisão:** Stripe Identity — já usamos Stripe para pagamentos, integração nativa, menor preço.

## Integração

### Backend — Nova Rota

```python
# workspace_verification.py (novo ficheiro)

import stripe
from fastapi import APIRouter, HTTPException

stripe.api_key = os.getenv("STRIPE_API_KEY")

@router.post("/workspaces/{workspace_id}/verification/start")
async def start_identity_verification(workspace_id: str, user):
    """
    Cria uma sessão de verificação Stripe Identity.
    Retorna um client_secret para o frontend iniciar o fluxo.
    """
    ws = await db.workspaces.find_one({"workspace_id": workspace_id})
    if not ws or ws["owner_user_id"] != user["user_id"]:
        raise HTTPException(404)
    
    session = stripe.identity.VerificationSession.create(
        type="document",
        options={
            "document": {
                "require_id_number": True,
                "require_matching_selfie": True,
                "require_live_capture": True,  # liveness detection
            }
        },
        metadata={"workspace_id": workspace_id},
    )
    
    # Guardar reference no workspace
    await db.workspaces.update_one(
        {"_id": ws["_id"]},
        {"$set": {"identity_verification_id": session.id, 
                   "identity_verification_status": "pending"}}
    )
    
    return {"client_secret": session.client_secret}


@router.post("/workspaces/{workspace_id}/verification/webhook")
async def identity_webhook(payload: dict):
    """
    Webhook Stripe para quando a verificação é concluída.
    Stripe envia evento `identity.verification_session.verified`
    ou `identity.verification_session.requires_input`.
    """
    event = stripe.Event.construct_from(payload, stripe.api_key)
    
    if event.type == "identity.verification_session.verified":
        session = event.data.object
        ws_id = session.metadata.get("workspace_id")
        
        # Se a verificação passou, extrair dados do documento
        verified_outputs = session.get("verified_outputs", {})
        
        await db.workspaces.update_one(
            {"workspace_id": ws_id},
            {"$set": {
                "identity_verification_status": "verified",
                "identity_verified_at": datetime.now(timezone.utc),
                "identity_data": {
                    "dob": verified_outputs.get("dob"),
                    "first_name": verified_outputs.get("first_name"),
                    "last_name": verified_outputs.get("last_name"),
                    "id_number": verified_outputs.get("id_number"),
                    "country": verified_outputs.get("country"),
                }
            }}
        )
        
        # Auto-verify workspace se ainda não estiver verificado
        await db.workspaces.update_one(
            {"workspace_id": ws_id, "verified": False},
            {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}}
        )
    
    return {"ok": True}
```

### Frontend — Fluxo no Browser / App

```tsx
// Componente reutilizável que abre o modal do Stripe Identity
import { useStripeIdentity } from "@stripe/stripe-identity-react-native";

function IdentityVerification({ workspaceId }: { workspaceId: string }) {
  const { verify } = useStripeIdentity();
  const [status, setStatus] = useState<"idle" | "pending" | "verified" | "failed">("idle");

  const startVerification = async () => {
    // 1. Backend cria sessão Stripe Identity
    const res = await apiFetch(`/api/workspaces/${workspaceId}/verification/start`, {
      method: "POST",
    });
    const { client_secret } = await res.json();

    // 2. Abre fluxo Stripe Identity (documento + selfie)
    const result = await verify(client_secret, {
      onSuccess: () => setStatus("verified"),
      onError: (err) => setStatus("failed"),
    });
  };

  return (
    <View>
      {status === "idle" && (
        <TouchableOpacity onPress={startVerification}>
          <Text>Verificar Identidade</Text>
        </TouchableOpacity>
      )}
      {status === "verified" && <Text>✅ Identidade verificada</Text>}
      {status === "failed" && <Text>❌ Falhou — tenta novamente</Text>}
    </View>
  );
}
```

## Fluxo Completo

```
📱 Cria Empresa (formulário)
    │
    ├── ✅ NIPC/NIF Válido (API Governamental)
    │       → Empresa pré-verificada
    │       → Pode criar campanhas de baixo valor
    │       → MAS: Identity Verification necessária para desbloquear:
    │         • Múltiplas campanhas simultâneas
    │         • Campanhas de alto valor (>€500)
    │         • Stripe Payouts
    │
    ├── 📸 Identity Verification (Stripe)
    │       → Documento (frente/verso)
    │       → Selfie com liveness
    │       → Face match
    │       → Custo: $1.50
    │       → Resposta: ~5-10 segundos
    │
    └── ✅ Fully Verified
            → Tudo desbloqueado
            → "Trusted advertiser" badge
```

## Estrutura de Custos (estimativa)

| Volume/mês | Custo | Nota |
|-----------|-------|------|
| 0-50 | $0 | Grátis (Stripe oferece 50 primeiras) |
| 51-100 | $75 | $1.50 × 50 |
| 101-500 | $150-$750 | Volume pricing não divulgado |
| 500+ | Negotiate | Stripe Enterprise |

## Regulatório

- **GDPR compliance:** Stripe é data processor certificado
- **Dados biométricos:** Stripe não armazena fotos dos documentos após verificação
- **Retenção:** Configurável (Stripe guarda por 30-90 dias por defeito)
- **Direito ao esquecimento:** API para apagar sessões de verificação

## Checklist de Implementação

- [ ] Instalar `@stripe/stripe-identity-react-native` no frontend
- [ ] Criar `workspace_verification.py` no backend
- [ ] Adicionar webhook endpoint no Stripe Dashboard
- [ ] Adicionar botão "Verificar Identidade" na página da empresa
- [ ] Adicionar estado `identity_verification_status` ao WorkspaceOut
- [ ] Mostrar badge "Trusted" quando verificado
- [ ] Bloquear funcionalidades avançadas até verificação
- [ ] Testar com documentos PT, BR, US, EU
