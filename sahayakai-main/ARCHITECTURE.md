# SahayakAI — AI Provider Health-Check Endpoint · Architecture

Status: **Contract published** (mesh_note key `architecture`)
Last updated: 2026-08-01
Owner: T1 (architect)

This document is the source of truth for the **AI provider health-check endpoint**
(`GET /api/health/ai`) and situates it inside SahayakAI's production, horizontally
scalable architecture. The `[api]`, `[web]`, `[tests]`, and `[docs]` roles build
against the **Contract** in §2 — it is copied verbatim into the shared mesh note.

---

## 1. Feature intent

A **public, zero-cost-to-caller, near-zero-cost-to-us liveness probe for the active
Genkit AI provider.** It answers one question in one round trip: *"can the model that
powers every teacher-facing AI feature actually generate right now, and how fast?"*

Why it matters: SahayakAI's differentiator is AI (quiz, lesson-plan, worksheet,
storyteller, voice). The existing `/api/health` proves the *server* is up and env vars
are *present* — it never touches the model. `/api/ai/quiz/health` proves the model works
but runs a full 3-difficulty quiz generation and is therefore **admin-gated** (it burns
real Vertex quota). Neither is a cheap, unauthenticated model-reachability signal that a
load balancer, uptime monitor, or status page can poll continuously. This endpoint fills
that exact gap: one 1-token generation, public, uncached, and **incapable of throwing**.

```
Uptime monitor / LB / status widget
        │  GET /api/health/ai   (no auth, no body)
        ▼
Cloud Run (Next.js route handler, nodejs runtime, force-dynamic)
        │  ai.generate({ prompt:'ping', maxOutputTokens:1 })   ← Promise.race(6s)
        ▼
Genkit `ai` instance  ──►  Vertex AI  (default: vertexai/gemini-2.5-flash, ADC auth)
                            └► fallback lever: googleai/* via Secret Manager key pool
        ▼
{ status, provider, model, latencyMs, checkedAt, error? }   ← 200 ok/degraded · 503 down
```

---

## 2. The Contract (build against this)

**Endpoint** — `GET /api/health/ai`
**File** — `src/app/api/health/ai/route.ts`
**Auth** — **NONE.** Public probe. Middleware already leaves `/api/health` public; do
**not** add an `x-user-id`/admin gate. (Contrast: `/api/ai/quiz/health` *is* admin-gated
because it runs a full flow.)

**Response body** (JSON, via `NextResponse.json`):

| field       | type                              | notes |
|-------------|-----------------------------------|-------|
| `status`    | `'ok' \| 'degraded' \| 'down'`    | see status rules |
| `provider`  | `string`                          | `usingVertex ? 'vertexai' : 'googleai'` |
| `model`     | `string`                          | `process.env.GENKIT_DEFAULT_MODEL \|\| DEFAULT_MODEL` |
| `latencyMs` | `number`                          | `Date.now()` delta around the probe |
| `checkedAt` | `string`                          | `new Date().toISOString()` |
| `error`     | `string` (optional)               | present **only** when `status==='down'`; the error **name** (`err.name`), e.g. `'TimeoutError'`. **Never** the message — no internal leakage on a public route. |

**HTTP status** — `ok → 200`, `degraded → 200`, `down → 503`.
**Cache** — `Cache-Control: no-cache, no-store, must-revalidate` (mirror `/api/health`).
**Runtime** — `export const runtime = 'nodejs';` and `export const dynamic = 'force-dynamic';`
(the probe does live I/O; it must never be statically optimized or cached).

**Imports** (NO new dependencies):
```ts
import { NextResponse } from 'next/server';
import { ai, DEFAULT_MODEL, usingVertex } from '@/ai/genkit';
import { logger } from '@/lib/logger';
```

**Probe** — a single, tiny, cheap generation. Do **not** call a flow:
```ts
await ai.generate({ prompt: 'ping', config: { maxOutputTokens: 1, temperature: 0 } });
```

**Timeout & thresholds** — `const TIMEOUT_MS = 6000; const DEGRADED_MS = 2500;`
Race the generation against a timeout that **resolves a sentinel** (never leaves an
unhandled rejection):
```ts
const timeout = new Promise<'timeout'>(r => setTimeout(() => r('timeout'), TIMEOUT_MS));
const result = await Promise.race([ai.generate({...}).then(() => 'ok' as const), timeout]);
```

**Status rules**
- `ok`       — generation succeeded **and** `latencyMs <= DEGRADED_MS`
- `degraded` — generation succeeded **and** `DEGRADED_MS < latencyMs <= TIMEOUT_MS`
- `down`     — generation threw **or** the timeout won. `error = err.name` (or `'TimeoutError'`)

**Never throws** — the entire handler body is wrapped in `try/catch`. Any thrown error is
converted to a `status:'down'` 503 with `error = err instanceof Error ? err.name : 'UnknownError'`.
The function must never propagate.

**Logging** (repo `logger` — `info(msg, ctx?, data?)`, `warn(msg, ctx?, data?)`, `error(msg, err?, ctx?, data?)`):
- `ok` → optional `logger.info` (prefer **skip** — probes are high-frequency; don't flood logs)
- `degraded` → `logger.warn('[AI Health] slow provider', 'HEALTH_CHECK', { provider, model, latencyMs })`
- `down` → `logger.error('[AI Health] provider down', error, 'HEALTH_CHECK', { provider, model, latencyMs })`

**Test** — `src/__tests__/api/health-ai.test.ts`
```ts
jest.mock('@/ai/genkit', () => ({
  ai: { generate: jest.fn() },
  DEFAULT_MODEL: 'vertexai/gemini-2.5-flash',
  usingVertex: true,
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json'); // repo convention: polyfill drops bodies
```
- **ok case** — `generate` resolves → `body.status === 'ok'`, `res.status === 200`.
- **down case** — `generate` rejects `new Error('boom')` → `body.status === 'down'`,
  `body.error === 'Error'`, `res.status === 503`.

**Hard constraints** — minimal, production-grade; passes `tsc --noEmit`; mirrors the
conventions in `src/app/api/health/route.ts`.

---

## 3. Components & data flow

| Component | Role in this feature |
|-----------|----------------------|
| **Next.js App Router route handler** (`route.ts`) | Stateless HTTP entry point. Reads no request body, no cookies, no DB. |
| **Genkit `ai` instance** (`@/ai/genkit`) | Central provider abstraction. Already wired to Vertex AI (primary) + Google AI (fallback). We reuse the *singleton* — no second client. |
| **Vertex AI / Google AI** | The upstream being probed. `gemini-2.5-flash` by default. |
| **Structured logger** (`@/lib/logger`) | Emits to Cloud Logging in prod (severity-mapped), console in dev. Degraded/down events become alertable log lines. |

**Data flow**: request → route handler → `ai.generate` (1 token) → provider → measure
latency → classify → JSON response. **No user data touches this path**; the prompt is the
constant literal `'ping'`. Nothing is persisted.

**Tech stack**: Next.js 14 App Router (Node.js runtime on Cloud Run) · Genkit + `@genkit-ai/vertexai` / `@genkit-ai/googleai` · TypeScript (strict) · Jest for unit tests · GCP (Cloud Run, Firestore, Secret Manager, Cloud Logging/Trace) fronted by a **dual-region** global HTTPS LB (asia-south1 Mumbai + asia-southeast1 Singapore).

---

## 4. Statelessness

The handler holds **zero request-scoped state**: no session, no in-memory cache, no
sticky affinity. Every invocation is a pure function of `(current provider config,
provider reachability at call time)`. This is what lets Cloud Run scale it horizontally
to any instance count and place it behind a round-robin LB with no coordination. The only
process-level state it *reads* is the Genkit singleton and env config, both immutable for
the life of the instance.

---

## 5. Async / queues

This probe is **intentionally synchronous and un-queued** — a health check must reflect
*current* reachability, so deferring it to a queue would defeat its purpose. It bounds its
own latency with a 6 s `Promise.race`, so a hung provider can never pin a worker.

Where async/queues *do* live in the wider system (context for other roles): the real AI
workloads (quiz, lesson-plan, worksheet, avatar, voice) run through Genkit flows with
`runResiliently` retry/backoff and a key-pool; heavy or bursty jobs (edu-news, retention
analytics, storage cleanup, export reminders) are **Cloud Scheduler → job routes**,
decoupled from the request path. The health endpoint is the *observability* counterpart to
that async fabric — it tells the fleet whether the shared provider is worth dispatching to.

---

## 6. Caching

- **Response caching: disabled by design** (`no-store` + `force-dynamic`). A cached
  "ok" would be a lie the moment the provider degrades.
- **Client/poller-side throttling** is the correct lever: monitors and the optional status
  widget poll at **≤ 30 s** so we don't self-inflict Vertex load. At 30 s cadence a single
  monitor is ~2,880 tokens/day — negligible.
- **CDN**: the global LB may terminate TLS and route, but this path is marked uncacheable,
  so no edge caching applies. Static assets and cacheable GETs elsewhere ride the CDN; this
  one deliberately does not.

---

## 7. Database — sharding & read-replicas

This endpoint is **database-free** by design (a provider probe must not depend on the DB —
otherwise a DB outage masks a healthy model and vice-versa). Included per the architecture
brief for the surrounding system:

- **Primary store**: **Cloud Firestore** (native mode). Firestore auto-shards on document
  key ranges and horizontally scales reads/writes with no manual sharding — it is the
  managed equivalent of "sharding + read-replicas". Multi-region replication gives
  read-locality and HA.
- **Read-replica pattern**: read-heavy aggregates (dashboards, cost/log views) are served
  from **pre-computed/denormalized collections** updated by scheduled job routes, so hot
  reads never contend with the write path — the Firestore-native form of a read replica.
- **Hot-key avoidance**: high-write paths (telemetry, attendance) use sharded counter /
  time-bucketed document IDs to spread writes across key ranges.
- If a relational store is later introduced, the same principle applies: **read replicas**
  for dashboards/analytics, **partition/shard key** on tenant (school) ID.

The health probe itself must remain independent of all of the above.

---

## 8. Registration / auth model

- **This endpoint: unauthenticated.** It is a public liveness signal (like `/api/health`).
  It reveals only coarse status + latency + model name — no build SHAs, no env-var names, no
  error messages — so it hands attackers nothing. Abuse is bounded by the 1-token probe cost
  and poller throttling; edge rate-limiting (Cloud Armor) is the backstop.
- **App-wide model** (context): Firebase Authentication issues ID tokens; **middleware
  verifies the token and injects `x-user-id`** downstream (Bearer → `x-user-id`). Protected
  routes read that header; admin routes additionally call `validateAdmin(userId)`. This
  endpoint opts *out* of that gate on purpose — adding auth would make it useless to external
  uptime monitors and the public status page.

---

## 9. Autoscaling & load handling

- **Cloud Run** autoscales instances on concurrency/CPU; the stateless handler scales out
  linearly with no coordination.
- **Self-limiting cost**: the 6 s timeout caps worst-case worker occupancy; the 1-token
  probe caps provider cost. Even a misbehaving monitor hammering the endpoint cannot
  exhaust Vertex quota the way an ungated *flow* endpoint could.
- **Dual-region**: the global LB spreads probe traffic across Mumbai + Singapore, so a
  regional provider hiccup shows as `degraded/down` in one region while the other stays
  `ok` — directly actionable for failover.
- **Backpressure**: because it never enqueues and never touches the DB, this endpoint adds
  no load to the async fabric; it only reads the provider it is reporting on.

---

## 10. Observability

- **Structured logs**: `degraded` → `warn`, `down` → `error`, both tagged
  `context:'HEALTH_CHECK'` with `{ provider, model, latencyMs }`. In prod these map to
  Cloud Logging severities (WARNING/ERROR) and become alert conditions.
- **Metrics**: `latencyMs` and `status` are the two signals to chart. Recommended alerts:
  *(a)* `down` in either region for > N consecutive polls → page on-call;
  *(b)* sustained `degraded` → provider-slowness warning (early signal of quota pressure).
- **Tracing**: Genkit's Firebase telemetry (Cloud Trace) is already enabled in prod via
  `initTelemetry()`; the probe's `ai.generate` span appears there for latency forensics.
- **Uptime**: wire this path into GCP Uptime Checks / external monitor as the canonical
  "AI is alive" signal — distinct from `/api/health` (server-alive) and
  `/api/ai/quiz/health` (full-pipeline, admin-only).

---

## 11. Scaling story — 10 → 10k → 1M users

| Scale | What this endpoint does | What the system around it does |
|-------|-------------------------|--------------------------------|
| **10 users** (pilot) | 1–2 external monitors poll every 30 s. Cost ≈ nil. Single Cloud Run region ample. | Single Firestore, single Vertex model, one region. Manual eyeballing of the status widget is enough. |
| **10k users** (growth) | Same 1-token probe; poller cadence unchanged (probe cost is user-independent). LB routes probes to whichever of the 2 regions is nearest. `degraded` starts appearing under real load — the early-warning signal that provider quota needs a bump. | Cloud Run autoscales per region; Firestore auto-shards; scheduled jobs pre-compute dashboards; key-pool + `runResiliently` absorb transient 429s. |
| **1M users** (scale) | The probe is **the fleet's readiness gate**: LBs/monitors in every region consult `/api/health/ai`; a region reporting `down` is drained from rotation automatically. Because it is stateless, DB-free, and self-limiting, its own cost stays flat while everything else scales 100×. | N-region Cloud Run behind the global LB; Firestore multi-region + denormalized read paths; provider capacity via multiple Vertex projects/regions and the Google-AI key-pool fallback; Cloud Armor rate-limits and WAFs the public edge; full alerting on the health signal drives autoscaling and failover. |

**The invariant that makes it scale**: the endpoint's cost and complexity are **constant in
user count**. It is stateless, touches no database, calls the provider exactly once with a
bounded timeout, and can never throw. That is precisely why it can sit at the front of a
million-user fleet as the "is the AI alive?" gate without ever becoming the bottleneck it
is meant to report on.

---

## 12. Role hand-off

- **[api]** — implement `route.ts` per §2. Reuse the `ai` singleton; do not construct a new client; no new deps.
- **[web]** — spec adds no page. If a status widget is added: `GET /api/health/ai`, render a status pill (ok=green/degraded=amber/down=red) + `latencyMs` + `model`; poll ≤ 30 s; treat any non-200 or network timeout as `down`.
- **[tests]** — `health-ai.test.ts` per §2; mock `@/ai/genkit` + `@/lib/logger`; spy `NextResponse.json`; cover ok(200) and down(503).
- **[docs]** — fold §1, §2, and §11 into the feature docs; keep this file as the canonical architecture reference.
