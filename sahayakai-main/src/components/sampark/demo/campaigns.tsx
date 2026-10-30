"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Megaphone, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CampaignStatusBadge } from "@/components/sampark/status-pill";
import { closureReasonLabel, eventTypeLabel, fmt, purposeLabel } from "@/components/sampark/labels";
import { OutcomeDonut, campaignOutcome, segmentsSummary } from "@/components/sampark/outcome-chart";
import { useLanguage } from "@/context/language-context";
import { DEMO_VENUES, demoHolidays } from "@/lib/sampark/demo/seed-planning";
import { nextAllowed } from "@/lib/sampark/demo/rules";
import { DEMO_SCHOOL_ID, getDemoSchool } from "@/lib/sampark/demo/school";
import { addCampaign, setCampaignStatus } from "@/lib/sampark/demo/store";
import type { DemoCampaign } from "@/lib/sampark/demo/types";
import type { CampaignCounts, CampaignFacts, EventType } from "@/types/sampark";
import { cn } from "@/lib/utils";
import { Panel, ProgressBar, ToneIcon } from "../console-ui";
import { whenLabel } from "./demo-labels";

type Translate = (s: string) => string;

const LIVE = new Set(["dispatching", "scheduled", "rendering"]);

export function campaignTitle(t: Translate, c: DemoCampaign): string {
    const f = c.facts;
    if (f.kind === "event_invite") return eventTypeLabel(t, f.eventType);
    if (f.kind === "emergency_closure") return `${t("School closed")} · ${closureReasonLabel(t, f.reason)}`;
    return purposeLabel(t, c.purpose);
}

export function audienceText(t: Translate, c: DemoCampaign): string {
    return c.audience.sections.length === 0 ? t("Whole school") : c.audience.sections.map((s) => `${t("Class")} ${s.grade}${s.section}`).join(", ");
}

export function factsText(t: Translate, c: DemoCampaign): string {
    const f = c.facts;
    const date = new Date(`${f.date}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    if (f.kind === "emergency_closure") return `${date} · ${f.busesRunning ? t("buses running") : t("no buses")}`;
    const time = `${f.time.hour % 12 || 12}:${String(f.time.minute).padStart(2, "0")} ${f.time.hour < 12 ? "am" : "pm"}`;
    return `${date}, ${time} · ${t(DEMO_VENUES[f.venueId] ?? f.venueId)}`;
}

function familiesFor(sections: { grade: number; section: string }[]): number {
    const school = getDemoSchool();
    return sections.length === 0 ? school.students.length : school.students.filter((s) => sections.some((x) => `${x.grade}${x.section}` === s.classId)).length;
}

/** Simulated progress for Practice: what a run of the dispatcher would report. */
function simulate(c: DemoCampaign, stage: "start" | "finish"): CampaignCounts {
    const n = c.counts.guardians;
    const blocked = Math.max(1, Math.round(n * 0.02));
    const reachable = n - blocked;
    const heard = Math.round(reachable * (stage === "start" ? 0.48 : 0.9));
    const ptm = c.purpose === "ptm_invite";
    const yes = ptm ? Math.round(heard * 0.78) : 0;
    const declined = ptm ? Math.round(heard * 0.12) : 0;
    const noAnswer = stage === "start" ? Math.round(reachable * 0.06) : reachable - heard - 1;
    const failed = stage === "start" ? 0 : 1;
    const inFlight = stage === "start" ? 2 : 0;
    const queued = Math.max(0, reachable - heard - noAnswer - failed - inFlight);
    return { guardians: n, blocked, queued, inFlight, heardKeyFact: heard, confirmedYes: yes, declinedOrOther: declined, noAnswer, failed, optOuts: 0 };
}

export function CampaignActions({ c, compact = false }: { c: DemoCampaign; compact?: boolean }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const size = compact ? "sm" : "default";
    if (c.status === "draft") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    size={size}
                    onClick={() => {
                        const n = c.counts.guardians;
                        const blocked = Math.max(1, Math.round(n * 0.02));
                        // The next permitted calling time (never a Sunday, holiday or night).
                        const now = new Date();
                        const firstSlot = nextAllowed(now, now, demoHolidays(now.getTime())) ?? now;
                        setCampaignStatus(c.id, "scheduled", {
                            approvedAt: new Date().toISOString(),
                            approvedBy: getDemoSchool().admin.id,
                            notBefore: firstSlot.toISOString(),
                            renderProgress: { done: 8, total: 8, failures: [] },
                            counts: { ...c.counts, blocked, queued: n - blocked },
                        });
                        toast({ title: t("Approved and scheduled"), description: fmt(t("Calls start {when}, inside calling hours."), { when: whenLabel(firstSlot.toISOString()) }) });
                    }}
                >
                    {t("Approve and schedule")}
                </Button>
                <Button size={size} variant="ghost" onClick={() => setCampaignStatus(c.id, "cancelled")}>
                    {t("Discard")}
                </Button>
            </div>
        );
    }
    if (c.status === "scheduled") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button size={size} onClick={() => { setCampaignStatus(c.id, "dispatching", { counts: simulate(c, "start"), notBefore: new Date().toISOString() }); toast({ title: t("Calling started (practice)"), description: t("Simulated: no phone rings in the demo.") }); }}>
                    {t("Start calling now")}
                </Button>
                <Button size={size} variant="ghost" onClick={() => setCampaignStatus(c.id, "cancelled")}>
                    {t("Cancel campaign")}
                </Button>
            </div>
        );
    }
    if (c.status === "dispatching") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button size={size} onClick={() => { setCampaignStatus(c.id, "completed", { counts: simulate(c, "finish") }); toast({ title: t("Campaign finished (practice)") }); }}>
                    {t("Finish calling")}
                </Button>
                <Button size={size} variant="ghost" onClick={() => setCampaignStatus(c.id, "cancelled")}>
                    {t("Stop calls")}
                </Button>
            </div>
        );
    }
    return null;
}

export function CampaignCard({ c, href, canManage }: { c: DemoCampaign; href: string | null; canManage: boolean }) {
    const { t } = useLanguage();
    const outcome = campaignOutcome(t, c.purpose, c.counts, c.status === "dispatching");
    const called = c.counts.guardians - c.counts.blocked - c.counts.queued - c.counts.inFlight;
    const live = c.status === "dispatching";
    const body = (
        <>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <ToneIcon icon={c.facts.kind === "emergency_closure" ? Megaphone : CalendarDays} tone={live ? "live" : c.status === "completed" ? "done" : c.status === "draft" ? "plain" : "notice"} />
                    <div className="min-w-0">
                        <p className="font-display text-base font-semibold text-ink-900">{campaignTitle(t, c)}</p>
                        <p className="text-sm text-ink-500">
                            {factsText(t, c)} · {audienceText(t, c)}
                        </p>
                    </div>
                </div>
                <CampaignStatusBadge status={c.status} />
            </div>
            {c.status !== "draft" && c.status !== "cancelled" && (
                <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="text-ink-600">{fmt(t("{n} of {total} families called"), { n: Math.max(0, called), total: c.counts.guardians - c.counts.blocked })}</span>
                            <span className="font-display text-lg font-semibold text-ink-900">{c.counts.heardKeyFact}</span>
                        </div>
                        <ProgressBar value={Math.max(0, called)} max={c.counts.guardians - c.counts.blocked} tone={c.status === "completed" ? "done" : "live"} label={t("Families called")} />
                        <p className="text-xs text-ink-500">{segmentsSummary(outcome.segments, (n) => String(n))}</p>
                    </div>
                </div>
            )}
            {c.status === "draft" && <p className="mt-3 text-sm text-ink-500">{fmt(t("Draft · {n} families · waiting for your approval"), { n: c.counts.guardians })}</p>}
        </>
    );
    return (
        <div className={cn("rounded-xl border p-4 shadow-sampark-card md:p-6", live ? "border-sampark-peach-border bg-sampark-peach" : "border-sampark-line bg-card")}>
            {href ? (
                <Link href={href} className="focus-ring -m-1 block rounded-lg p-1 hover:opacity-90">
                    {body}
                </Link>
            ) : (
                body
            )}
            {canManage && (
                <div className="mt-4 border-t border-sampark-line/70 pt-3">
                    <CampaignActions c={c} compact />
                </div>
            )}
        </div>
    );
}

export function CampaignOutcomePanel({ c }: { c: DemoCampaign }) {
    const { t } = useLanguage();
    const outcome = campaignOutcome(t, c.purpose, c.counts, c.status === "dispatching");
    const reachable = c.counts.guardians - c.counts.blocked;
    const pct = reachable > 0 ? Math.round((c.counts.heardKeyFact / reachable) * 100) : 0;
    return (
        <Panel title={t("Outcomes so far")} description={t("Each family counts once, on their latest call.")}>
            <OutcomeDonut segments={outcome.segments} label={t("Outcomes")} centre={`${pct}%`} caption={t("heard the notice")} />
        </Panel>
    );
}

const PURPOSES = [
    { id: "ptm_invite", label: "Parent-teacher meeting" },
    { id: "event_invite", label: "School event" },
    { id: "emergency_closure", label: "Emergency closure" },
] as const;

const EVENT_TYPES: EventType[] = ["annual_day", "sports_day", "science_fair", "cultural_programme", "parent_workshop"];

export function NewCampaignDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
    const { t } = useLanguage();
    const school = getDemoSchool();
    const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]["id"]>("ptm_invite");
    const [eventType, setEventType] = useState<EventType>("annual_day");
    const [classes, setClasses] = useState<Set<string>>(new Set());
    const [date, setDate] = useState("");
    const [time, setTime] = useState("10:00");
    const [error, setError] = useState<string | null>(null);

    const create = () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            setError(t("Choose the date."));
            return;
        }
        if (new Date(`${date}T23:59:00+05:30`).getTime() < Date.now()) {
            setError(t("The date has already passed."));
            return;
        }
        const [hh, mm] = time.split(":").map(Number);
        if (purpose !== "emergency_closure" && (mm !== 0 && mm !== 30)) {
            setError(t("Use a whole or half hour, so every language can say it naturally."));
            return;
        }
        const sections = [...classes].sort().map((id) => ({ grade: Number(id.slice(0, -1)), section: id.slice(-1) }));
        const facts: CampaignFacts =
            purpose === "ptm_invite"
                ? { kind: "ptm_invite", date, time: { hour: hh, minute: (mm === 30 ? 30 : 0) as 0 | 30 }, venueId: "hall" }
                : purpose === "event_invite"
                  ? { kind: "event_invite", eventType, date, time: { hour: hh, minute: (mm === 30 ? 30 : 0) as 0 | 30 }, venueId: eventType === "sports_day" ? "ground" : "hall" }
                  : { kind: "emergency_closure", date, reason: "heavy_rain", busesRunning: false };
        const id = `camp-${Date.now().toString(36)}`;
        const n = familiesFor(sections);
        const c: DemoCampaign = {
            id,
            orgId: DEMO_SCHOOL_ID,
            purpose,
            facts,
            audience: { sections },
            status: "draft",
            notBefore: null,
            expiresAt: new Date(`${date}T08:00:00+05:30`).toISOString(),
            createdBy: school.admin.id,
            createdByName: school.admin.name,
            createdAt: new Date().toISOString(),
            approvedBy: null,
            approvedAt: null,
            renderProgress: { done: 0, total: 8, failures: [] },
            counts: { guardians: n, blocked: 0, queued: 0, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0 },
            mode: "practice",
            holdReason: null,
            updatedAt: new Date().toISOString(),
        };
        addCampaign(c);
        onOpenChange(false);
        onCreated(id);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (o) {
                    setError(null);
                    setClasses(new Set());
                    setDate("");
                }
                onOpenChange(o);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t("New campaign")}</DialogTitle>
                    <DialogDescription>{t("A notice every family in the chosen classes hears in their own language. It starts as a draft; nothing is called until you approve it.")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t("What is it about?")}</Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {PURPOSES.map((p) => (
                                <button key={p.id} type="button" aria-pressed={purpose === p.id} onClick={() => setPurpose(p.id)} className={cn("focus-ring rounded-lg border px-3 py-2 text-left text-sm", purpose === p.id ? "border-sampark-saffron bg-sampark-peach font-medium text-ink-900" : "border-sampark-line text-ink-700 hover:bg-sampark-slate-soft")}>
                                    {t(p.label)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {purpose === "event_invite" && (
                        <div className="space-y-2">
                            <Label>{t("Event")}</Label>
                            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map((e) => (
                                        <SelectItem key={e} value={e}>
                                            {eventTypeLabel(t, e)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>{t("Families to call")}</Label>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" aria-pressed={classes.size === 0} onClick={() => setClasses(new Set())} className={cn("focus-ring rounded-full border px-3 py-1 text-sm", classes.size === 0 ? "border-sampark-saffron bg-sampark-peach text-ink-900" : "border-sampark-line text-ink-600")}>
                                <Users aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                                {t("Whole school")}
                            </button>
                            {school.classes.map((c) => {
                                const on = classes.has(c.id);
                                return (
                                    <button key={c.id} type="button" aria-pressed={on} onClick={() => setClasses((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} className={cn("focus-ring rounded-full border px-3 py-1 text-sm", on ? "border-sampark-saffron bg-sampark-peach text-ink-900" : "border-sampark-line text-ink-600 hover:bg-sampark-slate-soft")}>
                                        {c.id}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-ink-500">{fmt(t("{n} families"), { n: familiesFor([...classes].map((id) => ({ grade: Number(id.slice(0, -1)), section: id.slice(-1) }))) })}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="camp-date">{purpose === "emergency_closure" ? t("Day the school is closed") : t("Date")}</Label>
                            <Input id="camp-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} />
                        </div>
                        {purpose !== "emergency_closure" && (
                            <div className="space-y-2">
                                <Label htmlFor="camp-time">{t("Time")}</Label>
                                <Input id="camp-time" type="time" step={1800} value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} />
                            </div>
                        )}
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-sampark-rose">
                            {error}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        {t("Cancel")}
                    </Button>
                    <Button onClick={create}>
                        <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                        {t("Create draft")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function campaignWhen(c: DemoCampaign): string {
    return c.notBefore ? whenLabel(c.notBefore) : "—";
}

export { LIVE as LIVE_CAMPAIGN_STATES };
