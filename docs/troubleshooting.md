# Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| Jobs stay "Queued" | No worker running → `make worker`, or set `JOBS_INLINE=true` (dev). If several apps share one Redis, make sure `JOBS_QUEUE_NAME` is unique — otherwise another app's worker can consume your jobs. Stuck pending jobs are re-enqueued automatically every 10 minutes (and on worker start). |
| "Some fields are invalid" on signup with a `.test`/`.local` email | Reserved TLDs are rejected by email validation. Use a real domain (e.g. `example.com` for local tests). |
| Never received the verification email | Without `RESEND_API_KEY` emails are printed to the API log. With Resend, check Admin → Notifications (email log) and your domain verification. |
| `csrf_failed` (403) from scripts | Cookie-authenticated mutations need the `x-csrf-token` header equal to the `cs_csrf` cookie. For server-to-server use the Reviews API with an API key instead. |
| `/api/v1/...` returns 404 from the web origin | `API_INTERNAL_URL` was wrong when the web app was built/started. Rewrites are fixed at build time — rebuild after changing it. |
| `CREATE EXTENSION vector` fails | Install pgvector for your Postgres version (`brew install pgvector`, or use the `pgvector/pgvector` Docker image / a managed provider that supports it). |
| Google button disabled | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` not set on the API. |
| OAuth `invalid_state` | The callback must be served from the same origin as `NEXT_PUBLIC_APP_URL`, and cookies must not be blocked. |
| Billing page says payments aren't configured | `STRIPE_SECRET_KEY` missing; admins can still assign plans manually. |
| Analysis says "Built-in keyword engine" | No AI key configured, the admin forced `heuristic`, or the monthly AI token limit was reached (see the job warnings). |
| Upgrade prompt (402) | Plan limit or feature not in plan — upgrade, or have an admin apply a limit override. |
| Admin locked out | 5 failed logins lock the account for 15 minutes, then it unlocks automatically. If credentials or the MFA device are lost, create a new super-admin from the server with `bootstrap_admin --force-additional` and deactivate the old account. |
| Production API refuses to start | Missing `APP_SECRET_KEY` (≥32 chars), `DATABASE_URL`, `REDIS_URL`, or `JOBS_INLINE=true` in production. |
