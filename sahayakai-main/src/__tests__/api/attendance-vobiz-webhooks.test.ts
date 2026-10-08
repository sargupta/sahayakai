/**
 * @jest-environment node
 *
 * The Vobiz answer and status webhooks had no route tests (audit,
 * docs/calling/PARENT_CALL_AUDIT_2026-10-08.md §8). These pin what each one
 * writes and that out-of-order or duplicate events cannot corrupt the record.
 */
import { createFakeDb, type Store } from '../helpers/fake-attendance-db';

jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => (global as any).__fakeDb }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/calling-hours', () => ({
    checkCallingWindow: () => ({ allowed: true, istHour: 11, istTime: '11:00', reason: '', nextAllowedAt: null }),
}));
jest.mock('@/lib/vobiz/tokens', () => ({
    ...jest.requireActual('@/lib/vobiz/tokens'),
    verifyVobizToken: async (_domain: string, token: string | null) => (token === 'good' ? 'o1' : null),
    mintVobizToken: async () => ({ token: 'stream-token', expiresAt: 0 }),
}));

let store: Store;
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
    store = { parent_outreach: { o1: { callStatus: 'initiated', teacherUid: 't1', parentLanguage: 'Hindi' } } };
    (global as any).__fakeDb = createFakeDb(store);
    env.VOBIZ_STREAM_BASE_URL = 'https://telephony.example';
});

/** The routes read only url, method and formData(); the jest Request polyfill lacks formData. */
function post(path: string, form: Record<string, string>) {
    return {
        url: `https://www.sahayakai.com${path}`,
        method: 'POST',
        formData: async () => ({ get: (k: string) => form[k] ?? null }),
    } as any;
}

async function status(kind: 'ring' | 'hangup', form: Record<string, string> = {}, token = 'good') {
    const { POST } = await import('@/app/api/attendance/vobiz/status/route');
    return POST(post(`/api/attendance/vobiz/status?t=${token}&kind=${kind}`, form));
}

async function answer(form: Record<string, string> = { CallUUID: 'cu-1' }) {
    const { POST } = await import('@/app/api/attendance/vobiz/answer/route');
    return POST(post('/api/attendance/vobiz/answer?t=good', form));
}

describe('Vobiz status webhook', () => {
    it('ring moves the call to ringing', async () => {
        await status('ring');
        expect(store.parent_outreach.o1).toMatchObject({ callStatus: 'ringing', ringingAt: expect.any(String) });
    });

    it('hangup records the outcome, duration and cause', async () => {
        await status('hangup', { HangupCause: 'NORMAL_CLEARING', Duration: '43' });
        expect(store.parent_outreach.o1).toMatchObject({
            callStatus: 'completed',
            callDurationSeconds: 43,
            vobizHangupCause: 'NORMAL_CLEARING',
        });
    });

    it('a late ring after the hangup does not reopen a finished call', async () => {
        await status('hangup', { HangupCause: 'USER_BUSY', Duration: '0' });
        await status('ring');
        expect(store.parent_outreach.o1.callStatus).toBe('busy');
    });

    it('a duplicate hangup with a different cause does not overwrite the first outcome', async () => {
        await status('hangup', { HangupCause: 'NORMAL_CLEARING', Duration: '43' });
        await status('hangup', { HangupCause: 'CALL_REJECTED', Duration: '0' });
        // Status AND details: a duplicate once turned a 61 s call into a 0 s one.
        expect(store.parent_outreach.o1).toMatchObject({
            callStatus: 'completed',
            callDurationSeconds: 43,
            vobizHangupCause: 'NORMAL_CLEARING',
        });
    });

    it('a bad token writes nothing and still answers 200 (no retry storm)', async () => {
        const res = await status('hangup', { HangupCause: 'NORMAL_CLEARING', Duration: '9' }, 'forged');
        expect(res.status).toBe(200);
        expect(store.parent_outreach.o1.callStatus).toBe('initiated');
    });
});

describe('Vobiz answer webhook', () => {
    it('marks the call in progress, stores the CallUUID and returns a bidirectional stream', async () => {
        const res = await answer();
        const xml = await res.text();
        expect(store.parent_outreach.o1).toMatchObject({ callStatus: 'in_progress', vobizCallUuid: 'cu-1' });
        expect(xml).toContain('bidirectional="true"');
        expect(xml).toContain('wss://telephony.example/telephony/vobiz/stream');
    });

    it('an answer that arrives after the hangup does not regress the outcome', async () => {
        await status('hangup', { HangupCause: 'NO_ANSWER', Duration: '0' });
        await answer();
        expect(store.parent_outreach.o1.callStatus).toBe('no_answer');
    });
});
