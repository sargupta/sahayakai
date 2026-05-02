"""Phase R.3 — Offline eval suite for the 6 narrative ADK sidecar agents.

Forensic audit C5 flagged that no integration test stack catches
prompt-quality regressions across the 11 Indic languages. Phase O
addresses raw test count; this module is the qualitative companion
piece — input/output pairs paired with axis-scoped scorer functions
(safety, language, length, semantic similarity).

Adapted from the Genkit eval primitive (input → output → scorer),
ported to the ADK Python sidecar. Mirrors what `genkit eval:run` does
in Node land: replay golden-set cases, score each axis, write JSON
artefacts the operator can diff turn-over-turn.

Manual usage:

    uv run python -m evals.run_evals --agent vidya \\
        --golden-set evals/golden_set/vidya.json

CI integration is intentionally **deferred** — eval runs hit a live
Gemini endpoint (cost + quota), so we want the operator in the loop
on first wire. After a baseline run lands, a follow-up PR will wire
this into a nightly scheduled GitHub Action.

See `evals/README.md` for axis definitions and how to add a new agent.
"""
