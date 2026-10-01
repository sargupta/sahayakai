/**
 * Shared builders for the Sampark engine tests. Not a test file (no `.test.`),
 * so jest only loads it when a test imports it.
 *
 * Instants used throughout (IST = the only clock that matters):
 *   WED_11_IST  2026-10-07 11:00 IST (Wednesday) = 2026-10-07T05:30:00Z
 *   2026-10-08 is a Thursday, 10-10 a Saturday, 10-11 a Sunday, 10-12 a Monday.
 */

import { emptyCounts } from '@/lib/sampark/dispatch/counts';
import type { DispatchDeps, DispatchOptions } from '@/lib/sampark/dispatch/dispatcher';
import type { Carrier, Clock, PlaceCallRequest, PlaceCallResult, SamparkRepo } from '@/lib/sampark/ports';
import type {
    CallEvent,
    Campaign,
    CampaignFacts,
    ConsentGroup,
    ConsentStatus,
    GuardianPreferences,
    ParentLanguage,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
} from '@/types/sampark';

export const ORG = 'hillview-demo';
export const WED_11_IST = new Date('2026-10-07T05:30:00Z');
export const FAR_FUTURE = '2027-12-31T18:29:59.999Z';

export function school(overrides: Partial<SamparkSchool> = {}): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview Demo School', Hindi: 'हिलव्यू डेमो स्कूल', Bengali: 'হিলভিউ ডেমো স্কুল', Nepali: 'हिलभ्यू डेमो स्कूल' },
        displayName: 'Hillview Demo School',
        mode: 'practice',
        isDemo: false,
        callingWindow: { startHour: 10, endHour: 20, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

export function student(id: string, overrides: Partial<SamparkStudent> = {}): SamparkStudent {
    return {
        orgId: ORG,
        id,
        grade: 7,
        section: 'B',
        spokenFirstName: { English: id },
        displayName: `Student ${id}`,
        feeCategory: 'regular',
        sensitiveFlags: [],
        boarding: false,
        transportRoute: null,
        guardianIds: [],
        active: true,
        crmUpdatedAt: '2026-09-01T00:00:00.000Z',
        importedAt: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

export function guardian(id: string, overrides: Partial<SamparkGuardian> = {}): SamparkGuardian {
    return {
        orgId: ORG,
        id,
        displayName: `Guardian ${id}`,
        relation: 'mother',
        phoneEnc: `enc:${id}`,
        phoneHash: `hash:${id}`,
        phoneLast4: '0000',
        phoneClass: 'synthetic',
        studentIds: [],
        crmLanguage: 'Nepali',
        crmDoNotContact: false,
        active: true,
        crmUpdatedAt: '2026-09-01T00:00:00.000Z',
        importedAt: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

const CONSENT_GROUPS: ConsentGroup[] = ['notices', 'progress', 'recorded_conversation', 'hpc_input'];

export function prefs(
    guardianId: string,
    consent: Partial<Record<ConsentGroup, ConsentStatus>> = { notices: 'granted' },
    language: ParentLanguage | null = null,
): GuardianPreferences {
    const record = Object.fromEntries(
        CONSENT_GROUPS.map((g) => [
            g,
            { status: consent[g] ?? 'unknown', noticeVersion: 'v1', language: null, recordedAt: '2026-09-01T00:00:00.000Z', source: 'office' },
        ]),
    ) as GuardianPreferences['consent'];
    return { orgId: ORG, guardianId, language, consent: record, updatedAt: '2026-09-01T00:00:00.000Z', updatedBy: 'import' };
}

export const PTM_FACTS: CampaignFacts = { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'hall' };

export function campaign(overrides: Partial<Campaign> = {}): Campaign {
    return {
        id: 'camp-ptm',
        orgId: ORG,
        purpose: 'ptm_invite',
        facts: PTM_FACTS,
        audience: { sections: [] },
        status: 'scheduled',
        notBefore: null,
        expiresAt: FAR_FUTURE,
        createdBy: 'dev-user-123',
        createdAt: '2026-10-01T00:00:00.000Z',
        approvedBy: 'dev-user-123',
        approvedAt: '2026-10-01T00:00:00.000Z',
        renderProgress: { done: 0, total: 0, failures: [] },
        counts: emptyCounts(),
        updatedAt: '2026-10-01T00:00:00.000Z',
        ...overrides,
    };
}

export interface TestClock extends Clock {
    set(at: Date | string): void;
    advance(ms: number): void;
}

export function testClock(start: Date | string = WED_11_IST): TestClock {
    let t = new Date(start).getTime();
    return {
        now: () => new Date(t),
        set: (at) => {
            t = new Date(at).getTime();
        },
        advance: (ms) => {
            t += ms;
        },
    };
}

/**
 * Seed `n` single-child families (student sN ↔ guardian gN), all with notices consent.
 * Returns the guardian ids.
 */
export async function seedFamilies(repo: SamparkRepo, n: number, opts: { school?: Partial<SamparkSchool>; guardian?: Partial<SamparkGuardian> } = {}): Promise<string[]> {
    await repo.upsertSchool(school(opts.school));
    const students: SamparkStudent[] = [];
    const guardians: SamparkGuardian[] = [];
    for (let i = 1; i <= n; i++) {
        const sid = `s${String(i).padStart(3, '0')}`;
        const gid = `g${String(i).padStart(3, '0')}`;
        students.push(student(sid, { guardianIds: [gid] }));
        guardians.push(guardian(gid, { studentIds: [sid], ...opts.guardian }));
    }
    await repo.upsertStudents(ORG, students);
    await repo.upsertGuardians(ORG, guardians);
    await repo.upsertPreferences(guardians.map((g) => prefs(g.id)));
    return guardians.map((g) => g.id);
}

// ── Carriers ────────────────────────────────────────────────────────────────

export type ScriptedFate = 'no_answer' | 'busy' | 'full' | 'partial' | 'early' | 'key1' | 'key2' | 'key99' | 'key9' | 'fail' | 'fail_final' | 'throw';

/** A carrier whose outcome per call is chosen by the test. Records every place() request. */
export function scriptedCarrier(
    fate: (req: PlaceCallRequest) => ScriptedFate,
    kind: Carrier['kind'] = 'simulated',
): Carrier & { requests: PlaceCallRequest[]; placesFor(intentId: string): number } {
    const requests: PlaceCallRequest[] = [];
    return {
        kind,
        requests,
        placesFor: (intentId) => requests.filter((r) => r.call.intentId === intentId).length,
        async place(req: PlaceCallRequest): Promise<PlaceCallResult> {
            requests.push(req);
            const f = fate(req);
            const t0 = Date.parse(req.call.createdAt);
            const at = (s: number) => new Date(t0 + s * 1000).toISOString();
            const audio = req.audioSeconds;
            const providerCallId = `prov-${req.call.id.slice(0, 8)}`;
            if (f === 'throw') throw new Error('carrier connection reset');
            if (f === 'fail') return { ok: false, reason: 'carrier_down', retryable: true };
            if (f === 'fail_final') return { ok: false, reason: 'number_rejected', retryable: false };
            const events: CallEvent[] = [{ type: 'placed', at: at(0.5), providerCallId }];
            if (f === 'busy') {
                events.push({ type: 'hangup', at: at(3), cause: 'busy', durationSeconds: 0, billedSeconds: 0 });
                return { ok: true, providerCallId, events };
            }
            events.push({ type: 'ringing', at: at(1) });
            if (f === 'no_answer') {
                events.push({ type: 'hangup', at: at(40), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
                return { ok: true, providerCallId, events };
            }
            events.push({ type: 'answered', at: at(5) });
            const digits: Record<string, string[]> = { key1: ['1'], key2: ['2'], key99: ['9', '9'], key9: ['9'] };
            let duration: number;
            if (digits[f]) {
                digits[f].forEach((d, i) => events.push({ type: 'digit', at: at(5 + audio + i * 3), digit: d }));
                duration = audio + 8;
            } else if (f === 'full') duration = audio + 3;
            else if (f === 'partial') duration = Math.floor(audio * 0.5);
            else duration = 2; // early
            events.push({ type: 'hangup', at: at(5 + duration), cause: 'completed', durationSeconds: duration, billedSeconds: Math.max(1, Math.ceil(duration / 60)) * 60 });
            return { ok: true, providerCallId, events };
        },
    };
}

export const DEFAULT_OPTS: DispatchOptions = { maxDialsPerSchoolPerTick: 50, maxInFlightPerSchool: 20, leaseMs: 120_000 };

export function deps(repo: SamparkRepo, clock: Clock, carrier: Carrier, overrides: Partial<DispatchDeps> = {}): DispatchDeps {
    return {
        repo,
        clock,
        holder: 'test-holder',
        carrierFor: () => carrier,
        destinationFor: async (_school, g) => `+915${g.id.replace(/\D/g, '').padStart(9, '0')}`,
        audioSecondsFor: async () => 40,
        ...overrides,
    };
}
