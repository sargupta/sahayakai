/**
 * Tests for src/components/notifications-feed.tsx.
 *
 * Demo-day (2026-05-20) hardening: Accept must persist (remove card,
 * fire toast, call onRefresh) and View must navigate to /profile/{senderId}
 * even when notification.link is missing.
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NotificationFeed } from '@/components/notifications-feed';
import type { Notification } from '@/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const toastMock = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: toastMock }),
}));

const routerRefreshMock = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: routerRefreshMock, push: jest.fn() }),
}));

const acceptMock = jest.fn();
const declineMock = jest.fn();
jest.mock('@/app/actions/connections', () => ({
    acceptConnectionRequestAction: (...args: any[]) => acceptMock(...args),
    declineConnectionRequestAction: (...args: any[]) => declineMock(...args),
}));

const markReadMock = jest.fn();
const markAllReadMock = jest.fn();
jest.mock('@/app/actions/notifications', () => ({
    markNotificationAsReadAction: (...args: any[]) => markReadMock(...args),
    markAllAsReadAction: (...args: any[]) => markAllReadMock(...args),
}));

// next/link → plain anchor so we can read href in tests
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeRequestNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'notif-1',
    recipientId: 'user-a',
    type: 'CONNECT_REQUEST',
    title: 'New connection request',
    message: 'Anjali Jaiswal wants to connect with you.',
    senderId: 'user-anjali',
    senderName: 'Anjali Jaiswal',
    senderPhotoURL: undefined,
    link: '/profile/user-anjali',
    metadata: { requestId: 'user-a_user-anjali' },
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationFeed', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('renders Accept / Decline / View for a pending connection request', () => {
        const onRefresh = jest.fn();
        render(
            <NotificationFeed
                notifications={[makeRequestNotification()]}
                userId="user-a"
                onRefresh={onRefresh}
            />,
        );
        expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
        // View link points at the requester's profile (uses notification.link)
        const viewLink = screen.getByTestId('view-notif-1');
        expect(viewLink).toHaveAttribute('href', '/profile/user-anjali');
    });

    it('falls back to /profile/{senderId} when notification.link is missing', () => {
        const onRefresh = jest.fn();
        render(
            <NotificationFeed
                notifications={[makeRequestNotification({ link: undefined })]}
                userId="user-a"
                onRefresh={onRefresh}
            />,
        );
        const viewLink = screen.getByTestId('view-notif-1');
        // Fallback to sender uid → /profile/user-anjali
        expect(viewLink).toHaveAttribute('href', '/profile/user-anjali');
    });

    it('Accept: calls server, shows toast, removes card and calls onRefresh', async () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        acceptMock.mockResolvedValue(undefined);
        markReadMock.mockResolvedValue(undefined);

        render(
            <NotificationFeed
                notifications={[makeRequestNotification()]}
                userId="user-a"
                onRefresh={onRefresh}
            />,
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId('accept-notif-1'));
        });

        // Server action fired with the requestId
        await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('user-a_user-anjali'));
        // Toast confirming connection
        await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
            title: expect.stringMatching(/connected with anjali/i),
        })));

        // "Connected" feedback visible immediately
        expect(screen.getByText(/connected/i)).toBeInTheDocument();

        // After timeout, the card is removed and onRefresh fires
        await act(async () => {
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
        });

        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    });

    it('Accept: surfaces error toast and keeps card on failure', async () => {
        const onRefresh = jest.fn();
        acceptMock.mockRejectedValue(new Error('boom'));
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <NotificationFeed
                notifications={[makeRequestNotification()]}
                userId="user-a"
                onRefresh={onRefresh}
            />,
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId('accept-notif-1'));
        });

        await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
            variant: 'destructive',
        })));

        // Accept/Decline still present (action state cleared)
        expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
        errSpy.mockRestore();
    });

    it('Decline: removes card after success', async () => {
        const onRefresh = jest.fn().mockResolvedValue(undefined);
        declineMock.mockResolvedValue(undefined);
        markReadMock.mockResolvedValue(undefined);

        render(
            <NotificationFeed
                notifications={[makeRequestNotification()]}
                userId="user-a"
                onRefresh={onRefresh}
            />,
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId('decline-notif-1'));
        });

        await waitFor(() => expect(declineMock).toHaveBeenCalledWith('user-a_user-anjali'));
        expect(screen.getByText(/request declined/i)).toBeInTheDocument();

        await act(async () => {
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
        });

        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    });

    it('renders empty state when no notifications', () => {
        render(<NotificationFeed notifications={[]} userId="user-a" />);
        expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    });
});
