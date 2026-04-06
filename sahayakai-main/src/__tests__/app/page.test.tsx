import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));


// Mock `lucide-react` globally for this test file
jest.mock("lucide-react", () => ({
    Loader2: (props: any) => <div {...props} data-testid="loader2" />,
    Mic: (props: any) => <div {...props} data-testid="mic" />,
    Search: (props: any) => <div {...props} data-testid="search" />,
    Sparkles: (props: any) => <div {...props} data-testid="sparkles" />,
    BookOpen: (props: any) => <div {...props} data-testid="book-open" />,
    BrainCircuit: (props: any) => <div {...props} data-testid="brain-circuit" />,
    PenTool: (props: any) => <div {...props} data-testid="pen-tool" />,
    GraduationCap: (props: any) => <div {...props} data-testid="graduation-cap" />,
    ArrowRight: (props: any) => <div {...props} data-testid="arrow-right" />,
    X: (props: any) => <div {...props} data-testid="x" />,
    Lightbulb: (props: any) => <div {...props} data-testid="lightbulb" />,
    FileText: (props: any) => <div {...props} data-testid="file-text" />,
    ClipboardList: (props: any) => <div {...props} data-testid="clipboard-list" />,
    Image: (props: any) => <div {...props} data-testid="image" />,
    CheckCircle2: (props: any) => <div {...props} data-testid="check-circle" />,
    Clock: (props: any) => <div {...props} data-testid="clock" />,
    Users: (props: any) => <div {...props} data-testid="users" />,
    RefreshCw: (props: any) => <div {...props} data-testid="refresh-cw" />,
}));

// Mock new landing page components
jest.mock("@/components/landing/sample-output-section", () => ({
    SampleOutputSection: () => <div data-testid="sample-output">SampleOutput</div>,
}));

jest.mock("@/components/landing/demo-interaction", () => ({
    DemoInteraction: () => <div data-testid="demo-interaction">DemoInteraction</div>,
}));

jest.mock("@/hooks/use-community-intro", () => ({
    useCommunityIntro: () => ({
        showNudge: false,
        introState: 'visited',
        dismissNudge: jest.fn(),
        markVisited: jest.fn(),
        trackGeneration: jest.fn(),
    }),
}));

jest.mock("@/components/community/community-nudge-banner", () => ({
    CommunityNudgeBanner: () => <div data-testid="nudge-banner">NudgeBanner</div>,
}));

jest.mock("@/hooks/use-onboarding-progress", () => ({
    useOnboardingProgress: () => ({
        phase: 'done',
        profile: null,
        profileSummary: { displayName: 'Teacher' },
        suggestions: [],
        showNewUserHome: false,
        showProfileCompletion: false,
        checklistDismissed: true,
        isFirstWeek: false,
        refreshSuggestions: jest.fn(),
        dismissProfileCard: jest.fn(),
        dismissChecklist: jest.fn(),
        markChecklistItem: jest.fn(),
        incrementGenerationCount: jest.fn(),
        markSpotlightSeen: jest.fn(),
    }),
}));

jest.mock("@/components/onboarding/onboarding-checklist", () => ({
    OnboardingChecklist: () => <div data-testid="onboarding-checklist">Checklist</div>,
}));

jest.mock("@/components/onboarding/profile-completion-card", () => ({
    ProfileCompletionCard: () => <div data-testid="profile-completion">ProfileCompletion</div>,
}));

jest.mock("@/components/onboarding/feature-spotlight", () => ({
    FeatureSpotlight: ({ children }: any) => <>{children}</>,
    SPOTLIGHT_IDS: {
        HOME_VOICE_INPUT: 'home-voice-input',
        SIDEBAR_LESSON_PLAN: 'sidebar-lesson-plan',
        SAVE_TO_LIBRARY: 'save-to-library',
        SHARE_TO_COMMUNITY: 'share-to-community',
    },
}));

// Mock Firebase to prevent initialization errors
jest.mock("@/lib/firebase", () => ({
    auth: { currentUser: null },
    db: {},
    app: {},
    storage: {}
}));

// agent-router is NOT used in page.tsx (it uses direct fetch to /api/ai/intent), so we don't need to mock the module.

// Mock Component - AutoCompleteInput with forwardRef for React Hook Form compatibility
jest.mock("@/components/auto-complete-input", () => ({
    AutoCompleteInput: React.forwardRef((props: any, ref: any) => (
        <div data-testid="auto-complete-input-mock">
            <input
                ref={ref}
                data-testid="topic-input"
                name={props.name}
                value={props.value}
                onChange={props.onChange}
                onBlur={props.onBlur}
                placeholder={props.placeholder}
            />
        </div>
    ))
}));

// Mock Components
jest.mock('@/components/microphone-input', () => ({
    MicrophoneInput: ({ onTranscriptChange }: any) => (
        <button onClick={() => onTranscriptChange("Mic Input")}>Mic Mock</button>
    ),
}));

jest.mock('@/context/auth-context', () => ({
    useAuth: jest.fn().mockReturnValue({
        user: { uid: 'test-user', email: 'test@example.com', displayName: 'Teacher' },
        loading: false,
        requireAuth: jest.fn().mockReturnValue(true),
        openAuthModal: jest.fn(),
    })
}));

jest.mock('@/context/language-context', () => ({
    useLanguage: jest.fn().mockReturnValue({
        language: 'English',
        setLanguage: jest.fn(),
        isLoaded: true,
        t: (key: string) => key,
    })
}));

// Mock Icons
// Utilizes src/__mocks__/lucide-react.ts via moduleNameMapper in jest.config.ts

describe('Home Page', () => {
    const mockPush = jest.fn();

    beforeAll(() => {
        // Mock global.fetch to simulate /api/ai/intent response
        global.fetch = jest.fn((url, options) => {
            if (url === "/api/ai/intent" && options?.method === 'POST') {
                const body = JSON.parse(options.body as string);
                const topic = body.prompt;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        result: {
                            action: 'NAVIGATE',
                            url: `/lesson-plan?topic=${encodeURIComponent(topic)}`
                        }
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        }) as jest.Mock;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        // Restore fetch mock implementation if it was modified in a specific test
        (global.fetch as jest.Mock).mockClear();
    });

    it('renders the hero section with greeting', () => {
        render(<Home />);
        // Use getAllByText for "Teacher" since it appears in greeting and cards
        const teacherElements = screen.getAllByText(/Teacher/i);
        expect(teacherElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/SahayakAI, your personal AI companion/i)).toBeInTheDocument();
    });

    it('renders quick action cards', () => {
        render(<Home />);
        expect(screen.getByText('Lesson Plan')).toBeInTheDocument();
        expect(screen.getByText('Quiz Generator')).toBeInTheDocument();
        expect(screen.getByText('Content Creator')).toBeInTheDocument();
        expect(screen.getByText('Teacher Training')).toBeInTheDocument();
    });

    it('navigates on form submission', async () => {
        render(<Home />);
        const input = screen.getByTestId('topic-input');
        fireEvent.change(input, { target: { value: 'Photosynthesis' } });

        const submitBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/lesson-plan?topic=Photosynthesis');
        });
    });

    it('handles microphone input', async () => {
        render(<Home />);
        const micBtn = screen.getByText('Mic Mock');
        fireEvent.click(micBtn);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/lesson-plan?topic=Mic%20Input');
        });
    });
});
