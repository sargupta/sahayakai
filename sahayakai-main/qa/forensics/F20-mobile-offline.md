# F20 — Mobile + Offline Forensics

**Agent role:** F20 (Mobile + Offline)
**Scope:** Flutter app + on-device AI inference + offline→online sync reconciliation
**Date:** 2026-06-06
**Branch:** feature/q4c-shadow-diff-in-canary
**Project root inspected:** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-flutter/`

## TL;DR

Flutter checkout IS present, but it is Phase T.1 scaffolding only — three demo
screens calling `firebase_ai` 2.3.0 in **cloud-only** mode. **There is no
offline path, no on-device inference, no local store, no sync layer, and no
conflict resolution code in this repo.** The "offline" framing in MEMORY.md
overstates what is implemented: the `_hybridInferenceAvailable` flag is hard-
coded `false` and the SDK does not yet expose the toggle. The app today is a
thin cloud client, not an offline-capable client.

Most of the P0/P1 severities defined for this role (data-loss on sync,
sync-conflict resolution incorrect, offline-mode crashes) **cannot be
evaluated** because the relevant code does not exist. The findings below
are therefore about **gaps** more than about defects.

## Inventory

### Project state

| Item | Value |
|---|---|
| Flutter SDK constraint | `^3.11.4` (Dart) |
| App version | `1.0.0+1` |
| Min Android SDK | `flutter.minSdkVersion` (default, not pinned) |
| Min iOS | 13.0 |
| Firebase deps | `firebase_core ^3.6.0`, `firebase_app_check ^0.3.1`, `firebase_ai ^2.3.0` |
| Voice deps | `record ^5.1.2`, `path_provider ^2.1.4` |
| Local store deps | **NONE** (no sqflite / drift / hive / isar / shared_preferences / sembast) |
| Connectivity deps | **NONE** (no connectivity_plus / internet_connection_checker) |
| Background sync deps | **NONE** (no workmanager / flutter_background_service) |
| `firebase_options.dart` | **MISSING** (per README, `flutterfire configure` not yet run) |
| `google-services.json` / `GoogleService-Info.plist` | **MISSING** |
| Tests | 1 placeholder widget test |

### Agents wired (per memory, "3 agents Firebase AI Logic hybrid inference")

Confirmed in `lib/services/sahayakai_ai.dart`:

1. `instantAnswer` — `gemini-2.5-flash`, temp 0.2, 512 tokens
2. `vidyaClassifier` — `gemini-2.5-flash`, temp 0.0, JSON, 64 tokens (11-way)
3. `voiceToText` — `gemini-2.5-flash`, temp 0.0, 256 tokens

All three are built via `_buildModel()` which **always** falls through to the
cloud-only constructor — the `if (_hybridInferenceAvailable)` block contains
only a commented stub.

---

## Findings

### F20-001 [P1] Hybrid inference flag is permanently off; "offline path" is aspirational

**File:** `lib/services/sahayakai_ai.dart:40-62`

```dart
static const bool _hybridInferenceAvailable = false;

GenerativeModel _buildModel({...}) {
  // ignore: dead_code
  if (_hybridInferenceAvailable) {
    // Once the SDK exposes the flag, swap to:
    //   return FirebaseAI.googleAI().generativeModel(
    //     model: modelId,
    //     useHybridInference: true,
    //     ...
    //   );
  }
  return FirebaseAI.googleAI().generativeModel(
    model: modelId,
    generationConfig: config,
    systemInstruction: systemInstruction,
  );
}
```

Every call from every screen goes to cloud. There is no `try { Nano } catch
{ cloud }`, no connectivity check, no local cache. When the device is
offline, `generateContent` will throw a network error and the UI banner will
just show the exception. MEMORY.md says "3 agents wired to Firebase AI Logic
hybrid inference" — strictly accurate (the wiring exists), but the wiring is
inert. External materials should not claim offline GA on this basis (memory
file `project_offline_status.md` already notes this — keep that warning
loud).

**Severity:** P1 (offline mode does not crash; it simply returns an error
banner. Not data-loss.)
**Fix:** wait for `firebase_ai` to ship `useHybridInference`, then flip the
constant. Until then, add an explicit connectivity check + a clearer "you
are offline" UX so users do not see a raw `SocketException` string.

---

### F20-002 [P1] No local store → no queued writes → no offline→online reconciliation surface to test

**Evidence:** `pubspec.yaml` contains zero local-persistence dependencies.
`lib/` contains no repository, no DAO, no outbox queue.

The three demo screens hold their state in `setState()` and discard it on
pop. Nothing is ever written to disk. There is therefore no offline write
that would need to sync, no conflict that could resolve incorrectly, and no
race condition on reconnect — because there is no offline write path at all.

This is the largest gap relative to the "offline-capable" framing. The
production app at `sahayakai-main/` writes to Firestore directly via the
web client; the Flutter shell does not even try to mirror that.

**Severity:** P1 (gap, not defect — no user data exists to lose yet).
**Fix path:** Phase T.2 needs a local store (recommend `drift` for SQL +
codegen, or `isar` for object store) and an outbox queue per collection
(`community_chat`, `connection_requests`, `messages`, voice uploads). Spec
the conflict policy explicitly (last-write-wins vs vector-clock) **before**
writing the merge code.

---

### F20-003 [P1] Voice-to-text records to `getTemporaryDirectory()` — clip is lost on app restart, with no upload retry

**File:** `lib/screens/voice_to_text_screen.dart:53-80`

```dart
final dir = await getTemporaryDirectory();
final path = '${dir.path}/sahayakai_${DateTime.now().millisecondsSinceEpoch}.m4a';
await _recorder.start(const RecordConfig(), path: path);
...
final bytes = await File(path).readAsBytes();
final text = await SahayakAI.instance.transcribe(bytes, mimeType: 'audio/mp4');
```

If the user records, kills the app (or it crashes), and reopens it, the
clip is in `tmp/` (which Android/iOS purge at OS discretion) and the
`_activePath` state field is gone. There is no retry queue, no
"unprocessed clips" view. For a voice-first app aimed at rural teachers
with flaky networks this is a real UX loss, though not data-loss in the
Firestore sense.

Also: a transcription failure (offline, timeout) sets `_error` and **drops
the bytes**. No "save for later" affordance. Compare against the Next.js
voice-message uploader (`src/components/image-uploader.tsx` per memory)
which uses `uploadBytesResumable` — Flutter has none of that.

**Severity:** P1 on rural-flaky-network beat; P2 if you consider it just a
demo screen.
**Fix:** record into application-documents dir, persist a small SQLite row
{path, mime, createdAt, status}, retry on app start with exponential
backoff once connectivity returns.

---

### F20-004 [P2] iOS minimum 13.0; Android minSdk unpinned

**Files:**
- `ios/Runner.xcodeproj/project.pbxproj` → `IPHONEOS_DEPLOYMENT_TARGET = 13.0`
- `android/app/build.gradle.kts` → `minSdk = flutter.minSdkVersion` (Flutter
  3.41 default = API 21 / Android 5.0)

For on-device Gemini Nano (when the SDK exposes it), the realistic device
floor is Android 14 + Pixel 8 / Galaxy S24-class AICore-capable chip and
iOS 18 + Apple Intelligence-eligible devices. The current floors are
*permissive*, which is fine for the cloud-only client we actually have,
but the moment hybrid inference flips on, ~95 % of installed devices will
silently fall back to cloud. Document this clearly so the product team
does not expect "free offline" on the existing user base.

**Severity:** P2 (device-compatibility gap, predictable, no defect today).
**Fix:** when hybrid lands, add a runtime capability check + a UI badge
("on-device on this phone: yes/no"). Pin `minSdk = 24` at least, so the
floor is explicit.

---

### F20-005 [P2] Voice classifier silently parses cloud JSON without schema validation

**File:** `lib/screens/vidya_classifier_screen.dart:42-46`

```dart
final raw = await SahayakAI.instance.ask(SahayakAI.instance.vidyaClassifier, utterance);
final parsed = jsonDecode(raw) as Map<String, dynamic>;
setState(() => _intent = parsed['intent']?.toString() ?? 'unknown');
```

The model is configured with `responseMimeType: 'application/json'` but
there is no `responseSchema`, no validation against the 11 allowed labels,
and no fallback if Nano (when it ships) returns markdown-fenced JSON or a
hallucinated label like `"create_lesson"`. Once on-device Nano kicks in,
language drift on the 8 less-tested Indic languages (bn/ta/kn/ml/gu/pa/te
plus or/as) becomes a real risk.

This is exactly the "P0 — AI inference returns wrong output for ≥1
language" failure mode, but I cannot demonstrate it without running
emulators. Flagging as P2 today + P0 risk for Phase T.2.

**Severity:** P2 (today, cloud only); upgrade to P1 once on-device
inference is live.
**Fix:** add `responseSchema` with `enum` of 11 intents; add a hard
allow-list check in Dart; route `unknown` back to cloud for re-classify.

---

### F20-006 [P2] No `firebase_options.dart` checked in → app cannot run on a fresh clone

`Firebase.initializeApp()` in `main.dart:28` is called with no options.
On a fresh checkout without `flutterfire configure` having been run, this
throws at boot and the `_BootError` widget appears. This is documented in
the README, but it means **no agent (including this one) can actually
build + run the app to repro any of the above** without first wiring the
project. I did not run Flutter; the findings above are static-analysis
only.

**Severity:** P2 (gating dev experience, not a defect).
**Fix:** commit `firebase_options.dart` for the dev project, or document
the bootstrap step in CONTRIBUTING.

---

## Severities I could not evaluate

The role's P0 criteria — *data loss on offline→online sync* and *AI
inference returns wrong output for ≥1 language* — are **not testable on
this checkout**:

- No local writes exist → nothing to lose.
- On-device path is dormant → cannot probe Nano output quality.

If the user wants real P0 coverage, this requires either:
1. Wait for Phase T.2 (parity tests) and re-run, **or**
2. Build a 100-prompt eval harness now against cloud-only and use it as
   the baseline so that the day hybrid flips on, divergence is measurable.

## Repros

None runnable in this checkout (Flutter not invoked, no `firebase_options.dart`).
`F20-repros/` directory created as a placeholder for Phase T.2 eval runs.

## Cross-references

- `sahayakai-flutter/README.md` — Phase T.1 scaffolding scope
- `sahayakai-flutter/PHASE_T_ADDENDUM.md` — Phase T.1 / T.2 / T.3 plan
- MEMORY.md → `project_offline_status.md` (correctly hedges offline GA)
- `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`
  (referenced by memory; not read in this pass)

## Recommendation to the hunt lead

Treat F20 as **"out of scope as P0 here; significant gaps to flag for
Phase T.2."** Real mobile/offline forensics requires either running
Phase T.2 parity tests on an emulator or building that harness as part
of this hunt. Two findings above (F20-002, F20-005) become P0 the moment
Phase T.2 ships and should be re-hunted then.
