/** @jest-environment node */
/**
 * loadCalendar on in-memory repos with REAL records from every source: callbacks made
 * through the callback service, campaigns and holidays on the school. Proves the
 * calendar shows them on their dates (including next month), keeps schools apart,
 * leaves callbacks out when Riya is off, and refuses unbounded ranges. Plus the
 * route shell's 401 / 403 / 404.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/server/sampark/auth', () => ({
    requireOrgAdmin: jest.fn(async (orgId: string, uid: string) => orgId === 'hillview-demo' && uid === 'admin-uid'),
    listAdministeredOrgs: jest.fn(async () => []),
}));

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { loadCalendar, type CalendarDeps } from '@/server/sampark/calendar';
import { createCallback, previewCallback, type CallbackDeps } from '@/server/sampark/callbacks';
import { previewRiyaCall, startRiyaCall } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { GET as calendarGET } from '@/app/api/sampark/[orgId]/calendar/route';

import { campaign, guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ORG = 'hillview-demo';
const OTHER = 'other-school';
const ADMIN = 'admin-uid';
const TZ = 'Asia/Kolkata';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const PTM: RiyaFacts = { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } };
const env = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(',') };

async function setup() {
    setPhoneEnv();
    const repo = createMemorySamparkRepo();
    const clock = testClock(WED_11_IST);
    await repo.upsertSchool(school({ holidays: ['2026-11-14'] }));
    await repo.upsertSchool(school({ orgId: OTHER, displayName: 'Other School', holidays: ['2026-11-02'] }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    const phone = '+919811111111';
    await repo.upsertGuardians(ORG, [guardian('g1', { displayName: 'Meena', phoneEnc: encryptPhone(phone), phoneHash: hashPhone(phone), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const cbDeps: CallbackDeps = {
        repo, clock, env, calls: createMemoryConversationRepo(), callbacks: createMemoryCallbackRepo(),
        http: { fetchImpl: jest.fn() as unknown as typeof fetch }, isOrgAdmin: async (o, u) => o === ORG && u === ADMIN,
    };
    const deps: CalendarDeps = { repo, clock, env, callbackDeps: async () => cbDeps, displayNames: async (uids) => Object.fromEntries(uids.map((u) => [u, u === ADMIN ? 'Principal Rao' : u])) };
    return { repo, clock, cbDeps, deps };
}

async function scheduleCallback(cbDeps: CallbackDeps, at: string) {
    const input = { purpose: 'ptm_invitation' as const, guardianId: 'g1', studentId: 's1', facts: PTM };
    const pre = await previewRiyaCall(cbDeps, ORG, input);
    const call = await startRiyaCall(cbDeps, ORG, ADMIN, { ...input, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: pre.announcement!, scenario: 'callback_requested' });
    const p = await previewCallback(cbDeps, ORG, { target: { sourceCallId: call.call.id }, scheduledAt: at, timeZone: TZ });
    return createCallback(cbDeps, ORG, ADMIN, { target: { sourceCallId: call.call.id }, scheduledAt: at, timeZone: TZ, requestKey: crypto.randomUUID(), confirmedAnnouncement: p.announcement! });
}

describe('loadCalendar', () => {
    it('shows callbacks, campaign calls, the PTM and holidays from the real records, on their dates', async () => {
        const s = await setup();
        const { callback } = await scheduleCallback(s.cbDeps, '2026-10-08T15:00:00+05:30');
        // A November PTM campaign scheduled to start calling on 18 Nov.
        await s.repo.createCampaign(campaign({ id: 'nov-ptm', facts: { kind: 'ptm_invite', date: '2026-11-20', time: { hour: 10, minute: 0 }, venueId: 'hall' }, notBefore: '2026-11-18T04:30:00.000Z', expiresAt: '2026-11-20T04:30:00.000Z' }));
        await s.repo.createCampaign(campaign({ id: 'draft', status: 'draft', approvedAt: null, approvedBy: null }));
        await s.repo.createCampaign({ ...campaign({ id: 'theirs', facts: { kind: 'ptm_invite', date: '2026-11-19', time: { hour: 9, minute: 0 }, venueId: 'hall' } }), orgId: OTHER });

        const oct = await loadCalendar(s.deps, ORG, '2026-09-30T18:30:00Z', '2026-10-31T18:30:00Z');
        const octKeys = oct.events.map((e) => e.key);
        expect(octKeys).toContain(`scheduled_call:${callback.id}`);
        expect(oct.events.find((e) => e.key === `scheduled_call:${callback.id}`)?.date).toBe('2026-10-08');
        expect(octKeys.some((k) => k.includes('draft'))).toBe(false);
        // The parent's request from the source call is waiting, counted once.
        expect(oct.awaitingApproval).toHaveLength(1);
        expect(oct.summary.awaitingApproval).toBe(1);
        expect(oct.people[ADMIN]).toBe('Principal Rao');

        const nov = await loadCalendar(s.deps, ORG, '2026-10-31T18:30:00Z', '2026-11-30T18:30:00Z');
        expect(nov.events.map((e) => `${e.type}@${e.date}`)).toEqual(['holiday@2026-11-14', 'campaign_calls@2026-11-18', 'school_event@2026-11-20']);
        // Another school's campaign and holiday never appear.
        expect(JSON.stringify(nov)).not.toMatch(/theirs|2026-11-19|2026-11-02/);
    });

    it('leaves callbacks out (and says so) when Riya is off', async () => {
        const s = await setup();
        await scheduleCallback(s.cbDeps, '2026-10-08T15:00:00+05:30');
        const off = await loadCalendar({ ...s.deps, env: { ...env, SAMPARK_ELEVENLABS_ENABLED: 'false' } }, ORG, '2026-09-30T18:30:00Z', '2026-10-31T18:30:00Z');
        expect(off.sources.callbacks).toBe(false);
        expect(off.events.some((e) => e.type === 'callback' || e.type === 'scheduled_call')).toBe(false);
        expect(off.awaitingApproval).toEqual([]);
    });

    it('refuses an inverted or too-long range, and a school that is not switched on', async () => {
        const s = await setup();
        const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof SamparkServiceError ? e.code : 'other'));
        expect(await code(loadCalendar(s.deps, ORG, '2026-11-01T00:00:00Z', '2026-10-01T00:00:00Z'))).toBe('INVALID_RANGE');
        expect(await code(loadCalendar(s.deps, ORG, '2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z'))).toBe('RANGE_TOO_LONG');
        expect(await code(loadCalendar(s.deps, 'not-enabled', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z'))).toBe('SAMPARK_NOT_ENABLED');
    });
});

describe('GET /api/sampark/[orgId]/calendar', () => {
    const req = (uid?: string) =>
        ({ url: 'http://localhost/api/sampark/hillview-demo/calendar', headers: new Map(uid ? [['x-user-id', uid]] : []) }) as unknown as NextRequest;
    const org = (orgId = ORG) => ({ params: Promise.resolve({ orgId }) });
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; });

    it('404 when Sampark is off; 401 signed out; 403 for a teacher or another school; 400 without a range', async () => {
        process.env.SAMPARK_ENABLED = 'false';
        expect((await calendarGET(req(ADMIN), org())).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'true';
        expect((await calendarGET(req(), org())).status).toBe(401);
        expect((await calendarGET(req('teacher-uid'), org())).status).toBe(403);
        expect((await calendarGET(req(ADMIN), org(OTHER))).status).toBe(403);
        expect((await calendarGET(req(ADMIN), org())).status).toBe(400);
    });
});
