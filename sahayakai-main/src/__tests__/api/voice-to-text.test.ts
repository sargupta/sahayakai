/**
 * Sarvam MIME gate.
 *
 * Background: Sarvam Saaras v3 accepts mpeg/mp3/wav AND opus in webm/ogg
 * containers (webm/ogg re-verified empirically on 2026-07-05: saaras:v3,
 * HTTP 200 + accurate Hindi transcript for both). An older Sarvam model
 * rejected opus containers with HTTP 400, so the route used to skip straight
 * to Gemini for the browser MediaRecorder default (`audio/webm;codecs=opus`
 * on Chrome, `audio/ogg;codecs=opus` on Firefox) — which meant EVERY mic
 * recording bypassed the cheaper, India-resident Sarvam path. The gate now
 * sends webm/ogg to Sarvam and only skips genuinely unsupported/empty MIMEs.
 *
 * Plan-check is bypassed by mocking @/lib/plan-guard so withPlanCheck
 * returns the inner handler verbatim.
 *
 * See qa/results/lane-F/VIDYA_VOICE_DEBUG.md and VIDYA_VOICE_FIX.md.
 */

const mockSarvamSTT = jest.fn();
const mockDispatchVoiceToText = jest.fn();

jest.mock('@/lib/sarvam', () => ({
    sarvamSTT: (...args: any[]) => mockSarvamSTT(...args),
}));
jest.mock('@/lib/sidecar/voice-to-text-dispatch', () => ({
    dispatchVoiceToText: (...args: any[]) => mockDispatchVoiceToText(...args),
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/ai-error-response', () => ({
    logAIError: jest.fn(),
}));
jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck: () => (handler: any) => handler,
}));
// Avoid pulling in Genkit / Google AI bindings via the flow module.
jest.mock('@/ai/flows/voice-to-text', () => ({
    normalizeIsoLang: (s?: string | null) => (s ? String(s).toLowerCase() : undefined),
    scriptMatchesExpected: () => true,
}));

function makeAudioRequest(mime: string, expectedLanguage?: string, userId: string | null = 'test-uid') {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    // Duck-typed File for the route — uses `.size`, `.type`, `.arrayBuffer()`.
    const file = {
        size: bytes.byteLength,
        type: mime,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    };

    const fields = new Map<string, any>();
    fields.set('audio', file);
    if (expectedLanguage) fields.set('expectedLanguage', expectedLanguage);

    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);

    return {
        formData: async () => ({ get: (key: string) => fields.get(key) ?? null }),
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

describe('POST /api/ai/voice-to-text', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/ai/voice-to-text/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatchVoiceToText.mockResolvedValue({ text: 'hello world', language: 'en' });
        mockSarvamSTT.mockResolvedValue({ text: 'should-not-be-called', language: 'en' });
    });

    it('calls Sarvam for audio/webm;codecs=opus (Chrome; opus re-verified accepted)', async () => {
        mockSarvamSTT.mockResolvedValue({ text: 'transcribed', language: 'hi' });
        const res = await POST(makeAudioRequest('audio/webm;codecs=opus'));
        expect(res.status).toBe(200);
        expect(mockSarvamSTT).toHaveBeenCalledTimes(1);
        expect(mockDispatchVoiceToText).not.toHaveBeenCalled();
    });

    it('calls Sarvam for audio/ogg;codecs=opus (Firefox; opus re-verified accepted)', async () => {
        mockSarvamSTT.mockResolvedValue({ text: 'transcribed', language: 'hi' });
        const res = await POST(makeAudioRequest('audio/ogg;codecs=opus'));
        expect(res.status).toBe(200);
        expect(mockSarvamSTT).toHaveBeenCalledTimes(1);
        expect(mockDispatchVoiceToText).not.toHaveBeenCalled();
    });

    it('skips Sarvam for empty/unknown MIME', async () => {
        const res = await POST(makeAudioRequest(''));
        expect(res.status).toBe(200);
        expect(mockSarvamSTT).not.toHaveBeenCalled();
        expect(mockDispatchVoiceToText).toHaveBeenCalledTimes(1);
    });

    it('calls Sarvam for audio/wav (supported MIME)', async () => {
        mockSarvamSTT.mockResolvedValue({ text: 'transcribed', language: 'hi' });
        const res = await POST(makeAudioRequest('audio/wav'));
        expect(res.status).toBe(200);
        expect(mockSarvamSTT).toHaveBeenCalledTimes(1);
        expect(mockDispatchVoiceToText).not.toHaveBeenCalled();
    });

    it('calls Sarvam for audio/mpeg (supported MIME)', async () => {
        mockSarvamSTT.mockResolvedValue({ text: 'hello', language: 'en' });
        const res = await POST(makeAudioRequest('audio/mpeg'));
        expect(res.status).toBe(200);
        expect(mockSarvamSTT).toHaveBeenCalledTimes(1);
    });

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeAudioRequest('audio/wav', undefined, null));
        expect(res.status).toBe(401);
    });
});
