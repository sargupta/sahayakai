/**
 * The signed-in Home's big mic is VIDYA's 3D orb (the same VidyaSphere as the floating
 * orb), inside the real mic button, showing the idle state until something real
 * happens. Data hooks are mocked; the component, the mic and the sphere are real.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }), usePathname: () => '/' }));
let mockAuthUser: { uid: string; displayName?: string | null } = { uid: 'u1' };
let mockProfileSummary: { displayName?: string } | null = null;
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ requireAuth: () => true, openAuthModal: jest.fn(), user: mockAuthUser }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/hooks/use-onboarding-progress', () => ({
    useOnboardingProgress: () => ({
        isNewUser: false, generationCount: 3, checklistItems: [], suggestions: [], phase: 'done', advancePhase: jest.fn(),
        profile: null, profileSummary: mockProfileSummary, spotlightsSeen: ['home-voice-input'], markSpotlightSeen: jest.fn(),
        showProfileCompletion: false, checklistDismissed: true, isFirstWeek: false,
        refreshSuggestions: jest.fn(), dismissProfileCard: jest.fn(), dismissChecklist: jest.fn(),
    }),
}));
jest.mock('@/hooks/use-community-intro', () => ({ useCommunityIntro: () => ({ showNudge: false, dismissNudge: jest.fn(), markVisited: jest.fn(), trackGeneration: jest.fn() }) }));
jest.mock('@/components/dashboard/recent-work-strip', () => ({ RecentWorkStrip: () => null }));
jest.mock('@/components/landing/sample-output-section', () => ({ SampleOutputSection: () => null }));
jest.mock('@/components/landing/demo-interaction', () => ({ DemoInteraction: () => null }));
jest.mock('@/components/community/community-nudge-banner', () => ({ CommunityNudgeBanner: () => null }));

import { DashboardHome } from '@/components/dashboard/dashboard-home';

beforeEach(() => {
    mockAuthUser = { uid: 'u1' };
    mockProfileSummary = null;
});

describe('Home: VIDYA mic is the 3D orb', () => {
    it('draws the VIDYA sphere inside the real mic button, idle until something happens', () => {
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        render(<DashboardHome />);
        const entry = document.querySelector('[data-vidya-entry="home"]') as HTMLElement;
        expect(entry).not.toBeNull();
        expect(entry.getAttribute('data-vidya-state')).toBe('idle');
        const button = screen.getByRole('button', { name: 'Start recording' });
        const sphere = button.querySelector('[data-vidya-orb-state]');
        expect(sphere).not.toBeNull();
        expect(sphere!.getAttribute('data-vidya-orb-state')).toBe('idle');
        // The old flat gradient face is gone when the orb draws the button.
        expect(button.className).not.toMatch(/!bg-gradient-to-br/);
        // VIDYA's orb carries no glyph: no mic icon drawn over the sphere.
        expect(button.querySelector('[data-testicon]')).toBeNull();
    });

    it('follows the design system: workspace orb size, saffron-600 name, saffron send disc, ink-500 tool icons', () => {
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        render(<DashboardHome />);
        // Home orb, enlarged on request (2026-10-30): 208px from tablet up, 160px on phones.
        const orb = screen.getByRole('button', { name: 'Start recording' });
        expect(orb.className).toMatch(/\bh-40\b/);
        expect(orb.className).toMatch(/\bmd:h-52\b/);
        // "Good morning, <saffron-600>Meena.</>" (ScreenWebHome).
        const name = document.querySelector('h1 span') as HTMLElement;
        expect(name.className).toMatch(/\btext-saffron-600\b/);
        // Composer (chat): surface-disc pill, border-glass edge, saffron-500 focus edge + shadow-current.
        const pill = document.querySelector('form')!.closest('.rounded-pill') as HTMLElement;
        expect(pill.className).toMatch(/\bbg-surface-disc\b/);
        expect(pill.className).toMatch(/\bborder-line-glass\b/);
        expect(pill.className).toMatch(/\bfocus-within:ring-saffron-500\b/);
        expect(pill.className).toMatch(/\bfocus-within:shadow-current\b/);
        // The input sits bare inside the pill: no second bordered box.
        expect((document.querySelector('form input') as HTMLElement).className).toMatch(/\bborder-0\b/);
        // Send disc: a 40px saffron-500 circle (VIDYA's colour, on request) with a white arrow.
        // Plain button, so no rounded-md from the shadcn Button survives next to rounded-pill.
        const send = document.querySelector('form button[type="submit"]') as HTMLElement;
        expect(send.className).toMatch(/\bbg-saffron-500\b/);
        expect(send.className).toMatch(/\bshadow-mic\b/);
        expect(send.className).toMatch(/\btext-white\b/);
        expect(send.className).toMatch(/\bh-10\b/);
        expect(send.className).toMatch(/\brounded-pill\b/);
        expect(send.className).not.toMatch(/\brounded-md\b/);
        // Icons in the tool pills: ink-500.
        // (lucide icons render as <div data-testicon> under the jest mock)
        expect(document.querySelectorAll('[data-testicon].text-ink-500').length).toBeGreaterThan(0);
    });

    describe('greeting names the signed-in teacher, never "Teacher" when a name is known', () => {
        const greetingName = () => (document.querySelector('h1 span') as HTMLElement).textContent;

        it('uses the sign-in account name when the profile has none', () => {
            mockAuthUser = { uid: 'u1', displayName: 'Alyssa L' };
            render(<DashboardHome />);
            expect(greetingName()).toBe('Alyssa.');
        });

        it('prefers the saved profile name', () => {
            mockAuthUser = { uid: 'u1', displayName: 'Alyssa L' };
            mockProfileSummary = { displayName: 'Meena Kulkarni' };
            render(<DashboardHome />);
            expect(greetingName()).toBe('Meena.');
        });

        it('falls back to the translated "Teacher" only when no name is known', () => {
            mockAuthUser = { uid: 'u1', displayName: '   ' };
            render(<DashboardHome />);
            expect(greetingName()).toBe('Teacher.');
        });

        it('changes with the signed-in user', () => {
            mockAuthUser = { uid: 'u1', displayName: 'Alyssa L' };
            const { rerender } = render(<DashboardHome />);
            expect(greetingName()).toBe('Alyssa.');
            mockAuthUser = { uid: 'u2', displayName: 'Ravi Kumar' };
            rerender(<DashboardHome />);
            expect(greetingName()).toBe('Ravi.');
        });
    });
});
