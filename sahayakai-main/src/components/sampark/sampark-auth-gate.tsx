"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { AuthGate } from "@/components/auth/auth-gate";

const DEV_COOKIE = "auth-token=dev-token";
const DEV_FLAG = "sampark:dev-bypass";

function hasDevCookie(): boolean {
    return document.cookie.split("; ").includes(DEV_COOKIE);
}

/**
 * AuthGate, plus the client half of the middleware's development bypass.
 *
 * In development the middleware accepts the cookie `auth-token=dev-token` and
 * injects `x-user-id: dev-user-123` (src/middleware.ts), so a developer can
 * drive the console against the Firestore emulator without a real account.
 * Two things stand in the way on the client, and this handles both:
 *   - AuthGate only knows about a Firebase user and would ask for Google sign-in;
 *   - auth-context clears the `auth-token` cookie whenever Firebase reports no
 *     user, which it does asynchronously after every page load.
 * So once a developer has set the dev cookie, the choice is remembered for the
 * tab (sessionStorage) and the cookie is put back whenever it is cleared.
 *
 * Inert in production: `process.env.NODE_ENV` is inlined at build time, so the
 * whole bypass is dead code there, and the middleware refuses `dev-token`
 * outside development anyway. State is read after mount to keep server and
 * client renders identical.
 */
export function SamparkAuthGate(props: ComponentProps<typeof AuthGate>) {
    const [devBypass, setDevBypass] = useState(false);

    useEffect(() => {
        if (process.env.NODE_ENV !== "development") return;
        let enabled = false;
        try {
            if (hasDevCookie()) sessionStorage.setItem(DEV_FLAG, "1");
            enabled = sessionStorage.getItem(DEV_FLAG) === "1";
        } catch {
            enabled = hasDevCookie();
        }
        if (!enabled) return;
        setDevBypass(true);
        const keepCookie = () => {
            if (!hasDevCookie()) document.cookie = `${DEV_COOKIE}; path=/`;
        };
        keepCookie();
        const timer = window.setInterval(keepCookie, 500);
        return () => window.clearInterval(timer);
    }, []);

    if (devBypass) return <>{props.children}</>;
    return <AuthGate {...props} />;
}
