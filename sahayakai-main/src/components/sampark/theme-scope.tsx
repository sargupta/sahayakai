"use client";

import { useEffect } from "react";

/**
 * Applies the SamparkAI theme (globals.css `.theme-sampark`) to <body> while a
 * SamparkAI page is open, so dialogs, sheets and menus — which portal to the
 * body, outside the frame — take the same look. Removed again on the way back
 * to SahayakAI pages.
 */
export function SamparkThemeScope() {
    useEffect(() => {
        document.body.classList.add("theme-sampark");
        return () => document.body.classList.remove("theme-sampark");
    }, []);
    return null;
}
