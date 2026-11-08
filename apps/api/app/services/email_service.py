"""Transactional email via Resend. Without RESEND_API_KEY, emails are logged (never silently dropped)."""

from __future__ import annotations

import html
import logging
import re

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import EmailLog, EmailTemplate
from app.services.email_defaults import DEFAULT_TEMPLATES

log = logging.getLogger("app.email")
_VAR = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def render(template: str, variables: dict[str, object], *, escape: bool) -> str:
    def repl(m: re.Match[str]) -> str:
        value = str(variables.get(m.group(1), ""))
        return html.escape(value) if escape else value

    return _VAR.sub(repl, template)


async def _load_template(db: AsyncSession, key: str) -> dict:
    tpl = await db.scalar(select(EmailTemplate).where(EmailTemplate.key == key))
    if tpl:
        return {"subject": tpl.subject, "html_body": tpl.html_body, "text_body": tpl.text_body}
    for d in DEFAULT_TEMPLATES:
        if d["key"] == key:
            return d
    raise ValueError(f"Unknown email template '{key}'")


async def send_template(db: AsyncSession, to: str, key: str, variables: dict[str, object]) -> EmailLog:
    tpl = await _load_template(db, key)
    subject = render(tpl["subject"], variables, escape=False)
    html_body = render(tpl["html_body"], variables, escape=True)
    text_body = render(tpl["text_body"], variables, escape=False)
    return await send_raw(db, to, subject, html_body, text_body, template_key=key)


async def send_raw(db: AsyncSession, to: str, subject: str, html_body: str, text_body: str,
                   template_key: str | None = None) -> EmailLog:
    entry = EmailLog(to_email=to, subject=subject, template_key=template_key, status="logged")
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY not set — email not sent. To=%s Subject=%s\n%s", to, subject, text_body)
    else:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                    json={"from": settings.email_from, "to": [to], "subject": subject, "html": html_body,
                          "text": text_body},
                )
            if resp.status_code < 300:
                entry.status = "sent"
                entry.provider_message_id = resp.json().get("id")
            else:
                entry.status = "failed"
                entry.error = f"{resp.status_code}: {resp.text[:500]}"
                log.error("Resend error %s", entry.error)
        except httpx.HTTPError as exc:
            entry.status = "failed"
            entry.error = str(exc)
            log.error("Email send failed: %s", exc)
    db.add(entry)
    await db.flush()
    return entry
