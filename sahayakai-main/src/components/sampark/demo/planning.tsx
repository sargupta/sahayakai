"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { CallbackStatusPill } from "@/components/sampark/callbacks/callback-status";
import { dayKeyOf, dayLabel, keyString, monthLabel, shiftAnchor, timeLabel, viewRange, fromLocalInput, toLocalInput, type DayKey } from "@/components/sampark/callbacks/callback-dates";
import { EventStatusPill, TypeMark, eventTitle, eventTypeName } from "@/components/sampark/calendar/event-labels";
import { useLanguage } from "@/context/language-context";
import type { CalendarEvent, CalendarEventType } from "@/lib/sampark/calendar/events";
import { CALENDAR_EVENT_TYPES } from "@/lib/sampark/calendar/events";
import { DEMO_TZ } from "@/lib/sampark/demo/calendar";
import { REFUSAL_TEXT, checkCallbackTime } from "@/lib/sampark/demo/rules";
import { classById, studentById, teacherById } from "@/lib/sampark/demo/school";
import { REASON_LABEL } from "@/lib/sampark/demo/script";
import { CALLBACK_ACTIONS, addCallback, updateCallback } from "@/lib/sampark/demo/store";
import type { DemoCallback, DemoRole, DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { AttentionRow, Panel } from "../console-ui";
import { whenLabel } from "./demo-labels";

const EVENT_TONE: Record<CalendarEventType, string> = {
    callback: "border-sampark-peach-border bg-sampark-peach",
    scheduled_call: "border-sampark-indigo-border bg-sampark-indigo-soft",
    campaign_calls: "border-sampark-peach-border bg-card",
    school_event: "border-sampark-leaf-border bg-sampark-leaf-soft",
    holiday: "border-sampark-line bg-sampark-slate-soft",
};

function newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Schedule a callback ──────────────────────────────────────────────────────

/**
 * Book (or confirm a time for) a callback. The time is checked against the
 * calling rules; a refused time shows why and offers the next permitted one.
 */
export function ScheduleCallbackDialog({
    open,
    onOpenChange,
    student,
    reason,
    sourceCallId = null,
    placedBy,
    existing = null,
    holidays,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: DemoStudent | null;
    reason: OutreachReason;
    sourceCallId?: string | null;
    placedBy: { role: DemoRole; name: string };
    /** A parent's request or a missed callback that needs a (new) time. */
    existing?: DemoCallback | null;
    holidays: string[];
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [when, setWhen] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<Date | null>(null);

    useEffect(() => {
        if (!open) return;
        const start = new Date(Date.now() + 2 * 3_600_000);
        const check = checkCallbackTime(start, new Date(), holidays);
        setWhen(toLocalInput(check.ok ? start : check.next ?? start, DEMO_TZ));
        setNote(existing?.note ?? "");
        setError(null);
        setSuggestion(null);
    }, [open, existing, holidays]);

    if (!student) return null;
    const cls = classById(student.classId);
    const teacher = cls ? teacherById(cls.teacherId) : undefined;

    const save = () => {
        const at = fromLocalInput(when, DEMO_TZ);
        if (!at) {
            setError(t("Choose a date and time."));
            return;
        }
        const check = checkCallbackTime(at, new Date(), holidays);
        if (!check.ok) {
            setError(t(REFUSAL_TEXT[check.why]));
            setSuggestion(check.next);
            return;
        }
        if (existing) {
            updateCallback(existing.id, { status: "scheduled", scheduledAt: at.toISOString() });
        } else {
            addCallback({
                id: newId("cb"),
                studentId: student.id,
                classId: student.classId,
                teacherId: teacher?.id ?? "",
                reason,
                status: "scheduled",
                scheduledAt: at.toISOString(),
                note: note.trim() || t("Follow up on the last call."),
                source: "staff",
                createdBy: placedBy,
                createdAt: new Date().toISOString(),
                sourceCallId,
                resultCallId: null,
            });
        }
        toast({ title: t("Callback scheduled"), description: fmt(t("{family} · {when}"), { family: student.guardian.name, when: whenLabel(at.toISOString()) }) });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{existing ? t("Confirm a time for this callback") : t("Schedule a callback")}</DialogTitle>
                    <DialogDescription>
                        {student.guardian.name} ({t(student.guardian.relation)}) · {student.name} · {cls?.name} · {t(REASON_LABEL[reason])}
                    </DialogDescription>
                </DialogHeader>
                {existing?.source === "parent_request" && (
                    <AttentionRow tone="live">
                        <span className="font-medium">{t("The parent asked:")}</span> {existing.note}
                    </AttentionRow>
                )}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cb-when">{t("When (India time)")}</Label>
                        <Input
                            id="cb-when"
                            type="datetime-local"
                            value={when}
                            onChange={(e) => {
                                setWhen(e.target.value);
                                setError(null);
                                setSuggestion(null);
                            }}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "cb-error" : "cb-hint"}
                        />
                        <p id="cb-hint" className="text-xs text-ink-500">
                            {t("Parents are called 10:00–20:00, Monday to Saturday, never on school holidays.")}
                        </p>
                        {error && (
                            <div id="cb-error" role="alert" className="space-y-2 rounded-lg border border-sampark-rose-border bg-sampark-rose-soft p-3 text-sm text-ink-800">
                                <p>{error}</p>
                                {suggestion && (
                                    <Button size="sm" variant="outline" onClick={() => { setWhen(toLocalInput(suggestion, DEMO_TZ)); setError(null); setSuggestion(null); }}>
                                        {fmt(t("Use {when} instead"), { when: whenLabel(suggestion.toISOString()) })}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                    {!existing && (
                        <div className="space-y-2">
                            <Label htmlFor="cb-note">{t("Note for the call")}</Label>
                            <Textarea id="cb-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("What this callback is for")} />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        {t("Cancel")}
                    </Button>
                    <Button onClick={save}>
                        <CalendarClock aria-hidden="true" className="mr-2 h-4 w-4" />
                        {existing ? t("Confirm time") : t("Schedule")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Callback list ────────────────────────────────────────────────────────────

export function CallbackList({
    callbacks,
    viewerRole,
    onConfirm,
    onCallNow,
    empty,
}: {
    callbacks: DemoCallback[];
    viewerRole: DemoRole;
    onConfirm: (cb: DemoCallback) => void;
    onCallNow: (cb: DemoCallback) => void;
    empty: string;
}) {
    const { t } = useLanguage();
    if (callbacks.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
    return (
        <ul className="divide-y divide-sampark-line">
            {callbacks.map((cb) => {
                const student = studentById(cb.studentId);
                const teacher = teacherById(cb.teacherId);
                const actions = CALLBACK_ACTIONS[cb.status];
                return (
                    <li key={cb.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="flex flex-wrap items-center gap-2">
                                <CallbackStatusPill status={cb.status} />
                                <span className="font-medium text-ink-900">{student?.guardian.name}</span>
                                <span className="text-xs text-ink-500">
                                    {student?.name} · {fmt(t("Class {id}"), { id: cb.classId })}
                                    {viewerRole === "admin" && teacher ? ` · ${teacher.name}` : ""}
                                </span>
                            </p>
                            <p className="text-sm text-ink-600">
                                <span className="font-medium text-ink-800">{cb.scheduledAt ? whenLabel(cb.scheduledAt) : t("No time yet")}</span>
                                {" · "}
                                {t(REASON_LABEL[cb.reason])}
                                {cb.source === "parent_request" && <> · {t("Parent's request")}</>}
                            </p>
                            <p className="line-clamp-2 text-xs text-ink-500">{cb.note}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            {actions.includes("scheduled") && (
                                <Button size="sm" variant="outline" onClick={() => onConfirm(cb)}>
                                    {cb.status === "proposed" ? t("Confirm a time") : t("Reschedule")}
                                </Button>
                            )}
                            {cb.status === "scheduled" && (
                                <Button size="sm" onClick={() => onCallNow(cb)}>
                                    <Phone aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                    {t("Call now")}
                                </Button>
                            )}
                            {actions.includes("cancelled") && (
                                <Button size="sm" variant="ghost" onClick={() => updateCallback(cb.id, { status: "cancelled" })}>
                                    {t("Cancel")}
                                </Button>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

type View = "week" | "month" | "agenda";

function EventChip({ e, onOpen, compact = false }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void; compact?: boolean }) {
    const { t } = useLanguage();
    return (
        <button
            type="button"
            onClick={() => onOpen(e)}
            className={cn("focus-ring flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs text-ink-800 transition-colors hover:border-ink-400", EVENT_TONE[e.type])}
            title={`${eventTypeName(t, e.type)} · ${eventTitle(t, e)}`}
        >
            {!compact && <TypeMark type={e.type} className="h-5 w-6 text-xs" />}
            <span className="min-w-0 flex-1 truncate">
                {!e.allDay && <span className="font-medium">{timeLabel(new Date(e.start), DEMO_TZ)} </span>}
                {eventTitle(t, e)}
            </span>
            {e.needsAction && <span aria-label={t("Needs a person")} className="h-1.5 w-1.5 shrink-0 rounded-full bg-sampark-saffron" />}
        </button>
    );
}

export function DemoCalendar({
    events,
    onOpenCallback,
    campaignHref,
}: {
    events: CalendarEvent[];
    onOpenCallback: (callbackId: string) => void;
    /** Where a campaign event links to; null hides the link (teachers). */
    campaignHref: ((campaignId: string) => string) | null;
}) {
    const { t } = useLanguage();
    const [view, setView] = useState<View>("week");
    const [anchor, setAnchor] = useState<DayKey>(() => dayKeyOf(new Date(), DEMO_TZ));
    const [types, setTypes] = useState<Set<CalendarEventType>>(() => new Set(CALENDAR_EVENT_TYPES));
    const [open, setOpen] = useState<CalendarEvent | null>(null);
    const todayKey = keyString(dayKeyOf(new Date(), DEMO_TZ));

    const shown = useMemo(() => events.filter((e) => types.has(e.type)), [events, types]);
    const byDay = useMemo(() => {
        const m = new Map<string, CalendarEvent[]>();
        for (const e of shown) m.set(e.date, [...(m.get(e.date) ?? []), e]);
        return m;
    }, [shown]);

    const range = viewRange(view === "agenda" ? "week" : view, anchor, DEMO_TZ);
    const agendaDays = useMemo(() => {
        const days: DayKey[] = [];
        let k = anchor;
        for (let i = 0; i < 21; i++) {
            days.push(k);
            k = shiftAnchor("day", k, 1);
        }
        return days;
    }, [anchor]);

    const openEvent = (e: CalendarEvent) => {
        if (e.manage?.kind === "callback") onOpenCallback(e.manage.callbackId);
        else setOpen(e);
    };

    const title = view === "month" ? monthLabel(anchor) : `${dayLabel(range.days[0], "short")} – ${dayLabel(range.days[range.days.length - 1], "short")}`;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" aria-label={t("Previous")} onClick={() => setAnchor((a) => shiftAnchor(view === "month" ? "month" : "week", a, -1))}>
                        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAnchor(dayKeyOf(new Date(), DEMO_TZ))}>
                        {t("Today")}
                    </Button>
                    <Button size="icon" variant="outline" aria-label={t("Next")} onClick={() => setAnchor((a) => shiftAnchor(view === "month" ? "month" : "week", a, 1))}>
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <h2 className="ml-1 font-display text-lg font-semibold text-ink-900">{view === "agenda" ? t("Next three weeks") : title}</h2>
                </div>
                <div role="tablist" aria-label={t("Calendar view")} className="flex rounded-lg border border-sampark-line bg-card p-0.5">
                    {(["week", "month", "agenda"] as View[]).map((v) => (
                        <button
                            key={v}
                            role="tab"
                            aria-selected={view === v}
                            onClick={() => setView(v)}
                            className={cn("focus-ring rounded-md px-3 py-1.5 text-sm", view === v ? "bg-sampark-peach font-medium text-sampark-saffron-strong" : "text-ink-600 hover:text-ink-900")}
                        >
                            {v === "week" ? t("Week") : v === "month" ? t("Month") : t("Agenda")}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Show on the calendar")}>
                {CALENDAR_EVENT_TYPES.map((type) => {
                    const on = types.has(type);
                    return (
                        <button
                            key={type}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setTypes((prev) => { const n = new Set(prev); if (n.has(type)) n.delete(type); else n.add(type); return n; })}
                            className={cn("focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? EVENT_TONE[type] + " text-ink-900" : "border-sampark-line bg-card text-ink-400 line-through")}
                        >
                            <TypeMark type={type} className="h-4 w-5 text-xs" />
                            {eventTypeName(t, type)}
                        </button>
                    );
                })}
            </div>

            {view === "week" && (
                <div className="grid gap-2 md:grid-cols-7">
                    {range.days.map((d) => {
                        const key = keyString(d);
                        const list = byDay.get(key) ?? [];
                        return (
                            <div key={key} className={cn("min-h-[132px] rounded-xl border bg-card p-2", key === todayKey ? "border-sampark-saffron" : "border-sampark-line")}>
                                <p className={cn("mb-2 text-xs font-medium", key === todayKey ? "text-sampark-saffron-strong" : "text-ink-500")}>
                                    {dayLabel(d, "short")}
                                    {key === todayKey && ` · ${t("Today")}`}
                                </p>
                                <div className="space-y-1">
                                    {list.length === 0 ? <p className="text-xs text-ink-400">—</p> : list.map((e) => <EventChip key={e.key} e={e} onOpen={openEvent} />)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {view === "month" && (
                <div className="overflow-x-auto">
                    <div className="grid min-w-[640px] grid-cols-7 gap-1">
                        {[t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat"), t("Sun")].map((d) => (
                            <p key={d} className="px-1 text-xs font-medium text-ink-500">{d}</p>
                        ))}
                        {range.days.map((d) => {
                            const key = keyString(d);
                            const list = byDay.get(key) ?? [];
                            const inMonth = d.month === anchor.month;
                            return (
                                <div key={key} className={cn("min-h-[92px] rounded-lg border p-1.5", key === todayKey ? "border-sampark-saffron bg-card" : "border-sampark-line", inMonth ? "bg-card" : "bg-sampark-slate-soft opacity-70")}>
                                    <p className={cn("text-xs", key === todayKey ? "font-semibold text-sampark-saffron-strong" : "text-ink-500")}>{d.day}</p>
                                    <div className="mt-1 space-y-1">
                                        {list.slice(0, 3).map((e) => <EventChip key={e.key} e={e} onOpen={openEvent} compact />)}
                                        {list.length > 3 && <p className="text-xs text-ink-500">{fmt(t("+{n} more"), { n: list.length - 3 })}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {view === "agenda" && (
                <div className="space-y-3">
                    {agendaDays.filter((d) => (byDay.get(keyString(d)) ?? []).length > 0).length === 0 && (
                        <p className="text-sm text-ink-500">{t("Nothing in the next three weeks.")}</p>
                    )}
                    {agendaDays.map((d) => {
                        const list = byDay.get(keyString(d)) ?? [];
                        if (list.length === 0) return null;
                        return (
                            <div key={keyString(d)} className="rounded-xl border border-sampark-line bg-card p-3">
                                <p className="mb-2 text-sm font-medium text-ink-900">{dayLabel(d)}</p>
                                <ul className="space-y-2">
                                    {list.map((e) => (
                                        <li key={e.key}>
                                            <button type="button" onClick={() => openEvent(e)} className="focus-ring flex w-full flex-wrap items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-sampark-slate-soft">
                                                <TypeMark type={e.type} />
                                                <span className="w-14 text-xs text-ink-500">{e.allDay ? t("All day") : timeLabel(new Date(e.start), DEMO_TZ)}</span>
                                                <span className="min-w-0 flex-1 text-sm text-ink-900">{eventTitle(t, e)}</span>
                                                <EventStatusPill status={e.status} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
                <DialogContent className="max-w-md">
                    {open && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{eventTitle(t, open)}</DialogTitle>
                                <DialogDescription>
                                    {eventTypeName(t, open.type)} · {open.allDay ? dayLabel(dayKeyOf(new Date(open.start), DEMO_TZ)) : whenLabel(open.start)}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap items-center gap-2">
                                <EventStatusPill status={open.status} />
                                {open.campaign && (
                                    <StatusPill tone="neutral">
                                        {open.campaign.sections.length === 0
                                            ? t("Whole school")
                                            : open.campaign.sections.map((s) => `${s.grade}${s.section}`).join(", ")}
                                    </StatusPill>
                                )}
                            </div>
                            {open.campaign && (
                                <p className="text-sm text-ink-600">
                                    {fmt(t("{heard} of {families} parents heard the notice · {queued} still to call"), {
                                        heard: open.campaign.heardKeyFact,
                                        families: open.campaign.families,
                                        queued: open.campaign.queued,
                                    })}
                                </p>
                            )}
                            {open.type === "holiday" && <p className="text-sm text-ink-600">{t("A school holiday: no routine calls go out. Emergency notices still can.")}</p>}
                            {campaignHref && open.campaignIds.length > 0 && (
                                <DialogFooter>
                                    <Button asChild variant="outline">
                                        <Link href={campaignHref(open.campaignIds[0])}>{t("Open the campaign")}</Link>
                                    </Button>
                                </DialogFooter>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Shared page body for the teacher and admin calendar pages. */
export function CalendarAndCallbacks({
    events,
    callbacks,
    viewerRole,
    placedBy,
    holidays,
    campaignHref,
    onCallNow,
}: {
    events: CalendarEvent[];
    callbacks: DemoCallback[];
    viewerRole: DemoRole;
    placedBy: { role: DemoRole; name: string };
    holidays: string[];
    campaignHref: ((id: string) => string) | null;
    onCallNow: (cb: DemoCallback) => void;
}) {
    const { t } = useLanguage();
    const [confirming, setConfirming] = useState<DemoCallback | null>(null);
    const waiting = callbacks.filter((c) => c.status === "proposed" || c.status === "missed" || c.status === "failed");
    const upcoming = callbacks
        .filter((c) => c.status === "scheduled")
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    const confirmingStudent = confirming ? studentById(confirming.studentId) ?? null : null;
    return (
        <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel tone={waiting.length > 0 ? "live" : "plain"} title={t("Waiting for a person")} description={t("Parents' requests and missed callbacks. None of these ring until someone sets a time.")}>
                    <CallbackList callbacks={waiting} viewerRole={viewerRole} onConfirm={setConfirming} onCallNow={onCallNow} empty={t("Nothing waiting.")} />
                </Panel>
                <Panel title={t("Coming up")} description={t("Callbacks with a confirmed time.")}>
                    <CallbackList callbacks={upcoming.slice(0, 6)} viewerRole={viewerRole} onConfirm={setConfirming} onCallNow={onCallNow} empty={t("No callbacks booked. Book one from a call's summary or the follow-ups list.")} />
                </Panel>
            </div>
            <Panel>
                <DemoCalendar
                    events={events}
                    campaignHref={campaignHref}
                    onOpenCallback={(id) => {
                        const cb = callbacks.find((c) => c.id === id);
                        if (cb) setConfirming(cb);
                    }}
                />
            </Panel>
            <ScheduleCallbackDialog
                open={Boolean(confirming)}
                onOpenChange={(o) => !o && setConfirming(null)}
                student={confirmingStudent}
                reason={confirming?.reason ?? "behavioral_concern"}
                sourceCallId={confirming?.sourceCallId ?? null}
                placedBy={placedBy}
                existing={confirming}
                holidays={holidays}
            />
        </div>
    );
}
