import React from 'react';
import { render, screen } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUser = { uid: 'user-a', displayName: 'Test User' };
let mockAuthLoading = false;
let mockAuthUser: any = mockUser;

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: mockAuthUser, loading: mockAuthLoading }),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/firebase', () => ({
    db: {},
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(async () => ({ exists: () => false })),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn(() => jest.fn()),
}));

jest.mock('@/app/actions/messages', () => ({
    getOrCreateDirectConversationAction: jest.fn(),
}));

jest.mock('@/components/messages/conversation-list', () => ({
    ConversationList: () => <div data-testid="conversation-list">ConversationList</div>,
}));

jest.mock('@/components/messages/conversation-thread', () => ({
    ConversationThread: () => <div data-testid="conversation-thread">ConversationThread</div>,
}));

jest.mock('@/components/messages/new-conversation-picker', () => ({
    NewConversationPicker: () => <div data-testid="new-picker">NewConversationPicker</div>,
}));

import MessagesPage from '@/app/messages/page';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('MessagesPage', () => {
    beforeEach(() => {
        mockAuthUser = mockUser;
        mockAuthLoading = false;
    });

    it('renders sign-in prompt when not authenticated', () => {
        mockAuthUser = null;
        render(<MessagesPage />);
        expect(screen.getByText(/sign in to access your messages/i)).toBeInTheDocument();
    });

    it('renders conversation list when authenticated', () => {
        render(<MessagesPage />);
        expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
    });

    it('shows empty state text when no conversation selected', () => {
        render(<MessagesPage />);
        expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
    });

    it('renders loading spinner while auth loading', () => {
        mockAuthLoading = true;
        render(<MessagesPage />);
        // Should show loader, not the sign-in prompt or conversation list
        expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('conversation-list')).not.toBeInTheDocument();
    });
});
