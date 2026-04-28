# Phase T addendum — append to sidecar-forensic-remediation-plan.md

**Why this lives here:** the canonical plan
(`sahayakai-main/.claude/plans/sidecar-forensic-remediation-plan.md`) was
not present on this branch when Phase T.1 scaffolding was created. The
text below should be appended to that plan after the existing "What
comes after this plan" bullet list. Update that bullet's last line from

```
- Phase T: RAG over NCERT + state-board corpus.
```

to

```
- Phase T: Flutter app + Firebase AI Logic hybrid inference (offline path).
```

and then append the section that follows.

---

## Phase T — Flutter app + Firebase AI Logic hybrid inference

Tier-2 Firebase capability adoption. Closes the MEMORY.md gap that says
"SahayakAI is NOT yet offline." The Firebase AI Logic Dart SDK exposes
`useHybridInference: true` (still rolling out in `firebase_ai` as of
April 2026), which lets Gemini Nano answer on-device when offline and
cloud answer when online.

### T.1 — Scaffolding (DONE in this commit)

- New `sahayakai-flutter/` directory at the repo root, generated via
  `flutter create --org ai.sahayak --project-name sahayakai`.
- `pubspec.yaml` declares `firebase_core`, `firebase_app_check`,
  `firebase_ai`, `record`, `path_provider`.
- `lib/main.dart` — Firebase + App Check init, home shell with three
  tiles linking to the agent screens.
- `lib/services/sahayakai_ai.dart` — wraps `FirebaseAI.googleAI()` and
  owns three `GenerativeModel` handles (instant-answer, VIDYA classifier,
  voice-to-text). Hybrid toggle staged behind
  `_hybridInferenceAvailable` so we flip one constant the day the SDK
  ships the flag.
- `lib/screens/instant_answer_screen.dart`, `vidya_classifier_screen.dart`,
  `voice_to_text_screen.dart` — minimal demo UIs.
- `flutter analyze` passes. `flutter pub get` resolves on the local
  toolchain (Flutter 3.41.6, Dart 3.11.4).

### T.2 — Parity tests (DEFERRED)

- 100-prompt evaluation set (covers all 11 Indic languages).
- Run on Android emulator with Nano weights downloaded.
- Compare on-device vs cloud responses on LaBSE similarity, language
  match, and intent agreement (for the classifier).
- Acceptance: ≥ 0.85 LaBSE mean, 100% language match, ≥ 95% intent
  agreement.

### T.3 — Rollout (DEFERRED)

- Feature flag `flutterHybridMode = off | shadow | canary | full`,
  mirroring the sidecar ramp pattern.
- Shadow at 5% → diff against current Next.js / sidecar responses.
- Canary at 25% with explicit user opt-in for early adopters.
- Full cutover only after 7 consecutive days within budget + parity.

### Not in Phase T

- Cloud-only agents stay on the sidecar: 9 routable flows + image
  generation. Nano is too small for those.
- Multi-region DR for the Flutter offline cache — out of scope.
