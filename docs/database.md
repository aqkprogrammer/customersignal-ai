# Database

PostgreSQL 15+ with `pgvector` and `pg_trgm`. All primary keys are UUIDs; tenant-owned tables carry `workspace_id`
(FK, indexed) and most have `created_at`/`updated_at`; soft deletion (`deleted_at`) is used for users, workspaces,
projects, businesses, competitors, reviews, reports and leads. Migrations live in `apps/api/migrations`
(`make migrate`). Models: `apps/api/app/models/`.

## Entity overview (47 tables)

| Domain | Tables |
| --- | --- |
| Identity | `users`, `user_profiles`, `user_sessions`, `auth_tokens` |
| Tenancy | `workspaces`, `workspace_members`, `workspace_invitations`, `activity_logs`, `api_keys` |
| Projects | `projects`, `businesses` (own business/product or competitor), `competitors` |
| Reviews | `review_sources` (import batches), `reviews` (+ `embedding vector(512)`), `review_sentiments` (1:1), `review_categories` (system + custom), `review_topics` (complaint/praise/feature/topic signals with verbatim excerpts) |
| Intelligence | `complaint_clusters`, `product_opportunities`, `ai_analysis_results` (validated structured deliverables: insights, outreach packs, gap reports, competitor analyses) |
| Jobs & AI | `analysis_jobs`, `ai_usage_logs` |
| Reports | `reports`, `report_shares` (hashed tokens, expiry, revocation) |
| Outreach | `leads`, `lead_activities` |
| Monitoring | `monitoring_rules`, `monitoring_events`, `notifications` |
| Integrations | `integrations` (Fernet-encrypted credentials), `integration_sync_logs` |
| Billing | `subscription_plans`, `subscriptions` (1 per workspace), `invoices`, `payments`, `usage_records`, `stripe_events` (idempotency) |
| Support & comms | `support_tickets`, `support_messages`, `announcements`, `email_templates`, `email_logs` |
| Platform admin | `admin_users`, `admin_sessions`, `admin_audit_logs`, `feature_flags`, `system_settings` |

## Key relationships

```
workspaces 1─* workspace_members *─1 users 1─1 user_profiles
workspaces 1─* projects 1─* businesses 1─* reviews 1─1 review_sentiments
                                          reviews 1─* review_topics *─1 complaint_clusters
projects 1─* review_sources 1─* reviews
projects 1─* product_opportunities ─? complaint_clusters
projects 1─* leads 1─* lead_activities
workspaces 1─1 subscriptions *─1 subscription_plans
reports 1─* report_shares
monitoring_rules 1─* monitoring_events
admin_users 1─* admin_sessions, admin_audit_logs
```

## Notable constraints & indexes

- `users.email` unique among non-deleted rows (partial index); `users.google_sub` unique.
- `reviews (project_id, content_hash)` unique → idempotent re-imports.
- `workspace_members (workspace_id, user_id)` unique; pending invitation unique per email per workspace.
- `subscriptions.workspace_id` unique; `stripe_subscription_id`, `stripe_invoice_id`, `stripe_payment_intent_id` unique.
- `integrations (workspace_id, provider)` unique.
- Tokens (refresh, reset, verification, invitations, share links, API keys, admin sessions) are stored only as
  HMAC-SHA256 digests.

## Seeding

`python -m app.scripts.seed` (idempotent, also run on API startup) creates plans, system review categories, email
templates, feature flags and default system settings. `--demo` additionally creates `demo@customersignal.local` with a
DEMO workspace: 3 businesses (aesthetics clinic, restaurant, espresso-maker product), 5 competitors, ~230 synthetic
reviews, clusters, opportunities, an outreach lead, a gap report, a competitor analysis, monitoring rules and 3 PDF
reports — all flagged `is_demo`.

## Data retention

`workspaces.data_retention_days` (set in Settings → Workspace) soft-deletes older reviews daily. Account deletion
anonymizes the user and soft-deletes solely-owned workspaces; billing and audit records are retained.
