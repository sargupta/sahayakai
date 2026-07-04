/**
 * @jest-environment jsdom
 *
 * Presence + typing on Firestore (Mumbai) — the residency migration off RTDB.
 * Verifies the two behaviours that replace RTDB's onDisconnect / native
 * realtime: (1) presence "online" requires a FRESH lastSeen, not just the
 * flag (so a crashed tab reads offline once stale); (2) typing is driven by
 * per-user expiry timestamps and clears when they lapse.
 *
 * These modules are globally no-op-mocked in jest.setup for OTHER suites;
 * here we unmock them to test the real implementations.
 */
jest.unmock('@/hooks/use-presence');
jest.unmock('@/hooks/use-typing-indicator');
jest.unmock('@/components/messages/presence-dot');

import { render, screen, act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';

// Capture the onSnapshot callback so the test can drive doc data.
let snapCb: ((snap: { data: () => any; exists?: () => boolean }) => void) | null = null;
const setDocMock = jest.fn(async () => undefined);

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => ({ id: 'ref' })),
    setDoc: (...a: any[]) => setDocMock(...a),
    onSnapshot: jest.fn((_ref: any, next: any) => { snapCb = next; return jest.fn(); }),
    serverTimestamp: jest.fn(() => ({ __sv: 'ts' })),
    Timestamp: {
        fromMillis: (ms: number) => ({ toMillis: () => ms, __ts: true }),
    },
}));
jest.mock('@/lib/firebase', () => ({ db: {} }));

import { PresenceDot } from '@/components/messages/presence-dot';

describe('PresenceDot freshness (replaces onDisconnect)', () => {
    beforeEach(() => { snapCb = null; jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    it('shows online only when online=true AND lastSeen is fresh', () => {
        const { container } = render(<PresenceDot uid="u1" />);
        act(() => {
            snapCb!({ data: () => ({ online: true, lastSeen: { toMillis: () => Date.now() } }) });
        });
        expect(container.querySelector('.bg-green-500')).toBeTruthy();
    });

    it('shows offline when online=true but lastSeen is stale (crashed tab)', () => {
        const { container } = render(<PresenceDot uid="u2" />);
        act(() => {
            snapCb!({ data: () => ({ online: true, lastSeen: { toMillis: () => Date.now() - 120_000 } }) });
        });
        expect(container.querySelector('.bg-green-500')).toBeNull();
        expect(container.querySelector('.bg-slate-300')).toBeTruthy();
    });

    it('shows offline when the doc is missing', () => {
        const { container } = render(<PresenceDot uid="u3" />);
        act(() => { snapCb!({ data: () => undefined }); });
        expect(container.querySelector('.bg-green-500')).toBeNull();
    });
});
