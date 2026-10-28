"use client";

/**
 * Year view: the twelve months of one year, every date that holds a scheduled call,
 * callback, campaign, school event or holiday marked with its count and, on the
 * month, a count per type. A date opens the Day view; a month opens the Month view.
 * Colour is never the only signal: marked dates carry a number, a heavier weight, a
 * "needs your action" underline and a full description for screen readers.
 */

import { useLanguage } from "@/context/language-context";
import type { CalendarEvent, CalendarEventType } from "@/lib/api/sampark-calendar";
import { CALENDAR_EVENT_TYPES } from "@/lib/sampark/calendar/events";
import { cn } from "@/lib/utils";
import { fmt } from "../labels";
import { dayLabel, keyString, mondayIndex, monthDays, type DayKey } from "../callbacks/callback-dates";
import { TypeMark, eventTypeName } from "./event-labels";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function monthName(year: number, month: number): string {
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function typeCounts(events: CalendarEvent[]): [CalendarEventType, number][] {
    const counts = new Map<CalendarEventType, number>();
    for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return CALENDAR_EVENT_TYPES.filter((t) => counts.has(t)).map((t) => [t, counts.get(t) as number]);
}

export function YearView({
    year,
    byDay,
    today,
    onPickDay,
    onPickMonth,
}: {
    year: number;
    /** Filtered events by YYYY-MM-DD in the school's zone. */
    byDay: Map<string, CalendarEvent[]>;
    today: string;
    onPickDay: (day: DayKey) => void;
    onPickMonth: (month: number) => void;
}) {
    const { t } = useLanguage();
    return (
        <ol aria-label={fmt(t("Months of {year}"), { year })} className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const days = monthDays(year, month);
                const monthEvents = days.flatMap((d) => byDay.get(keyString(d)) ?? []);
                const lead = mondayIndex(days[0]);
                const name = monthName(year, month);
                return (
                    <li key={month} className="min-w-0 space-y-2 rounded-tile border border-line-hairline bg-surface-glass-strong p-3">
                        <button
                            type="button"
                            onClick={() => onPickMonth(month)}
                            className="focus-ring flex w-full items-baseline justify-between gap-2 rounded-row px-1 text-left"
                            aria-label={fmt(t("Open {month} {year}: {count} items"), { month: name, year, count: monthEvents.length })}
                        >
                            <span className="font-display text-card-title font-semibold text-ink-900">{name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{monthEvents.length > 0 ? fmt(t("{count} items"), { count: monthEvents.length }) : t("Nothing scheduled")}</span>
                        </button>
                        <div className="grid grid-cols-7 gap-px text-center" aria-hidden="true">
                            {WEEKDAYS.map((w, i) => <span key={i} className="text-xs text-muted-foreground">{w}</span>)}
                        </div>
                        <div role="group" aria-label={fmt(t("{month} {year}"), { month: name, year })} className="grid grid-cols-7 gap-px">
                            {Array.from({ length: lead }, (_, i) => <span key={`pad-${i}`} aria-hidden="true" />)}
                            {days.map((d) => {
                                const k = keyString(d);
                                const items = byDay.get(k) ?? [];
                                const action = items.some((e) => e.needsAction);
                                const kinds = [...new Set(items.map((e) => eventTypeName(t, e.type)))];
                                const label = items.length
                                    ? fmt(t("{day}: {count} items — {kinds}{action}"), { day: dayLabel(d), count: items.length, kinds: kinds.join(", "), action: action ? `, ${t("needs your action")}` : "" })
                                    : fmt(t("{day}: nothing scheduled"), { day: dayLabel(d) });
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => onPickDay(d)}
                                        aria-label={label}
                                        title={items.length ? `${items.length} · ${kinds.join(", ")}` : undefined}
                                        className={cn(
                                            "focus-ring relative flex aspect-square min-h-8 flex-col items-center justify-center rounded-xs text-xs tabular-nums transition-colors duration-small ease-standard",
                                            items.length ? "bg-milk-400 font-semibold text-ink-900 hover:bg-milk-500" : "text-ink-600 hover:bg-milk-300",
                                            k === today && "ring-1 ring-inset ring-primary",
                                        )}
                                    >
                                        <span>{d.day}</span>
                                        {items.length > 0 && (
                                            <span aria-hidden="true" className={cn("text-xs leading-none text-saffron-700", action && "underline decoration-2 underline-offset-2")}>
                                                {items.length > 9 ? "9+" : items.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {monthEvents.length > 0 && (
                            <ul aria-label={fmt(t("{month} by type"), { month: name })} className="flex flex-wrap gap-x-3 gap-y-1">
                                {typeCounts(monthEvents).map(([type, n]) => (
                                    <li key={type} className="flex items-center gap-1 text-xs text-ink-600">
                                        <TypeMark type={type} className="h-5 w-6" />
                                        <span className="tabular-nums">{n}</span>
                                        <span className="sr-only">{eventTypeName(t, type)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
