/**
 * useWorksheetWizard — VIDYA deep link, auto-submit gate, restore guard.
 *
 * Teaching this page to read `?topic=` turned a pre-fill branch that had
 * never executed into live code, and the 300 ms auto-submit sitting inside
 * it came along with it. Worksheet is the one deep-link destination whose
 * schema demands an upload (types.ts: `imageDataUri`, min 1, "Please upload
 * an image."), `defaultValues` has no such key, and no producer can put a
 * photo of a textbook page in a query string. Rendering the hook with the
 * params VIDYA actually sends therefore ran handleSubmit straight into the
 * resolver: generate never called, submitCount 1, and a red "Please upload
 * an image." across a form the teacher had not touched. No AI spend, but
 * every voice worksheet request and every community "Use this" landed on it.
 *
 * The class gate is `never runs the auto-submit into a rejection`: it holds
 * submitCount equal to the number of generator calls and checks what was
 * submitted against the Zod schema, rather than naming `imageDataUri`. A
 * second required field added to this form with no URL source fails there
 * too, instead of reaching a teacher.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import { formSchema } from '@/features/worksheet-wizard/types';
import { useWorksheetWizard } from '@/features/worksheet-wizard/hooks/use-worksheet-wizard';

const generate = jest.fn();
const setResult = jest.fn();

jest.mock('next/navigation', () => ({
    useSearchParams: jest.fn(),
}));
jest.mock('@/lib/firebase', () => ({
    auth: { currentUser: { uid: 'test-user', getIdToken: async () => 'test-token' } },
}));
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s, language: 'English' }),
}));
// The real useToast hands back a module-level `toast` function, so its
// identity is stable across renders; keep that here or this hook's effect
// would re-run for a reason production never sees.
const toast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
jest.mock('@/hooks/use-network-aware', () => ({
    useNetworkAware: () => ({ canUseAI: true, aiUnavailableReason: null }),
}));
// The snapshot sync and the store have their own suites; this one is about
// URL → form state, so keep localStorage and Zustand out of it.
jest.mock('@/hooks/use-vidya-form-sync', () => ({ useVidyaFormSync: () => null }));
jest.mock('@/store/jarvisStore', () => ({
    useJarvisStore: () => ({ clearFormSnapshot: jest.fn() }),
}));
// Same reasoning as use-exam-paper.test.ts: the generator spine is exercised
// by its own suite, so stub it and observe only whether this hook asked it
// to run.
jest.mock('@/features/generator', () => ({
    MalformedResponseError: class MalformedResponseError extends Error {},
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

/**
 * Render the hook the way the page does.
 *
 * React Hook Form only re-renders — and only refreshes the `formState`
 * snapshot a caller holds — for the keys something actually subscribed to.
 * The page subscribes by rendering <FormMessage>, which reads `errors`; a
 * bare renderHook does not, and then `formState` reports the values from
 * first render forever and any assertion on it passes vacuously. Touch the
 * two keys this suite asserts on so the snapshot tracks, exactly as the
 * reviewer's instrumented render did.
 */
function renderWorksheetWizard() {
    return renderHook(() => {
        const hook = useWorksheetWizard();
        void hook.form.formState.errors;
        void hook.form.formState.submitCount;
        return hook;
    });
}

/** A 1x1 PNG — stands in for the page the teacher photographs. */
const IMAGE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** The exact link the reviewer rendered the hook with. */
const REVIEWER_LINK = { topic: 'Fractions practice for class 5 students' };

/** Every param set a producer can put in the URL for this flow. */
const DEEP_LINKS: Record<string, string>[] = [
    REVIEWER_LINK,
    // The legacy alias the page used to read, kept for URLs already in history.
    { prompt: 'Fractions practice for class 5 students' },
    // The full shared query string: intent route, agent router, community feed.
    {
        topic: 'Photosynthesis practice questions for revision',
        gradeLevel: '5th Grade',
        subject: 'Science',
        language: 'English',
    },
];

describe('useWorksheetWizard — VIDYA deep link', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockSearchParams();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Pre-fill is the useful half and stays. The teacher arrives with the
    // prompt already written; all that is left is the photo.
    it('pre-fills the prompt from ?topic=', () => {
        mockSearchParams(REVIEWER_LINK);

        const { result } = renderWorksheetWizard();

        expect(result.current.form.getValues('prompt')).toBe(REVIEWER_LINK.topic);
    });

    it('normalises gradeLevel and language arriving in display form', () => {
        mockSearchParams(DEEP_LINKS[2]);

        const { result } = renderWorksheetWizard();

        expect(result.current.form.getValues('gradeLevel')).toBe('Class 5');
        expect(result.current.form.getValues('subject')).toBe('Science');
        expect(result.current.form.getValues('language')).toBe('en');
    });

    // The regression, at the reviewer's exact input.
    it('does not submit a deep link that carries no image', async () => {
        mockSearchParams(REVIEWER_LINK);

        const { result } = renderWorksheetWizard();
        // handleSubmit resolves through zod, so drain microtasks as well as
        // the 300 ms timer.
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(generate).not.toHaveBeenCalled();
        expect(result.current.form.formState.submitCount).toBe(0);
    });

    it('leaves the teacher a clean form rather than a validation error', async () => {
        mockSearchParams(REVIEWER_LINK);

        const { result } = renderWorksheetWizard();
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current.form.formState.errors).toEqual({});
    });

    // Once the photo is there the deep link is complete, so the free run the
    // auto-submit exists for still happens. The value is read inside the
    // timer, so an upload that lands within those 300 ms counts.
    it('auto-submits once the image is present', async () => {
        mockSearchParams(REVIEWER_LINK);

        const { result } = renderWorksheetWizard();
        act(() => {
            result.current.form.setValue('imageDataUri', IMAGE, { shouldValidate: true });
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(generate).toHaveBeenCalledTimes(1);
        expect(result.current.form.formState.submitCount).toBe(1);
        expect(generate.mock.calls[0][0]).toMatchObject({
            prompt: REVIEWER_LINK.topic,
            imageDataUri: IMAGE,
        });
    });

    // Class gate. Stated over the schema rather than over `imageDataUri`, so
    // a second required field added to this form with no URL source cannot
    // bring the same failure back through a different door.
    //
    // A submit that never reaches the generator is a submit the resolver
    // rejected, and a rejected submit is a red error on an untouched form.
    // So the auto-submit must either reach the generator with values the
    // schema accepts, or not fire at all: submitCount tracks generate calls
    // exactly.
    it.each(DEEP_LINKS)('never runs the auto-submit into a rejection: %o', async (params) => {
        mockSearchParams(params);

        const { result } = renderWorksheetWizard();
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current.form.formState.submitCount).toBe(generate.mock.calls.length);
        for (const [values] of generate.mock.calls) {
            expect(formSchema.safeParse(values).success).toBe(true);
        }
    });
});

describe('useWorksheetWizard — restore from ?id=', () => {
    const SAVED_WORKSHEET = {
        topic: 'Fractions practice',
        title: 'Worksheet: Fractions',
        gradeLevel: 'Class 5',
        subject: 'Mathematics',
        language: 'English',
        data: { worksheetContent: '# Fractions\n\n1. 1/2 + 1/4 = ?' },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams({ id: 'worksheet-123' });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => SAVED_WORKSHEET,
        }) as unknown as typeof fetch;
    });

    it('restores the saved markdown body', async () => {
        renderWorksheetWizard();

        await waitFor(() =>
            expect(setResult).toHaveBeenCalledWith(SAVED_WORKSHEET.data.worksheetContent),
        );
    });

    // Next.js hands back a fresh ReadonlyURLSearchParams object on every
    // render, and that identity change is in this effect's dependency array.
    // Without the hasLoaded ref the restore refetches and resets the form over
    // whatever the teacher has typed since. use-rubric-generator.ts already
    // carried this guard; worksheet did not.
    it('runs the restore once across re-renders', async () => {
        const { rerender } = renderWorksheetWizard();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        mockSearchParams({ id: 'worksheet-123' });
        await act(async () => {
            rerender();
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // The same defect as the deep-link suite below, seen from the restore
    // side: opening a second saved worksheet from the Library while already
    // on this page is a query-only push, so a mount-scoped guard swallowed it
    // and the page went on showing the record opened before.
    it('refetches when a different ?id= arrives without a remount', async () => {
        const { rerender } = renderWorksheetWizard();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        mockSearchParams({ id: 'worksheet-456' });
        await act(async () => {
            rerender();
        });

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
        expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('worksheet-456');
    });
});

/**
 * A SECOND VIDYA request while the teacher is already standing here.
 *
 * The restore guard added with the auto-submit fix was a bare boolean claimed
 * for the lifetime of the MOUNT. Nothing remounts this page between two voice
 * requests: the OmniOrb lives in the app shell (src/app/app-shell.tsx),
 * executeAction ends in a client-side router.push (src/components/omni-orb.tsx),
 * and src/app/worksheet-wizard/page.tsx wraps the content in an unkeyed
 * <Suspense>. So the query changes, useSearchParams updates, the effect
 * re-fires — and the mount-scoped guard returns early. Measured on the hook
 * as shipped: after asking for Photosynthesis the prompt was still "Fractions
 * for class 5", with subject "General" and gradeLevel "Class 4", i.e. the
 * second link never ran at all.
 *
 * The class gate is stated over the param list, not over `topic`: EVERY param
 * the effect reads has to take part in the guard key, so a param added to the
 * effect and forgotten in DEEP_LINK_PARAMS fails here rather than silently
 * making links that differ only in that param look already-handled.
 */
describe('useWorksheetWizard — a second deep link, same mount', () => {
    /** What the teacher asked for first. */
    const FIRST = { topic: 'Fractions for class 5' };

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
        const { result, rerender } = renderWorksheetWizard();
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(result.current.form.getValues('prompt')).toBe(FIRST.topic);

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

    it('honours the whole second param set', async () => {
        const result = await thenAsksFor({
            topic: 'Photosynthesis practice questions',
            subject: 'Science',
            gradeLevel: 'Class 7',
        });

        expect(result.current.form.getValues('prompt')).toBe('Photosynthesis practice questions');
        expect(result.current.form.getValues('subject')).toBe('Science');
        expect(result.current.form.getValues('gradeLevel')).toBe('Class 7');
    });

    // Class gate: one row per param the effect reads.
    it.each([
        ['topic', { topic: 'Photosynthesis practice questions' }, 'prompt', 'Photosynthesis practice questions'],
        ['subject', { ...FIRST, subject: 'Science' }, 'subject', 'Science'],
        ['gradeLevel', { ...FIRST, gradeLevel: '7th Grade' }, 'gradeLevel', 'Class 7'],
        ['language', { ...FIRST, language: 'Bengali' }, 'language', 'bn'],
    ] as [string, Record<string, string>, 'prompt' | 'subject' | 'gradeLevel' | 'language', string][])(
        'honours a second link that differs only in ?%s=',
        async (_param, second, field, expected) => {
            const result = await thenAsksFor(second);

            expect(result.current.form.getValues(field)).toBe(expected);
        },
    );

    // The other half of the contract, and the reason the guard exists at all.
    // Next hands back a fresh ReadonlyURLSearchParams on every render, and
    // that identity change is in this effect's dependency array.
    it('does not re-apply an identical param set over what the teacher typed', async () => {
        mockSearchParams(FIRST);
        const { result, rerender } = renderWorksheetWizard();
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        act(() => {
            result.current.form.setValue('prompt', 'Fractions for class 5, with word problems');
        });

        // Same params, new object — exactly what a re-render looks like.
        mockSearchParams(FIRST);
        await act(async () => {
            rerender();
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current.form.getValues('prompt')).toBe(
            'Fractions for class 5, with word problems',
        );
    });
});
