/**
 * H21: Razorpay webhook — payment↔plan amount binding + payments_ledger
 * idempotency on the subscription.charged provisioning path.
 *
 *  - correct amount → plan granted + ledger doc created in the same transaction
 *  - amount mismatch → NO grant, rejected ledger entry, 200 (no retry storm)
 *  - replayed payment id (ledger already applied) → single grant, no double writes
 *  - signature failures → 400/401
 */

// The project's jsdom test env doesn't preserve NextResponse.json bodies
// through `await res.json()` — mirror assessment-scanner.test.ts and mock it.
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            ok: (init?.status ?? 200) < 400,
            json: async () => data,
            text: async () => JSON.stringify(data),
            headers: new Map(),
        }),
    },
}));

// ── In-memory Firestore fake ────────────────────────────────────────────────

let store: Record<string, any> = {};
const subUpdateMock = jest.fn();
const userUpdateMock = jest.fn();
const ledgerCreateMock = jest.fn();
const setCustomUserClaimsMock = jest.fn();

function docRef(col: string, id: string) {
    const path = `${col}/${id}`;
    return {
        id,
        path,
        get: async () => ({ exists: path in store, data: () => store[path] }),
        create: async (data: any) => {
            if (path in store) {
                const e: any = new Error('ALREADY_EXISTS');
                e.code = 6;
                throw e;
            }
            store[path] = data;
            if (col === 'payments_ledger') ledgerCreateMock(id, data);
        },
        update: async (data: any) => {
            store[path] = { ...(store[path] ?? {}), ...data };
            if (col === 'subscriptions') subUpdateMock(id, data);
            if (col === 'users') userUpdateMock(id, data);
        },
        set: async (data: any) => {
            store[path] = { ...(store[path] ?? {}), ...data };
        },
    };
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => ({
            doc: (id: string) => docRef(col, id),
            where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
        }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                get: async (ref: any) => ref.get(),
                update: (ref: any, data: any) => {
                    void ref.update(data);
                },
                set: (ref: any, data: any) => {
                    void ref.set(data);
                },
                create: (ref: any, data: any) => {
                    if (ref.path in store) {
                        const e: any = new Error('ALREADY_EXISTS');
                        e.code = 6;
                        throw e;
                    }
                    store[ref.path] = data;
                    if (ref.path.startsWith('payments_ledger/')) {
                        ledgerCreateMock(ref.id, data);
                    }
                },
            };
            return fn(tx);
        },
    }),
}));

jest.mock('firebase-admin/auth', () => ({
    getAuth: () => ({
        setCustomUserClaims: setCustomUserClaimsMock,
        generateSignInWithEmailLink: jest.fn().mockResolvedValue('https://link'),
    }),
}));

const verifySignatureMock = jest.fn().mockReturnValue(true);
jest.mock('@/lib/razorpay', () => ({
    verifyWebhookSignature: (...args: any[]) => verifySignatureMock(...args),
    resolvePlanTypeFromPlanId: (planId: string) =>
        planId === 'plan_pro_m' || planId === 'plan_pro_a' ? 'pro' : null,
    RAZORPAY_PLANS: {
        pro_monthly: 'plan_pro_m',
        pro_annual: 'plan_pro_a',
        gold_monthly: '',
        gold_annual: '',
        premium_monthly: '',
        premium_annual: '',
    },
}));

import { POST } from '@/app/api/webhooks/razorpay/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

function chargedEvent(overrides: { paymentId?: string; amount?: number; currency?: string } = {}) {
    return {
        event: 'subscription.charged',
        payload: {
            subscription: {
                entity: {
                    id: 'sub_test_1',
                    plan_id: 'plan_pro_m',
                    status: 'active',
                    notes: { userId: 'user_1' },
                    current_start: 1_760_000_000,
                    current_end: 1_762_600_000,
                },
            },
            payment: {
                entity: {
                    id: overrides.paymentId ?? 'pay_test_1',
                    amount: overrides.amount ?? 19_900, // ₹199 pro monthly
                    currency: overrides.currency ?? 'INR',
                    status: 'captured',
                },
            },
        },
    };
}

function makeReq(event: unknown, signature: string | null = 'sig') {
    const body = JSON.stringify(event);
    return {
        text: async () => body,
        headers: {
            get: (name: string) =>
                name.toLowerCase() === 'x-razorpay-signature' ? signature : null,
        },
    } as unknown as Request;
}

beforeEach(() => {
    store = {};
    subUpdateMock.mockReset();
    userUpdateMock.mockReset();
    ledgerCreateMock.mockReset();
    setCustomUserClaimsMock.mockReset();
    verifySignatureMock.mockReset().mockReturnValue(true);
    // Pre-existing subscription + user docs (update() requires them logically)
    store['subscriptions/sub_test_1'] = { userId: 'user_1', status: 'created' };
    store['users/user_1'] = { planType: 'free' };
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/razorpay — H21 ledger + amount binding', () => {
    test('missing signature → 400; invalid signature → 401 (no writes)', async () => {
        const noSig = await POST(makeReq(chargedEvent(), null));
        expect(noSig.status).toBe(400);

        verifySignatureMock.mockReturnValue(false);
        const badSig = await POST(makeReq(chargedEvent()));
        expect(badSig.status).toBe(401);

        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(ledgerCreateMock).not.toHaveBeenCalled();
    });

    test('correct amount → plan granted, ledger applied transactionally', async () => {
        const res = await POST(makeReq(chargedEvent()));
        expect(res.status).toBe(200);

        // Plan granted
        expect(userUpdateMock).toHaveBeenCalledWith(
            'user_1',
            expect.objectContaining({ planType: 'pro', subscriptionId: 'sub_test_1' })
        );
        expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user_1', { planType: 'pro' });

        // Ledger schema
        expect(ledgerCreateMock).toHaveBeenCalledTimes(1);
        const [id, doc] = ledgerCreateMock.mock.calls[0];
        expect(id).toBe('pay_test_1');
        expect(doc).toMatchObject({
            uid: 'user_1',
            amountPaise: 19_900,
            currency: 'INR',
            planType: 'pro',
            status: 'applied',
            source: 'razorpay-webhook',
            amountVerified: true,
            expectedPaise: 19_900,
            subscriptionId: 'sub_test_1',
        });
    });

    test('AMOUNT MISMATCH (₹1 capture for a ₹199 plan) → no grant, rejected ledger, 200', async () => {
        const res = await POST(makeReq(chargedEvent({ paymentId: 'pay_cheap', amount: 100 })));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('rejected_amount_mismatch');

        // NO provisioning of any kind
        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(subUpdateMock).not.toHaveBeenCalled();
        expect(setCustomUserClaimsMock).not.toHaveBeenCalled();

        // Audit trail
        expect(store['payments_ledger/pay_cheap']).toMatchObject({
            status: 'rejected',
            rejectReason: 'AMOUNT_MISMATCH',
            amountPaise: 100,
            expectedPaise: 19_900,
        });
        // Event marked completed+rejected so Razorpay does not retry-storm
        const eventDoc = store['webhook_events/subscription.charged_pay_cheap'];
        expect(eventDoc.status).toBe('completed');
        expect(eventDoc.rejected).toBe('AMOUNT_MISMATCH');
    });

    test('non-INR currency → no grant, rejected ledger', async () => {
        const res = await POST(makeReq(chargedEvent({ paymentId: 'pay_usd', currency: 'USD' })));
        expect(res.status).toBe(200);
        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(store['payments_ledger/pay_usd']?.status).toBe('rejected');
    });

    test('REPLAYED payment id (webhook retry after failure) → single grant only', async () => {
        // First delivery applies the payment…
        const first = await POST(makeReq(chargedEvent()));
        expect(first.status).toBe(200);
        expect(userUpdateMock).toHaveBeenCalledTimes(1);
        expect(ledgerCreateMock).toHaveBeenCalledTimes(1);

        // …then the event doc is marked failed (e.g. claim step blew up after the
        // ledger transaction committed) and Razorpay redelivers the same payment.
        store['webhook_events/subscription.charged_pay_test_1'].status = 'failed';
        userUpdateMock.mockClear();
        subUpdateMock.mockClear();
        ledgerCreateMock.mockClear();

        const retry = await POST(makeReq(chargedEvent()));
        expect(retry.status).toBe(200);

        // Ledger blocked the second grant — zero provisioning writes.
        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(subUpdateMock).not.toHaveBeenCalled();
        expect(ledgerCreateMock).not.toHaveBeenCalled();
        // Claim set is idempotent and still runs (recovers claim-failed retries).
        expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user_1', { planType: 'pro' });
    });

    test('payment applied via ANOTHER path (org creation) → webhook grant is a no-op', async () => {
        // Ledger already holds this payment id from the org-creation path.
        store['payments_ledger/pay_test_1'] = {
            uid: 'user_1',
            planType: 'gold',
            status: 'applied',
            source: 'org-creation',
        };

        const res = await POST(makeReq(chargedEvent()));
        expect(res.status).toBe(200);

        expect(userUpdateMock).not.toHaveBeenCalled();
        expect(subUpdateMock).not.toHaveBeenCalled();
        // Original ledger entry untouched
        expect(store['payments_ledger/pay_test_1'].source).toBe('org-creation');
    });

    test('duplicate event id short-circuits via webhook_events before the ledger', async () => {
        const first = await POST(makeReq(chargedEvent()));
        expect(first.status).toBe(200);

        const dup = await POST(makeReq(chargedEvent()));
        const body = await dup.json();
        expect(body.status).toBe('already_processed');
    });
});
