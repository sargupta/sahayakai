/**
 * useRubricGenerator — VIDYA deep link + saved-rubric restore.
 *
 * Two defects, both confirmed on the live bundle:
 *
 *   1. Every producer navigates to `/rubric-generator?topic=...` (the intent
 *      route and the agent router share one query string across all nine
 *      flows), but the hook only read `?assignmentDescription=`. The pre-fill
 *      branch never ran, so the teacher landed on an empty form and the
 *      300 ms auto-submit never fired.
 *
 *   2. Restoring `?id=` called `form.reset()` with no `subject` key. RHF's
 *      reset replaces the entire form state, so Subject was wiped; the same
 *      payload wrote the language DISPLAY name the flow persists ("English")
 *      into a Select whose options are ISO codes, blanking that control too.
 *
 * The restore assertions are written field-agnostically — they walk the Zod
 * schema rather than a hand-written list — so adding a field to the form
 * without teaching the restore about it fails here rather than in a
 * teacher's hands.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import { formSchema } from '@/features/rubric-generator/types';
import { useRubricGenerator } from '@/features/rubric-generator/hooks/use-rubric-generator';

const generate = jest.fn();
const setResult = jest.fn();

jest.mock('next/navigation', () => ({
    useSearchParams: jest.fn(),
}));
jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: { uid: 'test-user', getIdToken: async () => 'test-token' } }),
}));
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s, language: 'English' }),
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/hooks/use-network-aware', () => ({
    useNetworkAware: () => ({ canUseAI: true, aiUnavailableReason: null }),
}));
// The store and the snapshot sync are exercised by their own suites; this one
// is about URL → form state, so keep localStorage and Zustand out of it.
jest.mock('@/hooks/use-vidya-form-sync', () => ({ useVidyaFormSync: () => null }));
jest.mock('@/store/jarvisStore', () => ({
    useJarvisStore: () => ({ clearFormSnapshot: jest.fn() }),
}));
// Same reasoning as use-exam-paper.test.ts: the generator spine has its own
// suite, so stub it and observe only whether this hook asked it to run.
jest.mock('@/features/generator', () => ({
    useGenerator: () => ({
        generate,
        setResult,
        reset: jest.fn(),
        isGenerating: false,
        status: 'idle',
        result: null,
        limitState: null,
        error: null,
    }),
}));

/** Stand-in for ReadonlyURLSearchParams over a fixed param map. */
function mockSearchParams(params: Record<string, string> = {}) {
    (useSearchParams as jest.Mock).mockReturnValue({
        get: (key: string) => params[key] ?? null,
    });
}

/** Every field the form schema declares. */
const SCHEMA_FIELDS = Object.keys(formSchema.shape) as (keyof typeof formSchema.shape)[];

/** The ISO codes <LanguageSelector> offers as <SelectItem> values. */
const SELECTABLE_LANGUAGES = [
    'all', 'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'pa', 'ml', 'or', 'kn',
];

/** A saved rubric as /api/content/get returns it (language is a display name). */
const SAVED_RUBRIC = {
    topic: 'Solar system model built from waste materials',
    title: 'Rubric: Solar system model',
    gradeLevel: 'Class 8',
    subject: 'Science',
    language: 'English',
    data: { title: 'Solar system model', description: 'x', criteria: [] },
};

describe('useRubricGenerator — VIDYA deep link', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockSearchParams();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // The name the producers actually emit. This is the regression.
    it('pre-fills the assignment from ?topic=', () => {
        mockSearchParams({ topic: 'Write a formal letter to the editor about plastic waste' });

        const { result } = renderHook(() => useRubricGenerator());

        expect(result.current.form.getValues('assignmentDescription')).toBe(
            'Write a formal letter to the editor about plastic waste',
        );
    });

    it('auto-submits a ?topic= deep link', async () => {
        mockSearchParams({ topic: 'Write a formal letter to the editor about plastic waste' });

        renderHook(() => useRubricGenerator());
        // handleSubmit resolves through zod validation, so drain microtasks
        // as well as the 300 ms timer.
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(generate).toHaveBeenCalledTimes(1);
        expect(generate.mock.calls[0][0]).toMatchObject({
            assignmentDescription: 'Write a formal letter to the editor about plastic waste',
        });
    });

    it('normalises gradeLevel and language arriving in display form', () => {
        mockSearchParams({
            topic: 'Build a working model of the solar system and present it',
            gradeLevel: '8th Grade',
            subject: 'Science',
            language: 'English',
        });

        const { result } = renderHook(() => useRubricGenerator());

        expect(result.current.form.getValues('gradeLevel')).toBe('Class 8');
        expect(result.current.form.getValues('subject')).toBe('Science');
        expect(result.current.form.getValues('language')).toBe('en');
    });

    // The OmniOrb supervisor emits this richer name for the rubric flow only
    // (src/ai/soul.ts), and those URLs are already in teachers' histories.
    it('still honours ?assignmentDescription= from the OmniOrb supervisor', () => {
        mockSearchParams({ assignmentDescription: 'Design a poster on Every Drop Counts' });

        const { result } = renderHook(() => useRubricGenerator());

        expect(result.current.form.getValues('assignmentDescription')).toBe(
            'Design a poster on Every Drop Counts',
        );
    });

    it('prefers assignmentDescription when the supervisor sends both', () => {
        mockSearchParams({
            topic: 'water',
            assignmentDescription: 'Design a poster on Every Drop Counts with a slogan',
        });

        const { result } = renderHook(() => useRubricGenerator());

        expect(result.current.form.getValues('assignmentDescription')).toBe(
            'Design a poster on Every Drop Counts with a slogan',
        );
    });
});

describe('useRubricGenerator — restore from ?id=', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams({ id: 'rubric-123' });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => SAVED_RUBRIC,
        }) as unknown as typeof fetch;
    });

    async function restore() {
        const { result } = renderHook(() => useRubricGenerator());
        await waitFor(() => expect(setResult).toHaveBeenCalled());
        return result;
    }

    it('restores the assignment, class and subject', async () => {
        const result = await restore();

        expect(result.current.form.getValues('assignmentDescription')).toBe(SAVED_RUBRIC.topic);
        expect(result.current.form.getValues('gradeLevel')).toBe('Class 8');
        expect(result.current.form.getValues('subject')).toBe('Science');
    });

    // Class gate: reset() replaces the whole form state, so ANY schema field
    // the payload forgets comes back undefined. Assert over the schema, not
    // over the fields we happen to remember today.
    it('leaves no schema field undefined after a restore', async () => {
        const result = await restore();
        const values = result.current.form.getValues() as Record<string, unknown>;

        const blanked = SCHEMA_FIELDS.filter((f) => values[f] === undefined || values[f] === '');
        expect(blanked).toEqual([]);
    });

    // Class gate: the saved record speaks display names because
    // generateRubric() runs normalizeLanguage() before persisting. Whatever
    // lands in the form must still be a value the selector can render.
    it('writes a language the selector can actually render', async () => {
        const result = await restore();

        expect(SELECTABLE_LANGUAGES).toContain(result.current.form.getValues('language'));
    });

    // A record written before a column existed must not blank the control it
    // has nothing to say about.
    it('keeps the current value for a field the saved record omits', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ ...SAVED_RUBRIC, subject: undefined, gradeLevel: undefined }),
        });

        const result = await restore();

        expect(result.current.form.getValues('subject')).toBe('General');
        expect(result.current.form.getValues('gradeLevel')).toBe('Class 7');
    });

    // The restore ran behind a ref claimed for the lifetime of the mount, so
    // opening a second saved rubric from the Library while already on this
    // page — a query-only push, no remount — was dropped.
    it('refetches when a different ?id= arrives without a remount', async () => {
        const { rerender } = renderHook(() => useRubricGenerator());
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        mockSearchParams({ id: 'rubric-456' });
        await act(async () => {
            rerender();
        });

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
        expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('rubric-456');
    });
});

/**
 * A SECOND VIDYA request while the teacher is already standing here.
 *
 * Same defect and same reachability as use-worksheet-wizard.test.ts: the
 * OmniOrb is mounted in the app shell, executeAction ends in a client-side
 * router.push, and src/app/rubric-generator/page.tsx wraps its content in an
 * unkeyed <Suspense>. A second rubric request therefore changes the query
 * without remounting, and a guard keyed to the mount returns early — leaving
 * the teacher looking at the answer to the request before last.
 *
 * Class gate stated over the param list, not over `topic`: every param the
 * effect reads must take part in the guard key.
 */
describe('useRubricGenerator — a second deep link, same mount', () => {
    /** What the teacher asked for first. */
    const FIRST = { topic: 'Write a formal letter to the editor about plastic waste' };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockSearchParams();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    /** Arrive on FIRST, then have VIDYA push `second` into the same mount. */
    async function thenAsksFor(second: Record<string, string>) {
        mockSearchParams(FIRST);
        const { result, rerender } = renderHook(() => useRubricGenerator());
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(result.current.form.getValues('assignmentDescription')).toBe(FIRST.topic);

        // Two acts, not one: effects flush at the END of act, so advancing
        // the clock in the same act would run before the second link had
        // scheduled its timer.
        mockSearchParams(second);
        await act(async () => {
            rerender();
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        return result;
    }

    it('honours the whole second param set, and generates from it', async () => {
        const result = await thenAsksFor({
            topic: 'Build a working model of the solar system and present it',
            subject: 'Science',
            gradeLevel: '8th Grade',
        });

        expect(result.current.form.getValues('assignmentDescription')).toBe(
            'Build a working model of the solar system and present it',
        );
        expect(result.current.form.getValues('subject')).toBe('Science');
        expect(result.current.form.getValues('gradeLevel')).toBe('Class 8');
        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0]).toMatchObject({
            assignmentDescription: 'Build a working model of the solar system and present it',
            subject: 'Science',
            gradeLevel: 'Class 8',
        });
    });

    // Class gate: one row per param the effect reads.
    it.each([
        [
            'topic',
            { topic: 'Build a working model of the solar system and present it' },
            'assignmentDescription',
            'Build a working model of the solar system and present it',
        ],
        [
            'assignmentDescription',
            { ...FIRST, assignmentDescription: 'Design a poster on Every Drop Counts' },
            'assignmentDescription',
            'Design a poster on Every Drop Counts',
        ],
        ['subject', { ...FIRST, subject: 'Science' }, 'subject', 'Science'],
        ['gradeLevel', { ...FIRST, gradeLevel: '8th Grade' }, 'gradeLevel', 'Class 8'],
        ['language', { ...FIRST, language: 'Bengali' }, 'language', 'bn'],
    ] as [
        string,
        Record<string, string>,
        'assignmentDescription' | 'subject' | 'gradeLevel' | 'language',
        string,
    ][])('honours a second link that differs only in ?%s=', async (_param, second, field, expected) => {
        const result = await thenAsksFor(second);

        expect(result.current.form.getValues(field)).toBe(expected);
    });

    // The other half of the contract: a re-render carrying identical params
    // must still run once. Next hands back a fresh ReadonlyURLSearchParams on
    // every render and that identity change is in this effect's deps.
    it('does not re-apply an identical param set over what the teacher typed', async () => {
        mockSearchParams(FIRST);
        const { result, rerender } = renderHook(() => useRubricGenerator());
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        act(() => {
            result.current.form.setValue(
                'assignmentDescription',
                'Write a formal letter to the editor about plastic waste, 150 words',
            );
        });

        // Same params, new object — exactly what a re-render looks like.
        mockSearchParams(FIRST);
        await act(async () => {
            rerender();
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current.form.getValues('assignmentDescription')).toBe(
            'Write a formal letter to the editor about plastic waste, 150 words',
        );
        expect(generate).toHaveBeenCalledTimes(1);
    });
});
