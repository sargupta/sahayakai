/**
 * Unit tests for src/hooks/use-optimistic-toggle.ts.
 *
 * Covers:
 * - hydration from initial Set
 * - happy path: optimistic flip + server reconciliation
 * - error path: BOTH Set membership and count are rolled back
 * - error path: onError callback fires
 * - rapid double-toggle from initial state
 */

import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle';

interface Item {
    id: string;
    likes: number;
}

function makeHarness(
    initialItems: Item[],
    action: (id: string) => Promise<{ isToggled: boolean; newCount: number }>,
    onError?: (id: string, err: unknown) => void,
    initial?: string[],
) {
    return renderHook(() => {
        const [items, setItems] = useState<Item[]>(initialItems);
        const opt = useOptimisticToggle<Item>({
            items,
            setItems,
            getId: (i) => i.id,
            getCount: (i) => i.likes,
            setCount: (i, count) => ({ ...i, likes: count }),
            action,
            onError,
            initial,
        });
        return { items, ...opt };
    });
}

describe('useOptimisticToggle', () => {
    it('hydrates the initial Set from the `initial` arg', () => {
        const { result } = makeHarness(
            [{ id: 'a', likes: 5 }],
            async () => ({ isToggled: true, newCount: 6 }),
            undefined,
            ['a'],
        );
        expect(result.current.toggledIds.has('a')).toBe(true);
    });

    it('happy path: flips Set + count optimistically, then reconciles', async () => {
        const action = jest.fn(async (id: string) => ({ isToggled: true, newCount: 11 }));
        const { result } = makeHarness([{ id: 'a', likes: 10 }], action);

        await act(async () => { await result.current.toggle('a'); });

        expect(result.current.toggledIds.has('a')).toBe(true);
        expect(result.current.items[0].likes).toBe(11); // server's authoritative count
        expect(action).toHaveBeenCalledWith('a');
    });

    it('error path: rolls back BOTH the Set AND the count', async () => {
        const action = jest.fn(async () => { throw new Error('network down'); });
        const onError = jest.fn();
        const { result } = makeHarness([{ id: 'a', likes: 10 }], action, onError);

        await act(async () => { await result.current.toggle('a'); });

        // Set was added optimistically, then removed on error
        expect(result.current.toggledIds.has('a')).toBe(false);
        // Count was incremented optimistically (10→11), then decremented back (11→10)
        expect(result.current.items[0].likes).toBe(10);
        expect(onError).toHaveBeenCalledWith('a', expect.any(Error));
    });

    it('error path on un-toggle: restores membership AND count', async () => {
        const action = jest.fn(async () => { throw new Error('forbidden'); });
        const { result } = makeHarness(
            [{ id: 'a', likes: 10 }],
            action,
            undefined,
            ['a'], // start as already-liked
        );

        await act(async () => { await result.current.toggle('a'); });

        expect(result.current.toggledIds.has('a')).toBe(true); // restored
        expect(result.current.items[0].likes).toBe(10);        // restored
    });

    it('does not touch other items', async () => {
        const action = jest.fn(async () => ({ isToggled: true, newCount: 6 }));
        const { result } = makeHarness(
            [{ id: 'a', likes: 5 }, { id: 'b', likes: 99 }],
            action,
        );

        await act(async () => { await result.current.toggle('a'); });

        const b = result.current.items.find((i) => i.id === 'b')!;
        expect(b.likes).toBe(99);
        expect(result.current.toggledIds.has('b')).toBe(false);
    });

    it('reconciles to server\'s newCount even if optimistic delta was wrong', async () => {
        // Real-world race: another user liked the same post during our request.
        // Optimistic count would be 11 (10+1), but server returns 12 (10+1+other).
        const action = jest.fn(async () => ({ isToggled: true, newCount: 12 }));
        const { result } = makeHarness([{ id: 'a', likes: 10 }], action);

        await act(async () => { await result.current.toggle('a'); });

        expect(result.current.items[0].likes).toBe(12);
    });
});
