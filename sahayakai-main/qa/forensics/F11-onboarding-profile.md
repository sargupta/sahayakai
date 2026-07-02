# F11 — Onboarding + Profile Forensic Audit

Scope: onboarding state machine, profile writability, privacy/consent. 17 = role.

Files audited:
- `src/app/onboarding/page.tsx`
- `src/app/actions/profile.ts` (`PROFILE_WRITABLE_FIELDS`)
- `src/app/actions/auth.ts` (`syncUserAction`)
- `src/lib/db/adapter.ts` (`CLIENT_EDITABLE_USER_FIELDS`)
- `src/app/api/user/profile/route.ts`
- `src/app/privacy-for-teachers/consent-form.tsx`
- all 13 UI call-sites of `updateProfileAction`

---

## TL;DR

| # | Severity | Title |
|---|----------|-------|
| F11-1 | **P0** | None found — no UI write path can escalate (`adminRoles`, `plan`, `razorpaySubscriptionId` are blocked at *both* action and adapter layers). |
| F11-2 | **P1** | **Dual-allowlist drift.** Adapter allowlist (57 fields) is a *superset* of action allowlist (49). Fields permitted by the adapter but **silently stripped** at the action layer: `notificationPreferences`, `voicePreferences`, `consentGivenAt`, `consentVersion`, `onboardingComplete`, `teachingGradeLevels`, `phone`, `avatarUrl`, `lastLessonPlanLanguage`, `grades`, `groupsInitialized`. If/when UI tries to write any of these via `updateProfileAction`, the write is silently dropped — no toast, no log. Today no UI does (audited), so this is a latent bug. |
| F11-3 | **P1** | **State-machine bypass.** `onboardingPhase` is in `PROFILE_WRITABLE_FIELDS`. A signed-in client can `updateProfileAction(uid, { onboardingPhase: 'exploring', schoolName: 'x' })` without ever filling subjects/grades/state/board — and the onboarding redirect (`profile.schoolName` check at `onboarding/page.tsx:144`) lets them straight into the app. There is **no server-side gate** that requires the rest of Step 1 fields before granting tool access. |
| F11-4 | **P1** | **`syncUserAction` cannot set `email`.** `email` is NOT in `CLIENT_EDITABLE_USER_FIELDS`, so `dbAdapter.updateUser` strips it. Phone-only sign-in (`email: null`) is therefore safe from a null-overwrite, but the same filter means *every* sign-in's `syncUserAction` write silently drops `email`, `displayName`, `photoURL`-set-to-empty-string, and `uid` updates that auth-context tries to push. Only `displayName` and `photoURL` survive (because they *are* in the adapter allowlist). The Q1.A "syncUserAction nulls email on phone-only auth" worry is therefore neutralised by the adapter, BUT: the code in `src/app/actions/auth.ts:46` (`email: user.email || ""`) is misleading — author thought it was writing email. New-user email actually comes from `POST /api/user/profile` (`createUser`, which bypasses the adapter filter). |
| F11-5 | **P1** | **`syncUserAction` clobbers `displayName`/`photoURL` to empty string** when the auth user has none. Lines `displayName: user.displayName \|\| ""` and `photoURL: user.photoURL \|\| ""` will overwrite a previously-saved displayName/photoURL with `""` if the user re-signs-in via a provider that returned `null` for those (e.g. phone-only). Both fields ARE in the adapter allowlist so the write is NOT filtered. |
| F11-6 | **P1** | **Onboarding Step 1 has no per-section autosave.** Form is only persisted on Submit (`handleStep1Submit` at L283). A user who fills role + school + state + board on a flaky network and refreshes loses all of it. Step 0 (language) is autosaved (L243). Inconsistent — the UX claim of "auto-advance accordion" implies progress is being saved. |
| F11-7 | **P2** | **Consent has no withdrawal path.** `consent-form.tsx` only accepts. There is no UI to clear `privacyAcceptedAt` / `privacyVersion`. Re-accepting a new version simply overwrites — *no history of prior acceptances is kept*. GDPR/DPDP withdrawal-of-consent right is not implementable today without a manual server tool. |
| F11-8 | **P2** | **Consent version-bump replay.** When `PRIVACY_VERSION` bumps (e.g. `2026-04-24-v1` → `v2`), the next acceptance overwrites the older `privacyAcceptedAt`. There is no audit trail of "user accepted v1 on date X, then v2 on date Y." For DPDP compliance evidence this is insufficient. |
| F11-9 | **P3** | **`handleStep1Submit` swallows save errors silently then routes to Step 2 anyway.** Wait — actually verified: the `try/catch` returns out before setStep(2). OK, this one is fine. *(Withdrawn.)* |
| F11-10 | **P3** | **Onboarding completion check is weak.** Redirect-out condition (`onboarding/page.tsx:144`) only checks `profile.schoolName`. So a half-onboarded user (schoolName set via direct API call, but no subjects/grades/board) is bounced past onboarding forever. Combined with F11-3, becomes the bypass. |

---

## Call-site inventory of `updateProfileAction`

| Site | Fields written | All in PROFILE_WRITABLE_FIELDS? |
|------|---------------|----------------------------------|
| `onboarding/page.tsx:234` (saveStep) | dynamic — only ever called with `preferredLanguage` or `onboardingPhase`/`firstGenerationContentId`/`firstGenerationTool` | yes |
| `onboarding/page.tsx:283` (Step1 submit) | `schoolName`, `schoolNormalized`, `educationBoard`, `preferredBoard`, `state`, `subjects`, `gradeLevels`, `preferredLanguage`, `communityIntroState`, `onboardingPhase`, `profileCompletionLevel`, `administrativeRole?` | yes |
| `settings/page.tsx:134` | `photoURL` | yes |
| `settings/page.tsx:147` | `photoURL: null` | yes |
| `privacy-for-teachers/consent-form.tsx:96` | `privacyAcceptedAt`, `privacyVersion` | yes |
| `community/page.tsx:121` | `communityIntroState` | yes |
| `context/language-context.tsx:7421` | `preferredLanguage` | yes |
| `components/app-sidebar.tsx:90` | `featureSpotlightsSeen` | yes |
| `components/onboarding/profile-completion-card.tsx:49` | `profileCompletionLevel`, optional `department`/`designation`/`district`/`bio` | yes |
| `components/edit-profile-dialog.tsx:39` | spread of `displayName`/`designation`/`schoolName`/`department`/`bio`/`yearsOfExperience`/`administrativeRole`/`qualifications` | yes |
| `hooks/use-onboarding-progress.ts:129,137,148,156,181,244,254` | `onboardingPhase`, `onboardingCompletedAt`, `onboardingChecklistItems`, `featureSpotlightsSeen`, `firstGenerationContentId`, `firstGenerationTool`, `aiGenerationCount`, `checklistDismissedAt` | yes |
| `hooks/use-community-intro.ts:83,101` | `communityIntroState`, `aiGenerationCount` | yes |
| `components/mother-tongue-greeting.tsx:75` | `hasHeardGreeting` | yes |

**Result: no UI call-site currently writes a non-allowlisted field.** F11-1 (privilege escalation) is therefore **not exploitable** through `updateProfileAction`. The defence is layered (action + adapter) and correctly excludes `adminRoles`, `plan*`, `razorpaySubscriptionId`, `role`, `isAdmin`, `email`, `uid`, `impactScore`, `badges`, `verifiedStatus`, `followersCount`, `followingCount`, `referralCode`, `fcmTokens`.

---

## Repros

See `F11-repros/`:
- `F11-3-skip-onboarding.md` — bypass Step 1 by direct action call.
- `F11-4-syncUserAction-email-strip.md` — confirm adapter silently drops `email`.
- `F11-5-displayName-clobber.md` — phone-only re-sign-in wipes prior displayName.
- `F11-7-consent-no-withdraw.md` — withdrawal path missing.
- `F11-8-consent-version-history.md` — version bump overwrites without history.

---

## Recommendations

1. **F11-2 (drift)** — derive `PROFILE_WRITABLE_FIELDS` and `CLIENT_EDITABLE_USER_FIELDS` from a single source of truth. Right now they diverge by 8+ fields and neither file references the other.
2. **F11-3 (state-machine bypass)** — gate `onboardingPhase` writes server-side: refuse `'exploring'`/`'first-generation'` if the profile is missing any of `schoolName`, `state`, `subjects[]`, `gradeLevels[]`, `educationBoard`. Returns 400 to the client.
3. **F11-4/5 (`syncUserAction`)** — either (a) remove the misleading `email`/`displayName`/`photoURL` writes and rely on `/api/user/profile` for first-write, or (b) route through `dbAdapter.createUser` (which doesn't filter) on the *first* sync and through a narrowed `updateUser` on subsequent ones. Either way, don't coerce `null → ""` — write `null` (or skip the field) so the merge doesn't blank a populated field.
4. **F11-6 (no autosave)** — `saveStep` each accordion section the same way the language picker does.
5. **F11-7/8 (consent)** — add a `privacyAcceptances` subcollection (`{ acceptedAt, version, withdrawnAt? }`) and a withdrawal action. The `users` doc still mirrors the latest for fast reads.
