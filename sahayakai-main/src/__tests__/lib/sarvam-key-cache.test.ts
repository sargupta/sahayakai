/**
 * @jest-environment node
 *
 * Class gate (2026-11-13): a missing provider key must not be looked up again
 * on every request. With SARVAM_AI_API_KEY absent, each transcription spent two
 * Secret Manager round trips (~0.6 s) re-learning that before falling back to
 * Gemini. The miss is remembered for SARVAM_KEY_MISSING_TTL_MS, then retried,
 * so a key added later is still picked up without a redeploy.
 */
jest.mock('server-only', () => ({}));
const mockGetSecret = jest.fn();
jest.mock('@/lib/secrets', () => ({ getSecret: (...a: unknown[]) => mockGetSecret(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { __resetSarvamKeyCacheForTests, SARVAM_KEY_MISSING_TTL_MS, sarvamSTT } from '@/lib/sarvam';

const audio = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

describe('Sarvam API key lookup', () => {
    beforeEach(() => {
        __resetSarvamKeyCacheForTests();
        mockGetSecret.mockReset();
        jest.useRealTimers();
    });

    it('remembers a missing key: one Secret Manager lookup for many requests', async () => {
        mockGetSecret.mockRejectedValue(new Error('Secret SARVAM_AI_API_KEY not found'));
        for (let i = 0; i < 5; i++) {
            await expect(sarvamSTT(audio())).rejects.toThrow('not found');
        }
        expect(mockGetSecret).toHaveBeenCalledTimes(1);
    });

    it('looks again once the window has passed (a key added later is used)', async () => {
        jest.useFakeTimers({ now: 1_000_000 });
        mockGetSecret.mockRejectedValueOnce(new Error('missing'));
        await expect(sarvamSTT(audio())).rejects.toThrow('missing');

        jest.setSystemTime(1_000_000 + SARVAM_KEY_MISSING_TTL_MS + 1);
        mockGetSecret.mockResolvedValue('sk-test');
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ transcript: 'namaste', language_code: 'hi-IN' }), { status: 200 }),
        );
        await sarvamSTT(audio());
        expect(mockGetSecret).toHaveBeenCalledTimes(2);
        expect(fetchSpy).toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
