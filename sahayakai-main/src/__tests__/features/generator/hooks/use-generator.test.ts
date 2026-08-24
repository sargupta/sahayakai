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
