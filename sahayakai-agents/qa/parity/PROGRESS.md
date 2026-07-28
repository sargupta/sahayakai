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
| 0 | 2026-07-28 | INVALID | — | Rebuilt the harness + 99-cell fixture set. English smoke run returned 9/9 `quota_exhausted` — the free-tier Gemini key is spent. Harness verified working: it classified quota correctly, refused to emit a score, exited 3. | Get a key with quota, then run the real baseline. Expect ~0/99. Do not start fixing before a valid baseline exists. |

---

## Open blockers

| blocker | needs | who |
|---|---|---|
| Gemini key has no quota | a key with headroom, or wait for the daily reset | founder |
| Cosine criterion unavailable | capture 99 Genkit response texts from preview → `tests/fixtures/vidya_genkit_baseline.json` | founder |
| Does emitting `instant-answer` double-handle the reply? | check the web client's `KNOWN_FLOWS` handler before implementing root cause 2 | decide before coding |

---

## Reminders

- Guardrails and stop conditions: `docs/VIDYA_PARITY_MISSION.md`
- Test baseline is **4 failed, 825 passed**. A 5th failure is yours.
- Never treat an exit-3 run as a score.
