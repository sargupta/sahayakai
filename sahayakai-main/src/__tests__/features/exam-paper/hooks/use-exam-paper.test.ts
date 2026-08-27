/**
 * useExamPaper — subject field regressions.
 *
 * Founder bug 2026-08-25, proved live on WBBSE Class 10: the blueprint
 * defaulting effect listed `subject` in its dependency array while also
 * writing `subject`, so every keystroke in the free-text subject field
 * re-ran the effect and the "no blueprint for this board" branch wiped what
 * had just been typed. Subject stayed empty, and Generate — disabled while
 * `!subject` — could never be pressed. The same override replaced a VIDYA
 * `?subject=History` deep link with the first blueprint subject.
 *
 * The class gate is the board sweep at the bottom: EVERY board/grade pair
 * the picker offers must let a typed subject survive, so a future board (or
 * a future blueprint added to / removed from an existing one) cannot bring
 * the wipe back for one combination while the CBSE happy path stays green.
 */

import { renderHook, act } from '@testing-library/react';
import { useExamPaper } from '@/features/exam-paper/hooks/use-exam-paper';
import { useSearchParams } from 'next/navigation';
import { EDUCATION_BOARDS } from '@/types';
import { GRADE_OPTIONS } from '@/features/exam-paper/types';

// Firebase auth: the hook only gates rendering on it. Report "signed out"
// so the profile lookup (preferred-board defaulting) never fires.
jest.mock('@/lib/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
        cb(null);
        return () => {};
    },
}));
jest.mock('@/lib/api/profile', () => ({
    getProfileData: jest.fn().mockResolvedValue({ profile: null }),
}));
jest.mock('@/lib/get-auth-token', () => ({
    getAuthToken: jest.fn().mockResolvedValue('test-token'),
}));
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s }),
}));
jest.mock('@/hooks/use-network-aware', () => ({
    useNetworkAware: () => ({ canUseAI: true, aiUnavailableReason: null }),
}));
// The generator spine is exercised by its own suite; this one is about form
// state, so stub it rather than pull in fetch/abort machinery.
jest.mock('@/features/generator', () => ({
    MalformedResponseError: class MalformedResponseError extends Error {},
    useGenerator: () => ({
        generate: jest.fn(),
        reset: jest.fn(),
        isGenerating: false,
        status: 'idle',
        result: null,
        limitState: null,
        error: null,
    }),
}));
jest.mock('next/navigation', () => ({
    useSearchParams: jest.fn(),
}));

/** Stand-in for URLSearchParams over a fixed param map. */
function mockSearchParams(params: Record<string, string> = {}) {
    (useSearchParams as jest.Mock).mockReturnValue({
        get: (key: string) => params[key] ?? null,
    });
}

/** A board with no official blueprint — the free-text subject path. */
const WBBSE = 'West Bengal State Board (WBBSE)';

/** Type into the subject field the way React does: one commit per keystroke. */
function typeSubject(setSubject: (v: string) => void, value: string) {
    for (let i = 1; i <= value.length; i++) {
        act(() => setSubject(value.slice(0, i)));
    }
}

describe('useExamPaper — subject field', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams();
    });

    it('keeps a subject typed for a board with no blueprint', () => {
        const { result } = renderHook(() => useExamPaper());

        act(() => result.current.setBoard(WBBSE));
        expect(result.current.availableSubjects).toEqual([]); // free-text path

        typeSubject(result.current.setSubject, 'History');

        expect(result.current.subject).toBe('History');
    });

    it('leaves Generate reachable after typing a subject with no blueprint', () => {
        // The button is `disabled={generating || !subject || !canUseAI}`, so an
        // empty subject is the whole blocker the founder hit.
        const { result } = renderHook(() => useExamPaper());

        act(() => result.current.setBoard(WBBSE));
        typeSubject(result.current.setSubject, 'History');

        expect(result.current.subject).not.toBe('');
        expect(result.current.generating || !result.current.subject || !result.current.canUseAI).toBe(false);
    });

    it('honours a VIDYA ?subject= deep link over the blueprint default', () => {
        mockSearchParams({ subject: 'History' });

        const { result } = renderHook(() => useExamPaper());

        // CBSE Class 10 has blueprints for Mathematics and Science; neither
        // may quietly displace what VIDYA asked for.
        expect(result.current.subject).toBe('History');
        expect(result.current.availableSubjects).toContain('History');
    });

    it('still defaults the subject from the blueprint when the teacher has chosen nothing', () => {
        const { result } = renderHook(() => useExamPaper());

        expect(result.current.availableSubjects).toEqual(['Mathematics', 'Science']);
        expect(result.current.subject).toBe('Mathematics');
    });

    it('re-derives an unchosen default when the board changes', () => {
        const { result } = renderHook(() => useExamPaper());
        expect(result.current.subject).toBe('Mathematics');

        act(() => result.current.setBoard(WBBSE));

        // Nobody picked "Mathematics" — it came from the CBSE blueprint, and
        // that blueprint no longer applies.
        expect(result.current.subject).toBe('');
    });

    it('keeps a chosen subject when the teacher switches board', () => {
        const { result } = renderHook(() => useExamPaper());

        act(() => result.current.setSubject('Science'));
        act(() => result.current.setBoard(WBBSE));

        expect(result.current.subject).toBe('Science');
    });

    it('re-defaults after the teacher empties the subject field', () => {
        const { result } = renderHook(() => useExamPaper());

        act(() => result.current.setBoard(WBBSE));
        typeSubject(result.current.setSubject, 'History');
        act(() => result.current.setSubject('')); // teacher backspaces it away

        // An empty field is not a choice, so the blueprint may speak again.
        act(() => result.current.setBoard('CBSE'));

        expect(result.current.subject).toBe('Mathematics');
    });

    it('drops chapter chips picked under the previous board/grade', () => {
        const { result } = renderHook(() => useExamPaper());

        act(() => result.current.setChapters(['Real Numbers']));
        expect(result.current.chapters).toEqual(['Real Numbers']);

        act(() => result.current.setGradeLevel('Class 9'));

        // Class 10 chapters are not Class 9 chapters, and handleGenerate
        // prefers `chapters` over the free-text fallback.
        expect(result.current.chapters).toEqual([]);
    });

    // ── Class gate ─────────────────────────────────────────────────────────
    // Not "WBBSE Class 10 works" but "no board/grade the picker offers can
    // erase what the teacher typed", whatever the blueprint table holds.
    describe('class gate: no board/grade combination erases typed input', () => {
        const combinations = EDUCATION_BOARDS.flatMap((board) =>
            GRADE_OPTIONS.map((gradeLevel) => ({ board, gradeLevel })),
        );

        it.each(combinations)('$board / $gradeLevel keeps the typed subject', ({ board, gradeLevel }) => {
            const { result } = renderHook(() => useExamPaper());

            act(() => result.current.setBoard(board));
            act(() => result.current.setGradeLevel(gradeLevel));
            typeSubject(result.current.setSubject, 'Geography');

            expect(result.current.subject).toBe('Geography');
        });

        it.each(combinations)('$board / $gradeLevel keeps a deep-linked subject', ({ board, gradeLevel }) => {
            mockSearchParams({ subject: 'Geography' });
            const { result } = renderHook(() => useExamPaper());

            act(() => result.current.setBoard(board));
            act(() => result.current.setGradeLevel(gradeLevel));

            expect(result.current.subject).toBe('Geography');
        });
    });
});
