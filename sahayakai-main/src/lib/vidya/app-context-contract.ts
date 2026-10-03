/**
 * VIDYA live application-context contract (shared by client and server).
 *
 * The client publishes what the current screen actually shows — no more —
 * and the server re-validates it before it reaches the model:
 *
 *   {
 *     screenId: 'attendance.class',
 *     entities: { className: 'Class 7A', studentCount: 32, submittedToday: false, … },
 *     capabilities: [{ id: 'attendance.submit', enabled: true }, …],
 *     fingerprint: '9f3a…',
 *   }
 *
 * Trust model:
 *   - Everything here is UNTRUSTED client input. It can steer what VIDYA
 *     *says*; it never grants authority. Every action VIDYA asks for runs in
 *     the browser through the same handler the on-screen button uses, and
 *     the backend route authorises it exactly as it would a manual click.
 *   - Only manifest-known capability ids survive sanitisation, so the model
 *     can only ever name an action the app actually implements.
 *   - Sizes are bounded (prompt budget + injection surface).
 *
 * Pure module: no React, no Node APIs.
 */

import {
    getCapability,
    getSection,
    type VidyaCapabilityId,
    type VidyaSectionId,
} from './app-manifest';

export type VidyaEntityValue = string | number | boolean | null | string[];

export interface VidyaCapabilityState {
    id: VidyaCapabilityId;
    enabled: boolean;
    /** Why a disabled action is unavailable ("40-student limit reached"). */
    reason?: string;
}

export interface VidyaAppContext {
    screenId: string;
    entities: Record<string, VidyaEntityValue>;
    capabilities: VidyaCapabilityState[];
    /** Hash of path + entities at request time; guards stale actions. */
    fingerprint: string;
}

export type VidyaAppAction =
    | { type: 'NAVIGATE'; destination: VidyaSectionId }
    | { type: 'INVOKE'; capability: VidyaCapabilityId; params?: Record<string, string> };

const MAX_ENTITY_KEYS = 30;
const MAX_STRING = 200;
const MAX_ARRAY = 40;
const MAX_CAPABILITIES = 20;
const MAX_PARAMS = 4;

function clampString(value: string): string {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
}

function sanitizeEntityValue(value: unknown): VidyaEntityValue | undefined {
    if (value === null) return null;
    if (typeof value === 'string') return clampString(value);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) {
        return value
            .filter((v): v is string => typeof v === 'string')
            .slice(0, MAX_ARRAY)
            .map(clampString);
    }
    return undefined;
}

/**
 * Bound and validate a client-supplied app context. Returns null when the
 * payload is absent or unusable (VIDYA then works exactly as before).
 */
export function sanitizeAppContext(raw: unknown): VidyaAppContext | null {
    if (!raw || typeof raw !== 'object') return null;
    const input = raw as Record<string, unknown>;

    const screenId = typeof input.screenId === 'string' ? clampString(input.screenId) : 'unknown';

    const entities: Record<string, VidyaEntityValue> = {};
    if (input.entities && typeof input.entities === 'object' && !Array.isArray(input.entities)) {
        for (const [key, value] of Object.entries(input.entities as Record<string, unknown>)) {
            if (Object.keys(entities).length >= MAX_ENTITY_KEYS) break;
            if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) continue;
            const clean = sanitizeEntityValue(value);
            if (clean !== undefined) entities[key] = clean;
        }
    }

    const capabilities: VidyaCapabilityState[] = [];
    if (Array.isArray(input.capabilities)) {
        for (const c of input.capabilities.slice(0, MAX_CAPABILITIES)) {
            if (!c || typeof c !== 'object') continue;
            const cap = c as Record<string, unknown>;
            if (typeof cap.id !== 'string' || !getCapability(cap.id)) continue;
            capabilities.push({
                id: cap.id as VidyaCapabilityId,
                enabled: cap.enabled === true,
                ...(typeof cap.reason === 'string' ? { reason: clampString(cap.reason) } : {}),
            });
        }
    }

    const fingerprint = typeof input.fingerprint === 'string' ? input.fingerprint.slice(0, 64) : '';
    return { screenId, entities, capabilities, fingerprint };
}

/**
 * Validate a model-authored app action. NAVIGATE must name a manifest
 * section; INVOKE must name a capability the CURRENT screen advertised as
 * enabled. Anything else is dropped (returns null) — the model can never
 * reach an action the screen did not offer.
 */
export function validateAppAction(
    raw: unknown,
    context: VidyaAppContext | null,
): VidyaAppAction | null {
    if (!raw || typeof raw !== 'object') return null;
    const action = raw as Record<string, unknown>;

    if (action.type === 'NAVIGATE') {
        const destination = typeof action.destination === 'string' ? action.destination : '';
        return getSection(destination) ? { type: 'NAVIGATE', destination: destination as VidyaSectionId } : null;
    }

    if (action.type === 'INVOKE') {
        const id = typeof action.capability === 'string' ? action.capability : '';
        const definition = getCapability(id);
        const offered = context?.capabilities.find((c) => c.id === id && c.enabled);
        if (!definition || !offered) return null;

        const params: Record<string, string> = {};
        const allowed = new Set(definition.params ?? []);
        if (action.params && typeof action.params === 'object') {
            for (const [key, value] of Object.entries(action.params as Record<string, unknown>)) {
                if (Object.keys(params).length >= MAX_PARAMS) break;
                if (allowed.has(key) && typeof value === 'string') params[key] = clampString(value);
            }
        }
        return {
            type: 'INVOKE',
            capability: id as VidyaCapabilityId,
            ...(Object.keys(params).length > 0 ? { params } : {}),
        };
    }

    return null;
}

/** Whether a context carries screen-specific state (so replies are not cacheable). */
export function hasLiveAppState(context: VidyaAppContext | null): boolean {
    return !!context && (Object.keys(context.entities).length > 0 || context.capabilities.length > 0);
}

/** Small stable hash for context fingerprints (not security-sensitive). */
export function hashContext(value: unknown): string {
    const text = JSON.stringify(value) ?? '';
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}
