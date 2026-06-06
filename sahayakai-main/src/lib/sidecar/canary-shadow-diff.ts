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
 * F14-001 (2026-06-06) — kill switch FLIPPED OFF.
 * Forensic audit confirmed Q4C was doubling Gemini spend on 100% of
 * canary traffic (~$3,800/month delta at 1k calls/day × 14 agents).
 * Default-off until a cost-aware sampling strategy is reviewed and
 * approved. Even when re-enabled, every observation call is now gated
 * by `SHADOW_DIFF_CANARY_SAMPLE_RATE` so we cap at a fixed fraction of
 * canary traffic instead of doubling every request.
 *
 * Cost: ~2× Gemini calls per observed request. Only enable with sampling.
 */
export const SHADOW_DIFF_IN_CANARY_OBSERVATION = false;

/**
 * Fraction of canary/full requests that fire the background
 * observation call when `SHADOW_DIFF_IN_CANARY_OBSERVATION === true`.
 * 0.05 = 5%. At 1k calls/day/agent that's 50 observation calls/day —
 * statistically meaningful for parity scoring without burning 2× spend.
 */
export const SHADOW_DIFF_CANARY_SAMPLE_RATE = 0.05;

/**
 * Returns `true` when the caller should fire the Q4C background
 * observation (Genkit-after-sidecar or sidecar-after-Genkit). Combines
 * the kill switch and the sample rate so dispatchers only need ONE
 * gate call per branch:
 *
 *   if (!shouldRunCanaryShadowDiff()) return;
 *   void runGenkitSafe(input).then(... writeAgentShadowDiff ...);
 *
 * Pure / sync / no I/O — safe to call inside hot paths.
 */
export function shouldRunCanaryShadowDiff(): boolean {
    if (!SHADOW_DIFF_IN_CANARY_OBSERVATION) return false;
    if (Math.random() >= SHADOW_DIFF_CANARY_SAMPLE_RATE) return false;
    return true;
}
