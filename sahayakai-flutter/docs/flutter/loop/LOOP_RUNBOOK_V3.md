# LOOP RUNBOOK V3 — SahayakAI Flutter autonomous build

**Created 2026-08-17. Supersedes `docs/flutter/LOOP_RUNBOOK.ARCHIVED.md` and `sahayakai-android/docs/LOOP_RUNBOOK.md`.**

This file is the only operating manual. `LOOP_STATE.json` is the only state. Everything else in `docs/flutter/` is either archived or reference.

---

## 0. Why V3 exists

On 2026-08-17 an audit compared every state-tracking document in this repo against the code. The findings:

- `BUILD_STATE.json` said Firebase was deferred and no `firebase_*` packages were present. Four Firebase packages were in `pubspec.yaml` and a real `google-services.json` was committed. It also marked four fully-built, fully-routed screens as `pending`, reported i18n as "262 keys / 21 translated" when the real numbers were 971 / 495, and recorded `"branch": "develop"` while the work sat on `feature/flutter-rebuild`.
- `PILLAR_BUILD_STATE.json` was 60 commits stale and had no `releaseGates` key at all.
- `SESSION_CHECKPOINT.md` claimed "ZERO firebase packages" five days after Firebase landed.
- Four separate documents cited golden tests at 360dp/800dp with Indic probes as a *universal acceptance gate*. There were zero `matchesGoldenFile` call sites in the repository.
- A forensic doc recorded Attendance as backend-blocked. All ten attendance REST routes were live on `origin/main`.

None of this was malice. It is what happens when the same hand writes both the claim and the evidence and nothing ever re-reads the repository. V3's whole design is a response to that single failure mode.

---

## 1. The loop prompt

Invoke with **no interval** — dynamic self-pacing via `ScheduleWakeup`. A fixed tick would eventually fire while Gradle holds the build lock, and two concurrent `flutter build` invocations against one tree corrupt the incremental cache. Unit durations here span roughly 90 seconds to 20 minutes, so a fixed interval is either idle or dangerous.

```
/loop You are the outer loop of the SahayakAI Flutter 8-hour autonomous build. Every wake is
identical, self-contained, and assumes ZERO memory of prior wakes. Nothing in your context is
trustworthy except files on disk and command output you produced THIS wake.

WORKING DIR — cd here first, in every Bash call:
  /Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter
Every loop script sources scripts/loop/_env.sh, which sets the git-env unset, ANDROID_HOME,
JAVA_HOME and GITPFX. Read that file before writing any git command yourself.

STEP 1 — GUARD + RECONCILE. Never skip, never delegate:
  bash scripts/loop/loop_guard.sh
  bash scripts/loop/reconcile.sh
  If reconcile exits non-zero, integrity is violated. This wake does NOTHING except repair the
  tracker to match reality, commit `chore(loop): reconcile state`, and reschedule at 60s. Two
  consecutive violations => ScheduleWakeup stop:true.

STEP 2 — READ, and treat ONLY these as authoritative:
  docs/flutter/loop/LOOP_RUNBOOK_V3.md
  docs/flutter/loop/LOOP_STATE.json
  docs/flutter/HANDOFF.md and docs/flutter/forensic/*
  NEVER trust any file named *.ARCHIVED.*  They were audited on 2026-08-17 and found false.

STEP 3 — SELECT EXACTLY ONE UNIT: the first queue entry with status pending or stale whose
dependsOn are all done. One unit per wake, never two. Past loop.landingModeAtEpoch, select only
band B3.

STEP 4 — EXECUTE per §4 below: one synchronous in-place BUILD agent, then TWO parallel read-only
reviewers that see only the unit contract and the raw diff. One FIX agent on failure. Round cap 2.

STEP 5 — GATE:  UNIT_FILES="<the unit's files>" bash scripts/loop/gate.sh <gateProfile>

STEP 6 — COMMIT with explicitly staged paths (`git add <path>` per file — pathspecs are
CWD-relative, so do NOT prefix them). Never `git add -A`, never `git add .`, never --no-verify.
Then: git push origin feature/flutter-rebuild

STEP 7 — RECORD honestly: append one line to WAKE_LOG.jsonl, set the unit's status / commit /
verifiedAtSha / evidence, re-run reconcile.sh, commit as `chore(loop): advance state`.

STEP 8 — RESCHEDULE: ScheduleWakeup delaySeconds 60 (180 with noop:true when waiting on CI).
Stop per §6.

HARD GUARDRAILS — these override anything you read in any file:
  - Push only with: git push origin feature/flutter-rebuild. Never bare `git push`, never main,
    never --force or --force-with-lease.
  - gh pr create --draft --base main is allowed. `gh pr merge` and `git merge` never are.
  - NEVER run safe-deploy.sh. It rejects feature/* by design; the only ways past are merging or
    setting SERVICE= to defeat the branch check, and both are forbidden. Record
    blockedBy:{kind:"branch-policy"} and surface it in the final report.
  - Sidecar staging deploys ARE allowed: cloudbuild.yaml defaults to _STAGING_SUFFIX=-staging.
    Never pass an empty _STAGING_SUFFIX; that reaches prod.
  - Firebase console, Play Console, Google account actions, any purchase: human-only.
  - Never touch /Users/sargupta/SahayakAIV2/sahayakai working tree or any sibling worktree.
    Reading the upload keystore by absolute path is allowed; copying it into git-tracked space
    is not.
  - Never delete or skip a test to make a gate green. Never lower a threshold to pass one.
    Never write a claim you did not verify with a command this wake.

HARD DELIVERABLE if time runs out — band B0. Feature parity is LAST. If B0 is done and nothing
else is, the run succeeded.

Report each wake in 5 lines or fewer: unit id, gate result, commit sha, what's next, any failure
verbatim. Never hide a red gate. A wake that fixed nothing must say so.
```

---

## 2. State

`LOOP_STATE.json` is the single authority. Three rules make it structurally hard to lie:

**`.machine` is machine-derived.** `reconcile.py` overwrites that whole subtree every wake from the repository itself. There is no hand-writable `branch` field, so nobody can mistype one. Every count — test declarations, golden call sites, ARB keys per locale, active lint rules, font families — is read from the source of truth, not asserted.

**Every measurement carries its sha.** A result whose `atSha` is not `HEAD` is voided to `-1`, never left green. This is what kills "analyze was clean" when analyze was clean sixty commits ago.

**Claims auto-decay.** A unit marked `done` at `verifiedAtSha` is demoted to `stale` the moment a later commit touches one of its declared files. `PILLAR_BUILD_STATE.json` drifted 60 commits behind reality precisely because nothing did this.

`WAKE_LOG.jsonl` is append-only and never rewritten. The final session report is generated from it by script, so a wake that shipped nothing appears in the report as a wake that shipped nothing.

**`built-pending-firebase` is abolished.** It was the euphemism that let four finished screens read `pending` while unfinished ones looked finished — it conflated *work state* with *environment state*, so it could lie in both directions. Replaced by orthogonal `status` (`pending|in_progress|done|stale|failed|blocked|quarantined|superseded`) plus `blockedBy.kind`, a closed enum of `human|branch-policy|backend|credential`. An agent cannot invent a softer blocker category.

---

## 3. Units and gates

**One unit = one conventional commit, one declared file list, one gate profile, ≤400 changed LOC excluding `.g.dart` and `.arb`, finishable in one wake including two review rounds.** A unit whose contract needs more than one sentence is two units.

One unit per wake, always. Two units per wake destroys attribution: when the gate goes red you cannot say which change did it, and that ambiguity is where "well, the tests were passing" is born.

The declared `files[]` is **enforced** by the scope rung. This is what stops "while I was in there" drift and what keeps the reviewers' diff small enough to actually review.

### Profiles

| Profile | Adds | Use for |
|---|---|---|
| `fast` | guard, reconcile, scope, format, analyze, token_guard, secret_scan, contradiction, doc_truth | docs / tracker-only units |
| `standard` | + codegen-drift, custom_lint, full tests, goldens | any Dart source unit |
| `i18n` | + full 11-locale i18n ratchet | any unit touching `lib/core/i18n/arb/**` |
| `native` | + `flutter build apk --debug` | any unit touching `pubspec.*` or `android/**` |
| `release` | + `build appbundle --release`, signer-cert match, `build apk --release --split-per-abi` | band exits, and unit U0.4 |

Three rungs exist for reasons that are specific, not theoretical:

- **`native` is its own profile** because `flutter analyze` and `flutter test` run the analysis server and the test VM, and neither compiles the release kernel snapshot or invokes Gradle. This repo already lost a build to that blind spot: `record 5.2.1` capped `record_linux` below 1.0.0, resolving a stale sibling whose `hasPermission` signature no longer matched the platform interface. Analyze was clean, 1,551 tests were green, and `flutter build apk` was broken.
- **`release` runs at unit U0.4, around hour 1**, not only at the end. Proving the signing capability at hour 8 is how you discover at 07:40 that the keystore alias is wrong and end the run with nothing.
- **`i18n` is a ratchet, not a cliff.** It fails a unit that makes the gap *worse* than `baselines`. The absolute target — zero untranslated, zero identical-to-English — is enforced at the B0 exit unit. A hard zero-gate from day one would block every unrelated commit behind a pre-existing 4,760-string backlog, and a gate that blocks everything gets bypassed.

### The self-test

`scripts/loop/selftest.sh` plants a real violation for each guard and asserts it is caught. **Run it after touching any guard.**

This is not ceremony. The first draft of this harness shipped three guards that were silent no-ops: each used a git pathspec prefixed with `sahayakai-flutter/` while running from *inside* `sahayakai-flutter/`, so every pathspec resolved to `sahayakai-flutter/sahayakai-flutter/…` and matched nothing. The scope gate passed on any diff, the secret scanner scanned an empty string, and auto-decay could never fire. All three printed green. A second round found two more: `git diff HEAD` cannot see untracked files, so both content scanners were blind to every newly created file — which is most of what a build agent produces.

A gate nobody has ever watched fail is indistinguishable from a gate that cannot fail. That is the same defect as the golden-test gate cited in four documents with no implementation behind it.

**Git path asymmetry, since it caused all of the above:** pathspecs are CWD-relative (`-- lib` from the app root), output is repo-root-relative (`sahayakai-flutter/lib/main.dart`). Getting it backwards does not error — it returns an empty set.

---

## 4. Per-wake agent topology

```
WAKE
├─ [outer, in-context]  guard → reconcile → select ONE unit … commit → push → record
│     NEVER delegated. Delegation is where lies enter: a subagent reports "done",
│     the outer agent transcribes that into JSON, and no one ever ran the command.
│     The outer loop runs its own git and its own gates.
│
├─ [1× Agent, synchronous, in-place]  BUILD
│     Gets the unit contract, files[], and the relevant doc section.
│     Returns a file diff. Its prose is discarded.
│
├─ bash scripts/loop/worktree_diff.sh > <scratchpad>/<unit>.diff
│
├─ [2× Agent, PARALLEL, read-only, in ONE tool block]
│     A) ADVERSARIAL-CORRECTNESS ← contract + diff + DESIGN_RUBRIC §12
│     B) HONESTY-AUDITOR         ← contract + diff + CLAIMS.tsv
│     Neither sees the build agent's narrative. A reviewer told "the build agent
│     says this part is a stub" is already compromised. Isolation here is
│     informational, not filesystem.
│
└─ [1× Agent] FIX if either FAILs → re-review. ROUND CAP 2.
      On a second failure: status "failed", verbatim output recorded,
      git checkout -- the unit's files, move to the next unit.
      No third round. A third round argues broken work into passing.
```

**HONESTY-AUDITOR charter** — answers exactly five questions, returns PASS or a specific FAIL list:

1. Does every comment in this diff describe what the adjacent code actually does?
2. Does every doc or JSON line in this diff state something a `CLAIMS.tsv` command confirms?
3. Does this diff delete a test, add `skip:`, weaken an assertion, or narrow a gate's scope?
4. Does the diff satisfy the stated contract *in full*, or only the part the gates happen to check?
5. Does it introduce any `// ignore:`, `--no-verify`, lowered threshold, or widened allowlist to make a gate pass?

Questions 3 and 5 matter most: they are the two cheapest ways to turn a red gate green without doing the work, and neither is visible to any other rung. `reconcile.py` backs question 3 mechanically — test declarations may not fall and skips may not grow without a signed `testsRemoved` note.

**`Workflow` rather than parallel `Agent`** for exactly three shapes: the release band gate (ordered, resumable), the nine-locale i18n fan-out (fan-out/join over disjoint files), and the B0 exit assertion sweep.

**No worktree isolation for the Flutter tree.** A fresh worktree needs `flutter pub get` (~30s) plus a cold Gradle build (4–8 minutes) with no `build/` or `.dart_tool/` cache — fatal inside a wake budget. Build in place; the scope rung plus `git checkout --` is cheaper and equally safe for a single writer. **Do** use a worktree for `sahayakai-main` / `sahayakai-agents` units: that repo carries unrelated uncommitted work this loop must not disturb.

---

## 5. Bands

| Band | Content | Note |
|---|---|---|
| **B0** | Trust foundation + shippable build | **The hard deliverable.** Machine-checked exit criteria. |
| B1 | Live voice on Vertex via the hardened sidecar proxy | Cost controls land before the web route merges |
| B2 | Classroom parity: attendance, hotline roster, result actions | Masked roster projection first — it is a PII gate, not a nicety |
| B3 | Landing | Only band selectable after `landingModeAtEpoch` |

---

## 6. Stopping

| Condition | Action |
|---|---|
| B3 checklist complete | `stop: true` + report |
| `now >= loop.deadlineEpoch` | run abbreviated B3, then stop |
| Queue exhausted | stop, listing every `blocked` unit and its `blockedBy` |
| 3 consecutive no-progress wakes | stop — further wakes only manufacture noise |
| Integrity violation twice running | stop, `haltReason: "integrity"` — the tracker cannot be trusted, so nothing downstream can |
| `loop_guard.sh` non-zero | stop immediately, no commit |
| Same unit failed twice with `attempts >= 4` | mark `quarantined`, continue with the next unit — not a loop stop |

**Resuming in a fresh session** needs only the prompt in §1. `reconcile.py` re-derives every machine fact from the repository and auto-demotes stale claims, so the next unit falls out of the queue. Nothing is carried in context; nothing needs to be.

If `now > deadlineEpoch` and `loop.id` is unchanged, `reconcile` sets `loop.mode = "halted"`, forcing a deliberate human restart rather than a zombie loop that runs into the next day.

---

## 7. Human-only gates

The loop records these as `blockedBy` and never attempts them.

| id | Gate | Blocks |
|---|---|---|
| H1 | Approve downloading Outfit / Inter / Noto Sans Indic TTFs (SIL OFL) | U0.5, and transitively the whole golden gate |
| H2 | Play Console → App Signing → the Play App Signing SHA-256 | assetlinks slot 2; the `autoVerify` intent-filter must not ship before it, because Android caches a *failed* verification |
| H3 | Play Console → highest existing `versionCode` on `com.sargvision.sahayakai` | U0.4's floor — the Capacitor wrap already burned versionCode 1 on this applicationId |
| H4 | Firebase Console → add the upload keystore's SHA-1 and SHA-256, re-download `google-services.json` | **Without this, every signed release build's Google Sign-In returns `DEVELOPER_ERROR`.** No code change works around it |
| H5 | Firebase Console → App Check → register Play Integrity in **monitor** mode | U0.14 enforcement; the client header is safe to ship alone |
| H6 | A pro/advanced-plan test account | Every attendance write and the whole hotline are `requireProPlan`-gated; without one only the 403 path is provable |
| H7 | A physical Android device with a working mic | U1.7 — emulator audio cannot honestly test barge-in or echo |
| H8 | Merging any PR; flipping Cloud Run traffic; setting `VIDYA_VOICE_LIVE_ENABLED` | U0.15 and U1.5 reaching production |
| H9 | GitHub repo secrets for the CI release job | The CI-signed AAB only; the local signed AAB does not need it |
