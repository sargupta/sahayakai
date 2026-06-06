# F3 Input-Validation Fix Report

Branch: `fix/f3-input-validation` (off `develop`, isolated worktree `/private/tmp/sahayakai-f3-fixes`)

Closes 4 P1 findings from the F3 forensic. All four target routes now return 4xx
on bad input (no more 5xx body-spread / undefined-env footguns) and have unit
coverage.

| ID     | Route                                  | Class                              | Status |
|--------|----------------------------------------|------------------------------------|--------|
| F3-001 | `POST /api/feedback`                   | Body spread → arbitrary Firestore write | Fixed |
| F3-002 | `POST /api/vidya/profile`              | Arbitrary `profile` → `users/{uid}.jarvis` | Fixed |
| F3-003 | `POST /api/sarkar/verify`              | Unbounded string fields            | Fixed |
| F3-004 | `POST /api/jobs/ai-reactive-reply`     | **CRITICAL polarity — missing env = open endpoint** | Fixed |

---

## F3-001 — `/api/feedback`

File: `src/app/api/feedback/route.ts`

Pre-fix the handler did `await dbAdapter.saveFeedback(userId, { ...body, timestamp })`,
so any caller could write arbitrary keys (e.g. `isAdmin`, `uid`, `__proto__`)
into the feedback document. There was zero schema enforcement.

Fix:
- Added a strict Zod schema `FeedbackSchema` (`feedbackType`, `questionIndex`,
  `quizId`, `difficulty`, `value`, `rating`, `comment`, `context`).
- `.strict()` rejects unknown keys with HTTP 400 — safer than silently
  stripping (the test asserts this).
- Bounded all strings (`comment` ≤ 2000, `quizId` ≤ 128, etc.) and numeric
  ranges (`rating` 1–5, `questionIndex` 0–10000).
- Malformed JSON returns 400, not 500.

## F3-002 — `/api/vidya/profile`

File: `src/app/api/vidya/profile/route.ts`

Pre-fix the handler accepted any `profile` object and wrote it under
`users/{uid}.jarvis`, allowing a caller to smuggle e.g. `sarkarVerified: true`
or `role: 'admin'` into their own user document. Firestore rules would not
catch this because the path lives inside the user's own doc.

Fix:
- Added strict `JarvisProfileSchema` mirroring `TeacherProfile` in
  `src/store/jarvisStore.ts` (`preferredGrade`, `preferredSubject`,
  `preferredLanguage`, `preferredBoard`, `schoolContext`, `lastActiveAt`).
- All fields nullable+optional with bounded lengths.
- Unknown keys → 400.
- `null`/`undefined` values are stripped before the Firestore merge (Firestore
  rejects `undefined`; we treat `null` the same to keep merge semantics
  intuitive).

## F3-003 — `/api/sarkar/verify`

File: `src/app/api/sarkar/verify/route.ts`

Pre-fix UDISE format was checked but `schoolName`, `district`, `state` were
unbounded.

Fix:
- Added `VerifySchema` with `udiseCode` (11–20 chars, whitespace-tolerant),
  `schoolName` (1–120), `district` (≤80, default `''`), `state` (≤80, default `''`).
- Original 11-digit UDISE regex check preserved.
- Malformed JSON → 400.
- The "UDISE code and school name required" 400 message is preserved for the
  missing-required-field path so existing callers/tests still see the same
  error string.

## F3-004 — `/api/jobs/ai-reactive-reply` (CRITICAL polarity fix)

File: `src/app/api/jobs/ai-reactive-reply/route.ts`

Pre-fix:
```ts
const secret = process.env.AI_INTERNAL_SECRET;
if (secret) {
    const provided = req.headers.get('x-internal-secret');
    if (provided !== secret) return 403;
}
// else: NO CHECK — endpoint is wide open
```

This is the textbook fail-open footgun: any environment that forgets to set
`AI_INTERNAL_SECRET` (preview deploys, local dev that gets exposed, a future
Cloud Run revision built before the secret was added) silently exposes the
endpoint to arbitrary callers who can then drive the AI persona system to
post messages into any allowed chat path.

Fix (fail-closed):
```ts
if (!secret) return 503;           // env not configured → service unavailable
if (provided !== secret) return 401;  // bad header → unauthorized
```

Empty-string secret also returns 503 (same semantics as unset). The 401 vs 403
change aligns with semantic correctness — 401 = missing/bad credential.

---

## Tests

New files (all green, 25 tests):

| File | Tests | Asserts |
|------|-------|---------|
| `src/__tests__/api/feedback-route.test.ts`              | 6 | 401, 400 (bad JSON, out-of-range rating, oversize comment, unknown keys), 200 valid |
| `src/__tests__/api/vidya-profile-route.test.ts`         | 6 | 401, 400 (bad JSON, missing profile, unknown keys, wrong type), 200 valid (only allow-listed fields under `jarvis`) |
| `src/__tests__/api/sarkar-verify-route.test.ts`         | 8 | 401, 400 (bad JSON, missing udise, oversize schoolName/district/state, bad UDISE format), 200 valid |
| `src/__tests__/api/ai-reactive-reply-route.test.ts`     | 5 | 503 (no secret), 503 (empty-string secret), 401 (missing header), 401 (mismatch), proceeds when header matches |

Run:
```bash
npx jest src/__tests__/api/{feedback,vidya-profile,sarkar-verify,ai-reactive-reply}-route.test.ts --no-coverage
# Test Suites: 4 passed, 4 total
# Tests:       25 passed, 25 total
```

Typecheck:
```bash
npx tsc --noEmit   # clean
```

---

## 4xx Verification Summary

All four routes return **4xx (or 503 in the fail-closed case), never 5xx**, on
the bad-input shapes from the forensic repros. Confirmed via the new tests:

- `/api/feedback` — 400 on bad JSON, out-of-range numerics, oversize strings,
  unknown keys; 401 unauth; 200 valid.
- `/api/vidya/profile` — 400 on bad JSON, missing profile, unknown keys, wrong
  types; 401 unauth; 200 valid.
- `/api/sarkar/verify` — 400 on bad JSON, missing required fields, oversize
  strings, bad UDISE format; 401 unauth; 200 valid.
- `/api/jobs/ai-reactive-reply` — **503** when `AI_INTERNAL_SECRET` unset
  (fail-closed); 401 on missing/mismatched header; proceeds when matched.
