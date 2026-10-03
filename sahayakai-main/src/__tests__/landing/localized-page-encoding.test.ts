/**
 * Class-gate for the localized-landing mojibake bug.
 *
 * The Bengali/Kannada/Tamil marketing landing pages once shipped with their
 * Indic strings double-encoded (UTF-8 saved as Latin-1 then re-encoded), so
 * every visitor — and every search engine — saw garbage like "à²¸à²¹à²¾à²¯à²"
 * in the title, meta and body.
 *
 * This test catches the CLASS of bug, not just the instance: for every
 * localized page under src/app/(marketing), it (1) fails on the tell-tale
 * mojibake byte pattern and (2) asserts the page actually contains real
 * codepoints from the language's Unicode block.
 */
import fs from 'node:fs';
import path from 'node:path';

const MARKETING = path.join(process.cwd(), 'src', 'app', '(marketing)');

// locale dir -> { name, Unicode block for that script }
const LOCALES: Record<string, { name: string; lo: number; hi: number }> = {
    bn: { name: 'Bengali', lo: 0x0980, hi: 0x09ff },
    kn: { name: 'Kannada', lo: 0x0c80, hi: 0x0cff },
    ta: { name: 'Tamil', lo: 0x0b80, hi: 0x0bff },
    hi: { name: 'Devanagari', lo: 0x0900, hi: 0x097f },
};

// Mojibake signature: a Latin-1 lead byte that is really the first byte of a
// UTF-8 sequence (Ã Â à á â ã) immediately followed by a UTF-8 continuation
// byte rendered as a Latin-1 supplement char (U+0080–U+00BF). This does not
// occur in correctly-encoded Indic text.
const MOJIBAKE = /[ÂÃà-ã][-¿]/;

function readPage(locale: string): string | null {
    const p = path.join(MARKETING, locale, 'page.tsx');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function countInBlock(s: string, lo: number, hi: number): number {
    let n = 0;
    for (const ch of s) {
        const c = ch.codePointAt(0)!;
        if (c >= lo && c <= hi) n++;
    }
    return n;
}

describe('localized marketing pages are correctly UTF-8 encoded', () => {
    const present = Object.keys(LOCALES).filter((l) => readPage(l) !== null);

    it('has at least one localized page to check', () => {
        expect(present.length).toBeGreaterThan(0);
    });

    for (const locale of present) {
        const { name, lo, hi } = LOCALES[locale];
        const src = readPage(locale)!;

        it(`/${locale} (${name}) contains no mojibake`, () => {
            const m = src.match(MOJIBAKE);
            const detail = m
                ? `mojibake near: ${JSON.stringify(src.slice(Math.max(0, m.index! - 10), m.index! + 20))}`
                : 'clean';
            expect(detail).toBe('clean');
        });

        it(`/${locale} (${name}) actually contains ${name} script`, () => {
            expect(countInBlock(src, lo, hi)).toBeGreaterThan(50);
        });
    }
});
