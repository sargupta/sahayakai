# Lib: Analytics & Usage Tracking

---

## Analytics Events — src/lib/analytics-events.ts

Unified event tracking system. Batches events and flushes to Firestore.

### Event Types

```ts
type AnalyticsEvent =
  | 'session_start'
  | 'session_end'
  | 'page_visit'
  | 'content_created'    // teacher generated AI content
  | 'feature_use'        // specific tool used
  | 'challenge_detected' // safety/content filter triggered
  | 'teacher_profile_updated'
```

### Batching

```
Events queued in memory (array)
Flush trigger:
  - Batch size ≥ 10 events
  - 5 second timeout since last flush
  - Session end (always immediate flush)
  - Critical events: challenge_detected, session_end (bypass queue)
```

### Storage

Flushed to: `analytics/{userId}/{date}/{batchId}` in Firestore

### Usage

```ts
import { trackEvent } from '@/lib/analytics-events';
trackEvent('content_created', { type: 'quiz', gradeLevel: 'Class 5' });
```

---

## Usage Tracker — src/lib/usage-tracker.ts

Tracks API cost metrics for billing analysis.

### Metrics Tracked

| Metric | Unit |
|---|---|
| `gemini_tokens` | token count |
| `tts_characters` | character count |
| `image_generation` | image count |
| `grounding_calls` | call count |
| `firestore_writes` | write count |

### Storage

Two destinations:
1. GCP Cloud Logging (structured log entry per usage event)
2. Firestore `usage_metrics/{YYYY-MM-DD}/{service}` (atomic increment)

### Usage Pattern

```ts
// In API routes (not in flows — flows are called by API routes)
await UsageTracker.logUsage('gemini_tokens', tokenCount, { feature: 'lesson-plan' });
```

---

## Cost Service — src/lib/services/cost-service.ts

Aggregates usage metrics into dollar costs.

### Cost Rates

```ts
const RATES = {
  gemini_tokens: 0.10 / 1_000_000,  // $0.10 per 1M tokens
  image_generation: 0.04,             // $0.04 per image
  // TTS + grounding: Google Cloud pricing
};
```

### getDailyCosts(days = 7)

```
Fetches usage_metrics for last N days
Calculates estimated spend per service per day
Returns: { date, services: { [service]: { count, estimatedCost } } }[]
```

Used by admin cost dashboard.

---

## Teacher Activity Tracker — src/lib/teacher-activity-tracker.ts

Tracks session-level activity for impact score calculation.

### Functions

```ts
startTeacherSession(userId: string): void
endTeacherSession(userId: string): void
trackToolUsage(userId: string, tool: string): void
trackContentSave(userId: string, contentType: string): void
```

Data written to: `teacher_activity/{userId}/{sessionId}`

---

## Aggregator — src/app/actions/aggregator.ts

Server action to calculate and persist a user's impact score.

```ts
export async function aggregateUserMetrics(userId: string): Promise<void> {
  // Count: content created, shared, downloaded
  // Calculate impact score (weighted formula)
  // Update users/{uid}.impactScore
  // Write analytics event
}
```

Called fire-and-forget after content creation/sharing. Never awaited directly by user-facing actions.
