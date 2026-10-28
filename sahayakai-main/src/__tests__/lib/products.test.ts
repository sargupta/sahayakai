/**
 * Two products, one codebase (src/lib/products.ts).
 *
 * Class gate: every top-level page route in src/app must be listed in
 * SAHAYAK_ROUTE_SEGMENTS (or be SamparkAI's own `sampark` segment). On a
 * SamparkAI host an unlisted SahayakAI route would be rewritten into the
 * /sampark tree and read as an orgId, so a new teacher page would silently
 * render as a broken school workspace on sampark.sahayakai.com.
 */
import fs from 'fs';
import path from 'path';
import {
    SAHAYAK_ROUTE_SEGMENTS,
    SAMPARK_RESERVED_SEGMENTS,
    isExternalUrl,
    isSahayakRoute,
    isSamparkHost,
    sahayakOriginFor,
    samparkHosts,
    samparkUrl,
} from '@/lib/products';

const APP_DIR = path.join(__dirname, '..', '..', 'app');

/** Top-level URL segments the app serves: folders, with route groups flattened one level. */
function topLevelSegments(): string[] {
    const segments: string[] = [];
    for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
            for (const inner of fs.readdirSync(path.join(APP_DIR, entry.name), { withFileTypes: true })) {
                if (inner.isDirectory()) segments.push(inner.name);
            }
            continue;
        }
        segments.push(entry.name);
    }
    return segments.filter((s) => s !== 'api' && s !== 'sampark' && !s.startsWith('_') && !s.startsWith('['));
}

describe('SAHAYAK_ROUTE_SEGMENTS (class gate)', () => {
    it('lists every top-level SahayakAI route in src/app', () => {
        const missing = topLevelSegments().filter((s) => !(SAHAYAK_ROUTE_SEGMENTS as readonly string[]).includes(s));
        expect(missing).toEqual([]);
    });

    it('never claims a SamparkAI segment', () => {
        for (const reserved of SAMPARK_RESERVED_SEGMENTS) {
            expect(isSahayakRoute(`/${reserved}`)).toBe(false);
        }
        expect(isSahayakRoute('/')).toBe(false);
        expect(isSahayakRoute('/hillview-demo/calls')).toBe(false);
    });

    it('matches on the first segment only', () => {
        expect(isSahayakRoute('/lesson-plan')).toBe(true);
        expect(isSahayakRoute('/lesson-plan/abc')).toBe(true);
        expect(isSahayakRoute('/lesson-planner')).toBe(false);
    });
});

describe('isSamparkHost', () => {
    it('recognises the default hosts, ignoring port and case', () => {
        expect(isSamparkHost('sampark.sahayakai.com')).toBe(true);
        expect(isSamparkHost('Sampark.Localhost:3000')).toBe(true);
    });

    it('rejects the main hosts and lookalikes', () => {
        expect(isSamparkHost('www.sahayakai.com')).toBe(false);
        expect(isSamparkHost('localhost:3000')).toBe(false);
        expect(isSamparkHost('sampark.sahayakai.com.evil.example')).toBe(false);
        expect(isSamparkHost(null)).toBe(false);
    });

    it('reads SAMPARK_HOSTS when set', () => {
        const hosts = samparkHosts({ SAMPARK_HOSTS: ' sampark-staging.example.org , other.test ' });
        expect(hosts).toEqual(['sampark-staging.example.org', 'other.test']);
        expect(isSamparkHost('sampark-staging.example.org:443', hosts)).toBe(true);
        expect(isSamparkHost('sampark.sahayakai.com', hosts)).toBe(false);
    });
});

describe('sahayakOriginFor', () => {
    it('prefers the configured origin', () => {
        expect(sahayakOriginFor('sampark.sahayakai.com', 'https:', { SAHAYAK_URL: 'https://www.sahayakai.com/' })).toBe('https://www.sahayakai.com');
    });

    it('drops the sampark. label otherwise, keeping the port', () => {
        expect(sahayakOriginFor('sampark.localhost:3000', 'http:', {})).toBe('http://localhost:3000');
        expect(sahayakOriginFor('sampark.sahayakai.com', 'https:', {})).toBe('https://sahayakai.com');
    });
});

describe('samparkUrl', () => {
    const saved = process.env.NEXT_PUBLIC_SAMPARK_URL;
    afterEach(() => {
        if (saved === undefined) delete process.env.NEXT_PUBLIC_SAMPARK_URL;
        else process.env.NEXT_PUBLIC_SAMPARK_URL = saved;
    });

    it('stays on this origin under /sampark when no SamparkAI origin is configured', () => {
        delete process.env.NEXT_PUBLIC_SAMPARK_URL;
        expect(samparkUrl('/')).toBe('/sampark');
        expect(samparkUrl('/workspace')).toBe('/sampark/workspace');
    });

    it('uses the configured origin without the prefix', () => {
        process.env.NEXT_PUBLIC_SAMPARK_URL = 'https://sampark.sahayakai.com/';
        expect(samparkUrl('/workspace')).toBe('https://sampark.sahayakai.com/workspace');
        expect(samparkUrl('/')).toBe('https://sampark.sahayakai.com');
    });
});

describe('isExternalUrl', () => {
    it('is true for other origins and the /to-sahayak bridge', () => {
        expect(isExternalUrl('https://sampark.sahayakai.com/workspace')).toBe(true);
        expect(isExternalUrl('/to-sahayak')).toBe(true);
        expect(isExternalUrl('/to-sahayak/terms')).toBe(true);
        expect(isExternalUrl('/sampark/workspace')).toBe(false);
        expect(isExternalUrl('/to-sahayakai')).toBe(false);
    });
});
