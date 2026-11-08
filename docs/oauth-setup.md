# Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create (or pick) a project.
2. **OAuth consent screen** → External → app name "CustomerSignal AI", support email, authorized domain (your
   production domain), scopes `openid`, `email`, `profile`. Publish the app when ready (testing mode limits users).
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `https://app.yourdomain.com` (and `http://localhost:3000` for dev)
   - Authorized redirect URIs: `https://app.yourdomain.com/api/v1/auth/google/callback`
     (and `http://localhost:3000/api/v1/auth/google/callback`)
4. Put the values in `.env` / your hosting provider:
   ```
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
   ```
5. Restart the API. The "Continue with Google" buttons enable automatically (`GET /api/v1/auth/providers`).

## How the flow works

`/api/v1/auth/google/start` → Google consent → `/api/v1/auth/google/callback` (state verified against a signed,
10-minute, path-scoped cookie) → code exchange → OpenID userinfo → user found by Google `sub`, else linked by
**Google-verified** email, else created with a default workspace → session cookies set → redirect to
`/auth/callback` → onboarding (new users) or the requested page. Errors (cancelled consent, bad state, unverified
email, registrations closed) redirect to `/login?error=<code>` with a friendly message. The `next` parameter only
accepts same-site relative paths (no open redirects).
