/**
 * @jest-environment node
 *
 * SLICE 2 CLASS GATES (plan §13). Each fails when its rule is broken:
 *   G-A  no concern purpose (A1/A3/A4) is ever scheduled on a Friday or Saturday (IST)
 *   G-B  rules are inert until adopted (and only the engine/backtest may run an evaluator)
 *   G-C  a keypress never writes attendance or leave
 *   G-D  only the dispatcher reaches a carrier — the existing gate's scanner, extended to the slice-2 trees
 */
import fs from 'node:fs';
import path from 'node:path';

import { PURPOSE_CATALOGUE } from '@/lib/sampark/catalogue';
import { runAdoptedRules } from '@/lib/sampark/rules/engine';
import { pagingFor } from '@/lib/sampark/rules/paging';
import { earliestDialAt, isFridayOrSaturdayIst } from '@/lib/sampark/rules/schedule';
import { CONCERN_PURPOSES } from '@/lib/sampark/rules/types';
import { istInstant, addDays, istParts } from '@/lib/sampark/policy/ist';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import type { CallState, PurposeId } from '@/types/sampark';
import { school } from '../engine/_fixtures';

import { ALL_ADOPTED, ANCHOR_11_IST, adoption, loadFixtureSignals, loadFixtureStudents } from './_fixture';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'src');

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) acc.push(full);
    }
    return acc;
}
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const isTest = (r: string) => r.includes('/__tests__/') || /\.test\.tsx?$/.test(r);
function strip(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}
const sampark = () =>
    walk(SRC)
        .map((f) => ({ rel: rel(f), code: fs.readFileSync(f, 'utf8') }))
        .filter((f) => /sampark/i.test(f.rel) && !isTest(f.rel));

describe('G-A: no concern purpose is ever scheduled on a Friday or Saturday (IST)', () => {
    it('the catalogue marks exactly A1, A3, A4 as concern purposes that avoid Fri/Sat', () => {
        const flagged = Object.values(PURPOSE_CATALOGUE).filter((s) => s.noFridaySaturday).map((s) => s.id).sort();
        expect(flagged).toEqual([...CONCERN_PURPOSES].sort());
        expect(flagged).toEqual(['academic_talk', 'attendance_talk', 'conduct_talk']);
    });

    // The window code is Intl-based and slow (~40 ms a call), so sample 14 days (two of every weekday)
    // at one in-window and one after-hours instant per day, over three kinds of school.
    const schools = [
        school(),
        school({ callingWindow: { startHour: 11, endHour: 16, offDays: [0, 3] }, holidays: ['2026-10-07', '2026-10-08', '2026-10-12'] }),
        // a school that works Saturdays and has no off-day at all: the rule must still hold
        school({ callingWindow: { startHour: 10, endHour: 20, offDays: [] } }),
    ];

    it.each(CONCERN_PURPOSES)('%s: over 14 days, the earliest dial time and the window verdict never land on Fri/Sat', (purpose) => {
        const spec = PURPOSE_CATALOGUE[purpose as PurposeId];
        for (const s of schools) {
            for (let day = 0; day < 14; day++) {
                const date = addDays('2026-10-01', day);
                for (const [h, m] of [[12, 30], [21, 30]]) {
                    const at = istInstant(date, h, m);
                    const verdict = samparkWindowVerdict(s, spec, at);
                    if (isFridayOrSaturdayIst(at)) expect(verdict.allowed).toBe(false);
                    const earliest = earliestDialAt(purpose as PurposeId, s, at);
                    expect(earliest).not.toBeNull();
                    expect(isFridayOrSaturdayIst(earliest as Date)).toBe(false);
                    expect(earliest!.getTime()).toBeGreaterThanOrEqual(at.getTime());
                }
            }
        }
    }, 120_000);

    it('approved on a Friday evening, a request to talk waits until the next allowed day (Monday here, Sunday being the off-day)', () => {
        const fridayEvening = istInstant('2026-10-09', 18, 0); // Friday
        expect(istParts(fridayEvening).weekday).toBe(5);
        const at = earliestDialAt('academic_talk', school(), fridayEvening) as Date;
        expect(istParts(at)).toMatchObject({ date: '2026-10-12', weekday: 1, hour: 10 });
    });

    it('the non-concern progress purposes are not subject to the rule (A2 same-day, A5 recognition)', () => {
        expect(PURPOSE_CATALOGUE.absence_today.noFridaySaturday).toBe(false);
        expect(PURPOSE_CATALOGUE.recognition.noFridaySaturday).toBe(false);
        const friday = istInstant('2026-10-09', 11, 0);
        expect(samparkWindowVerdict(school(), PURPOSE_CATALOGUE.absence_today, friday).allowed).toBe(true);
    });

    it('detector: a purpose that dropped the flag would be caught by the catalogue assertion', () => {
        const forged = { ...PURPOSE_CATALOGUE.academic_talk, noFridaySaturday: false };
        expect(samparkWindowVerdict(school(), forged, istInstant('2026-10-09', 11, 0)).allowed).toBe(true); // the window alone would allow it
    });
});

describe('G-B: rules are inert until adopted', () => {
    const students = loadFixtureStudents();
    const signals = loadFixtureSignals();
    const base = { asOf: ANCHOR_11_IST, students, signals };

    it('with no adoption at all, nothing is evaluated and nothing is proposed, on data that triggers every rule', () => {
        const none = runAdoptedRules({ ...base, adoptions: [] });
        expect(none.drafts).toEqual([]);
        expect(none.excluded).toEqual([]);
        expect(none.evaluated).toEqual([]);
        expect(none.inert).toHaveLength(7);
        // control: the same data does produce proposals once adopted
        expect(runAdoptedRules({ ...base, adoptions: ALL_ADOPTED }).drafts.length).toBeGreaterThan(5);
    });
    it('a withdrawn adoption is inert again', () => {
        const withdrawn = ALL_ADOPTED.map((a) => ({ ...a, status: 'withdrawn' as const }));
        expect(runAdoptedRules({ ...base, adoptions: withdrawn }).drafts).toEqual([]);
    });
    it('adopting one rule activates only that rule', () => {
        const r = runAdoptedRules({ ...base, adoptions: [adoption('conduct_talk')] });
        expect(r.evaluated).toEqual(['conduct_talk']);
        expect(new Set(r.drafts.map((d) => d.purpose))).toEqual(new Set(['conduct_talk']));
    });
    it('only the engine, the backtest and tests may call an evaluator or evaluateRule', () => {
        const allowed = new Set(['src/lib/sampark/rules/engine.ts', 'src/lib/sampark/rules/backtest.ts', 'src/lib/sampark/rules/evaluate-progress.ts', 'src/lib/sampark/rules/evaluate-fees.ts']);
        const offenders = sampark()
            .filter((f) => !allowed.has(f.rel))
            .filter((f) => /\b(evaluateRule|evaluateAttendance|evaluateAbsenceToday|evaluateAcademic|evaluateConduct|evaluateRecognition|evaluateFeeDue|evaluateFeeOverdue)\b/.test(strip(f.code)))
            .map((f) => f.rel);
        expect(offenders).toEqual([]);
    });
    it('detector: the scan would catch a service that ran a rule directly', () => {
        const planted = "import { evaluateRule } from '@/lib/sampark/rules/engine'; evaluateRule('academic_talk', ctx, th);";
        expect(/\b(evaluateRule|evaluateAttendance)\b/.test(strip(planted))).toBe(true);
    });
});

describe('G-C: a keypress never writes attendance or leave', () => {
    const states: CallState[] = ['dialing', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'unknown', 'cancelled'];
    const digitStrings = ['', '1', '2', '9', '12', '21', '19', '29', '0', '5', '99', '1112', '#'];

    it('across every state and key sequence the decision never writes a leave record, and key 1 is a note only', () => {
        for (const state of states) {
            for (const digits of digitStrings) {
                const d = pagingFor({ state, outcome: { heard: 'full', digits, confirmed: digits.includes('1'), declined: digits.includes('2'), optOut: 'none' } });
                expect(d.writesLeaveRecord).toBe(false);
                expect(Object.keys(d).sort()).toEqual(['note', 'page', 'reason', 'targets', 'writesLeaveRecord']);
            }
        }
        const one = pagingFor({ state: 'completed', outcome: { heard: 'full', digits: '1', confirmed: true, declined: false, optOut: 'none' } });
        expect(one.page).toBe(false);
        expect(one.note).toMatch(/not a leave record/);
    });

    it('no module in the Sampark trees writes attendance or leave (vocabulary scan)', () => {
        const WRITE = /\b(writeLeave|recordLeave|markLeave|createLeave|saveLeave|leaveRecord\w*|setAttendance|writeAttendance|markAttendance|upsertAttendance|updateAttendance|postAttendance)\b/;
        const offenders = sampark().filter((f) => WRITE.test(strip(f.code))).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });
    it('no repository port exposes an attendance or leave write', () => {
        for (const file of ['src/lib/sampark/ports.ts', 'src/lib/sampark/rules/ports.ts']) {
            const code = strip(fs.readFileSync(path.join(ROOT, file), 'utf8'));
            expect(/\b\w*(attendance|leave)\w*\s*\(/i.test(code)).toBe(false);
        }
    });
    it('no Sampark code calls the CRM attendance endpoint with a write', () => {
        const offenders = sampark().filter((f) => /\/v1\/attendance/.test(strip(f.code)) && /\b(POST|PUT|PATCH)\b/.test(strip(f.code))).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });
    it('detector: the vocabulary scan flags a planted attendance write', () => {
        expect(/\b(markAttendance|writeLeave)\b/.test(strip('await crm.markAttendance(studentId, "on_leave")'))).toBe(true);
    });
});

describe('G-D: only the dispatcher reaches a carrier (gate 2 extended to the slice-2 trees)', () => {
    const CARRIER_IMPORT = /dispatch\/[\w-]*-carrier/;
    const files = sampark();

    it('the slice-2 modules exist and are inside the trees gate 2 scans', () => {
        const slice2 = files.filter((f) => f.rel.startsWith('src/lib/sampark/rules/') || f.rel.startsWith('src/server/sampark/proposals') || f.rel.includes('src/app/api/sampark/[orgId]/proposals') || f.rel.includes('src/app/api/sampark/[orgId]/rules'));
        expect(slice2.length).toBeGreaterThan(8);
        for (const f of slice2) {
            expect(['src/lib/sampark/', 'src/server/sampark/', 'src/app/api/sampark/']).toContain(['src/lib/sampark/', 'src/server/sampark/', 'src/app/api/sampark/'].find((t) => f.rel.startsWith(t)));
        }
    });
    it('none of them imports a carrier module or calls .place(', () => {
        const slice2 = files.filter((f) => f.rel.startsWith('src/lib/sampark/rules/') || f.rel.startsWith('src/server/sampark/proposals') || f.rel.includes('/proposals/') || f.rel.includes('/rules/'));
        const offenders = slice2.filter((f) => CARRIER_IMPORT.test(strip(f.code)) || /\.place\s*\(/.test(strip(f.code))).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });
    it('a proposal can only become a call through the intents the dispatcher reads: the server module never constructs a carrier', () => {
        const server = files.filter((f) => f.rel.startsWith('src/server/sampark/proposals'));
        for (const f of server) expect(/carrierFor|createSimulatedCarrier/.test(strip(f.code))).toBe(false);
    });
});
