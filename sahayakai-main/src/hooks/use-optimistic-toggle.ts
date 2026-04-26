'use client';

import { useCallback, useState } from 'react';

/**
 * useOptimisticToggle — paired Set + count optimistic update with rollback.
 *
 * Most "like" / "save" UIs in SahayakAI need to flip BOTH a Set membership
 * (to fill a heart) AND a numeric count (to update "12 likes"). Hand-written
 * versions of this pattern have repeatedly missed one half of the rollback
 * on error — the hearts revert but the counts stay wrong, or vice versa.
 *
 * This hook centralises the pattern. The caller passes:
 *   - the items array (from useState) plus its setter
 *   - the count field name (e.g. 'likesCount', 'likes')
 *   - a server action that returns the authoritative `{isToggled, newCount}`
 *
 * Usage:
 * ```ts
 * const { toggledIds, toggle } = useOptimisticToggle({
 *   items: feedItems,
 *   setItems: setFeedItems,
 *   getId: (item) => item.id,
 *   getCount: (item) => item.likesCount,
 *   setCount: (item, count) => ({ ...item, likesCount: count }),
 *   action: (id) => likeGroupPostAction(groupId, id),
 *   onError: () => toast({ title: 'Could not update', variant: 'destructive' }),
 * });
 *
 * // In click handler:
 * await toggle(post.id);
 * ```
 *
 * Initial `toggledIds` can be hydrated from the server via the `initial` arg.
 */
export interface OptimisticToggleOptions<T> {
    items: T[];
    setItems: (updater: (prev: T[]) => T[]) => void;
    /** Extract the stable id used to match items + Set membership. */
    getId: (item: T) => string;
    /** Extract the numeric count this hook owns. */
    getCount: (item: T) => number;
    /** Return a new item with the count replaced. */
    setCount: (item: T, count: number) => T;
    /** Server action returning the authoritative new state. */
    action: (id: string) => Promise<{ isToggled: boolean; newCount: number }>;
    /** Called when the action throws — caller usually toasts here. */
    onError?: (id: string, err: unknown) => void;
    /** Hydrate the initial Set from the server (e.g. liked post IDs on mount). */
    initial?: Iterable<string>;
}

export function useOptimisticToggle<T>(opts: OptimisticToggleOptions<T>) {
    const { setItems, getId, getCount, setCount, action, onError, initial } = opts;
    const [toggledIds, setToggledIds] = useState<Set<string>>(
        () => new Set(initial ?? []),
    );

    const updateItem = useCallback(
        (id: string, delta: number) => {
            setItems((prev) =>
                prev.map((item) =>
                    getId(item) === id ? setCount(item, getCount(item) + delta) : item,
                ),
            );
        },
        [setItems, getId, getCount, setCount],
    );

    const setItemCount = useCallback(
        (id: string, absolute: number) => {
            setItems((prev) =>
                prev.map((item) =>
                    getId(item) === id ? setCount(item, absolute) : item,
                ),
            );
        },
        [setItems, getId, setCount],
    );

    const toggle = useCallback(
        async (id: string) => {
            const wasToggled = toggledIds.has(id);
            const delta = wasToggled ? -1 : 1;

            // Optimistic flip — both Set + count, atomically from the user's POV.
            setToggledIds((prev) => {
                const next = new Set(prev);
                if (wasToggled) next.delete(id);
                else next.add(id);
                return next;
            });
            updateItem(id, delta);

            try {
                const result = await action(id);
                // Reconcile with server's authoritative count + state.
                setItemCount(id, result.newCount);
                setToggledIds((prev) => {
                    const next = new Set(prev);
                    if (result.isToggled) next.add(id);
                    else next.delete(id);
                    return next;
                });
            } catch (err) {
                // Rollback BOTH halves of the optimistic update.
                setToggledIds((prev) => {
                    const next = new Set(prev);
                    if (wasToggled) next.add(id);
                    else next.delete(id);
                    return next;
                });
                updateItem(id, -delta);
                onError?.(id, err);
            }
        },
        [toggledIds, updateItem, setItemCount, action, onError],
    );

    return {
        toggledIds,
        setToggledIds,
        toggle,
    };
}
