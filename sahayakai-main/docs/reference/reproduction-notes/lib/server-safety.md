# Lib: Server Safety

**File:** `src/lib/server-safety.ts` (config in `src/lib/safety.ts`)
**Verified:** 2026-06-10

---

## Purpose

Server-side rate limiting using Firestore. Two kinds: a general per-user request limiter and a per-user daily image-generation limiter. Both fail OPEN.

---

## General Rate Limit - `checkServerRateLimit(userId)`

```ts
async function checkServerRateLimit(userId: string): Promise<void>
```

Sliding window over `rate_limits/{userId}.requests` (array of Unix ms):
1. Drop timestamps older than `SAFETY_CONFIG.WINDOW_MS`.
2. If remaining `>= SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW`, throw `Rate limit exceeded. Please wait N minutes.`
3. Otherwise append `now` and write back.

### Config (`SAFETY_CONFIG`, in `src/lib/safety.ts`)

```ts
MAX_REQUESTS_PER_WINDOW: 15
WINDOW_MS: 10 * 60 * 1000   // 10 minutes
```

(Note: 15 requests per 10-minute window, NOT 10/minute.)

---

## Image Rate Limit (per user, per day)

```ts
IMAGE_RATE_LIMIT = { MAX_PER_DAY: 10 }
export const IMAGE_RATE_LIMIT_MAX_PER_DAY = 10

peekImageRateLimit(userId): Promise<boolean>   // true if user is still under cap (no write)
checkImageRateLimit(userId): Promise<void>     // throws if at/over cap, else increments
```

Counter doc: `rate_limits/{userId}_image`. Used by image-generating features (visual aid, avatar) and mirrored by `DAILY_USAGE_CAPS.image_generation` in `usage-tracker.ts`.

---

## Fail-Open Behavior

Every limiter wraps its Firestore work in try/catch:
- Re-throws only the genuine `"Rate limit exceeded"` / cap errors.
- Any other error (init failure, permission error, Firestore unavailable) is logged and swallowed - the request proceeds. Rate limiting is defense-in-depth, not the sole protection.

---

## Client-Side Safety - `src/lib/safety.ts`

`safety.ts` ALSO holds the shared config and client-side helpers:
- `SAFETY_CONFIG` (shared with server limiter above).
- `checkRateLimit()` - client-side localStorage-backed pre-check (`{ allowed, waitTime? }`) for snappy UX; the server check is authoritative.
- `validateTopicSafety(topic)` - `{ safe, reason? }` content guard on user input.
