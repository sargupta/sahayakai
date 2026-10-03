/** @jest-environment node */
/**
 * Saving a school's connector (rest | mcp | csv + mapping) and carrier settings through the school service, and
 * choosing the adapter by school.crm.kind when importing (R2-4a/e, R2-6).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { CrmSource } from '@/lib/sampark/ports';
import { startImport, StartImportSchema } from '@/server/sampark/imports';
import { enableSchool, UpdateSchoolSchema, updateSchool } from '@/server/sampark/school';
import { hasConnectedCrm } from '@/server/sampark/crm-source';

import { ADMIN, crmGuardian, crmStudent, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const SPOKEN = { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' };
const MAPPING = { mcp: { tools: { students: 'list_students', guardians: 'list_guardians' } }, fields: { guardians: { phone: 'mobile_no' } } };

async function setup() {
    const repo = createMemorySamparkRepo();
    const ctx = { repo, clock: testClock() };
    await enableSchool(ctx, ORG, ADMIN, { displayName: 'Hillview', isDemo: true, spokenName: SPOKEN });
    return ctx;
}
const parse = (input: unknown) => UpdateSchoolSchema.parse(input);

describe('crm connector settings', () => {
    it('saves an MCP connection with its tool names and mapping (parsed and defaulted by the schema)', async () => {
        const ctx = await setup();
        const school = await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        expect(school.crm).toMatchObject({ kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY' });
        expect(school.crm!.mapping!.mcp.tools).toEqual({ students: 'list_students', guardians: 'list_guardians' });
        expect(school.crm!.mapping!.pagination.limitParam).toBe('limit'); // defaults filled in
        expect(hasConnectedCrm(school)).toBe(true);
    });

    it('refuses an MCP connection without students and guardians tools, an unsafe URL, and an arbitrary secret name', async () => {
        const ctx = await setup();
        const base = { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING };
        expect(UpdateSchoolSchema.safeParse({ crm: { ...base, mapping: { mcp: { tools: { students: 'x' } } } } }).success).toBe(false);
        expect(UpdateSchoolSchema.safeParse({ crm: { ...base, mapping: undefined } }).success).toBe(false);
        expect(UpdateSchoolSchema.safeParse({ crm: { ...base, apiKeySecretName: 'FIREBASE_SERVICE_ACCOUNT' } }).success).toBe(false);
        await expect(updateSchool(ctx, ORG, ADMIN, parse({ crm: { ...base, baseUrl: 'https://169.254.169.254/mcp' } }))).rejects.toMatchObject({ code: 'CRM_URL_REJECTED' });
        await expect(updateSchool(ctx, ORG, ADMIN, parse({ crm: { ...base, baseUrl: 'http://crm.school.in/mcp' } }))).rejects.toMatchObject({ code: 'CRM_URL_REJECTED' });
    });

    it('refuses a mapping that tries to default consent', () => {
        const bad = { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: { defaults: { guardians: { 'consent.notices.status': 'granted' } } } };
        expect(UpdateSchoolSchema.safeParse({ crm: bad }).success).toBe(false);
    });

    it('REST: an omitted mapping keeps the saved one; null clears it; switching kind drops it', async () => {
        const ctx = await setup();
        const rest = { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY' };
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { ...rest, mapping: { rest: { endpoints: { students: '/api/pupils' } } } } }));
        let school = await updateSchool(ctx, ORG, ADMIN, parse({ crm: rest }));
        expect(school.crm!.mapping!.rest.endpoints.students).toBe('/api/pupils');
        school = await updateSchool(ctx, ORG, ADMIN, parse({ crm: { ...rest, mapping: null } }));
        expect(school.crm!.mapping).toBeNull();
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { ...rest, mapping: { rest: { endpoints: { students: '/api/pupils' } } } } }));
        school = await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        expect(school.crm!.mapping!.rest.endpoints).toEqual({});
    });

    it('keeps lastImportAt across a connector change', async () => {
        const ctx = await setup();
        const s = (await ctx.repo.getSchool(ORG))!;
        await ctx.repo.upsertSchool({ ...s, crm: { kind: 'rest', baseUrl: 'http://localhost:1', apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt: '2026-10-01T00:00:00.000Z', lastImportId: 'i1' } });
        const school = await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        expect(school.crm).toMatchObject({ lastImportAt: '2026-10-01T00:00:00.000Z', lastImportId: 'i1' });
    });
});

describe('carrier settings', () => {
    it('saves a validated E.164 caller id, the registration flag and the provider; null clears', async () => {
        const ctx = await setup();
        const school = await updateSchool(ctx, ORG, ADMIN, parse({ carrier: { callerId: ' +913530000000 ', registeredToSchool: true, provider: 'knowlarity' } }));
        expect(school.carrier).toEqual({ callerId: '+913530000000', registeredToSchool: true, provider: 'knowlarity' });
        expect((await ctx.repo.getSchool(ORG))!.carrier).toEqual(school.carrier);
        expect((await updateSchool(ctx, ORG, ADMIN, parse({ carrier: null }))).carrier).toBeNull();
        expect((await updateSchool(ctx, ORG, ADMIN, parse({ carrier: { callerId: '', registeredToSchool: false, provider: 'simulated' } }))).carrier).toEqual({ callerId: null, registeredToSchool: false, provider: 'simulated' });
    });

    it.each(['9876543210', '+91 98765 43210', '+91', 'abc', '+919876543210123456'])('rejects the caller id %j', (callerId) => {
        expect(UpdateSchoolSchema.safeParse({ carrier: { callerId, registeredToSchool: true, provider: 'vobiz' } }).success).toBe(false);
    });

    it('rejects an unknown provider and extra keys; saving never changes the mode (still practice)', async () => {
        expect(UpdateSchoolSchema.safeParse({ carrier: { callerId: null, registeredToSchool: false, provider: 'twilio' } }).success).toBe(false);
        expect(UpdateSchoolSchema.safeParse({ carrier: { callerId: null, registeredToSchool: false, provider: 'vobiz', mode: 'live' } }).success).toBe(false);
        const ctx = await setup();
        const school = await updateSchool(ctx, ORG, ADMIN, parse({ carrier: { callerId: '+918000012345', registeredToSchool: true, provider: 'vobiz' } }));
        expect(school.mode).toBe('practice');
    });

});

describe('startImport: adapter chosen by school.crm.kind', () => {
    const okSource = (kind: CrmSource['kind']): CrmSource => ({
        kind,
        fetchSchool: async () => null,
        fetchStudents: async () => [crmStudent('s1', { guardians: [{ guardianId: 'g1', isPrimary: true, isGuardianOfRecord: true }] })],
        fetchGuardians: async () => [crmGuardian('g1')],
    });

    it('rest → the REST adapter, mcp → the MCP adapter; the run records the source kind', async () => {
        const ctx = await setup();
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY' } }));
        const used: string[] = [];
        const deps = {
            restSourceFor: async () => { used.push('rest'); return okSource('rest'); },
            mcpSourceFor: async () => { used.push('mcp'); return okSource('mcp'); },
        };
        expect(await startImport(ctx, ORG, ADMIN, { source: 'rest' }, deps)).toMatchObject({ status: 'succeeded', source: 'rest' });
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        expect(await startImport(ctx, ORG, ADMIN, { source: 'mcp' }, deps)).toMatchObject({ status: 'succeeded', source: 'mcp' });
        expect(used).toEqual(['rest', 'mcp']);
    });

    it('asking for a source that is not what the school saved is a client error, and no adapter is built', async () => {
        const ctx = await setup();
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        const build = jest.fn();
        await expect(startImport(ctx, ORG, ADMIN, { source: 'rest' }, { restSourceFor: build, mcpSourceFor: build })).rejects.toMatchObject({ code: 'CRM_NOT_CONFIGURED' });
        expect(build).not.toHaveBeenCalled();
        const bare = await setup();
        await expect(startImport(bare, ORG, ADMIN, { source: 'mcp' })).rejects.toMatchObject({ code: 'CRM_NOT_CONFIGURED' });
    });

    it('a CSV upload works for any school and may carry a consent file; an empty consent file is not an error', async () => {
        expect(StartImportSchema.safeParse({ source: 'csv', studentsCsv: 'a', guardiansCsv: 'b', consentCsv: 'c' }).success).toBe(true);
        expect(StartImportSchema.safeParse({ source: 'csv', studentsCsv: 'a', guardiansCsv: 'b', consentCsv: '' }).success).toBe(false);
        expect(StartImportSchema.safeParse({ source: 'mcp', extra: 1 }).success).toBe(false);
    });

    it('a failure building the adapter shows only a safe message', async () => {
        const ctx = await setup();
        await updateSchool(ctx, ORG, ADMIN, parse({ crm: { kind: 'mcp', baseUrl: 'http://localhost:4700/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', mapping: MAPPING } }));
        await expect(startImport(ctx, ORG, ADMIN, { source: 'mcp' }, { mcpSourceFor: async () => { throw new Error('Secret Manager said: sk-leak'); } })).rejects.toMatchObject({ code: 'CRM_KEY_UNAVAILABLE', message: 'The CRM API key could not be read' });
    });
});
