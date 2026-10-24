# SahayakAI — Internal Testing Roadmap (Android)

Status: Draft v1 — app: `com.sargvision.sahayakai`, version `1.0.0+2`, target Android only.
Tooling: Flutter 3.41.6 (FVM), debug APK baseline verified on Windows (`build/app/outputs/flutter-apk/app-debug.apk`).
Source: `docs/flutter/RELEASE.md`, `docs/flutter/HANDOFF.md`, `PLAYSTORE_DEPLOYMENT_GUIDE.md`.

## Phase 0 — Stabilize repository (complete for local work)
- In-progress worktrees must be reconciled before a release candidate is cut.
- `pubspec_overrides.yaml` / patched `lucide_icons` path must not travel with a release build.
- Analyze gate fixed: `flutter analyze` now reports `No issues found!`.
- Debug APK build verified green (`flutter build apk --debug`, exit 0).
- Token guard currently reports pre-existing pill radius violations (999/9999) — documented as exceptions pending relaxation R1; do not treat as a Phase 0 blocker unless product scope changes.
- i18n audit requires Python, which is not installed locally; run it in CI or install Python before release.

## Phase 1 — Release config and secrets (owner-gated)
| # | Task | Status |
|---|---|---|
| 1 | Obtain `upload.keystore` + `key.properties` into `android/app/` | **BLOCKED — not present anywhere on this machine** |
| 2 | Register release keystore SHA-1 + SHA-256 in Firebase for `com.sargvision.sahayakai` | **BLOCKED — needs Founder/Firebase console** |
| 3 | Confirm `versionCode` floor in Play Console (provisional `+2`) | **Needs Play Console owner** |
| 4 | Play Integrity + App Check debug tokens; keep enforcement off internally | Backend + Founder |
| 5 | Add monochrome adaptive icon layer | Optional, recommended |
| 6 | Verify `minSdk` ≥ 21 and `targetSdk` = 34 | Verify before upload |

### Hard blockers discovered
1. `android/app/upload.keystore` and `android/key.properties` are absent; `bash scripts/loop/verify_aab_signer.sh` cannot prove a signed artifact.
2. No Firebase release fingerprints are registered. A signed release build will return `DEVELOPER_ERROR` on Google Sign-In until H4 is done.
3. Play Console ownership / versionCode floor confirmation is outside this repo.

## Phase 2 — Signed release artifact
1. `flutter build appbundle --release --obfuscate --split-debug-info=build/symbols`
2. `bash scripts/loop/verify_aab_signer.sh` must return **MATCH**.
3. Sideload the release APK on emulator + ≥2 physical devices; verify cold boot, sign-in, camera, mic, voice.
4. Archive `build/symbols/` keyed by versionCode.

Exit: signed AAB proven; Google Sign-In works on release build.

## Phase 3 — Play Console internal testing
- App name: SahayakAI
- Privacy policy URL: `https://sahayakai.com/privacy-for-teachers` (not `/privacy`)
- Data Safety: name/email via Google Sign-In, audio (voice), photos (scanner), phone numbers (parent contacts), app activity (lesson plans); sharing with Firebase/Google Cloud, Gemini, Sarvam, Razorpay; retention ≤ 180 days
- Content rating for teachers 18+
- App Signing opt-in → register Play signing SHA in Firebase + `assetlinks.json`
- Create internal testing release, upload AAB, add release notes, target regions
- Tester roster: Google Group or up to 100 emails

## Phase 4 — Execution matrix
### Scenario groups
- T1 Auth & onboarding
- T2 Profile / settings / delete account (5-min re-auth)
- T3 Dashboard & library (20-item cap, metadata detail view)
- T4 Content tools (lesson plan, worksheet, quiz, exam paper, rubric, visual aid, instant answer, assessment scanner, camera, voice)
- T5 VIDYA voice session permissions and typed fallback
- T6 Staffroom / inbox / parent hotline
- T7 Notifications (deferred until FCM wired)
- T8 10 Indic locales and Indic font clipping
- T9 Accessibility and performance (44dp, large text scale, low-end devices)
- T10 Resilience (offline, process death, update over prior build)

### Device matrix
- Android 9 / 11 / 13 / 14
- 5" small / 6.5" normal / 6.7" large / 7" tablet
- 2 GB / 4 GB / 8 GB RAM
- Cheap OEM plus one Samsung or Pixel
- One tester per Indic locale minimum

### Automation per round
- `flutter test`
- `flutter analyze --fatal-infos`
- `bash scripts/verify_build.sh`
- i18n audit: 0 untranslated / 0 identical-to-English
- `bash scripts/loop/verify_aab_signer.sh` on the AAB used for internal upload

## Phase 5 — Triage and iteration
- Daily severity triage (S0–S3), owner assignment, fix in the release branch
- Increment `versionCode` on every upload; archive symbols keyed to that code
- Rollback path: keep prior AAB + symbols
- Keep deferred items explicit with owners (monochrome icon, R8, FCM, App Check enforcement)

## Phase 6 — Promotion decision
Promote internal → closed → production (staged 10% → 50% → 100%) only when:
- 0 open S0/S1; any S2 explicitly accepted by product owner
- Google Sign-In passes on the release build for every internal tester
- No crashes or ANRs in Android Vitals across the cohort soak window (suggest ≥ 7 days)
- All automation gates green on the final SHA
- Data Safety, content rating, privacy policy, store assets approved
- Rollback release identified and symbols archived

## Risks
| Risk | Mitigation |
|---|---|
| Keystore not recoverable | Escalate to whoever holds the Capacitor wrap immediately |
| Firebase release SHA not registered | No release sign-in until done; keep debug-only testing out of release |
| versionCode floor unknown | Confirm in Play Console before first upload |
| App Check enforced too early | Ship header first; enforce only after a clean internal round |
| Dirty repository / worktrees | Reconcile before cutting a candidate |
| No crash SDK wired | Use Play Console Android Vitals + structured tester feedback |

## Immediate next actions
1. Recover `upload.keystore` and `key.properties` from the org secret store.
2. Register release fingerprints in Firebase.
3. Confirm versionCode floor in Play Console.
4. Cut the release branch from the stabilized SHA and build + verify the signed AAB.