/**
 * Unit tests for the assessment-scanner sidecar dispatcher.
 *
 * Covers off / shadow / canary (in-bucket, out-of-bucket, fallback) /
 * full / 422 propagation / bucket determinism + uniformity.
 */

import type {
    AssessmentScannerInput,
    AssessmentScannerOutput,
} from '@/ai/schemas/assessment-scanner-schemas';

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(),
}));

jest.mock('@/ai/flows/assessment-scanner', () => ({
    gradeAssessment: jest.fn(),
    AssessmentEmptyExtractionError: class extends Error {},
    AssessmentPageUnreadableError: class extends Error {},
}));

jest.mock('@/data/ncert', () => ({
    getChapterById: jest.fn(() => null),
    getChaptersForGrade: jest.fn(() => []),
}));

jest.mock('@/lib/sidecar/assessment-scanner-client', () => {
    class AssessmentScannerSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'AssessmentScannerSidecarConfigError'; }
    }
    class AssessmentScannerSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(ms: number) {
            super(`timeout ${ms}`);
            this.name = 'AssessmentScannerSidecarTimeoutError';
            this.elapsedMs = ms;
        }
    }
    class AssessmentScannerSidecarHttpError extends Error {
        readonly status: number;
        constructor(s: number, b: string) {
            super(`http ${s}: ${b}`);
            this.name = 'AssessmentScannerSidecarHttpError';
            this.status = s;
        }
    }
    return {
        callSidecarAssessmentScanner: jest.fn(),
        AssessmentScannerSidecarConfigError,
        AssessmentScannerSidecarTimeoutError,
        AssessmentScannerSidecarHttpError,
    };
});

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

import { gradeAssessment } from '@/ai/flows/assessment-scanner';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarAssessmentScanner,
    AssessmentScannerSidecarHttpError,
    AssessmentScannerSidecarTimeoutError,
} from '@/lib/sidecar/assessment-scanner-client';
import {
    decideAssessmentScannerDispatch,
    dispatchAssessmentScanner,
} from '@/lib/sidecar/assessment-scanner-dispatch';
import { writeAgentShadowDiff } from '@/lib/sidecar/shadow-diff-writer';

const mockGenkit = gradeAssessment as jest.MockedFunction<typeof gradeAssessment>;
const mockSidecar = callSidecarAssessmentScanner as jest.MockedFunction<typeof callSidecarAssessmentScanner>;
const mockFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>;
const mockShadow = writeAgentShadowDiff as jest.MockedFunction<typeof writeAgentShadowDiff>;

const BASE_INPUT: AssessmentScannerInput = {
    assessmentId: '00000000-0000-4000-8000-000000000000',
    subject: 'Mathematics',
    gradeLevel: 'Class 10',
    language: 'English',
    pageUrls: ['https://example.com/page1.jpg'],
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: AssessmentScannerOutput = {
    assessmentId: BASE_INPUT.assessmentId,
    status: 'graded',
    pageCount: 1,
    totalAwardedMarks: 10,
    totalMaxMarks: 10,
    scorePct: 100,
    letterGrade: 'A+',
    questions: [],
    classAverageAtScan: null,
    conceptMastery: [],
    recommendedNextSteps: [],
    studentRecommendations: [],
};

const SIDECAR_OUTPUT = {
    ...GENKIT_OUTPUT,
    sidecarVersion: 'phase-w-alpha-1.0',
    latencyMs: 2200,
    modelUsed: 'gemini-2.5-pro',
};

function setMode(
    mode: 'off' | 'shadow' | 'canary' | 'full',
    percent = 100,
): void {
    mockFlags.mockResolvedValue({
        assessmentScannerSidecarMode: mode,
        assessmentScannerSidecarPercent: percent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('dispatchAssessmentScanner — off', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });
});

describe('dispatchAssessmentScanner — shadow', () => {
    it('returns Genkit and writes shadow-diff with sidecar payload', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(mockShadow).toHaveBeenCalledTimes(1);
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.agent).toBe('assessment-scanner');
        expect(sample.sidecarOk).toBe(true);
    });

    it('records sidecarOk=false when sidecar fails', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(new AssessmentScannerSidecarTimeoutError(8000));
        await dispatchAssessmentScanner(BASE_INPUT);
        const sample = mockShadow.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sample.sidecarOk).toBe(false);
        expect(sample.sidecar).toBeNull();
        expect(typeof sample.sidecarError).toBe('string');
    });
});

describe('dispatchAssessmentScanner — canary', () => {
    it('serves from sidecar when bucket < percent', async () => {
        setMode('canary', 100);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('sidecar');
        expect(mockGenkit).not.toHaveBeenCalled();
    });

    it('serves Genkit when bucket >= percent', async () => {
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit');
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on sidecar 5xx', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssessmentScannerSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssessmentScannerSidecarTimeoutError(60_000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('propagates 422 (page unreadable) without retrying Genkit', async () => {
        setMode('canary', 100);
        mockSidecar.mockRejectedValue(
            new AssessmentScannerSidecarHttpError(422, 'page unreadable'),
        );
        await expect(dispatchAssessmentScanner(BASE_INPUT)).rejects.toMatchObject({
            name: 'AssessmentScannerSidecarHttpError',
            status: 422,
        });
        expect(mockGenkit).not.toHaveBeenCalled();
    });
});

describe('dispatchAssessmentScanner — full', () => {
    it('serves from sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });

    it('falls back to Genkit on sidecar error', async () => {
        setMode('full');
        mockSidecar.mockRejectedValue(
            new AssessmentScannerSidecarHttpError(500, 'oops'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        const out = await dispatchAssessmentScanner(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });
});

describe('decideAssessmentScannerDispatch — bucket function', () => {
    it('is deterministic for a given uid', async () => {
        setMode('canary', 50);
        const a = await decideAssessmentScannerDispatch('uid-stable');
        const b = await decideAssessmentScannerDispatch('uid-stable');
        expect(a.bucket).toBe(b.bucket);
    });

    it('produces a uniform spread across 1000 uids (0..99)', async () => {
        setMode('canary', 50);
        const buckets = new Set<number>();
        for (let i = 0; i < 1000; i++) {
            const d = await decideAssessmentScannerDispatch(`uid-${i}`);
            expect(d.bucket).toBeGreaterThanOrEqual(0);
            expect(d.bucket).toBeLessThan(100);
            buckets.add(d.bucket);
        }
        expect(buckets.size).toBeGreaterThan(50);
    });
});
