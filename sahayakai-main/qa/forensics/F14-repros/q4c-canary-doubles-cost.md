# Repro — Q4C canary doubles cost on 100% of traffic

**Finding:** F14-P0-1

## Setup
- `system_config/feature_flags.visualAidSidecarMode = "canary"`
- `system_config/feature_flags.visualAidSidecarPercent = 10`
- `src/lib/sidecar/canary-shadow-diff.ts` exports `SHADOW_DIFF_IN_CANARY_OBSERVATION = true`

## Trace — request from teacher A (bucket = 5, lands UNDER 10% threshold)

1. `dispatchVisualAid({ userId: 'teacherA', ... })` called.
2. `decideVisualAidDispatch('teacherA')` returns `{ mode: 'canary', configuredMode: 'canary', bucket: 5 }`.
3. `checkImageRateLimit('teacherA')` → quota counter incremented to N+1.
4. `runSidecarSafe(req)` → sidecar produces image #1 → **$0.04 billed (sidecar).**
5. **Q4C branch triggers** (`SHADOW_DIFF_IN_CANARY_OBSERVATION && decision.mode IN {canary, full}`):
   - `runGenkitSafe(input)` fired in background → Genkit produces image #2 → **$0.04 billed (Genkit).** **Quota NOT incremented.**
   - `writeAgentShadowDiff(...)` writes Firestore doc.
6. User sees image #1; image #2 discarded.

**Per-request cost:** $0.08. **Quota counter:** +1. **User perception:** 1 image consumed.

## Trace — request from teacher B (bucket = 50, lands OVER 10% threshold)

1. `dispatchVisualAid({ userId: 'teacherB', ... })` called.
2. `decideVisualAidDispatch('teacherB')` returns `{ mode: 'off', configuredMode: 'canary', bucket: 50 }`.
3. **Off-branch entered:** `generateVisualAid(input)` → Genkit produces image #1 → **$0.04 billed.**
4. **Q4C overshoot branch triggers** (`SHADOW_DIFF_IN_CANARY_OBSERVATION && decision.configuredMode === 'canary'`):
   - `runSidecarSafe(sidecarRequest)` fired in background → sidecar produces image #2 → **$0.04 billed.** **Quota NOT incremented.**
   - `writeAgentShadowDiff(...)` writes Firestore doc.

**Per-request cost:** $0.08.

## Conclusion

Both branches (under-percent AND over-percent) pay 2× during canary. The "10% canary" rollout label is misleading: 10% of teachers go through the sidecar primary path, but **100% of teachers pay double model cost.**

## File pointers

- `src/lib/sidecar/visual-aid-dispatch.ts:180-211` (off branch + overshoot observation)
- `src/lib/sidecar/visual-aid-dispatch.ts:280-298` (canary/full branch + observation)
- `src/lib/sidecar/canary-shadow-diff.ts:21` (the toggle)
- Mirrored across all 14 wired dispatchers — see grep results for `SHADOW_DIFF_IN_CANARY_OBSERVATION`.

## Fix verification checklist

- [ ] Flip `SHADOW_DIFF_IN_CANARY_OBSERVATION = false`; redeploy.
- [ ] Confirm Cloud Run logs show single model call per request via `grep "shadow_diff_write" cloud-run-logs.json` — should return zero hits.
- [ ] Confirm billing dashboard `gemini-2.5-flash` and `gemini-3-pro-image-preview` SKUs drop to ~50% of current 7-day average within 24h of flip.
