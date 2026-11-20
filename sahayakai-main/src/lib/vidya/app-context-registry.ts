/**
 * Client-side registry behind VIDYA's live application context.
 *
 * Screens publish what they show (`useVidyaScreenContext`) and register the
 * actions they really implement (`useVidyaCapability`). OmniOrb reads a
 * snapshot at request time (`buildVidyaAppContext`) and, when VIDYA asks for
 * an action, runs the registered handler — the same function the on-screen
 * button calls, so backend authorisation is unchanged.
 *
 * Why a plain module instead of the zustand `jarvisStore`: handlers are
 * functions (not serialisable / persistable), and the snapshot is only read
 * at request time — keeping it out of React state means tapping a student
 * in the attendance grid does not re-render OmniOrb. Route and form fields
 * stay in `jarvisStore` exactly as before.
 *
 * Every entry is keyed to the pathname it was published on, and removed on
 * unmount, so context from a previous screen can never leak into the next.
 */

import { getCapability, locateScreen, type VidyaCapabilityId } from './app-manifest';
import { hashContext, type VidyaAppContext, type VidyaEntityValue } from './app-context-contract';

interface ScreenEntry {
    path: string;
    data: Record<string, VidyaEntityValue>;
}

export interface RegisteredCapability {
    id: VidyaCapabilityId;
    path: string;
    enabled: boolean;
    reason?: string;
    run: (params: Record<string, string>) => void | Promise<void>;
}

const screenEntries = new Map<string, ScreenEntry>();
const capabilityEntries = new Map<string, RegisteredCapability>();
const listeners = new Set<() => void>();

function notify(): void {
    for (const listener of listeners) {
        try { listener(); } catch { /* a listener must never break a screen */ }
    }
}

/**
 * Be told when any screen publishes / clears context or (un)registers an
 * action. Used by Live voice to push fresh context to the sidecar; text
 * VIDYA reads snapshots at request time and does not need it. Returns an
 * unsubscribe.
 */
export function subscribeVidyaAppContext(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function normalisePath(pathname: string | null | undefined): string {
    return ((pathname || '/').split('?')[0].replace(/\/+$/, '')) || '/';
}

export function publishScreenEntities(
    owner: string,
    pathname: string,
    data: Record<string, VidyaEntityValue>,
): void {
    screenEntries.set(owner, { path: normalisePath(pathname), data });
    notify();
}

export function clearScreenEntities(owner: string): void {
    if (screenEntries.delete(owner)) notify();
}

/** Register a handler; returns an unregister that only removes this entry. */
export function registerCapability(entry: RegisteredCapability): () => void {
    if (!getCapability(entry.id)) {
        throw new Error(`Unknown VIDYA capability "${entry.id}" — add it to app-manifest.ts first`);
    }
    const normalised = { ...entry, path: normalisePath(entry.path) };
    capabilityEntries.set(entry.id, normalised);
    notify();
    return () => {
        if (capabilityEntries.get(entry.id) === normalised) {
            capabilityEntries.delete(entry.id);
            notify();
        }
    };
}

/** The handler for `id`, only if it was registered by the screen at `pathname`. */
export function getRegisteredCapability(
    id: string,
    pathname: string,
): RegisteredCapability | undefined {
    const entry = capabilityEntries.get(id);
    return entry && entry.path === normalisePath(pathname) ? entry : undefined;
}

/** Snapshot of what the current screen shows and offers. */
export function buildVidyaAppContext(pathname: string): VidyaAppContext {
    const path = normalisePath(pathname);
    const entities: Record<string, VidyaEntityValue> = {};
    for (const entry of screenEntries.values()) {
        if (entry.path === path) Object.assign(entities, entry.data);
    }
    const capabilities = [...capabilityEntries.values()]
        .filter((c) => c.path === path)
        .map((c) => ({ id: c.id, enabled: c.enabled, ...(c.reason ? { reason: c.reason } : {}) }));
    const { screenId } = locateScreen(path);
    return {
        screenId,
        entities,
        capabilities,
        fingerprint: hashContext({ path, entities }),
    };
}

/** Test-only: clear all registrations. */
export function __resetVidyaAppContextForTests(): void {
    screenEntries.clear();
    capabilityEntries.clear();
    listeners.clear();
}
