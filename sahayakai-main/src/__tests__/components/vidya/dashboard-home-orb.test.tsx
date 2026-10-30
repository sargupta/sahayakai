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
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ requireAuth: () => true, openAuthModal: jest.fn(), user: { uid: 'u1' } }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/hooks/use-onboarding-progress', () => ({
    useOnboardingProgress: () => ({
        isNewUser: false, generationCount: 3, checklistItems: [], suggestions: [], phase: 'done', advancePhase: jest.fn(),
        profile: null, profileSummary: null, spotlightsSeen: ['home-voice-input'], markSpotlightSeen: jest.fn(),
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
    });

    it('follows the design system: workspace orb size, saffron-600 name, leaf send disc, ink-500 tool icons', () => {
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        render(<DashboardHome />);
        // LiveOrb workspace size (164px x 1.1): 176px from tablet up, 144px on phones.
        const orb = screen.getByRole('button', { name: 'Start recording' });
        expect(orb.className).toMatch(/\bh-36\b/);
        expect(orb.className).toMatch(/\bmd:h-44\b/);
        // "Good morning, <saffron-600>Meena.</>" (ScreenWebHome).
        const name = document.querySelector('h1 span') as HTMLElement;
        expect(name.className).toMatch(/\btext-saffron-600\b/);
        // Composer send disc: leaf-500 with a white glyph.
        const send = document.querySelector('form button[type="submit"]') as HTMLElement;
        expect(send.className).toMatch(/\bbg-leaf-500\b/);
        expect(send.className).toMatch(/\btext-white\b/);
        // Icons in the tool pills: ink-500.
        // (lucide icons render as <div data-testicon> under the jest mock)
        expect(document.querySelectorAll('[data-testicon].text-ink-500').length).toBeGreaterThan(0);
    });
});
