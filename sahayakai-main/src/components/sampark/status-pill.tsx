"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import type { CallState, CampaignStatus, HeardLevel, ImportRun } from "@/types/sampark";
import {
    type Tone,
    callStateLabel,
    callStateMeaning,
    callStateTone,
    campaignStatusLabel,
    campaignStatusTone,
    heardLabel,
    heardMeaning,
    heardTone,
    importStatusLabel,
    importStatusTone,
} from "./labels";

const TONE_CLASS: Record<Tone, string> = {
    neutral: "border-border bg-muted text-foreground",
    info: "border-info/30 bg-info/10 text-foreground",
    success: "border-success/30 bg-success/10 text-foreground",
    warning: "border-warning/40 bg-warning/10 text-foreground",
    danger: "border-destructive/40 bg-destructive/10 text-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
    neutral: "bg-muted-foreground",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
};

/**
 * A small status label. Colour is never the only signal: the text says the
 * status, and the dot only reinforces it. `title` carries the plain meaning.
 */
export function StatusPill({
    tone,
    children,
    title,
    className,
}: {
    tone: Tone;
    children: ReactNode;
    title?: string;
    className?: string;
}) {
    return (
        <span
            title={title}
            className={cn(
                "inline-flex items-center gap-2 rounded-pill border px-2 py-1 text-xs font-medium leading-normal whitespace-nowrap",
                TONE_CLASS[tone],
                className,
            )}
        >
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-pill", DOT_CLASS[tone])} />
            {children}
        </span>
    );
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
    const { t } = useLanguage();
    return <StatusPill tone={campaignStatusTone(status)}>{campaignStatusLabel(t, status)}</StatusPill>;
}

export function CallStateBadge({ state }: { state: CallState }) {
    const { t } = useLanguage();
    return (
        <StatusPill tone={callStateTone(state)} title={callStateMeaning(t, state)}>
            {callStateLabel(t, state)}
        </StatusPill>
    );
}

export function HeardBadge({ heard }: { heard: HeardLevel }) {
    const { t } = useLanguage();
    return (
        <StatusPill tone={heardTone(heard)} title={heardMeaning(t, heard)}>
            {heardLabel(t, heard)}
        </StatusPill>
    );
}

export function ImportStatusBadge({ status }: { status: ImportRun["status"] }) {
    const { t } = useLanguage();
    return <StatusPill tone={importStatusTone(status)}>{importStatusLabel(t, status)}</StatusPill>;
}
