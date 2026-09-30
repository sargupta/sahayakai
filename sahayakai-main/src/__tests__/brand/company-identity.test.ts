/**
 * @jest-environment node
 */
/**
 * Class gate for the 2026-09-30 founder-name error.
 *
 * The founder found sahayakai.com telling search engines and AI assistants
 * that SARGVISION was "founded by Sarit Arora". The JSON-LD in
 * src/components/structured-data.tsx and both public llms files named the
 * wrong person, each typed by hand, with nothing tying them to one source.
 *
 * This gate does not only pin today's name. It asserts the CLASS: every
 * public statement of who founded or runs the company agrees with
 * src/lib/company-identity.ts, whether it sits in the JSON-LD, in the llms
 * files, or in any page or public file added later.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StructuredData } from '@/components/structured-data';
import { COMPANY_NAME, FOUNDER } from '@/lib/company-identity';

const ROOT = process.cwd();

// A person's name: two to four capitalised words ("Abhishek Gupta").
const NAME = String.raw`[A-Z][a-zA-Z'-]+(?:[ \t]+[A-Z][a-zA-Z'-]+){1,3}`;

// The ways a founder or chief executive gets named in prose, markdown and code.
const CLAIM_PATTERNS = [
    String.raw`[Ff]ounded by[ \t]+(?:\*\*)?(${NAME})`,
    String.raw`Founder(?:[ \t]*(?:&|and)[ \t]*CEO)?(?:\*\*)?[ \t]*:[ \t]*(?:\*\*)?[ \t]*(${NAME})`,
    String.raw`(?:CEO|Chief Executive(?: Officer)?)(?:\*\*)?[ \t]*:[ \t]*(?:\*\*)?[ \t]*(${NAME})`,
    String.raw`(${NAME}),[ \t]*(?:Founder|CEO)\b`,
];

// Files whose every founder mention is, by definition, about this company.
const IDENTITY_FILES = ['public/llms.txt', 'public/llms-full.txt'];

// Elsewhere, a claim is about this company when the company or product is
// named nearby (a blog post may name another company's founder).
const ABOUT_US = /SARGVISION|Sahayak ?AI/i;
const CONTEXT_CHARS = 300;

const SCANNED_ROOTS = ['public', 'src'];
const SCANNED_EXTS = new Set(['.txt', '.md', '.json', '.html', '.xml', '.webmanifest', '.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIPPED_PATHS = [/(^|\/)__tests__(\/|$)/, /(^|\/)node_modules(\/|$)/, /^src\/lib\/company-identity\.ts$/];
const MAX_BYTES = 3_000_000;

type Claim = { file: string; name: string; excerpt: string; aboutUs: boolean };

function founderClaims(file: string, text: string): Claim[] {
    const claims: Claim[] = [];
    for (const pattern of CLAIM_PATTERNS) {
        for (const m of text.matchAll(new RegExp(pattern, 'g'))) {
            const at = m.index ?? 0;
            const context = text.slice(Math.max(0, at - CONTEXT_CHARS), at + m[0].length + CONTEXT_CHARS);
            claims.push({
                file,
                name: m[1],
                excerpt: text.slice(Math.max(0, at - 40), at + m[0].length).replace(/\s+/g, ' '),
                aboutUs: ABOUT_US.test(context),
            });
        }
    }
    return claims;
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = relative(ROOT, full);
        if (SKIPPED_PATHS.some((re) => re.test(rel))) continue;
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (SCANNED_EXTS.has(extname(entry)) && st.size <= MAX_BYTES) out.push(rel);
    }
    return out;
}

/** Every JSON-LD block the site renders into <head>. */
function jsonLdBlocks(): unknown[] {
    const html = renderToStaticMarkup(React.createElement(StructuredData));
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    return blocks.map((b) => JSON.parse(b[1]));
}

/** Every Person the JSON-LD presents as a founder or as holding a founder/CEO title. */
function namedLeaders(node: unknown, found: { name: unknown; sameAs?: unknown }[] = []) {
    if (Array.isArray(node)) {
        node.forEach((n) => namedLeaders(n, found));
    } else if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'founder' || key === 'founders') {
                for (const person of Array.isArray(value) ? value : [value]) {
                    const p = person as Record<string, unknown>;
                    found.push({ name: p?.name, sameAs: p?.sameAs });
                }
            }
            namedLeaders(value, found);
        }
        if (obj['@type'] === 'Person' && /founder|ceo|chief executive/i.test(String(obj.jobTitle ?? ''))) {
            found.push({ name: obj.name, sameAs: obj.sameAs });
        }
    }
    return found;
}

describe('company identity: one founder, everywhere', () => {
    it('the canonical identity is filled in', () => {
        expect(FOUNDER.name).toMatch(new RegExp(`^${NAME}$`));
        expect(COMPANY_NAME.trim()).not.toBe('');
    });

    it('the JSON-LD names only the canonical founder', () => {
        const leaders = namedLeaders(jsonLdBlocks());
        expect(leaders.length).toBeGreaterThan(0);
        for (const leader of leaders) {
            expect(leader.name).toBe(FOUNDER.name);
            if (leader.sameAs !== undefined) expect(leader.sameAs).toEqual([FOUNDER.linkedin]);
        }
    });

    it.each(IDENTITY_FILES)('%s names the canonical founder and no one else', (file) => {
        const claims = founderClaims(file, readFileSync(join(ROOT, file), 'utf8'));
        expect(claims.length).toBeGreaterThan(0);
        const wrong = claims.filter((c) => c.name !== FOUNDER.name);
        expect(wrong).toEqual([]);
    });

    it('no public or source file names anyone else as the founder or CEO of this company', () => {
        const files = SCANNED_ROOTS.flatMap((r) => walk(join(ROOT, r)));
        expect(files.length).toBeGreaterThan(100);
        const wrong = files
            .flatMap((f) => founderClaims(f, readFileSync(join(ROOT, f), 'utf8')))
            .filter((c) => (c.aboutUs || IDENTITY_FILES.includes(c.file)) && c.name !== FOUNDER.name)
            .map(({ file, name, excerpt }) => ({ file, name, excerpt }));
        expect(wrong).toEqual([]);
    });
});
