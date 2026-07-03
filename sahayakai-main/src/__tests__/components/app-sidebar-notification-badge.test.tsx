/**
 * Tests for the unread notifications badge in src/components/app-sidebar.tsx.
 *
 * Demo-day (2026-05-20) fix: badge appears in sidebar showing count of
 * unread notifications, updating live as the recipient's collection changes.
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

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
    usePathname: () => '/',
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function fireNotifSnapshot(size: number) {
    if (!notifSnapshotCallback) throw new Error('notifications onSnapshot not yet subscribed');
    notifSnapshotCallback({ size, docs: [] });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AppSidebar — notifications badge', () => {
    beforeEach(() => {
        authCallback = null;
        notifSnapshotCallback = null;
        convSnapshotCallback = null;
        onSnapshotCalls.length = 0;
    });

    it('subscribes to notifications collection on mount for signed-in user', async () => {
        render(
            <SidebarProvider>
                <AppSidebar />
            </SidebarProvider>,
        );
        await waitFor(() => {
            expect(onSnapshotCalls.some((c) => c.collectionName === 'notifications')).toBe(true);
        });
    });

    it('shows badge with unread count when notifications collection has unread docs', async () => {
        render(
            <SidebarProvider>
                <AppSidebar />
            </SidebarProvider>,
        );

        await waitFor(() => expect(notifSnapshotCallback).not.toBeNull());

        // Fire snapshot with 3 unread notifications
        await act(async () => {
            fireNotifSnapshot(3);
        });

        await waitFor(() => {
            const badge = screen.getByTestId('notifications-badge');
            expect(badge).toBeInTheDocument();
            expect(badge.textContent).toBe('3');
        });
    });

    it('caps display at 9+ when unread count exceeds 9', async () => {
        render(
            <SidebarProvider>
                <AppSidebar />
            </SidebarProvider>,
        );

        await waitFor(() => expect(notifSnapshotCallback).not.toBeNull());
        await act(async () => {
            fireNotifSnapshot(42);
        });

        await waitFor(() => {
            const badge = screen.getByTestId('notifications-badge');
            expect(badge.textContent).toBe('9+');
        });
    });

    it('hides badge when unread count is 0', async () => {
        render(
            <SidebarProvider>
                <AppSidebar />
            </SidebarProvider>,
        );

        await waitFor(() => expect(notifSnapshotCallback).not.toBeNull());
        await act(async () => {
            fireNotifSnapshot(0);
        });

        await waitFor(() => {
            expect(screen.queryByTestId('notifications-badge')).not.toBeInTheDocument();
        });
    });
});
