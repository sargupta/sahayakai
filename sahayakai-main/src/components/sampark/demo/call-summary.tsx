"use client";

import { MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/sampark/status-pill";
import { useLanguage } from "@/context/language-context";
import { setComplaintStatus } from "@/lib/sampark/demo/store";
import type { DemoCall, DemoRole, DemoTurn } from "@/lib/sampark/demo/types";
import { cn } from "@/lib/utils";
import { COMPLAINT_LABEL, COMPLAINT_TONE, SENTIMENT_LABEL, SENTIMENT_TONE } from "./demo-labels";

function List({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{title}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

/** The parent's complaint about the teacher, with what each role can do about it. */
export function ComplaintCard({ call, viewerRole }: { call: DemoCall; viewerRole: DemoRole }) {
    const { t } = useLanguage();
    const text = call.summary?.complaintAboutTeacher;
    if (!text || !call.complaintStatus) return null;
    return (
        <div className="space-y-3 rounded-surface-md border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium text-ink-900">
                    <MessageSquareWarning aria-hidden="true" className="h-4 w-4 text-destructive" />
                    {t("Parent's complaint about the teacher")}
                </p>
                <StatusPill tone={COMPLAINT_TONE[call.complaintStatus]}>{t(COMPLAINT_LABEL[call.complaintStatus])}</StatusPill>
            </div>
            <p className="text-sm text-ink-800">{text}</p>
            <p className="text-xs text-ink-500">
                {t("Recorded as the parent said it. The AI did not argue, defend or agree; the teacher and the principal both see this.")}
            </p>
            <div className="flex flex-wrap gap-2">
                {viewerRole === "teacher" && call.complaintStatus === "open" && (
                    <Button size="sm" variant="outline" onClick={() => setComplaintStatus(call.id, "acknowledged")}>
                        {t("Mark as seen")}
                    </Button>
                )}
                {viewerRole === "admin" && call.complaintStatus !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => setComplaintStatus(call.id, "resolved")}>
                        {t("Mark resolved")}
                    </Button>
                )}
                {viewerRole === "admin" && call.complaintStatus === "resolved" && (
                    <Button size="sm" variant="ghost" onClick={() => setComplaintStatus(call.id, "open")}>
                        {t("Reopen")}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function CallSummaryView({ call, viewerRole }: { call: DemoCall; viewerRole: DemoRole }) {
    const { t } = useLanguage();
    const s = call.summary;
    if (!s) {
        return <p className="text-sm text-ink-600">{t("The parent was not reached, so there is no summary. You can call again later.")}</p>;
    }
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={SENTIMENT_TONE[s.parentSentiment]}>{t(SENTIMENT_LABEL[s.parentSentiment])}</StatusPill>
                {s.callQuality === "difficult" && <StatusPill tone="warning">{t("Difficult call")}</StatusPill>}
                {s.followUpNeeded && <StatusPill tone="info">{t("Follow-up needed")}</StatusPill>}
                {call.offlineReplies && (
                    <StatusPill tone="neutral" title={t("The AI could not be reached, so scripted replies were used.")}>
                        {t("Scripted replies")}
                    </StatusPill>
                )}
            </div>
            <p className="text-ink-900">{s.parentResponse}</p>
            <ComplaintCard call={call} viewerRole={viewerRole} />
            <div className="grid gap-4 sm:grid-cols-2">
                <List title={t("Parent's concerns")} items={s.parentConcerns} />
                <List title={t("Parent agreed to")} items={s.parentCommitments} />
                <List title={t("Next steps for the teacher")} items={s.actionItemsForTeacher} />
                <List title={t("Advice shared")} items={s.guidanceGiven} />
            </div>
            {s.followUpNeeded && s.followUpSuggestion && (
                <p className="rounded-field bg-milk-300 px-3 py-2 text-sm text-ink-800">
                    <span className="font-medium">{t("Follow-up")}: </span>
                    {s.followUpSuggestion}
                </p>
            )}
        </div>
    );
}

export function Transcript({ turns, className }: { turns: DemoTurn[]; className?: string }) {
    const { t } = useLanguage();
    if (turns.length === 0) return null;
    return (
        <ol className={cn("space-y-2", className)}>
            {turns.map((turn, i) => (
                <li key={i} className={cn("flex", turn.role === "parent" ? "justify-end" : "justify-start")}>
                    <div
                        className={cn(
                            "max-w-md rounded-surface-md px-3 py-2 text-sm",
                            turn.role === "parent" ? "bg-primary text-primary-foreground" : "border border-border bg-surface-glass text-ink-900",
                        )}
                    >
                        <span className="mb-0.5 block text-xs font-medium uppercase tracking-wide opacity-70">
                            {turn.role === "parent" ? t("Parent") : t("AI assistant")}
                        </span>
                        {turn.text}
                    </div>
                </li>
            ))}
        </ol>
    );
}
