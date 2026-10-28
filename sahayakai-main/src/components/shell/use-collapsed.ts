"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whether the desktop sidebar is folded to the rail, remembered per browser
 * and per product. Starts unfolded on the server and the first client
 * render, then applies the stored choice.
 */
export function useCollapsedNav(storageKey: string): [boolean, () => void] {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(storageKey) === "1");
        } catch {
            // Storage blocked (private mode): keep the default.
        }
    }, [storageKey]);

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(storageKey, next ? "1" : "0");
            } catch {
                // Not persisted; the fold still applies for this visit.
            }
            return next;
        });
    }, [storageKey]);

    return [collapsed, toggle];
}
