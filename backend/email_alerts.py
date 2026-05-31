"""Resend email alerts for campaign milestones (50/75/100% of goal).

All emails come from "Besord <onboarding@resend.dev>" by default.
Idempotency: each milestone is sent at most once per campaign — tracked in
`campaigns.milestones_sent` (a list of ints).
"""
import os
import logging
from typing import Optional

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Besord <onboarding@resend.dev>")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://besord.app")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


MILESTONES = (50, 75, 100)


def _is_configured() -> bool:
    return bool(RESEND_API_KEY)


def _milestone_subject(milestone: int, word: str) -> str:
    if milestone >= 100:
        return f"🎯 Campanha #{word} atingiu 100% da meta — Besord"
    return f"📈 Campanha #{word} já vai em {milestone}% da meta — Besord"


def _milestone_html(milestone: int, word: str, votes_collected: int, included_votes: int,
                    aprovo_pct: int, campaign_id: str) -> str:
    dash_url = f"{APP_BASE_URL}/business/campaign/{campaign_id}"
    if milestone >= 100:
        headline = "META ALCANÇADA"
        cta = "VER RELATÓRIO FINAL"
        intro = (
            "Boa! A tua campanha atingiu o objetivo de votos. "
            "O relatório completo já está disponível no painel."
        )
    else:
        headline = f"{milestone}% DA META"
        cta = "ABRIR PAINEL"
        intro = (
            f"Vai a meio caminho! Já recolheste {votes_collected} de {included_votes} votos. "
            "Continua a partilhar para chegar ao 100%."
        )

    return f"""<!doctype html>
<html lang="pt">
<head><meta charset="utf-8"><title>{headline}</title></head>
<body style="margin:0;padding:0;background:#F5F5F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0A0A0A;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5F5F4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border:4px solid #0A0A0A;box-shadow:6px 6px 0 #0A0A0A;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <div style="display:inline-block;background:#FFD400;border:3px solid #0A0A0A;padding:4px 10px;font-weight:900;letter-spacing:2px;font-size:12px;">BESORD</div>
        </td></tr>
        <tr><td style="padding:8px 24px 0 24px;">
          <h1 style="margin:0;font-size:34px;font-weight:900;letter-spacing:-1px;line-height:1.05;">{headline}</h1>
          <p style="margin:8px 0 0 0;font-size:14px;font-weight:800;letter-spacing:1px;color:#5A5A5A;">#{word.upper()}</p>
        </td></tr>
        <tr><td style="padding:20px 24px 0 24px;">
          <p style="margin:0;font-size:15px;line-height:1.45;font-weight:600;">{intro}</p>
        </td></tr>
        <tr><td style="padding:20px 24px 0 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="33%" style="padding:8px;border:3px solid #0A0A0A;background:#FFFFFF;text-align:center;">
                <div style="font-size:22px;font-weight:900;">{votes_collected}</div>
                <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;">VOTOS</div>
              </td>
              <td width="33%" style="padding:8px;border:3px solid #0A0A0A;border-left:none;background:#FFFFFF;text-align:center;">
                <div style="font-size:22px;font-weight:900;">{included_votes}</div>
                <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;">META</div>
              </td>
              <td width="34%" style="padding:8px;border:3px solid #0A0A0A;border-left:none;background:#7CFC8B;text-align:center;">
                <div style="font-size:22px;font-weight:900;">{aprovo_pct}%</div>
                <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;">APROVO</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 24px 24px 24px;" align="center">
          <a href="{dash_url}" style="display:inline-block;background:#0A0A0A;color:#FFFFFF;text-decoration:none;padding:14px 24px;font-weight:900;letter-spacing:2px;font-size:13px;border:4px solid #0A0A0A;box-shadow:4px 4px 0 #FFD400;">{cta}</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px 24px;">
          <p style="margin:0;font-size:11px;color:#888;line-height:1.4;text-align:center;">
            Recebeste este email por seres anunciante na Besord. Esta notificação é enviada uma única vez por marco (50%, 75%, 100%).
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_milestone_email(*, to_email: str, milestone: int, word: str,
                        votes_collected: int, included_votes: int,
                        aprovo_pct: int, campaign_id: str) -> Optional[str]:
    """Send a milestone email via Resend. Returns Resend email id on success, None on failure."""
    if not _is_configured():
        logger.warning("Resend not configured (RESEND_API_KEY missing) — skipping email")
        return None
    if not to_email:
        logger.warning("No recipient email — skipping milestone email")
        return None
    try:
        params = {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": _milestone_subject(milestone, word),
            "html": _milestone_html(milestone, word, votes_collected, included_votes,
                                    aprovo_pct, campaign_id),
        }
        result = resend.Emails.send(params)
        email_id = result.get("id") if isinstance(result, dict) else None
        logger.info(f"Sent milestone {milestone}% email for {campaign_id} -> {to_email} (id={email_id})")
        return email_id
    except Exception as e:
        logger.error(f"Resend send failed for {campaign_id} milestone {milestone}: {e}")
        return None


def crossed_milestones(prev_count: int, new_count: int, target: int) -> list[int]:
    """Return the list of milestone percentages newly crossed between prev_count and new_count."""
    if target <= 0:
        return []
    prev_pct = (prev_count / target) * 100
    new_pct = (new_count / target) * 100
    return [m for m in MILESTONES if prev_pct < m <= new_pct]
