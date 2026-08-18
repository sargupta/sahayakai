/**
 * POST /api/vidya-voice/start-session
 *
 * The route returns the Vertex-proxy shape (`mode: "vertex-proxy"`, a
 * `wsUrl` on the sidecar and an HMAC `streamToken`) instead of the
 * Developer-API ephemeral token, and it opens only for uids named in
 * `VIDYA_VOICE_LIVE_ALLOWED_UIDS`.
 *
 * What these tests pin:
 *   - an allowlisted uid gets the proxy shape and nothing else
 *   - a uid off the allowlist gets the ordinary 503, and the allowlist
 *     being unset denies everyone (fail-closed — the feature flag is
 *     already `true` in the deployed environment)
 *   - the flag being off still short-circuits before anything is minted
 *   - the stricter body validation survived the transport swap: bad
 *     JSON and a missing `currentScreenContext.path` are still 400
 */

const mockMintStreamToken = jest.fn();
const mockCallSidecar = jest.fn();

jest.mock('@/lib/sidecar/signing', () => ({
    mintStreamToken: (...args: unknown[]) => mockMintStreamToken(...args),
}));

jest.mock('@/lib/sidecar/vidya-voice-client', () => ({
    callSidecarVidyaVoiceStartSession: (...args: unknown[]) =>
        mockCallSidecar(...args),
    VidyaVoiceSidecarConfigError: class extends Error { },
    VidyaVoiceSidecarTimeoutError: class extends Error { },
    VidyaVoiceSidecarHttpError: class extends Error { },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Capture every NextResponse.json invocation so we can assert on the actual
// wire payload — the project's jsdom env does not preserve NextResponse
// bodies (same shim as assessment-scanner.test.ts).
const jsonSpy = jest.fn();
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => {
            jsonSpy(data, init);
            return {
                status: init?.status ?? 200,
                ok: (init?.status ?? 200) < 400,
                json: async () => data,
                text: async () => JSON.stringify(data),
                headers: new Map(),
            };
        },
    },
}));

const ALLOWED_UID = 'teacher-canary-01';
const SIDECAR_URL = 'https://sahayakai-agents-example.a.run.app';

function makeRequest(
    body: unknown,
    uid: string | null = ALLOWED_UID,
    { invalidJson = false } = {},
) {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        json: async () => {
            if (invalidJson) throw new SyntaxError('bad json');
            return body;
        },
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as any;
}

function validBody(overrides: Record<string, unknown> = {}) {
    return {
        teacherProfile: {
            preferredGrade: 'Class 5',
            preferredSubject: 'Science',
            preferredLanguage: 'hi',
            schoolContext: 'Rural primary school',
        },
        currentScreenContext: { path: '/lesson-plan', uiState: null },
        detectedLanguage: null,
        ...overrides,
    };
}

describe('POST /api/vidya-voice/start-session', () => {
    let POST: (req: any) => Promise<Response>;
    const originalEnv = { ...process.env };

    beforeAll(async () => {
        const mod = await import('@/app/api/vidya-voice/start-session/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.VIDYA_VOICE_LIVE_ENABLED = 'true';
        process.env.VIDYA_VOICE_LIVE_ALLOWED_UIDS = ALLOWED_UID;
        process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL = SIDECAR_URL;
        mockMintStreamToken.mockResolvedValue({
            token: `${ALLOWED_UID}.1900000000.c2ln`,
            expiresInSeconds: 120,
        });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    // ─── the shipping path ────────────────────────────────────────────

    it('returns the Vertex-proxy shape for an allowlisted uid', async () => {
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(200);

        const json = (await res.json()) as Record<string, unknown>;
        expect(json).toEqual({
            mode: 'vertex-proxy',
            wsUrl: `wss://sahayakai-agents-example.a.run.app/v1/vidya-voice/stream`,
            streamToken: `${ALLOWED_UID}.1900000000.c2ln`,
            expiresInSeconds: 120,
            languageCode: 'hi',
        });

        // The token is bound to the caller, not to anything in the body.
        expect(mockMintStreamToken).toHaveBeenCalledWith(ALLOWED_UID);
        // The billing-dead Developer-API mint is never reached.
        expect(mockCallSidecar).not.toHaveBeenCalled();
        // No Google credential leaks into the response.
        expect(json).not.toHaveProperty('sessionToken');
    });

    it('prefers detectedLanguage over the profile language, and clamps it', async () => {
        // profile says "hi"; detectedLanguage wins, trimmed and capped at 10.
        const res = await POST(
            makeRequest(validBody({ detectedLanguage: '  bn-IN-with-a-long-tail  ' })),
        );
        const json = (await res.json()) as Record<string, unknown>;
        expect(json.languageCode).toBe('bn-IN-with');
    });

    it('falls back to "en" when neither language is given', async () => {
        const res = await POST(
            makeRequest(
                validBody({
                    teacherProfile: {
                        preferredGrade: null,
                        preferredSubject: null,
                        preferredLanguage: null,
                        schoolContext: null,
                    },
                    detectedLanguage: null,
                }),
            ),
        );
        const json = (await res.json()) as Record<string, unknown>;
        expect(json.languageCode).toBe('en');
    });

    it('accepts spaced and empty entries in the allowlist', async () => {
        process.env.VIDYA_VOICE_LIVE_ALLOWED_UIDS = ` other-uid , ${ALLOWED_UID} ,,`;
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(200);
    });

    // ─── gates ────────────────────────────────────────────────────────

    it('returns 401 without x-user-id', async () => {
        const res = await POST(makeRequest(validBody(), null));
        expect(res.status).toBe(401);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 503 when the feature flag is off, even for an allowlisted uid', async () => {
        process.env.VIDYA_VOICE_LIVE_ENABLED = 'false';
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });

    it('returns 503 when the feature flag is unset', async () => {
        delete process.env.VIDYA_VOICE_LIVE_ENABLED;
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 503 for a uid that is not on the allowlist', async () => {
        const res = await POST(makeRequest(validBody(), 'some-other-teacher'));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });

    it('denies everyone when the allowlist is unset (fail-closed)', async () => {
        delete process.env.VIDYA_VOICE_LIVE_ALLOWED_UIDS;
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('denies everyone when the allowlist is empty or whitespace', async () => {
        process.env.VIDYA_VOICE_LIVE_ALLOWED_UIDS = '  , ,';
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('does not treat the allowlist as a prefix or substring match', async () => {
        process.env.VIDYA_VOICE_LIVE_ALLOWED_UIDS = `${ALLOWED_UID}-extra`;
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
    });

    it('returns 503 when the sidecar base URL is not configured', async () => {
        delete process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL;
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(503);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 500 when minting the stream token fails', async () => {
        mockMintStreamToken.mockRejectedValue(new Error('secret unavailable'));
        const res = await POST(makeRequest(validBody()));
        expect(res.status).toBe(500);
    });

    // ─── body validation kept from the sidecar-mint version ───────────

    it('returns 400 on malformed JSON', async () => {
        const res = await POST(makeRequest(null, ALLOWED_UID, { invalidJson: true }));
        expect(res.status).toBe(400);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 400 when the body is not an object', async () => {
        const res = await POST(makeRequest('not-an-object'));
        expect(res.status).toBe(400);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 400 when currentScreenContext is missing', async () => {
        const res = await POST(
            makeRequest(validBody({ currentScreenContext: undefined })),
        );
        expect(res.status).toBe(400);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 400 when currentScreenContext.path is blank', async () => {
        const res = await POST(
            makeRequest(validBody({ currentScreenContext: { path: '   ' } })),
        );
        expect(res.status).toBe(400);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });

    it('returns 400 when currentScreenContext.path is not a string', async () => {
        const res = await POST(
            makeRequest(validBody({ currentScreenContext: { path: 42 } })),
        );
        expect(res.status).toBe(400);
        expect(mockMintStreamToken).not.toHaveBeenCalled();
    });
});
