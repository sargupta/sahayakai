/**
 * CLASS GATE — the teacher's parent-call path knows the calling hours from ONE place.
 *
 * Founder decision, 23 Oct 2026: every routine parent call happens between 10:00 and 19:00 IST,
 * whatever starts it. The band lives in `lib/sampark/policy/routine-hours.ts`.
 *
 * Bug class: a module that enforces, schedules or displays calling hours from its own numbers,
 * so it silently keeps an old window after the decision changes. The instance was
 * `lib/calling-hours.ts` still allowing 09:00–21:00 a month after the decision; the class is any
 * module on the call path holding a private copy of the window.
 *
 * Four layers, each discovered rather than listed, so a new module is in scope the moment it lands:
 *  1. calling-hours.ts takes its hours from routine-hours.ts and defines no hour of its own.
 *  2. Every source module that knows about calling hours imports them from calling-hours or
 *     routine-hours.
 *  3. No module on the call path compares an hour against a literal or states a clock time in
 *     its code (a second copy of the window, or copy that will go stale).
 *  4. Behaviour and copy: the enforced window equals the routine band at every minute of the
 *     day, and no locale string states calling hours other than the routine band.
 */

import fs from 'fs';
import path from 'path';

import { checkCallingWindow } from '@/lib/calling-hours';
import { ROUTINE_END_CEILING_HOUR, ROUTINE_START_FLOOR_HOUR } from '@/lib/sampark/policy/routine-hours';
import { EMERGENCY_END_HOUR, EMERGENCY_START_HOUR } from '@/lib/sampark/policy/window';

const SRC = path.resolve(__dirname, '../..');
const rel = (abs: string) => path.relative(SRC, abs).split(path.sep).join('/');

const ROUTINE_HOURS_MODULE = 'lib/sampark/policy/routine-hours.ts';
const CALLING_HOURS_MODULE = 'lib/calling-hours.ts';

/** Removes comments so a module that only MENTIONS calling hours in prose is not "knowing" them. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '__tests__' || e.name === '__mocks__' || e.name === 'node_modules') continue;
            walk(p, out);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

const SOURCES = walk(SRC).map((abs) => ({ rel: rel(abs), code: stripComments(fs.readFileSync(abs, 'utf8')) }));

/**
 * The code without its string literals. A module "knows" calling hours by what its code does
 * (enforce, compute, report), not by a translated label such as "Outside the school's calling
 * hours": a label carries no hour, so it cannot drift. Copy is checked separately, below.
 */
function codeOnly(src: string): string {
    return src.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

/**
 * Code that shows a module knows about calling hours: it enforces, reports or displays them.
 * Sampark's per-school `callingWindow` field (a school's own start and end hour) is not matched:
 * the school API's schema and the dispatcher's clamp hold it inside this band, and
 * src/__tests__/sampark/server/gate-routine-window-single-source.test.ts gates that.
 */
const KNOWS_CALLING_HOURS =
    /checkCallingWindow|CALLING_WINDOW_(START|END)_HOUR|ROUTINE_(START_FLOOR|END_CEILING)_HOUR|ROUTINE_(START|END)_HOUR_OPTIONS|OUTSIDE_CALLING_HOURS|calling[-_ ](hours|window)|callingHours|quiet[-_ ]?hours/i;

// Sampark's window module (lib/sampark/policy/window.ts) reads routine-hours itself and holds
// only the emergency band, and its ordered gate (policy/gate.ts) applies that window; importing
// either is reading the single source.
const READS_SINGLE_SOURCE =
    /from\s+['"](@\/lib\/calling-hours|@\/lib\/sampark\/policy\/(routine-hours|window|gate)|(\.{1,2}\/)+(lib\/)?(calling-hours|(sampark\/policy\/)?(routine-hours|window|gate)))['"]/;

/** The teacher's parent-call path: everything that can place, answer, report or show a parent call. */
const CALL_PATH = [
    /^app\/api\/attendance\//,
    /^lib\/vobiz\//,
    /^lib\/calling-hours\.ts$/,
    /^components\/attendance\//,
    /^server\/attendance\.ts$/,
];
const onCallPath = (f: string) => CALL_PATH.some((re) => re.test(f));

/** An hour compared with a number: `hour >= 9`, `getHours() < 21`, `21 <= istHour`. */
const HOUR_LITERAL_COMPARISON =
    /\b(hour|hours|istHour|currentHour|nowHour|getHours\(\)|getUTCHours\(\))\s*(<=?|>=?)\s*\d|\d\s*(<=?|>=?)\s*\b(hour|istHour|currentHour|nowHour)\b/;

/** A clock time in code or copy: "9 AM", "9:00 pm", "21:00", "09:00". */
const CLOCK_TIME = /\b\d{1,2}\s?(AM|PM|a\.m\.|p\.m\.)(?![A-Za-z])|\b([01]?\d|2[0-3]):[0-5]\d\b/i;

describe('calling hours: one source (static)', () => {
    it('finds the modules that know calling hours (guards against the scan silently matching nothing)', () => {
        const knowing = SOURCES.filter((s) => KNOWS_CALLING_HOURS.test(s.code)).map((s) => s.rel);
        expect(knowing).toEqual(expect.arrayContaining([
            CALLING_HOURS_MODULE,
            'app/api/attendance/call/route.ts',
            'app/api/attendance/vobiz/answer/route.ts',
        ]));
    });

    it('calling-hours.ts takes its hours from routine-hours.ts and holds no hour of its own', () => {
        const code = SOURCES.find((s) => s.rel === CALLING_HOURS_MODULE)!.code;
        expect(code).toMatch(/from\s+['"]@\/lib\/sampark\/policy\/routine-hours['"]/);
        expect(code).toMatch(/CALLING_WINDOW_START_HOUR\s*=\s*ROUTINE_START_FLOOR_HOUR\b/);
        expect(code).toMatch(/CALLING_WINDOW_END_HOUR\s*=\s*ROUTINE_END_CEILING_HOUR\b/);
        // No numeric hour constant anywhere in the module.
        expect(code).not.toMatch(/_HOUR\s*=\s*\d/);
    });

    it('every module that knows calling hours reads them from calling-hours or routine-hours', () => {
        const offenders = SOURCES
            .filter((s) => s.rel !== ROUTINE_HOURS_MODULE && KNOWS_CALLING_HOURS.test(codeOnly(s.code)))
            .filter((s) => !READS_SINGLE_SOURCE.test(s.code))
            .map((s) => `${s.rel}: knows calling hours but imports neither calling-hours nor routine-hours`);
        expect(offenders).toEqual([]);
    });

    it('no module on the call path compares an hour with a literal or states a clock time', () => {
        const callPath = SOURCES.filter((s) => onCallPath(s.rel));
        expect(callPath.length).toBeGreaterThanOrEqual(5);
        const offenders: string[] = [];
        for (const s of callPath) {
            const cmp = s.code.match(HOUR_LITERAL_COMPARISON);
            if (cmp) offenders.push(`${s.rel}: hour compared with a literal ("${cmp[0]}")`);
            const time = s.code.match(CLOCK_TIME);
            if (time) offenders.push(`${s.rel}: states a clock time ("${time[0]}") instead of reading the band`);
        }
        expect(offenders).toEqual([]);
    });
});

describe('calling hours: one source (behaviour and copy)', () => {
    it('pins the decision', () => {
        expect([ROUTINE_START_FLOOR_HOUR, ROUTINE_END_CEILING_HOUR]).toEqual([10, 19]);
    });

    it('the enforced window is exactly the routine band, at every minute of an IST day', () => {
        const mismatches: string[] = [];
        for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay++) {
            const hour = Math.floor(minuteOfDay / 60);
            const minute = minuteOfDay % 60;
            const at = new Date(Date.UTC(2026, 9, 26, hour - 5, minute - 30));
            const expected = hour >= ROUTINE_START_FLOOR_HOUR && hour < ROUTINE_END_CEILING_HOUR;
            if (checkCallingWindow(at).allowed !== expected) {
                mismatches.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`);
            }
        }
        expect(mismatches).toEqual([]);
    });

    it('the refusal a teacher reads states the routine band and when calling reopens', () => {
        const v = checkCallingWindow(new Date(Date.UTC(2026, 9, 26, 20 - 5, 15 - 30)));
        const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
        expect(v.allowed).toBe(false);
        expect(v.reason).toContain(`between ${pad(ROUTINE_START_FLOOR_HOUR)} and ${pad(ROUTINE_END_CEILING_HOUR)} IST`);
        expect(v.reason).toContain(`reopens at ${pad(ROUTINE_START_FLOOR_HOUR)} IST`);
    });

    it('no locale string states calling hours other than the routine band', () => {
        const LOCALES = path.join(SRC, 'locales');
        const allowed = new Set([ROUTINE_START_FLOOR_HOUR, ROUTINE_END_CEILING_HOUR, ROUTINE_END_CEILING_HOUR - 12]);
        const offenders: string[] = [];
        for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json'))) {
            const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8')) as Record<string, unknown>;
            for (const [key, value] of Object.entries(dict)) {
                for (const text of [key, typeof value === 'string' ? value : '']) {
                    if (!/call|phone/i.test(key) || !CLOCK_TIME.test(text)) continue;
                    const hours = Array.from(text.matchAll(/\b(\d{1,2})(?=\s?(AM|PM|a\.m\.|p\.m\.)|:\d{2}\b)/gi), (m) => Number(m[1]));
                    // Emergency closures (catalogue D4) keep their own band, 06:00 to 21:00, by the same
                    // decision; only copy about an emergency or a closure may state it.
                    const band = /emergenc|closure/i.test(key) ? new Set([...allowed, EMERGENCY_START_HOUR, EMERGENCY_END_HOUR, EMERGENCY_END_HOUR - 12]) : allowed;
                    if (hours.some((h) => !band.has(h))) offenders.push(`${file}: "${key}"`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
