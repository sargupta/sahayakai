"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { SAHAYAK_BRIDGE_PREFIX, SAMPARK_PREFIX, sahayakOrigin } from "@/lib/products";

/**
 * Inside SamparkAI the browser URL is either prefixed (`/sampark/x`, main
 * host) or not (`/x`, on a SamparkAI host where the middleware rewrites onto
 * the /sampark tree). These hooks hide the difference.
 */
function isPrefixed(pathname: string): boolean {
    return pathname === SAMPARK_PREFIX || pathname.startsWith(`${SAMPARK_PREFIX}/`);
}

/** Returns `href(path)`: a SamparkAI-relative path ("/workspace") as a link for the current URL. */
export function useSamparkHref(): (path: string) => string {
    const pathname = usePathname() ?? "";
    const prefixed = isPrefixed(pathname);
    return useCallback(
        (path: string) => {
            const p = path.startsWith("/") ? path : `/${path}`;
            if (!prefixed) return p;
            return p === "/" ? SAMPARK_PREFIX : `${SAMPARK_PREFIX}${p}`;
        },
        [prefixed],
    );
}

/** The current SamparkAI-relative path ("/", "/workspace", "/org-1/calls"). */
export function useSamparkPathname(): string {
    const pathname = usePathname() ?? "";
    if (!isPrefixed(pathname)) return pathname || "/";
    return pathname.slice(SAMPARK_PREFIX.length) || "/";
}

/**
 * Returns `href(path)` for a SahayakAI page, from inside SamparkAI. With
 * NEXT_PUBLIC_SAHAYAK_URL set it is absolute; on the main host it is the
 * path itself; on a SamparkAI host it goes through the /to-sahayak bridge,
 * which the middleware redirects to the SahayakAI origin.
 */
export function useSahayakHref(): (path: string) => string {
    const pathname = usePathname() ?? "";
    const prefixed = isPrefixed(pathname);
    return useCallback(
        (path: string) => {
            const p = path.startsWith("/") ? path : `/${path}`;
            const origin = sahayakOrigin();
            if (origin) return `${origin}${p}`;
            return prefixed ? p : `${SAHAYAK_BRIDGE_PREFIX}${p === "/" ? "" : p}`;
        },
        [prefixed],
    );
}
