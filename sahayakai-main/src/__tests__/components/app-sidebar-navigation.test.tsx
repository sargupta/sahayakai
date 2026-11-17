/**
 * SahayakAI sidebar information architecture (design system, decided
 * 26 Oct 2026): Talk to VIDYA, the four destinations, Make, Class,
 * Messages · Notifications, a folded Explore. Labs and the internal
 * dashboards are hidden from teachers; SamparkAI is linked only while the
 * server says it is on (nav-access `sampark`). The class gate for every
 * navigation surface is nav-surfaces-sampark-gate.test.tsx.
 */

import { render, screen, within, fireEvent } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { AppSidebar } from '@/components/app-sidebar';

const NO_ACCESS = { staff: false, labs: false, sampark: false };
let mockAccess = NO_ACCESS;
// Like the real hook: nothing beyond the teacher default until a signed-in
// user's nav-access answer arrives.
jest.mock('@/components/shell/use-nav-access', () => ({
    useNavAccess: (uid: string | null) => (uid ? mockAccess : NO_ACCESS),
}));

// ── Firebase mocks ──────────────────────────────────────────────────────────

const mockAuthUser = { uid: 'user-a' };
let authCallback: ((user: any) => void) | null = null;
let notifSnapshotCallback: ((snap: any) => void) | null = null;
let convSnapshotCallback: ((snap: any) => void) | null = null;
const onSnapshotCalls: Array<{ collectionName: string }> = [];

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn((_auth: any, cb: (u: any) => void) => {
        authCallback = cb;
        // Default: fire with mock user
        cb(mockAuthUser);
        return jest.fn();
    }),
}));

jest.mock('firebase/firestore', () => {
    let lastCollectionName: string | undefined;
    return {
        collection: jest.fn((_db, name) => {
            lastCollectionName = name;
            return { __name: name };
        }),
        query: jest.fn((col: any) => ({ __from: col?.__name })),
        where: jest.fn(() => ({})),
        doc: jest.fn(() => ({})),
        getDoc: jest.fn(() => Promise.resolve({ data: () => ({}) })),
        updateDoc: jest.fn(() => Promise.resolve()),
        onSnapshot: jest.fn((q: any, cb: any) => {
            onSnapshotCalls.push({ collectionName: q?.__from ?? lastCollectionName ?? 'unknown' });
            // Route the callback based on which collection this is for
            if (q?.__from === 'notifications') {
                notifSnapshotCallback = cb;
            } else if (q?.__from === 'conversations') {
                convSnapshotCallback = cb;
            }
            return jest.fn();
        }),
    };
});

jest.mock('@/lib/firebase', () => ({
    db: {},
    auth: {},
}));

// Profile-utils: not a new user, so advanced items render
jest.mock('@/lib/profile-utils', () => ({
    isNewUser: jest.fn(() => false),
}));

jest.mock('@/lib/api/profile', () => ({
    updateProfileAction: jest.fn(),
}));

jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s }),
}));

jest.mock('next/navigation', () => ({
    usePathname: () => '/lesson-plan',
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/components/onboarding/feature-spotlight', () => ({
    FeatureSpotlight: ({ children }: any) => <>{children}</>,
    SPOTLIGHT_IDS: { SIDEBAR_LESSON_PLAN: 'spot-1' },
}));

jest.mock('@/components/usage-display', () => ({
    UsageDisplay: () => null,
}));

// PlanBadge (billing plan tier in sidebar) uses useSubscription → useAuth,
// which requires an AuthProvider. Out of scope for the notification badge.
jest.mock('@/components/plan-badge', () => ({
    PlanBadge: () => null,
}));

// next/link → plain anchor
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));


function sidebar() {
    // The sidebar copy (`.nav-full`) — the rail repeats the same links for 768–1023px.
    const nav = screen.getByRole('navigation', { name: 'SahayakAI' });
    return within(nav.querySelector('.nav-full') as HTMLElement);
}

describe('AppSidebar — information architecture', () => {
    beforeEach(() => {
        mockAccess = NO_ACCESS;
    });

    it('leads with the four destinations, in order', () => {
        render(<AppSidebar />);
        const links = sidebar().getAllByRole('link').map((a) => a.textContent?.trim());
        expect(links.slice(0, 4)).toEqual(['Home', 'Library', 'Community', 'Profile']);
    });

    it('offers Talk to VIDYA as a control, not a link', () => {
        render(<AppSidebar />);
        expect(screen.getAllByRole('button', { name: 'Talk to VIDYA' }).length).toBeGreaterThan(0);
    });

    it('marks the current tool with aria-current', () => {
        render(<AppSidebar />);
        const current = sidebar().getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
        expect(current.map((a) => a.getAttribute('href'))).toEqual(['/lesson-plan']);
    });

    it('keeps the teaching tools under Make', () => {
        render(<AppSidebar />);
        for (const href of ['/lesson-plan', '/worksheet-wizard', '/quiz-generator', '/exam-paper', '/rubric-generator', '/instant-answer']) {
            expect(sidebar().getAllByRole('link').some((a) => a.getAttribute('href') === href)).toBe(true);
        }
    });

    it('Attendance opens the class registers at /attendance, with SamparkAI off or on', () => {
        for (const access of [NO_ACCESS, { ...NO_ACCESS, sampark: true }]) {
            mockAccess = access;
            const { unmount } = render(<AppSidebar />);
            const attendance = sidebar().getAllByRole('link', { name: /Attendance/ });
            expect(attendance.length).toBeGreaterThan(0);
            for (const a of attendance) expect(a.getAttribute('href')).toBe('/attendance');
            unmount();
        }
    });

    it('hides Labs and the internal dashboards from a teacher', () => {
        render(<AppSidebar />);
        fireEvent.click(sidebar().getByRole('button', { name: /explore/i }));
        const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
        expect(hrefs).not.toContain('/labs');
        expect(hrefs.some((h) => h?.startsWith('/admin'))).toBe(false);
    });

    it('shows Labs and the dashboards to staff once Explore is open', () => {
        mockAccess = { staff: true, labs: true, sampark: false };
        render(<AppSidebar />);
        fireEvent.click(sidebar().getByRole('button', { name: /explore/i }));
        const hrefs = sidebar().getAllByRole('link').map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual(expect.arrayContaining(['/labs', '/admin/cost-dashboard', '/admin/log-dashboard', '/admin/system-health']));
    });

    // Class gate for "one SamparkAI entry, at the bottom": a second link from
    // any other section, or the entry moving above the teaching tools, fails.
    describe('the SamparkAI entry', () => {
        // Every link that opens or names SamparkAI (Attendance is /attendance, so it never counts).
        const samparkLinks = (root: HTMLElement) =>
            [...root.querySelectorAll('a')]
                .filter((a) => /sampark/i.test(a.getAttribute('href') ?? '') || /sampark/i.test(a.textContent ?? ''));

        beforeEach(() => {
            mockAccess = { ...NO_ACCESS, sampark: true };
        });

        it('is absent while SamparkAI is off or not yet known', () => {
            mockAccess = NO_ACCESS;
            render(<AppSidebar />);
            fireEvent.click(sidebar().getByRole('button', { name: /explore/i }));
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            expect(samparkLinks(aside)).toHaveLength(0);
            expect(screen.queryAllByTestId('sampark-entry')).toHaveLength(0);
        });

        it('appears exactly once in the sidebar and once in the rail while SamparkAI is on', () => {
            render(<AppSidebar />);
            fireEvent.click(sidebar().getByRole('button', { name: /explore/i }));
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            const full = [...aside.querySelectorAll('.nav-full')].flatMap((el) => samparkLinks(el as HTMLElement));
            const rail = [...aside.querySelectorAll('.nav-rail')].flatMap((el) => samparkLinks(el as HTMLElement));
            expect(full).toHaveLength(1);
            expect(rail).toHaveLength(1);
            expect(rail[0]).toHaveAttribute('aria-label', 'Open SamparkAI');
        });

        it('is hidden for a signed-out visitor (no nav-access answer, so SamparkAI is unknown), without the account row', () => {
            (onAuthStateChanged as jest.Mock).mockImplementationOnce((_auth: unknown, cb: (u: null) => void) => {
                cb(null);
                return jest.fn();
            });
            render(<AppSidebar />);
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            expect(aside.querySelectorAll('[data-testid="sampark-entry"]')).toHaveLength(0);
            expect(screen.queryByText('Profile and classes')).not.toBeInTheDocument();
        });

        it('opens the SamparkAI workspace entry (school picker) through the central URL helper', () => {
            render(<AppSidebar />);
            const hrefs = screen.getAllByTestId('sampark-entry').map((a) => a.getAttribute('href'));
            // Through the calling-provider choice first (2026-11-09), which then opens the workspace.
            expect(new Set(hrefs)).toEqual(new Set(['/sampark/choose-provider?next=%2Fsampark%2Fworkspace']));
        });

        it('goes to the configured SamparkAI subdomain as a full page load', () => {
            const saved = process.env.NEXT_PUBLIC_SAMPARK_URL;
            process.env.NEXT_PUBLIC_SAMPARK_URL = 'https://sampark.sahayakai.com';
            try {
                render(<AppSidebar />);
                const hrefs = screen.getAllByTestId('sampark-entry').map((a) => a.getAttribute('href'));
                expect(new Set(hrefs)).toEqual(new Set(['https://sampark.sahayakai.com/choose-provider?next=%2Fworkspace']));
            } finally {
                if (saved === undefined) delete process.env.NEXT_PUBLIC_SAMPARK_URL;
                else process.env.NEXT_PUBLIC_SAMPARK_URL = saved;
            }
        });

        it('sits in the footer, after the teaching and classroom navigation', () => {
            render(<AppSidebar />);
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            const entry = aside.querySelector('.nav-full [data-testid="sampark-entry"]') as HTMLElement;
            const nav = aside.querySelector('nav') as HTMLElement;
            expect(nav.contains(entry)).toBe(false);
            // DOCUMENT_POSITION_FOLLOWING (4): the entry comes after the nav.
            expect(nav.compareDocumentPosition(entry) & 4).toBeTruthy();
        });
    });

    // One account entry point (2026-11-10): the header avatar menu (AuthButton)
    // holds profile, classes, settings and sign out. The sidebar keeps only the
    // Profile destination in its nav — no footer account row, no settings gear.
    describe('account', () => {
        it('has no account row or settings gear outside the navigation, in either mode', () => {
            render(<AppSidebar />);
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            const navs = [...aside.querySelectorAll('nav')];
            const outsideNav = [...aside.querySelectorAll('a')].filter((a) => !navs.some((n) => n.contains(a)));
            const hrefs = outsideNav.map((a) => a.getAttribute('href'));
            expect(hrefs).not.toContain('/my-profile');
            expect(hrefs).not.toContain('/settings');
            expect(screen.queryByText('Profile and classes')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
        });

        it('still offers the Profile destination in the navigation', () => {
            render(<AppSidebar />);
            const aside = document.querySelector('aside.side-nav') as HTMLElement;
            const nav = aside.querySelector('.nav-full nav') ?? aside.querySelector('nav');
            const profile = [...(nav as HTMLElement).querySelectorAll('a')].find((a) => a.getAttribute('href') === '/my-profile');
            expect(profile).toBeTruthy();
        });
    });
});
