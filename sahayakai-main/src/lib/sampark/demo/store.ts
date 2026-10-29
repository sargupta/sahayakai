"use client";

/**
 * Browser-side store for the demo: who is signed in (admin or which teacher),
 * every call (seeded history first), callbacks and notice campaigns. It lives
 * in localStorage so work a teacher does shows up on the admin monitor in the
 * same browser, survives a reload, and never leaves the viewer's machine.
 * "Reset demo" puts the seeded school back.
 */

import { useSyncExternalStore } from 'react';
import type { CallbackStatus } from '@/lib/sampark/callbacks/types';
import type { CampaignStatus } from '@/types/sampark';
import { buildSeedCalls } from './seed-calls';
import { buildSeedCallbacks, buildSeedCampaigns } from './seed-planning';
import type { ComplaintStatus, DemoCall, DemoCallback, DemoCampaign, DemoSession } from './types';

const KEY = 'sampark.demo.v2';
const OLD_KEYS = ['sampark.demo.v1'];

export interface DemoState {
    version: 2;
    /** When the seed was built; planning dates are relative to it. */
    seededAt: number;
    calls: DemoCall[];
    callbacks: DemoCallback[];
    campaigns: DemoCampaign[];
    session: DemoSession | null;
}

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function fresh(session: DemoSession | null = null): DemoState {
    const now = Date.now();
    const calls = buildSeedCalls(now);
    return { version: 2, seededAt: now, calls, callbacks: buildSeedCallbacks(now, calls), campaigns: buildSeedCampaigns(now), session };
}

function load(): DemoState {
    if (state) return state;
    try {
        const raw = window.localStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as DemoState) : null;
        if (parsed && parsed.version === 2 && Array.isArray(parsed.calls) && Array.isArray(parsed.callbacks) && Array.isArray(parsed.campaigns)) {
            state = parsed;
        } else {
            // First visit, or a v1 store from before callbacks and campaigns: keep who was signed in.
            let session: DemoSession | null = null;
            for (const k of OLD_KEYS) {
                const old = window.localStorage.getItem(k);
                if (old) session = (JSON.parse(old) as { session?: DemoSession }).session ?? session;
                window.localStorage.removeItem(k);
            }
            state = fresh(session);
        }
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

export function setFollowUpDone(callId: string, done: boolean) {
    const s = load();
    commit({ ...s, calls: s.calls.map((c) => (c.id === callId ? { ...c, followUpDone: done } : c)) });
}

export function addCallback(cb: DemoCallback) {
    const s = load();
    commit({ ...s, callbacks: [cb, ...s.callbacks.filter((x) => x.id !== cb.id)] });
}

export function updateCallback(id: string, patch: Partial<Pick<DemoCallback, 'status' | 'scheduledAt' | 'resultCallId'>>) {
    const s = load();
    commit({ ...s, callbacks: s.callbacks.map((cb) => (cb.id === id ? { ...cb, ...patch } : cb)) });
}

/** Callback statuses a person may move to from the console (the worker owns 'running'). */
export const CALLBACK_ACTIONS: Record<CallbackStatus, CallbackStatus[]> = {
    proposed: ['scheduled', 'cancelled'],
    scheduled: ['completed', 'cancelled'],
    running: [],
    completed: [],
    failed: ['scheduled', 'cancelled'],
    missed: ['scheduled', 'cancelled'],
    cancelled: [],
};

export function addCampaign(c: DemoCampaign) {
    const s = load();
    commit({ ...s, campaigns: [c, ...s.campaigns.filter((x) => x.id !== c.id)] });
}

export function setCampaignStatus(id: string, status: CampaignStatus, patch: Partial<DemoCampaign> = {}) {
    const s = load();
    commit({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch, status, updatedAt: new Date().toISOString() } : c)) });
}

/** Puts the seeded school back; keeps who is signed in. */
export function resetDemo() {
    commit(fresh(load().session));
}
