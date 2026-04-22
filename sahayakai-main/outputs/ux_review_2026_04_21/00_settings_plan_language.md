# Settings, Plan Limits, Language, Logout — SahayakAI (recon 2026-04-21)

## Settings page (`/settings`)
- Professional: years experience (0–60), admin role (HoD/Coordinator/VP/Principal/None), qualifications multi-select
- Language selector (see below)
- Plan card: current plan badge, "View Usage" → `/usage`, "Upgrade" → `/pricing`
- Privacy toggles: Usage Analytics, Community Visibility, Product Updates, AI Training Data (default OFF)
- Export data (ZIP)
- Delete account (type "DELETE", 30-day grace)

## Language switcher
- 11 Indic + English: hi, en, bn, ta, te, kn, ml, gu, pa, mr, or
- Storage hierarchy: localStorage `sahayakai-lang` → Firestore `profile.preferredLanguage` → VIDYA `/api/vidya/profile`
- **Partial translation**: only primary nav labels translated. Error toasts, secondary UI largely English-only.
- Context: `src/context/language-context.tsx` (dictionary lines 19–271)
- Switch is in-context (no full reload)

## Plan/quota (`src/lib/plan-config.ts`)
Free tier monthly:
- lesson-plan: 10
- quiz/worksheet/rubric/teacher-training: 5
- virtual-field-trip: 3
- visual-aid: 2
- avatar: 1
- exam-paper: 3
- parent-message: **0 (paywalled)**
- instant-answer/voice-to-text/assistant: unlimited monthly

Daily caps: instant-answer 20/day, assistant (VIDYA) 50/day

Storage: `usageCounters/{userId}` via `FieldValue.increment`, 60s in-memory cache.

### Plan guard — `src/lib/plan-guard.ts:24-84`
Atomic `reserveQuota` check-and-reserve before handler runs. On handler failure → `rollbackQuota`. On limit → 429 + JSON `{error: 'USAGE_LIMIT_REACHED'|'DAILY_LIMIT_REACHED', message, used, limit, feature, currentPlan}`.

### Cheapest flow to trip cap
**parent-message** — 0 quota on free → 1 call trips. Or visual-aid (2/mo, image gen = real $0.04 × 2).

**Problem for my review**: dev-token = pro plan. To test free-tier UX I need to either:
- Temporarily override x-user-plan header in preview (inject via middleware fiddle)
- Or: create a real Google account on free tier (genuine free UX)

## Double-submit guard
Commit `2ca3f985d`. `useRef` flag set synchronously pre-state-update, cleared in `finally`. Applied to lesson-plan hook and other form handlers.

Verify: rapid double-tap Create → single network request in devtools.

## Billing
- Razorpay (not Stripe) — hosted checkout redirect
- Pro: ₹149/mo or ₹1,399/yr
- Gold/Premium tiers defined but not sold (admin not built)

## Logout
- Dropdown → Sign out → `signOut(auth)` → toast "See you again soon" → redirect `/`
- Clears: Firebase token, auth context user
- Preserves: localStorage language (intentional)

## TTS voice tiers
- Neural2: hi-IN, en-IN
- Wavenet: bn, ta, kn, ml, gu, pa
- Standard: te (no Wavenet available)
- Provider fallback: Sarvam TTS → Google Cloud TTS

## Offline
- NOT yet offline (per memory, confirmed)
- `window.online`/`offline` listeners → toast "Using offline mode"
- Pre-bundled NCERT lesson plans in `src/data/offline-lesson-plans.ts` — fallback only
- PWA install prompt exists but service worker has limited asset cache
- Telemetry queued to IndexedDB offline, drained on reconnect
