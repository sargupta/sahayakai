/**
 * VIDYA Live voice ↔ the SAME application context and actions text VIDYA uses.
 *
 * Nothing here is a second definition: product knowledge is rendered from
 * `app-manifest.ts`, the screen snapshot is `buildVidyaAppContext`, and a
 * Live tool call becomes the exact `VidyaAppAction` that `validateAppAction`
 * + `runAppAction` already execute for text VIDYA.
 *
 * Wire (browser → sidecar, alongside the existing audio/text frames):
 *   {"appContext": {knowledge, sections, screen}}
 * The sidecar keeps the latest frame and serves it through its
 * `get_app_context` tool; it is never spoken to the model as a turn, so a
 * route change cannot make VIDYA talk.
 *
 * Wire (sidecar → browser, the existing `toolCall` frame):
 *   {name: "navigate_to", args: {destination}}
 *   {name: "perform_app_action", args: {capability, params, fingerprint}}
 */

import { getCapability, renderManifestForPrompt, VIDYA_SECTIONS, locateScreen } from './app-manifest';
import { validateAppAction, type VidyaAppAction } from './app-context-contract';
import { buildVidyaAppContext, normalisePath } from './app-context-registry';

export const LIVE_APP_TOOL_NAMES = new Set(['navigate_to', 'perform_app_action']);

export interface LiveAppContextFrame {
    /** Static product knowledge (sections + workflows), from the manifest. */
    knowledge: string;
    /** Valid `navigate_to` destinations. */
    sections: string[];
    screen: {
        path: string;
        section: string | null;
        screenId: string;
        entities: Record<string, unknown>;
        capabilities: Array<{
            id: string;
            enabled: boolean;
            reason?: string;
            description: string;
            params: string[];
            requiresConfirmation: boolean;
        }>;
        fingerprint: string;
    };
}

/** The `appContext` payload for the current screen (same data text VIDYA sends). */
export function buildLiveAppContextFrame(pathname: string): LiveAppContextFrame {
    const path = normalisePath(pathname);
    const ctx = buildVidyaAppContext(path);
    return {
        knowledge: renderManifestForPrompt(),
        sections: VIDYA_SECTIONS.map((s) => s.id),
        screen: {
            path,
            section: locateScreen(path).section?.label ?? null,
            screenId: ctx.screenId,
            entities: ctx.entities,
            capabilities: ctx.capabilities.map((c) => {
                const def = getCapability(c.id);
                return {
                    id: c.id,
                    enabled: c.enabled,
                    ...(c.reason ? { reason: c.reason } : {}),
                    description: def?.description ?? '',
                    params: [...(def?.params ?? [])],
                    requiresConfirmation: def?.kind === 'mutation',
                };
            }),
            fingerprint: ctx.fingerprint,
        },
    };
}

export interface LiveAppToolRequest {
    action: VidyaAppAction;
    /** Context version the model acted on; `runAppAction` refuses if the screen changed since. */
    fingerprint: string;
    /** Shown in the Confirm prompt for actions that save data. */
    description: string;
}

/**
 * Map a Live `navigate_to` / `perform_app_action` tool call to a validated
 * app action. Returns null for anything that is not one of these tools, or
 * that the CURRENT screen does not offer (the model never gets to act on an
 * action the app did not advertise).
 */
export function liveToolCallToAppAction(
    call: { name: string; args: Record<string, unknown> },
    pathname: string,
): LiveAppToolRequest | null {
    const live = buildVidyaAppContext(pathname);
    let raw: unknown = null;
    if (call.name === 'navigate_to') {
        raw = { type: 'NAVIGATE', destination: call.args.destination };
    } else if (call.name === 'perform_app_action') {
        raw = { type: 'INVOKE', capability: call.args.capability, params: call.args.params };
    } else {
        return null;
    }
    const action = validateAppAction(raw, live);
    if (!action) return null;
    const fingerprint = typeof call.args.fingerprint === 'string' && call.args.fingerprint
        ? call.args.fingerprint
        : live.fingerprint;
    const description = action.type === 'INVOKE' ? getCapability(action.capability)?.description ?? '' : '';
    return { action, fingerprint, description };
}
