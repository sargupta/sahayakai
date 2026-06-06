# ADK Migration Narrative

_Last updated: 2026-06-06. Owner: Platform AI._

## Where we started

Eight months ago every SahayakAI flow ran on a single Genkit binary inside the Next.js Cloud Run service. That worked when we had four flows and one model. By the time we had fourteen agents — lesson plan, quiz, worksheet, rubric, parent-message, instant-answer, exam-paper, video-storyteller, virtual-field-trip, visual-aid, teacher-training, assignment-assessor, voice-to-text, community-persona-message — Genkit had become a bottleneck. Cold starts hit five seconds. Long-running flows (video-storyteller, exam-paper) blocked the request queue. We had no way to A/B test prompt changes. We had no behavioral evaluation. Cost was opaque because everything billed under one Vertex project.

The decision in late February was to extract every flow into a Python sidecar built on Google's Agent Development Kit (ADK), behind a thin shadow-call interface. Genkit stays as the orchestrator and the safety net; ADK does the heavy lifting; a feature flag picks who answers each request.

## Where we are

All fourteen agents now have ADK implementations. All fourteen run at canary@10 in production — ten percent of live traffic. Score-parity harnesses (`qa/parity-scores/*.json`) gate every promotion: each agent must match the Genkit baseline within 2% on three to seven semantic and structural metrics, computed against a frozen fixture set. Parity scores are reproduced from `qa/baseline-runs-normalized/`. We have shadow-call infrastructure that lets Genkit and ADK answer the same prompt and write both outputs to Firestore for offline diffing. We have Cloud Run sidecar (`sahayakai-agents`) on `asia-southeast1` with autoscaling 1–20 instances. We have Cloud Build wired to deploy on every merge to `main` of `sahayakai-agents`.

How we got here, briefly: Lane A built the ADK base classes and Firestore feature-flag plumbing. Lane B ported the cheap deterministic agents (rubric, parent-message, instant-answer) first to prove the harness. Lane C tackled the heavyweight multimodal agents (video-storyteller, virtual-field-trip, visual-aid). Lane D wired canary routing and shadow diff. Lane F is the current production push — the last six weeks of P0/P1 burn-down, schema corrections, and parity-harness fixes.

## Top 5 wins

**Score-parity harness is the single best investment we made.** Every promotion is gated by a number, not a vibe. When `assignment-assessor` started returning `RubricLevel.points` as int instead of float, the harness caught it the same day. The harness is reproducible (`scripts/run-parity.sh`), versioned, and reviewable. PMs and engineers look at the same metric.

**Sidecar isolation killed cold-start regressions in the Next.js path.** Pre-migration, a single slow flow could starve the request queue. Now Next.js stays warm for UI; ADK scales independently.

**Behavioral evaluation arrived.** For agents where structured output is the contract (quiz, worksheet, exam-paper), we now compute structural F1, semantic cosine on free-text fields, and reading-level deltas. We can finally answer "is the new prompt better" with a number.

**Feature-flag-driven canary.** Flipping ten percent traffic to ADK takes one Firestore write. Rollback is one Firestore write. We've used the kill switch twice. Both times under thirty seconds.

**Per-agent cost visibility.** Vertex project segregation plus per-agent Cloud Logging labels means we can finally read agent-level cost out of BigQuery billing exports. Genkit never gave us this.

## Top 5 corner-cuts

**AppCheck is OFF on the sidecar.** Next.js forwards a service-account-signed JWT; the sidecar trusts it. This is acceptable because the sidecar is not on the public internet, but it is not the long-term posture. Q4.A re-enables AppCheck end-to-end.

**Audience claim drift between Next.js and the sidecar.** The forwarded JWT's `aud` is currently the Next.js service URL, not the sidecar URL. The sidecar's audience check is loosened to accept either. Q4.B aligns them.

**Single Firestore document holds every feature flag.** `featureFlags/global` is a hot read on every request. Cache hits in memory mostly save us, but a write storms every running instance. Q4.D splits this per-agent with a fan-out cache invalidation channel.

**Canary mode has no live shadow-diff yet.** Shadow-diff exists for offline evaluation but is not running on the 90% Genkit traffic. We are flying without an in-prod regression detector — we'll find out the ADK regressed only when a teacher complains. Q4.C wires shadow-diff into the canary path.

**Genkit still owns four cron jobs** (daily-briefing, ai-community-agent, ai-reactive-reply, grow-persona-pool). These are background workloads, low-stakes, and were de-scoped from this migration. They will get their own track in Q1.

## Top 5 surprises

**Parity is harder than parity-of-output.** Two agents (community-persona-message, VIDYA behavioral) produce semantically equivalent but structurally divergent outputs. We had to either rewrite metrics or accept the divergence. Both decisions cost a week each.

**Genkit's hidden formatting passes.** Several agents relied on Genkit's implicit JSON-repair and trailing-comma tolerance. ADK is strict. We discovered three agents (exam-paper, teacher-training, parent-message) silently depending on this. Each took a prompt rewrite.

**Voice-to-text three-tier pipeline (Whisper → Gemini → fallback) does not fit a single ADK agent.** It needs a small orchestrator. We shipped it as one ADK agent with internal tier-selection, but parity measurement on it is noisy because the tier choice itself is the variable.

**Firebase AI Logic billing line items don't equal what Vertex thinks we used.** Two weeks of investigation. Conclusion: Firebase rounds up token counts to 100s. Vertex does not. The drift is real but small (~3%) and we now reconcile monthly.

**Cloud Run min-instances=1 on the sidecar costs less than we feared and saves the P99.** We expected a $400/mo line item; reality is ~$120 and cold-start tail latency dropped from 4.8s to 0.7s.

## What is NOT yet production-grade

Be honest about this: the canary is at ten percent, which means Genkit serves about ninety percent of paid traffic. The migration is half-done by spend, even though it is whole-done by agent count. AppCheck is off. Audience is drifted. Shadow-diff is offline-only. Four cron jobs and the VIDYA supervisor (`src/ai/soul.ts`) and four validator files remain on Genkit. We are single-region. We have no automated failover; an `asia-southeast1` outage means manual Genkit fallback.

This is fine for canary@10 but it is not "we shut down Genkit tomorrow" ready.

## Timeline — next 7 days

Day 1–2: ship Q4.A (AppCheck on sidecar) behind a flag, soak in staging for 24 hours. Day 3: promote VIDYA behavioral parity-harness fix (sidecar currently returns null for `action.flow`). Day 4: bump canary on the three cheapest agents (rubric, parent-message, instant-answer) from 10% to 25%. Day 5: deploy `parent-call` shadow_calls Firestore write to prod. Day 6–7: monitor; cut a weekly parity-trend report; decide whether to bump worksheet/quiz canary.

## Timeline — next 30 days

Week 1 as above. Week 2: ship Q4.B (audience alignment) and Q4.C (live shadow-diff on canary path). Week 3: lift remaining agents to 25% canary if no regressions; begin Q4.D (per-agent flag split). Week 4: tackle the four Genkit cron jobs as a single mini-track; produce a "Genkit deprecation candidate list" with cost-weighted ranking; revisit single-region — likely punt to Q1, but document the failover playbook before then.

The goal at day 30 is not Genkit-off. The goal is canary@50 on the structured-output agents and a credible plan for the long-tail surface.
