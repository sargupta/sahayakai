# Profile Data Integrity — Forensic Diagnosis + Strategy

**Date:** 2026-06-06
**Scope:** Why is the SahayakAI user database missing so much data, and how do we fix it permanently?

---

## 1. The numbers

Out of **184 real teachers** in prod (49 AI personas excluded):

| Field | Present | Missing | Severity |
|---|---|---|---|
| `displayName` | 52% | 47% | 🔴 must-have for community / messaging |
| `email` | 29% | 71% | 🔴 must-have for re-auth, recovery, comms |
| `uid` (denormalized) | 45% | 55% | 🟡 derivable from doc id |
| `schoolName` | 39% | 60% | 🔴 must-have for outreach, board context |
| `state` | 35% | 64% | 🔴 must-have for state-board content, language defaults |
| `district` | 24% | 76% | 🟡 nice-to-have |
| `subjects` | 43% | 56% | 🔴 must-have for content generation |
| `gradeLevels` | 37% | 63% | 🔴 must-have for content adaptation |
| `preferredLanguage` | 45% | 55% | 🔴 must-have for UI + AI output |
| `educationBoard` | 14% | 86% | 🟡 inferable from state |
| `phone` | **0%** | **100%** | 🟡 only collected on phone-auth signup |
| `createdAt` | 36% | 64% | 🔴 must-have for retention analysis |
| `lastLogin` | 38% | 62% | 🟡 fixable on next login |
| `planType` | 26% | 74% | 🟡 missing = treated as free (correct default) |
| `onboardingCompleted` | 7% | 93% | 🔴 we are not tracking completion |
| `profileCompletionLevel` | 9% | 91% | 🔴 dashboard meter not wired |

---

## 2. Why is this happening

There are four distinct root causes — not one.

### 2.1 `syncUserAction` writes a user doc immediately on first auth, with no required fields

`src/app/actions/auth.ts:syncUserAction` upserts `users/{uid}` from the Firebase Auth user object the moment any auth method completes. With Firebase Google / phone auth, the available fields are:
- Google: `email`, `displayName`, `photoURL`
- Phone-only: `phone`, sometimes nothing else

The action does an `updateUser` (set with merge), which **creates the doc if it doesn't exist**. After F11-5 it only writes truthy fields, but that means a phone-only signup creates a doc with effectively `{ uid }` and nothing else — and the teacher can then immediately leave the app, never returning to onboarding, and that doc is permanently empty.

### 2.2 The onboarding form is not enforced before the teacher reaches the dashboard

`src/app/onboarding/page.tsx` is a single page with a "Save and continue" flow. It is:
- ✅ **Reachable** from the auth flow
- ❌ **Not blocking** — there is no router-level guard that redirects an incomplete profile back to `/onboarding`. A teacher who closes the tab mid-form lands on the dashboard the next time and never returns.

F11-3 added a server-side guard against advancing `onboardingPhase` without the prerequisites — but that only fires if the client actually submits the onboarding form. If the client never submits, the doc stays half-empty.

### 2.3 Phone number is never asked

Onboarding has no phone field. Google-signup teachers never enter a phone number. The 100% absence is by design — the design is wrong. Phone is the canonical identifier in Indian education (every WhatsApp comm, every parent group, every SMS) and we are not collecting it.

### 2.4 No profile-completion meter visible to the user

`profileCompletionLevel` exists as a field on 9% of docs — likely set by an old experiment. There is no UI element that:
- Computes completion %
- Shows it persistently
- Offers a one-tap "complete now" CTA
- Blocks high-trust actions (parent calls, sharing) on completion ≥ threshold

Teachers have no incentive to fill in their profile because nothing nudges them and nothing depends on it visibly.

### 2.5 No location-based smart defaults

We don't ask the browser for `Geolocation` permission (which could pre-fill state). We don't pre-fill `preferredLanguage` from `navigator.language`. We don't infer `state` from the school name (a Hugging-Face NER pass could do this trivially). Every field is a cold start.

---

## 3. Strategy — three concurrent workstreams

### Workstream A — Onboarding hardening (blocking)

**A1.** Make these fields server-validated as mandatory before `onboardingPhase` can leave `welcome`:
- `displayName` (string, non-empty)
- `state` (one of 28 Indian states + 8 UTs)
- `schoolName` (string, non-empty)
- `subjects` (array, at least 1)
- `gradeLevels` (array, at least 1)
- `preferredLanguage` (one of 11 Indic + English)

**A2.** Add a global router guard in `src/middleware.ts` or a top-level layout: if `req.headers['x-user-id']` is set but `users/{uid}.onboardingCompleted !== true`, redirect to `/onboarding`. Skip the redirect for `/onboarding`, `/api/*`, and static routes.

**A3.** Add an optional phone field to onboarding with a "We'll never share this. Used for parent SMS." copy. Pre-fill if the auth method was phone.

**A4.** Add `educationBoard` field with default = `state_board` if `state` is set, else CBSE.

### Workstream B — Profile completion meter (post-onboarding)

**B1.** Compute `profileCompletionLevel` server-side on every profile write — weight: name 10, state 15, school 15, subjects 15, grades 15, language 10, board 5, phone 10, photoURL 5.

**B2.** Persistent banner on every dashboard page if `profileCompletionLevel < 80`:
- "Complete your profile to unlock parent calls + community sharing"
- Tap → modal with the missing-field form
- Auto-dismiss when ≥ 80%

**B3.** Block parent-call (`/api/attendance/call`) if `state` OR `schoolName` is missing — return 422 with a structured `{ error: 'PROFILE_INCOMPLETE', missing: [...] }`. The dashboard's "Call Parent" handler reads that and pops the completion modal.

### Workstream C — Smart defaults + backfill (one-shot + ongoing)

**C1.** Browser-side smart defaults at first onboarding load:
- `navigator.language` → `preferredLanguage` initial guess
- Geolocation permission → reverse-geocode to state (use Google Maps Geocoding API, already in stack)
- Cached IP → state fallback if geolocation denied

**C2.** School-name → state/district inference: when the teacher types a school name and we have ≥ 3 prior teachers from the same `schoolNormalized`, pre-fill their `state` + `district`.

**C3.** One-shot backfill script `scripts/backfill-profile-from-auth.ts`:
- Walk every doc in `users` with no `email`
- Look up the Firebase Auth user via Admin SDK `auth().getUser(uid)`
- Pull `email`, `displayName`, `photoURL`, and `metadata.creationTime`
- Write only the missing fields (don't clobber teacher edits)

**C4.** Telemetry: log every dropped onboarding so we know which step teachers abandon at. New collection `onboarding_funnel/{uid}` with `{ step, enteredAt, leftAt }`.

---

## 4. What the user gets after this lands

| Before | After |
|---|---|
| Sign up → dashboard with empty profile, app silently degrades | Sign up → onboarding (cannot skip), exits with full profile |
| 60-70% of profiles are unusable for marketing / outreach | 95%+ of profiles have name, state, school, language, subjects, grades |
| Parent calls fire with `schoolName=""` (looks unprofessional to the parent) | Parent calls blocked with a clear "complete profile to unlock" CTA |
| `createdAt` missing on 117 users → no retention cohort analysis possible | One-shot backfill from Firebase Auth fixes 100% of legacy users |
| Indian teacher's first impression: a form with English-default | First impression: language pre-detected, state pre-filled by location |

---

## 5. Risks + non-goals

- **Risk:** mandatory onboarding may bounce teachers who came in for a one-tap demo. **Mitigation:** keep a "Skip for now" option BUT have it set `profileCompletionLevel=0` and trigger the persistent banner immediately.
- **Risk:** geolocation prompt looks scary. **Mitigation:** copy the prompt clearly — "We use your location once to pre-fill your state. We don't track you."
- **Non-goal:** we do NOT make phone mandatory (lots of teachers won't share it). It stays optional but heavily prompted.
- **Non-goal:** we do not collect Aadhaar, salary, or any sensitive PII the platform doesn't need.

---

## 6. Execution order

1. **C3 backfill script** — fast, low risk, fixes 60% of the legacy gap before code ships
2. **A1 + A2 mandatory + redirect guard** — single PR, high impact
3. **B1 + B2 completion meter** — second PR, depends on A1 schema
4. **C1 + C2 smart defaults** — third PR, polish
5. **B3 parent-call gate** — last, depends on B1
6. **C4 funnel telemetry** — anytime, separate PR
