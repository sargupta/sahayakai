# community-persona-message — parity verdict

**Date:** 2026-06-06
**Branch:** `fix/track6-score-parity-harness` → merged to `develop` (preview revision `sahayakai-preview-00096-jec`)
**Flag state pre-run:** `communityPersonaMessageSidecarMode=shadow`, `communityPersonaMessageSidecarPercent=100` (verified in Firestore)
**Flag state post-run:** **unchanged** — NOT promoted to canary@10.

## TL;DR

33/33 cells executed cleanly. All 33 sidecar responses pass structural + native-script + no-bleed checks. Standard semantic-cosine gate (≥0.85) is met by only **11/33 = 33.3%**, well below the 95% promotion bar. Recommendation: **stay at shadow@100, do not promote.**

The semantic miss is a metric-fit issue, not (necessarily) a sidecar quality regression — see "Why semantic scores are low" below — but the standard harness contract is what governs promotion, and on that contract the agent does not clear the bar today.

## What was done

1. **Wired the dispatcher into the API route** (`/api/community/persona-pulse`). The route previously called `generateCommunityPersonaMessage` directly, so no shadow_diff was ever written even at `shadow@100`. After this commit (`5213593a9`) the route routes through `dispatchCommunityPersonaMessage` so the `communityPersonaMessageSidecarMode` flag actually controls dispatch. Behaviour is a strict superset of the previous code: `off` mode proxies straight to Genkit; `shadow` additionally fires the sidecar and writes a `shadow_diff`.

2. **Added 3 personas** to cover the missing Indic languages (`5eb89d02e`):
   - Padma Rao — Andhra Pradesh, Telugu
   - Bhavna Shah — Gujarat, Gujarati
   - Sanjukta Mohanty — Odisha, Odia (and added `Odia` to the `PersonaLanguage` union)

3. **Deployed preview** at SHA `d176ed9` (Cloud Build `c3c27b86…`, revision `sahayakai-preview-00096-jec`).

4. **Built fixtures**: 11 languages × 3 contexts (`tip`, `ncert`, `fresh`) = 33 cells. Driver at `scripts/community-persona-message-parity.mjs`.

5. **Drove 33 calls** at 1.5 RPS against the preview route. 33/33 returned 200 with a non-empty message. Genkit baselines written to `qa/baseline-runs-normalized/community-persona-message/`.

6. **Extracted sidecar responses** from `agent_shadow_diffs/2026-06-06/community-persona-message`. 33/33 docs matched the traffic ledger by time window, all `sidecarOk=true`. Sidecar responses written to `qa/sidecar-runs/community-persona-message/`.

7. **Scored with `scripts/score-parity.mjs`** using the real `gemini-embedding-001` embedder (cached at `qa/embedding-cache/`).

## Results

- Cells: 33 / 33
- Structural pass: 33 / 33 ✓
- Native-script ≥90% pass: 33 / 33 ✓
- No-bleed pass: 33 / 33 ✓
- Semantic cosine ≥0.85 pass: **11 / 33 = 33.3%** ✗

Semantic cosine distribution: min 0.597, median 0.788, mean 0.783, max 0.991.

Pass rate at relaxed thresholds (illustrative only — not used for promotion):

| Threshold | Pass count | Pass rate |
| --- | --- | --- |
| 0.85 (standard) | 11 | 33.3 % |
| 0.80 | 14 | 42.4 % |
| 0.75 | 20 | 60.6 % |
| 0.70 | 25 | 75.8 % |
| 0.65 | 28 | 84.8 % |
| 0.60 | 32 | 97.0 % |

Per-cell detail in `qa/parity-scores/community-persona-message.md` + `.json`.

## Why semantic scores are low

The community-persona-message flow is a **short, creative, high-temperature** generator: temperature 0.85, max 150 tokens, hard cap of 180 characters per message, no shared anchor text beyond the persona + the last 5 chat lines. Two independent calls on identical inputs produce messages that are *topically* aligned but *lexically* different — the standard 0.85 cosine threshold is calibrated for long-form structured outputs (lesson plans, exam papers) where topic and detail overlap dominate.

Example (`hi-rajesh_kumar-ncert.json`, semantic 0.704):

- Genkit: `कक्षा 8 विज्ञान के लिए NCERT`
- Sidecar: `कक्षा 8 के बच्चों को गुरुत्वा…`

Both are Hindi, both are Class-8-science replies — but the sidecar leaned into a specific topic (gravity) while genkit stayed abstract. That's normal creative variance for an 80-character reply, but cosine on 32-dimensional document embeddings can't distinguish "different sentence about the same topic" from "off-topic".

The harness already calls this out for recommender-class agents (it switches to query-set Jaccard) and the standard scorer warns in `scoreCell`'s comments that field-level cosine is noisy for short labels.

## Risk register / what's NOT being claimed

- **NOT** claiming the sidecar is broken. All 33 sidecar responses are in the correct script, well-formed against the baseline schema, and read as plausible in-character teacher chat. A human language-spot-check on a sample of 6 cells (en/hi/bn/or/te/gu) showed the sidecar replies are subjectively similar in quality and persona-voice to the genkit replies.
- **NOT** lowering the semantic threshold to force a pass. That would defeat the point of the standard harness contract and amounts to gaming the gate.
- **NOT** introducing a recommender-style alternative scorer for this agent in this PR. That's a follow-up — likely the right long-term fix is either (a) a custom short-creative scorer that uses topical-relevance + script + bleed + structural without paragraph cosine, or (b) raising sample size per cell (n=5 attempts/side, averaged) so cosine variance washes out.
- **NOT** promoting to canary@10. Flags left at `shadow@100`.

## Next actions (recommended, not done in this run)

1. Open a follow-up to either (a) tighten the persona-message prompt to make outputs more topically constrained (e.g., require referencing the last message verbatim when `mode='reply'`), or (b) add a `community-persona-message` scoring mode to `score-parity.mjs` that uses topical-relevance instead of cosine.
2. Until then, the dispatcher wiring is live in shadow@100, so we continue to accumulate shadow_diff evidence at zero user-impact.
3. The 3 new personas (Padma / Bhavna / Sanjukta) are live in the personas list — the live-pulse scheduler will start mixing them into `/community` rotation. Low-risk; same shape as the existing 10.

## Artifacts

- Driver: `scripts/community-persona-message-parity.mjs`
- Traffic ledger: `qa/results/lane-F/phase2-state/community-persona-message-traffic-ledger.json`
- Extract report: `qa/results/lane-F/phase2-state/community-persona-message-extract-report.json`
- Genkit baselines: `qa/baseline-runs-normalized/community-persona-message/*.json` (33 files)
- Sidecar responses: `qa/sidecar-runs/community-persona-message/*.json` (33 files)
- Per-cell scores: `qa/parity-scores/community-persona-message.{md,json}`

## Commits

- `5213593a9` feat(community-persona-message): route persona-pulse through sidecar dispatcher
- `5eb89d02e` feat(community-personas): add Telugu/Gujarati/Odia personas for 11-lang parity
- Both merged to `develop` via no-ff merge commit `d176ed959`, pushed and deployed to preview.
