"use client";

import { useLanguage } from "@/context/language-context";
import type { CallLogEntry, CallSource, TeacherCallEntry, TeacherCallOutcome, TeacherCallReason } from "@/types/sampark";
import { StatusPill } from "./status-pill";
import type { Tone } from "./labels";

type Translate = (key: string) => string;

/** Where a call came from, on every row of the school's calls (integration brief Step 1B). */
export function callSourceLabel(t: Translate, source: CallSource): string {
    switch (source) {
        case "campaign":
            return t("Campaign");
        case "teacher":
            return t("Teacher");
        case "integration":
            return t("Integration");
    }
}

export function CallSourcePill({ source }: { source: CallSource }) {
    const { t } = useLanguage();
    return <StatusPill tone={source === "campaign" ? "brand" : "neutral"}>{callSourceLabel(t, source)}</StatusPill>;
}

/** Same labels as the attendance app's Contact dialog. */
export function teacherReasonLabel(t: Translate, reason: TeacherCallReason): string {
    switch (reason) {
        case "consecutive_absences":
            return t("Consecutive Absences");
        case "poor_performance":
            return t("Academic Concern");
        case "behavioral_concern":
            return t("Behavioral Concern");
        case "positive_feedback":
            return t("Positive Feedback");
        default:
            return t("Other");
    }
}

export function teacherOutcome(t: Translate, outcome: TeacherCallOutcome): { label: string; tone: Tone } {
    switch (outcome) {
        case "initiated":
            return { label: t("Calling"), tone: "info" };
        case "completed":
            return { label: t("Completed"), tone: "success" };
        case "no_answer":
            return { label: t("No answer"), tone: "warning" };
        case "busy":
            return { label: t("Busy"), tone: "warning" };
        case "failed":
            return { label: t("Call failed"), tone: "danger" };
        default:
            return { label: t("Result not known"), tone: "neutral" };
    }
}

export function TeacherOutcomePill({ call }: { call: Pick<TeacherCallEntry, "outcome"> }) {
    const { t } = useLanguage();
    const o = teacherOutcome(t, call.outcome);
    return <StatusPill tone={o.tone}>{o.label}</StatusPill>;
}

/** "••••••0720" — the masked form the school-wide views show. */
export function maskedPhone(last4: string): string {
    return last4 ? `••••••${last4}` : "—";
}

/**
 * One row of the school's calls: a Sampark campaign call or a teacher's Contact call
 * (integration brief Step 1B). `integration` rows arrive with Step 3.
 */
export type CallRow = { source: "campaign"; call: CallLogEntry } | { source: "teacher"; call: TeacherCallEntry };

/** Newest first; ties broken by id so the order is stable across refreshes. */
export function mergeCallRows(campaign: CallLogEntry[], teacher: TeacherCallEntry[], limit: number): CallRow[] {
    const rows: CallRow[] = [
        ...campaign.map((call) => ({ source: "campaign" as const, call })),
        ...teacher.map((call) => ({ source: "teacher" as const, call })),
    ];
    return rows
        .sort((a, b) => b.call.createdAt.localeCompare(a.call.createdAt) || a.call.id.localeCompare(b.call.id))
        .slice(0, limit);
}
