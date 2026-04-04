/**
 * Tests for src/hooks/use-community-intro.ts
 */

import { renderHook, act } from '@testing-library/react';

// ── Mock: auth context ──────────────────────────────────────────────────────

const mockUser = { uid: 'test-user' };
jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: mockUser }),
}));

// ── Mock: profile actions ───────────────────────────────────────────────────

const mockGetProfileData = jest.fn();
const mockUpdateProfileAction = jest.fn();

jest.mock('@/app/actions/profile', () => ({
    getProfileData: (...args: any[]) => mockGetProfileData(...args),
    updateProfileAction: (...args: any[]) => mockUpdateProfileAction(...args),
}));

// ── Mock: sessionStorage ────────────────────────────────────────────────────

const sessionStorageMap = new Map<string, string>();
const mockSessionStorage = {
    getItem: jest.fn((key: string) => sessionStorageMap.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { sessionStorageMap.set(key, value); }),
    removeItem: jest.fn((key: string) => { sessionStorageMap.delete(key); }),
    clear: jest.fn(() => { sessionStorageMap.clear(); }),
    get length() { return sessionStorageMap.size; },
    key: jest.fn(() => null),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true });

// ── Import under test ───────────────────────────────────────────────────────

import { useCommunityIntro } from '@/hooks/use-community-intro';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useCommunityIntro', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorageMap.clear();
        mockUpdateProfileAction.mockResolvedValue(undefined);
    });

    it('returns showNudge: false when communityIntroState is "visited" (default)', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'visited' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        // Before profile loads, default state is 'visited' so showNudge is false
        expect(result.current.showNudge).toBe(false);

        // Wait for profile load
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.showNudge).toBe(false);
        expect(result.current.introState).toBe('visited');
    });

    it('returns showNudge: false when profile has no communityIntroState field (existing user)', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { displayName: 'Teacher' }, // no communityIntroState
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.showNudge).toBe(false);
        expect(result.current.introState).toBe('visited');
    });

    it('returns showNudge: true when communityIntroState is "ready"', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'ready' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.showNudge).toBe(true);
        expect(result.current.introState).toBe('ready');
    });

    it('dismissNudge() sets showNudge to false but does not change introState', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'ready' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.showNudge).toBe(true);
        expect(result.current.introState).toBe('ready');

        act(() => {
            result.current.dismissNudge();
        });

        expect(result.current.showNudge).toBe(false);
        // introState stays 'ready' — nudge is only hidden for this session
        expect(result.current.introState).toBe('ready');
        // Should NOT call updateProfileAction
        expect(mockUpdateProfileAction).not.toHaveBeenCalled();
    });

    it('markVisited() sets introState to "visited" and calls updateProfileAction', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'ready' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.showNudge).toBe(true);

        act(() => {
            result.current.markVisited();
        });

        expect(result.current.showNudge).toBe(false);
        expect(result.current.introState).toBe('visited');
        expect(mockUpdateProfileAction).toHaveBeenCalledWith('test-user', {
            communityIntroState: 'visited',
        });
    });

    it('trackGeneration() increments sessionStorage count and triggers "ready" after 3rd call', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'none' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        expect(result.current.introState).toBe('none');
        expect(result.current.showNudge).toBe(false);

        // First generation
        act(() => { result.current.trackGeneration(); });
        expect(sessionStorageMap.get('sahayak_gen_count_test-user')).toBe('1');
        expect(result.current.introState).toBe('none');

        // Second generation
        act(() => { result.current.trackGeneration(); });
        expect(sessionStorageMap.get('sahayak_gen_count_test-user')).toBe('2');
        expect(result.current.introState).toBe('none');

        // Third generation — should trigger 'ready'
        act(() => { result.current.trackGeneration(); });
        expect(sessionStorageMap.get('sahayak_gen_count_test-user')).toBe('3');
        expect(result.current.introState).toBe('ready');
        expect(result.current.showNudge).toBe(true);

        expect(mockUpdateProfileAction).toHaveBeenCalledWith('test-user', {
            communityIntroState: 'ready',
            aiGenerationCount: 3,
        });
    });

    it('trackGeneration() is a no-op when introState is not "none"', async () => {
        mockGetProfileData.mockResolvedValue({
            profile: { communityIntroState: 'ready' },
        });

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        act(() => { result.current.trackGeneration(); });

        // Should not touch sessionStorage
        expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles getProfileData failure gracefully', async () => {
        mockGetProfileData.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useCommunityIntro());

        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Defaults to 'visited' (no nudge) on error
        expect(result.current.showNudge).toBe(false);
        expect(result.current.introState).toBe('visited');
    });
});
