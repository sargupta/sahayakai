/**
 * CLASS GATE — every refusal a teacher can get from the parent-call routes has a translated label.
 *
 * Bug class: a refusal code whose only explanation is the route's English `error` prose. The
 * modal used to show `err.error` as the toast description, so a teacher using the Hindi or
 * Bengali UI got a translated "Call failed" over an English sentence. The instances were
 * PARENT_OPTED_OUT, SUPPRESSION_CHECK_FAILED and the rewritten OUTSIDE_CALLING_HOURS.
 *
 * What it enforces: every error response the call and outreach routes can send a teacher
 * carries a code with a translated label, or is a provider pass-through named below.
 *
 * Layers:
 *  0. EVERY ERROR RESPONSE HAS A CODE — every `NextResponse.json(..., { status })` in the call
 *     and outreach routes and in the helpers they return (call-suppression.ts) whose status is
 *     4xx/5xx or computed must carry a `code`, or build its body with a coded helper
 *     (outsideCallingHoursBody). The only exemptions are provider pass-throughs, listed with
 *     reasons. A new code-less error response fails here, which a code-only scan could not see.
 *  1. DISCOVERY — every literal `code` the call and outreach routes can return (directly, or
 *     through call-suppression.ts and calling-hours.ts) has a label in CALL_REFUSAL_LABELS. The
 *     only non-literal codes allowed are the two provider-failure pass-throughs, listed below;
 *     a new computed code fails here.
 *  2. LOCALES — each label is a key in every src/locales/*.json, translated (not the English
 *     key again) and written in that language's script.
 *  3. MODAL — the call toast describes the error through callErrorDescription, which uses the
 *     label for a known code.
 */

import fs from 'fs';
import path from 'path';

import { CALL_REFUSAL_LABELS, callErrorDescription } from '@/lib/attendance/call-refusal-messages';
import { CallRequestError } from '@/lib/attendance/call-errors';
import { OUTSIDE_CALLING_HOURS_CODE } from '@/lib/calling-hours';
import { PARENT_OPTED_OUT_CODE } from '@/lib/call-suppression';

const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Where the codes a teacher can receive from these routes are written. */
const CODE_SOURCES = [
    'app/api/attendance/call/route.ts',
    'app/api/attendance/outreach/route.ts',
    'lib/call-suppression.ts',
    'lib/calling-hours.ts',
];

/** Computed codes: provider failures passed through from the provider's own classification. */
const COMPUTED_CODES_ALLOWED = [
    'result.failure.category.toUpperCase()', // Vobiz failure category (lib/vobiz/client.ts)
    'failure.code', // Twilio failure classification (lib/twilio-errors.ts)
];

/** Every `NextResponse.json(...)` call in a source, as its full argument text (balanced parens). */
function jsonResponses(src: string): string[] {
    const out: string[] = [];
    let from = 0;
    for (;;) {
        const at = src.indexOf('NextResponse.json(', from);
        if (at < 0) return out;
        let i = at + 'NextResponse.json('.length;
        let depth = 1;
        while (i < src.length && depth > 0) {
            const ch = src[i];
            if (ch === "'" || ch === '"' || ch === '`') {
                const quote = ch;
                i++;
                while (i < src.length && src[i] !== quote) i += src[i] === '\\' ? 2 : 1;
            } else if (ch === '(') depth++;
            else if (ch === ')') depth--;
            i++;
        }
        out.push(src.slice(at, i));
        from = i;
    }
}

/** Error responses whose body is a provider's own, passed through. Each names its reason. */
const UNCODED_PROVIDER_PASS_THROUGHS: Record<string, string> = {
    'data?.error':
        "the Exotel voicebot's own error and status, passed through unchanged (Exotel is parked; the " +
        'voicebot owns that text)',
};

function isErrorResponse(call: string): boolean {
    const status = call.match(/\bstatus:\s*([^,}\n]+)/);
    if (!status) return false; // 200
    const literal = status[1].trim().match(/^(\d{3})$/);
    return literal ? Number(literal[1]) >= 400 : true; // a computed status may be an error
}

describe('every error response carries a code', () => {
    const responses = CODE_SOURCES.flatMap((rel) => jsonResponses(read(rel)).map((call) => ({ rel, call })));

    it('finds the responses (guards against the scan matching nothing)', () => {
        expect(responses.filter((r) => isErrorResponse(r.call)).length).toBeGreaterThanOrEqual(25);
    });

    it('no error response is code-less, except a named provider pass-through', () => {
        const offenders = responses
            .filter((r) => isErrorResponse(r.call))
            .filter((r) => !/\bcode:/.test(r.call) && !/\boutsideCallingHoursBody\(/.test(r.call))
            .filter((r) => !Object.keys(UNCODED_PROVIDER_PASS_THROUGHS).some((k) => r.call.includes(k)))
            .map((r) => `${r.rel}: ${r.call.replace(/\s+/g, ' ').slice(0, 140)}`);
        expect(offenders).toEqual([]);
    });

    it('every pass-through exemption is still used and names its reason', () => {
        const all = responses.map((r) => r.call).join('\n');
        for (const [k, why] of Object.entries(UNCODED_PROVIDER_PASS_THROUGHS)) {
            expect(all).toContain(k);
            expect(why.length).toBeGreaterThan(30);
        }
    });
});

function discoverCodes(): { literal: Set<string>; computed: string[] } {
    const literal = new Set<string>();
    const computed: string[] = [];
    for (const rel of CODE_SOURCES) {
        const src = read(rel);
        for (const m of src.matchAll(/\bcode:\s*([^,}\n]+)/g)) {
            const expr = m[1].trim().replace(/;$/, '');
            const lit = expr.match(/^['"]([A-Z][A-Z0-9_]*)['"]$/);
            if (lit) literal.add(lit[1]);
            else if (/^[A-Z][A-Z0-9_]*_CODE$/.test(expr) || /^typeof [A-Z_]+_CODE$/.test(expr)) continue; // a constant below
            else computed.push(`${rel}: ${expr}`);
        }
        for (const m of src.matchAll(/export const [A-Z][A-Z0-9_]*_CODE\s*=\s*['"]([A-Z][A-Z0-9_]*)['"]/g)) literal.add(m[1]);
    }
    return { literal, computed };
}

const SCRIPT: Record<string, RegExp> = {
    hindi: /[ऀ-ॿ]/g,
    marathi: /[ऀ-ॿ]/g,
    bengali: /[ঀ-৿]/g,
    punjabi: /[਀-੿]/g,
    gujarati: /[઀-૿]/g,
    odia: /[଀-୿]/g,
    tamil: /[஀-௿]/g,
    telugu: /[ఀ-౿]/g,
    kannada: /[ಀ-೿]/g,
    malayalam: /[ഀ-ൿ]/g,
};
const LOCALE_DIR = path.join(SRC, 'locales');
const LOCALES = fs.readdirSync(LOCALE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

describe('every refusal code has a label', () => {
    const { literal, computed } = discoverCodes();

    it('finds the codes (guards against the scan matching nothing)', () => {
        for (const c of [
            'OUTSIDE_CALLING_HOURS', 'PARENT_OPTED_OUT', 'SUPPRESSION_CHECK_FAILED', 'PHONE_MISMATCH', 'INTERNAL',
            'NO_PARENT_PHONE', 'VOICE_NOT_CONFIGURED', 'LANGUAGE_NOT_SUPPORTED', 'RECENT_OUTREACH_EXISTS',
        ]) {
            expect(literal).toContain(c);
        }
    });

    it('each literal code maps to a label', () => {
        expect([...literal].filter((c) => !CALL_REFUSAL_LABELS[c])).toEqual([]);
    });

    it('no code is computed except the provider-failure pass-throughs', () => {
        expect(computed.filter((c) => !COMPUTED_CODES_ALLOWED.some((a) => c.endsWith(`: ${a}`)))).toEqual([]);
    });

    it("the client module's literals match the server constants", () => {
        expect(CALL_REFUSAL_LABELS[OUTSIDE_CALLING_HOURS_CODE]).toBeDefined();
        expect(CALL_REFUSAL_LABELS[PARENT_OPTED_OUT_CODE]).toBeDefined();
    });
});

describe('every label is translated in every locale', () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(10);
    const labels = [...new Set(Object.values(CALL_REFUSAL_LABELS))];

    it.each(LOCALES)('%s', (locale) => {
        const dict = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, `${locale}.json`), 'utf8')) as Record<string, string>;
        const problems: string[] = [];
        for (const label of labels) {
            const value = dict[label];
            if (typeof value !== 'string' || !value.trim()) problems.push(`missing: ${label}`);
            else if (value === label) problems.push(`untranslated: ${label}`);
            else if ((value.match(SCRIPT[locale]) ?? []).length < 8) problems.push(`not in ${locale} script: ${label}`);
        }
        expect(problems).toEqual([]);
    });
});

describe('the modal shows the label, not the English error', () => {
    it('callErrorDescription uses the translated label for a known code and the message otherwise', () => {
        const t = (k: string) => `T(${k})`;
        const refused = new CallRequestError('English prose from the route', 'PARENT_OPTED_OUT');
        expect(callErrorDescription(refused, t)).toBe(`T(${CALL_REFUSAL_LABELS.PARENT_OPTED_OUT})`);
        expect(callErrorDescription(new CallRequestError('Provider said no', 'NETWORK'), t)).toBe('Provider said no');
        expect(callErrorDescription(new Error('plain'), t)).toBe('plain');
    });

    it('the call toast is described through callErrorDescription', () => {
        const modal = read('components/attendance/contact-parent-modal.tsx');
        expect(modal).toMatch(/from ["']@\/lib\/attendance\/call-refusal-messages["']/);
        expect(modal).toMatch(/toast\(\{ title: t\("Call failed"\), description: callErrorDescription\(err, t\)/);
        expect(modal).not.toMatch(/title: t\("Call failed"\), description: err\.message/);
    });
});
