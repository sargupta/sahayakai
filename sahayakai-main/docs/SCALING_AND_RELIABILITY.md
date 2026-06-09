# SahayakAI — Scaling & Reliability Architecture (0 → 1M)

> Status: living document. Last hardening pass: 2026-06-09 (`fix/launch-hardening-infra`).
> Audience: engineering, ops, investors. Read the **Launch survival kit** first; the
> rest is the post-launch roadmap.

---

## 0. TL;DR

SahayakAI runs on **Cloud Run + Firebase**, serving Indian teachers across 11 languages
with heavy synchronous AI/LLM work. The question driving this doc: *as hundreds →
hundreds-of-thousands → a million teachers join, what breaks, in what order, and what
infra do we need?*

**Three answers up front:**

1. **No Kubernetes.** Cloud Run serves this entire curve. The only future GKE candidate
   is the streaming voice server (long-lived WebSockets), and even that is "maybe later."
2. **The wall is not compute — it's two quotas and one bill.** The binding launch
   constraints are (a) the **regional Cloud Run CPU quota** (20 vCPU in asia-southeast1),
   (b) **Gemini throughput**, and (c) a **runaway-bill** cost-attack surface. Servers are
   the easy part.
3. **You cannot provision for a number you don't know.** Public launch is days away with
   unknown demand. The launch goal is not "handle infinite load" — it is four guarantees
   you *can* make regardless of demand: **don't fall over, don't get a surprise bill,
   degrade gracefully, see it live and react.**

**Two internal numbers that were wrong, corrected (they change everything):**

- ❌ "1M concurrent users → 12,500 instances." Registered ≠ concurrent. For an Indian
  teacher tool, **1M registered ≈ 30k–80k peak concurrent**, and most of those are
  reading cached pages, not firing a 30s generation. Real simultaneous *AI generations*
  at 1M registered is low thousands, bursty.
- ❌ "Voice storage = 18 PB/month = $414M/month." Off by ~1000×. 1M users × 20% recording
  × ~100 msgs/mo × ~180 KB ≈ **3.6 TB/month ≈ ~$85/mo**. Storage is a rounding error;
  egress and retention sprawl are the real concerns.

Getting the denominator right is the single most important step — it is the difference
between a $5k/mo and a $500k/mo plan.

---

## 1. Capacity model (the denominator everything hangs on)

| Milestone | Registered | DAU (~10%) | Peak concurrent (~5% of DAU) | Peak AI gen/min (bursty) |
|---|---|---|---|---|
| **M0 today** | ~10k | ~1k | ~50–150 | <30 |
| **M1** | 100k | ~10k | ~500–1.5k | ~100–300 |
| **M2** | 500k | ~50k | ~3k–8k | ~500–1.5k |
| **M3** | 1M | ~100k | ~6k–16k | ~1k–3k |

> These are **industry-ratio hypotheses, not measured**. Every threshold in this doc must
> be replaced by a number from the k6 load test (`scripts/loadtest/launch-wall.js`) before
> money is committed. Treat the milestones as **concurrency tiers**, not signup counts —
> fixes are gated on "when peak-concurrent crosses X," not "when registrations cross Y."

**Two load *shapes* matter more than the averages:**

1. **The 8 AM IST wall.** Teachers prep before school. India is one timezone — there is no
   load-smoothing across geographies. Expect a **5–10× spike in a 90-minute window, every
   weekday**. This is the design load, not the daily average.
2. **The onboarding stampede.** A single state MoU or viral moment can dump 50k signups in
   a day — each triggering avatar generation, profile writes, and a first lesson plan.
   This is the scariest scenario for a free-to-scale-from-zero service.

---

## 2. Launch survival kit (do before going public)

The brutally-minimal set: items where the *downside is catastrophic* and the *fix is
cheap*. Status reflects the 2026-06-09 hardening pass.

| # | Item | Guarantee | Status |
|---|------|-----------|--------|
| 1 | Raise Cloud Run ceiling + keep warmth | Don't fall over | ⚠️ **BLOCKED on quota** — see §3.A1. Increase filed, pending Google review. |
| 2 | Hard cost cap + budget kill-switch | Don't get a surprise bill | ✅ Budget → Pub/Sub → auto-trip function wired (`infra/billing-killswitch`). App-side flag-read = handoff. Per-user caps already live. |
| 3 | ≥3-key Gemini pool + graceful degradation | Degrade gracefully | ◑ Multi-key path live in `src/ai/genkit.ts`; **verify pool ≥3 in prod Secret Manager**. 503 fallback largely present. |
| 4 | Cloud Armor + App Check at the edge | Protect PII / abuse | ✅ Global HTTPS LB + Cloud Armor `sahayakai-bot-block` already front prod. `/api/ai/*` edge rate-limit ⚠️ **blocked on advanced-rules quota** (filed). |
| 5 | Move Google Search grounding off free 100/day tier | Degrade gracefully | ☐ TODO — Instant Answer grounding. |
| 6 | Live dashboard + alerts + tested rollback | See it live and react | ◑ 8 sidecar/health alerts exist; **added** instance-count, CPU-quota, Gemini-429 alerts (`infra/monitoring/09–11`). Rollback command verified + documented (§7). |
| 7 | One load test of the 8 AM-wall mix | See the knee before launch | ◑ k6 script written (`scripts/loadtest/launch-wall.js`); run against staging to get real numbers. |

Everything below P0 (Redis, async queue, sharded counters, search index, multi-region) is
**post-launch**.

---

## 3. Failure-mode catalogue (by component)

Each item: the failure, the trigger, the fix, and a candor note on whether it's real or
over-engineering.

### A. Compute / Cloud Run

**A1 — Regional CPU quota is the true ceiling (NOT a config flag). 🔴 LAUNCH BLOCKER.**
The prod service `sahayakai-hotfix-resilience` (asia-southeast1) runs at `maxScale=20,
cpu=2, mem=2Gi, startup-cpu-boost on`. The regional quota
`CpuAllocPerProjectRegion = 20000 m-cpu (20 vCPU)` and `MemAllocPerProjectRegion = 40 GiB`
cap **maxScale × cpu**. Consequences:
  - The live `maxScale=20` revision is **grandfathered** (deployed before this quota
    applied). Any **new** revision at `cpu=2` is forced to **maxScale ≤ 10** — a *new
    deploy silently halves capacity*. Verified: `--max-instances=200` admission-fails with
    `CpuAllocPerProjectRegion requested: 400000 allowed: 20000`.
  - **Self-service CLI cannot raise it** (`COMMON_QUOTA_CONSUMER_OVERRIDE_TOO_HIGH,
    max=20000`). A quota *increase request* (→ 200000 vCPU / 200 GiB) **has been filed**
    via the Cloud Quotas API and is **pending Google review** ("cannot grant at this
    moment"). **This needs a human escalation** (Console → IAM & Admin → Quotas, or a
    support case) to land before launch.
  - **Interim relief without a grant:** a new revision at `cpu=1` fits **20 instances**
    inside 20 vCPU (vs 10 at cpu=2). Trade per-request CPU headroom for instance count;
    acceptable for the mostly-proxy main service since heavy AI should split out (A2).
  - **Action:** escalate the quota case now; until granted, do **not** deploy a `cpu=2`
    revision expecting >10 instances. Watch `infra/monitoring/10-cpu-quota-utilization.yaml`.

**A2 — Concurrency 80 vs CPU-bound AI requests.** 80 is fine for cheap proxy requests but
dangerous for routes doing in-process Genkit work — 80 simultaneous 30s generations on
2 vCPU thrash. Fix: *split the service* — keep high concurrency for read/UI/proxy traffic;
run heavy AI routes on a **separate Cloud Run service** with low concurrency (4–8) and more
CPU. Also isolates a lesson-plan storm from starving the login path. Medium effort, high
payoff at M2. (Note: this also interacts with A1 — a separate AI service needs its own
slice of the regional CPU quota.)

**A3 — Cold starts (~5–10s) from a fat image.** Genkit + all GCP SDKs bundled → slow cold
starts; brutal during the 8 AM ramp and onboarding stampede. Fix: `--min-instances` 2–3 so
there's always warm capacity; trim image / lazy-load Genkit; keep startup-cpu-boost on.
Min-instances is the cheap 80% fix. (Currently min-instances is **not** set — a new warm
revision should set it, subject to the A1 quota.)

**A4 — 300s timeout + synchronous heavy work.** A request blocked 90s on image gen holds an
instance hostage. Architecture problem (A2 + queue, §C), not a config fix.

**A5 — Single region (asia-southeast1).** Regional outage = total outage. Real but **low
priority** — single-region is correct until M3. Document the DR gap (§H), don't fix early.

### B. LLM / Gemini pipeline (the real throughput ceiling)

**B1 — Per-project Gemini RPM/TPM quota is the scaling wall, not CPU.** Every AI route is
synchronous Gemini. PayGo Gemini uses *shared dynamic throughput* — under regional
contention you get 429s you can't prevent by scaling Cloud Run. Fixes, in order:
(a) **multi-key pool ≥3 keys** — `src/ai/genkit.ts runResiliently` supports it; single-key
in prod is a latent SPOF (single-key 429 backoff is 20→40s and cascades every AI endpoint
to 503). **Verify the prod `GOOGLE_GENAI_API_KEY` secret holds ≥3 keys.**
(b) client-side rate-limiting + backoff-with-jitter (partially present);
(c) buy **Provisioned Throughput** for the baseline at M2+ so the 8 AM floor is guaranteed;
(d) **alert at 70–80% of quota** — see `infra/monitoring/11-gemini-429-rate.yaml`.

**B2 — Quota-storm cascade.** Already partially hardened (recent 503 classification + 50s
budget guard so typed `AIQuotaExhaustedError` surfaces before the timeout wrapper mislabels
it 500). Keep going: per-upstream **circuit breaker** (one sick model sheds load fast
instead of every request eating the full backoff) + a **graceful degradation** path
(serve cached/templated content + "try again in a minute" instead of a hard error).

**B3 — Google Search grounding (Instant Answer) free-tier cap = 100 queries/day. 🔴**
Hard wall hit on day one of real traffic. Move to paid/metered (or Vertex grounding) before
launch, or gate grounding to high-value queries only. *(Open survival-kit item.)*

**B4 — Cost, not capacity, on image gen.** Visual-aid + avatar at $0.04–0.08/image,
synchronous and 25–90s. At M3 a few % daily usage = thousands of $/day and thousands of
instance-seconds held hostage. Fix: async job queue (§C) + the existing 10/day cap +
prompt-level caching of common visual aids.

### C. Async architecture — the missing backbone

**C1 — There is no job queue.** Every heavy operation runs *inside the HTTP request* — the
structural bottleneck behind A2, A4, B4. Fix: **Cloud Tasks** (native HTTP target, built-in
retry/rate-limit — preferred over Pub/Sub for request-shaped work) → return a job ID in
~200ms → worker Cloud Run service processes → push result via SSE/notification. Highest-
leverage *architectural* change; also the most invasive (touches every AI route's
sync→async contract), so it's **M2**, staged: image gen → exam paper → lesson plan.

**C2 — Cron jobs are fire-and-forget HTTP with no retry.** Daily-briefing / persona-pool /
billing-reconciliation run as Cloud Scheduler → HTTP POST. A transient failure = a silently
skipped run; once billing depends on reconciliation that's a money bug. Fix: Cloud Tasks
(retries) or at minimum dead-letter + alert. Low effort.

### D. Firestore / data layer

> The database itself scales to millions fine. These are **access-pattern** fixes, not a
> "migrate off Firestore" situation.

- **D1 — Hot-document write contention (~1 write/sec/doc).** Viral
  `library_resources/{id}.stats` and `posts/{id}` counters. Fix: **sharded counters**. M1/M2.
- **D2 — Per-user quota-counter contention.** `usageCounters/{uid}` is transaction-written
  on every AI call. The 60s in-memory cache is per-instance and lost across many instances.
  Fix: move quota reservation to **Redis** (atomic INCR) with periodic Firestore flush.
- **D3 — Real-time listener fan-out.** `onSnapshot` on conversations + unread-notifications
  for every signed-in user. 100k concurrent = 200k+ live subscriptions. Fix: keep
  `onSnapshot` only for the *actively open* chat; switch sidebar badges + lists to 30–60s
  polling or FCM invalidation. M2.
- **D4 — Security-rules `exists()`/`get()` on hot paths.** Group-chat reads call
  `exists(.../members/{uid})` per read — uncacheable. Fix: cache membership in
  `user_groups/{uid}`, check client-side; keep the rule as backstop. Low effort.
- **D5 — O(N) teacher-discovery scan.** Discovery loads up to 1000 user docs and scores
  in-app per session. Fix: a **search index** (Algolia / Vertex Vector Search) or
  pre-computed materialized directories. M2; the 1-hour per-user cache buys time.
- **D6 — Notification write amplification.** One write per interaction; 1000 likes = 1000
  writes. Fix: batch/aggregate via a worker + push transient notifications through **FCM**.
- **D7 — Unbounded queries.** A few collection-group queries lack `.limit()`. Add limits +
  pagination. Trivial, do opportunistically.

### E. Caching & shared state — introduce Redis

There is **no shared cache today** — only per-instance in-memory maps (lost on every scale
event) + a Firestore L2 cache. At 100s of instances, per-instance caches have near-zero hit
rates. A single **managed Redis** (Memorystore in-VPC, or Upstash serverless) unlocks
rate-limit state (F), quota counters (D2), VIDYA intent cache, and hot reads at once.
Foundational **M1/M2** dependency, not a feature.

### F. Rate limiting & abuse (security at scale)

**Current posture (verified 2026-06-09):** a **global external HTTPS LB** (IP
`34.50.150.243`) fronts Cloud Run via backend `sahayakai-backend-service`, protected by the
global Cloud Armor policy **`sahayakai-bot-block`**:
  - deny-403 secret/admin path scans (`/.env`, `/.git/`, `/wp-admin`, `phpMyAdmin`, …)
  - deny-403 known scanner IPs
  - **rate-based-ban `/api/auth/*`: 30 req/min/IP → 429 + 10-min ban**
  - default allow

**Gaps:**
- **F1 — No edge rate-limit on `/api/ai/*`** (the expensive paths) or the directory.
  Attempted to add a high anti-farm ceiling (600 req/min/IP — deliberately high to avoid
  banning **NAT'd schools** during the 8 AM wall; precise per-user cost control stays
  app-side). **Blocked:** `SECURITY_POLICY_ADVANCED_RULES_PER_SECURITY_POLICY = 0` (the
  existing path/rate rules are grandfathered; new advanced rules need Cloud Armor
  Enterprise or a quota bump). **Increase filed, pending.** Until then, the app-side
  per-user `DAILY_USAGE_CAPS` + `checkUsage` is the active cost control.
- **F2 — Directory scrape.** Teacher discovery is a **Next server action**
  (`src/app/actions/auth.ts` + `TeacherDirectory`), not a clean `/api/` path — edge
  rate-limiting it is fragile. Tighten per-account limit + cap page size **app-side**
  (handoff). At 1M teachers this PII is a real scrape target.
- **F3 — Abuse vectors at scale:** credential-stuffing, free-tier farming (throwaway
  accounts mining free AI = a *cost* attack), prompt-injection via user content. Fixes:
  App Check everywhere, per-IP + per-account quotas, reCAPTCHA Enterprise, email/phone
  gating of expensive features, spend-based per-account circuit breaker.

### G. Cost guardrails (the failure mode that bankrupts you quietly)

The dangerous failure here isn't downtime — it's a **runaway bill**. Synchronous paid LLM
calls + scale-to-many + a free tier + an abuse vector = a four-figure-per-hour surprise.

**Current posture (verified + hardened 2026-06-09):**
- Budgets exist on project 640589855975: a **₹15k/mo "SahayakAI spend guard" (~₹500/day)**
  + a ₹1k limit budget.
- The spend guard previously had an **empty `notificationsRule`** (email-only). **Now wired
  to Pub/Sub topic `billing-killswitch`.**
- **Auto-trip Cloud Function** (`infra/billing-killswitch/`) subscribes to that topic and,
  at 100% of budget, sets Firestore `system_config/ai_killswitch.enabled = false`. It is
  **trip-only** (never auto-re-enables — a human flips it back) and **fail-safe to ON**
  (app must treat a missing flag as enabled).
- **Per-account daily ceilings** are already enforced app-side (`DAILY_USAGE_CAPS` +
  `usageCounters`); the server-side 10/day image cap holds.

**Handoff (app-side, out of infra scope):** every `/api/ai/*` route + `/api/assistant` must
read `system_config/ai_killswitch` at the top and return the graceful 503 fallback when
`enabled === false`. Until that read lands, the kill-switch is *armed but not honoured*.

### H. Multi-region & DR — deliberately last

Single-region is *correct* until M3. Multi-region Firestore + Cloud Run + global LB +
cross-region LLM quota is real money and complexity for a rare, survivable DR scenario.
**Do not build early.** Now: document the RTO/RPO gap, ensure Firestore backups + storage
versioning are on, keep the deploy reproducible.

### I. Observability & SRE — the prerequisite for everything

**Current posture (verified 2026-06-09):** Cloud Monitoring already has 8 alert policies
(`infra/monitoring/01–08`): sidecar 5xx, Genkit fallback rate, sidecar p95 vs Genkit,
sidecar memory, prod `/api/health` uptime, AppCheck failures, sidecar cold-start, per-agent
5xx; plus a weekly sidecar-cost alert. Sentry is present.

**Added this pass (launch-critical leading indicators that were missing):**
- `09-instance-count-near-max.yaml` — instances ≥ 80% of maxScale (fall-over warning).
- `10-cpu-quota-utilization.yaml` — regional CPU-allocation quota > 80% (the A1 wall).
- `11-gemini-429-rate.yaml` — Gemini 429 rate > 10/min (the B1 wall; needs the
  `gemini_429_total` log metric — create command is in the YAML header).

**Still step zero:** define SLOs (below), and run `scripts/loadtest/launch-wall.js` against
staging to replace every estimated threshold here with a measured knee.

---

## 4. Provisional SLOs (replace with load-test data)

| Surface | SLI | Target |
|---|---|---|
| Page load | p95 latency | < 1.5s |
| AI generation (lesson plan / quiz) | p95 latency | < 30s |
| Image / visual-aid gen | p95 latency | < 60s |
| Availability (core app) | successful requests | ≥ 99.5% |
| AI tier under saturation | hard 500 rate | ~0% (must degrade to handled 503) |
| Edge throttling | 429 rate at the 8 AM wall | < 5% |

---

## 5. Do we need Kubernetes?

**No — not for the app, and probably not at all.** Cloud Run is the right tool for a
stateless HTTP service that is architecturally a sophisticated proxy in front of Firestore +
Gemini. 2026 GCP guidance: start on Cloud Run, graduate *specific* services to GKE only at a
hard wall — GPUs, persistent state, or long-lived connection affinity. The app hits none.

The **only** GKE candidate is the **future streaming voice server** (Pipecat /
`<Connect><Stream>` WebSocket path for Exotel parent calls). Even there, Cloud Run now
supports WebSockets + 60-min timeouts, so GKE is a *maybe later*. **Do not adopt Kubernetes
preemptively** — it's a permanent operational tax (node pools, upgrades, networking, an SRE
skillset to hire) bought against a problem we don't have. This is the #1 thing *not* to do.

---

## 6. Recommended fix order (gated on concurrency, not signups)

**P0 — before any growth push (cheap, high-impact):**
- 🔴 **Escalate the regional CPU/Mem quota increase** (A1) + set `--min-instances` (A3) on
  the next warm revision once granted. *This is the true launch blocker.*
- Budget kill-switch chain ✅ (wired; finish the app-side flag read — G handoff).
- Confirm **≥3-key Gemini pool** in prod + backoff-with-jitter + quota alerts (B1).
- Move Google Search grounding off the free tier (B3).
- Monitoring leading-indicator alerts ✅ (added 09–11) + run the load test (I).
- Cloud Armor `/api/ai/*` edge limit (F1) once the advanced-rules quota is granted.

**P1 — at/approaching M1 (100k):** managed Redis (E, D2, F1); split heavy AI onto a
dedicated low-concurrency service (A2); sharded counters (D1); query limits (D7); cache
group membership (D4); sidebar `onSnapshot` → polling/FCM (D3); cron → Cloud Tasks (C2).

**P2 — at/approaching M2 (500k):** Cloud Tasks job queue (C1, B4); FCM + batched
notifications (D6); search index for discovery (D5); Provisioned Throughput + circuit
breakers (B1c, B2); storage lifecycle policies.

**P3 — at/approaching M3 (1M) or on SLA demand:** multi-region (A5, H); evaluate GKE *only*
for the streaming voice server; CQRS / BigQuery read models if Firestore read cost dominates.

---

## 7. Rollback runbook (verified 2026-06-09)

Deploys use `scripts/safe-deploy.sh` (never raw `gcloud run deploy`) — it builds a warm
`--no-traffic --tag=dep-<sha>` revision that does **not** auto-route. Traffic is flipped
explicitly. The repo's many tagged no-traffic revisions confirm this discipline holds.

**Live serving revision (as of 2026-06-09): `sahayakai-hotfix-resilience-00438-4k5` at
100%.** The newest revision `00509-cuq` (tag `sha-c5d9c4f20`) is a **no-traffic** build from
a parallel work-stream — do **not** roll *forward* to it blindly.

**One-command rollback to a known-good revision:**
```
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region asia-southeast1 \
  --to-revisions sahayakai-hotfix-resilience-00438-4k5=100
```

**⚠️ Recovery must pin a revision, NOT `--to-latest`** — `--to-latest` would route to the
newest (possibly untested no-traffic) revision. Always pin the explicit known-good name.

To list candidates + confirm health before flipping:
```
gcloud run revisions list --service sahayakai-hotfix-resilience \
  --region asia-southeast1 --limit 5 \
  --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)"
```

A live flip-and-back drill was **not** run against prod (it serves real users); the command
syntax + target health were verified read-only. Run the live drill in a maintenance window.

### 7.1 cpu=1 break-glass capacity revision (pre-staged, 0% traffic)

To survive the regional 20-vCPU CPU-allocation quota **without** a quota grant, a config-only
revision is pre-built and warm but **not serving**:

- **Revision:** `sahayakai-hotfix-resilience-00510-lez`, tag `cpu1`
- **Config:** cpu=1 / 2Gi / **concurrency=40** / maxScale=20 (vs live cpu=2 / concurrency=80)
- **Effect:** 20 instances fit inside 20 vCPU (vs 10 at cpu=2) — **doubles the instance ceiling**.
- **Health:** `/api/health` → 200 (verified at the `cpu1---…run.app` tag URL).
- **Staged via** `gcloud run services update … --cpu=1 --max-instances=20 --concurrency=40 --no-traffic --tag=cpu1` (config-only; no rebuild).

**FLIP it** only when alert 09 (instances ≈ maxScale) or 10 (CPU quota > 80%) fires during the
8 AM wall:
```
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region asia-southeast1 --to-latest
```
**REVERT** to the deeper cpu=2 revision instantly:
```
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region asia-southeast1 \
  --to-revisions sahayakai-hotfix-resilience-00438-4k5=100
```
**Tradeoff:** 2× instances but half the CPU each; concurrency dropped to 40 to compensate.
Break-glass lever, not the default — keep cpu=2 (`00438-4k5`) for normal launch load, and the
real fix is the pending regional CPU-quota increase (Appendix), not this.

---

## 8. Critical review — where this plan pushes back on itself

- **Biggest risk is doing too much too early.** Kubernetes, multi-region, Elasticsearch,
  CQRS, local LLM inference — all premature below M2. The failure mode of a small team is
  building hyperscale plumbing for load that never arrives while the 8 AM wall takes you
  down on a quota you didn't raise.
- **The true ceiling is quota + cost, not servers.** Most "scaling" instinct goes to
  compute/k8s; here the regional CPU quota and Gemini throughput + per-call dollar cost are
  the hard, contended resources. Provisioned Throughput and the async queue matter more than
  instance counts.
- **Numbers here are hypotheses.** The concurrency model is ratio-estimation. Replace every
  threshold with load-test data before committing money (why §I is step zero).
- **Async queue is highest-leverage *and* most invasive** — it changes every AI route's
  contract. Sequence it behind good observability so each migrated route is proven healthy.
- **Free tier is a cost-attack surface.** "Scale" includes adversarial scale. The cost
  guardrails (G) and abuse defenses (F) are not optional once a generation costs real cents
  and the directory holds a million teachers' PII.

---

## Appendix — pending quota increases (filed 2026-06-09, awaiting Google)

| Quota | Service | Region | Default | Requested | State |
|---|---|---|---|---|---|
| `CpuAllocPerProjectRegion` | run.googleapis.com | asia-southeast1 | 20000 (20 vCPU) | 200000 | pending |
| `MemAllocPerProjectRegion` | run.googleapis.com | asia-southeast1 | 42949672960 (40 GiB) | 214748364800 (200 GiB) | pending |
| `SECURITY-POLICY-ADVANCED-RULES-per-security-policy` | compute.googleapis.com | global | 0 | 20 | pending |

Check status:
```
gcloud alpha quotas preferences list --service=run.googleapis.com --project=sahayakai-b4248
gcloud alpha quotas preferences list --service=compute.googleapis.com --project=sahayakai-b4248
```
Self-service overrides cannot exceed the default — **escalate via Console (IAM & Admin →
Quotas) or a support case** to get these granted before launch.

---

## Appendix — infra artifacts added in this pass

- `infra/billing-killswitch/` — budget → Pub/Sub → auto-trip AI kill-switch function + deploy script.
- `infra/monitoring/09-instance-count-near-max.yaml` — Cloud Run instance-count alert.
- `infra/monitoring/10-cpu-quota-utilization.yaml` — regional CPU-quota alert.
- `infra/monitoring/11-gemini-429-rate.yaml` — Gemini 429-rate alert.
- `scripts/loadtest/launch-wall.js` — k6 8 AM-wall load test.
- Pub/Sub topic `billing-killswitch` + spend-guard budget wired to it (live infra).
- Cloud Armor `sahayakai-bot-block` audited (already protecting prod); `/api/ai/*` rule
  filed-but-quota-blocked.
