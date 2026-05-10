import {
    WithTimeoutError,
    withTimeout,
} from '@/lib/sidecar/with-timeout';

describe('withTimeout', () => {
    it('should resolve when promise resolves within budget', async () => {
        const result = await withTimeout(
            Promise.resolve('ok'),
            1_000,
            'fast resolver',
        );
        expect(result).toBe('ok');
    });

    it('should reject with WithTimeoutError when promise hangs past budget', async () => {
        // Pending promise that never resolves on its own — only the
        // timeout race should win.
        const hanging = new Promise<string>(() => {
            // intentionally never resolve
        });

        await expect(
            withTimeout(hanging, 50, 'voice-to-text genkit fallback'),
        ).rejects.toBeInstanceOf(WithTimeoutError);

        // Reset and capture the actual error to assert on label/elapsed.
        try {
            await withTimeout(
                new Promise<string>(() => {
                    // intentionally never resolve
                }),
                50,
                'voice-to-text genkit fallback',
            );
            fail('Expected withTimeout to reject');
        } catch (err) {
            expect(err).toBeInstanceOf(WithTimeoutError);
            const wte = err as WithTimeoutError;
            expect(wte.label).toBe('voice-to-text genkit fallback');
            expect(wte.elapsedMs).toBeGreaterThanOrEqual(40);
            expect(wte.message).toMatch(/timed out after/);
        }
    });

    it('should preserve original error when promise rejects within budget', async () => {
        class GenkitFlowError extends Error {
            constructor(message: string) {
                super(message);
                this.name = 'GenkitFlowError';
            }
        }

        const failing = Promise.reject(new GenkitFlowError('upstream 500'));

        await expect(
            withTimeout(failing, 1_000, 'lesson-plan genkit fallback'),
        ).rejects.toThrow('upstream 500');

        try {
            await withTimeout(
                Promise.reject(new GenkitFlowError('upstream 500')),
                1_000,
                'lesson-plan genkit fallback',
            );
            fail('Expected withTimeout to reject');
        } catch (err) {
            // The original Genkit error must surface — withTimeout must
            // NOT wrap it in WithTimeoutError when the underlying promise
            // is the one that rejected.
            expect(err).toBeInstanceOf(GenkitFlowError);
            expect(err).not.toBeInstanceOf(WithTimeoutError);
            expect((err as Error).message).toBe('upstream 500');
        }
    });
});
