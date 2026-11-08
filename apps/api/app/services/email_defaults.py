"""Default transactional email templates. Seeded into `email_templates`; editable in the admin panel."""

from __future__ import annotations


def _layout(title: str, body: str, cta_label: str | None = None, cta_var: str | None = None) -> str:
    cta = (
        f'<p style="margin:28px 0"><a href="{{{{{cta_var}}}}}" style="background:#4F46E5;color:#fff;'
        f'padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">{cta_label}</a></p>'
        if cta_label and cta_var
        else ""
    )
    return (
        '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#F6F7FB;padding:32px">'
        '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E6E8F0;border-radius:14px;padding:32px">'
        '<div style="font-weight:700;color:#0B1033;font-size:16px;margin-bottom:24px">'
        '<span style="color:#4F46E5">&#9679;</span> CustomerSignal AI</div>'
        f'<h1 style="font-size:20px;color:#0B1033;margin:0 0 12px">{title}</h1>'
        f'<div style="color:#3B4262;font-size:14px;line-height:1.6">{body}</div>{cta}'
        '<p style="color:#8A90A8;font-size:12px;margin-top:32px">You are receiving this email because of your '
        'CustomerSignal AI account.</p></div></div>'
    )


DEFAULT_TEMPLATES: list[dict] = [
    {
        "key": "welcome",
        "name": "Welcome",
        "subject": "Welcome to CustomerSignal AI, {{name}}",
        "html_body": _layout(
            "Welcome aboard, {{name}}",
            "<p>Your workspace is ready. Upload a review dataset and CustomerSignal AI will surface recurring "
            "complaints, emerging trends and concrete opportunities.</p>",
            "Open your dashboard", "app_url",
        ),
        "text_body": "Welcome aboard, {{name}}. Open your dashboard: {{app_url}}",
        "variables": ["name", "app_url"],
    },
    {
        "key": "verify_email",
        "name": "Email verification",
        "subject": "Verify your email address",
        "html_body": _layout(
            "Confirm your email",
            "<p>Hi {{name}}, please confirm your email address to activate your account. "
            "This link expires in 48 hours.</p>",
            "Verify email", "verify_url",
        ),
        "text_body": "Hi {{name}}, verify your email: {{verify_url}}",
        "variables": ["name", "verify_url"],
    },
    {
        "key": "reset_password",
        "name": "Password reset",
        "subject": "Reset your CustomerSignal AI password",
        "html_body": _layout(
            "Reset your password",
            "<p>We received a request to reset your password. This link expires in 1 hour. "
            "If you didn't request this, you can ignore this email.</p>",
            "Choose a new password", "reset_url",
        ),
        "text_body": "Reset your password: {{reset_url}} (expires in 1 hour)",
        "variables": ["reset_url"],
    },
    {
        "key": "subscription_confirmed",
        "name": "Subscription confirmation",
        "subject": "You're on the {{plan}} plan",
        "html_body": _layout(
            "Subscription confirmed",
            "<p>Thanks! Your workspace <strong>{{workspace}}</strong> is now on the <strong>{{plan}}</strong> plan.</p>",
            "View billing", "billing_url",
        ),
        "text_body": "Your workspace {{workspace}} is now on the {{plan}} plan. {{billing_url}}",
        "variables": ["workspace", "plan", "billing_url"],
    },
    {
        "key": "payment_failed",
        "name": "Payment failure",
        "subject": "Action needed: payment failed for {{workspace}}",
        "html_body": _layout(
            "We couldn't process your payment",
            "<p>The latest payment for <strong>{{workspace}}</strong> failed. Please update your payment method "
            "to keep your plan active.</p>",
            "Update payment method", "billing_url",
        ),
        "text_body": "Payment failed for {{workspace}}. Update your payment method: {{billing_url}}",
        "variables": ["workspace", "billing_url"],
    },
    {
        "key": "usage_limit_warning",
        "name": "Usage limit warning",
        "subject": "You've used {{percent}}% of your monthly {{metric}}",
        "html_body": _layout(
            "Approaching your plan limit",
            "<p>Your workspace <strong>{{workspace}}</strong> has used {{used}} of {{limit}} {{metric}} this month "
            "({{percent}}%).</p>",
            "Upgrade plan", "billing_url",
        ),
        "text_body": "{{workspace}} used {{used}}/{{limit}} {{metric}} ({{percent}}%). {{billing_url}}",
        "variables": ["workspace", "used", "limit", "metric", "percent", "billing_url"],
    },
    {
        "key": "team_invitation",
        "name": "Team invitation",
        "subject": "{{inviter}} invited you to {{workspace}} on CustomerSignal AI",
        "html_body": _layout(
            "You're invited",
            "<p>{{inviter}} invited you to join <strong>{{workspace}}</strong> as {{role}}. "
            "This invitation expires in 7 days.</p>",
            "Accept invitation", "invite_url",
        ),
        "text_body": "{{inviter}} invited you to {{workspace}} as {{role}}: {{invite_url}}",
        "variables": ["inviter", "workspace", "role", "invite_url"],
    },
    {
        "key": "monitoring_alert",
        "name": "Monitoring alert",
        "subject": "Alert: {{title}}",
        "html_body": _layout("{{title}}", "<p>{{message}}</p>", "View alert", "link"),
        "text_body": "{{title}}\n\n{{message}}\n\n{{link}}",
        "variables": ["title", "message", "link"],
    },
    {
        "key": "announcement",
        "name": "Announcement",
        "subject": "{{title}}",
        "html_body": _layout("{{title}}", "<p>{{body}}</p>", "Open CustomerSignal AI", "app_url"),
        "text_body": "{{title}}\n\n{{body}}",
        "variables": ["title", "body", "app_url"],
    },
    {
        "key": "account_notice",
        "name": "Account notice",
        "subject": "{{subject}}",
        "html_body": _layout("{{subject}}", "<p>{{message}}</p>"),
        "text_body": "{{message}}",
        "variables": ["subject", "message"],
    },
    {
        "key": "support_reply",
        "name": "Support reply",
        "subject": "Re: {{subject}}",
        "html_body": _layout("Reply from CustomerSignal support", "<p>{{message}}</p>", "View ticket", "link"),
        "text_body": "{{message}}\n\n{{link}}",
        "variables": ["subject", "message", "link"],
    },
]
