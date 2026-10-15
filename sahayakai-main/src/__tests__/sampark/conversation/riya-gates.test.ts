/** @jest-environment node */
/**
 * CLASS GATES for Riya (ElevenLabs) calling. Each is a scan of the source tree, proven
 * against a planted violation first so it fails when broken, not just passes today.
 *
 *  (a) The ElevenLabs client module is imported only by the Riya service
 *      (src/server/sampark/conversation.ts) and tests — no route, component or other
 *      service can reach the provider around the gate, the claim and the test-phone rule.
 *  (b) `startRiyaOutboundCall(` is called only in the Riya service.
 *  (c) No client component ('use client') imports the Riya service, the client or the
 *      webhook verifier, and no source mentions a NEXT_PUBLIC_ ElevenLabs variable: the
 *      API key and webhook secret can never be bundled for a browser.
 *  (d) The request schemas a browser can send carry no phone-number field.
 *  (e) Riya flags are read with an exact === 'true'.
 */
import fs from 'node:fs';
import path from 'node:path';

import { RiyaPreviewSchema, RiyaStartSchema } from '@/server/sampark/conversation';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'src');
const SERVICE = 'src/server/sampark/conversation.ts';
const CLIENT = 'src/lib/sampark/conversation/elevenlabs-client';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) {
            if (name !== 'node_modules') out.push(...walk(p));
        } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}

const rel = (abs: string) => path.relative(ROOT, abs).split(path.sep).join('/');
const isTest = (r: string) => r.includes('/__tests__/') || /\.test\.tsx?$/.test(r);
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

function imports(fromRel: string, code: string): string[] {
    const out: string[] = [];
    for (const m of code.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1] ?? m[2] ?? m[3];
        if (spec.startsWith('@/')) out.push(`src/${spec.slice(2)}`.replace(/\.(tsx?|jsx?)$/, ''));
        else if (spec.startsWith('.')) out.push(path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec)).replace(/\.(tsx?|jsx?)$/, ''));
    }
    return out;
}

interface Source { rel: string; code: string; raw: string }
const SOURCES: Source[] = walk(SRC).map((abs) => {
    const raw = fs.readFileSync(abs, 'utf8');
    return { rel: rel(abs), raw, code: strip(raw) };
});

function clientImporters(sources: Source[]): string[] {
    return sources
        .filter((s) => !isTest(s.rel) && s.rel !== SERVICE && !s.rel.startsWith('src/lib/sampark/conversation/'))
        .filter((s) => imports(s.rel, s.code).includes(CLIENT))
        .map((s) => s.rel);
}

function dialCallers(sources: Source[]): string[] {
    return sources
        .filter((s) => !isTest(s.rel) && s.rel !== SERVICE && s.rel !== `${CLIENT}.ts`)
        .filter((s) => /\bstartRiyaOutboundCall\s*\(/.test(s.code))
        .map((s) => s.rel);
}

const SECRET_MODULES = [SERVICE.replace(/\.ts$/, ''), CLIENT, 'src/lib/sampark/conversation/webhook', 'src/server/sampark/conversation-http'];
function browserLeaks(sources: Source[]): string[] {
    const out: string[] = [];
    for (const s of sources) {
        if (isTest(s.rel)) continue;
        if (/NEXT_PUBLIC_[A-Z_]*ELEVEN/i.test(s.code)) out.push(`${s.rel}: NEXT_PUBLIC ElevenLabs variable`);
        if (/^\s*['"]use client['"]/m.test(s.raw) && imports(s.rel, s.code).some((i) => SECRET_MODULES.includes(i))) out.push(`${s.rel}: client component imports a server-only Riya module`);
    }
    return out;
}

describe('Riya class gates', () => {
    it('(a) planted: a route importing the ElevenLabs client is caught', () => {
        const planted: Source = { rel: 'src/app/api/sampark/[orgId]/riya/evil/route.ts', raw: '', code: "import { startRiyaOutboundCall } from '@/lib/sampark/conversation/elevenlabs-client';" };
        expect(clientImporters([...SOURCES, planted])).toEqual([planted.rel]);
    });
    it('(a) only the Riya service imports the ElevenLabs client', () => {
        expect(clientImporters(SOURCES)).toEqual([]);
        expect(SOURCES.some((s) => s.rel === SERVICE && imports(s.rel, s.code).includes(CLIENT))).toBe(true);
    });

    it('(b) planted: a dial outside the service is caught', () => {
        const planted: Source = { rel: 'src/server/sampark/other.ts', raw: '', code: 'await startRiyaOutboundCall(cfg, req);' };
        expect(dialCallers([...SOURCES, planted])).toEqual([planted.rel]);
    });
    it('(b) only the Riya service starts a Riya call', () => {
        expect(dialCallers(SOURCES)).toEqual([]);
    });

    it('(c) planted: a client component importing the service is caught', () => {
        const planted: Source = { rel: 'src/components/sampark/evil.tsx', raw: '"use client";\n', code: "import { startRiyaCall } from '@/server/sampark/conversation';" };
        expect(browserLeaks([...SOURCES, planted])).toHaveLength(1);
    });
    it('(c) nothing server-only or secret reaches a browser bundle', () => {
        expect(browserLeaks(SOURCES)).toEqual([]);
    });

    it('(d) a browser cannot send a phone number', () => {
        const keys = [...Object.keys(RiyaStartSchema.shape), ...Object.keys(RiyaPreviewSchema.shape)];
        expect(keys.filter((k) => /phone|number|e164|to_?number|msisdn/i.test(k))).toEqual([]);
        expect(RiyaStartSchema.safeParse({ toNumber: '+919800000001' }).success).toBe(false);
    });

    it('(e) Riya flags are read with an exact === \'true\'', () => {
        const offenders: string[] = [];
        for (const s of SOURCES) {
            if (isTest(s.rel)) continue;
            for (const m of s.code.matchAll(/(?:process\.env|env)\.(SAMPARK_ELEVENLABS_ENABLED|SAMPARK_RIYA_STORE_TRANSCRIPTS|SAMPARK_RIYA_RECORDING_OFF_CONFIRMED|SAMPARK_RIYA_PRODUCTION_DATA_APPROVED|ELEVENLABS_ALLOW_SOURCE_AGENT)\s*(!==|===|==|!=)?\s*('[^']*')?/g)) {
                if ((m[2] !== '===' && m[2] !== '!==') || m[3] !== "'true'") offenders.push(`${s.rel}: ${m[0]}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
