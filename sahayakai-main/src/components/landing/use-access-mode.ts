"use client";

import { useEffect, useState } from "react";
import { getAccessMode, type AccessGateMode } from "@/lib/api/access";

// One request per page load, shared by every CTA on the page.
let cached: Promise<AccessGateMode> | null = null;

/**
 * Rollout mode of the access gate (docs/ACCESS_GATE_DESIGN.md), for choosing
 * the landing CTA. Returns `off` until the request resolves and whenever it
 * fails, so the page behaves exactly as before by default.
 */
export function useAccessMode(): AccessGateMode {
    const [mode, setMode] = useState<AccessGateMode>("off");
    useEffect(() => {
        let cancelled = false;
        if (!cached) cached = getAccessMode();
        cached.then((m) => { if (!cancelled) setMode(m); }).catch(() => { /* stay off */ });
        return () => { cancelled = true; };
    }, []);
    return mode;
}

/** Test hook: forget the cached mode. */
export function resetAccessModeCache(): void {
    cached = null;
}
