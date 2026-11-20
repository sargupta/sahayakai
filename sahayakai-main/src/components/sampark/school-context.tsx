"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SamparkSchoolView } from "@/lib/api/sampark";

export interface SamparkSchoolContextValue {
    orgId: string;
    /** The school as the server sends it to the console: test phone last four only, plus whether Test mode is possible here. */
    school: SamparkSchoolView;
    /** Replace the school after a successful update (keeps the header in step). */
    setSchool: (school: SamparkSchoolView) => void;
    reloadSchool: () => void;
}

const SamparkSchoolContext = createContext<SamparkSchoolContextValue | null>(null);

export function SamparkSchoolProvider({ value, children }: { value: SamparkSchoolContextValue; children: ReactNode }) {
    return <SamparkSchoolContext.Provider value={value}>{children}</SamparkSchoolContext.Provider>;
}

/** The school whose console is open. Only valid under /sampark/[orgId]. */
export function useSamparkSchool(): SamparkSchoolContextValue {
    const ctx = useContext(SamparkSchoolContext);
    if (!ctx) throw new Error("useSamparkSchool must be used under /sampark/[orgId]");
    return ctx;
}
