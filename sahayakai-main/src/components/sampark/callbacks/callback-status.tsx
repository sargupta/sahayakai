"use client";

import { useLanguage } from "@/context/language-context";
import type { CallbackStatus } from "@/lib/sampark/callbacks/types";
import type { Tone } from "../labels";
import { StatusPill } from "../status-pill";

type Translate = (s: string) => string;

export function callbackStatusLabel(t: Translate, s: CallbackStatus): string {
    switch (s) {
        case "proposed": return t("Needs confirming");
        case "scheduled": return t("Scheduled");
        case "running": return t("Calling now");
        case "completed": return t("Called");
        case "failed": return t("Not called");
        case "missed": return t("Missed");
        case "cancelled": return t("Cancelled");
    }
}

export function callbackStatusTone(s: CallbackStatus): Tone {
    switch (s) {
        case "proposed": return "brand";
        case "scheduled": return "info";
        case "running": return "warning";
        case "completed": return "success";
        case "failed": return "danger";
        case "missed": return "warning";
        case "cancelled": return "neutral";
    }
}

/** Status in words, colour only reinforcing it. */
export function CallbackStatusPill({ status }: { status: CallbackStatus }) {
    const { t } = useLanguage();
    return <StatusPill tone={callbackStatusTone(status)}>{callbackStatusLabel(t, status)}</StatusPill>;
}
