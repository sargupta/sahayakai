"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
    clearScreenEntities,
    publishScreenEntities,
    registerCapability,
} from "@/lib/vidya/app-context-registry";
import type { VidyaEntityValue } from "@/lib/vidya/app-context-contract";
import type { VidyaCapabilityId } from "@/lib/vidya/app-manifest";

/**
 * Publish what this screen shows so VIDYA can answer "which class am I on?",
 * "is attendance complete?" from the app's own state. Pass only what the
 * teacher can already see and VIDYA needs — never contact details or ids
 * beyond the current record. `null` withdraws the entry. Cleared on unmount.
 */
export function useVidyaScreenContext(
    owner: string,
    data: Record<string, VidyaEntityValue> | null,
): void {
    const pathname = usePathname();
    const serialised = JSON.stringify(data);
    useEffect(() => {
        if (data) publishScreenEntities(owner, pathname, data);
        else clearScreenEntities(owner);
        // `serialised` stands in for `data` (a fresh object every render).
    }, [owner, pathname, serialised]);
    useEffect(() => () => clearScreenEntities(owner), [owner]);
}

/**
 * Register a real on-screen action VIDYA may invoke (id must exist in
 * `app-manifest.ts`). `run` should be the same handler the button calls;
 * the backend authorises it as it would a manual click. Unregistered on
 * unmount, so an action is only ever available on the screen that offers it.
 */
export function useVidyaCapability(
    id: VidyaCapabilityId,
    run: (params: Record<string, string>) => void | Promise<void>,
    options: { enabled?: boolean; reason?: string } = {},
): void {
    const pathname = usePathname();
    const runRef = useRef(run);
    runRef.current = run;
    const enabled = options.enabled ?? true;
    const reason = options.reason;
    useEffect(
        () => registerCapability({
            id,
            path: pathname,
            enabled,
            ...(reason ? { reason } : {}),
            run: (params) => runRef.current(params),
        }),
        [id, pathname, enabled, reason],
    );
}
