/**
 * Bug 1 regression — VIDYA emits `instant-answer` for ANSWER intents
 * (see `src/ai/soul.ts:103`). Before the fix, the OmniOrb client's
 * `KNOWN_FLOWS` set + `FLOW_LABEL` map omitted that flow, so every
 * ANSWER action was dropped client-side with a destructive toast and
 * never navigated to `/instant-answer`. Wire enum
 * (`src/lib/sidecar/types.generated.ts`) likewise omitted the literal.
 *
 * Rather than mounting `<OmniOrb />` (which drags in Firebase, Zustand
 * persistence, Web Audio, mic permissions, and TTS — not Jest-friendly),
 * we read the source and assert the three coordinated additions are
 * present. This is the same source-level guard pattern used by
 * `omni-orb-language-poisoning.test.ts`.
 *
 * See qa/results/lane-F/VIDYA_VOICE_DEBUG.md and VIDYA_VOICE_FIX.md.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('OmniOrb: instant-answer flow whitelisting (Bug 1)', () => {
    const orbSource = readFileSync(
        resolve(__dirname, '../../components/omni-orb.tsx'),
        'utf8',
    );

    const wireSource = readFileSync(
        resolve(__dirname, '../../lib/sidecar/types.generated.ts'),
        'utf8',
    );

    it('includes `instant-answer` in the KNOWN_FLOWS set', () => {
        // Find the KNOWN_FLOWS declaration and assert the literal is inside.
        const knownFlowsBlock = orbSource.match(
            /const KNOWN_FLOWS = new Set[\s\S]*?\]\);/,
        );
        expect(knownFlowsBlock).not.toBeNull();
        expect(knownFlowsBlock![0]).toMatch(/'instant-answer'/);
    });

    it('includes `instant-answer` in the FLOW_LABEL map', () => {
        const flowLabelBlock = orbSource.match(
            /const FLOW_LABEL[\s\S]*?\n\};/,
        );
        expect(flowLabelBlock).not.toBeNull();
        expect(flowLabelBlock![0]).toMatch(/'instant-answer'\s*:\s*['"][^'"]+['"]/);
    });

    it('extends the wire enum VidyaAction.flow with `instant-answer`', () => {
        // Both literal-union lines (LiveToolDefinition.flow and
        // VidyaAction.flow) must include the new flow id.
        const flowUnionLines = wireSource
            .split('\n')
            .filter(line => /flow:\s*'lesson-plan'/.test(line));
        expect(flowUnionLines.length).toBeGreaterThanOrEqual(2);
        for (const line of flowUnionLines) {
            expect(line).toMatch(/'instant-answer'/);
        }
    });
});
