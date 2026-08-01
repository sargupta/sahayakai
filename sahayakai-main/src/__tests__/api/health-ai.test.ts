/**
 * Test suite for GET /api/health/ai — AI provider health-check probe.
 * Mocks the Genkit AI instance and logger; verifies ok/degraded/down responses
 * with correct status codes, latency, and error handling.
 */

const genkitMocks = {
    ai: { generate: jest.fn() },
    DEFAULT_MODEL: 'vertexai/gemini-2.5-flash',
    usingVertex: true,
};
jest.mock('@/ai/genkit', () => genkitMocks);

const loggerMocks = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
jest.mock('@/lib/logger', () => ({
    logger: loggerMocks,
}));

// Repo convention: spy on NextResponse.json to capture bodies
import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
}
function lastJsonStatus(): number {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][1]?.status ?? 200;
}

describe('GET /api/health/ai', () => {
    let GET: any;

    beforeAll(async () => {
        ({ GET } = await import('@/app/api/health/ai/route'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns status ok with 200 when generate succeeds quickly', async () => {
        genkitMocks.ai.generate.mockResolvedValue({ text: 'x' });

        const res = await GET();

        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body.status).toBe('ok');
        expect(body.provider).toBe('vertexai');
        expect(body.model).toBe('vertexai/gemini-2.5-flash');
        expect(body.latencyMs).toBeGreaterThanOrEqual(0);
        expect(body.latencyMs).toBeLessThanOrEqual(2500);
        expect(body.checkedAt).toBeDefined();
        expect(body.error).toBeUndefined();
        expect(loggerMocks.warn).not.toHaveBeenCalled();
        expect(loggerMocks.error).not.toHaveBeenCalled();
    });

    it('returns status degraded with 200 when generate succeeds slowly (2500ms < latency < 6000ms)', async () => {
        genkitMocks.ai.generate.mockImplementation(
            () => new Promise((resolve) => {
                setTimeout(() => resolve({ text: 'x' }), 3000);
            }),
        );

        const responsePromise = GET();
        jest.advanceTimersByTime(3000);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body.status).toBe('degraded');
        expect(body.provider).toBe('vertexai');
        expect(body.model).toBe('vertexai/gemini-2.5-flash');
        expect(body.latencyMs).toBeGreaterThan(2500);
        expect(body.latencyMs).toBeLessThan(6000);
        expect(body.checkedAt).toBeDefined();
        expect(body.error).toBeUndefined();
        expect(loggerMocks.warn).toHaveBeenCalledWith(
            '[AI Health] slow',
            'HEALTH_CHECK',
            expect.objectContaining({ provider: 'vertexai' }),
        );
    });

    it('returns status down with 503 when generate throws an error', async () => {
        const testError = new Error('API error');
        testError.name = 'GoogleGenerativeAIError';
        genkitMocks.ai.generate.mockRejectedValue(testError);

        const res = await GET();

        expect(res.status).toBe(503);
        const body = lastJsonBody();
        expect(body.status).toBe('down');
        expect(body.provider).toBe('vertexai');
        expect(body.model).toBe('vertexai/gemini-2.5-flash');
        expect(body.latencyMs).toBeGreaterThanOrEqual(0);
        expect(body.checkedAt).toBeDefined();
        expect(body.error).toBe('GoogleGenerativeAIError');
        expect(loggerMocks.error).toHaveBeenCalledWith(
            '[AI Health] provider down',
            testError,
            'HEALTH_CHECK',
            expect.objectContaining({ provider: 'vertexai', status: 'down' }),
        );
    });

    it('returns status down with 503 when request times out (6000ms)', async () => {
        genkitMocks.ai.generate.mockImplementation(
            () => new Promise(() => {
                // Never resolves
            }),
        );

        const responsePromise = GET();
        jest.advanceTimersByTime(6000);
        const res = await responsePromise;

        expect(res.status).toBe(503);
        const body = lastJsonBody();
        expect(body.status).toBe('down');
        expect(body.error).toBe('TimeoutError');
        expect(body.provider).toBe('vertexai');
        expect(body.checkedAt).toBeDefined();
        expect(loggerMocks.error).toHaveBeenCalled();
    });

    it('uses googleai provider when usingVertex is false', async () => {
        genkitMocks.ai.generate.mockResolvedValue({ text: 'x' });
        genkitMocks.usingVertex = false;

        const res = await GET();

        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body.provider).toBe('googleai');

        genkitMocks.usingVertex = true;
    });

    it('respects GENKIT_DEFAULT_MODEL env var if set', async () => {
        genkitMocks.ai.generate.mockResolvedValue({ text: 'x' });
        const originalEnv = process.env.GENKIT_DEFAULT_MODEL;
        process.env.GENKIT_DEFAULT_MODEL = 'custom/model';

        const res = await GET();

        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body.model).toBe('custom/model');

        process.env.GENKIT_DEFAULT_MODEL = originalEnv;
    });

    it('includes Cache-Control no-store headers', async () => {
        genkitMocks.ai.generate.mockResolvedValue({ text: 'x' });

        await GET();

        const callArgs = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
        const headers = callArgs[1]?.headers;
        expect(headers?.['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });
});
