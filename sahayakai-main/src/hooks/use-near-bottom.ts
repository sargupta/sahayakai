'use client';

import { useEffect, useState, RefObject } from 'react';

/**
 * Returns true when the scroll position of the referenced container is within
 * `threshold` pixels of the bottom edge.
 *
 * Used by chat surfaces to gate auto-scroll: if the user has scrolled up to
 * read history, we should NOT yank them back when a new message arrives.
 *
 * @param ref       — the scrollable container
 * @param threshold — how close to the bottom counts as "near" (default 100px)
 */
export function useNearBottom(
    ref: RefObject<HTMLElement | null>,
    threshold: number = 100,
): boolean {
    const [near, setNear] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const compute = () => {
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setNear(distanceFromBottom <= threshold);
        };

        compute();
        el.addEventListener('scroll', compute, { passive: true });
        // Also recompute on resize — orientation change / soft keyboard.
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
        ro?.observe(el);

        return () => {
            el.removeEventListener('scroll', compute);
            ro?.disconnect();
        };
    }, [ref, threshold]);

    return near;
}
