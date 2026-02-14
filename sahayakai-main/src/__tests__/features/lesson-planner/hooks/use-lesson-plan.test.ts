import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonPlan } from '@/features/lesson-planner/hooks/use-lesson-plan';
/* import { useAuth } from '@/context/auth-context'; // Not needed if mocked */
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { useToast } from '@/hooks/use-toast';
import { checkRateLimit, validateTopicSafety } from '@/lib/safety';
import { getCache, saveCache } from '@/lib/indexed-db';
import { getCachedLessonPlan } from '@/app/actions/lesson-plan';

// Mocks
jest.mock('@/ai/flows/lesson-plan-generator');
jest.mock('@/hooks/use-toast');
jest.mock('@/lib/safety');
jest.mock('@/lib/indexed-db');
jest.mock('@/app/actions/lesson-plan');
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
jest.mock('@/app/actions/telemetry', () => ({
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
});
