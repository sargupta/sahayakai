# Audit — existing Sahayak parent-calling ("Contact") capability

All paths are relative to `sahayakai-main/`. Audited at commit `1798329e` (branch `feat/mcp-lesson-planner-demo`).

## 1. UI entry point
- **Page:** `src/app/attendance/[classId]/page.tsx`. Each student row has a **Contact** button (`t("Contact")`, ~line 373) → `openContact(student, suggestedReason)` (~line 88). Risk chips also call `openContact`. That opens:
- **Modal:** `src/components/attendance/contact-parent-modal.tsx` → `ContactParentModal`, with steps `reason → note → review → calling → summary`.

## 2. Handlers in the modal (the whole "Contact → Call" flow)
| Step | Handler | HTTP call |
|---|---|---|
| Write the message | `generateMessage()` (~l.358) | `POST /api/ai/parent-message` with body `{studentName, className, subject, reason, teacherNote?, parentLanguage, consecutiveAbsentDays?, performanceContext?}` → `{message, spokenScript, languageCode, wordCount}` |
| Save the outreach record | `saveOutreach(deliveryMethod)` (~l.396) | `POST /api/attendance/outreach` → `{outreachId}` |
| Dial | `handleCall()` (~l.425) = `saveOutreach('twilio_call')`, then `POST /api/attendance/call {outreachId, parentLanguage}` → `{callSid}` | then polls `GET /api/attendance/call-summary?outreachId=` |
| Retry | `handleRetryCall()` → `handleCall()` | — |
| WhatsApp fallback | `handleCopyWhatsApp()` → `saveOutreach('whatsapp_copy')` + clipboard | — |

## 3. Routes and services
**`src/app/api/ai/parent-message/route.ts`** (`POST`, wrapped in `withPlanCheck('parent-message')`)
- Requires the `x-user-id` header (401). Requires studentName, className, subject, reason and parentLanguage (400).
- Calls `dispatchParentMessage` (`src/lib/sidecar/parent-message-dispatch.ts`), which uses Genkit or the ADK sidecar.

**`src/app/api/attendance/outreach/route.ts`** (`POST`)
- `x-user-id` is required (401).
- `dbAdapter.getUser`, then `hasAdvancedPlan(planType)`, else 403 `PREMIUM_REQUIRED`.
- `classes/{classId}.teacherUid === userId`, else 403 (F9-001).
- `students/{studentId}` must exist (404).
- The phone is taken from `students/{studentId}.parentPhone`. **The body's `parentPhone` is ignored** (422 if none).
- **Dedup:** 429 with `retryAfterSeconds` if any non-failed `parent_outreach` exists for this (teacher, student) in the last 5 minutes (F9-003).
- Writes `parent_outreach/{auto}` with `{teacherUid, classId, className, studentId, studentName, parentPhone, parentLanguage, reason, generatedMessage, spokenScript?, deliveryMethod, callStatus, teacherNote?, performanceContext?, subject?, teacherName, schoolName, createdAt, updatedAt}`.

**`src/app/api/attendance/call/route.ts`** (`POST`)
- `x-user-id` is required (401). `{outreachId, parentLanguage}` are required (400).
- **Quiet hours:** `checkCallingWindow()` (`src/lib/calling-hours.ts`, 09:00–21:00 IST) returns 409 `OUTSIDE_CALLING_HOURS` with `nextAllowedAt`. This is enforced before any provider is used.
- **Provider switch** on `VOICE_PROVIDER` (default `twilio`):
  - `exotel`: `forwardToExotel` sends POST `VOICE_EXOTEL_CALL_URL` with `x-user-id`. The voicebot re-checks ownership.
  - `vobiz`: `forwardToVobiz`, which calls `resolveOutreachTarget`, then `placeVobizCall` (`src/lib/vobiz/client.ts`) with tokens from `mintVobizToken` (`src/lib/vobiz/tokens.ts`). The destination can be overridden by `VOBIZ_TEST_OVERRIDE_NUMBER`.
  - `twilio`: needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER`, else 503. Then `resolveOutreachTarget`. The destination can be overridden by `TWILIO_TEST_OVERRIDE_NUMBER`. Language must be in `TWILIO_LANGUAGE_MAP` (else 422), then `getEffectiveMode()`, then the Twilio REST `Calls.json` request with TwiML at `/api/attendance/twiml` and status callback `/api/attendance/twiml-status`. Failures go through `classifyTwilioFailure` / `releasesDedupWindow` (`src/lib/twilio-errors.ts`).
- `resolveOutreachTarget` is the security boundary. It returns 404 if there is no record, 403 if `teacherUid !== userId`, and 422 if the stored `parentPhone` is not E.164 (`isValidE164`).
- Success: updates `parent_outreach` with `{callSid, callStatus:'initiated', deliveryMethod}` and returns `{callSid}`. Provider failures update `callStatus:'failed'` and `callFailureCategory`, then return `{error, code, retryable}` with status 422, 502 or the provider-specific status.
- **Callback URLs are built from the request `Host` header.**

## 4. Authentication and authorization
- Teacher identity: Firebase ID token → `src/middleware.ts` → `x-user-id`. All three routes are under `/api/*`, so they are protected.
- Authorization is **per teacher**: the class must belong to the teacher, and the outreach record must be owned by the teacher.
- Plan: the outreach needs an advanced plan (`hasAdvancedPlan`). parent-message is metered by `withPlanCheck('parent-message')`.
- **No route ever accepts a destination phone number.** The phone always comes from Firestore.
- There is no organisation concept in these routes. Organisations exist separately in `src/lib/organization.ts`: `organizations/{orgId}/members/{userId}` holds `{role: 'admin' | 'teacher'}`, and `users/{uid}.organizationId` is also set.

## 5. Side effects of one Contact → Call
1. A model call that produces the parent message, plus plan-quota consumption for the teacher (`parent-message`).
2. A Firestore write to `parent_outreach/{id}`, which shows up in the teacher's outreach history (`/api/attendance/outreach-records`, `outreach-latest`).
3. **A real outbound phone call** through Twilio, Vobiz or Exotel, unless the provider is unconfigured or a `*_TEST_OVERRIDE_NUMBER` is set.
4. A Firestore update of `callSid` / `callStatus`. Later webhooks (`twiml`, `twiml-status`, `vobiz/answer`, `vobiz/status`) write the transcript, status and summary.

## 6. Safety mechanisms that exist today
- Quiet hours: 409.
- The 5-minute per-student dedup: 429.
- Server-stored phone only.
- E.164 validation.
- `TWILIO_TEST_OVERRIDE_NUMBER` / `VOBIZ_TEST_OVERRIDE_NUMBER` (all calls go to one test number).
- An unconfigured provider returns 503 **before** dialling.
- On this developer machine `.env.local` contains **no** `TWILIO_*`, `VOBIZ_*` or `VOICE_*` variables, so a local call attempt ends at 503 `Twilio not configured` and cannot dial.

## 7. Existing tests
- `src/__tests__/api/attendance-call.test.ts` (19 tests)
- `src/__tests__/api/attendance-outreach.test.ts` (4)
- `src/__tests__/lib/parent-message-dispatch.test.ts` (15)
- `src/__tests__/lib/vobiz/quiet-hours.test.ts` (has a known Windows path-separator failure, which predates this work)
