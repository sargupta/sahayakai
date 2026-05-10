/**
 * Tests for the Firebase App Check browser bridge (Phase R.2).
 *
 * Two surfaces under test:
 *
 * 1. `getFirebaseAppCheckToken()` — Tier-3 client attestation. Returns a
 *    minted token in real browsers, returns `null` in SSR / dev when no
 *    reCAPTCHA site key is provisioned (so callers know to skip the
 *    `X-Firebase-AppCheck` header instead of crashing).
 *
 * 2. The sidecar clients (`callSidecarReply` etc.) — verify they DO
 *    forward the App Check token to the sidecar as `X-Firebase-AppCheck`
 *    when the caller passes one in the options bag, and DO NOT include
 *    the header when the caller passes nothing.
 *
 * The Firebase SDK is fully mocked so the tests run in jsdom without a
 * real reCAPTCHA challenge or network call.
 */

// Mock @/lib/firebase early — the firebase-app-check module imports it
// at top level and needs an `app` export.
jest.mock('@/lib/firebase', () => ({
    app: { name: 'test-app' },
}));

// Mock firebase/app-check so initializeAppCheck and getToken are
// observable spies. By default initializeAppCheck returns a sentinel,
// getToken returns a fake token.
const mockInitializeAppCheck = jest.fn();
const mockGetToken = jest.fn();
jest.mock('firebase/app-check', () => ({
    initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
    getToken: (...args: unknown[]) => mockGetToken(...args),
    ReCaptchaV3Provider: jest.fn().mockImplementation((siteKey: string) => ({
        type: 'recaptcha-v3',
        siteKey,
    })),
}));

// Mock @/lib/secrets so the parent-call client's signing path doesn't
// try to reach Secret Manager.
jest.mock('@/lib/secrets', () => ({
    getSecret: jest.fn().mockResolvedValue('x'.repeat(64)),
}));

// Mock google-auth-library so we don't try to mint a real Cloud Run
// ID token in the unit test.
jest.mock('google-auth-library', () => {
    const fakeIdTokenClient = {
        getRequestHeaders: jest.fn().mockResolvedValue({
            Authorization: 'Bearer fake-cloud-run-id-token',
        }),
    };
    return {
        GoogleAuth: jest.fn().mockImplementation(() => ({
            getIdTokenClient: jest.fn().mockResolvedValue(fakeIdTokenClient),
        })),
    };
});

import {
    _resetAppCheckForTest,
    getFirebaseAppCheckToken,
    initFirebaseAppCheck,
} from '@/lib/firebase-app-check';
import {
    callSidecarReply,
    _resetTokenCacheForTest,
} from '@/lib/sidecar/parent-call-client';

const RECAPTCHA_KEY = 'NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY';
const SIDECAR_URL = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';
const SIDECAR_AUDIENCE = 'SAHAYAKAI_AGENTS_AUDIENCE';

describe('firebase-app-check', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        _resetAppCheckForTest();
        _resetTokenCacheForTest();
        mockInitializeAppCheck.mockReset();
        mockGetToken.mockReset();
        // jsdom provides `window` by default; ensure clean env each test.
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('getFirebaseAppCheckToken (browser)', () => {
        it('returns null when no reCAPTCHA site key is configured', async () => {
            delete process.env[RECAPTCHA_KEY];
            const token = await getFirebaseAppCheckToken();
            expect(token).toBeNull();
            expect(mockInitializeAppCheck).not.toHaveBeenCalled();
        });

        it('initializes App Check and mints a token when site key is set', async () => {
            process.env[RECAPTCHA_KEY] = 'test-site-key-abc';
            mockInitializeAppCheck.mockReturnValue({ type: 'mock-app-check' });
            mockGetToken.mockResolvedValue({ token: 'mocked-app-check-token' });

            const token = await getFirebaseAppCheckToken();

            expect(token).toBe('mocked-app-check-token');
            expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
            // Second call should reuse the cached AppCheck instance.
            await getFirebaseAppCheckToken();
            expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
        });

        it('returns null when getToken throws (e.g. blocked reCAPTCHA)', async () => {
            process.env[RECAPTCHA_KEY] = 'test-site-key';
            mockInitializeAppCheck.mockReturnValue({ type: 'mock-app-check' });
            mockGetToken.mockRejectedValue(new Error('reCAPTCHA timeout'));

            const token = await getFirebaseAppCheckToken();
            expect(token).toBeNull();
        });

        it('initFirebaseAppCheck is idempotent across calls', () => {
            process.env[RECAPTCHA_KEY] = 'test-site-key';
            mockInitializeAppCheck.mockReturnValue({ type: 'mock' });
            const first = initFirebaseAppCheck();
            const second = initFirebaseAppCheck();
            expect(first).toBe(second);
            expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
        });
    });

    describe('sidecar client forwards App Check token', () => {
        beforeEach(() => {
            process.env[SIDECAR_URL] = 'https://sidecar.test';
            process.env[SIDECAR_AUDIENCE] = 'https://sidecar.test';
        });

        it('attaches X-Firebase-AppCheck header when token provided', async () => {
            const fetchSpy = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    reply: 'ok',
                    shouldEndCall: false,
                    followUpQuestion: null,
                    sessionId: 's',
                    turnNumber: 1,
                    latencyMs: 10,
                    modelUsed: 'gemini-2.5-flash',
                    cacheHitRatio: null,
                }),
                text: async () => '',
            });

            await callSidecarReply(
                {
                    callSid: 'CAxxx',
                    turnNumber: 1,
                    studentName: 'Asha',
                    className: '5',
                    subject: 'Math',
                    reason: 'absent',
                    teacherMessage: 'hi',
                    parentLanguage: 'en',
                    parentSpeech: 'hello',
                },
                {
                    fetchImpl: fetchSpy as unknown as typeof fetch,
                    appCheckToken: 'browser-minted-app-check-token',
                },
            );

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [, init] = fetchSpy.mock.calls[0];
            const headers = init.headers as Record<string, string>;
            // The signed request layer also fires; we only assert App
            // Check is present on top of the existing chain.
            expect(headers['X-Firebase-AppCheck']).toBe('browser-minted-app-check-token');
            expect(headers['X-Content-Digest']).toMatch(/^sha256=/);
            expect(headers['X-Request-Timestamp']).toMatch(/^\d+$/);
            expect(headers['Authorization']).toBe('Bearer fake-cloud-run-id-token');
        });

        it('omits X-Firebase-AppCheck header when no token provided', async () => {
            const fetchSpy = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    reply: 'ok',
                    shouldEndCall: false,
                    followUpQuestion: null,
                    sessionId: 's',
                    turnNumber: 1,
                    latencyMs: 10,
                    modelUsed: 'gemini-2.5-flash',
                    cacheHitRatio: null,
                }),
                text: async () => '',
            });

            await callSidecarReply(
                {
                    callSid: 'CAxxx',
                    turnNumber: 1,
                    studentName: 'Asha',
                    className: '5',
                    subject: 'Math',
                    reason: 'absent',
                    teacherMessage: 'hi',
                    parentLanguage: 'en',
                    parentSpeech: 'hello',
                },
                { fetchImpl: fetchSpy as unknown as typeof fetch },
            );

            const [, init] = fetchSpy.mock.calls[0];
            const headers = init.headers as Record<string, string>;
            expect(headers['X-Firebase-AppCheck']).toBeUndefined();
        });
    });
});
