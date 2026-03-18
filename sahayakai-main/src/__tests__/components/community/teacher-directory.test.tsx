import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TeacherDirectory } from '@/components/community/teacher-directory';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

// Mock Firebase auth
let authCallback: ((user: any) => void) | null = null;
jest.mock('@/lib/firebase', () => ({
    auth: {},
}));

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn((_, cb) => {
        authCallback = cb;
        return jest.fn(); // unsubscribe
    }),
}));

// Mock server actions
const mockGetAllTeachers = jest.fn();
const mockGetMyConnectionData = jest.fn();
const mockSendConnectionRequest = jest.fn();
const mockAcceptConnectionRequest = jest.fn();
const mockDeclineConnectionRequest = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('@/app/actions/community', () => ({
    getAllTeachersAction: (...args: any[]) => mockGetAllTeachers(...args),
}));

jest.mock('@/app/actions/connections', () => ({
    sendConnectionRequestAction: (...args: any[]) => mockSendConnectionRequest(...args),
    acceptConnectionRequestAction: (...args: any[]) => mockAcceptConnectionRequest(...args),
    declineConnectionRequestAction: (...args: any[]) => mockDeclineConnectionRequest(...args),
    disconnectAction: (...args: any[]) => mockDisconnect(...args),
    getMyConnectionDataAction: (...args: any[]) => mockGetMyConnectionData(...args),
}));

// ── Test Data ────────────────────────────────────────────────────────────────

const teachers = [
    {
        uid: 'teacher-b',
        displayName: 'Priya Sharma',
        photoURL: 'https://example.com/priya.jpg',
        initial: 'P',
        schoolName: 'KV Bangalore',
        subjects: ['Mathematics', 'Science'],
        gradeLevels: ['Class 5'],
        bio: 'Math expert',
        impactScore: 45,
        followersCount: 12,
    },
    {
        uid: 'teacher-c',
        displayName: 'Rajesh Kumar',
        photoURL: null,
        initial: 'R',
        schoolName: 'DPS Chennai',
        subjects: ['English'],
        gradeLevels: ['Class 8'],
        bio: '',
        impactScore: 30,
        followersCount: 5,
    },
];

const emptyConnectionData = {
    connectedUids: [],
    sentRequestUids: [],
    receivedRequests: [],
};

// ── Helper ───────────────────────────────────────────────────────────────────

const renderAndAuth = async (uid = 'teacher-a') => {
    const result = render(<TeacherDirectory />);
    await act(async () => {
        authCallback?.({ uid });
    });
    return result;
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TeacherDirectory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authCallback = null;
        mockGetAllTeachers.mockResolvedValue(teachers);
        mockGetMyConnectionData.mockResolvedValue(emptyConnectionData);
        mockSendConnectionRequest.mockResolvedValue({ status: 'sent' });
        mockAcceptConnectionRequest.mockResolvedValue(undefined);
        mockDeclineConnectionRequest.mockResolvedValue(undefined);
        mockDisconnect.mockResolvedValue(undefined);
    });

    it('renders loading state initially', () => {
        render(<TeacherDirectory />);
        expect(screen.getByText(/populating teacher directory/i)).toBeInTheDocument();
    });

    it('renders teacher cards after loading', async () => {
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
            expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
        });
    });

    it('shows empty state when no teachers', async () => {
        mockGetAllTeachers.mockResolvedValue([]);
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText(/no other teachers registered/i)).toBeInTheDocument();
        });
    });

    it('shows Connect button for non-connected teachers', async () => {
        await renderAndAuth();
        await waitFor(() => {
            const connectBtns = screen.getAllByText('Connect');
            expect(connectBtns.length).toBe(2);
        });
    });

    it('sends connection request on Connect click', async () => {
        await renderAndAuth();
        await waitFor(() => screen.getByText('Priya Sharma'));

        const connectBtns = screen.getAllByText('Connect');
        await act(async () => {
            fireEvent.click(connectBtns[0]);
        });

        expect(mockSendConnectionRequest).toHaveBeenCalledWith('teacher-b');
    });

    it('shows Pending button after sending request', async () => {
        await renderAndAuth();
        await waitFor(() => screen.getByText('Priya Sharma'));

        const connectBtns = screen.getAllByText('Connect');
        await act(async () => {
            fireEvent.click(connectBtns[0]);
        });

        await waitFor(() => {
            expect(screen.getByText('Pending')).toBeInTheDocument();
        });
    });

    it('shows Connected button for connected teachers', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: ['teacher-b'],
            sentRequestUids: [],
            receivedRequests: [],
        });
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('Connected')).toBeInTheDocument();
        });
    });

    it('shows Accept/Decline for received requests', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: [],
            sentRequestUids: [],
            receivedRequests: [{ uid: 'teacher-b', requestId: 'teacher-a_teacher-b' }],
        });
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('Accept')).toBeInTheDocument();
            expect(screen.getByText('Decline')).toBeInTheDocument();
        });
    });

    it('accepts connection request', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: [],
            sentRequestUids: [],
            receivedRequests: [{ uid: 'teacher-b', requestId: 'teacher-a_teacher-b' }],
        });
        await renderAndAuth();
        await waitFor(() => screen.getByText('Accept'));

        await act(async () => {
            fireEvent.click(screen.getByText('Accept'));
        });

        expect(mockAcceptConnectionRequest).toHaveBeenCalledWith('teacher-a_teacher-b');
    });

    it('declines connection request', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: [],
            sentRequestUids: [],
            receivedRequests: [{ uid: 'teacher-b', requestId: 'teacher-a_teacher-b' }],
        });
        await renderAndAuth();
        await waitFor(() => screen.getByText('Decline'));

        await act(async () => {
            fireEvent.click(screen.getByText('Decline'));
        });

        expect(mockDeclineConnectionRequest).toHaveBeenCalledWith('teacher-a_teacher-b');
    });

    it('shows Message button for connected teachers', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: ['teacher-b'],
            sentRequestUids: [],
            receivedRequests: [],
        });
        await renderAndAuth();
        await waitFor(() => {
            const msgBtn = screen.getByTitle('Message Priya Sharma');
            expect(msgBtn).toBeInTheDocument();
        });
    });

    it('navigates to messages on Message button click', async () => {
        mockGetMyConnectionData.mockResolvedValue({
            connectedUids: ['teacher-b'],
            sentRequestUids: [],
            receivedRequests: [],
        });
        await renderAndAuth();
        await waitFor(() => screen.getByTitle('Message Priya Sharma'));

        fireEvent.click(screen.getByTitle('Message Priya Sharma'));
        expect(mockPush).toHaveBeenCalledWith('/messages?with=teacher-b');
    });

    it('navigates to profile on teacher name click', async () => {
        await renderAndAuth();
        await waitFor(() => screen.getByText('Priya Sharma'));

        fireEvent.click(screen.getByText('Priya Sharma'));
        expect(mockPush).toHaveBeenCalledWith('/profile/teacher-b');
    });

    it('navigates to profile on Profile button click', async () => {
        await renderAndAuth();
        await waitFor(() => screen.getByText('Priya Sharma'));

        const profileBtns = screen.getAllByText('Profile');
        fireEvent.click(profileBtns[0]);
        expect(mockPush).toHaveBeenCalledWith('/profile/teacher-b');
    });

    it('shows teacher subjects as badges', async () => {
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('Mathematics')).toBeInTheDocument();
            expect(screen.getByText('Science')).toBeInTheDocument();
        });
    });

    it('shows school name on teacher card', async () => {
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('KV Bangalore')).toBeInTheDocument();
        });
    });

    it('shows impact score and followers count', async () => {
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('45')).toBeInTheDocument(); // impact
            expect(screen.getByText('12')).toBeInTheDocument(); // followers
        });
    });

    it('shows bio in quotes', async () => {
        await renderAndAuth();
        await waitFor(() => {
            expect(screen.getByText('"Math expert"')).toBeInTheDocument();
        });
    });

    it('does not show Message button for non-connected teachers', async () => {
        await renderAndAuth();
        await waitFor(() => screen.getByText('Priya Sharma'));
        expect(screen.queryByTitle('Message Priya Sharma')).not.toBeInTheDocument();
    });
});
