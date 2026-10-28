"use client";

/**
 * Details of a calendar entry that the calendar does not edit: campaign calls, school
 * events and holidays. Campaigns keep their own approval, audio checks and pause
 * rules, so the calendar links to the campaign page instead of pretending to edit
 * them; holidays link to school settings. Callbacks use CallbackDetailDialog.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/context/language-context";
import type { CalendarEvent } from "@/lib/api/sampark-calendar";
import { formatInZone } from "@/lib/sampark/callbacks/time";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useCampaignSummary } from "../campaign-summary";
import { useSamparkSchool } from "../school-context";
import { EventStatusPill, eventPurposeName, eventTitle, eventTypeName } from "./event-labels";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-foreground">{children}</dd>
        </>
    );
}

function holdText(t: (s: string) => string, reason: string | null): string | null {
    switch (reason) {
        case "school_paused": return t("Calls are paused for the school");
        case "mode_changed": return t("The calling mode changed after approval; the campaign does not dial until it is approved again");
        case "mode_not_pinned": return t("Approved before modes were recorded; it is never dialled");
        case "render_failed": return t("A recording failed its check; nothing was dialled");
        default: return null;
    }
}

export function EventDetailDialog({
    event,
    timeZone,
    people,
    onOpenChange,
}: {
    event: CalendarEvent | null;
    timeZone: string;
    people: Record<string, string>;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const { school } = useSamparkSchool();
    const summary = useCampaignSummary();
    if (!event) return null;
    const c = event.campaign;
    const who = (uid: string | null) => (uid ? people[uid] ?? t("A school administrator") : null);
    const when = event.allDay
        ? new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(event.start))
        : event.type === "campaign_calls"
            ? `${formatInZone(new Date(event.start), timeZone)} → ${formatInZone(new Date(event.end), timeZone)}`
            : formatInZone(new Date(event.start), timeZone);

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{eventTitle(t, event)}</DialogTitle>
                    <DialogDescription>{eventTypeName(t, event.type)}{event.purpose ? ` · ${eventPurposeName(t, event)}` : ""}</DialogDescription>
                </DialogHeader>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <Row label={t("Status")}><EventStatusPill status={event.status} /></Row>
                    <Row label={event.type === "campaign_calls" ? t("Calling window") : t("When")}>{when}{event.allDay ? ` · ${t("all day")}` : ""}</Row>
                    {event.facts && <Row label={t("About")}>{summary.facts(event.facts, school)}</Row>}
                    {c && (
                        <>
                            <Row label={t("Who is called")}>{summary.audience({ sections: c.sections })}</Row>
                            <Row label={t("Families")}>
                                {c.families} · {t("queued")} {c.queued} · {t("calling")} {c.inFlight} · {t("heard")} {c.heardKeyFact} · {t("no answer")} {c.noAnswer} · {t("failed")} {c.failed} · {t("not called")} {c.blocked}
                            </Row>
                        </>
                    )}
                    {event.type === "school_event" && event.campaignIds.length > 1 && (
                        <Row label={t("Announced by")}>{event.campaignIds.length} {t("campaigns")}</Row>
                    )}
                    {holdText(t, event.reason) && <Row label={t("Why")}>{holdText(t, event.reason)}</Row>}
                    {who(event.createdBy) && <Row label={t("Created by")}>{who(event.createdBy)}</Row>}
                    {who(event.approvedBy) && <Row label={t("Approved by")}>{who(event.approvedBy)}</Row>}
                    {event.type === "holiday" && <Row label={t("Calls")}>{t("Routine calls are not placed on school holidays. Emergency closures still go out.")}</Row>}
                </dl>
                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Close")}</Button>
                    {event.manage?.kind === "link" && (
                        <Button asChild>
                            <Link href={href(event.manage.path)}>
                                {event.manage.label === "campaign" ? t("Open campaign") : t("Open school settings")}
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
