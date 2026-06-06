# ADK Known Limitations Register

_Last updated: 2026-06-06. Owner: Platform AI. Review cadence: weekly._

This document is the single source of truth for what the ADK sidecar does **not** yet do safely in production. Every entry has a tracking ticket (Q4.A–D) or an explicit "deferred to Q1" stamp. If you are about to make a claim about ADK readiness — internal or external — read this first.

## Security and trust boundary

**AppCheck temporarily OFF on the sidecar.** The Next.js frontend enforces Firebase AppCheck. Requests reach Next.js with a valid AppCheck token. Next.js then forwards the parsed user identity to the sidecar via a service-account-signed JWT. The sidecar does **not** re-verify AppCheck. The justification is that the sidecar Cloud Run service does not accept unauthenticated traffic and the IAM-bound invoker is Next.js's service account. The risk is that any future caller with that service account (a misconfigured cron, a debug script) bypasses AppCheck silently. **Tracking: Q4.A.** ETA: this week. Until landed, treat the sidecar as an internal-only service even though it lives in production.

**Audience secret drift.** The JWT that Next.js mints for the sidecar currently declares `aud` as the Next.js public URL, not the sidecar's URL. The sidecar's verifier was relaxed to accept either string. This means a token leaked from one service is also valid at the other. Low probability of exploit because both services run in the same project, but the principle is wrong. **Tracking: Q4.B.** ETA: week 2.

## Configuration and rollout safety

**Single Firestore feature-flags document.** `featureFlags/global` holds canary percentages, kill switches, and per-agent enable bits for all fourteen agents in one document. Every sidecar instance reads it on cold start and caches for 60 seconds. A single bad write affects all agents simultaneously. We have no per-agent rollback granularity in the data layer — only in our discipline of editing one field at a time. **Tracking: Q4.D.** ETA: week 3. The fix splits the doc per agent and adds a fan-out invalidation channel via Pub/Sub.

**Canary-mode shadow_diff absence.** Shadow-diff exists as an offline tool that replays fixtures through both stacks. It does **not** run on live canary traffic. The 10% of users routed to ADK get ADK-only responses; the 90% routed to Genkit get Genkit-only responses. We cannot detect a real-user regression until a teacher complains or the parity harness re-run picks it up the next morning. **Tracking: Q4.C.** ETA: week 2. The fix routes a sample of canary traffic to both stacks and writes the diff to BigQuery.

## Agent-specific issues

**voice-to-text three-tier pipeline blocks clean canary measurement.** The agent internally selects between Whisper, Gemini multimodal, and a fallback rule-based pipeline based on audio length and language. The tier selection is itself sensitive to model version. This means parity-score swings between runs reflect tier-selection variance, not output quality. We cannot get a tight parity confidence interval until we either freeze tier selection during evaluation or evaluate each tier independently. Current workaround: report parity per tier and weight by observed traffic share. Tracking: deferred — needs ADK redesign.

**community-persona-message semantic-cosine metric mismatch on creative replies.** The agent generates short, voicy replies. Cosine similarity against the baseline runs high on factual replies and unpredictably low on creative ones, even when both outputs are good. The metric punishes diversity that we actually want. We are currently promoting based on a 0.55 threshold (vs 0.85 for structured agents) and a human spot-check. This is not a strong gate. Tracking: needs a rubric-based LLM judge replacement metric. Deferred to Q1.

**VIDYA behavioral scorer divergence.** The behavioral parity test expects `action.flow` to be populated. The sidecar implementation returns `null` for this field on roughly one in eight scenarios. The Genkit path returns a synthesized flow name even when the heuristic is weak. The output the user sees is identical; the scorer sees a divergence. Holding promotion until the scorer is fixed (the right fix) rather than papering over the sidecar (the wrong fix). ETA: day 3.

**parent-call shadow_calls Firestore write requires prod redeploy.** The dual-write path for parent-call lives behind a flag that is on in staging and off in prod. Until the next prod deploy of the agents sidecar, parent-call shadow data is not being captured in prod. ETA: day 5.

## Cost and traffic shape

**Genkit cost still ~90% of traffic until canary % rises.** Sidecar canary is at 10%. Vertex spend on Genkit therefore dominates the AI bill. Do not present the ADK migration as a cost-savings story externally yet. The savings are real but not yet realized. Expected crossover at canary@50.

**Four cron jobs still Genkit-only.** `daily-briefing`, `ai-community-agent`, `ai-reactive-reply`, and `grow-persona-pool` run on the Cloud Scheduler → Next.js → Genkit path. They were de-scoped from this migration because they are background, idempotent, and individually cheap. Combined they are ~8% of weekly AI spend. Tracking: Q1 cron-migration mini-track.

## Reliability posture

**Single-region (asia-southeast1) — no failover.** The sidecar runs only in Singapore. An `asia-southeast1` regional outage causes total ADK unavailability. The intended response in that case is to flip the master canary kill switch and route 100% of traffic back to Genkit (Genkit runs in the Next.js service, same region — note that this only helps if the Next.js region is healthy). True multi-region failover requires a Q1 effort. The runbook documents the manual Genkit fallback procedure.

## Surface area still on Genkit

Beyond the four cron jobs above, the following remain Genkit-only and are not in the Q4 burn-down:

**Validators (4 files).** `src/ai/validators/*.ts` — quiz validator, worksheet validator, rubric validator, exam-paper validator. These run as Genkit post-processors. Migrating them changes the contract subtly (they currently mutate the Genkit-shaped object) and was de-scoped to avoid coupling the migration to a validator refactor. Tracking: Q1 alongside validator schema cleanup.

**VIDYA supervisor (`src/ai/soul.ts`).** The top-level VIDYA assistant orchestration — routing user voice into the right sub-agent — is still Genkit. The sub-agents it dispatches to are on ADK in canary, but the supervisor itself is not. Migrating the supervisor requires resolving streaming behavior parity, which we have not yet validated. Tracking: Q1.

## How to use this register

Before you promote a canary, claim ADK parity in writing, or say "Genkit is going away," check this document. If a limitation listed here is material to your claim, either gate the claim or update this document with the resolution. Weekly review on Mondays; revisions land via PR with a one-line changelog at top of file.
