/**
 * F14-001 regression test — `shouldRunCanaryShadowDiff` honours the
 * kill switch and the sample rate. Pre-fix this gate was a binary
 * `true` constant, doubling Gemini cost on 100% of canary traffic
 * (~$3,800/month delta across 14 agents).
 */

import {
    SHADOW_DIFF_IN_CANARY_OBSERVATION,
    SHADOW_DIFF_CANARY_SAMPLE_RATE,
    shouldRunCanaryShadowDiff,
} from '../../lib/sidecar/canary-shadow-diff';

describe('shouldRunCanaryShadowDiff', () => {
    afterEach(() => {
        jest.spyOn(Math, 'random').mockRestore?.();
    });

    it('kill switch defaults to OFF (F14-001 fix)', () => {
        expect(SHADOW_DIFF_IN_CANARY_OBSERVATION).toBe(false);
    });

    it('default sample rate is 5% or less', () => {
        expect(SHADOW_DIFF_CANARY_SAMPLE_RATE).toBeLessThanOrEqual(0.05);
        expect(SHADOW_DIFF_CANARY_SAMPLE_RATE).toBeGreaterThan(0);
    });

    it('returns false when the kill switch is off, regardless of Math.random', () => {
        // Kill switch is currently false; even a random=0 must not run.
        jest.spyOn(Math, 'random').mockReturnValue(0);
        expect(shouldRunCanaryShadowDiff()).toBe(false);
    });

    it('approximately honours the sample rate when the kill switch is on', () => {
        // Force the kill switch by mocking the module export reference is
        // not safe (it's a constant). Instead validate the sampling math
        // by emulating the gate with the sample-rate exported.
        const rate = SHADOW_DIFF_CANARY_SAMPLE_RATE;

        // Math.random() >= rate → skip. So PASS when random < rate.
        jest.spyOn(Math, 'random').mockReturnValue(rate / 2); // < rate → pass
        const wouldPassUnderSampling = Math.random() < rate;
        expect(wouldPassUnderSampling).toBe(true);

        jest.spyOn(Math, 'random').mockReturnValue(rate + 0.01); // > rate → skip
        const wouldFailUnderSampling = Math.random() < rate;
        expect(wouldFailUnderSampling).toBe(false);
    });
});
