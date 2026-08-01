# VIDYA parity mission — 0/99 → 95/99

**Branch:** `feature/vidya-parity-mission`
**Scoreboard:** `uv run python scripts/vidya_parity.py`
**State:** `qa/parity/latest.json`

The goal is one number: **cells passing out of 99.** Everything below serves that.

---

## 1. What this is

VIDYA is the ADK supervisor behind the OmniOrb. It is the only one of 18 agents
that has never passed its promotion gate. The last recorded run (2026-06-06)
scored **0 of 99** despite a 98% success rate — the service works, the answers
don't match Genkit.

18 agents run at `canary@10`. VIDYA sits at `shadow@100`, meaning its answers are
recorded and compared but never shown to a teacher. Getting to 95/99 is what
unblocks promotion.

**This is not a Genkit→ADK migration.** All 19 agents already exist in ADK. The
Genkit path is a deliberate fallback. Nothing needs porting.

---

## 2. The scoreboard

```bash
# terminal 1
GOOGLE_GENAI_API_KEY=<key> uv run uvicorn sahayakai_agents.main:app --port 8080

# terminal 2
uv run python scripts/vidya_parity.py --pace 6
uv run python scripts/vidya_parity.py --lang hi --verbose   # debug one language
uv run python scripts/vidya_parity.py --threshold 95        # exit 1 below 95
```

99 cells: 11 languages × 9 archetypes. A cell passes when **every scored
criterion** passes:

| # | Criterion | Rule |
|---|---|---|
| 1 | `flow_match` | sidecar `action.flow` equals the recorded Genkit flow (both-null counts) |
| 2 | `script` | ≥90% of letters in the target language's Unicode block |
| 3 | `entity` | a key term appears in the reply |
| 4 | `cosine` | **not scored** — see below |

### Exit codes — the loop depends on these

| Code | Meaning |
|---|---|
| 0 | Ran clean, threshold met (or none set) |
| 1 | Ran clean, below `--threshold` |
| 2 | Fixture set missing |
| **3** | **Run INVALID — cells hit the Gemini quota. The score is meaningless.** |

**Exit 3 is not a failure to fix. It means re-run slower.** Treating a
quota-polluted run as a real score is the most dangerous failure mode here: it
makes a good fix look like a regression and can send an autonomous loop into
reverting correct work.

### On the missing 4th criterion

The original harness scored cosine similarity against Genkit's response text.
That harness was never committed, and the surviving results file records the
resulting *score* but not the *text*. So cosine cannot be reconstructed.

To enable it: capture the 99 Genkit responses from a preview deploy and drop
them at `tests/fixtures/vidya_genkit_baseline.json`. The harness detects the file
and adds the criterion automatically.

**Until then every reported number is 3-of-4 and must be described that way.**

---

## 3. The two root causes

### Root cause 1 — one hardcoded English sentence (66 of 99 cells)

`src/sahayakai_agents/agents/vidya/router.py`, ~line 456:

```python
response_text = (
    "Opening the right tool for you now."
    if action is not None
    else "I could not route that request."
)
```

Routing is *perfect* on all 66 CREATE and ACTION cells — 100% flow match. Then it
replies in English regardless of language. That fails script coverage outright
(0.0 for all 10 Indian languages) and drags cosine to ~0.49–0.60.

**Fix:** a lookup table of 11 acknowledgements keyed by language code. Not a model
call — zero tokens, zero latency, deterministic. Escalate to model-generated text
only if measurement shows it's still needed.

Requirements:
- All 11: en, hi, bn, ta, te, mr, gu, kn, ml, pa, or
- Localise the failure string too
- `detectedLanguage` can be `None` — pick a deliberate fallback and test it
- An unrecognised code must not crash

**Expected: 0 → ~60/99.**

### Root cause 2 — the instant-answer disagreement (33 of 99 cells)

All 33 ANSWER cells fail `action_flow_mismatch`. Genkit returns
`flow: "instant-answer"`; VIDYA returns `null`. Both are defensible; they disagree.

`schemas.py` has 10 entries in `AllowedFlow` including `instant-answer`.
`prompts.py` has 9 in `ALLOWED_FLOWS`, deliberately excluding it. `gates.py:52`
returns `None` for `instantAnswer` because it's answered inline.

**Fix: emit `flow: "instant-answer"` alongside the inline answer.**

Before implementing, verify: does the web client navigate to `/instant-answer` on
that flow, and would that double-handle an answer VIDYA already produced inline?
Check `dist/types.generated.ts` and `contract/`. **If it would double-handle,
stop and escalate** — that's a product decision.

**Expected: +33, to ~93/99.**

### The remainder

- `pa-ans-democracy`, `or-ans-democracy` — timed out in the original run
- `pa-ans-fractions` — *Genkit itself* misrouted to `teacher-training`. Genkit is
  wrong; document it, don't contort VIDYA to match a bug in the other engine.

---

## 4. Guardrails

Non-negotiable, whether a human or a loop is driving:

1. **Never edit the other 18 agents.** They serve real teachers.
2. **Never delete or weaken a test to make it pass.** If a test is wrong, say so.
3. **Never change a prompt without measuring before and after.**
4. **Never remove the auth layers** in `auth.py`. Skipped in dev, load-bearing in prod.
5. **Any new user-controlled string reaching a prompt goes through `sanitize()`**
   in `shared/prompt_safety.py`. No exceptions.
6. **Never touch `system_config/feature_flags`.** Promotion is a human decision.
7. **Never commit secrets.** `.env` is gitignored; keep it that way.
8. **Never treat an exit-3 run as a score.**

### The known-failing baseline

`uv run pytest -m "unit or integration or behavioral"` currently gives
**4 failed, 825 passed** on this repo — pre-existing test-ordering pollution in
`test_assignment_assessor_agent.py` and `test_community_persona_message_agent.py`.
They pass individually. **Not part of this mission.**

**A 5th failure means you caused it.** Check the count every run.

---

## 5. The loop

`/loop` re-enters a prompt repeatedly, potentially in a fresh context each time.
So state lives on disk, not in memory:

- `qa/parity/latest.json` — the current score, written by every harness run
- `qa/parity/PROGRESS.md` — the running log, appended once per iteration

Start it with:

```
/loop Read qa/parity/PROGRESS.md and qa/parity/latest.json. Follow docs/VIDYA_PARITY_MISSION.md. Run the parity harness, fix the single highest-count failure reason, re-run, append one line to PROGRESS.md with the new score. Stop when passed >= 95, or after 3 iterations with no improvement, or if the harness exits 3.
```

Omit an interval so it self-paces.

### Stop conditions — all three are real

| Condition | What to do |
|---|---|
| `passed >= 95` | Stop. Open the PR. |
| 3 iterations, no improvement | Stop. Write what's blocking into PROGRESS.md. |
| Harness exits 3 | Stop. Quota-limited; the number is not real. |

### What the loop must not decide alone

- Whether to relax a scoring criterion
- Whether emitting `instant-answer` double-handles the answer (root cause 2)
- Whether a translation is acceptable to a native speaker
- Anything touching production flags

Each of those goes in PROGRESS.md as a blocker, and the loop stops.

---

## 6. Definition of done

- [ ] Parity ≥95/99, criteria named explicitly
- [ ] `4 failed, 825 passed` — no new failures
- [ ] `ruff check` + `ruff format --check` + `mypy src/` clean
- [ ] Acknowledgements localised in all 11 languages, with tests
- [ ] `instant-answer` reconciled, with the double-handling question answered
- [ ] PROGRESS.md tells the story: every iteration, every score
- [ ] PR into `develop` stating before/after and which criteria were scored

Promotion to `canary` after merge is a **human decision**, made by flipping
`vidyaSidecarMode` in production Firestore. Not part of this mission.
