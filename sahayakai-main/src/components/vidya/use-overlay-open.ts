"use client";

/**
 * True while a modal dialog, sheet, alert dialog, dropdown menu or select list is
 * open anywhere on the page. The floating VIDYA orb (z-90, above the app's z-50
 * overlays) steps aside then, so it never covers a dialog's buttons, a mobile
 * sheet or a menu. Radix marks open overlays with data-state="open"; one observer
 * on <body> watches for them (attribute and child changes only).
 */

import { useEffect, useState } from "react";

export const OVERLAY_SELECTOR = [
    '[role="dialog"][data-state="open"]',
    '[role="alertdialog"][data-state="open"]',
    '[role="menu"][data-state="open"]',
    '[role="listbox"][data-state="open"]',
].join(",");

export function useOverlayOpen(enabled: boolean): boolean {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!enabled || typeof MutationObserver === "undefined") return;
        let frame = 0;
        let pending = false;
        const check = () => setOpen(document.querySelector(OVERLAY_SELECTOR) !== null);
        // One check per frame however many mutations arrive.
        const schedule = () => {
            if (pending) return;
            pending = true;
            frame = requestAnimationFrame(() => {
                pending = false;
                check();
            });
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "role"] });
        check();
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [enabled]);
    return open;
}
