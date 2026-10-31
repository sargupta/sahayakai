/**
 * Executes a validated VIDYA app action against the LIVE screen.
 *
 * VIDYA only requests; this decides:
 *   - NAVIGATE → a manifest route (never a model-authored URL).
 *   - INVOKE   → the handler the current screen registered — the same code
 *                its button runs, so the backend authorises it exactly like
 *                a manual click. Refused when the screen changed since the
 *                request (fingerprint), or no longer offers / enables it.
 *   - `mutation` capabilities (save data) wait for explicit confirmation,
 *     and are re-checked against the live screen at confirm time.
 *
 * UI concerns (toasts, router) are injected so OmniOrb stays thin and the
 * safety rules are unit-testable.
 */

import { getCapability, getSection, type VidyaSection } from './app-manifest';
import type { VidyaAppAction } from './app-context-contract';
import { buildVidyaAppContext, getRegisteredCapability } from './app-context-registry';

export type AppActionRefusal = 'unknown_destination' | 'screen_changed' | 'not_on_this_screen' | 'disabled' | 'handler_failed';

export interface AppActionDeps {
    /** Pathname of the screen as it is NOW (not at request time). */
    livePath: () => string;
    navigate: (section: VidyaSection) => void;
    /** Ask the teacher to confirm; call `proceed` only on an explicit yes. */
    requestConfirmation: (proceed: () => void) => void;
    onRefused: (reason: AppActionRefusal) => void;
}

export type AppActionOutcome = 'navigated' | 'ran' | 'awaiting_confirmation' | 'refused';

export function runAppAction(
    action: VidyaAppAction,
    requestFingerprint: string,
    deps: AppActionDeps,
): AppActionOutcome {
    if (action.type === 'NAVIGATE') {
        const section = getSection(action.destination);
        if (!section) {
            deps.onRefused('unknown_destination');
            return 'refused';
        }
        deps.navigate(section);
        return 'navigated';
    }

    const params = action.params ?? {};
    // Resolve against the live screen every time; never trust the snapshot.
    const runIfStillValid = (): boolean => {
        const path = deps.livePath();
        let refusal: AppActionRefusal | null = null;
        const handler = getRegisteredCapability(action.capability, path);
        if (buildVidyaAppContext(path).fingerprint !== requestFingerprint) refusal = 'screen_changed';
        else if (!handler) refusal = 'not_on_this_screen';
        else if (!handler.enabled) refusal = 'disabled';
        if (refusal || !handler) {
            deps.onRefused(refusal ?? 'not_on_this_screen');
            return false;
        }
        Promise.resolve()
            .then(() => handler.run(params))
            .catch(() => deps.onRefused('handler_failed'));
        return true;
    };

    if (getCapability(action.capability)?.kind === 'mutation') {
        deps.requestConfirmation(() => { runIfStillValid(); });
        return 'awaiting_confirmation';
    }
    return runIfStillValid() ? 'ran' : 'refused';
}
