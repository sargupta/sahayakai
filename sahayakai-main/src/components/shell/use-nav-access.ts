"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

export interface NavAccess {
    /** users/{uid}.role === 'admin' — internal dashboards and Labs. */
    staff: boolean;
    /** Labs is visible: staff, or the labsNav beta flag is on for this user. */
    labs: boolean;
}

const NONE: NavAccess = { staff: false, labs: false };

/**
 * What a signed-in user's navigation may show beyond the teacher default.
 * Everything defaults to hidden and stays hidden on any error: these only
 * decide what is linked, never what is allowed (each route checks again).
 */
export function useNavAccess(uid: string | null): NavAccess {
    const [access, setAccess] = useState<NavAccess>(NONE);

    useEffect(() => {
        if (!uid) {
            setAccess(NONE);
            return;
        }
        const controller = new AbortController();
        const { signal } = controller;
        apiFetch<{ staff: boolean; labs: boolean }>("/api/me/nav-access", { signal })
            .then((nav) => {
                if (signal.aborted) return;
                setAccess({ staff: nav.staff === true, labs: nav.labs === true });
            })
            .catch(() => {
                // Hidden stays hidden; aborts and failures land here.
            });
        return () => controller.abort();
    }, [uid]);

    return access;
}
