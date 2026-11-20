/**
 * Class gate: every script mode that can ring a real phone takes the number only from the
 * operator's shell (RIYA_REAL_TEST_NUMBER) and refuses to start without it. No real path has a
 * literal fallback.
 *
 * The bug this catches: `vobiz-riya-e2e-server.ts --real-dial` read
 * `RIYA_REAL_TEST_NUMBER?.trim() || '+919800000001'`. Without the variable it fell back to the
 * made-up number, wrote it into its own allow-list and the school's test phone, and placed a real
 * Vobiz call to it: an allocatable Indian mobile that may belong to a stranger. The test-student
 * seed had the same fallback.
 *
 * The gate finds every script with a real-call mode (a `--real-…` flag, the launcher's real modes,
 * a PowerShell `-Real…` switch, or any mention of RIYA_REAL_TEST_NUMBER) under scripts/ and the
 * app's top-level launchers, and fails if:
 *  - any script falls back from RIYA_REAL_TEST_NUMBER, or from anything, to a phone literal, or
 *    assigns a phone literal to RIYA_REAL_TEST_NUMBER;
 *  - a TypeScript script reads RIYA_REAL_TEST_NUMBER itself instead of through
 *    scripts/sampark/real-test-number.ts, or declares a `--real-…` flag without calling it;
 *  - the Node launcher reads the variable without refusing on a bad value;
 *  - a wrapper with a real mode does not hand it to a script that refuses.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { realTestNumber, REAL_TEST_NUMBER_FORMAT } from '../../../scripts/sampark/real-test-number';
import { riyaTestPhone, riyaTestStudent } from '../../../scripts/sampark/riya-test-student';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const GUARD = 'scripts/sampark/real-test-number.ts';
const LAUNCHER = 'scripts/sampark/riya-local.mjs';

/** Scripts: everything under scripts/ plus the app's top-level launchers. */
const SCRIPT = /^(?:scripts\/.+|[^/]+)\.(?:ts|mts|mjs|cjs|js|ps1|cmd|bat|sh|py)$/;

/** A mode that can ring a real phone. */
const REAL_FLAG_TS = /process\.argv\.includes\(\s*['"`]--real-[a-z-]+['"`]\s*\)/;
const REAL_MODE = [
    REAL_FLAG_TS,
    /\bhas\(\s*['"`](?:real-[a-z-]+|vobiz-call|batch-real)['"`]\s*\)/, // the Node launcher's modes
    /\[switch\]\s*\$Real\w*/i, // a PowerShell switch
    /RIYA_REAL_TEST_NUMBER/,
];
const WRAPPER = /\.(?:ps1|cmd|bat|sh)$/;
const WRAPPER_REAL_MODE = /--real-(?:call|dial)\b|-RealCall\b/;

const PHONE_LITERAL = String.raw`['"\`]\+?(?:91)?[6-9]\d{9}['"\`]`;
const NO_FALLBACK: Array<[string, RegExp]> = [
    ['falls back from RIYA_REAL_TEST_NUMBER to a literal', /RIYA_REAL_TEST_NUMBER[^\n;]*?(?:\|\||\?\?)\s*(['"`])(?!\1)/],
    ['falls back to a phone literal', new RegExp(String.raw`(?:\|\||\?\?|-or)\s*${PHONE_LITERAL}`)],
    ['assigns a phone literal to RIYA_REAL_TEST_NUMBER', new RegExp(String.raw`RIYA_REAL_TEST_NUMBER['"\`]?\s*[:=]\s*${PHONE_LITERAL}`)],
];
const DIRECT_READ = /\benv(?:\.|\[\s*['"`])RIYA_REAL_TEST_NUMBER/;
const LAUNCHER_REFUSAL = /if \(!\/\^\\\+91\[6-9\]\\d\{9\}\$\/\.test\(([\w.]+)\)\) fail\([^\n]*RIYA_REAL_TEST_NUMBER/;

function scripts(): Array<{ file: string; text: string }> {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: APP_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out
        .split('\0')
        .filter((f) => SCRIPT.test(f))
        // LF on every OS: a Windows checkout has CRLF, and the checks below look for '\n'.
        .map((file) => ({ file, text: readFileSync(path.join(APP_ROOT, file), 'utf8').replace(/\r\n/g, '\n') }));
}

/** Every reason a script breaks the rule; empty when it complies. */
function violations(file: string, text: string, realModeFiles: ReadonlySet<string>): string[] {
    const found = NO_FALLBACK.filter(([, re]) => re.test(text)).map(([why]) => why);
    const realMode = WRAPPER.test(file) ? WRAPPER_REAL_MODE.test(text) || REAL_MODE.some((re) => re.test(text)) : REAL_MODE.some((re) => re.test(text));
    if (!realMode || file === GUARD) return found;
    if (/\.(?:ts|mts)$/.test(file)) {
        if (DIRECT_READ.test(text)) found.push(`reads RIYA_REAL_TEST_NUMBER itself, not through ${GUARD}`);
        if (REAL_FLAG_TS.test(text) && !/\brealTestNumber\(/.test(text)) found.push('has a --real-… flag but never calls realTestNumber()');
    } else if (WRAPPER.test(file)) {
        const delegates = [...realModeFiles].filter((f) => f !== file && text.includes(path.basename(f)));
        if (delegates.length === 0) found.push('a wrapper with a real mode that hands it to no script that refuses');
    } else if (DIRECT_READ.test(text)) {
        const refusal = text.match(LAUNCHER_REFUSAL);
        if (!refusal) found.push('reads RIYA_REAL_TEST_NUMBER without refusing a missing or malformed value');
    }
    return found;
}

describe('gate: a real-call mode rings only the number from the operator’s shell', () => {
    const all = scripts();
    const realModeFiles = new Set(all.filter(({ file, text }) => (WRAPPER.test(file) ? WRAPPER_REAL_MODE.test(text) : false) || REAL_MODE.some((re) => re.test(text))).map((s) => s.file));

    it('finds the scripts with a real-call mode at all', () => {
        // A gate that finds nothing reports green forever.
        expect([...realModeFiles]).toEqual(
            expect.arrayContaining([
                'scripts/sampark/vobiz-riya-e2e-server.ts',
                LAUNCHER,
                'scripts/sampark/riya-test-student.ts',
                'scripts/sampark/Start-Riya-Local.ps1',
                'Start-Sahayak-RealCalls.ps1',
            ]),
        );
    });

    it('no script falls back to a made-up number or reads the number around the guard', () => {
        const offenders = all.flatMap(({ file, text }) => violations(file, text, realModeFiles).map((why) => `${file}: ${why}`));
        expect(offenders).toEqual([]);
    });

    it('the launcher refuses --real-call before it allow-lists the number', () => {
        const text = all.find((s) => s.file === LAUNCHER)!.text;
        const refusal = text.match(LAUNCHER_REFUSAL);
        expect(refusal?.[1]).toBe('REAL_CALL.allowedNumber');
        expect(text).toContain("allowedNumber: process.env.RIYA_REAL_TEST_NUMBER?.trim() ?? ''");
        expect(text.indexOf(refusal![0])).toBeLessThan(text.indexOf('SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: [REAL_CALL.allowedNumber'));
    });

    it('the test-student seed takes the number before it writes anything', () => {
        const seed = all.find((s) => s.file === 'scripts/sampark/seed-emulator.ts')!.text;
        const branch = seed.slice(seed.indexOf("if (process.argv.includes('--riya-test-student')) {\n"));
        expect(branch.indexOf('const testPhone = riyaTestPhone();')).toBeGreaterThan(0);
        expect(branch.indexOf('const testPhone = riyaTestPhone();')).toBeLessThan(branch.indexOf('upsert'));
    });

    it('recognises the bug shape it was written for', () => {
        const fallback = "const AUTHORISED_TEST_PHONE = process.env.RIYA_REAL_TEST_NUMBER?.trim() || '+91" + "9800000001';\nconst REAL = process.argv.includes('--real-dial');";
        expect(violations('scripts/x.ts', fallback, new Set())).toEqual([
            'falls back from RIYA_REAL_TEST_NUMBER to a literal',
            'falls back to a phone literal',
            `reads RIYA_REAL_TEST_NUMBER itself, not through ${GUARD}`,
            'has a --real-… flag but never calls realTestNumber()',
        ]);
        expect(violations('scripts/x.ps1', "[switch]$RealCall\n$env:RIYA_REAL_TEST_NUMBER = '+91" + "9800000001'", new Set())).toEqual([
            'assigns a phone literal to RIYA_REAL_TEST_NUMBER',
            'a wrapper with a real mode that hands it to no script that refuses',
        ]);
        expect(violations('scripts/x.mjs', "const n = process.env.RIYA_REAL_TEST_NUMBER?.trim() ?? '';\nif (has('real-call')) dial(n);", new Set())).toEqual([
            'reads RIYA_REAL_TEST_NUMBER without refusing a missing or malformed value',
        ]);
    });

    it('the guard refuses a missing, blank or malformed number and returns a good one trimmed', () => {
        const good = '+91' + '98000' + '00001';
        for (const bad of [undefined, '', '   ', good.slice(3), `+91 ${good.slice(3)}`, `${good}0`, '+915' + '800000001']) {
            expect(() => realTestNumber('--real-dial', { RIYA_REAL_TEST_NUMBER: bad })).toThrow(/--real-dial needs RIYA_REAL_TEST_NUMBER/);
        }
        expect(realTestNumber('--real-dial', { RIYA_REAL_TEST_NUMBER: ` ${good} ` })).toBe(good);
        expect(REAL_TEST_NUMBER_FORMAT.test(good)).toBe(true);
    });

    it('the test-student record has no number of its own', () => {
        expect(() => riyaTestPhone({})).toThrow(/--riya-test-student needs RIYA_REAL_TEST_NUMBER/);
        const phone = riyaTestPhone({ RIYA_REAL_TEST_NUMBER: '+91' + '9800000042' });
        const { guardian } = riyaTestStudent('riya-test-local', '2026-11-15T00:00:00.000Z', { encrypt: (e) => `enc:${e}`, hash: (e) => `hash:${e}` }, phone);
        expect(guardian).toMatchObject({ phoneEnc: `enc:${phone}`, phoneHash: `hash:${phone}`, phoneLast4: '0042' });
    });
});
