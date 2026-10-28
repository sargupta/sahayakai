"use client";

/**
 * Browser-side store for the demo: who is signed in (admin or which teacher)
 * and every call, seeded history first. It lives in localStorage so a call a
 * teacher places shows up on the admin monitor in the same browser, survives
 * a reload, and never leaves the viewer's machine. "Reset demo" puts the
 * seeded school back.
 */

import { useSyncExternalStore } from 'react';
import { buildSeedCalls } from './seed-calls';
import type { ComplaintStatus, DemoCall, DemoSession } from './types';

const KEY = 'sampark.demo.v1';

export interface DemoState {
    version: 1;
    calls: DemoCall[];
    session: DemoSession | null;
}

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function fresh(session: DemoSession | null = null): DemoState {
    return { version: 1, calls: buildSeedCalls(Date.now()), session };
}

function load(): DemoState {
    if (state) return state;
    try {
        const raw = window.localStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as DemoState) : null;
        state = parsed && parsed.version === 1 && Array.isArray(parsed.calls) ? parsed : fresh();
    } catch {
        state = fresh();
    }
    return state;
}

function commit(next: DemoState) {
    state = next;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Private mode or storage full: the demo still works for this tab.
    }
    listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY) return;
        state = null;
        listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

/** Null during server render and the first client paint; the state after that. */
export function useDemoState(): DemoState | null {
    return useSyncExternalStore(subscribe, load, () => null);
}

export function setSession(session: DemoSession | null) {
    commit({ ...load(), session });
}

export function addCall(call: DemoCall) {
    const s = load();
    commit({ ...s, calls: [call, ...s.calls.filter((c) => c.id !== call.id)] });
}

export function setComplaintStatus(callId: string, status: ComplaintStatus) {
    const s = load();
    commit({ ...s, calls: s.calls.map((c) => (c.id === callId && c.complaintStatus ? { ...c, complaintStatus: status } : c)) });
}

/** Puts the seeded school back; keeps who is signed in. */
export function resetDemo() {
    commit(fresh(load().session));
}
