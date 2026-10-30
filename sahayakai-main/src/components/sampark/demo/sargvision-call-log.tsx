"use client";

import Link from "next/link";
import { CalendarClock, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { fmt } from "@/components/sampark/labels";
import { RiyaCallHistory } from "@/components/sampark/riya-call-panel";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { StatusPill } from "@/components/sampark/status-pill";
import { useSamparkFormat } from "@/components/sampark/format";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useLanguage } from "@/context/language-context";
import { listCallbacks } from "@/lib/api/sampark-callbacks";
import { getRiya } from "@/lib/api/sampark-riya";
import { SARGVISION_ORG_ID } from "@/lib/sampark/sargvision";

const DAY = 86_400_000;

/**
 * "My calls" for the Sargvision sample class: the REAL Riya calls from the Sampark server (school
 * `sargvision-local`), with live status, the outcome, Riya's collected answers (good time to talk,
 * attendance…) and, under Details, the transcript; then the class's callbacks — a listener's "call
 * me back" arrives as a proposed callback and rings only after a person confirms a time in the
 * school calendar. The demo's simulated calls stay in the list below it.
 */
export function SargvisionCallLog() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const riya = useSamparkQuery((signal) => getRiya(SARGVISION_ORG_ID, { signal }), []);
    const callbacks = useSamparkQuery((signal) => {
        const now = Date.now();
        return listCallbacks(SARGVISION_ORG_ID, new Date(now - 7 * DAY), new Date(now + 30 * DAY), { signal });
    }, []);
    const reload = () => {
        riya.reload();
        callbacks.reload();
    };
    const cbRows = callbacks.data ? [...callbacks.data.proposed, ...callbacks.data.callbacks.filter((c) => c.status !== "proposed")] : [];
    return (
        <SectionCard
            title={t("Sargvision · real calls by Riya")}
            action={<Button type="button" size="sm" variant="ghost" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />{t("Refresh")}</Button>}
        >
            {riya.error ? <ErrorPanel error={riya.error} onRetry={riya.reload} /> : !riya.data ? <LoadingBlock rows={2} /> : (
                <RiyaCallHistory orgId={SARGVISION_ORG_ID} calls={riya.data.calls} reload={reload} storeTranscripts={riya.data.availability.storeTranscripts} />
            )}
            <div className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CalendarClock className="h-4 w-4" aria-hidden="true" />{t("Callbacks")}</p>
                    <Link className="text-sm text-foreground underline" href={`/sampark/${SARGVISION_ORG_ID}/calendar`}>{t("Open the Sargvision calendar")}</Link>
                </div>
                {callbacks.error ? <p className="text-sm text-muted-foreground">{t("Callbacks could not be loaded.")}</p> : !callbacks.data ? null : cbRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No callbacks. When a listener asks to be called back, it appears here as a request for you to confirm.")}</p>
                ) : (
                    <ul className="space-y-1">
                        {cbRows.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                                <StatusPill tone={c.status === "proposed" ? "warning" : c.status === "scheduled" ? "info" : "neutral"}>{t(c.status)}</StatusPill>
                                <span className="text-foreground">{c.studentDisplayName ?? c.guardianDisplayName ?? "—"}</span>
                                <span className="text-muted-foreground">
                                    {c.scheduledAt ? f.dateTime(c.scheduledAt) : c.requestedText ? fmt(t("asked for: {text}"), { text: c.requestedText }) : t("needs a time")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </SectionCard>
    );
}
