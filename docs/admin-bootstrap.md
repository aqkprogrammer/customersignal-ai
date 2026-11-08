# Admin bootstrap

Admins live in a separate `admin_users` table. Public signup can never create one. Create the first super-admin with
environment-gated credentials:

```bash
export ADMIN_BOOTSTRAP_EMAIL=you@company.com
export ADMIN_BOOTSTRAP_SECRET=$(openssl rand -hex 24)
cd apps/api && .venv/bin/python -m app.scripts.bootstrap_admin     # prompts for a password (min 12 chars)
```

Non-interactive (CI/containers): also set `ADMIN_BOOTSTRAP_PASSWORD` for that single command, then unset it.
In Docker: `docker compose exec api python -m app.scripts.bootstrap_admin`.

The script refuses to run when an admin already exists (use `--force-additional` deliberately to add another
super-admin). An equivalent one-time HTTP endpoint, `POST /api/v1/admin/auth/bootstrap`, requires both env vars to be
set, the email to match, the secret to match, and **no** admin to exist; it is rate-limited and audit-logged.

After signing in at `/admin/login`:

1. Open the account menu → **Security** and enable TOTP MFA (scan the QR with an authenticator app).
2. Create additional admins under **Admins** with least privilege:
   - `super_admin` — everything
   - `support_admin` — users (suspend/reactivate/notify), workspaces, support, announcements, jobs, audit logs
   - `billing_admin` — subscriptions, payments, revenue, plans
   - `read_only` — read access across the console
3. Remove `ADMIN_BOOTSTRAP_SECRET` from the environment once bootstrapping is complete.

Security properties: separate `SameSite=Strict` session cookie, 8-hour sessions, lockout after 5 failed attempts
(15 minutes), MFA verified before a session is issued, every admin login/mutation/sensitive read is written to
`admin_audit_logs` with IP and user agent, and permissions are checked server-side on every endpoint.
