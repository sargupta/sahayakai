"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSamparkHref } from "@/components/shell/product-paths";
import { LoadingBlock } from "@/components/sampark/states";
import { getDemoSchool, teacherById } from "@/lib/sampark/demo/school";
import { useDemoState, type DemoState } from "@/lib/sampark/demo/store";
import type { DemoCall, DemoRole, DemoSchool, DemoTeacher } from "@/lib/sampark/demo/types";

export interface DemoView {
    state: DemoState;
    school: DemoSchool;
    role: DemoRole | null;
    teacher: DemoTeacher | null;
    /** Calls this viewer may see: all for the admin, own classes for a teacher. */
    visibleCalls: DemoCall[];
    /** Display name of who is signed in. */
    actorName: string;
}

export function useDemo(): DemoView | null {
    const state = useDemoState();
    return useMemo(() => {
        if (!state) return null;
        const school = getDemoSchool();
        const role = state.session?.role ?? null;
        const teacher = role === "teacher" ? teacherById(state.session?.teacherId) ?? null : null;
        const visibleCalls =
            role === "admin" ? state.calls : teacher ? state.calls.filter((c) => teacher.classIds.includes(c.classId)) : [];
        const actorName = role === "admin" ? school.admin.name : teacher?.name ?? "";
        return { state, school, role, teacher, visibleCalls, actorName };
    }, [state]);
}

/**
 * Renders children only for the given role; anyone else goes back to the
 * role picker. The demo has no real sign-in, so this is the whole check.
 */
export function DemoRoleGate({ role, children }: { role: DemoRole; children: (view: DemoView) => ReactNode }) {
    const view = useDemo();
    const router = useRouter();
    const href = useSamparkHref();
    const allowed = view && view.role === role && (role === "admin" || view.teacher);

    useEffect(() => {
        if (view && !allowed) {
            const qs = typeof window !== "undefined" ? window.location.search : "";
            router.replace(href(`/demo${qs}${qs ? "&" : "?"}as=${role}`));
        }
    }, [view, allowed, router, href, role]);

    if (!view || !allowed) return <LoadingBlock />;
    return <>{children(view)}</>;
}
