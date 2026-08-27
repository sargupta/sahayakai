/**
 * The server half of the Virtual Field Trip 2xx contract.
 *
 * The route answers 202 when the dispatcher's budget expires while the Genkit
 * flow keeps writing the trip to Firestore — a deliberate choice, because a
 * 500 would send the teacher back to Generate and bill them again for content
 * that is already being saved. The cost of that choice is that a client
 * gating on `res.ok` alone reads an error envelope as a trip, so the shape of
 * the 202 and the shape of the 200 both have to be pinned:
 *
 *   - the 202 carries no trip fields, and says so in the published spec, so
 *     no client can be written against a contract that hides it;
 *   - a 200 always carries a non-empty `stops`, because that is the array the
 *     display maps over — anything less is a blank page billed as a success.
 */

const mockDispatchVirtualFieldTrip = jest.fn();
const mockReserveQuota = jest.fn();
const mockRollbackQuota = jest.fn();

// The real timeout error class — the route branches on `instanceof`, so a
// stand-in would test the mock rather than the mapping. Only the dispatch
// call itself is replaced.
jest.mock('@/lib/sidecar/virtual-field-trip-dispatch', () => ({
    ...jest.requireActual('@/lib/sidecar/virtual-field-trip-dispatch'),
    dispatchVirtualFieldTrip: (...args: unknown[]) => mockDispatchVirtualFieldTrip(...args),
}));

// Real plan-guard — the rollback path under test lives inside it. Only its
// two collaborators are stubbed.
jest.mock('@/lib/usage-counters', () => ({
    reserveQuota: (...args: unknown[]) => mockReserveQuota(...args),
    rollbackQuota: (...args: unknown[]) => mockRollbackQuota(...args),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn().mockResolvedValue({
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: true, data: () => ({ subscriptionEnabled: true }) }),
            }),
        }),
    }),
    getAuthInstance: jest.fn(),
    getStorageInstance: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// jsdom's Response polyfill doesn't preserve a NextResponse body through
// `await res.json()`, so capture the payload at the call site instead
// (same approach as worksheet-content-contract.test.ts).
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

import * as fs from 'fs';
import * as path from 'path';
import { POST } from '@/app/api/ai/virtual-field-trip/route';
import { VirtualFieldTripStillGeneratingError } from '@/lib/sidecar/virtual-field-trip-dispatch';

const STOP = {
    name: 'Teesta River, Jalpaiguri',
    description: 'The river that shapes the North Bengal plains.',
    educationalFact: 'It carries silt down from the Sikkim Himalaya.',
    reflectionPrompt: 'What would the plains look like without the Teesta?',
    googleEarthUrl: 'https://earth.google.com/web/search/Teesta',
    culturalAnalogy: 'Like the Ganga further south, the Teesta is a lifeline.',
    explanation: 'Introduces river systems and silt deposition.',
};

const DISPATCHED = {
    title: 'Rivers of North Bengal',
    gradeLevel: 'Class 7',
    subject: 'Geography',
    stops: [STOP],
    source: 'genkit' as const,
    decision: { mode: 'off' as const, reason: 'flag_off', bucket: 1 },
};

const VALID_BODY = {
    topic: 'A tour of the major rivers of North Bengal',
    gradeLevel: 'Class 7',
    language: 'en',
};

function makeRequest(body: unknown, userId: string | null = 'teacher-uid-1'): Request {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

function lastPayload() {
    return jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1][0];
}

describe('POST /api/ai/virtual-field-trip — what a 2xx is allowed to mean', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUBSCRIPTION_GATING_ENABLED = 'true';
        mockReserveQuota.mockResolvedValue({ ok: true });
        mockRollbackQuota.mockResolvedValue(undefined);
    });

    it('answers 202 with an envelope that carries no trip fields', async () => {
        mockDispatchVirtualFieldTrip.mockRejectedValue(
            new VirtualFieldTripStillGeneratingError(45_000, 45_001),
        );

        const res = await POST(makeRequest(VALID_BODY));

        expect(res.status).toBe(202);
        const payload = lastPayload();
        expect(payload).toMatchObject({ error: 'still_generating' });
        // This is the crash in one assertion: the client dereferenced `stops`
        // on this body because 202 passed `res.ok`.
        expect(payload).not.toHaveProperty('stops');
        expect(payload).not.toHaveProperty('title');
    });

    it('serves a 200 only with a non-empty stops array', async () => {
        mockDispatchVirtualFieldTrip.mockResolvedValue(DISPATCHED);

        const res = await POST(makeRequest(VALID_BODY));

        expect(res.status).toBe(200);
        expect(lastPayload()).toMatchObject({ title: DISPATCHED.title, stops: [STOP] });
        expect(mockRollbackQuota).not.toHaveBeenCalled();
    });

    it('refuses to bank a plan credit for a trip with no stops', async () => {
        mockDispatchVirtualFieldTrip.mockResolvedValue({ ...DISPATCHED, stops: [] });

        const res = await POST(makeRequest(VALID_BODY));

        // Not a 200: a blank success is worse than an honest error, and only a
        // non-2xx lets the plan gate roll the reservation back.
        expect(res.status).toBe(500);
        expect(mockRollbackQuota).toHaveBeenCalledWith('teacher-uid-1', 'virtual-field-trip');
    });
});

describe('api-specs/virtual-field-trip.yaml — the contract clients are written against', () => {
    const spec = fs.readFileSync(
        path.join(process.cwd(), 'api-specs', 'virtual-field-trip.yaml'),
        'utf8',
    );

    it('publishes the 202 the route can actually send', () => {
        // The spec listed 200 only. A client written against it had no reason
        // to expect a second success status, which is how the page shipped
        // with `if (!res.ok)` as its whole gate.
        expect(spec).toMatch(/'202':/);
        expect(spec).toMatch(/still_generating/);
    });

    it('states that a 200 always carries stops', () => {
        expect(spec).toMatch(/required: \[stops\]/);
        expect(spec).toMatch(/minItems: 1/);
    });
});
