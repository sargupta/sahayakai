# Track 5 — Canary Monitor

Long-running observer that gates `canary → canary50 → full` promotion
decisions for the ADK-Python sidecar agents. Pure observation: never
flips a feature flag, never deploys, never mutates traffic.

## What it does

Every `--poll-interval` for every `--agents` flag:

1. Queries `agent_shadow_diffs/{YYYY-MM-DD}/{agent-subcollection}` for
   docs whose `createdAt` falls in the poll window (handles UTC-day
   straddling by scanning today + yesterday buckets).
2. Buckets the docs into: `sidecarOk` / `sidecar5xx` / `sidecar4xx` /
   `sidecarOtherErr`. 5xx is classified from `sidecarStatus` first,
   then a regex on `sidecarError` for older schemas.
3. Computes sidecar p95 and Genkit p95 from `sidecarLatencyMs` /
   `genkitLatencyMs`.
4. Samples the 5 most-recent both-success cells, embeds primary text
   with Gemini `gemini-embedding-001` (falls back to a deterministic
   mock when `GEMINI_API_KEY` is unset — still useful as a
   "did the text change at all" signal), computes pairwise cosine,
   flags any cell where `1 − cos > 0.15` as drifted.
5. Sanity-checks the 5xx count against `gcloud logging read` for
   `httpRequest.status >= 500` on the target Cloud Run service.
   Times out at 15s — on timeout the latency gate skips cleanly that
   cycle rather than blocking the run.
6. Every 5 minutes, prints a per-agent summary line showing the three
   gates against the configured thresholds.

At end of `--duration` (or on `SIGINT`):

- Emits **GO** / **NO_GO** / **INSUFFICIENT_SIGNAL** per agent.
- Writes a markdown + JSON report to
  `qa/results/canary-watch/<ISO-timestamp>.md` (+ `.json`).
- Exit code: `0` if all GO, `1` if any NO_GO, `2` if all INSUFFICIENT_SIGNAL.

## Gates

| gate                | metric                                                   | default threshold |
|---------------------|----------------------------------------------------------|-------------------|
| error rate          | `sidecar5xx / total` in the window                       | ≤ 0.05            |
| latency multiplier  | `sidecar p95 / genkit p95`                               | ≤ 1.30            |
| semantic drift      | fraction of sampled cells with `1 − cosine > 0.15`       | ≤ 0.10            |

4xx is logged separately but does NOT fail the canary — 4xx is
client-driven (bad uid, malformed body) and equally affects Genkit.

## Usage

### Auth

```bash
gcloud auth application-default login \
  --impersonate-service-account=firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com
```

(or set `GOOGLE_APPLICATION_CREDENTIALS` to a SA key.)
Optionally export `GEMINI_API_KEY` for real embedding-based drift; without
it the mock embedder gives a coarser "exact-text-match" drift signal.

### Watch a 30-minute preview canary for lessonPlan + quiz

```bash
node scripts/canary-watch.mjs \
  --mode=preview \
  --agents=lessonPlan,quiz \
  --duration=30m \
  --poll-interval=60s
```

### Tighten gates for a prod canary50 → full step

```bash
node scripts/canary-watch.mjs \
  --mode=prod \
  --agents=lessonPlan \
  --duration=2h \
  --poll-interval=60s \
  --max-error-rate=0.02 \
  --max-latency-multiplier=1.2 \
  --max-semantic-drift=0.05
```

### Run on every agent in a long burn-in

```bash
node scripts/canary-watch.mjs \
  --mode=preview \
  --agents=lessonPlan,quiz,examPaper,instantAnswer,rubric,teacherTraining,videoStoryteller,virtualFieldTrip,visualAid,voiceToText,worksheet,parentMessage,avatarGenerator,assessmentScanner,assignmentAssessor,communityPersonaMessage,vidya \
  --duration=4h \
  --poll-interval=90s
```

## CLI flags

| flag                          | description                                                      | default |
|-------------------------------|------------------------------------------------------------------|---------|
| `--mode`                      | `preview` (→ `sahayakai-preview`) or `prod` (→ `sahayakai-hotfix-resilience`) | `preview` |
| `--agents`                    | Comma-separated camelCase flag keys (see Agent map below)        | required |
| `--duration`                  | Total observation window (`30m`, `2h`, `45s`)                     | `30m` |
| `--poll-interval`             | How often to sample Firestore + Cloud Logging                    | `60s` |
| `--max-error-rate`            | Max sidecar 5xx rate per agent                                   | `0.05` |
| `--max-latency-multiplier`    | Max sidecar p95 / Genkit p95                                     | `1.3` |
| `--max-semantic-drift`        | Max fraction of cells with `1 − cosine > 0.15`                   | `0.10` |

## Agent flag → Firestore subcollection map

The CLI accepts camelCase keys that match `system_config/feature_flags`.
They map to the kebab-case subcollections written by
`src/lib/sidecar/shadow-diff-writer.ts`:

```
lessonPlan              → lesson-plan
quiz                    → quiz
examPaper               → exam-paper
instantAnswer           → instant-answer
rubric                  → rubric
teacherTraining         → teacher-training
videoStoryteller        → video-storyteller
virtualFieldTrip        → virtual-field-trip
visualAid               → visual-aid
voiceToText             → voice-to-text
worksheet               → worksheet
parentMessage           → parent-message
avatarGenerator         → avatar-generator
assessmentScanner       → assessment-scanner
assignmentAssessor      → assignment-assessor
communityPersonaMessage → community-persona-message
vidya                   → vidya
```

## Safety properties

- **No flag writes**: monitor never reads or writes
  `system_config/feature_flags`. Promotion is human-in-the-loop.
- **No deploys**: no `gcloud run deploy`, no `safe-deploy.sh` call.
- **Fail-soft**:
  - Empty windows → `INSUFFICIENT_SIGNAL` for that agent (not NO_GO).
  - Cloud Logging timeout → latency gate skips that cycle (logged).
  - `@google/genai` missing → mock embedder + warning.
  - Firestore per-day fetch errors → logged + skipped (run continues).
- **SIGINT-clean**: emits a partial report rather than dying mid-window.

## Tests

`src/__tests__/scripts/canary-watch.test.ts` — 12 tests, all green.

Covers (per Track 5 requirements):

- **GO** when zero errors + latency under multiplier + drift OK
- **NO_GO** when 5xx rate > threshold (both `sidecarStatus` and error-string paths)
- **NO_GO** when latency ratio > threshold
- **NO_GO** when semantic drift > threshold
- **INSUFFICIENT_SIGNAL** when zero traffic
- Latency-check-skipped path is GO (Cloud Logging fail-soft)
- Pure helpers: `parseDuration`, `cosine`, `quantile`, `parseArgs`

Run:

```bash
npx jest src/__tests__/scripts/canary-watch.test.ts --coverage=false
```

## Output artefacts

For each run:

- `qa/results/canary-watch/<ISO>.md` — verdict table + Cloud Logging
  sanity counts.
- `qa/results/canary-watch/<ISO>.json` — full report payload for
  downstream automation (e.g. a promote-decision GitHub Action).

## Files

- `scripts/canary-watch.mjs` — the monitor (CLI + pure helpers exported).
- `src/__tests__/scripts/canary-watch.test.ts` — gate-logic tests.
- `qa/results/canary-watch/` — per-run reports.
