/**
 * Coverage for the UsageTracker convenience methods and quota rollback —
 * money-path helpers gated at 80% per-path coverage (jest.config.ts).
 */

const loggerInfoMock = jest.fn();
const loggerErrorMock = jest.fn();
const loggerWarnMock = jest.fn();

jest.mock('@/lib/logger', () => ({
    logger: {
        info: (...args: any[]) => loggerInfoMock(...args),
        error: (...args: any[]) => loggerErrorMock(...args),
        warn: (...args: any[]) => loggerWarnMock(...args),
    },
}));

const trackDailyUsageMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/services/cost-service', () => ({
    costService: {
        trackDailyUsage: (...args: any[]) => trackDailyUsageMock(...args),
    },
}));

const docSetMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({
        collection: () => ({
            doc: () => ({ set: docSetMock }),
        }),
    })),
}));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: (n: number) => ({ __increment: n }),
        serverTimestamp: () => ({ __ts: true }),
    },
}));

import { UsageTracker, rollbackDailyQuota } from '@/lib/usage-tracker';
import { getDb } from '@/lib/firebase-admin';

// logUsage fires incrementUserUsage without awaiting; drain microtasks.
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    loggerInfoMock.mockClear();
    loggerErrorMock.mockClear();
    trackDailyUsageMock.mockClear().mockResolvedValue(undefined);
    docSetMock.mockClear().mockResolvedValue(undefined);
});

describe('UsageTracker convenience methods', () => {
    it('trackTTS logs tts_characters with provider + cacheHit metadata', async () => {
        UsageTracker.trackTTS('user_1', 1234, true, 'sarvam');
        await flush();

        expect(loggerInfoMock).toHaveBeenCalledWith(
            'Usage Tracked: tts_characters',
            'COST_MONITORING',
            expect.objectContaining({
                userId: 'user_1',
                metric_type: 'tts_characters',
                value: 1234,
                cacheHit: true,
                provider: 'sarvam',
            }),
        );
        expect(trackDailyUsageMock).toHaveBeenCalledWith('tts_characters', 1234);
        // Per-user counter incremented for real users
        expect(docSetMock).toHaveBeenCalled();
    });

    it('trackTTS defaults to google provider and cacheHit=false', async () => {
        UsageTracker.trackTTS('user_1', 10);
        await flush();
        expect(loggerInfoMock).toHaveBeenCalledWith(
            'Usage Tracked: tts_characters',
            'COST_MONITORING',
            expect.objectContaining({ cacheHit: false, provider: 'google' }),
        );
    });

    it('trackGemini logs gemini_tokens with model metadata', async () => {
        UsageTracker.trackGemini('user_2', 5000, 'gemini-2.5-flash');
        await flush();
        expect(loggerInfoMock).toHaveBeenCalledWith(
            'Usage Tracked: gemini_tokens',
            'COST_MONITORING',
            expect.objectContaining({
                userId: 'user_2',
                value: 5000,
                model: 'gemini-2.5-flash',
            }),
        );
        expect(trackDailyUsageMock).toHaveBeenCalledWith('gemini_tokens', 5000);
    });

    it('trackGrounding logs a single grounding call with the query', async () => {
        UsageTracker.trackGrounding('user_3', 'what is photosynthesis');
        await flush();
        expect(loggerInfoMock).toHaveBeenCalledWith(
            'Usage Tracked: grounding_calls',
            'COST_MONITORING',
            expect.objectContaining({ value: 1, query: 'what is photosynthesis' }),
        );
    });

    it('trackImageGen logs a single image generation', async () => {
        UsageTracker.trackImageGen('user_4');
        await flush();
        expect(loggerInfoMock).toHaveBeenCalledWith(
            'Usage Tracked: image_generation',
            'COST_MONITORING',
            expect.objectContaining({ userId: 'user_4', value: 1 }),
        );
    });

    it('skips the per-user counter for anonymous users', async () => {
        UsageTracker.logUsage({ userId: 'anonymous_user', type: 'tts_characters', value: 5 });
        await flush();
        expect(docSetMock).not.toHaveBeenCalled();
    });

    it('swallows cost-service persistence failures (fire-and-forget)', async () => {
        trackDailyUsageMock.mockRejectedValueOnce(new Error('firestore down'));
        UsageTracker.trackImageGen('user_5');
        await flush();
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('Failed to persist usage'),
            expect.any(Error),
            'COST_MONITORING',
        );
    });

    it('swallows per-user counter increment failures', async () => {
        docSetMock.mockRejectedValueOnce(new Error('write denied'));
        UsageTracker.trackImageGen('user_6');
        await flush();
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('Failed to increment per-user usage'),
            expect.any(Error),
            'COST_MONITORING',
        );
    });
});

describe('rollbackDailyQuota', () => {
    it('decrements the feature counter by one (merge write)', async () => {
        await rollbackDailyQuota('user_7', 'video_storyteller');
        expect(docSetMock).toHaveBeenCalledWith(
            expect.objectContaining({ video_storyteller: { __increment: -1 } }),
            { merge: true },
        );
    });

    it('is best-effort: swallows infrastructure errors', async () => {
        (getDb as jest.Mock).mockRejectedValueOnce(new Error('db unavailable'));
        await expect(rollbackDailyQuota('user_8', 'video_storyteller')).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('rollbackDailyQuota failed'),
            expect.any(Error),
            'USAGE_GUARD',
        );
    });
});
