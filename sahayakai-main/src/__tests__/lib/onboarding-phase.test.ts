/**
 * @jest-environment node
 */
/**
 * Class gate for the 2026-10 stuck-new-user bug.
 *
 * The /onboarding wizard finished by writing onboardingPhase 'completed', but
 * every reader (sidebar, dashboard) treats only 'done' as finished. So every
 * teacher who completed onboarding after bf9fd025f stayed in new-user mode:
 * reduced sidebar, spotlights, new-user dashboard. Writer and reader used two
 * vocabularies and nothing tied them to one source.
 *
 * This gate asserts the CLASS, not the instance:
 *  1. The wizard-finish phase ends new-user mode.
 *  2. Every value that can be stored resolves to a canonical phase, and legacy
 *     values that were written in the past read correctly.
 *  3. No phase can hold a teacher in new-user mode past NEW_USER_MODE_MAX_DAYS.
 *  4. No source file writes or compares onboardingPhase against a literal
 *     outside the canonical union — including through `Record<string, any>`
 *     objects the type system cannot see into.
 *
 * Compile-time half: src/lib/onboarding-phase.typecheck.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import {
    LEGACY_ONBOARDING_PHASE_ALIASES,
    NEW_USER_MODE_MAX_DAYS,
    ONBOARDING_FINISHED_PHASE,
    ONBOARDING_PHASES,
    isNewUserPhase,
    isOnboardingPhase,
    normalizeOnboardingPhase,
    toDateOrNull,
} from '@/lib/onboarding-phase';
import { getEffectiveOnboardingPhase, isNewUser } from '@/lib/profile-utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-26T06:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

// A complete Step-1 profile, as the wizard saves it.
const ONBOARDED = {
    displayName: 'Asha',
    schoolName: 'KV Siliguri',
    state: 'West Bengal',
    subjects: ['Science'],
    gradeLevels: ['Class 7'],
    preferredLanguage: 'Bengali',
} as const;

describe('onboarding completion ends new-user mode', () => {
    it('the wizard-finish phase is canonical and is not a new user', () => {
        expect(isOnboardingPhase(ONBOARDING_FINISHED_PHASE)).toBe(true);
        expect(isNewUser({ ...ONBOARDED, onboardingPhase: ONBOARDING_FINISHED_PHASE, createdAt: NOW as any }, NOW)).toBe(false);
    });

    it("a teacher whose stored phase is the legacy 'completed' is not a new user", () => {
        const profile = { ...ONBOARDED, onboardingPhase: 'completed', createdAt: NOW } as any;
        expect(getEffectiveOnboardingPhase(profile)).toBe('done');
        expect(isNewUser(profile, NOW)).toBe(false);
    });
});

describe('every stored value resolves to a canonical phase', () => {
    it.each(ONBOARDING_PHASES)('canonical %s round-trips', (phase) => {
        expect(normalizeOnboardingPhase(phase)).toBe(phase);
    });

    it.each(Object.entries(LEGACY_ONBOARDING_PHASE_ALIASES))(
        'legacy %s maps into the canonical union',
        (legacy, target) => {
            expect(isOnboardingPhase(legacy)).toBe(false);
            expect(ONBOARDING_PHASES).toContain(target);
            expect(normalizeOnboardingPhase(legacy)).toBe(target);
        },
    );

    it('an unrecognised value never traps an onboarded teacher', () => {
        expect(getEffectiveOnboardingPhase({ ...ONBOARDED, onboardingPhase: 'finished' } as any)).toBe('done');
        expect(getEffectiveOnboardingPhase({ onboardingPhase: 'finished' } as any)).toBe('setup');
        expect(normalizeOnboardingPhase(undefined)).toBeUndefined();
        expect(normalizeOnboardingPhase(42)).toBeUndefined();
        expect(normalizeOnboardingPhase('toString')).toBeUndefined();
    });
});

describe(`new-user mode ends within ${NEW_USER_MODE_MAX_DAYS} days whatever the phase`, () => {
    const unfinished = ONBOARDING_PHASES.filter((p) => p !== 'done');

    it.each(unfinished)('%s is a new user inside the window', (phase) => {
        expect(isNewUserPhase(phase, daysAgo(1), NOW)).toBe(true);
        expect(isNewUserPhase(phase, daysAgo(NEW_USER_MODE_MAX_DAYS), NOW)).toBe(true);
    });

    it.each(unfinished)('%s is released after the window', (phase) => {
        expect(isNewUserPhase(phase, daysAgo(NEW_USER_MODE_MAX_DAYS + 1), NOW)).toBe(false);
    });

    it('done is never a new user', () => {
        expect(isNewUserPhase('done', daysAgo(0), NOW)).toBe(false);
        expect(isNewUserPhase('done', null, NOW)).toBe(false);
    });

    it('an abandoned wizard (Step 1 saved, Step 2 never finished) is released', () => {
        const profile = { ...ONBOARDED, onboardingPhase: 'first-generation', createdAt: daysAgo(30).toISOString() } as any;
        expect(isNewUser(profile, NOW)).toBe(false);
    });

    it('reads createdAt in every shape it arrives in', () => {
        const old = daysAgo(30);
        const shapes: unknown[] = [
            old,
            old.toISOString(), // dbAdapter.serialize → /api/profile
            old.getTime(),
            { toDate: () => old }, // client/Admin SDK Timestamp
            { seconds: Math.floor(old.getTime() / 1000), nanoseconds: 0 },
            { _seconds: Math.floor(old.getTime() / 1000), _nanoseconds: 0 },
        ];
        for (const createdAt of shapes) {
            expect(toDateOrNull(createdAt)?.getTime()).toBeCloseTo(old.getTime(), -4);
            expect(isNewUserPhase('exploring', createdAt, NOW)).toBe(false);
        }
        expect(toDateOrNull('not a date')).toBeNull();
        expect(toDateOrNull(undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Source scan: no phase literal outside the canonical union.
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const SCANNED_EXTS = new Set(['.ts', '.tsx']);
const SKIPPED = [
    /(^|\/)__tests__(\/|$)/,
    /(^|\/)node_modules(\/|$)/,
    // The canonical module and the compile-time gate name legacy values on purpose.
    /^src\/lib\/onboarding-phase(\.typecheck)?\.ts$/,
];

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const abs = join(dir, entry);
        const rel = relative(ROOT, abs);
        if (SKIPPED.some((re) => re.test(rel))) continue;
        if (statSync(abs).isDirectory()) walk(abs, out);
        else if (SCANNED_EXTS.has(extname(entry))) out.push(rel);
    }
    return out;
}

// Code only: drop comments so prose about the old bug doesn't count.
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// `onboardingPhase: 'x'`, `.onboardingPhase = 'x'`, `onboardingPhase === 'x'`.
const FIELD_LITERAL = /\bonboardingPhase\s*(?::|=|===|!==|==|!=)\s*['"`]([^'"`]+)['"`]/g;
// In files that handle the phase: `phase === 'x'`, `phaseRef.current !== 'x'`, `advancePhase('x')`.
const PHASE_VAR_LITERAL = /\b\w*[pP]hase(?:Ref\.current)?\s*(?:===|!==|==|!=)\s*['"`]([^'"`]+)['"`]|\badvancePhase\(\s*['"`]([^'"`]+)['"`]/g;

type Hit = { file: string; literal: string };

function phaseLiterals(): Hit[] {
    const hits: Hit[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
        const code = stripComments(readFileSync(join(ROOT, file), 'utf8'));
        for (const m of code.matchAll(FIELD_LITERAL)) hits.push({ file, literal: m[1] });
        if (/onboardingPhase|OnboardingPhase/.test(code)) {
            for (const m of code.matchAll(PHASE_VAR_LITERAL)) hits.push({ file, literal: m[1] ?? m[2] });
        }
    }
    return hits;
}

describe('source scan: onboardingPhase literals', () => {
    const hits = phaseLiterals();

    it('finds the known writers and readers (scan is not vacuous)', () => {
        const files = new Set(hits.map((h) => h.file));
        expect(files).toContain('src/hooks/use-onboarding-progress.ts');
        expect(files).toContain('src/app/onboarding/page.tsx');
    });

    it('every literal is a canonical phase', () => {
        const offenders = hits.filter((h) => !isOnboardingPhase(h.literal));
        expect(offenders).toEqual([]);
    });

    it('the wizard finish writes ONBOARDING_FINISHED_PHASE', () => {
        const page = readFileSync(join(ROOT, 'src/app/onboarding/page.tsx'), 'utf8');
        expect(page).toMatch(/onboardingPhase:\s*ONBOARDING_FINISHED_PHASE/);
    });
});
