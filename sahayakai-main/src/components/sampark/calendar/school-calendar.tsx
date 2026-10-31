"use client";

/**
 * The SamparkAI calendar: everything genuinely scheduled for the school — callbacks
 * and staff-scheduled calls, campaign calls, the PTMs / events / closures campaigns
 * announce, and holidays — in Year / Month / Week / Day views, a chronological agenda,
 * summaries for the period shown, and filters. Read from the server's calendar layer
 * (src/server/sampark/calendar.ts); every change goes through the callback dialogs
 * or the campaign pages, which keep their checks. Nothing here starts a call.
 */

import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EmptyState, SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";
import { listCallbackSources, type CallbackView } from "@/lib/api/sampark-callbacks";
import { loadCalendar, type CalendarEvent, type CalendarEventType, type CalendarStatus } from "@/lib/api/sampark-calendar";
import { CALENDAR_EVENT_TYPES, callbackEvent, summarise } from "@/lib/sampark/calendar/events";
import { DEFAULT_CALLBACK_TIME_ZONE } from "@/lib/sampark/callbacks/time";
import { cn } from "@/lib/utils";
import { fmt } from "../labels";
import { ErrorPanel, LoadingBlock } from "../states";
import { useSamparkQuery } from "../use-sampark-query";
import { CallbackDetailDialog, NewCallbackDialog } from "../callbacks/callback-dialogs";
import { dayKeyOf, dayLabel, keyString, monthLabel, shiftAnchor, timeLabel, viewRange, yearChunks, type CalendarView, type DayKey } from "../callbacks/callback-dates";
import { YearView } from "./year-view";
import { CalendarTabs } from "./calendar-tabs";
import type { CalendarResponse } from "@/lib/api/sampark-calendar";
import { EventDetailDialog } from "./event-detail-dialog";
import { EventStatusPill, TypeMark, eventPurposeName, eventTitle, eventTypeName } from "./event-labels";

const POLL_MS = 30_000;
const AGENDA_DAYS = 60;
const VIEWS: CalendarView[] = ["day", "week", "month", "year"];

type StatusFilter = "all" | "action" | "scheduled" | "in_progress" | "completed" | "failed" | "cancelled";
const STATUS_GROUPS: Record<Exclude<StatusFilter, "all" | "action">, CalendarStatus[]> = {
    scheduled: ["scheduled", "preparing", "upcoming", "on_hold"],
    in_progress: ["in_progress"],
    completed: ["completed", "past"],
    failed: ["failed", "missed"],
    cancelled: ["cancelled"],
};

function viewName(t: (s: string) => string, v: CalendarView): string {
    return v === "day" ? t("Day") : v === "week" ? t("Week") : v === "month" ? t("Month") : t("Year");
}

function passes(e: CalendarEvent, types: Set<CalendarEventType>, status: StatusFilter, purpose: string): boolean {
    if (!types.has(e.type)) return false;
    if (purpose !== "all" && e.purpose !== purpose) return false;
    if (status === "all") return true;
    if (status === "action") return e.needsAction;
    return STATUS_GROUPS[status].includes(e.status);
}

function EventChip({ e, tz, onOpen, compact = false }: { e: CalendarEvent; tz: string; onOpen: (e: CalendarEvent) => void; compact?: boolean }) {
    const { t } = useLanguage();
    const when = e.allDay ? t("All day") : timeLabel(new Date(e.start), tz);
    const title = eventTitle(t, e);
    return (
        <button
            type="button"
            onClick={() => onOpen(e)}
            className={cn(
                "focus-ring flex w-full items-start gap-2 rounded-row border border-line-hairline bg-surface-glass-strong text-left transition-colors duration-small ease-standard hover:bg-milk-50",
                compact ? "px-2 py-1" : "px-3 py-2",
                (e.status === "cancelled" || e.status === "past") && "opacity-70",
                e.needsAction && "border-tint-accent-border",
            )}
            aria-label={fmt(t("{when}, {type}, {title}, {status}"), { when, type: eventTypeName(t, e.type), title, status: e.status })}
        >
            <TypeMark type={e.type} className={compact ? "h-5 w-6" : undefined} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tabular-nums text-foreground">{when}</span>
                    {!compact && <EventStatusPill status={e.status} />}
                </span>
                <span className={cn("block truncate text-foreground", compact ? "text-xs" : "text-sm")}>{title}</span>
                {!compact && (
                    <span className="block truncate text-xs text-muted-foreground">
                        {e.family ? `${e.family.studentDisplayName ?? ""} · ${eventPurposeName(t, e)}` : eventTypeName(t, e.type)}
                    </span>
                )}
            </span>
        </button>
    );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
    return (
        <div className="min-w-0 rounded-tile border border-line-glass bg-surface-glass px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-page-title font-bold tabular-nums text-ink-900">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

/** One year through the calendar API, in 62-day-safe chunks, merged without duplicates. */
async function loadYear(orgId: string, year: number, tz: string, range: { from: Date; to: Date }, signal: AbortSignal): Promise<CalendarResponse> {
    const parts = await Promise.all(yearChunks(year, tz).map((c) => loadCalendar(orgId, c.from, c.to, { signal })));
    const byKey = new Map<string, CalendarResponse["events"][number]>();
    for (const p of parts) for (const e of p.events) if (!byKey.has(e.key)) byKey.set(e.key, e);
    const events = [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
    const first = parts[0];
    const awaitingApproval = first.awaitingApproval;
    const timeless = awaitingApproval.filter((cb) => {
        const e = callbackEvent(cb, tz);
        return !e || !byKey.has(e.key);
    }).length;
    return {
        ...first,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        events,
        summary: summarise(events, timeless),
        people: Object.assign({}, ...parts.map((p) => p.people)),
    };
}

export function SchoolCalendar({ orgId, timeZone = DEFAULT_CALLBACK_TIME_ZONE }: { orgId: string; timeZone?: string }) {
    const { t } = useLanguage();
    const [view, setView] = useState<CalendarView>("month");
    const [anchor, setAnchor] = useState<DayKey>(() => dayKeyOf(new Date(), timeZone));
    const [types, setTypes] = useState<Set<CalendarEventType>>(() => new Set(CALENDAR_EVENT_TYPES));
    const [status, setStatus] = useState<StatusFilter>("all");
    const [purpose, setPurpose] = useState<string>("all");
    const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);
    const [openCallback, setOpenCallback] = useState<CallbackView | null>(null);
    const [creating, setCreating] = useState(false);
    const today = keyString(dayKeyOf(new Date(), timeZone));

    const range = useMemo(() => viewRange(view, anchor, timeZone), [view, anchor, timeZone]);
    // Day / week / month: one request. Year: six two-month requests to the same API (its
    // 62-day limit), merged here with events de-duplicated by key and the summary
    // recomputed from the merged set, so a boundary-spanning event counts once.
    const period = useSamparkQuery(
        (signal) => (view === "year" ? loadYear(orgId, anchor.year, timeZone, range, signal) : loadCalendar(orgId, range.from, range.to, { signal })),
        [orgId, view === "year", range.from.getTime(), range.to.getTime()],
        { pollMs: POLL_MS },
    );
    // From a day back: what is still scheduled is upcoming whichever clock is ahead (the server decides).
    const agenda = useSamparkQuery((signal) => {
        const from = new Date(Date.now() - 86_400_000);
        return loadCalendar(orgId, from, new Date(from.getTime() + (AGENDA_DAYS + 1) * 86_400_000), { signal });
    }, [orgId], { pollMs: POLL_MS });
    const sources = useSamparkQuery((signal) => listCallbackSources(orgId, { signal }).catch(() => []), [orgId]);

    // Only the data for the range on screen: while a new range loads, the previous range's
    // events and counts must not appear under the new heading.
    const data = period.data && period.data.from === range.from.toISOString() && period.data.to === range.to.toISOString() ? period.data : undefined;
    const filtered = useMemo(() => (data?.events ?? []).filter((e) => passes(e, types, status, purpose)), [data, types, status, purpose]);
    const byDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e]);
        return map;
    }, [filtered]);
    const purposes = useMemo(() => {
        const seen = new Map<string, string>();
        for (const e of data?.events ?? []) if (e.purpose && !seen.has(e.purpose)) seen.set(e.purpose, eventPurposeName(t, e));
        return [...seen.entries()];
    }, [data, t]);
    const upcoming = (agenda.data?.events ?? [])
        .filter((e) => e.status === "scheduled" || e.status === "in_progress" || e.status === "preparing" || e.status === "on_hold" || e.status === "upcoming")
        .filter((e) => passes(e, types, "all", purpose));

    const refresh = () => {
        period.reload();
        agenda.reload();
    };
    const open = (e: CalendarEvent) => {
        if (e.callback) setOpenCallback(e.callback);
        else setOpenEvent(e);
    };
    const toggleType = (type: CalendarEventType) => {
        setTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const s = data?.summary;
    const callbackCount = (s?.byType.callback ?? 0) + (s?.byType.scheduled_call ?? 0);
    const heading = view === "year" ? String(anchor.year) : view === "month" ? monthLabel(anchor) : view === "week" ? fmt(t("Week of {day}"), { day: dayLabel(range.days[0], "short") }) : dayLabel(anchor);
    const awaiting = data?.awaitingApproval ?? agenda.data?.awaitingApproval ?? [];
    const callbacksOn = (data ?? agenda.data)?.sources.callbacks ?? true;

    return (
        <div className="space-y-6">
            <CalendarTabs current="schedule" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="font-display text-page-title font-bold text-ink-900">{t("Calendar")}</h1>
                    <p className="text-sm text-muted-foreground">{fmt(t("Every scheduled call and school event, in {zone}. Calls only go out inside the school's calling hours."), { zone: timeZone })}</p>
                </div>
                {callbacksOn && (
                    <Button type="button" onClick={() => setCreating(true)} className="self-start sm:self-auto">
                        <Plus aria-hidden="true" />
                        {t("Schedule a callback")}
                    </Button>
                )}
            </div>

            {/* Summary for the period shown (de-duplicated on the server). */}
            <section aria-label={t("Summary for this period")} aria-live="polite" className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label={t("Calls this period")} value={s?.plannedCalls ?? 0} hint={fmt(t("{callbacks} callbacks · {campaigns} campaigns"), { callbacks: callbackCount, campaigns: s?.byType.campaign_calls ?? 0 })} />
                <Stat label={t("Awaiting approval")} value={s?.awaitingApproval ?? 0} />
                <Stat label={t("Completed")} value={s?.completed ?? 0} />
                <Stat label={t("Cancelled")} value={s?.cancelled ?? 0} />
                <Stat label={t("Failed or missed")} value={s?.failedOrMissed ?? 0} />
            </section>

            {awaiting.length > 0 && (
                <SectionCard title={t("Waiting for you")} description={t("Parents asked to be called back. Nothing is scheduled until you confirm a time.")}>
                    <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                        {awaiting.map((cb) => (
                            <li key={cb.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpenCallback(cb)}
                                    className="focus-ring w-full rounded-row border border-tint-accent-border bg-surface-glass-strong px-3 py-2 text-left hover:bg-milk-50"
                                >
                                    <span className="block text-sm font-semibold text-foreground">{cb.guardianDisplayName ?? t("Parent")}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        {cb.requestedText ? `“${cb.requestedText}”` : ""}{cb.scheduledAt ? ` · ${timeLabel(new Date(cb.scheduledAt), timeZone)} ${dayLabel(dayKeyOf(new Date(cb.scheduledAt), timeZone), "short")}` : ` · ${t("time not chosen")}`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            {/* Filters */}
            <section aria-label={t("Filters")} className="flex flex-col gap-3 rounded-card border border-line-glass bg-surface-glass p-4 lg:flex-row lg:items-end lg:justify-between">
                <div role="group" aria-label={t("Event types")} className="flex flex-wrap gap-2">
                    {CALENDAR_EVENT_TYPES.filter((ty) => callbacksOn || !["callback", "scheduled_call"].includes(ty)).map((ty) => (
                        <button
                            key={ty}
                            type="button"
                            aria-pressed={types.has(ty)}
                            onClick={() => toggleType(ty)}
                            className={cn(
                                "focus-ring inline-flex min-h-9 items-center gap-2 rounded-pill border px-3 text-xs font-semibold transition-colors duration-small ease-standard",
                                types.has(ty) ? "border-line-hairline bg-milk-400 text-ink-900" : "border-line-hairline bg-transparent text-ink-500 line-through",
                            )}
                        >
                            <TypeMark type={ty} className="h-5 w-6" />
                            {eventTypeName(t, ty)}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="calendar-status">{t("Status")}</Label>
                        <select id="calendar-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="focus-ring h-10 rounded-row border border-line-control bg-milk-50 px-3 text-sm text-foreground">
                            <option value="all">{t("All")}</option>
                            <option value="action">{t("Needs your action")}</option>
                            <option value="scheduled">{t("Scheduled")}</option>
                            <option value="in_progress">{t("Calling now")}</option>
                            <option value="completed">{t("Completed")}</option>
                            <option value="failed">{t("Failed or missed")}</option>
                            <option value="cancelled">{t("Cancelled")}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="calendar-purpose">{t("Purpose")}</Label>
                        <select id="calendar-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="focus-ring h-10 rounded-row border border-line-control bg-milk-50 px-3 text-sm text-foreground">
                            <option value="all">{t("All purposes")}</option>
                            {purposes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section aria-labelledby="calendar-heading" className="min-w-0 space-y-4 rounded-card border border-line-glass bg-surface-glass p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                            <Button type="button" variant="outline" size="icon" aria-label={t("Previous")} onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}><ChevronLeft aria-hidden="true" /></Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(dayKeyOf(new Date(), timeZone))}>{t("Today")}</Button>
                            <Button type="button" variant="outline" size="icon" aria-label={t("Next")} onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}><ChevronRight aria-hidden="true" /></Button>
                            <h2 id="calendar-heading" className="ml-2 font-display text-card-title font-semibold text-ink-900">{heading}</h2>
                        </div>
                        <div role="radiogroup" aria-label={t("Calendar view")} className="inline-flex rounded-pill border border-line-hairline bg-surface-segment p-1">
                            {VIEWS.map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    role="radio"
                                    aria-checked={view === v}
                                    onClick={() => setView(v)}
                                    className={cn("focus-ring min-h-9 rounded-pill px-3 text-xs font-semibold transition-colors duration-small ease-standard", view === v ? "bg-primary text-primary-foreground" : "text-ink-600 hover:text-ink-900")}
                                >
                                    {viewName(t, v)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!data && !period.error && <LoadingBlock rows={3} />}
                    {period.error && !data && <ErrorPanel error={period.error} onRetry={period.reload} />}

                    {data && view === "year" && (
                        <YearView
                            year={anchor.year}
                            byDay={byDay}
                            today={today}
                            onPickDay={(d) => { setAnchor(d); setView("day"); }}
                            onPickMonth={(month) => { setAnchor({ year: anchor.year, month, day: 1 }); setView("month"); }}
                        />
                    )}

                    {data && view === "month" && (
                        <div>
                            <div className="hidden grid-cols-7 gap-1 pb-1 sm:grid" aria-hidden="true">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-1 text-xs font-semibold text-muted-foreground">{t(d)}</div>)}
                            </div>
                            <ol className="grid grid-cols-1 gap-1 sm:grid-cols-7">
                                {range.days.map((d) => {
                                    const k = keyString(d);
                                    const items = byDay.get(k) ?? [];
                                    const inMonth = d.month === anchor.month;
                                    return (
                                        <li key={k} className={cn("min-h-24 rounded-row border border-line-hairline p-1", inMonth ? "bg-surface-glass-strong" : "bg-transparent", items.length === 0 && "hidden sm:block")}>
                                            <button
                                                type="button"
                                                onClick={() => { setAnchor(d); setView("day"); }}
                                                className={cn("focus-ring mb-1 rounded-pill px-2 text-xs font-semibold", k === today ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground")}
                                                aria-label={fmt(t("{day}: {count} items"), { day: dayLabel(d), count: items.length })}
                                            >
                                                <span className="sm:hidden">{dayLabel(d, "short")}</span>
                                                <span className="hidden sm:inline">{d.day}</span>
                                            </button>
                                            <div className="space-y-1">
                                                {items.slice(0, 3).map((e) => <EventChip key={e.key} e={e} tz={timeZone} onOpen={open} compact />)}
                                                {items.length > 3 && (
                                                    <button type="button" onClick={() => { setAnchor(d); setView("day"); }} className="focus-ring px-1 text-xs text-muted-foreground underline">
                                                        {fmt(t("+{count} more"), { count: items.length - 3 })}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            {filtered.length === 0 && <p className="pt-3 text-sm text-muted-foreground">{t("Nothing scheduled this month with these filters.")}</p>}
                        </div>
                    )}

                    {data && (view === "day" || view === "week") && (
                        <ol className={cn("grid gap-3", view === "week" && "md:grid-cols-7 md:gap-2")}>
                            {range.days.map((d) => {
                                const k = keyString(d);
                                const items = byDay.get(k) ?? [];
                                return (
                                    <li key={k} className="min-w-0 space-y-2">
                                        <h3 className={cn("text-xs font-semibold", k === today ? "text-primary" : "text-muted-foreground")}>{dayLabel(d, view === "week" ? "short" : "long")}</h3>
                                        {items.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">{t("Nothing scheduled")}</p>
                                        ) : (
                                            <ul className="space-y-2">{items.map((e) => <li key={e.key}><EventChip e={e} tz={timeZone} onOpen={open} compact={view === "week"} /></li>)}</ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>

                <SectionCard title={t("Agenda")} description={t("What is coming up, in time order.")}>
                    {agenda.loading && !agenda.data && <LoadingBlock rows={2} />}
                    {agenda.error && !agenda.data && <ErrorPanel error={agenda.error} onRetry={agenda.reload} />}
                    {agenda.data && upcoming.length === 0 && (
                        <EmptyState icon={CalendarClock} title={t("Nothing coming up")} description={t("Scheduled callbacks, campaign calls and school events appear here.")} />
                    )}
                    {upcoming.length > 0 && (
                        <ol className="space-y-3">
                            {upcoming.map((e, i) => {
                                const showDay = i === 0 || upcoming[i - 1].date !== e.date;
                                return (
                                    <li key={e.key} className="space-y-1">
                                        {showDay && <p className="text-xs font-semibold text-muted-foreground">{dayLabel(dayKeyOf(new Date(e.start), timeZone), "long")}</p>}
                                        <EventChip e={e} tz={timeZone} onOpen={open} />
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                    {!callbacksOn && <p className="pt-3 text-xs text-muted-foreground">{t("Callbacks are not switched on for this deployment.")}</p>}
                </SectionCard>
            </div>

            {callbacksOn && (
                <NewCallbackDialog orgId={orgId} timeZone={timeZone} open={creating} onOpenChange={setCreating} sources={sources.data ?? []} onCreated={() => refresh()} />
            )}
            <CallbackDetailDialog
                orgId={orgId}
                callback={openCallback}
                onOpenChange={(o) => { if (!o) setOpenCallback(null); }}
                onChanged={(cb) => { setOpenCallback(cb); refresh(); }}
                people={data?.people ?? agenda.data?.people ?? {}}
            />
            <EventDetailDialog event={openEvent} timeZone={timeZone} people={data?.people ?? agenda.data?.people ?? {}} onOpenChange={(o) => { if (!o) setOpenEvent(null); }} />
        </div>
    );
}

