# Lib: Analytics & Usage Tracking

**Verified:** 2026-06-10

---

## Analytics Events - src/lib/analytics-events.ts

Client-side event tracker. Batches events and POSTs them to an API route (NOT a direct client Firestore write).

### Event Types

`AnalyticsEventType` (string union, discriminator field `event_type`). Includes:
`session_start`, `session_end`, `page_visit`, `content_created`, `content_edited`,
`content_exported`, `content_shared`, `content_regenerated`, `initiate_generation`,
`feature_first_use`, `feature_use`, `onboarding_milestone`, `challenge_detected`,
`teacher_profile_updated`, and more (see the file for the full list).

Each concrete event is a `BaseEvent` subtype (`SessionStartEvent`, `ContentCreatedEvent`, etc.) carrying `event_type`, `timestamp`, `user_id`, `session_id` (the latter three filled in by the tracker).

### Tracker

`class AnalyticsEventTracker` (singleton via `getAnalyticsTracker()`):
- `track<T>(event)` - enqueues; `user_id`/`session_id`/`timestamp` injected.
- Config: `batchSize: 10`, plus a `batchTimeout` flush timer.
- Critical events (e.g. `challenge_detected`, `session_end`) bypass the queue (`isCriticalEvent`).
- `flush()` / `sendBatch()` POST the queue to **`/api/teacher-activity`** via `fetch`.

### Exported Helpers

```ts
initAnalytics(userId)
trackSessionStart(data)
trackSessionEnd(data)
trackPageVisit(page, referrer?)
flushAnalytics()
// ...one helper per event type
```

---

## Usage Tracker - src/lib/usage-tracker.ts

Tracks per-user resource consumption for cost control and plan enforcement.

### Metric Types (`UsageMetricType`)

`gemini_tokens`, `tts_characters`, `image_generation`, `grounding_calls`, `firestore_writes`.

### Daily Caps + Enforcement (F14-003, 2026-06-06)

`DAILY_USAGE_CAPS` defines per-plan daily limits (e.g. free: 500k tokens, 50k TTS chars, 10 images, 5 grounding calls; pro: 10x). `checkUsage(userId, type)` reads the per-user counter at `daily_user_usage/{uid}_{YYYY-MM-DD}` and throws `PlanLimitExceededError` when over cap.

### API

```ts
UsageTracker.logUsage({ userId, type, value, metadata? })   // object arg, not positional
UsageTracker.trackTTS(userId, characterCount, cacheHit?, provider?)  // provider: 'google'|'sarvam'
UsageTracker.trackImageGen(userId)
// ...other typed wrappers around logUsage
```

`logUsage` increments the daily user counter in Firestore and emits a structured log line for GCP Logging aggregation.

---

## Cost Service - src/lib/services/cost-service.ts

Aggregates usage into estimated dollar cost. Exposed as the `costService` object.

- Gemini estimate: `(tokens / 1_000_000) * 0.10` (~$0.10 per 1M Flash tokens, rough).
- `costService.getDailyCosts(days = 7): Promise<DailyCostRecord[]>` - used by the admin cost dashboard.

---

## Teacher Activity / Health - src/lib/teacher-activity-tracker.ts

Computes a teacher "health score" from activity data (this module is a scorer, not a session timer).

- `calculateTeacherHealthScore(data: TeacherActivityData): TeacherHealthScore`
- Internal sub-scores: activity, engagement, success, growth (`calculate*Score` helpers).
- `getRiskLevel(score)` → `'healthy' | 'at-risk' | 'critical'`.

Impact-model math lives under `src/lib/analytics/` (`impact-model.ts`, `impact-score.ts`, `org-aggregator.ts`, `time-saved-heuristic.ts`).

---

## Aggregator - src/lib/aggregator.ts

```ts
export async function aggregateUserMetrics(uid: string): Promise<void>
```

Recomputes a user's impact score (via the health-score path) and writes `users/{uid}.impactScore`. Guards against empty uid; logs failures via the structured `logger`. Called fire-and-forget after content creation/sharing - never awaited by user-facing actions.

NOTE: this lives at `src/lib/aggregator.ts`, not `src/app/actions/aggregator.ts`.
