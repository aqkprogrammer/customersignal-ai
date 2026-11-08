# CustomerSignal AI — web

Next.js 16 app (marketing site, customer app, admin console). See the [root README](../../README.md) and
[docs/local-development.md](../../docs/local-development.md).

```bash
pnpm install
pnpm dev          # http://localhost:3000 (expects the API at API_INTERNAL_URL, default http://localhost:8000)
pnpm test         # Vitest
pnpm test:e2e     # Playwright (needs a running stack)
pnpm build
```
