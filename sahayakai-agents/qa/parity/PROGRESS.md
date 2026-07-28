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
| 1 | 2026-07-28 | **6/99** | +6 | Migrated the sidecar to **Vertex AI** (ADC, no API key) — config sentinel + `build_genai_client`, and 5 routers that bypassed the ADK helper and were 401ing on Vertex. Fixed 2 harness bugs of my own: entity was checked against response text on CREATE/ACTION cells (topic lives in `action.params`), and behavioural 502s were mislabelled `sidecar_missing`. sidecarOK 98.0% — matches the original recorded run exactly. | Root cause 1: localise the ack. 60 cells blocked on it. |
| 0 | 2026-07-28 | INVALID | — | Rebuilt the harness + 99-cell fixture set. English smoke run returned 9/9 `quota_exhausted` — the free-tier Gemini key is spent. Harness verified working: it classified quota correctly, refused to emit a score, exited 3. | Get a key with quota, then run the real baseline. Expect ~0/99. Do not start fixing before a valid baseline exists. |

---

## Open blockers

| blocker | needs | who |
|---|---|---|
| ~~Gemini key has no quota~~ | **RESOLVED** — now on Vertex AI (ADC, Cloud Billing 016D07). No key, no free-tier ceiling. | done |
| Only `gemini-2.5-flash` exists on Vertex in asia-south1 | 5 other model ids 404 there. `gemini-2.5-pro` and `gemini-2.5-flash-image` need **us-central1** — a data-residency decision. `gemini-2.0-flash`, `gemini-flash-latest`, `gemini-3-pro-image-preview` 404 everywhere tested. | founder |
| Cosine criterion unavailable | capture 99 Genkit response texts from preview → `tests/fixtures/vidya_genkit_baseline.json` | founder |
| Does emitting `instant-answer` double-handle the reply? | check the web client's `KNOWN_FLOWS` handler before implementing root cause 2 | decide before coding |

---

## Reminders

- Guardrails and stop conditions: `docs/VIDYA_PARITY_MISSION.md`
- Test baseline is **4 failed, 825 passed**. A 5th failure is yours.
- Never treat an exit-3 run as a score.
