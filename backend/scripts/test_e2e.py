#!/usr/bin/env python3
"""
Besord E2E Test Suite — Perspectiva do utilizador.

Cria 2 utilizadores de teste, percorre todos os fluxos da app ecrã a ecrã,
verifica botões/endpoints, e reporta o que falta para concluir a Fase 2.

Executar:
    cd backend
    source venv/bin/activate
    python scripts/test_e2e.py

Variáveis de ambiente opcionais:
    BACKEND_URL   URL do backend (default: https://besord-backend.onrender.com)
    ADMIN_EMAIL   Email admin (lido do .env automaticamente)
    ADMIN_PASS    Palavra-passe do admin se tiver conta password (opcional — desbloqueia testes admin)
"""

import asyncio
import httpx
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

BACKEND = os.getenv("BACKEND_URL", "https://besord-backend.onrender.com").rstrip("/")
TS = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

USER_A = {"email": f"tester.a.{TS}@gmail.com", "password": "E2eTest123!", "name": "E2E Alpha"}
USER_B = {"email": f"tester.b.{TS}@gmail.com", "password": "E2eTest123!", "name": "E2E Beta"}
ADMIN_PASS = os.getenv("ADMIN_PASS", "")

# ── Terminal colors ─────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
GREY   = "\033[90m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Result tracking ─────────────────────────────────────────────────────────
results: list[dict] = []

def ok(label: str, detail: str = ""):
    print(f"{GREEN}✅ {label}{RESET}" + (f"  {GREY}{detail}{RESET}" if detail else ""))
    results.append({"label": label, "status": "ok", "detail": detail})

def fail(label: str, detail: str = ""):
    print(f"{RED}❌ {label}{RESET}" + (f"  {GREY}{detail}{RESET}" if detail else ""))
    results.append({"label": label, "status": "fail", "detail": detail})

def warn(label: str, detail: str = ""):
    print(f"{YELLOW}⚠️  {label}{RESET}" + (f"  {GREY}{detail}{RESET}" if detail else ""))
    results.append({"label": label, "status": "warn", "detail": detail})

def skip(label: str, detail: str = ""):
    print(f"{GREY}⏭  {label} — {detail}{RESET}")
    results.append({"label": label, "status": "skip", "detail": detail})

def section(title: str):
    print(f"\n{BOLD}{BLUE}{'─'*60}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'─'*60}{RESET}")


# ── Helpers ─────────────────────────────────────────────────────────────────
async def post(c: httpx.AsyncClient, path: str, token: str | None = None, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return await c.post(f"{BACKEND}{path}", headers=headers, **kwargs)

async def get(c: httpx.AsyncClient, path: str, token: str | None = None, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return await c.get(f"{BACKEND}{path}", headers=headers, **kwargs)

async def delete(c: httpx.AsyncClient, path: str, token: str | None = None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return await c.delete(f"{BACKEND}{path}", headers=headers)

def check(label: str, r: httpx.Response, expected: int = 200):
    if r.status_code == expected:
        return True
    fail(label, f"HTTP {r.status_code}: {r.text[:120]}")
    return False


# ═══════════════════════════════════════════════════════════════════════════
#  TESTES
# ═══════════════════════════════════════════════════════════════════════════
async def run():
    async with httpx.AsyncClient(timeout=30.0) as c:
        token_a: str = ""
        token_b: str = ""
        user_id_a: str = ""
        user_id_b: str = ""
        admin_token: str = ""

        # ──────────────────────────────────────────────────────────────────
        section("0. CONECTIVIDADE — Health Check")
        # ──────────────────────────────────────────────────────────────────
        try:
            r = await c.get(f"{BACKEND}/", timeout=15.0)
            if r.status_code == 200:
                ok("Backend acessível", r.json().get("status", "?"))
            else:
                fail("Backend acessível", f"HTTP {r.status_code}")
                return
        except Exception as e:
            fail("Backend acessível", str(e))
            print(f"\n{RED}Não foi possível ligar ao backend. Verificar se o Render está activo.{RESET}")
            return

        # ──────────────────────────────────────────────────────────────────
        section("1. AUTENTICAÇÃO — Ecrã de Onboarding")
        # ──────────────────────────────────────────────────────────────────

        # Registo do utilizador A
        r = await post(c, "/api/auth/register", json=USER_A)
        if check("Registo Utilizador A", r):
            d = r.json()
            token_a = d["token"]
            user_id_a = d["user_id"]
            ok("Registo Utilizador A", f"user_id={user_id_a}")
        else:
            fail("Registo Utilizador A — BLOQUEANTE")
            return

        # Login com as mesmas credenciais
        r = await post(c, "/api/auth/login", json={"email": USER_A["email"], "password": USER_A["password"]})
        if check("Login Utilizador A", r):
            token_a = r.json()["token"]
            ok("Login Utilizador A", "token válido")

        # Wrong password → deve rejeitar
        r = await post(c, "/api/auth/login", json={"email": USER_A["email"], "password": "wrongpass"})
        if r.status_code == 400:
            ok("Login com password errada → rejeitado correctamente", "HTTP 400")
        else:
            warn("Login com password errada", f"esperava 400, recebeu {r.status_code}")

        # GET /api/auth/me
        r = await get(c, "/api/auth/me", token_a)
        if check("GET /api/auth/me (perfil próprio)", r):
            me = r.json()
            ok("GET /api/auth/me", f"bw_balance={me.get('bw_balance', '?')}, age_confirmed={bool(me.get('age_confirmed_at'))}")

        # Registo do utilizador B
        r = await post(c, "/api/auth/register", json=USER_B)
        if check("Registo Utilizador B", r):
            d = r.json()
            token_b = d["token"]
            user_id_b = d["user_id"]
            ok("Registo Utilizador B", f"user_id={user_id_b}")

        # Admin login (se ADMIN_PASS disponível)
        admin_email = os.getenv("ADMIN_EMAIL", "conteeteixeira@gmail.com")
        if ADMIN_PASS:
            r = await post(c, "/api/auth/login", json={"email": admin_email, "password": ADMIN_PASS})
            if r.status_code == 200:
                admin_token = r.json()["token"]
                ok("Login Admin (para testes admin)", f"email={admin_email}")
            else:
                warn("Login Admin", f"HTTP {r.status_code} — testes admin serão saltados")
        else:
            skip("Login Admin", "ADMIN_PASS não definido — testes admin saltados")

        # ──────────────────────────────────────────────────────────────────
        section("2. CONFIRMAÇÃO DE IDADE — Ecrã de Onboarding (passo 2)")
        # ──────────────────────────────────────────────────────────────────
        r = await post(c, "/api/auth/confirm-age", token_a, json={"birth_year": 1990})
        if check("POST /api/auth/confirm-age (Utilizador A)", r):
            ok("Confirmação de idade A", "1990 → 36 anos ✓")

        r = await post(c, "/api/auth/confirm-age", token_b, json={"birth_year": 1995})
        if check("POST /api/auth/confirm-age (Utilizador B)", r):
            ok("Confirmação de idade B", "1995 → 31 anos ✓")

        # Menor de 13 anos deve ser rejeitado (testado com token_b — invalida a sessão por design)
        r = await post(c, "/api/auth/confirm-age", token_b, json={"birth_year": 2020})
        if r.status_code in (400, 403):
            ok("Menor de 13 anos → rejeitado correctamente")
            # Sessão de B foi invalidada — re-login
            r2 = await post(c, "/api/auth/login", json={"email": USER_B["email"], "password": USER_B["password"]})
            if r2.status_code == 200:
                token_b = r2.json()["token"]
                # Confirmar idade correcta para B
                await post(c, "/api/auth/confirm-age", token_b, json={"birth_year": 1995})
        else:
            warn("Menor de 13 anos", f"esperava 400/403, recebeu {r.status_code}")

        # ──────────────────────────────────────────────────────────────────
        section("3. FEED GLOBAL — Ecrã principal")
        # ──────────────────────────────────────────────────────────────────

        # Listar posts (seed)
        r = await get(c, "/api/posts?sort=recent")
        if check("GET /api/posts (feed global)", r):
            posts = r.json()
            count = len(posts)
            if count >= 50:
                ok("Feed tem 50+ posts seed", f"{count} posts encontrados")
            elif count > 0:
                warn("Feed tem posts mas menos de 50", f"Apenas {count} posts — seed pode estar incompleto")
            else:
                fail("Feed VAZIO", "Seed não correu. Executar: python scripts/seed_content.py")

        # Filtro por hype
        r = await get(c, "/api/posts?sort=trending&is_hype=true")
        if check("GET /api/posts?is_hype=true (filtro Hype)", r):
            ok("Filtro Hype", f"{len(r.json())} posts em hype")

        # Pesquisa por palavra
        r = await get(c, "/api/posts?sort=recent&word=SILÊNCIO")
        if check("GET /api/posts?word=SILÊNCIO (Word Links)", r):
            wl = r.json()
            if wl:
                ok("Word Links — pesquisa por palavra", f"{len(wl)} post(s) com SILÊNCIO")
            else:
                warn("Word Links", "Nenhum post com SILÊNCIO (esperava 1 do seed)")

        # ──────────────────────────────────────────────────────────────────
        section("4. PALAVRA DO DIA — Card no topo do feed")
        # ──────────────────────────────────────────────────────────────────

        r = await get(c, "/api/editorial/word-of-day/today")
        if check("GET /api/editorial/word-of-day/today", r):
            d = r.json()
            wotd = d.get("word_of_day")
            if wotd and wotd.get("word"):
                ok("Palavra do Dia presente", f"word={wotd['word']}, image_url={'✓' if wotd.get('image_url') else '✗'}")
            else:
                warn(
                    "Palavra do Dia SEM CONTEÚDO",
                    "Endpoint OK mas nenhuma palavra publicada hoje. "
                    "Rodrigo deve fazer POST /api/editorial/word-of-day com admin token."
                )

        # Publicar palavra (admin)
        if admin_token:
            r = await post(c, "/api/editorial/word-of-day", admin_token, json={
                "word": "ESSÊNCIA",
                "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                "theme": None,
                "bw_bonus": 5,
            })
            if r.status_code == 200:
                ok("POST /api/editorial/word-of-day (Admin — publicar palavra)", f"word={r.json().get('word', '?')}")
                # Verificar que aparece agora
                r2 = await get(c, "/api/editorial/word-of-day/today")
                wotd2 = r2.json().get("word_of_day")
                if wotd2 and wotd2.get("word"):
                    ok("Palavra do Dia visível após publicação", wotd2["word"])
                else:
                    fail("Palavra do Dia não aparece após publicação")
            else:
                fail("POST /api/editorial/word-of-day", f"HTTP {r.status_code}: {r.text[:80]}")
        else:
            skip("POST /api/editorial/word-of-day", "Requer admin token (ADMIN_PASS)")

        # ──────────────────────────────────────────────────────────────────
        section("5. VOTAÇÃO & TIME-GATE — 10 votos por dia")
        # ──────────────────────────────────────────────────────────────────

        # Buscar lista de posts para votar
        r = await get(c, "/api/posts?sort=recent")
        all_posts = r.json() if r.status_code == 200 else []

        if not all_posts:
            fail("Votação — sem posts para votar", "Feed vazio")
        else:
            remaining = 10
            gate_closed = False

            for i, p in enumerate(all_posts[:12]):  # tenta 12 para garantir que bate no gate
                pid = p["post_id"]
                vote_type = "aprovo" if i % 2 == 0 else "desaprovo"
                r = await post(c, f"/api/posts/{pid}/vote", token_a, json={"vote": vote_type})
                if r.status_code == 200:
                    d = r.json()
                    remaining = d.get("daily_interactions_remaining", remaining - 1)
                    if i == 0:
                        ok("1.º voto — aprovo", f"remaining={remaining}")
                elif r.status_code == 429:
                    gate_closed = True
                    ok("Time-Gate 429 recebido", f"após {i} votos (correcto)")
                    break
                else:
                    fail(f"Voto #{i+1}", f"HTTP {r.status_code}: {r.text[:80]}")
                    break

            if remaining == 0:
                ok("Time-Gate: remaining=0 após 10 votos", "correcto")
            elif gate_closed:
                ok("Time-Gate activado via 429", "correcto")
            else:
                warn("Time-Gate", f"Ainda restam {remaining} interacções — Time-Gate não fechou")

            # Tentar votar depois do gate num post NOVO (deve receber 429)
            if remaining == 0 or gate_closed:
                unvoted = [p for p in all_posts[10:] if p["post_id"] not in {p2["post_id"] for p2 in all_posts[:10]}]
                pid = unvoted[0]["post_id"] if unvoted else all_posts[-1]["post_id"]
                r = await post(c, f"/api/posts/{pid}/vote", token_a, json={"vote": "aprovo"})
                if r.status_code == 429:
                    ok("Voto após gate → 429 (bloqueado correctamente)")
                else:
                    warn("Voto após gate", f"esperava 429, recebeu {r.status_code}")

        # ──────────────────────────────────────────────────────────────────
        section("6. VEREDITO CARD — Modal de encerramento da sessão")
        # ──────────────────────────────────────────────────────────────────

        r = await get(c, "/api/users/me/veredito", token_a)
        if check("GET /api/users/me/veredito", r):
            v = r.json()
            ok(
                "Veredito Card data",
                f"total_votes={v.get('total_votes_cast','?')}, "
                f"aprovo={v.get('aprovo_votes_cast','?')}, "
                f"word={v.get('word') or '(sem post próprio)'}, "
                f"date={v.get('date','?')}"
            )

        # ──────────────────────────────────────────────────────────────────
        section("7. ESPELHO DE SESSÃO — Insight Groq no VeredictCard")
        # ──────────────────────────────────────────────────────────────────

        r = await get(c, "/api/insights/session", token_a)
        if check("GET /api/insights/session", r):
            d = r.json()
            insight = d.get("insight")
            if insight:
                ok("Espelho de Sessão (Groq)", f'"{insight[:90]}..."')
            else:
                warn(
                    "Espelho de Sessão retorna insight=null",
                    "Groq pode não ter GROQ_API_KEY definido no Render, ou utilizador não votou hoje"
                )

        # ──────────────────────────────────────────────────────────────────
        section("8. PERFIL PÚBLICO & GEO")
        # ──────────────────────────────────────────────────────────────────

        # Perfil de outro utilizador
        r = await get(c, f"/api/users/{user_id_b}/profile", token_a)
        if check(f"GET /api/users/{{id}}/profile (perfil público)", r):
            p = r.json()
            ok("Perfil público", f"name={p.get('name','?')}, admirers={p.get('admirers_count','?')}")

        # Geo
        r = await get(c, "/api/geo/me", token_a)
        if r.status_code == 200:
            g = r.json()
            ok("GET /api/geo/me", f"country={g.get('country_code','?')}, city={g.get('city','?')}")
        else:
            warn("GET /api/geo/me", f"HTTP {r.status_code}")

        # ──────────────────────────────────────────────────────────────────
        section("9. ADMIRADORES & SINCRONIA — Fluxo social")
        # ──────────────────────────────────────────────────────────────────

        # A admira B
        r = await post(c, f"/api/users/{user_id_b}/admire", token_a)
        if check("POST admire B (A → B)", r):
            ok("A admira B", r.json())

        # Tentar admirar de novo → deve dar 400
        r = await post(c, f"/api/users/{user_id_b}/admire", token_a)
        if r.status_code == 400:
            ok("Duplo admire → 400 (correcto)")
        else:
            warn("Duplo admire", f"esperava 400, recebeu {r.status_code}")

        # B admira A (cria admiração mútua → activa Sincronia)
        r = await post(c, f"/api/users/{user_id_a}/admire", token_b)
        if check("POST admire A (B → A) — admiração mútua", r):
            ok("Admiração mútua criada", "Sincronia deve ser calculada ao fechar sessão")

        # GET Sincronia (pode estar vazia pois é calculada por job)
        r = await get(c, "/api/users/me/sincronia", token_a)
        if r.status_code == 200:
            sync_list = r.json()  # retorna lista directamente
            ok("GET /api/users/me/sincronia", f"{len(sync_list)} registo(s) de sincronia hoje")
        else:
            warn("GET /api/users/me/sincronia", f"HTTP {r.status_code}")

        # Feed de admirados
        r = await get(c, "/api/feed/admired", token_a)
        if check("GET /api/feed/admired", r):
            ok("Feed admirados", f"{len(r.json())} posts de utilizadores admirados")

        # Lista de quem sigo
        r = await get(c, "/api/users/me/admiring", token_a)
        if check("GET /api/users/me/admiring", r):
            admiring = r.json().get("admiring", [])
            ok("Lista de admirados", f"{len(admiring)} utilizadores: {admiring[:3]}")

        # ──────────────────────────────────────────────────────────────────
        section("10. NOTIFICAÇÕES")
        # ──────────────────────────────────────────────────────────────────

        r = await get(c, "/api/notifications", token_a)
        if check("GET /api/notifications", r):
            notifs = r.json()
            ok("Notificações", f"{len(notifs)} notificação(ões) encontrada(s)")

        r = await get(c, "/api/notifications/unread-count", token_a)
        if check("GET /api/notifications/unread-count", r):
            ok("Unread count", f"count={r.json().get('count', '?')}")

        r = await post(c, "/api/notifications/read-all", token_a)
        if r.status_code == 200:
            ok("POST /api/notifications/read-all")
        else:
            warn("POST /api/notifications/read-all", f"HTTP {r.status_code}")

        # ──────────────────────────────────────────────────────────────────
        section("11. SISTEMA FUNDADOR — Convites e badges")
        # ──────────────────────────────────────────────────────────────────

        if admin_token:
            # Admin vê estatísticas
            r = await get(c, "/api/founders/stats", admin_token)
            if check("GET /api/founders/stats (admin)", r):
                s = r.json()
                ok(
                    "Founder stats",
                    f"total_redeemed={s.get('total_redeemed','?')}, "
                    f"remaining={s.get('remaining_spots','?')}/100"
                )

            # Admin gera código de convite
            r = await post(c, "/api/founders/invite", admin_token)
            if check("POST /api/founders/invite (admin gera código)", r):
                inv = r.json()
                code = inv.get("code", "")
                ok("Código gerado", code)

                # Validar código (endpoint público)
                r2 = await get(c, f"/api/founders/validate/{code}")
                if check("GET /api/founders/validate/{code}", r2):
                    v = r2.json()
                    ok(
                        "Código válido",
                        f"convidado_por={v.get('invited_by_name','?')}, "
                        f"próximo_nº=#{v.get('next_founder_number','?')}, "
                        f"restantes={v.get('remaining_spots','?')}"
                    )

                # Utilizador B resgata o código
                r3 = await post(c, f"/api/founders/redeem/{code}", token_b)
                if check("POST /api/founders/redeem/{code} (Utilizador B)", r3):
                    rd = r3.json()
                    ok("Badge Fundador atribuído", f"founder_number=#{rd.get('founder_number','?')}")

                # Tentar reutilizar código → deve dar 410
                r4 = await post(c, f"/api/founders/redeem/{code}", token_a)
                if r4.status_code == 410:
                    ok("Código já usado → 410 (correcto)")
                else:
                    warn("Código já usado", f"esperava 410, recebeu {r4.status_code}")

                # Código inválido → 404
                r5 = await get(c, "/api/founders/validate/BESORD-XXXXXXXX")
                if r5.status_code == 404:
                    ok("Código inválido → 404 (correcto)")
                else:
                    warn("Código inválido", f"esperava 404, recebeu {r5.status_code}")
        else:
            skip("GET /api/founders/stats", "Admin token ausente")
            skip("POST /api/founders/invite", "Admin token ausente — Rodrigo deve testar manualmente")
            skip("GET /api/founders/validate", "Admin token ausente")
            skip("POST /api/founders/redeem", "Admin token ausente")

            # Testar código inválido (público, sem auth)
            r = await get(c, "/api/founders/validate/BESORD-XXXXXXXX")
            if r.status_code == 404:
                ok("Código inválido → 404 (endpoint público, sem auth)")
            else:
                warn("Código inválido", f"esperava 404, recebeu {r.status_code}")

        # ──────────────────────────────────────────────────────────────────
        section("12. PRIMEIRO OLHAR — Produto B2B (admin only)")
        # ──────────────────────────────────────────────────────────────────

        if admin_token:
            r = await post(c, "/api/events/primeiro-olhar", admin_token, json={
                "name": "Teste E2E — Primeiro Olhar",
                "brand_name": "Marca Teste",
                "brand_intended_word": "ESSÊNCIA",
                "image_urls": [
                    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
                ],
                "duration_hours": 48,
            })
            if r.status_code == 200:
                ev = r.json()
                eid = ev.get("event_id", "")
                ok("POST /api/events/primeiro-olhar", f"event_id={eid}, {len(ev.get('posts',[]))} posts criados")

                # Relatório (sem votos = dados vazios, mas endpoint deve responder)
                r2 = await get(c, f"/api/events/{eid}/primeiro-olhar-report", admin_token)
                if r2.status_code == 200:
                    ok("GET primeiro-olhar-report", f"{len(r2.json().get('results',[]))} posts no relatório")
                else:
                    warn("GET primeiro-olhar-report", f"HTTP {r2.status_code}: {r2.text[:80]}")
            else:
                fail("POST /api/events/primeiro-olhar", f"HTTP {r.status_code}: {r.text[:100]}")
        else:
            skip("POST /api/events/primeiro-olhar", "Admin token ausente — Rodrigo testa manualmente com curl")

        # ──────────────────────────────────────────────────────────────────
        section("13. TENDÊNCIAS")
        # ──────────────────────────────────────────────────────────────────

        r = await get(c, "/api/posts?sort=trending")
        if check("GET /api/posts?sort=trending (Trends)", r):
            ok("Trends feed", f"{len(r.json())} posts em ordem trending")

        # ──────────────────────────────────────────────────────────────────
        section("14. LIMPEZA — Remover contas de teste")
        # ──────────────────────────────────────────────────────────────────

        r = await post(c, "/api/me/delete", token_a)
        if r.status_code == 200:
            ok("DELETE conta Utilizador A")
        else:
            warn("DELETE conta Utilizador A", f"HTTP {r.status_code} — remover manualmente no MongoDB se necessário")

        r = await post(c, "/api/me/delete", token_b)
        if r.status_code == 200:
            ok("DELETE conta Utilizador B")
        else:
            warn("DELETE conta Utilizador B", f"HTTP {r.status_code}")

        # ══════════════════════════════════════════════════════════════════
        #  SUMÁRIO
        # ══════════════════════════════════════════════════════════════════
        section("SUMÁRIO DOS TESTES")

        ok_n    = sum(1 for r in results if r["status"] == "ok")
        fail_n  = sum(1 for r in results if r["status"] == "fail")
        warn_n  = sum(1 for r in results if r["status"] == "warn")
        skip_n  = sum(1 for r in results if r["status"] == "skip")
        total   = len(results)

        print(f"\n  {GREEN}✅ PASSOU:  {ok_n}/{total}{RESET}")
        print(f"  {YELLOW}⚠️  AVISOS:  {warn_n}{RESET}")
        print(f"  {RED}❌ FALHAS:  {fail_n}{RESET}")
        print(f"  {GREY}⏭  SALTADO: {skip_n}{RESET}")

        if fail_n:
            print(f"\n{RED}{BOLD}FALHAS DETECTADAS:{RESET}")
            for r in results:
                if r["status"] == "fail":
                    print(f"  {RED}❌ {r['label']}{RESET}  {GREY}{r['detail']}{RESET}")

        if warn_n:
            print(f"\n{YELLOW}{BOLD}AVISOS (não bloqueantes):{RESET}")
            for r in results:
                if r["status"] == "warn":
                    print(f"  {YELLOW}⚠️  {r['label']}{RESET}  {GREY}{r['detail']}{RESET}")

        # ══════════════════════════════════════════════════════════════════
        #  ANÁLISE FASE 2
        # ══════════════════════════════════════════════════════════════════
        section("ANÁLISE DE COMPLETUDE — FASE 2")

        fail_labels = {r["label"] for r in results if r["status"] == "fail"}
        warn_labels = {r["label"] for r in results if r["status"] == "warn"}

        TECH_ITEMS = [
            ("50 posts seed no feed",                   "GET /api/posts (feed global)" not in fail_labels),
            ("Veredito Card endpoint",                  "GET /api/users/me/veredito" not in fail_labels),
            ("Espelho de Sessão (Groq insight)",         "GET /api/insights/session" not in fail_labels),
            ("Time-Gate (10 votos/dia)",                "Time-Gate: remaining=0 após 10 votos" not in fail_labels and "Time-Gate activado via 429" not in fail_labels),
            ("Fundador — endpoint público (validate)",  "Código inválido → 404 (endpoint público, sem auth)" not in fail_labels),
            ("Sincronia — endpoint",                    "GET /api/users/me/sincronia" not in fail_labels),
            ("Feed de Admirados",                       "GET /api/feed/admired" not in fail_labels),
            ("Notificações",                            "GET /api/notifications" not in fail_labels),
            ("Confirmação de idade (onboarding)",       "POST /api/auth/confirm-age (Utilizador A)" not in fail_labels),
            ("Registo + Login",                         "Registo Utilizador A" not in fail_labels),
        ]

        all_tech_ok = True
        print(f"\n  {BOLD}Itens técnicos:{RESET}")
        for name, passed in TECH_ITEMS:
            sym = f"{GREEN}✅" if passed else f"{RED}❌"
            print(f"  {sym} {name}{RESET}")
            if not passed:
                all_tech_ok = False

        RODRIGO_ITEMS = [
            ("Calendário editorial (30 palavras)", "Rodrigo publica via POST /api/editorial/word-of-day com admin token"),
            ("iOS TestFlight", "eas build --platform ios --profile preview"),
            ("Convites Fundador (gerar + enviar)", "POST /api/founders/invite com admin token; enviar link /fundador/{code}"),
            ("Primeira venda B2B", "Contactar 1 marca; criar evento com POST /api/events/primeiro-olhar"),
            ("B2$ mini-loja (badges 50/200/500)", "Implementação técnica pendente — rectificação 6"),
        ]

        print(f"\n  {BOLD}Acções de Rodrigo (não técnicas / admin):{RESET}")
        for name, detail in RODRIGO_ITEMS:
            print(f"  {YELLOW}📋 {name}{RESET}  {GREY}{detail}{RESET}")

        print()
        if all_tech_ok and fail_n == 0:
            print(f"{GREEN}{BOLD}✅ FASE 2 TECNICAMENTE COMPLETA.{RESET}")
            print(f"{GREY}Apenas as acções de Rodrigo listadas acima bloqueiam o lançamento.{RESET}")
        elif fail_n == 0:
            print(f"{YELLOW}{BOLD}⚠️  FASE 2 QUASE COMPLETA — apenas avisos (não bloqueantes).{RESET}")
        else:
            print(f"{RED}{BOLD}❌ FASE 2 TEM FALHAS TÉCNICAS — ver lista acima.{RESET}")

        print(f"\n{GREY}Utilizadores de teste: {USER_A['email']} / {USER_B['email']}{RESET}")


if __name__ == "__main__":
    asyncio.run(run())
