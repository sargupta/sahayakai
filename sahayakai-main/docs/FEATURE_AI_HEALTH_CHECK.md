# AI Provider Health-Check Feature

**Endpoint:** `GET /api/health/ai`  
**Status:** ✅ Released (Aug 2026)  
**For detailed architecture & scaling strategy:** see [ARCHITECTURE.md](../ARCHITECTURE.md)

---

## What it does

A **public, cost-efficient probe** that answers one question in one HTTP round-trip:

> *"Can the AI model that powers every teacher-facing feature (quiz, lesson-plan, worksheet, storyteller, voice) actually generate right now, and how fast?"*

### Why you need this

- **Server-alive ≠ AI-alive**: `/api/health` proves the Next.js server and environment are up. It never touches the model.
- **Full pipeline too expensive**: `/api/ai/quiz/health` proves the model works but runs a full 3-difficulty quiz generation—**admin-gated** because it burns real Vertex quota.
- **This fills the gap**: one 1-token generation, public, uncached, and guaranteed never to throw.

### Common use cases

| Who | Why |
|-----|-----|
| **External uptime monitor** (Pingdom, GCP Uptime Checks) | Poll every 30 s to detect when Vertex AI or the provider becomes unreachable. |
| **Load balancer / failover logic** | Drain traffic to a region reporting `down`. |
| **Status page widget** | `/admin/system-health` page shows current AI provider status + latency to school admins. |
| **On-call runbook** | If `degraded` persists, quota may need a bump; if `down`, provider is in an incident. |

---

## How to use it

### Request

```http
GET /api/health/ai
```

No body, no auth, no headers required. Public endpoint.

### Response

**Status 200 (ok or degraded):**
```json
{
  "status": "ok",
  "provider": "vertexai",
  "model": "vertexai/gemini-2.5-flash",
  "latencyMs": 245,
  "checkedAt": "2026-08-01T12:34:56.789Z"
}
```

**Status 200 (degraded example):**
```json
{
  "status": "degraded",
  "provider": "vertexai",
  "model": "vertexai/gemini-2.5-flash",
  "latencyMs": 3100,
  "checkedAt": "2026-08-01T12:34:56.789Z"
}
```

**Status 503 (down):**
```json
{
  "status": "down",
  "provider": "vertexai",
  "model": "vertexai/gemini-2.5-flash",
  "latencyMs": 6001,
  "checkedAt": "2026-08-01T12:34:56.789Z",
  "error": "TimeoutError"
}
```

### Response fields

| Field | Meaning |
|-------|---------|
| `status` | `ok` = success + fast (<2500 ms) · `degraded` = success but slow (2500–6000 ms) · `down` = error or timeout |
| `provider` | `vertexai` (Vertex AI, primary) or `googleai` (Google AI, fallback) |
| `model` | Model ID currently in use (e.g., `vertexai/gemini-2.5-flash`) |
| `latencyMs` | Time in milliseconds from request to generation response |
| `checkedAt` | ISO 8601 timestamp when this check ran |
| `error` | (only when `status === 'down'`) Error name, e.g., `'TimeoutError'` or `'GoogleGenerativeAIError'` |

### Recommended polling cadence

- **Monitors / load balancers**: **30 s or higher**. (1-token probe is cheap; more frequent polling gains nothing.)
- **Status widgets**: **15 s** is typical. UX is responsive without overwhelming.
- **Avoid**: Sub-5-second polling; adds cost with no benefit.

---

## Technical contract

The endpoint is **stateless, database-free, and guaranteed never to throw**:

- **Imports**: Reuses existing `ai` instance and structured logger; no new dependencies.
- **Probe**: Single tiny generation—`ai.generate({ prompt: 'ping', config: { maxOutputTokens: 1, temperature: 0 } })`—via `Promise.race(6000ms)`.
- **Timeout rules**:
  - `ok` — generation succeeds in ≤ 2500 ms
  - `degraded` — generation succeeds in 2500–6000 ms (slow provider warning)
  - `down` — generation throws or exceeds 6000 ms (error name included, not message)
- **HTTP headers**: `Cache-Control: no-cache, no-store, must-revalidate` (always fresh).
- **Runtime**: Node.js, dynamic (never statically optimized).

See [ARCHITECTURE.md §2](../ARCHITECTURE.md#2-the-contract-build-against-this) for the full technical spec.

---

## How it scales

The endpoint's **cost and complexity are constant in user count**—it is the fleet's readiness gate at any scale:

| Scale | Probe traffic | System behavior |
|-------|---|---|
| **10 users** (pilot) | 1–2 monitors @ 30 s cadence | Single Cloud Run, single Vertex model. Manual status checks sufficient. |
| **10k users** (growth) | Same probe; cost user-independent | Cloud Run autoscales; `degraded` warnings appear under load—signal to bump quota. LB routes probes to nearest region. |
| **1M users** (scale) | **Flat cost; powers automatic failover** | Multi-region Cloud Run; LBs/monitors drain regions reporting `down`; fallback provider pools absorb incidents. The endpoint's statelessness + timeout bounds + no-DB design keep it from becoming the bottleneck it reports on. |

**Key invariant**: stateless + database-free + bounded timeout + self-limiting cost = horizontally scalable gate for any fleet size.

See [ARCHITECTURE.md §11](../ARCHITECTURE.md#11-scaling-story--10--10k--1m-users) for the full scaling strategy.

---

## Deployment

Deployed as part of commit `2f8a05617` ([api] route) and `e1435c69b` ([web] status widget).

**Admin status page**: `/admin/system-health` (visible to school admins; polls this endpoint every 15 s).

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Persistent `degraded` | Vertex quota pressure or provider slowness | Check `latencyMs` trend; bump quota if sustainable growth. |
| `down` with `TimeoutError` | Provider hung or regional outage | Check Vertex status; may need to wait for incident resolution. |
| `down` with `GoogleGenerativeAIError` | API key/auth issue; fallback key exhausted | Check Secret Manager key pool; rotate/refill if needed. |
| Endpoint is 503 but no `down` in logs | Handler threw unexpectedly (outer try/catch) | Check Cloud Logging for the error; should not happen in production. |

---

## Further reading

- **[ARCHITECTURE.md](../ARCHITECTURE.md)** — Complete architecture, scaling story, and technical decision rationale.
- **Route implementation** — `src/app/api/health/ai/route.ts`
- **Tests** — `src/__tests__/api/health-ai.test.ts`
- **Admin UI** — `src/app/admin/system-health/page.tsx`
