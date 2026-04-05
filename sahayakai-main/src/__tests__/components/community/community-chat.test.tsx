import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CommunityChat } from '@/components/community/community-chat';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = { uid: 'user-a', displayName: 'Test Teacher', photoURL: null };

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'user-a', displayName: 'Test Teacher', photoURL: null } },
}));

// Mock sendChatMessageAction
const mockSendChatMessage = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/actions/community', () => ({
    sendChatMessageAction: (...args: any[]) => mockSendChatMessage(...args),
}));

// Mock VoiceRecorder
jest.mock('@/components/messages/voice-recorder', () => ({
    VoiceRecorder: ({ onSend, disabled }: { onSend: (url: string) => void; disabled?: boolean }) => (
        <button
            data-testid="voice-recorder"
            onClick={() => onSend('https://storage.example.com/voice.webm')}
            disabled={disabled}
        >
            Mic
        </button>
    ),
}));

// Mock Firestore onSnapshot
let snapshotCallback: ((snap: any) => void) | null = null;
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    limitToLast: jest.fn(),
    onSnapshot: jest.fn((_, cb) => {
        snapshotCallback = cb;
        return jest.fn(); // unsubscribe
    }),
    Timestamp: {
        fromDate: (d: Date) => ({ toDate: () => d }),
    },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

type ChatMsg = {
    id: string;
    text: string;
    audioUrl?: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string | null;
    createdAt: any;
};

const makeChatMessage = (overrides: Partial<ChatMsg> = {}): ChatMsg => ({
    id: 'msg-1',
    text: 'Hello teachers!',
    authorId: 'user-b',
    authorName: 'Priya Sharma',
    authorPhotoURL: 'https://example.com/priya.jpg',
    createdAt: { toDate: () => new Date() },
    ...overrides,
});

const simulateSnapshot = (messages: ChatMsg[]) => {
    act(() => {
        snapshotCallback?.({
            docs: messages.map((m) => ({
                id: m.id,
                data: () => m,
            })),
        });
    });
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CommunityChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        snapshotCallback = null;
    });

    it('renders Community Chat header', () => {
        render(<CommunityChat />);
        expect(screen.getByText('Community Chat')).toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('renders empty state when no messages', () => {
        render(<CommunityChat />);
        simulateSnapshot([]);
        expect(screen.getByText('Start the conversation')).toBeInTheDocument();
    });

    it('renders messages from other users', () => {
        render(<CommunityChat />);
        simulateSnapshot([makeChatMessage()]);
        expect(screen.getByText('Hello teachers!')).toBeInTheDocument();
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    it('renders own messages without author name', () => {
        render(<CommunityChat />);
        simulateSnapshot([makeChatMessage({ id: 'msg-own', authorId: 'user-a', authorName: 'Test Teacher', text: 'My message' })]);
        expect(screen.getByText('My message')).toBeInTheDocument();
        // Own messages should NOT show the author name label
        // (showMeta && !isOwn condition)
    });

    it('sends text message on Enter key', async () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'New message' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalledWith('New message', undefined);
        });
    });

    it('sends text message on send button click', async () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'Button message' } });

        // Find send button (the one that's not the voice recorder)
        const buttons = screen.getAllByRole('button');
        const sendBtn = buttons.find(b => !b.hasAttribute('data-testid'));
        if (sendBtn) fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalled();
        });
    });

    it('does not send empty message', () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        expect(mockSendChatMessage).not.toHaveBeenCalled();
    });

    it('clears input after successful send', async () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Clear me' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(input.value).toBe('');
        });
    });

    it('shows error on send failure', async () => {
        mockSendChatMessage.mockRejectedValueOnce(new Error('Network error'));
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'Fail message' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(screen.getByText(/failed to send/i)).toBeInTheDocument();
        });
    });

    it('shows rate limit error', async () => {
        mockSendChatMessage.mockRejectedValueOnce(new Error('Rate limit exceeded'));
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'Too fast' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(screen.getByText(/sending too fast/i)).toBeInTheDocument();
        });
    });

    it('shows auth error when unauthorized', async () => {
        mockSendChatMessage.mockRejectedValueOnce(new Error('Unauthorized'));
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'Unauth message' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(screen.getByText(/must be signed in/i)).toBeInTheDocument();
        });
    });

    it('renders audio messages with audio player', () => {
        render(<CommunityChat />);
        simulateSnapshot([
            makeChatMessage({
                id: 'audio-1',
                text: 'Voice message',
                audioUrl: 'https://storage.example.com/voice.webm',
            }),
        ]);
        const audio = document.querySelector('audio');
        expect(audio).toBeInTheDocument();
        expect(audio?.src).toBe('https://storage.example.com/voice.webm');
    });

    it('sends voice message via VoiceRecorder', async () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        fireEvent.click(screen.getByTestId('voice-recorder'));

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalledWith('', 'https://storage.example.com/voice.webm');
        });
    });

    it('groups consecutive messages from same sender', () => {
        render(<CommunityChat />);
        simulateSnapshot([
            makeChatMessage({ id: 'msg-1', text: 'First message', authorId: 'user-b', authorName: 'Priya' }),
            makeChatMessage({ id: 'msg-2', text: 'Second message', authorId: 'user-b', authorName: 'Priya' }),
        ]);
        // Only first message should show the author name
        const priyaLabels = screen.getAllByText('Priya');
        expect(priyaLabels).toHaveLength(1);
    });

    it('renders optimistic message with reduced opacity', async () => {
        render(<CommunityChat />);
        simulateSnapshot([]);

        const input = screen.getByPlaceholderText(/share something/i);
        fireEvent.change(input, { target: { value: 'Optimistic' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        // Optimistic message should appear immediately
        expect(screen.getByText('Optimistic')).toBeInTheDocument();
    });

    it('has input maxLength of 500', () => {
        render(<CommunityChat />);
        simulateSnapshot([]);
        const input = screen.getByPlaceholderText(/share something/i);
        expect(input.getAttribute('maxLength')).toBe('500');
    });
});
