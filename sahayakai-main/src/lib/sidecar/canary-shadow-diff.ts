/**
 * Canary-observation shadow-diff toggle (Q4C).
 *
 * Before Q4C the 17 sidecar dispatchers only wrote shadow_diff records
 * when `mode === 'shadow'`. In `canary`/`full` mode the dispatcher
 * ran sidecar primary + Genkit-fallback-on-error (no parallel Genkit),
 * so we had NO live parity signal during canary→canary50→full ramps.
 * Without docs in `agent_shadow_diffs/{date}/{agent}`, the promotion
 * gate is unevaluable and the ramp stalls.
 *
 * Q4C runs a fire-and-forget Genkit call AND writes a shadow_diff
 * during canary/full sidecar-route, AND during the canary
 * "bucket-overshoot" Genkit-route branch. Both gated by
 * `SHADOW_DIFF_IN_CANARY_OBSERVATION` so a future cost-reduction
 * phase can disable it without ripping wiring out of all 17 dispatchers.
 *
 * Cost: ~2× Gemini calls during canary AND full. Intentional —
 * observability during rollout. Flip to false post-promotion to
 * reclaim the savings.
 */
export const SHADOW_DIFF_IN_CANARY_OBSERVATION = true;
