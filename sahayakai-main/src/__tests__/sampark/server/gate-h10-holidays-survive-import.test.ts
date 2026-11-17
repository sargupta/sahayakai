/** @jest-environment node */
/**
 * GATE H10 — a CRM import never removes a holiday the school entered.
 *
 * The bug class: the import replaced `school.holidays` with the CRM's list, so a
 * Durga Puja closure typed into Sampark vanished at the next REST pull and routine
 * calls went out on the holiday. Now the school's own list (`manualHolidays`, from
 * the console) and the CRM's (`crmHolidays`) are stored apart, and `holidays` — the
 * list the calling window reads — is always their sorted union.
 *
 * Beyond the named cases, a seeded sweep runs random sequences of console edits,
 * REST imports (with holidays, without, and with a school record that fails
 * validation) and CSV imports, and after every step checks the invariant:
 *   holidays === sorted union(the last console list, the last CRM list),
 * where a school from before the split counts its original list as its own.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { createCsvSource } from '@/lib/sampark/crm/csv-source';
import { runImport } from '@/lib/sampark/crm/import';
import { CSV_COLUMNS } from '@/lib/sampark/crm/schema';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkCtx } from '@/server/sampark/http';
import { updateSchool } from '@/server/sampark/school';
import type { SamparkSchool } from '@/types/sampark';

import { ADMIN, CRM_SCHOOL, crmGuardian, crmStudent, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const LEGACY = ['2026-01-26', '2026-08-15'];

function legacySchool(): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' },
        displayName: 'Hillview Demo School',
        mode: 'practice',
        isDemo: true,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        // A school from before the split: one list, no manualHolidays / crmHolidays.
        holidays: [...LEGACY],
        venues: [],
        defaultLanguage: null,
        crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt: null, lastImportId: null },
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };
}

/** A REST CRM whose school record lists these holidays (null = no school record; 'invalid' = fails validation). */
function rest(holidays: string[] | null | 'invalid'): CrmSource {
    const record =
        holidays === null ? null : holidays === 'invalid' ? { ...CRM_SCHOOL, timezone: 'UTC' } : { ...CRM_SCHOOL, holidays: holidays.map((date) => ({ date, name: 'Holiday' })) };
    return { kind: 'rest', fetchSchool: async () => record, fetchStudents: async () => [crmStudent('s1')], fetchGuardians: async () => [crmGuardian('g-s1')] };
}

function csv(): CrmSource {
    return createCsvSource({ studentsCsv: CSV_COLUMNS.students.join(','), guardiansCsv: CSV_COLUMNS.guardians.join(',') });
}

async function setup() {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(legacySchool());
    const ctx: SamparkCtx = { repo, clock: testClock() };
    const read = async () => (await repo.getSchool(ORG))!;
    const importFrom = async (source: CrmSource) => {
        const run = await runImport({ repo, clock: ctx.clock }, ORG, source, ADMIN);
        expect(run.status).toBe('succeeded');
    };
    return { repo, ctx, read, importFrom };
}

const union = (...lists: string[][]) => [...new Set(lists.flat())].sort();

describe('gate h10 — holidays survive import', () => {
    it('a REST import merges the CRM list with the school’s own; a school from before the split loses nothing', async () => {
        const env = await setup();
        await env.importFrom(rest(['2026-10-20', '2026-10-19']));
        expect(await env.read()).toMatchObject({
            manualHolidays: LEGACY,
            crmHolidays: ['2026-10-19', '2026-10-20'],
            holidays: union(LEGACY, ['2026-10-19', '2026-10-20']),
        });
    });

    it('the console list stays through every kind of import; the next CRM list replaces only the previous CRM list', async () => {
        const env = await setup();
        await updateSchool(env.ctx, ORG, ADMIN, { holidays: ['2026-10-21', '2026-10-01'] });
        expect(await env.read()).toMatchObject({ manualHolidays: ['2026-10-01', '2026-10-21'], holidays: ['2026-10-01', '2026-10-21'] });

        await env.importFrom(rest(['2026-10-20']));
        expect((await env.read()).holidays).toEqual(['2026-10-01', '2026-10-20', '2026-10-21']);

        await env.importFrom(rest(['2026-11-14'])); // the CRM dropped 20 Oct
        expect((await env.read()).holidays).toEqual(['2026-10-01', '2026-10-21', '2026-11-14']);

        await env.importFrom(csv()); // no school record: nothing changes
        await env.importFrom(rest(null));
        await env.importFrom(rest('invalid'));
        expect(await env.read()).toMatchObject({
            manualHolidays: ['2026-10-01', '2026-10-21'],
            crmHolidays: ['2026-11-14'],
            holidays: ['2026-10-01', '2026-10-21', '2026-11-14'],
        });

        await env.importFrom(rest([])); // the CRM now lists no holidays: only its own days go
        expect((await env.read()).holidays).toEqual(['2026-10-01', '2026-10-21']);
    });

    it('a console edit replaces only the school’s own list; a CRM day stays even if the console list leaves it out', async () => {
        const env = await setup();
        await env.importFrom(rest(['2026-10-20']));
        await updateSchool(env.ctx, ORG, ADMIN, { holidays: ['2026-12-25'] });
        expect(await env.read()).toMatchObject({ manualHolidays: ['2026-12-25'], crmHolidays: ['2026-10-20'], holidays: ['2026-10-20', '2026-12-25'] });
    });

    it('class sweep: any sequence of console edits and imports keeps holidays = union(own, CRM)', async () => {
        let seed = 0x10ad;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        const DAYS = ['2026-10-02', '2026-10-19', '2026-10-20', '2026-10-21', '2026-11-01', '2026-11-14', '2026-12-25'];
        const someDays = () => DAYS.filter(() => rand() < 0.35);

        for (let run = 0; run < 25; run++) {
            const env = await setup();
            let own = [...LEGACY];
            let crm: string[] = [];
            for (let step = 0; step < 12; step++) {
                const r = rand();
                if (r < 0.3) {
                    own = someDays();
                    await updateSchool(env.ctx, ORG, ADMIN, { holidays: own });
                } else if (r < 0.6) {
                    crm = someDays();
                    await env.importFrom(rest(crm));
                } else if (r < 0.7) {
                    await env.importFrom(rest(null));
                } else if (r < 0.8) {
                    await env.importFrom(rest('invalid'));
                } else if (r < 0.9) {
                    await env.importFrom(csv());
                } else {
                    await updateSchool(env.ctx, ORG, ADMIN, { displayName: `Hillview ${step}` }); // an unrelated edit
                }
                const school = await env.read();
                expect(school.holidays).toEqual(union(own, crm));
                for (const day of own) expect(school.holidays).toContain(day);
            }
        }
    });
});
