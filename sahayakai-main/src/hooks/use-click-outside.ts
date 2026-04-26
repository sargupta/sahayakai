'use client';

import { useEffect, RefObject } from 'react';

/**
 * Calls `onClose` when a mousedown / touchstart fires outside the referenced
 * element, OR when the user presses Escape.
 *
 * Used for dropdown menus, popovers, and any in-place control that needs to
 * dismiss when the user clicks elsewhere or hits Esc.
 *
 * Pass `enabled: false` to temporarily disarm without remounting (e.g. while
 * the popover is closed and shouldn't waste listeners).
 */
export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    onClose: () => void,
    enabled: boolean = true,
): void {
    useEffect(() => {
        if (!enabled) return;

        const handlePointer = (e: MouseEvent | TouchEvent) => {
            const el = ref.current;
            if (!el) return;
            if (e.target instanceof Node && el.contains(e.target)) return;
            onClose();
        };

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('touchstart', handlePointer);
        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [ref, onClose, enabled]);
}
