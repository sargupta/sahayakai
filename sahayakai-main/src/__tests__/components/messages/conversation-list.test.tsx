import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConversationList } from '@/components/messages/conversation-list';
import { Conversation } from '@/types/messages';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = { uid: 'user-a', displayName: 'Test User', email: 'test@test.com' };

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/firebase', () => ({
    db: {},
}));

// Mock Firestore onSnapshot to return test conversations
const mockUnsubscribe = jest.fn();
let snapshotCallback: ((snap: any) => void) | null = null;

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn((_, cb) => {
        snapshotCallback = cb;
        return mockUnsubscribe;
    }),
    Timestamp: {
        fromDate: (d: Date) => ({ toDate: () => d, seconds: d.getTime() / 1000, nanoseconds: 0 }),
    },
}));

// ── Test Data ────────────────────────────────────────────────────────────────

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
    id: 'conv-1',
    type: 'direct',
    participantIds: ['user-a', 'user-b'],
    participants: {
        'user-a': { displayName: 'Test User', photoURL: null },
        'user-b': { displayName: 'Priya Sharma', photoURL: 'https://example.com/priya.jpg' },
    },
    lastMessage: 'Hello!',
    lastMessageAt: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    lastMessageSenderId: 'user-b',
    unreadCount: { 'user-a': 2, 'user-b': 0 },
    createdAt: null,
    updatedAt: null,
    ...overrides,
});

const simulateSnapshot = (conversations: Conversation[]) => {
    act(() => {
        snapshotCallback?.({
            docs: conversations.map((c) => ({
                id: c.id,
                data: () => c,
            })),
        });
    });
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConversationList', () => {
    const mockOnSelect = jest.fn();
    const mockOnNewDM = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        snapshotCallback = null;
    });

    it('renders loading state initially', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        // Should show loader before snapshot fires
        expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    it('renders empty state when no conversations', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([]);
        expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    it('renders conversation list items', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation()]);
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
        expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    it('shows unread badge when unread > 0', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation({ unreadCount: { 'user-a': 3, 'user-b': 0 } })]);
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows 9+ when unread > 9', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation({ unreadCount: { 'user-a': 15, 'user-b': 0 } })]);
        expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('calls onSelect when conversation is clicked', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        const conv = makeConversation();
        simulateSnapshot([conv]);
        fireEvent.click(screen.getByText('Priya Sharma'));
        expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-1' }));
    });

    it('highlights active conversation', () => {
        render(
            <ConversationList
                activeConversationId="conv-1"
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation()]);
        // Active conversation should have orange styling
        const button = screen.getByText('Priya Sharma').closest('button');
        expect(button?.className).toContain('bg-orange-50');
    });

    it('filters conversations by search', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([
            makeConversation({ id: 'conv-1' }),
            makeConversation({
                id: 'conv-2',
                participantIds: ['user-a', 'user-c'],
                participants: {
                    'user-a': { displayName: 'Test User', photoURL: null },
                    'user-c': { displayName: 'Rajesh Kumar', photoURL: null },
                },
            }),
        ]);
        // Both visible
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
        expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();

        // Filter
        const searchInput = screen.getByPlaceholderText(/search conversations/i);
        fireEvent.change(searchInput, { target: { value: 'Rajesh' } });
        expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
        expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
    });

    it('calls onNewDM when new message button is clicked', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([]);
        const newBtn = screen.getByTitle('New message');
        fireEvent.click(newBtn);
        expect(mockOnNewDM).toHaveBeenCalled();
    });

    it('prefixes "You: " for own last message', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation({ lastMessageSenderId: 'user-a', lastMessage: 'My message' })]);
        expect(screen.getByText(/You: My message/)).toBeInTheDocument();
    });

    it('renders group conversation with group name and members icon', () => {
        render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        simulateSnapshot([makeConversation({
            id: 'group-1',
            type: 'group',
            name: 'Math Teachers',
            participantIds: ['user-a', 'user-b', 'user-c'],
        })]);
        expect(screen.getByText('Math Teachers')).toBeInTheDocument();
    });

    it('cleans up snapshot listener on unmount', () => {
        const { unmount } = render(
            <ConversationList
                activeConversationId={null}
                onSelect={mockOnSelect}
                onNewDM={mockOnNewDM}
            />
        );
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });
});
