import type { Tone } from "@/components/sampark/labels";
import type { ComplaintStatus, DemoCall, DemoCallStatus, DemoSentiment } from "@/lib/sampark/demo/types";

/** English labels; callers pass them through t(). */
export const SENTIMENT_LABEL: Record<DemoSentiment, string> = {
    cooperative: "Cooperative",
    concerned: "Concerned",
    grateful: "Grateful",
    upset: "Upset",
    indifferent: "Indifferent",
    confused: "Confused",
};

export const SENTIMENT_TONE: Record<DemoSentiment, Tone> = {
    cooperative: "success",
    concerned: "warning",
    grateful: "success",
    upset: "danger",
    indifferent: "neutral",
    confused: "warning",
};

export const STATUS_LABEL: Record<DemoCallStatus, string> = {
    completed: "Reached",
    no_answer: "No answer",
    busy: "Busy",
};

export const STATUS_TONE: Record<DemoCallStatus, Tone> = {
    completed: "success",
    no_answer: "warning",
    busy: "warning",
};

export const COMPLAINT_LABEL: Record<ComplaintStatus, string> = {
    open: "Complaint · open",
    acknowledged: "Complaint · seen by teacher",
    resolved: "Complaint · resolved",
};

export const COMPLAINT_TONE: Record<ComplaintStatus, Tone> = {
    open: "danger",
    acknowledged: "warning",
    resolved: "neutral",
};

export function needsAttention(c: DemoCall): boolean {
    return c.complaintStatus === "open" || c.summary?.parentSentiment === "upset" || Boolean(c.summary?.followUpNeeded);
}

export function isToday(iso: string, now = new Date()): boolean {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function whenLabel(iso: string, locale = "en-IN"): string {
    const d = new Date(iso);
    const now = new Date();
    const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    if (isToday(iso, now)) return `Today, ${time}`;
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (isToday(iso, y)) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${time}`;
}
