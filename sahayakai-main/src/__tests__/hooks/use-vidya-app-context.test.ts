import { renderHook } from '@testing-library/react';

let mockPath = '/attendance/class-1';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));

import { useVidyaCapability, useVidyaScreenContext } from '@/hooks/use-vidya-app-context';
import {
    __resetVidyaAppContextForTests,
    buildVidyaAppContext,
    getRegisteredCapability,
} from '@/lib/vidya/app-context-registry';

beforeEach(() => {
    __resetVidyaAppContextForTests();
    mockPath = '/attendance/class-1';
});

describe('useVidyaScreenContext', () => {
    it('publishes for the current route and updates when the class changes', () => {
        const { rerender } = renderHook(({ name }) => useVidyaScreenContext('attendance.class', { className: name }), {
            initialProps: { name: 'Class 7A' },
        });
        expect(buildVidyaAppContext('/attendance/class-1').entities.className).toBe('Class 7A');

        rerender({ name: 'Class 8B' });
        expect(buildVidyaAppContext('/attendance/class-1').entities.className).toBe('Class 8B');
    });

    it('follows a route change and never leaks to the previous route', () => {
        const { rerender } = renderHook(() => useVidyaScreenContext('attendance.class', { className: 'Class 7A' }));
        mockPath = '/attendance/class-2';
        rerender();

        expect(buildVidyaAppContext('/attendance/class-2').entities.className).toBe('Class 7A');
        expect(buildVidyaAppContext('/attendance/class-1').entities).toEqual({});
    });

    it('withdraws everything on unmount (user left the screen)', () => {
        const { unmount } = renderHook(() => useVidyaScreenContext('attendance.grid', { absentCount: 3 }));
        unmount();
        expect(buildVidyaAppContext('/attendance/class-1').entities).toEqual({});
    });
});

describe('useVidyaCapability', () => {
    it('registers the real handler on this screen and removes it on unmount', () => {
        const run = jest.fn();
        const { unmount } = renderHook(() => useVidyaCapability('attendance.mark_all_present', run));

        getRegisteredCapability('attendance.mark_all_present', '/attendance/class-1')?.run({});
        expect(run).toHaveBeenCalledTimes(1);

        unmount();
        expect(getRegisteredCapability('attendance.mark_all_present', '/attendance/class-1')).toBeUndefined();
    });

    it('reflects enabled/disabled state and always runs the latest handler', () => {
        const first = jest.fn();
        const latest = jest.fn();
        const { rerender } = renderHook(({ run, enabled }) => useVidyaCapability('attendance.submit', run, { enabled }), {
            initialProps: { run: first, enabled: false },
        });
        expect(buildVidyaAppContext('/attendance/class-1').capabilities).toEqual([{ id: 'attendance.submit', enabled: false }]);

        rerender({ run: latest, enabled: true });
        getRegisteredCapability('attendance.submit', '/attendance/class-1')?.run({});
        expect(latest).toHaveBeenCalled();
        expect(first).not.toHaveBeenCalled();
        expect(buildVidyaAppContext('/attendance/class-1').capabilities[0].enabled).toBe(true);
    });
});
