# Lib: IndexedDB (Client-Side Storage)

**File:** `src/lib/indexed-db.ts`

---

## Purpose

Client-side persistent storage for drafts, lesson plan cache, and telemetry. Used when offline or to preserve form state across navigation.

---

## Library

Uses `idb` npm package — a thin Promise wrapper around native IndexedDB.

---

## Stores

### `drafts`
- Key: auto-increment
- Value: `{ type: ContentType, data: object, savedAt: Date }`
- Purpose: Auto-save form state so teachers don't lose work
- Pruning: entries older than 7 days removed on init

### `lesson-plan-cache`
- Key: `{topic}_{grade}_{subject}_{language}` (composite string)
- Value: `{ plan: LessonPlanSchema, cachedAt: Date }`
- Purpose: Cache recent lesson plans to avoid regenerating identical requests
- TTL: 24 hours

### `telemetry`
- Key: auto-increment
- Value: `{ event: string, data: object, timestamp: Date }`
- Purpose: Buffer analytics events when offline
- Flushed to server on reconnect

---

## Key Functions

```ts
// Drafts
saveDraft(type: ContentType, data: object): Promise<number>
getDraft(type: ContentType): Promise<Draft | null>
clearDraft(type: ContentType): Promise<void>

// Cache
getCachedLessonPlan(key: string): Promise<LessonPlanSchema | null>
cacheLessonPlan(key: string, plan: LessonPlanSchema): Promise<void>

// Telemetry
bufferEvent(event: string, data: object): Promise<void>
flushEvents(): Promise<TelemetryEvent[]>
```

---

## Usage Pattern

In AI tool pages, auto-save triggered on input change with debounce:
```ts
// On form input change (debounced 2s):
await saveDraft('lesson-plan', { topic, gradeLevel, subject, language });

// On page mount (restore if draft exists):
const draft = await getDraft('lesson-plan');
if (draft) { setTopic(draft.data.topic); ... }
```

---

## Browser Support

IndexedDB is available in all modern browsers. Not available in SSR — all calls wrapped with `typeof window !== 'undefined'` guard.
