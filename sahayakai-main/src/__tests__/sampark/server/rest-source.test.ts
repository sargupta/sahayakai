/** @jest-environment node */
/**
 * The REST CRM source and its SSRF guard (plan §4①). The guard is the class:
 * any URL whose host resolves to a private, link-local, metadata or (in
 * production) loopback address is refused, whatever the hostname looks like.
 */

import {
    assertCrmUrlSafe,
    checkCrmUrlSyntax,
    createRestSource,
    CrmFetchError,
    CrmUrlError,
    isForbiddenAddress,
    type LookupFn,
} from '@/lib/sampark/crm/rest-source';

const PUBLIC_IP = '93.184.216.34';
const resolveTo = (...addresses: string[]): LookupFn => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

describe('checkCrmUrlSyntax', () => {
    it('accepts https anywhere', () => {
        expect(checkCrmUrlSyntax('https://crm.school.in/api', 'production').hostname).toBe('crm.school.in');
    });

    it('accepts http://localhost and http://127.0.0.1 only outside production', () => {
        expect(() => checkCrmUrlSyntax('http://localhost:4700', 'development')).not.toThrow();
        expect(() => checkCrmUrlSyntax('http://127.0.0.1:4700', 'test')).not.toThrow();
        expect(() => checkCrmUrlSyntax('http://localhost:4700', 'production')).toThrow(CrmUrlError);
    });

    it('refuses http to any other host, other schemes, credentials and junk', () => {
        for (const url of ['http://crm.school.in', 'ftp://crm.school.in', 'file:///etc/passwd', 'gopher://x', 'not a url', 'https://user:pw@crm.school.in']) {
            expect(() => checkCrmUrlSyntax(url, 'development')).toThrow(CrmUrlError);
        }
    });
});

describe('isForbiddenAddress', () => {
    const prod = { allowLoopback: false };
    const dev = { allowLoopback: true };

    it.each([
        '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254', '192.168.1.1',
        '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
        'fd00:ec2::254', 'fc00::1', 'fe80::1', '::', 'ff02::1',
        '::ffff:10.0.0.1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe',
    ])('refuses %s', (ip) => {
        expect(isForbiddenAddress(ip, prod)).toBe(true);
        expect(isForbiddenAddress(ip, dev)).toBe(true);
    });

    it('refuses loopback in production and allows it in development', () => {
        for (const ip of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) {
            expect(isForbiddenAddress(ip, prod)).toBe(true);
            expect(isForbiddenAddress(ip, dev)).toBe(false);
        }
    });

    it('allows public addresses', () => {
        for (const ip of [PUBLIC_IP, '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111']) {
            expect(isForbiddenAddress(ip, prod)).toBe(false);
        }
    });

    it('refuses anything that is not an IP', () => {
        expect(isForbiddenAddress('crm.school.in', prod)).toBe(true);
    });
});

describe('assertCrmUrlSafe', () => {
    it('passes a public host', async () => {
        await expect(assertCrmUrlSafe('https://crm.school.in', { nodeEnv: 'production', lookup: resolveTo(PUBLIC_IP) })).resolves.toBeInstanceOf(URL);
    });

    it('refuses a friendly hostname that resolves to the metadata server or a private range', async () => {
        await expect(assertCrmUrlSafe('https://metadata.google.internal', { nodeEnv: 'production', lookup: resolveTo('169.254.169.254') })).rejects.toThrow(/private or reserved/);
        await expect(assertCrmUrlSafe('https://crm.school.in', { nodeEnv: 'production', lookup: resolveTo(PUBLIC_IP, '10.1.2.3') })).rejects.toThrow(CrmUrlError);
    });

    it('refuses literal private IPs without a lookup', async () => {
        await expect(assertCrmUrlSafe('https://10.0.0.5/v1', { nodeEnv: 'production' })).rejects.toThrow(CrmUrlError);
        await expect(assertCrmUrlSafe('https://[::1]/v1', { nodeEnv: 'production' })).rejects.toThrow(CrmUrlError);
    });

    it('allows the local dummy CRM in development but not in production', async () => {
        await expect(assertCrmUrlSafe('http://localhost:4700', { nodeEnv: 'development', lookup: resolveTo('127.0.0.1', '::1') })).resolves.toBeInstanceOf(URL);
        await expect(assertCrmUrlSafe('https://localhost:4700', { nodeEnv: 'production', lookup: resolveTo('127.0.0.1') })).rejects.toThrow(CrmUrlError);
    });

    it('refuses an unresolvable host', async () => {
        const failing: LookupFn = async () => {
            throw new Error('ENOTFOUND');
        };
        await expect(assertCrmUrlSafe('https://nope.invalid', { nodeEnv: 'production', lookup: failing })).rejects.toThrow(/could not be resolved/);
    });
});

describe('createRestSource', () => {
    function jsonResponse(body: unknown, status = 200): Response {
        return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
    }

    it('sends the bearer key, paginates via nextCursor, and keeps base path and query', async () => {
        const urls: string[] = [];
        const auth: string[] = [];
        const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
            urls.push(url);
            auth.push(String((init?.headers as Record<string, string>).Authorization));
            expect(init?.redirect).toBe('error');
            const u = new URL(url);
            if (u.pathname.endsWith('/v1/school')) return jsonResponse({ id: 'x' });
            const cursor = u.searchParams.get('cursor');
            if (!cursor) return jsonResponse({ data: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c2' });
            return jsonResponse({ data: [{ id: 'c' }], nextCursor: null });
        });
        const source = createRestSource({
            baseUrl: 'https://crm.school.in/api/?includeMalformed=true',
            apiKey: 'k-123',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo(PUBLIC_IP),
            nodeEnv: 'production',
        });
        await expect(source.fetchStudents(null)).resolves.toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
        await expect(source.fetchSchool()).resolves.toEqual({ id: 'x' });
        expect(urls[0]).toMatch(/^https:\/\/crm\.school\.in\/api\/v1\/students\?/);
        expect(new URL(urls[0]).searchParams.get('includeMalformed')).toBe('true');
        expect(new URL(urls[1]).searchParams.get('cursor')).toBe('c2');
        expect(auth.every((a) => a === 'Bearer k-123')).toBe(true);
    });

    it('never fetches a URL that fails the SSRF check', async () => {
        const fetchImpl = jest.fn();
        const source = createRestSource({
            baseUrl: 'https://crm.school.in',
            apiKey: 'k',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo('192.168.0.10'),
            nodeEnv: 'production',
        });
        await expect(source.fetchGuardians(null)).rejects.toThrow(CrmUrlError);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('reports non-2xx, bad envelopes and pagination loops as CrmFetchError', async () => {
        const make = (handler: (url: string) => Response) =>
            createRestSource({ baseUrl: 'https://crm.school.in', apiKey: 'k', fetchImpl: (async (u: string) => handler(u)) as unknown as typeof fetch, lookup: resolveTo(PUBLIC_IP), nodeEnv: 'production' });
        await expect(make(() => jsonResponse({}, 401)).fetchStudents(null)).rejects.toThrow(/CRM responded 401/);
        await expect(make(() => jsonResponse({ items: [] })).fetchStudents(null)).rejects.toThrow(CrmFetchError);
        await expect(make(() => jsonResponse({ data: [], nextCursor: 'same' })).fetchStudents(null)).rejects.toThrow(/pagination loop/);
    });

    it('times out a hung CRM', async () => {
        const fetchImpl = (_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
            });
        const source = createRestSource({
            baseUrl: 'https://crm.school.in',
            apiKey: 'k',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            lookup: resolveTo(PUBLIC_IP),
            nodeEnv: 'production',
            timeoutMs: 20,
        });
        await expect(source.fetchSchool()).rejects.toThrow(/timed out/);
    });
});
