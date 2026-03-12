# Lib: Server Safety

**File:** `src/lib/server-safety.ts`

---

## Purpose

Server-side rate limiting using Firestore. Prevents abuse of AI endpoints and community actions.

---

## checkServerRateLimit(userId: string)

```ts
async function checkServerRateLimit(userId: string): Promise<void>
```

**Algorithm (sliding window):**
```
1. Read rate_limits/{userId}.timestamps (array of Unix ms)
2. Filter out timestamps older than WINDOW_MS (e.g., 60 seconds)
3. If filtered.length >= MAX_REQUESTS: throw new Error('Rate limit exceeded')
4. Append Date.now() to filtered array
5. Write back to Firestore (overwrite entire timestamps array)
```

**Config (SAFETY_CONFIG):**
```ts
WINDOW_MS: 60_000           // 1 minute window
MAX_REQUESTS_PER_WINDOW: 10 // 10 requests per minute per user
```

**Fail-open on non-limit errors:**
```ts
try {
  // rate limit check
} catch (error) {
  if (error.message.includes('Rate limit')) throw error;  // re-throw limit errors
  console.error('Rate limit check failed:', error);       // swallow other errors
  // continue with request — don't block users due to Firestore init issues
}
```

**Rationale for fail-open:** If Firestore is temporarily unavailable, we'd rather serve some requests than block all users. Rate limiting is defense-in-depth, not the only protection.

---

## Where It's Called

```
sendChatMessageAction()  — community chat (most abuse-prone)
createPostAction()       — community posts
AI API routes            — via middleware or route handler
```

---

## Client-Side Safety

**File:** `src/lib/safety.ts` (not to be confused with server-safety.ts)

Client-side content safety checks:
- Basic profanity filter on user inputs
- Max length enforcement
- Sanitizes text before sending to AI

Runs in browser only — server-side is the authoritative check.
