import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonPlan } from '@/features/lesson-planner/hooks/use-lesson-plan';
/* import { useAuth } from '@/context/auth-context'; // Not needed if mocked */
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { useToast } from '@/hooks/use-toast';
import { checkRateLimit, validateTopicSafety } from '@/lib/safety';
import { getCache, saveCache } from '@/lib/indexed-db';
import { getCachedLessonPlan } from '@/lib/api/lesson-plan';
import { useSearchParams } from 'next/navigation';

// Mocks
jest.mock('@/ai/flows/lesson-plan-generator');
jest.mock('@/hooks/use-toast');
jest.mock('@/lib/safety');
jest.mock('@/lib/indexed-db');
jest.mock('@/lib/api/lesson-plan');
// Critical: Mock the internal firebase-admin wrapper to stop it from loading 'firebase-admin' (server-only)
// which loads 'jose' (ESM) and crashes Jest.
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(),
    getAuthInstance: jest.fn(),
    getStorageInstance: jest.fn(),
}));

jest.mock('@/components/example-prompts', () => ({
    ExamplePrompts: () => null
}));
jest.mock('@/lib/api/telemetry', () => ({
    syncTelemetryEvents: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));
// Mock Auth Context
jest.mock('@/context/auth-context', () => ({
    useAuth: jest.fn().mockReturnValue({
        user: { uid: 'test-user', email: 'test@example.com' },
        loading: false,
        requireAuth: jest.fn().mockReturnValue(true),
        openAuthModal: jest.fn(),
    })
}));

jest.mock('@/hooks/use-analytics', () => ({
    useAnalytics: jest.fn().mockReturnValue({
        trackContent: jest.fn(),
        trackFeature: jest.fn(),
        trackFriction: jest.fn(),
    })
}));

// Mock Next Navigation
jest.mock('next/navigation', () => ({
    useSearchParams: jest.fn().mockReturnValue({ get: jest.fn().mockReturnValue(null) }),
    useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
    usePathname: jest.fn().mockReturnValue('/mock-path')
}));

describe('useLessonPlan Hook', () => {
    const mockToast = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
        (validateTopicSafety as jest.Mock).mockReturnValue({ safe: true });
        (generateLessonPlan as jest.Mock).mockResolvedValue({ title: 'Mock Plan' });
        (getCache as jest.Mock).mockResolvedValue(null);
        (getCachedLessonPlan as jest.Mock).mockResolvedValue(null);

        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ title: 'Mock Plan' }),
            })
        ) as jest.Mock;
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useLessonPlan());
        expect(result.current.lessonPlan).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('should handle successful submission', async () => {
        const { result } = renderHook(() => useLessonPlan());

        await act(async () => {
            await result.current.onSubmit({
                topic: 'Solar System',
                language: 'en',
                gradeLevels: ['5th Grade'],
                imageDataUri: ''
            });
        });



        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/ai/lesson-plan'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Solar System')
            })
        );
        expect(result.current.lessonPlan).toEqual({ title: 'Mock Plan' });
        expect(result.current.isLoading).toBe(false);
    }, 10000); // Extended timeout for "UX Pause" in hook

    it('should block submission if rate limit exceeded', async () => {
        (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, waitTime: 60000 });
        const { result } = renderHook(() => useLessonPlan());

        await act(async () => {
            await result.current.onSubmit({ topic: 'Topic', language: 'en', gradeLevels: [], imageDataUri: '' });
        });

        expect(generateLessonPlan).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: expect.stringContaining('Slow Down')
        }));
    });

    it('should block submission if topic is unsafe', async () => {
        (validateTopicSafety as jest.Mock).mockReturnValue({ safe: false });
        const { result } = renderHook(() => useLessonPlan());

        await act(async () => {
            await result.current.onSubmit({ topic: 'Bomb', language: 'en', gradeLevels: [], imageDataUri: '' });
        });

        expect(generateLessonPlan).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Topic Rejected'
        }));
    });

    it('should use local cache if available', async () => {
        (getCache as jest.Mock).mockResolvedValue({ title: 'Cached Plan' });
        const { result } = renderHook(() => useLessonPlan());

        await act(async () => {
            await result.current.onSubmit({ topic: 'Cached', language: 'en', gradeLevels: [], imageDataUri: '' });
        });

        expect(getCache).toHaveBeenCalled();
        // Wait for the simulated cache timeout
        await waitFor(() => {
            expect(result.current.lessonPlan).toEqual({ title: 'Cached Plan' });
        });
        expect(generateLessonPlan).not.toHaveBeenCalled();
    });

    it('should select a template correctly', () => {
        const { result } = renderHook(() => useLessonPlan());

        act(() => {
            result.current.handleTemplateSelect({
                id: 'template-1',
                title: 'Space Template',
                titleHindi: 'अंतरिक्ष टेम्पलेट',
                topic: 'The Moon',
                gradeLevel: '4th Grade',
                subject: 'Science',
                icon: 'moon',
                color: 'blue'
            } as any);
        });

        expect(result.current.form.getValues().topic).toBe('The Moon');
        expect(result.current.form.getValues().gradeLevels).toEqual(['4th Grade']);
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Template Selected'
        }));
    });

    it('should handle prompt clicks', () => {
        const { result } = renderHook(() => useLessonPlan());
        act(() => {
            result.current.handlePromptClick('New Topic Prompt');
        });
        expect(result.current.form.getValues().topic).toBe('New Topic Prompt');
    });

    it('should handle transcript updates', () => {
        const { result } = renderHook(() => useLessonPlan());
        act(() => {
            result.current.handleTranscript('Spoken Topic');
        });
        expect(result.current.form.getValues().topic).toBe('Spoken Topic');
    });

    it('should detect offline mode', () => {
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

        const { result } = renderHook(() => useLessonPlan());

        // Trigger useEffect
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });

        expect(result.current.isOffline).toBe(true);
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'You are Offline'
        }));
    });

    // ── NCERT-demo 2026-05-19 regression suite ───────────────────────────
    // These tests pin the three bugs the founder hit minutes before the
    // NCERT demo. If any of them fail again the demo is in trouble.
    describe('VIDYA → form pre-fill (NCERT-demo regression)', () => {
        const buildSearchParamsMock = (params: Record<string, string | null>) => ({
            get: jest.fn((key: string) => params[key] ?? null),
        });

        beforeEach(() => {
            // Reset navigator.onLine in case a prior test toggled it.
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
        });

        it('pre-fills topic, gradeLevels, subject AND language from URL params', async () => {
            (useSearchParams as jest.Mock).mockReturnValue(
                buildSearchParamsMock({
                    topic: 'Chapter 2',
                    gradeLevel: 'Class 7',
                    subject: 'Science',
                    language: 'en',
                }),
            );

            const { result } = renderHook(() => useLessonPlan());

            // setTimeout in the hook fires the auto-submit at 300ms.
            // Assert form state BEFORE that to verify pre-fill landed.
            await waitFor(() => {
                expect(result.current.form.getValues().topic).toBe('Chapter 2');
            });
            const values = result.current.form.getValues();
            expect(values.gradeLevels).toEqual(['Class 7']);
            expect(values.subject).toBe('Science');
            expect(values.language).toBe('en');
        });

        it('normalises VIDYA display-name language ("English") into the ISO code the selector expects', async () => {
            (useSearchParams as jest.Mock).mockReturnValue(
                buildSearchParamsMock({
                    topic: 'Chapter 2',
                    gradeLevel: 'Class 7',
                    subject: 'Science',
                    language: 'English', // display name — used to break the dropdown
                }),
            );

            const { result } = renderHook(() => useLessonPlan());
            await waitFor(() => {
                expect(result.current.form.getValues().topic).toBe('Chapter 2');
            });
            expect(result.current.form.getValues().language).toBe('en');
        });

        it('normalises grade-level variants ("7", "7th Grade", "grade 7") to "Class 7"', async () => {
            (useSearchParams as jest.Mock).mockReturnValue(
                buildSearchParamsMock({
                    topic: 'Chapter 2',
                    gradeLevel: '7th Grade',
                    subject: 'Science',
                    language: 'en',
                }),
            );

            const { result } = renderHook(() => useLessonPlan());
            await waitFor(() => {
                expect(result.current.form.getValues().gradeLevels).toEqual(['Class 7']);
            });
        });
    });

    describe('language forwarding (NCERT-demo regression)', () => {
        it('always sends explicit language in the POST body even if profile preferredLanguage is Hindi', async () => {
            const fetchSpy = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ title: 'Mock Plan' }),
                }),
            ) as jest.Mock;
            global.fetch = fetchSpy;

            const { result } = renderHook(() => useLessonPlan());

            await act(async () => {
                // Mimic the form: user picked English in the dropdown,
                // even though their profile.preferredLanguage might be 'Hindi'.
                await result.current.onSubmit({
                    topic: 'Chapter 2',
                    language: 'en',
                    gradeLevels: ['Class 7'],
                    subject: 'Science',
                    imageDataUri: '',
                });
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/ai/lesson-plan'),
                expect.objectContaining({
                    body: expect.stringContaining('"language":"en"'),
                }),
            );
        });

        it('defaults to "en" when the form submits with an empty language string', async () => {
            const fetchSpy = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ title: 'Mock Plan' }),
                }),
            ) as jest.Mock;
            global.fetch = fetchSpy;

            const { result } = renderHook(() => useLessonPlan());

            await act(async () => {
                await result.current.onSubmit({
                    topic: 'Chapter 2',
                    language: '', // edge case — should NOT silently fall back to profile
                    gradeLevels: ['Class 7'],
                    subject: 'Science',
                    imageDataUri: '',
                });
            });

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(callBody.language).toBe('en');
        });

        it('strips the "General" placeholder subject so the model is not misled', async () => {
            const fetchSpy = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ title: 'Mock Plan' }),
                }),
            ) as jest.Mock;
            global.fetch = fetchSpy;

            const { result } = renderHook(() => useLessonPlan());

            await act(async () => {
                await result.current.onSubmit({
                    topic: 'Chapter 2',
                    language: 'en',
                    gradeLevels: ['Class 7'],
                    subject: 'General', // form-level default — must NOT reach API
                    imageDataUri: '',
                });
            });

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(callBody.subject).toBeUndefined();
        });

        it('forwards an explicit subject ("Science") untouched', async () => {
            const fetchSpy = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ title: 'Mock Plan' }),
                }),
            ) as jest.Mock;
            global.fetch = fetchSpy;

            const { result } = renderHook(() => useLessonPlan());

            await act(async () => {
                await result.current.onSubmit({
                    topic: 'Chapter 2',
                    language: 'en',
                    gradeLevels: ['Class 7'],
                    subject: 'Science',
                    imageDataUri: '',
                });
            });

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
            expect(callBody.subject).toBe('Science');
        });
    });
});
