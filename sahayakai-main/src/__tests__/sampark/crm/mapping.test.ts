/** @jest-environment node */
/**
 * The saved field mapping (R2-4a): a real tool's endpoint paths, pagination parameters and field names land on
 * the canonical contract with NO code change; and the mapping cannot be used to invent safety facts.
 */

import { CrmGuardianSchema, CrmStudentSchema } from '@/lib/sampark/crm/schema';
import { CrmMappingSchema, identityMapping, isValidMappingPath, mapRecord, parseMapping } from '@/lib/sampark/crm/mapping';
import { createRestSource, type LookupFn } from '@/lib/sampark/crm/rest-source';

import { crmGuardian, crmStudent } from '../server/_helpers';

const PUBLIC_IP = '93.184.216.34';
const resolveTo = (...addresses: string[]): LookupFn => async () => addresses.map((address) => ({ address, family: 4 }));

describe('CrmMappingSchema', () => {
    it('an empty object is the identity mapping with the canonical defaults', () => {
        const m = parseMapping({});
        expect(m.pagination).toMatchObject({ style: 'cursor', limitParam: 'limit', cursorParam: 'cursor', updatedSinceParam: 'updatedSince', pageSize: 200, dataPath: 'data', nextCursorPath: 'nextCursor' });
        expect(identityMapping()).toEqual(m);
        expect(parseMapping(null)).toEqual(m);
    });

    it('is idempotent: parsing its own output gives the same object (stored config is re-validated on use)', () => {
        const once = parseMapping({ fields: { guardians: { phone: 'mobile_no' } }, pagination: { style: 'page', pageStart: 0 } });
        expect(parseMapping(once)).toEqual(once);
    });

    it.each([
        ['__proto__', false],
        ['a.constructor', false],
        ['a.prototype.b', false],
        ['a..b', false],
        ['', false],
        ['a b', false],
        ['a[].b[]', false],
        ['[]', false],
        ['guardians[].guardianId', true],
        ['sensitiveFlags[]', true],
        ['consent.notices.status', true],
        ['mobile_no', true],
    ])('path %j valid=%s', (path, ok) => {
        expect(isValidMappingPath(path)).toBe(ok);
    });

    it('refuses unknown keys, bad endpoint paths and bad tool names', () => {
        expect(CrmMappingSchema.safeParse({ extra: 1 }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ rest: { endpoints: { students: 'http://evil/x' } } }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ rest: { endpoints: { students: '/a/../b' } } }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ rest: { endpoints: { students: '/api/students' } } }).success).toBe(true);
        expect(CrmMappingSchema.safeParse({ mcp: { tools: { students: 'list students; drop' } } }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ pagination: { pageSize: 5000 } }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ fields: { students: JSON.parse('{"__proto__":"x"}') } }).success).toBe(false);
    });

    it('CLASS: a mapping can never default a safety fact (consent, do-not-contact, synthetic, tombstone)', () => {
        for (const [entity, target] of [
            ['guardians', 'consent.notices.status'],
            ['guardians', 'consent'],
            ['guardians', 'doNotContact'],
            ['guardians', 'synthetic'],
            ['guardians', 'deleted'],
            ['students', 'deleted'],
        ] as const) {
            const r = CrmMappingSchema.safeParse({ defaults: { [entity]: { [target]: 'granted' } } });
            expect({ entity, target, ok: r.success }).toEqual({ entity, target, ok: false });
        }
        expect(CrmMappingSchema.safeParse({ defaults: { students: { boarding: false } } }).success).toBe(true);
    });

    it('a list mapping needs [] on both sides', () => {
        expect(CrmMappingSchema.safeParse({ fields: { students: { 'guardians[].guardianId': 'pid' } } }).success).toBe(false);
        expect(CrmMappingSchema.safeParse({ fields: { students: { 'guardians[].guardianId': 'parents[].pid' } } }).success).toBe(true);
    });
});

describe('mapRecord', () => {
    const mapping = parseMapping({
        fields: {
            guardians: {
                id: 'parent_id',
                fullName: 'name',
                phone: 'contact.mobile',
                'consent.notices.status': 'perm.sms',
                'consent.notices.recordedAt': 'perm.at',
                'consent.notices.method': 'perm.how',
                'consent.notices.noticeVersion': 'perm.ver',
            },
            students: {
                'guardians[].guardianId': 'parents[].pid',
                'guardians[].isPrimary': 'parents[].main',
                'guardians[].isGuardianOfRecord': 'parents[].legal',
                'sensitiveFlags[]': 'flags[]',
            },
        },
        valueMaps: {
            guardians: { relation: { Mother: 'mother', Father: 'father' }, 'consent.notices.status': { Y: 'granted', N: 'denied' } },
            students: { 'sensitiveFlags[]': { Counselling: 'counsellor_referral' }, 'guardians[].isPrimary': { yes: true, no: false } },
        },
        defaults: { students: { boarding: false } },
    });

    const tool = {
        parent_id: 'p1',
        name: 'Asha Rai',
        relation: 'Mother',
        contact: { mobile: '+915000000001' },
        perm: { sms: 'Y', at: '2026-06-01T10:00:00+05:30', how: 'office', ver: 'v1' },
        preferredLanguage: 'ne',
        doNotContact: false,
        synthetic: true,
        updatedAt: '2026-09-01T10:00:00+05:30',
    };

    it('maps flat, nested and translated fields onto a record the canonical schema accepts', () => {
        const mapped = mapRecord('guardians', tool, mapping) as Record<string, unknown>;
        expect(mapped).toMatchObject({ id: 'p1', fullName: 'Asha Rai', phone: '+915000000001', relation: 'mother' });
        expect(mapped.consent).toEqual({ notices: { status: 'granted', recordedAt: '2026-06-01T10:00:00+05:30', method: 'office', noticeVersion: 'v1' } });
        // consent for the other groups is absent in the tool: the schema rejects the record rather than guess.
        expect(CrmGuardianSchema.safeParse(mapped).success).toBe(false);
    });

    it('a mapped source field that is absent REMOVES the target (no stale same-named field survives)', () => {
        const mapped = mapRecord('guardians', { ...tool, contact: undefined, phone: '+910000000000' }, mapping) as Record<string, unknown>;
        expect(mapped.phone).toBeUndefined();
    });

    it('maps lists element by element, including scalar lists and value maps inside them', () => {
        const raw = {
            id: 's1',
            admissionNo: 'A1',
            apaarId: null,
            fullName: 'Ravi',
            spokenFirstName: {},
            grade: 4,
            section: 'A',
            rollNo: 1,
            gender: 'male',
            feeCategory: 'regular',
            transportRoute: null,
            status: 'active',
            updatedAt: '2026-09-01T10:00:00+05:30',
            parents: [
                { pid: 'p1', main: 'yes', legal: true },
                { pid: 'p2', main: 'no', legal: false },
            ],
            flags: ['Counselling'],
        };
        const mapped = mapRecord('students', raw, mapping) as Record<string, unknown>;
        expect(mapped.guardians).toEqual([
            { guardianId: 'p1', isPrimary: true, isGuardianOfRecord: true },
            { guardianId: 'p2', isPrimary: false, isGuardianOfRecord: false },
        ]);
        expect(mapped.sensitiveFlags).toEqual(['counsellor_referral']);
        expect(mapped.boarding).toBe(false); // default applied: the tool has no such field
        expect(CrmStudentSchema.safeParse(mapped).success).toBe(true);
    });

    it('does not mutate the raw record, and a record with no mapping passes through untouched', () => {
        const before = JSON.stringify(tool);
        mapRecord('guardians', tool, mapping);
        expect(JSON.stringify(tool)).toBe(before);
        const plain = crmGuardian('g1');
        expect(mapRecord('guardians', plain, identityMapping())).toBe(plain);
    });

    it('a value with no entry in the table is left as is, so the schema reports it', () => {
        const mapped = mapRecord('guardians', { ...tool, relation: 'Uncle' }, mapping) as Record<string, unknown>;
        expect(mapped.relation).toBe('Uncle');
    });

    it('lookups use own properties only (no prototype pollution through a hostile record or table)', () => {
        const evil = JSON.parse('{"__proto__":{"polluted":true},"parent_id":"p","perm":{"sms":"constructor"}}');
        mapRecord('guardians', evil, mapping);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        const mapped = mapRecord('guardians', { ...tool, relation: 'toString' }, mapping) as Record<string, unknown>;
        expect(mapped.relation).toBe('toString');
    });

    it('non-object records pass through for the schema to reject', () => {
        expect(mapRecord('guardians', 'oops', mapping)).toBe('oops');
        expect(mapRecord('guardians', null, mapping)).toBeNull();
    });
});

describe('REST source under a saved mapping', () => {
    function resp(body: unknown): Response {
        return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }

    it('custom endpoint, page-number pagination, nested list and renamed parameters', async () => {
        const urls: string[] = [];
        const pages: Record<string, unknown> = {
            '0': { result: { rows: [crmStudent('s1'), crmStudent('s2')] } },
            '1': { result: { rows: [crmStudent('s3')] } },
        };
        const fetchImpl = jest.fn(async (url: string) => {
            urls.push(url);
            const u = new URL(url);
            return resp(pages[u.searchParams.get('pg') ?? 'x'] ?? { result: { rows: [] } });
        });
        const source = createRestSource({
            baseUrl: 'https://tool.school.in',
            apiKey: 'k',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo(PUBLIC_IP),
            nodeEnv: 'production',
            mapping: parseMapping({
                rest: { endpoints: { students: '/api/v2/pupils' } },
                pagination: { style: 'page', pageStart: 0, pageSize: 2, limitParam: 'per_page', cursorParam: 'pg', updatedSinceParam: 'since', dataPath: 'result.rows' },
            }),
        });
        const rows = await source.fetchStudents('2026-09-01T00:00:00Z');
        expect(rows.map((r) => (r as { id: string }).id)).toEqual(['s1', 's2', 's3']);
        const first = new URL(urls[0] as string);
        expect(first.pathname).toBe('/api/v2/pupils');
        expect(first.searchParams.get('per_page')).toBe('2');
        expect(first.searchParams.get('pg')).toBe('0');
        expect(first.searchParams.get('since')).toBe('2026-09-01T00:00:00Z');
        expect(urls).toHaveLength(2); // page 1 was short, so the crawl stopped
    });

    it('the SSRF guard and the bearer secret are unchanged under a mapping', async () => {
        const fetchImpl = jest.fn();
        const source = createRestSource({
            baseUrl: 'https://tool.school.in',
            apiKey: 'k',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo('169.254.169.254'),
            nodeEnv: 'production',
            mapping: parseMapping({ rest: { endpoints: { students: '/s' } } }),
        });
        await expect(source.fetchStudents(null)).rejects.toThrow(/private or reserved/);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('a bare top-level array response ($) and a missing next-cursor path end after one page', async () => {
        const fetchImpl = jest.fn(async () => resp([crmGuardian('g1')]));
        const source = createRestSource({
            baseUrl: 'https://tool.school.in',
            apiKey: 'k',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo(PUBLIC_IP),
            nodeEnv: 'production',
            mapping: parseMapping({ pagination: { dataPath: '$', nextCursorPath: null } }),
        });
        await expect(source.fetchGuardians(null)).resolves.toHaveLength(1);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('a consent endpoint in the mapping gives the source fetchConsent; without one it has none', async () => {
        const base = { baseUrl: 'https://tool.school.in', apiKey: 'k', lookup: resolveTo(PUBLIC_IP), nodeEnv: 'production' as const };
        expect(createRestSource({ ...base }).fetchConsent).toBeUndefined();
        const fetchImpl = jest.fn(async () => resp({ data: [{ guardian: 'g1' }], nextCursor: null }));
        const source = createRestSource({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch, mapping: parseMapping({ rest: { endpoints: { consent: '/api/consents' } } }) });
        await expect(source.fetchConsent!()).resolves.toEqual([{ guardian: 'g1' }]);
        expect(new URL(fetchImpl.mock.calls[0]![0] as string).pathname).toBe('/api/consents');
    });
});
