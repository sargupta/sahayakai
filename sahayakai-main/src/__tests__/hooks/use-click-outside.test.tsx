/**
 * Unit tests for src/hooks/use-click-outside.ts.
 *
 * Verifies:
 * - mousedown outside the ref calls onClose
 * - mousedown inside the ref does NOT call onClose
 * - Escape key calls onClose
 * - listeners are removed on unmount
 * - enabled=false short-circuits without attaching listeners
 */

import { renderHook } from '@testing-library/react';
import { useRef, MutableRefObject } from 'react';
import { useClickOutside } from '@/hooks/use-click-outside';

function setup(enabled = true) {
    const onClose = jest.fn();
    const insideEl = document.createElement('div');
    document.body.appendChild(insideEl);

    const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(insideEl);
        useClickOutside(ref as MutableRefObject<HTMLDivElement>, onClose, enabled);
    });

    return { onClose, insideEl, unmount };
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('useClickOutside', () => {
    it('calls onClose when the mousedown target is outside the ref', () => {
        const { onClose } = setup();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when the mousedown target is inside the ref', () => {
        const { onClose, insideEl } = setup();
        insideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClose when target is a descendant of the ref', () => {
        const { onClose, insideEl } = setup();
        const child = document.createElement('button');
        insideEl.appendChild(child);
        child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose on Escape keydown', () => {
        const { onClose } = setup();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not fire on other keys', () => {
        const { onClose } = setup();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('removes listeners on unmount', () => {
        const { onClose, unmount } = setup();
        unmount();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('enabled=false short-circuits — no listeners attached', () => {
        const { onClose } = setup(false);
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onClose).not.toHaveBeenCalled();
    });
});
