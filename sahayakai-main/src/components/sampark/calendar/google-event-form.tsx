"use client";

/**
 * Create / edit one Google Calendar event: title, all-day or timed, start and end in
 * a chosen time zone, an optional repeat (daily, weekly, monthly, yearly; every N;
 * never / after N times / until a date), location and notes. The server validates
 * everything again (end after start, a wall time the zone skips, …) and answers with
 * a plain sentence shown here. Editing ONE occurrence of a series has no repeat.
 * Saving an event never schedules a phone call.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import { createGoogleEvent, updateGoogleEvent, type EventInput, type EventScope, type SchoolCalendarEvent } from "@/lib/api/sampark-google-calendar";
import { zonedParts } from "@/lib/sampark/callbacks/time";
import type { RepeatFrequency } from "@/lib/sampark/google-calendar/types";

type Freq = "none" | RepeatFrequency;
type Ends = "never" | "count" | "until";

const pad = (n: number) => String(n).padStart(2, "0");

function wall(instant: string, tz: string): { date: string; time: string } {
    const p = zonedParts(new Date(instant), tz);
    return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function gcalErrorText(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
        const data = err.body as { message?: unknown } | undefined;
        if (data && typeof data.message === "string" && data.message) return data.message;
    }
    return err instanceof Error && err.message ? err.message : fallback;
}

function zonesFor(defaultZone: string): string[] {
    const local = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
    return [...new Set([defaultZone, "Asia/Kolkata", local, "UTC"].filter(Boolean))];
}

export function GoogleEventFormDialog({
    open,
    onOpenChange,
    orgId,
    defaultTimeZone,
    defaultDate,
    editing,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    defaultTimeZone: string;
    /** YYYY-MM-DD for a new event. */
    defaultDate: string;
    /** null: create. Otherwise the event to edit and which part of its series. */
    editing: { event: SchoolCalendarEvent; scope: EventScope } | null;
    onSaved: (event: SchoolCalendarEvent, created: boolean) => void;
}) {
    const { t } = useLanguage();
    const ids = { title: useId(), start: useId(), startTime: useId(), end: useId(), endTime: useId(), zone: useId(), freq: useId(), interval: useId(), ends: useId(), count: useId(), until: useId(), location: useId(), notes: useId(), allDay: useId() };
    const occurrence = Boolean(editing && editing.event.recurringEventId && editing.scope === "this");

    const [summary, setSummary] = useState("");
    const [allDay, setAllDay] = useState(false);
    const [startDate, setStartDate] = useState(defaultDate);
    const [startTime, setStartTime] = useState("10:00");
    const [endDate, setEndDate] = useState(defaultDate);
    const [endTime, setEndTime] = useState("11:00");
    const [timeZone, setTimeZone] = useState(defaultTimeZone);
    const [freq, setFreq] = useState<Freq>("none");
    const [interval, setRepeatInterval] = useState(1);
    const [ends, setEnds] = useState<Ends>("never");
    const [count, setCount] = useState(10);
    const [until, setUntil] = useState(defaultDate);
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [requestId, setRequestId] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setBusy(false);
        setRequestId(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        const e = editing?.event;
        if (!e) {
            setSummary(""); setAllDay(false); setStartDate(defaultDate); setStartTime("10:00"); setEndDate(defaultDate); setEndTime("11:00");
            setTimeZone(defaultTimeZone); setFreq("none"); setRepeatInterval(1); setEnds("never"); setCount(10); setUntil(defaultDate); setLocation(""); setDescription("");
            return;
        }
        setSummary(e.summary); setAllDay(e.allDay); setTimeZone(e.timeZone || defaultTimeZone); setLocation(e.location); setDescription(e.description);
        if (e.allDay) {
            setStartDate(e.start); setEndDate(e.end);
        } else {
            const s = wall(e.start, e.timeZone), en = wall(e.end, e.timeZone);
            setStartDate(s.date); setStartTime(s.time); setEndDate(en.date); setEndTime(en.time);
        }
        const r = e.repeat;
        setFreq(r?.freq ?? "none"); setRepeatInterval(r?.interval ?? 1); setEnds(r?.ends.type ?? "never");
        setCount(r?.ends.type === "count" ? r.ends.count : 10);
        setUntil(r?.ends.type === "until" ? r.ends.date : e.allDay ? e.start : wall(e.start, e.timeZone).date);
    }, [open, editing, defaultDate, defaultTimeZone]);

    const zones = useMemo(() => zonesFor(defaultTimeZone), [defaultTimeZone]);
    const repeatLocked = Boolean(editing?.event.repeatText);

    async function save() {
        setError(null);
        if (!summary.trim()) return setError(t("Give the event a title."));
        const input: EventInput = {
            summary: summary.trim(),
            description,
            location,
            allDay,
            startDate,
            endDate,
            timeZone,
            ...(allDay ? {} : { startTime, endTime }),
            repeat:
                occurrence || freq === "none"
                    ? null
                    : {
                          freq,
                          interval,
                          ends: ends === "count" ? { type: "count", count } : ends === "until" ? { type: "until", date: until } : { type: "never" },
                      },
        };
        setBusy(true);
        try {
            if (editing) onSaved(await updateGoogleEvent(orgId, editing.event.id, input, editing.scope), false);
            else {
                const r = await createGoogleEvent(orgId, { ...input, requestId });
                onSaved(r.event, r.created);
            }
            onOpenChange(false);
        } catch (err) {
            setError(gcalErrorText(err, t("The event could not be saved.")));
        } finally {
            setBusy(false);
        }
    }

    const title = editing ? (occurrence ? t("Edit this occurrence") : editing.event.recurringEventId || editing.event.repeat ? t("Edit the whole series") : t("Edit event")) : t("New event");

    return (
        <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{t("Saved to the school's Google Calendar. A calendar event never places a phone call.")}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void save();
                    }}
                >
                    <div className="space-y-1">
                        <Label htmlFor={ids.title}>{t("Title")}</Label>
                        <Input id={ids.title} value={summary} maxLength={200} required onChange={(e) => setSummary(e.target.value)} placeholder={t("e.g. Parent–teacher meeting")} />
                    </div>
                    <label htmlFor={ids.allDay} className="flex min-h-9 items-center gap-2 text-sm text-foreground">
                        <input id={ids.allDay} type="checkbox" className="focus-ring h-4 w-4 accent-primary" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                        {t("All day")}
                    </label>
                    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <legend className="sr-only">{t("When")}</legend>
                        <div className="space-y-1">
                            <Label htmlFor={ids.start}>{t("Starts")}</Label>
                            <Input id={ids.start} type="date" value={startDate} required onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
                        </div>
                        {!allDay && (
                            <div className="space-y-1">
                                <Label htmlFor={ids.startTime}>{t("Start time")}</Label>
                                <Input id={ids.startTime} type="time" value={startTime} required onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor={ids.end}>{t("Ends")}</Label>
                            <Input id={ids.end} type="date" value={endDate} min={startDate} required onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        {!allDay && (
                            <div className="space-y-1">
                                <Label htmlFor={ids.endTime}>{t("End time")}</Label>
                                <Input id={ids.endTime} type="time" value={endTime} required onChange={(e) => setEndTime(e.target.value)} />
                            </div>
                        )}
                    </fieldset>
                    {!allDay && (
                        <div className="space-y-1">
                            <Label htmlFor={ids.zone}>{t("Time zone")}</Label>
                            <select id={ids.zone} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="focus-ring h-10 w-full rounded-control border border-input bg-background px-3 text-sm">
                                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>
                    )}
                    {!occurrence && (
                        <fieldset className="space-y-3 rounded-tile border border-line-hairline p-3">
                            <legend className="px-1 text-sm font-medium text-foreground">{t("Repeat")}</legend>
                            {repeatLocked ? (
                                <p className="text-sm text-muted-foreground">{t("This series uses a repeat rule made in Google Calendar. Change its repeat there; other details can be edited here.")}</p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label htmlFor={ids.freq}>{t("Repeats")}</Label>
                                            <select id={ids.freq} value={freq} onChange={(e) => setFreq(e.target.value as Freq)} className="focus-ring h-10 w-full rounded-control border border-input bg-background px-3 text-sm">
                                                <option value="none">{t("Does not repeat")}</option>
                                                <option value="DAILY">{t("Daily")}</option>
                                                <option value="WEEKLY">{t("Weekly")}</option>
                                                <option value="MONTHLY">{t("Monthly")}</option>
                                                <option value="YEARLY">{t("Yearly")}</option>
                                            </select>
                                        </div>
                                        {freq !== "none" && (
                                            <div className="space-y-1">
                                                <Label htmlFor={ids.interval}>{t("Every")}</Label>
                                                <Input id={ids.interval} type="number" min={1} max={99} value={interval} onChange={(e) => setRepeatInterval(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
                                            </div>
                                        )}
                                    </div>
                                    {freq !== "none" && (
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label htmlFor={ids.ends}>{t("Ends")}</Label>
                                                <select id={ids.ends} value={ends} onChange={(e) => setEnds(e.target.value as Ends)} className="focus-ring h-10 w-full rounded-control border border-input bg-background px-3 text-sm">
                                                    <option value="never">{t("Never")}</option>
                                                    <option value="count">{t("After a number of times")}</option>
                                                    <option value="until">{t("On a date")}</option>
                                                </select>
                                            </div>
                                            {ends === "count" && (
                                                <div className="space-y-1">
                                                    <Label htmlFor={ids.count}>{t("Times")}</Label>
                                                    <Input id={ids.count} type="number" min={1} max={730} value={count} onChange={(e) => setCount(Math.max(1, Math.min(730, Number(e.target.value) || 1)))} />
                                                </div>
                                            )}
                                            {ends === "until" && (
                                                <div className="space-y-1">
                                                    <Label htmlFor={ids.until}>{t("Last date")}</Label>
                                                    <Input id={ids.until} type="date" value={until} min={startDate} onChange={(e) => setUntil(e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </fieldset>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor={ids.location}>{t("Location")}</Label>
                        <Input id={ids.location} value={location} maxLength={500} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={ids.notes}>{t("Details")}</Label>
                        <Textarea id={ids.notes} value={description} maxLength={4000} rows={3} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("Close")}</Button>
                        <Button type="submit" disabled={busy}>
                            {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {editing ? t("Save changes") : t("Create event")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
