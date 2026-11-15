/**
 * @jest-environment node
 *
 * Regression: /api/demo-call/status only blocked a NON-final status over a final one,
 * so a late 'canceled'/'failed' after 'completed' rewrote the outcome and duration.
 * Rule (same as the parent-call reconciler): the FIRST terminal status wins.
 */
jest.mock('@/lib/twilio-validate', () => ({ validateTwilioSignaturePost: () => true }));
const store: Record<string, Record<string, unknown>> = {};
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        const ref = (id: string) => ({ id });
        return {
            collection: () => ({ doc: (id: string) => ref(id) }),
            runTransaction: async (fn: (tx: any) => Promise<void>) =>
                fn({
                    get: async (r: { id: string }) => ({ exists: !!store[r.id], data: () => store[r.id] }),
                    update: (r: { id: string }, patch: Record<string, unknown>) => {
                        store[r.id] = { ...store[r.id], ...patch };
                    },
                }),
        };
    },
}));

function req(status: string, duration?: string) {
    const form = new Map<string, string>([['CallStatus', status], ...(duration ? [['CallDuration', duration]] as [string, string][] : [])]);
    return {
        url: 'https://app.test/api/demo-call/status?leadId=lead1',
        formData: async () => ({ forEach: (cb: (v: string, k: string) => void) => form.forEach((v, k) => cb(v, k)) }),
        headers: { get: () => null },
    } as any;
}

describe('POST /api/demo-call/status', () => {
    let POST: (r: any) => Promise<Response>;
    beforeAll(async () => ({ POST } = (await import('@/app/api/demo-call/status/route')) as any));
    beforeEach(() => {
        store.lead1 = { status: 'queued' };
    });

    it('records progress then the first terminal status', async () => {
        await POST(req('ringing'));
        expect(store.lead1.status).toBe('ringing');
        await POST(req('completed', '61'));
        expect(store.lead1).toMatchObject({ status: 'completed', callDurationSec: 61 });
    });

    it('a late second terminal status does not rewrite the outcome or duration', async () => {
        await POST(req('completed', '61'));
        await POST(req('canceled', '0'));
        await POST(req('failed'));
        expect(store.lead1).toMatchObject({ status: 'completed', callDurationSec: 61 });
    });

    it('a late ringing never downgrades a terminal status', async () => {
        await POST(req('busy'));
        await POST(req('ringing'));
        expect(store.lead1.status).toBe('busy');
    });
});
