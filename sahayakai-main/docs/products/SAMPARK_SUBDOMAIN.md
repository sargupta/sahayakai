# SahayakAI and SamparkAI — two products, one deployable

Status (26 Oct 2026): **implemented and verified locally** (`localhost:3000` and
`sampark.localhost:3000`). **Not deployed.** No DNS record, TLS certificate,
Firebase authorised domain or Cloud Run domain mapping exists for
`sampark.sahayakai.com` yet; the steps are at the end.

## What is where

| Product | Who | Routes (main host) | Routes (SamparkAI host) |
|---|---|---|---|
| SahayakAI | Teachers | `/`, `/lesson-plan`, `/my-library`, … (unchanged) | redirected to the SahayakAI origin |
| SamparkAI public site | Schools, decision makers | `/sampark` | `/` |
| SamparkAI workspace | School administrators | `/sampark/workspace`, `/sampark/[orgId]/…` | `/workspace`, `/[orgId]/…` |

- Code: `src/app/sampark/page.tsx` (site), `src/app/sampark/(workspace)/…`
  (workspace), `src/components/sampark/workspace-frame.tsx` (its sidebar and
  top bar), `src/components/shell/*` (the SideRail both products share).
- `AppShell` renders SahayakAI's chrome (sidebar, VIDYA orb, greeting,
  command palette, tab bar) for everything **except** the `sampark` route
  segment. Detection uses the route tree (`useSelectedLayoutSegment`), not
  the URL, so it is the same on both hosts.
- APIs are unchanged and shared: `/api/sampark/*` (org-admin only, checked on
  the server), plus one new read-only route, `GET /api/me/nav-access`
  (`{ staff, labs }`, navigation only).
- Teacher parent calls from a class register stay in SahayakAI
  (`/attendance/[classId]`); SamparkAI is the school's console.

## How the routing works (`src/middleware.ts`)

On a request whose `Host` is a SamparkAI host:

1. `/api/*`, `/_next/*`, `/__/*` (Firebase auth proxy), `/.well-known/*` and
   any path with a file extension are served as-is.
2. `/sampark/x` → **308** to `/x` (one canonical URL per page).
3. `/to-sahayak/x` and any SahayakAI route (`SAHAYAK_ROUTE_SEGMENTS` in
   `src/lib/products.ts`) → **307** to the SahayakAI origin. A test
   (`src/__tests__/lib/products.test.ts`) fails if a new top-level route in
   `src/app` is missing from that list, so these names are also reserved and
   can never be an orgId.
4. Everything else is **rewritten** to `/sampark/x` at the single page-response
   exit, after every auth and security branch has run.

On the main host, `/sampark/*` is served directly. With
`SAMPARK_CANONICAL_REDIRECT=true` and `NEXT_PUBLIC_SAMPARK_URL` set, it is
308-redirected to the subdomain instead (off by default).

Links: inside SamparkAI use `useSamparkHref()` / `useSahayakHref()`
(`src/components/shell/product-paths.ts`); from SahayakAI use
`samparkUrl()` (`src/lib/products.ts`). Nothing hard-codes a production URL.

`next dev` only: a redirect to its own bind origin (`http://localhost:PORT`)
is rewritten by Next into a relative path, so the middleware answers the
SahayakAI bridge with a tiny refresh page in development. Deployed servers
get the 307.

## Environment variables

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `SAMPARK_HOSTS` | server | `sampark.sahayakai.com,sampark.localhost` | Hostnames (no port) that serve SamparkAI |
| `NEXT_PUBLIC_SAMPARK_URL` | build | unset | SamparkAI origin for links from SahayakAI, e.g. `https://sampark.sahayakai.com`. Unset → `/sampark/...` on the same origin |
| `NEXT_PUBLIC_SAHAYAK_URL` | build | unset | SahayakAI origin for links from SamparkAI. Unset → same origin, or the `/to-sahayak` bridge on a SamparkAI host |
| `SAHAYAK_URL` | server | unset | Where the bridge redirects. Unset → the request host without its `sampark.` label |
| `SAMPARK_CANONICAL_REDIRECT` | server | unset | `true` moves `/sampark/*` on the main host to the subdomain |

No secrets are involved. `NEXT_PUBLIC_*` values are inlined at `next build`.

## Run locally

```powershell
# Firestore emulator (Java 17) on 8086, then seed the demo school:
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8086"; $env:GCLOUD_PROJECT="demo-sahayakai"
$env:SAMPARK_PII_KEY="<32 random bytes, base64>"; $env:SAMPARK_PHONE_PEPPER="local-dev-pepper"
npx tsx scripts/sampark/seed-emulator.ts
# App (same env, plus):
$env:SAMPARK_ENABLED="true"
node node_modules/next/dist/bin/next dev -p 3000
```

- SahayakAI: <http://localhost:3000/>
- SamparkAI site: <http://localhost:3000/sampark> or <http://sampark.localhost:3000/>
- SamparkAI workspace: <http://localhost:3000/sampark/workspace> or <http://sampark.localhost:3000/workspace>
- Development login for the seeded admin: in DevTools,
  `document.cookie = "auth-token=dev-token; path=/"`, then reload (development only;
  see `docs/sampark/RIYA_LOCAL_SETUP.md` §6). Cookies are per host, so set it once
  on each of `localhost` and `sampark.localhost`.

Practice mode never rings a phone; the seeded school's numbers are synthetic.

## To make sampark.sahayakai.com live (owner action)

Nothing below has been done.

1. **DNS.** Add the record Firebase App Hosting / Cloud Run asks for when you
   add the custom domain (`sampark.sahayakai.com`) to the **same** backend
   that serves `www.sahayakai.com`. Wait for the managed TLS certificate.
2. **Firebase Auth.** Authentication → Settings → Authorised domains → add
   `sampark.sahayakai.com`. Sign-in state is per origin: a teacher signed in on
   `www` signs in again on `sampark` (Google one-tap remembers the account).
   The `/__/auth` reverse proxy (next.config.ts) already serves any host; if
   mobile redirect sign-in is used on the subdomain, set
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` per origin or keep popup sign-in there.
3. **Build env.** Set `NEXT_PUBLIC_SAMPARK_URL=https://sampark.sahayakai.com` and
   `NEXT_PUBLIC_SAHAYAK_URL=https://www.sahayakai.com` in `apphosting.yaml`, rebuild.
4. **Verify** on the deployed host: `/` shows the SamparkAI site,
   `/workspace` signs in, `/lesson-plan` lands on `www`, `/api/sampark/me`
   answers 401 without a token.
5. **Then** set `SAMPARK_CANONICAL_REDIRECT=true` so old `/sampark` links move
   to the subdomain.
6. CSP: no change needed (same-origin assets); if a separate SamparkAI service is
   ever split out, add its origin to `connect-src`.
