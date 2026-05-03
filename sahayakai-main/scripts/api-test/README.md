# SahayakAI API test harness

Swagger-driven, zero-miss endpoint exerciser for the entire SahayakAI surface
area: 81 Next.js operations + 16 Python sidecar operations + sidecar meta
routes (`/healthz`, `/readyz`, `/.well-known/agent.json`, `/openapi.json`).

## Files

| File | Purpose |
|------|---------|
| `route-manifest.ts` | Source of truth: every Next.js (path, method) pair plus a sample request body. |
| `check-coverage.ts` | Walks `src/app/api/**/route.ts`, fails if any route is missing from the manifest. |
| `run-all.ts` | Test runner. Reads the manifest + sidecar `/openapi.json`, fires one request per op, prints pass/fail/skip. |
| `../../src/lib/openapi-spec.ts` | Generates the OpenAPI 3.0 doc served at `/api/api-docs` (consumed by the Swagger UI at `/api-docs`). |

## Quick start (local develop branch)

```bash
# Terminal 1 — Next.js dev
cd sahayakai-main
npm run dev                    # serves on :3000

# Terminal 2 — Python sidecar dev
cd sahayakai-agents
uv run uvicorn sahayakai_agents.main:app --reload --port 8081

# Terminal 3 — fire the harness
cd sahayakai-main
npx tsx scripts/api-test/check-coverage.ts   # confirms manifest covers every route
npx tsx scripts/api-test/run-all.ts          # exercises every endpoint
```

## What "pass" means

A response with status in the operation's `okStatuses` (default
`200, 201, 202, 204, 401`).

`401` is a deliberate pass for bearer-protected endpoints when no
`FIREBASE_ID_TOKEN` is supplied — it proves:
- the route is mounted,
- the auth middleware runs,
- the request reaches the gate.

For sidecar ops, `400` and `422` are also acceptable — they prove the route is
mounted and Pydantic validation runs (our generic fixture may not satisfy a
specific schema; that's fine).

## Authenticated runs

To get **real responses** (not 401), supply tokens:

```bash
# Get a fresh Firebase ID token by signing in via the dev app or
# `firebase auth:export --project sahayakai-b4248`.
export FIREBASE_ID_TOKEN=eyJhbGc...

# Cron endpoints (jobs/*)
export CRON_SECRET=...

# Razorpay webhook (server-signed)
export RAZORPAY_WEBHOOK_SECRET=...

# Sidecar HMAC body signing (when SAHAYAKAI_REQUIRE_BODY_SIGNATURE=true)
export SAHAYAKAI_REQUEST_SIGNING_KEY=...

# Firebase App Check (when SAHAYAKAI_REQUIRE_APP_CHECK=true)
export APP_CHECK_TOKEN=...

npx tsx scripts/api-test/run-all.ts
```

Without these, you still get a route-mounting smoke test — every endpoint that
exists will return a documented status code.

## Filtering

```bash
npx tsx scripts/api-test/run-all.ts --filter ai/lesson
npx tsx scripts/api-test/run-all.ts --only-next
npx tsx scripts/api-test/run-all.ts --only-sidecar
npx tsx scripts/api-test/run-all.ts --filter parent --verbose
```

## CI integration

```bash
npx tsx scripts/api-test/run-all.ts --junit out/api-test.xml
```

The runner exits 1 if any endpoint failed (excluding documented skips), so it
plugs straight into GitHub Actions.

## Adding a new route

1. Write the route under `src/app/api/...` as usual.
2. Add a single entry to `route-manifest.ts` (path, method, tag, summary, auth, sample body).
3. Run `npx tsx scripts/api-test/check-coverage.ts` — if you forgot the manifest entry, this fails with a clear diff.
4. Re-run `run-all.ts` to confirm the new endpoint is exercised end-to-end.

## Browsable Swagger UI

Visit `http://localhost:3000/api-docs` while the dev server is running. The page
reads from `/api/api-docs`, which now produces a real OpenAPI 3.0 spec built
from the manifest (the previous JSDoc-driven generator returned an empty spec
because no route file had JSDoc annotations).

## Skip semantics

A few endpoints are explicitly skipped (see `skip` field in `route-manifest.ts`):
- `/user/delete-account` — destructive
- `/content/delete` — destructive
- `/attendance/call`, `/attendance/outreach` — initiate real Twilio calls / SMS
- `/analytics/seed` — mutates analytics store
- `/migrate-ncert` — one-shot admin migration

Run those manually against a disposable test account when needed.

## Sidecar coverage

The sidecar list is auto-discovered from FastAPI's live `/openapi.json`, so any
new sidecar route is exercised the moment it's added on the Python side — no
manifest update required.

`SIDECAR_DEFAULT_BODIES` in `route-manifest.ts` provides happy-path fixtures
for known schemas. For unknown new endpoints, the runner sends `{}` and accepts
422 (Pydantic validation error) as a pass.
