# Lib: IndexedDB (Client-Side Storage)

**File:** `src/lib/indexed-db.ts`
**Verified:** 2026-06-10

---

## Purpose

Client-side persistent storage for draft form state, a lesson-plan cache, buffered telemetry, and an offline message outbox/cache. Used to preserve work and to keep messaging usable offline.

---

## Library

Uses the `idb` npm package (a thin Promise wrapper around native IndexedDB) via `openDB`.

---

## Database

```
DB_NAME    = 'sahayak-ai-db'
DB_VERSION = 3
```

`initDB()` opens the DB and, in the `upgrade` callback, creates any missing object stores.

---

## Object Stores

| Store | Key | Notes |
|---|---|---|
| `drafts` | explicit string key | Auto-saved form state. |
| `lesson_plan_cache` | explicit string key | Cached lesson plans (note: store name uses underscores, not `lesson-plan-cache`). |
| `telemetry` | auto-increment | Buffered analytics/telemetry events; pruned by `pruneOldTelemetry()`. |
| `message_outbox` | explicit key | Pending outbound messages for offline send. |
| `message_cache` | explicit key | Cached conversation messages (has an index, created with options). |

---

## Exported Functions

```ts
initDB(): Promise<IDBPDatabase<SahayakDB>>

// Drafts (caller supplies the key)
saveDraft(key: string, data: any): Promise<...>
getDraft(key: string): Promise<...>

// Lesson-plan / generic cache
saveCache(key: string, data: any): Promise<...>
getCache(key: string): Promise<...>

// Telemetry buffer
logEvent(event: any): Promise<...>          // adds { ...event, timestamp: Date.now() }
getPendingEvents(): Promise<...>            // returns keys + values for flushing
clearEvent(key: number): Promise<void>
pruneOldTelemetry(): Promise<void>          // drops stale telemetry entries
```

Message outbox/cache helpers live in companion modules (`src/lib/message-outbox.ts`, `src/lib/lesson-plan-cache.ts`) which use these same stores.

---

## Browser Support

IndexedDB is available in all modern browsers, but NOT in SSR. Callers guard with `typeof window !== 'undefined'` (or only invoke from `'use client'` effects) before touching the DB.

`pruneOldTelemetry()` is count-based, not time-based: if the telemetry store exceeds `MAX_TELEMETRY_ITEMS`, the oldest keys are deleted down to that cap. There is no 7-day / 24-hour TTL.
