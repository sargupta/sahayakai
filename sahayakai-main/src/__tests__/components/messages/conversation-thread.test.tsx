import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConversationThread } from '@/components/messages/conversation-thread';
import { Conversation } from '@/types/messages';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = { uid: 'user-a', displayName: 'Test User', photoURL: null };

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'user-a', displayName: 'Test User', photoURL: null } },
}));

// Mock server actions
const mockSendMessage = jest.fn().mockResolvedValue({ messageId: 'new-msg-1' });
const mockMarkRead = jest.fn().mockResolvedValue(undefined);

jest.mock('@/app/actions/messages', () => ({
    sendMessageAction: (...args: any[]) => mockSendMessage(...args),
    markConversationReadAction: (...args: any[]) => mockMarkRead(...args),
}));

// ConversationThread now sends via the `useMessageOutbox` hook (offline-first
// queue). The hook's `sendWithOutbox` enqueues into IndexedDB and only calls
// `sendMessageAction` on a flush triggered by network-online events. In jsdom
// no `online` event fires, so we mock the hook to call `sendMessageAction`
// synchronously and keep the existing test assertions valid.
jest.mock('@/hooks/use-message-outbox', () => ({
    useMessageOutbox: (conversationId: string) => ({
        outboxMessages: [],
        sendWithOutbox: (params: {
            text: string;
            type?: 'text' | 'resource' | 'audio';
            resource?: unknown;
            audioUrl?: string;
            audioDuration?: number;
        }) => mockSendMessage({
            conversationId,
            text: params.text,
            type: params.type ?? 'text',
            resource: params.resource,
            audioUrl: params.audioUrl,
            audioDuration: params.audioDuration,
        }),
        retryMessage: jest.fn(),
        mergeWithFirestore: (firestoreMessages: unknown[]) => firestoreMessages,
    }),
}));

// Mock VoiceRecorder
jest.mock('@/components/messages/voice-recorder', () => ({
    VoiceRecorder: ({ onSend, disabled }: { onSend: (url: string, dur: number) => void; disabled?: boolean }) => (
        <button data-testid="voice-recorder" onClick={() => onSend('https://example.com/voice.webm', 5)} disabled={disabled}>
            Mic
        </button>
    ),
}));

// Mock Firestore onSnapshot for messages
let msgSnapshotCallback: ((snap: any) => void) | null = null;
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    limitToLast: jest.fn(),
    onSnapshot: jest.fn((_, cb) => {
        msgSnapshotCallback = cb;
        return jest.fn();
    }),
    Timestamp: {
        fromDate: (d: Date) => ({ toDate: () => d }),
    },
}));

// ── Test Data ────────────────────────────────────────────────────────────────

const testConversation: Conversation = {
    id: 'user-a_user-b',
    type: 'direct',
    participantIds: ['user-a', 'user-b'],
    participants: {
        'user-a': { displayName: 'Test User', photoURL: null },
        'user-b': { displayName: 'Priya Sharma', photoURL: 'https://example.com/priya.jpg' },
    },
    lastMessage: 'Hello!',
    lastMessageAt: null,
    lastMessageSenderId: 'user-b',
    unreadCount: { 'user-a': 0, 'user-b': 0 },
    createdAt: null,
    updatedAt: null,
};

const simulateMessages = (messages: any[]) => {
    act(() => {
        msgSnapshotCallback?.({
            docs: messages.map((m) => ({ id: m.id, data: () => m })),
        });
    });
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConversationThread', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        msgSnapshotCallback = null;
    });

    it('renders conversation header with other participant name', () => {
        render(<ConversationThread conversation={testConversation} />);
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    it('renders empty state when no messages', () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);
        expect(screen.getByText('Start the conversation')).toBeInTheDocument();
    });

    it('renders messages', () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([
            { id: 'msg-1', type: 'text', text: 'Hello!', senderId: 'user-b', senderName: 'Priya', senderPhotoURL: null, readBy: ['user-b'], createdAt: null },
        ]);
        expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    it('marks conversation as read on mount', async () => {
        render(<ConversationThread conversation={testConversation} />);
        await waitFor(() => {
            expect(mockMarkRead).toHaveBeenCalledWith('user-a_user-b', 'user-a');
        });
    });

    it('sends text message on Enter', async () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);

        const textarea = screen.getByPlaceholderText(/type a message/i);
        fireEvent.change(textarea, { target: { value: 'New message' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
                conversationId: 'user-a_user-b',
                text: 'New message',
                type: 'text',
            }));
        });
    });

    it('does not send on Shift+Enter (new line)', () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);

        const textarea = screen.getByPlaceholderText(/type a message/i);
        fireEvent.change(textarea, { target: { value: 'Multi line' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('does not send empty message', () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);

        const textarea = screen.getByPlaceholderText(/type a message/i);
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('clears input after sending', async () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);

        const textarea = screen.getByPlaceholderText(/type a message/i) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Clear me' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(textarea.value).toBe('');
        });
    });

    it('has 1000 char maxLength on textarea', () => {
        render(<ConversationThread conversation={testConversation} />);
        simulateMessages([]);
        const textarea = screen.getByPlaceholderText(/type a message/i);
        expect(textarea.getAttribute('maxLength')).toBe('1000');
    });

    it('shows back button when onBack is provided', () => {
        const mockOnBack = jest.fn();
        render(<ConversationThread conversation={testConversation} onBack={mockOnBack} />);
        // ArrowLeft icon button should be present
        const buttons = screen.getAllByRole('button');
        const backBtn = buttons[0]; // First button is back
        fireEvent.click(backBtn);
        expect(mockOnBack).toHaveBeenCalled();
    });

    it('renders group conversation with member count', () => {
        const groupConv: Conversation = {
            ...testConversation,
            id: 'group-1',
            type: 'group',
            name: 'Math Teachers',
            participantIds: ['user-a', 'user-b', 'user-c'],
        };
        render(<ConversationThread conversation={groupConv} />);
        expect(screen.getByText('Math Teachers')).toBeInTheDocument();
        expect(screen.getByText('3 members')).toBeInTheDocument();
    });

    it('shows "Sign in to send messages" when no user', () => {
        // Override useAuth to return null user
        jest.spyOn(require('@/context/auth-context'), 'useAuth').mockReturnValue({ user: null, loading: false });
        render(<ConversationThread conversation={testConversation} />);
        expect(screen.getByText(/sign in to send messages/i)).toBeInTheDocument();
    });
});
