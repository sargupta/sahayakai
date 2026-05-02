/**
 * Unit tests for the parent-message sidecar dispatcher (Phase C §C.5).
 */

import type {
    ParentMessageInput,
    ParentMessageOutput,
} from '@/ai/flows/parent-message-generator';
import type { ParentMessageSidecarMode } from '@/lib/sidecar/parent-message-dispatch';

jest.mock('@/ai/flows/parent-message-generator', () => ({
    generateParentMessage: jest.fn(),
}));

jest.mock('@/lib/sidecar/parent-message-client', () => {
    class ParentMessageSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ParentMessageSidecarConfigError';
        }
    }
    class ParentMessageSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`timeout ${elapsedMs}`);
            this.name = 'ParentMessageSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class ParentMessageSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`http ${status}`);
            this.name = 'ParentMessageSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class ParentMessageSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`behavioural ${axisHint} ${details}`);
            this.name = 'ParentMessageSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarParentMessage: jest.fn(),
        ParentMessageSidecarConfigError,
        ParentMessageSidecarTimeoutError,
        ParentMessageSidecarHttpError,
        ParentMessageSidecarBehaviouralError,
    };
});

import { generateParentMessage } from '@/ai/flows/parent-message-generator';
import { dispatchParentMessage } from '@/lib/sidecar/parent-message-dispatch';
import {
    callSidecarParentMessage,
    ParentMessageSidecarBehaviouralError,
    ParentMessageSidecarHttpError,
    ParentMessageSidecarTimeoutError,
    type SidecarParentMessageResponse,
} from '@/lib/sidecar/parent-message-client';

const mockGenkit = generateParentMessage as jest.MockedFunction<typeof generateParentMessage>;
const mockSidecar = callSidecarParentMessage as jest.MockedFunction<typeof callSidecarParentMessage>;

const BASE_INPUT: ParentMessageInput & { userId: string } = {
    studentName: 'Arav',
    className: 'Class 5',
    subject: 'Mathematics',
    reason: 'consecutive_absences',
    reasonContext: 'placeholder',
    parentLanguage: 'English',
    userId: 'teacher-uid-1',
};

const GENKIT_OUTPUT: ParentMessageOutput = {
    message: 'Genkit-path parent message about Arav.',
    languageCode: 'en-IN',
    wordCount: 7,
};

const SIDECAR_OUTPUT: SidecarParentMessageResponse = {
    message: 'Sidecar-path parent message about Arav with grounding.',
    languageCode: 'en-IN',
    wordCount: 9,
    sidecarVersion: 'phase-c.1.0',
    latencyMs: 850,
    modelUsed: 'gemini-2.0-flash',
};

function setMode(mode: ParentMessageSidecarMode, percent = 100): void {
    process.env.SAHAYAKAI_PARENT_MESSAGE_MODE = mode;
    process.env.SAHAYAKAI_PARENT_MESSAGE_PERCENT = String(percent);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.SAHAYAKAI_PARENT_MESSAGE_MODE;
    delete process.env.SAHAYAKAI_PARENT_MESSAGE_PERCENT;
});

afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.SAHAYAKAI_PARENT_MESSAGE_MODE;
    delete process.env.SAHAYAKAI_PARENT_MESSAGE_PERCENT;
});

describe('dispatchParentMessage — off mode', () => {
    it('calls Genkit only', async () => {
        setMode('off');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
    });

    it('default unset env var → off', async () => {
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('flag_off');
    });
});

describe('dispatchParentMessage — shadow mode', () => {
    it('returns Genkit message and runs sidecar in parallel', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.message).toBe(GENKIT_OUTPUT.message);
        expect(mockGenkit).toHaveBeenCalledTimes(1);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
    });

    it('still serves Genkit when sidecar errors', async () => {
        setMode('shadow');
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarTimeoutError(8000),
        );

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit');
    });
});

describe('dispatchParentMessage — canary mode', () => {
    it('returns sidecar message with telemetry', async () => {
        setMode('canary');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.message).toBe(SIDECAR_OUTPUT.message);
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-c.1.0');
        expect(mockGenkit).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on timeout', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarTimeoutError(8000),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on http error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarHttpError(503, 'unavailable'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural error', async () => {
        setMode('canary');
        mockSidecar.mockRejectedValue(
            new ParentMessageSidecarBehaviouralError('length', 'too short'),
        );
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('genkit_fallback');
    });
});

describe('dispatchParentMessage — full mode + percent gating', () => {
    it('full mode routes 100% to sidecar', async () => {
        setMode('full');
        mockSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.source).toBe('sidecar');
    });

    it('canary at 0% → off', async () => {
        setMode('canary', 0);
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toMatch(/^bucket_\d+_over_0$/);
    });

    it('invalid mode env → off', async () => {
        process.env.SAHAYAKAI_PARENT_MESSAGE_MODE = 'gibberish';
        mockGenkit.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchParentMessage(BASE_INPUT);
        expect(out.decision.mode).toBe('off');
    });
});
