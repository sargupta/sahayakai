/**
 * REST CrmSource — pulls the CRM wire contract (crm/schema.ts) over HTTPS.
 *
 * SSRF guard (plan §4①). A school admin types the CRM base URL, and the server
 * then fetches it with its own network position — so without a guard, the URL
 * box is a way to make Cloud Run read the metadata server or an internal
 * service. Every URL is checked twice:
 *   1. syntactically (checkCrmUrlSyntax): https only; `http://localhost` /
 *      `http://127.0.0.1` are allowed only outside production (the dummy CRM);
 *      no userinfo in the URL.
 *   2. after DNS resolution (assertCrmUrlSafe): EVERY resolved address must be
 *      public — private (10/8, 172.16/12, 192.168/16), link-local and metadata
 *      (169.254/16, fe80::/10), CGNAT (100.64/10), unique-local (fc00::/7),
 *      unspecified and multicast are refused; loopback (127/8, ::1) is refused
 *      in production.
 * Redirects are refused (`redirect: 'error'`) so an allowed host cannot bounce
 * the request to a forbidden one.
 *
 * Known limit: the address is re-resolved by fetch after the check (DNS
 * rebinding window). Closing it needs a pinned-IP agent; tracked for the
 * phase that talks to real school CRMs.
 *
 * The API key comes from getSecret(school.crm.apiKeySecretName) — env var in
 * dev, Secret Manager in prod — and is never stored in Firestore.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';

import { z } from 'zod';

import { getSecret } from '@/lib/secrets';
import type { CrmSource } from '@/lib/sampark/ports';
import type { SamparkSchool } from '@/types/sampark';

export const CRM_REQUEST_TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 1_000;

export class CrmUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CrmUrlError';
    }
}

export class CrmFetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CrmFetchError';
    }
}

type NodeEnv = string | undefined;

const DEV_HTTP_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Syntactic check. Returns the parsed URL or throws CrmUrlError. Pure. */
export function checkCrmUrlSyntax(raw: string, nodeEnv: NodeEnv = process.env.NODE_ENV): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new CrmUrlError('CRM URL is not a valid URL');
    }
    if (url.username || url.password) throw new CrmUrlError('CRM URL must not contain credentials');
    if (url.protocol === 'https:') return url;
    if (url.protocol === 'http:' && nodeEnv !== 'production' && DEV_HTTP_HOSTS.has(url.hostname)) return url;
    throw new CrmUrlError('CRM URL must use https');
}

function ipv4ToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inCidr4(ip: string, base: string, bits: number): boolean {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/** Expand an IPv6 address to eight 16-bit groups. */
function ipv6Groups(ip: string): number[] | null {
    let addr = ip.toLowerCase().split('%')[0];
    // A trailing embedded IPv4 (e.g. ::ffff:10.0.0.1) becomes two groups.
    let tail: number[] = [];
    const lastColon = addr.lastIndexOf(':');
    const last = addr.slice(lastColon + 1);
    if (last.includes('.')) {
        if (!net.isIPv4(last)) return null;
        const n = ipv4ToInt(last);
        tail = [(n >>> 16) & 0xffff, n & 0xffff];
        addr = addr.slice(0, lastColon + 1);
        if (!addr.endsWith('::')) addr = addr.slice(0, -1);
    }
    const parts = addr.split('::');
    if (parts.length > 2) return null;
    const parse = (s: string) => (s === '' ? [] : s.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)));
    const head = parse(parts[0]);
    const rest = parts.length === 2 ? parse(parts[1]) : [];
    const total = head.length + rest.length + tail.length;
    let groups: number[];
    if (parts.length === 2) {
        if (total > 7) return null;
        groups = [...head, ...Array<number>(8 - total).fill(0), ...rest, ...tail];
    } else {
        if (total !== 8) return null;
        groups = [...head, ...tail];
    }
    return groups.some((g) => Number.isNaN(g)) ? null : groups;
}

/**
 * True if a resolved address must never be fetched. Pure.
 * `allowLoopback` is true only outside production (the dummy CRM on localhost).
 */
export function isForbiddenAddress(ip: string, opts: { allowLoopback: boolean }): boolean {
    if (net.isIPv4(ip)) {
        if (inCidr4(ip, '127.0.0.0', 8)) return !opts.allowLoopback;
        return (
            inCidr4(ip, '0.0.0.0', 8) ||
            inCidr4(ip, '10.0.0.0', 8) ||
            inCidr4(ip, '100.64.0.0', 10) ||
            inCidr4(ip, '169.254.0.0', 16) ||
            inCidr4(ip, '172.16.0.0', 12) ||
            inCidr4(ip, '192.0.0.0', 24) ||
            inCidr4(ip, '192.168.0.0', 16) ||
            inCidr4(ip, '198.18.0.0', 15) ||
            inCidr4(ip, '224.0.0.0', 4) ||
            inCidr4(ip, '240.0.0.0', 4)
        );
    }
    if (net.isIPv6(ip)) {
        const g = ipv6Groups(ip);
        if (!g) return true; // unparseable → refuse
        const isZeroPrefix = g.slice(0, 5).every((x) => x === 0);
        // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — judge the embedded v4.
        if (isZeroPrefix && (g[5] === 0xffff || (g[5] === 0 && (g[6] !== 0 || g[7] > 1)))) {
            const v4 = `${g[6] >>> 8}.${g[6] & 0xff}.${g[7] >>> 8}.${g[7] & 0xff}`;
            return isForbiddenAddress(v4, opts);
        }
        if (g.every((x) => x === 0)) return true;                          // ::
        if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return !opts.allowLoopback; // ::1
        if ((g[0] & 0xfe00) === 0xfc00) return true;                       // fc00::/7 unique-local
        if ((g[0] & 0xffc0) === 0xfe80) return true;                       // fe80::/10 link-local
        if ((g[0] & 0xff00) === 0xff00) return true;                       // ff00::/8 multicast
        if (g[0] === 0x0064 && g[1] === 0xff9b) return true;               // 64:ff9b::/96 NAT64
        return false;
    }
    return true; // not an IP at all → refuse
}

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Full check: syntax + every resolved address. Throws CrmUrlError.
 * Called when a school saves its CRM URL AND before every import.
 */
export async function assertCrmUrlSafe(
    raw: string,
    opts: { nodeEnv?: NodeEnv; lookup?: LookupFn } = {},
): Promise<URL> {
    const nodeEnv = 'nodeEnv' in opts ? opts.nodeEnv : process.env.NODE_ENV;
    const url = checkCrmUrlSyntax(raw, nodeEnv);
    const allowLoopback = nodeEnv !== 'production';
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    if (net.isIP(host)) {
        addresses = [host];
    } else {
        try {
            addresses = (await (opts.lookup ?? defaultLookup)(host)).map((a) => a.address);
        } catch {
            throw new CrmUrlError('CRM host could not be resolved');
        }
    }
    if (addresses.length === 0) throw new CrmUrlError('CRM host could not be resolved');
    if (addresses.some((a) => isForbiddenAddress(a, { allowLoopback }))) {
        throw new CrmUrlError('CRM URL resolves to a private or reserved address');
    }
    return url;
}

// ── Source ──────────────────────────────────────────────────────────────────

const PageEnvelope = z.object({ data: z.array(z.unknown()), nextCursor: z.string().nullable() });

export interface RestSourceOptions {
    baseUrl: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
    lookup?: LookupFn;
    nodeEnv?: NodeEnv;
    timeoutMs?: number;
}

/**
 * Build an endpoint URL under the base, keeping any base path prefix and base
 * query parameters (e.g. `http://localhost:4700/?includeMalformed=true` makes
 * every request carry the dummy CRM's quarantine switch).
 */
function endpoint(base: URL, path: string, params: Record<string, string | null>): URL {
    const u = new URL(base.toString());
    u.pathname = `${u.pathname.replace(/\/+$/, '')}${path}`;
    for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
    return u;
}

export function createRestSource(opts: RestSourceOptions): CrmSource {
    const doFetch = opts.fetchImpl ?? fetch;
    const timeoutMs = opts.timeoutMs ?? CRM_REQUEST_TIMEOUT_MS;
    let checked: Promise<URL> | null = null;
    const base = () => {
        if (!checked) checked = assertCrmUrlSafe(opts.baseUrl, { nodeEnv: opts.nodeEnv ?? process.env.NODE_ENV, lookup: opts.lookup });
        return checked;
    };

    async function getJson(url: URL): Promise<unknown> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res: Response;
        try {
            res = await doFetch(url.toString(), {
                method: 'GET',
                headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: 'application/json' },
                redirect: 'error',
                signal: controller.signal,
                cache: 'no-store',
            });
        } catch (err) {
            const aborted = (err as { name?: string })?.name === 'AbortError';
            throw new CrmFetchError(aborted ? `CRM request timed out after ${timeoutMs / 1000}s` : 'CRM request failed');
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) throw new CrmFetchError(`CRM responded ${res.status} for ${url.pathname}`);
        try {
            return await res.json();
        } catch {
            throw new CrmFetchError(`CRM returned invalid JSON for ${url.pathname}`);
        }
    }

    async function paginate(path: string, updatedSince: string | null): Promise<unknown[]> {
        const b = await base();
        const out: unknown[] = [];
        const seen = new Set<string>();
        let cursor: string | null = null;
        for (let page = 0; page < MAX_PAGES; page++) {
            const body = await getJson(endpoint(b, path, { updatedSince, cursor, limit: String(PAGE_LIMIT) }));
            const parsed = PageEnvelope.safeParse(body);
            if (!parsed.success) throw new CrmFetchError(`CRM page for ${path} is not { data, nextCursor }`);
            out.push(...parsed.data.data);
            cursor = parsed.data.nextCursor;
            if (!cursor) return out;
            if (seen.has(cursor)) throw new CrmFetchError(`CRM pagination loop on ${path}`);
            seen.add(cursor);
        }
        throw new CrmFetchError(`CRM pagination exceeded ${MAX_PAGES} pages on ${path}`);
    }

    return {
        kind: 'rest',
        fetchSchool: async () => getJson(endpoint(await base(), '/v1/school', {})),
        fetchStudents: (updatedSince) => paginate('/v1/students', updatedSince),
        fetchGuardians: (updatedSince) => paginate('/v1/guardians', updatedSince),
        // Only the paths under /v1/ the slice-2 signals adapter names; the base URL stays SSRF-checked.
        fetchRecords: (path) => {
            if (!/^\/v1\/[a-z0-9/_-]+$/.test(path)) throw new CrmFetchError(`Refusing to fetch an unexpected CRM path: ${path}`);
            return paginate(path, null);
        },
    };
}

/** Build the REST source for a school from its saved CRM config. */
export async function createRestSourceForSchool(
    school: SamparkSchool,
    overrides: Partial<Omit<RestSourceOptions, 'baseUrl' | 'apiKey'>> = {},
): Promise<CrmSource> {
    const crm = school.crm;
    if (!crm || crm.kind !== 'rest' || !crm.baseUrl) throw new CrmUrlError('No REST CRM is configured for this school');
    if (!crm.apiKeySecretName) throw new CrmUrlError('No CRM API key secret is configured for this school');
    const apiKey = await getSecret(crm.apiKeySecretName);
    return createRestSource({ baseUrl: crm.baseUrl, apiKey, ...overrides });
}
