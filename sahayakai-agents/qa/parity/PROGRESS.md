# VIDYA parity — progress log

The loop appends **one line per iteration**. Read this file and
`qa/parity/latest.json` before doing anything; they are the only memory that
survives between iterations.

Format:

```
| iteration | date | score | change | what was done | next |
```

Rules:
- Record the score even when it goes down. Especially when it goes down.
- An exit-3 (quota) run is **not a score**. Log it as `INVALID` and re-run slower.
- Always state which criteria were scored — currently 3 of 4 (no cosine).

---

## Baseline

| | |
|---|---|
| Recorded 2026-06-06 | **0/99** (4 criteria, incl. cosine) |
| Harness | never committed — rebuilt 2026-07-28 |
| Fixture set | reconstructed, 99 cells, 11 languages |
| Criteria now scored | flow_match, script, entity — **cosine unavailable** |

---

## Iterations

| # | date | score | Δ | what was done | next |
|---|---|---|---|---|---|
| 4 | 2026-07-29 | **93–98/99** | +19–24 | **Fixture corrections, not VIDYA changes — be clear about that.** (a) ANSWER entity lists only held en/hi/bn/ta terms, so correct Telugu/Marathi/Gujarati/Kannada/Malayalam/Punjabi/Odia answers could not match; added per-language concept terms. Even `mr-ans-democracy` returns `लोकशाही` where the list had Hindi `लोकतंत्र`. (b) The CREATE/ACTION check demanded a `topic`, but an exam-paper request has a SUBJECT and grade — VIDYA correctly returns `topic=''`, and English only passed by accident. Now checks all extracted params. | **Score is NOT stable: 98, 93, 94 over three runs.** All remaining failures are in the instant-answer path. See blockers. |
| 3 | 2026-07-28 | **74/99** | +11 | **Root cause 2 fixed.** `classify_action` now returns `flow='instant-answer'` for instantAnswer instead of `None`, and the behavioural guard validates against the 10-entry WIRE enum rather than the 9-entry classifier enum (it would otherwise 502 every ANSWER request). **`action_flow_mismatch` is now zero** — ANSWER 0/33 → 14/33. Updated 15 tests that pinned the old `action is None` contract; the 2 behavioural ones only asserted on the error-message wording. | 24 `entity_miss` left, all ANSWER. Likely the answer text not containing the concept term in-language — check before assuming it is a VIDYA bug. |
| 2 | 2026-07-28 | **63/99** | +57 | **Root cause 1 fixed.** Localised all THREE hardcoded English acknowledgements (routing / route_failed / unknown) into 11 languages — new `agents/vidya/acknowledgements.py`, 123 tests incl. the production script guard run against all 33 strings. Every `behavioural_502_script` gone: sidecarOK 6.1% → 100%. CREATE now **33/33**. Also corrected my own entity check twice — a strict substring test over-corrected to 16/99 before landing on: native OR translated topic both count, empty fails. | Root cause 2 — 30 ANSWER cells. Needs the double-handling decision first. |
| 1 | 2026-07-28 | **6/99** | +6 | Migrated the sidecar to **Vertex AI** (ADC, no API key) — config sentinel + `build_genai_client`, and 5 routers that bypassed the ADK helper and were 401ing on Vertex. Fixed 2 harness bugs of my own: entity was checked against response text on CREATE/ACTION cells (topic lives in `action.params`), and behavioural 502s were mislabelled `sidecar_missing`. sidecarOK 98.0% — matches the original recorded run exactly. | Root cause 1: localise the ack. 60 cells blocked on it. |
| 0 | 2026-07-28 | INVALID | — | Rebuilt the harness + 99-cell fixture set. English smoke run returned 9/9 `quota_exhausted` — the free-tier Gemini key is spent. Harness verified working: it classified quota correctly, refused to emit a score, exited 3. | Get a key with quota, then run the real baseline. Expect ~0/99. Do not start fixing before a valid baseline exists. |

---

## Open blockers

| blocker | needs | who |
|---|---|---|
| ~~Gemini key has no quota~~ | **RESOLVED** — now on Vertex AI (ADC, Cloud Billing 016D07). No key, no free-tier ceiling. | done |
| Only `gemini-2.5-flash` exists on Vertex in asia-south1 | 5 other model ids 404 there. `gemini-2.5-pro` and `gemini-2.5-flash-image` need **us-central1** — a data-residency decision. `gemini-2.0-flash`, `gemini-flash-latest`, `gemini-3-pro-image-preview` 404 everywhere tested. | founder |
| Cosine criterion unavailable | capture 99 Genkit response texts from preview → `tests/fixtures/vidya_genkit_baseline.json` | founder |
| **Topic extraction is inconsistent** | 49 of 90 non-English cells return the topic translated to English rather than the teacher's script; 3 (`mr/kn/pa-act-exam`) return it EMPTY. Both are scored as passes today because both are defensible — but the destination form receives whatever this says, so it is a real prefill question. | founder |
| **Acknowledgement translations unreviewed** | The 33 new strings in `acknowledgements.py` are model-authored and user-facing (TTS reads them aloud). Each needs a native speaker before production — Odia, Punjabi, Malayalam especially. | founder |
| ~~Does emitting `instant-answer` double-handle the reply?~~ | **RESOLVED — yes, and it already does in production.** Genkit emits the flow on 30/33 ANSWER cells with the answer in its response text; the client navigates on it (`omni-orb.tsx:36`) while TTS speaks the answer (`:520`). So the answer is computed twice on the Genkit path today. VIDYA returning `None` was the deviation. Whether to STOP double-handling is a separate product decision that must change both engines together. | decided |
| ~~Topic translated to English~~ | **BY DESIGN** — `soul.ts:125`: "Extract topic as a concise English phrase." Genkit does the same. Not a bug. The 3 EMPTY topics (`mr/kn/pa-act-exam`) are still real. | closed |
| **Instant-answer flakiness keeps the score at the gate, not above it** | Three non-deterministic failure modes, all pre-existing, all in the instant-answer path. Score swings 93–98 across identical runs. **This is the last real blocker to a dependable ≥95.** | decide |
| ↳ 1. Grounding disables structured output | `instant_answer/router.py:74-79`: Gemini rejects `response_mime_type='application/json'` together with `tools=[google_search]`, so the schema is dropped and JSON is requested **in the prompt** and parsed from raw text. The model sometimes returns prose instead — more often in non-English. Fix options: retry once on parse failure, or a two-call design (ground, then structure). | engineering |
| ↳ 2. Script threshold mismatch | The harness enforces 0.90 per the original criteria; `_behavioural` only enforces 0.85. Cells at 0.85–0.89 return 200 but fail parity. Decide which number is authoritative. | decide |
| ↳ 3. Answer length overruns | `VIDYA response length out of range: 278 words (expected ≤250)` — the answerer occasionally exceeds its own cap and 502s. | engineering |

---

## Reminders

- Guardrails and stop conditions: `docs/VIDYA_PARITY_MISSION.md`
- Test baseline is **4 failed, 825 passed**. A 5th failure is yours.
- Never treat an exit-3 run as a score.
