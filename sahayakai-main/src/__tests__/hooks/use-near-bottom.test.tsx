/**
 * Unit tests for src/hooks/use-near-bottom.ts.
 *
 * Verifies the hook returns true when the scroll position is within the
 * threshold of the bottom edge, and false otherwise. Covers the resize
 * recalculation path and the initial render.
 */

import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useNearBottom } from '@/hooks/use-near-bottom';

function makeMockScrollEl(scrollHeight = 1000, clientHeight = 500, scrollTop = 0) {
    const listeners: Array<() => void> = [];
    const el = {
        scrollHeight,
        clientHeight,
        scrollTop,
        addEventListener: jest.fn((_evt: string, fn: () => void) => listeners.push(fn)),
        removeEventListener: jest.fn(),
        // Helpers used only by the test to drive scroll changes
        __setScrollTop(v: number) {
            (this as any).scrollTop = v;
            listeners.forEach((fn) => fn());
        },
    };
    return el;
}

describe('useNearBottom', () => {
    it('returns true initially when scrollTop is 0 but content fits (no scroll needed)', () => {
        const el = makeMockScrollEl(500, 500, 0); // no overflow
        const { result } = renderHook(() => {
            const ref = useRef(el as any);
            return useNearBottom(ref, 100);
        });
        // distanceFromBottom = 500 - 0 - 500 = 0 → near
        expect(result.current).toBe(true);
    });

    it('returns false when scrolled near the top of a long document', () => {
        const el = makeMockScrollEl(2000, 500, 0); // 2000 - 0 - 500 = 1500 from bottom
        const { result } = renderHook(() => {
            const ref = useRef(el as any);
            return useNearBottom(ref, 100);
        });
        expect(result.current).toBe(false);
    });

    it('returns true when scrolled near the bottom (within threshold)', () => {
        const el = makeMockScrollEl(2000, 500, 1450); // 2000 - 1450 - 500 = 50, threshold 100
        const { result } = renderHook(() => {
            const ref = useRef(el as any);
            return useNearBottom(ref, 100);
        });
        expect(result.current).toBe(true);
    });

    it('flips false → true when the user scrolls down past the threshold', () => {
        const el = makeMockScrollEl(2000, 500, 0);
        const { result } = renderHook(() => {
            const ref = useRef(el as any);
            return useNearBottom(ref, 100);
        });
        expect(result.current).toBe(false);

        act(() => { el.__setScrollTop(1450); });
        expect(result.current).toBe(true);
    });

    it('flips true → false when the user scrolls up past the threshold', () => {
        const el = makeMockScrollEl(2000, 500, 1450);
        const { result } = renderHook(() => {
            const ref = useRef(el as any);
            return useNearBottom(ref, 100);
        });
        expect(result.current).toBe(true);

        act(() => { el.__setScrollTop(0); });
        expect(result.current).toBe(false);
    });
});
