/**
 * The malformed-response guard in the shared generator spine.
 *
 * `use-generator.ts` has always documented this guard, but it only ever
 * caught a thrown `MalformedResponseError`. A `parseResponse` that reached
 * for a field the 200 body didn't carry returned `undefined`, and the run
 * settled as `status: "done"` with a null result — the page drew an empty
 * result region, `onSuccess` fired, and the teacher was told nothing had
 * gone wrong. That is how the worksheet wizard rendered blank pages for a
 * response body that was missing `worksheetContent`.
 *
 * These cases hold the class, not the instance: any endpoint, any parser.
 */

import { renderHook, act } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({
    auth: { currentUser: null },
}));

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        requireAuth: () => true,
        openAuthModal: jest.fn(),
    }),
}));

import { useGenerator } from '@/features/generator/hooks/use-generator';
import { MalformedResponseError } from '@/features/generator/types';

function mockJsonResponse(body: unknown, status = 200) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as unknown as typeof fetch;
}

describe('useGenerator — a run that parsed to nothing is not "done"', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reports MALFORMED_RESPONSE when parseResponse returns undefined', async () => {
        // The exact production body: HTTP 200, every structured field, and
        // not the one field the parser needs.
        mockJsonResponse({ title: 'Counting Mangoes', activities: [] });
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const { result } = renderHook(() =>
            useGenerator<{ prompt: string }, string>({
                feature: 'worksheet',
                endpoint: '/api/ai/worksheet',
                buildRequest: (v) => ({ ...v }),
                parseResponse: (json) =>
                    (json as { worksheetContent: string }).worksheetContent,
                onSuccess,
                onError,
            }),
        );

        await act(async () => {
            await result.current.generate({ prompt: 'counting worksheet' });
        });

        expect(result.current.status).toBe('error');
        expect(result.current.result).toBeNull();
        expect(result.current.error?.code).toBe('MALFORMED_RESPONSE');
        // The teacher must be told; silence is what made this bug invisible.
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'MALFORMED_RESPONSE' }),
        );
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('still maps an explicitly thrown MalformedResponseError', async () => {
        mockJsonResponse({ worksheetContent: '   ' });
        const onSuccess = jest.fn();

        const { result } = renderHook(() =>
            useGenerator<{ prompt: string }, string>({
                feature: 'worksheet',
                endpoint: '/api/ai/worksheet',
                buildRequest: (v) => ({ ...v }),
                parseResponse: (json) => {
                    const content = (json as { worksheetContent?: string }).worksheetContent;
                    if (typeof content !== 'string' || !content.trim()) {
                        throw new MalformedResponseError('incomplete worksheet');
                    }
                    return content;
                },
                onSuccess,
            }),
        );

        await act(async () => {
            await result.current.generate({ prompt: 'counting worksheet' });
        });

        expect(result.current.status).toBe('error');
        expect(result.current.error?.code).toBe('MALFORMED_RESPONSE');
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('settles as done when the body carries a usable result', async () => {
        mockJsonResponse({ worksheetContent: '# Counting Mangoes' });
        const onSuccess = jest.fn();

        const { result } = renderHook(() =>
            useGenerator<{ prompt: string }, string>({
                feature: 'worksheet',
                endpoint: '/api/ai/worksheet',
                buildRequest: (v) => ({ ...v }),
                parseResponse: (json) =>
                    (json as { worksheetContent: string }).worksheetContent,
                onSuccess,
            }),
        );

        await act(async () => {
            await result.current.generate({ prompt: 'counting worksheet' });
        });

        expect(result.current.status).toBe('done');
        expect(result.current.result).toBe('# Counting Mangoes');
        expect(onSuccess).toHaveBeenCalled();
    });
});

// ── One generation = one Library row ─────────────────────────────────────────
// The hook mints the artifact id the server files the generation under, and
// the display's Save upserts it. Without this the flow auto-saved UUID A and
// every Save click minted UUID B, C, …

describe('useGenerator — stable Library contentId', () => {
    beforeEach(() => jest.clearAllMocks());

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const sentBody = (call = 0) =>
        JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body as string) as Record<string, unknown>;

    function renderArtifactGenerator(persistsArtifact: boolean) {
        return renderHook(() =>
            useGenerator<{ prompt: string }, string>({
                feature: 'worksheet',
                endpoint: '/api/ai/worksheet',
                persistsArtifact,
                buildRequest: (v) => ({ ...v }),
                parseResponse: (json) => (json as { worksheetContent: string }).worksheetContent,
            }),
        );
    }

    it('sends one contentId per submit and exposes it with the result', async () => {
        mockJsonResponse({ worksheetContent: '# A' });
        const { result } = renderArtifactGenerator(true);

        await act(async () => { await result.current.generate({ prompt: 'a' }); });

        const sent = sentBody().contentId;
        expect(sent).toMatch(UUID);
        expect(result.current.contentId).toBe(sent);
    });

    it('a new submit (regenerate) gets a new id — a new artifact', async () => {
        mockJsonResponse({ worksheetContent: '# A' });
        const { result } = renderArtifactGenerator(true);

        await act(async () => { await result.current.generate({ prompt: 'a' }); });
        await act(async () => { await result.current.generate({ prompt: 'a' }); });

        expect(sentBody(0).contentId).not.toBe(sentBody(1).contentId);
        expect(result.current.contentId).toBe(sentBody(1).contentId);
    });

    it('does not send or expose an id for endpoints that do not persist', async () => {
        mockJsonResponse({ worksheetContent: '# A' });
        const { result } = renderArtifactGenerator(false);

        await act(async () => { await result.current.generate({ prompt: 'a' }); });

        expect(sentBody()).not.toHaveProperty('contentId');
        expect(result.current.contentId).toBeNull();
    });

    it('a failed generation leaves no Library id behind', async () => {
        mockJsonResponse({ error: 'boom' }, 500);
        const { result } = renderArtifactGenerator(true);

        await act(async () => { await result.current.generate({ prompt: 'a' }); });

        expect(result.current.status).toBe('error');
        expect(result.current.contentId).toBeNull();
    });

    it('a restored item keeps its own id so Save updates it', () => {
        const { result } = renderArtifactGenerator(true);

        act(() => result.current.setResult('# Saved', 'restored-id-1'));

        expect(result.current.contentId).toBe('restored-id-1');
        act(() => result.current.reset());
        expect(result.current.contentId).toBeNull();
    });
});
