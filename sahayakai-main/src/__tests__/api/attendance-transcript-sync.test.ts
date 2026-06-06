/**
 * F9 forensics fixes — POST /api/attendance/transcript-sync
 *
 * Covers:
 * - F9-002: concurrent terminal syncs must result in only one LLM summary
 *   generation. Lock is claimed via Firestore transaction.
 * - F9-007: server overrides client-supplied turnCount with transcript.length.
 */

// Make crypto.timingSafeEqual work with stable inputs by stubbing a fixed key.
const INTERNAL_KEY = 'test-internal-key-1234567890';
process.env.VOICE_PIPELINE_INTERNAL_KEY = INTERNAL_KEY;

// In-memory fake outreach doc
let outreachDoc: Record<string, any> = {};
const updates: Record<string, any>[] = [];

// Track txn calls vs LLM calls
let llmCallCount = 0;

jest.mock('@/ai/flows/parent-call-agent', () => ({
    generateCallSummary: jest.fn(async () => {
        llmCallCount++;
        return { callQuality: 'good', parentSentiment: 'positive' };
    }),
}));

let txnChain: Promise<any> = Promise.resolve();

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        const docRef = {
            id: 'outreach-1',
            get: async () => ({
                exists: Object.keys(outreachDoc).length > 0,
                data: () => ({ ...outreachDoc }),
                id: 'outreach-1',
            }),
            update: async (u: Record<string, any>) => {
                updates.push({ ...u });
                Object.assign(outreachDoc, u);
            },
        };
        return {
            collection: () => ({ doc: () => docRef }),
            runTransaction: (fn: (tx: any) => Promise<any>) => {
                // Firestore txns on the same doc are serialized. Model that
                // via a global promise chain — concurrent runTransaction calls
                // queue up.
                const next = txnChain.then(async () => {
                    const tx = {
                        get: async (_ref: any) => ({
                            exists: Object.keys(outreachDoc).length > 0,
                            data: () => ({ ...outreachDoc }),
                            id: 'outreach-1',
                        }),
                        update: (_ref: any, u: Record<string, any>) => {
                            updates.push({ ...u });
                            Object.assign(outreachDoc, u);
                        },
                    };
                    return await fn(tx);
                });
                txnChain = next.catch(() => {});
                return next;
            },
        };
    },
}));

function makeRequest(body: any) {
    const headers = new Map<string, string>([
        ['x-internal-key', INTERNAL_KEY],
    ]);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

describe('POST /api/attendance/transcript-sync — F9 fixes', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/attendance/transcript-sync/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        outreachDoc = {
            parentLanguage: 'Hindi',
            studentName: 'Alice',
            className: 'Class 5A',
            reason: 'absence',
            generatedMessage: 'msg',
            callSid: 'CA123',
            callStatus: 'in-progress',
        };
        updates.length = 0;
        llmCallCount = 0;
        txnChain = Promise.resolve();
        jest.clearAllMocks();
    });

    it('F9-007: server-derived turnCount overrides client value', async () => {
        const transcript = [
            { role: 'agent', text: 'hi' },
            { role: 'parent', text: 'hello' },
            { role: 'agent', text: 'thanks' },
        ];
        const res = await POST(makeRequest({
            outreachId: 'outreach-1',
            transcript,
            turnCount: 99,       // client lies
            callStatus: 'completed',
        }));
        expect(res.status).toBe(200);

        const turnCountUpdate = updates.find((u) => 'turnCount' in u);
        expect(turnCountUpdate).toBeDefined();
        expect(turnCountUpdate!.turnCount).toBe(transcript.length); // server overrides
    });

    it('F9-002: concurrent terminal syncs only generate one summary', async () => {
        const transcript = [
            { role: 'agent', text: 'hi' },
            { role: 'parent', text: 'hello' },
            { role: 'agent', text: 'thanks' },
        ];

        // Fire two concurrent requests — both carry the same terminal callStatus
        const [r1, r2] = await Promise.all([
            POST(makeRequest({
                outreachId: 'outreach-1',
                transcript,
                turnCount: transcript.length,
                callStatus: 'completed',
            })),
            POST(makeRequest({
                outreachId: 'outreach-1',
                transcript,
                turnCount: transcript.length,
                callStatus: 'completed',
            })),
        ]);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);

        // Give the fire-and-forget summary promise a tick to settle.
        await new Promise((r) => setTimeout(r, 50));

        expect(llmCallCount).toBe(1);
    });
});
