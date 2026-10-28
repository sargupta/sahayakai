"use client";

import type { CalendarEvent, CalendarEventType, CalendarStatus } from "@/lib/api/sampark-calendar";
import type { RiyaPurpose } from "@/lib/sampark/conversation/riya-purposes";
import type { PurposeId } from "@/types/sampark";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { purposeLabel, type Tone } from "../labels";
import { riyaPurposeLabel } from "../riya-call-panel";
import { StatusPill } from "../status-pill";

type Translate = (s: string) => string;

export function eventTypeName(t: Translate, type: CalendarEventType): string {
    switch (type) {
        case "callback": return t("Parent callback");
        case "scheduled_call": return t("Scheduled call");
        case "campaign_calls": return t("Campaign calls");
        case "school_event": return t("School event");
        case "holiday": return t("Holiday");
    }
}

/** Square letter mark per type (design system: letter marks, not icons in colours). */
const TYPE_MARK: Record<CalendarEventType, string> = {
    callback: "CB",
    scheduled_call: "SC",
    campaign_calls: "CP",
    school_event: "EV",
    holiday: "HO",
};

export function TypeMark({ type, className }: { type: CalendarEventType; className?: string }) {
    return (
        <span aria-hidden="true" className={cn("inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-xs bg-tint-mark text-xs font-semibold text-ink-900", className)}>
            {TYPE_MARK[type]}
        </span>
    );
}

export function statusName(t: Translate, s: CalendarStatus): string {
    switch (s) {
        case "needs_approval": return t("Needs approval");
        case "preparing": return t("Preparing audio");
        case "scheduled": return t("Scheduled");
        case "in_progress": return t("Calling now");
        case "on_hold": return t("On hold");
        case "completed": return t("Completed");
        case "failed": return t("Failed");
        case "missed": return t("Missed");
        case "cancelled": return t("Cancelled");
        case "upcoming": return t("Upcoming");
        case "past": return t("Held");
        case "no_calls": return t("No routine calls");
    }
}

export function statusTone(s: CalendarStatus): Tone {
    switch (s) {
        case "needs_approval": return "brand";
        case "preparing":
        case "scheduled":
        case "upcoming": return "info";
        case "in_progress":
        case "on_hold":
        case "missed": return "warning";
        case "completed": return "success";
        case "failed": return "danger";
        default: return "neutral";
    }
}

/** Status in words; colour only reinforces it. */
export function EventStatusPill({ status }: { status: CalendarStatus }) {
    const { t } = useLanguage();
    return <StatusPill tone={statusTone(status)}>{statusName(t, status)}</StatusPill>;
}

const NOTICE_PURPOSES = new Set(["ptm_invite", "event_invite", "emergency_closure"]);

export function eventPurposeName(t: Translate, e: Pick<CalendarEvent, "type" | "purpose">): string {
    if (!e.purpose) return "";
    if (e.type === "callback" || e.type === "scheduled_call") return riyaPurposeLabel(t, e.purpose as RiyaPurpose);
    return NOTICE_PURPOSES.has(e.purpose) ? purposeLabel(t, e.purpose as PurposeId) : String(e.purpose);
}

/** What the event is about, in one line. */
export function eventTitle(t: Translate, e: CalendarEvent): string {
    switch (e.type) {
        case "callback":
        case "scheduled_call":
            return e.family?.guardianDisplayName ?? t("Family");
        case "campaign_calls":
            return `${eventPurposeName(t, e)} · ${e.callCount} ${e.callCount === 1 ? t("family") : t("families")}`;
        case "school_event":
            switch (e.facts?.kind) {
                case "ptm_invite": return t("Parent-teacher meeting");
                case "event_invite": return t("School event");
                case "emergency_closure": return t("School closed");
                default: return t("School event");
            }
        case "holiday":
            return t("School holiday");
    }
}
