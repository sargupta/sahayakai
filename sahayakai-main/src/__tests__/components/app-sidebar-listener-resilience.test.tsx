/**
 * CLASS GATE — a refused Firestore listen right after sign-in never breaks the page.
 *
 * Founder bug (2026-11-16): logging in on localhost showed the red Next.js "1 issue" overlay
 * (permission-denied in an unhandled snapshot listener) because the sidebar subscribed the
 * instant auth changed, before Firestore had the new token. Every sidebar listener must
 * (1) pass an error handler and (2) re-attach after a refusal so the badges still appear.
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

// ── Firebase mocks ──────────────────────────────────────────────────────────

const getIdToken = jest.fn(async () => 'fresh-token');
const mockAuthUser = { uid: 'user-a', getIdToken };
let authCallback: ((user: any) => void) | null = null;
let notifSnapshotCallback: ((snap: any) => void) | null = null;
let convSnapshotCallback: ((snap: any) => void) | null = null;
const onSnapshotCalls: Array<{ collectionName: string; hasErrorHandler?: boolean }> = [];

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
        onSnapshot: jest.fn((q: any, cb: any, onError?: any) => {
            onSnapshotCalls.push({ collectionName: q?.__from ?? lastCollectionName ?? 'unknown', hasErrorHandler: typeof onError === 'function' });
            // The FIRST listen of each collection is refused, as Firestore does right after sign-in.
            const name = q?.__from;
            if (!(globalThis as any).__refused) (globalThis as any).__refused = new Set();
            if (!(globalThis as any).__refused.has(name)) {
                (globalThis as any).__refused.add(name);
                if (typeof onError === 'function') queueMicrotask(() => onError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }));
                else queueMicrotask(() => { throw new Error('UNHANDLED permission-denied in snapshot listener'); });
                return jest.fn();
            }
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


jest.spyOn(console, 'warn').mockImplementation(() => undefined);

describe('AppSidebar — listeners survive a refused first listen at sign-in', () => {
    beforeEach(() => {
        (globalThis as any).__refused = new Set();
        notifSnapshotCallback = null;
        convSnapshotCallback = null;
        onSnapshotCalls.length = 0;
        getIdToken.mockClear();
    });

    it('every snapshot listener passes an error handler', async () => {
        render(<SidebarProvider><AppSidebar /></SidebarProvider>);
        await waitFor(() => expect(onSnapshotCalls.length).toBeGreaterThanOrEqual(2));
        expect(onSnapshotCalls.every((c) => c.hasErrorHandler)).toBe(true);
    });

    it('re-attaches after permission-denied (token refreshed) and the badges then work', async () => {
        render(<SidebarProvider><AppSidebar /></SidebarProvider>);
        await waitFor(() => expect(notifSnapshotCallback).not.toBeNull(), { timeout: 4000 });
        await waitFor(() => expect(convSnapshotCallback).not.toBeNull(), { timeout: 4000 });
        expect(getIdToken).toHaveBeenCalledWith(true);
        expect(onSnapshotCalls.filter((c) => c.collectionName === 'notifications').length).toBe(2);
        expect(onSnapshotCalls.filter((c) => c.collectionName === 'conversations').length).toBe(2);
        await act(async () => { notifSnapshotCallback!({ size: 2, docs: [] }); });
        await waitFor(() => expect(screen.getByTestId('notifications-badge').textContent).toBe('2'));
    });
});
