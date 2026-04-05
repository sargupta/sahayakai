import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { VoiceRecorder } from '@/components/messages/voice-recorder';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/firebase', () => ({
    storage: {},
    auth: { currentUser: { uid: 'test-user' } },
}));

jest.mock('firebase/storage', () => ({
    ref: jest.fn(),
    uploadBytesResumable: jest.fn(() => ({
        on: jest.fn((_, _err, resolve) => resolve()),
    })),
    getDownloadURL: jest.fn().mockResolvedValue('https://storage.example.com/voice.webm'),
}));

// Mock MediaRecorder
class MockMediaRecorder {
    state = 'inactive';
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;
    stream: any;

    constructor(stream: any) {
        this.stream = stream;
    }

    start() {
        this.state = 'recording';
    }

    stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        }
        if (this.onstop) this.onstop();
    }

    static isTypeSupported(type: string) {
        return type === 'audio/webm;codecs=opus';
    }
}

const mockGetUserMedia = jest.fn().mockResolvedValue({
    getTracks: () => [{ stop: jest.fn() }],
});

beforeAll(() => {
    (global as any).MediaRecorder = MockMediaRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
    });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VoiceRecorder', () => {
    const mockOnSend = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders mic button in idle state', () => {
        render(<VoiceRecorder onSend={mockOnSend} />);
        expect(screen.getByTitle('Record voice message')).toBeInTheDocument();
    });

    it('starts recording on mic click', async () => {
        render(<VoiceRecorder onSend={mockOnSend} />);
        await act(async () => {
            fireEvent.click(screen.getByTitle('Record voice message'));
        });
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
        // Should show recording UI with cancel and send buttons
        expect(screen.getByText('Send')).toBeInTheDocument();
        expect(screen.getByTitle('Cancel')).toBeInTheDocument();
    });

    it('shows elapsed time while recording', async () => {
        render(<VoiceRecorder onSend={mockOnSend} />);
        await act(async () => {
            fireEvent.click(screen.getByTitle('Record voice message'));
        });
        expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('cancels recording without uploading', async () => {
        render(<VoiceRecorder onSend={mockOnSend} />);
        await act(async () => {
            fireEvent.click(screen.getByTitle('Record voice message'));
        });
        await act(async () => {
            fireEvent.click(screen.getByTitle('Cancel'));
        });
        // Should return to idle with mic button
        expect(screen.getByTitle('Record voice message')).toBeInTheDocument();
        expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('is disabled when disabled prop is true', () => {
        render(<VoiceRecorder onSend={mockOnSend} disabled />);
        const btn = screen.getByTitle('Record voice message');
        expect(btn).toBeDisabled();
    });

    it('handles microphone permission denied gracefully', async () => {
        mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
        render(<VoiceRecorder onSend={mockOnSend} />);
        await act(async () => {
            fireEvent.click(screen.getByTitle('Record voice message'));
        });
        // Should still show idle state (fails silently)
        expect(screen.getByTitle('Record voice message')).toBeInTheDocument();
    });
});
