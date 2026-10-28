"use client";

/**
 * SamparkAI workspace → Calendar → Google Calendar: the school's own Google calendar.
 *
 *   status        not set up · not connected · connecting · connected · reconnect needed · error
 *   connect       the server builds the consent URL; the browser only navigates (no token here)
 *   calendar      choose which calendar the account owns the school uses
 *   events        month agenda with navigation; create, view, edit and cancel events, one
 *                 occurrence or the whole series; daily / weekly / monthly / yearly repeats
 *   sync          last sync, push status, "Sync now" (the path on localhost, where Google
 *                 cannot send notifications)
 *   disconnect    confirmed; revokes the grant at Google
 *
 * Local mock mode is labelled on screen: it is not a real Google account.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Link2, Loader2, Plus, RefreshCw, Repeat, Unplug } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/layout";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import {
    cancelGoogleEvent,
    disconnectGoogleCalendar,
    getGoogleCalendarStatus,
    getGoogleEvent,
    listGoogleCalendars,
    listGoogleEvents,
    selectGoogleCalendar,
    startGoogleCalendarConnect,
    syncGoogleCalendarNow,
    type CalendarChoice,
    type EventScope,
    type GoogleCalendarStatus,
    type SchoolCalendarEvent,
} from "@/lib/api/sampark-google-calendar";
import { DEFAULT_CALLBACK_TIME_ZONE } from "@/lib/sampark/callbacks/time";
import type { RepeatRule } from "@/lib/sampark/google-calendar/types";
import { cn } from "@/lib/utils";
import { fmt, type Translate } from "../labels";
import { ErrorPanel, LoadingBlock } from "../states";
import { useSamparkQuery } from "../use-sampark-query";
import { dayKeyOf, dayLabel, keyString, monthLabel, startOfDay, type DayKey } from "../callbacks/callback-dates";
import { CalendarTabs } from "./calendar-tabs";
import { GoogleEventFormDialog, gcalErrorText } from "./google-event-form";

const OUTCOMES: Record<string, { ok: boolean; text: string }> = {
    connected: { ok: true, text: "Google Calendar is connected." },
    denied: { ok: false, text: "Google access was not granted. Nothing was connected." },
    invalid_state: { ok: false, text: "That sign-in link is not valid. Start again from Connect." },
    expired_state: { ok: false, text: "The sign-in took too long and expired. Start again from Connect." },
    used_state: { ok: false, text: "That sign-in link was already used. Start again from Connect." },
    wrong_user: { ok: false, text: "The sign-in was started by a different SahayakAI account. Start again from Connect." },
    not_admin: { ok: false, text: "Only administrators of this school can connect its calendar." },
    no_refresh_token: { ok: false, text: "Google did not grant lasting access. Remove SahayakAI from your Google account's third-party access and connect again." },
    scope_missing: { ok: false, text: "Calendar access was not fully granted. Connect again and allow both calendar permissions." },
    exchange_failed: { ok: false, text: "Google could not complete the sign-in. Try connecting again." },
    not_configured: { ok: false, text: "Google Calendar is not set up on this server." },
};

function stateLabel(t: Translate, s: GoogleCalendarStatus["state"]): string {
    switch (s) {
        case "unconfigured": return t("Not set up on this server");
        case "disconnected": return t("Not connected");
        case "connected": return t("Connected");
        case "reconnect_required": return t("Reconnect needed");
        default: return t("Error");
    }
}

export function describeRepeat(t: Translate, r: RepeatRule): string {
    const unit = { DAILY: ["day", "days"], WEEKLY: ["week", "weeks"], MONTHLY: ["month", "months"], YEARLY: ["year", "years"] }[r.freq];
    let s = r.interval === 1 ? fmt(t("Repeats every {unit}"), { unit: t(unit[0]) }) : fmt(t("Repeats every {n} {unit}"), { n: r.interval, unit: t(unit[1]) });
    if (r.ends.type === "count") s += `, ${fmt(t("{n} times"), { n: r.ends.count })}`;
    if (r.ends.type === "until") s += `, ${fmt(t("until {date}"), { date: dateText(r.ends.date) })}`;
    return s;
}

function dateText(key: string): string {
    const [y, m, d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function eventWhen(t: Translate, e: SchoolCalendarEvent, viewZone: string): string {
    if (e.allDay) return e.start === e.end ? `${dateText(e.start)} · ${t("All day")}` : `${dateText(e.start)} – ${dateText(e.end)} · ${t("All day")}`;
    const zone = e.timeZone || viewZone;
    const day = new Intl.DateTimeFormat("en-IN", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const time = new Intl.DateTimeFormat("en-IN", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true });
    const s = new Date(e.start), en = new Date(e.end);
    const sameDay = day.format(s) === day.format(en);
    return sameDay ? `${day.format(s)}, ${time.format(s)} – ${time.format(en)} (${zone})` : `${day.format(s)}, ${time.format(s)} – ${day.format(en)}, ${time.format(en)} (${zone})`;
}

function dayOfEvent(e: SchoolCalendarEvent, tz: string): string {
    return e.allDay ? e.start : keyString(dayKeyOf(new Date(e.start), tz));
}

export function GoogleCalendarPanel({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const status = useSamparkQuery<GoogleCalendarStatus>((signal) => getGoogleCalendarStatus(orgId, { signal }), [orgId]);
    const [outcome, setOutcome] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [busy, setBusy] = useState<null | "sync" | "disconnect" | "select">(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    // The OAuth redirect lands here with ?gcal=<outcome>; show it once, then clean the URL.
    useEffect(() => {
        const url = new URL(window.location.href);
        const value = url.searchParams.get("gcal");
        if (!value) return;
        setOutcome(value);
        url.searchParams.delete("gcal");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, []);

    const s = status.data;
    const connected = s?.state === "connected";
    const tz = s?.calendar?.timeZone || DEFAULT_CALLBACK_TIME_ZONE;

    async function connect() {
        setConnecting(true);
        try {
            const { authUrl } = await startGoogleCalendarConnect(orgId);
            window.location.assign(authUrl);
        } catch (err) {
            setConnecting(false);
            toast({ variant: "destructive", title: t("Could not start the connection"), description: gcalErrorText(err, t("Try again.")) });
        }
    }

    async function syncNow() {
        setBusy("sync");
        try {
            const r = await syncGoogleCalendarNow(orgId);
            toast({ title: t("Synced with Google"), description: fmt(t("{changed} changed, {removed} removed{full}"), { changed: r.changed, removed: r.removed, full: r.full ? ` · ${t("full refresh")}` : "" }) });
            status.reload();
        } catch (err) {
            toast({ variant: "destructive", title: t("Sync failed"), description: gcalErrorText(err, t("Try again.")) });
            status.reload();
        } finally {
            setBusy(null);
        }
    }

    async function disconnect() {
        setBusy("disconnect");
        try {
            const r = await disconnectGoogleCalendar(orgId);
            toast({ title: t("Google Calendar disconnected"), description: r.revoked ? t("Access was removed at Google too.") : t("Removed here. Google could not confirm; you can also remove access in your Google account.") });
            setConfirmDisconnect(false);
            status.reload();
        } catch (err) {
            toast({ variant: "destructive", title: t("Could not disconnect"), description: gcalErrorText(err, t("Try again.")) });
        } finally {
            setBusy(null);
        }
    }

    const notice = outcome ? OUTCOMES[outcome] ?? { ok: false, text: "The connection did not complete." } : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <CalendarTabs current="google" />
                <div className="min-w-0 space-y-1">
                    <h1 className="font-display text-page-title font-bold text-ink-900">{t("Google Calendar")}</h1>
                    <p className="text-sm text-muted-foreground">{t("The school's events in its own Google Calendar. Events are for everyone to see; they never place a phone call.")}</p>
                </div>
            </div>

            {notice && (
                <div role={notice.ok ? "status" : "alert"} className={cn("flex items-start gap-3 rounded-surface-md border p-4 text-sm", notice.ok ? "border-line-hairline bg-milk-300 text-foreground" : "border-destructive/40 bg-destructive/10 text-foreground")}>
                    {notice.ok ? <Link2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                    <p className="min-w-0 flex-1">{t(notice.text)}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOutcome(null)}>{t("Dismiss")}</Button>
                </div>
            )}

            {status.error && !s ? (
                <ErrorPanel error={status.error} onRetry={status.reload} />
            ) : !s ? (
                <LoadingBlock rows={3} />
            ) : (
                <ConnectionCard
                    orgId={orgId}
                    status={s}
                    connecting={connecting}
                    busy={busy}
                    onConnect={connect}
                    onSync={syncNow}
                    onDisconnect={() => setConfirmDisconnect(true)}
                    onSelected={(next) => status.setData(next)}
                    setBusy={setBusy}
                />
            )}

            {connected && s?.calendar && <EventsSection orgId={orgId} tz={tz} calendarId={s.calendar.id} mock={s.mode === "mock"} />}

            <AlertDialog open={confirmDisconnect} onOpenChange={(o) => busy !== "disconnect" && setConfirmDisconnect(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Disconnect Google Calendar?")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("SahayakAI stops reading and changing the school's Google calendar and removes its access. Events already in Google stay there. Scheduled calls and callbacks are not affected.")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy === "disconnect"}>{t("Keep connected")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void disconnect();
                            }}
                            disabled={busy === "disconnect"}
                        >
                            {busy === "disconnect" && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Disconnect")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function ConnectionCard({
    orgId,
    status: s,
    connecting,
    busy,
    onConnect,
    onSync,
    onDisconnect,
    onSelected,
    setBusy,
}: {
    orgId: string;
    status: GoogleCalendarStatus;
    connecting: boolean;
    busy: null | "sync" | "disconnect" | "select";
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: () => void;
    onSelected: (s: GoogleCalendarStatus) => void;
    setBusy: (b: null | "sync" | "disconnect" | "select") => void;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const state = connecting ? "connecting" : s.state;
    const calendars = useSamparkQuery<{ calendars: CalendarChoice[] }>(s.state === "connected" ? () => listGoogleCalendars(orgId) : null, [orgId, s.state, s.calendar?.id]);

    async function choose(calendarId: string) {
        setBusy("select");
        try {
            onSelected(await selectGoogleCalendar(orgId, calendarId));
            toast({ title: t("Calendar changed") });
        } catch (err) {
            toast({ variant: "destructive", title: t("Could not change the calendar"), description: gcalErrorText(err, t("Try again.")) });
        } finally {
            setBusy(null);
        }
    }

    const pill = state === "connecting" ? t("Connecting…") : stateLabel(t, s.state);
    const tone = state === "connected" ? "bg-leaf-100 text-ink-900" : state === "reconnect_required" || state === "error" ? "bg-destructive/10 text-destructive" : "bg-milk-400 text-ink-800";

    return (
        <SectionCard
            title={t("Connection")}
            icon={CalendarDays}
            action={<span role="status" className={cn("inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold", tone)}>{pill}</span>}
        >
            {s.mode === "mock" && (
                <p className="rounded-tile border border-line-hairline bg-milk-300 p-3 text-sm text-ink-800">
                    <strong className="font-semibold">{t("Local mock Google.")}</strong> {t("This development server uses a stand-in for Google. No real Google account is connected and nothing reaches Google.")}
                </p>
            )}

            {s.state === "unconfigured" && (
                <div className="space-y-2 text-sm text-ink-800">
                    <p>{t("An administrator of this SahayakAI server must add a Google OAuth client before schools can connect. Missing:")}</p>
                    <ul className="list-disc space-y-1 pl-5 font-mono text-xs">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                    <p className="text-muted-foreground">{t("Set-up steps: docs/sampark/GOOGLE_CALENDAR.md.")}</p>
                </div>
            )}

            {(s.state === "disconnected" || state === "connecting") && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink-800">{t("Connect the school's Google account to show and manage its events here. SahayakAI asks only to manage events on calendars the account owns and to see the list of its calendars.")}</p>
                    <Button type="button" onClick={onConnect} disabled={connecting} className="shrink-0">
                        {connecting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Link2 aria-hidden="true" />}
                        {connecting ? t("Opening Google…") : t("Connect Google Calendar")}
                    </Button>
                </div>
            )}

            {(s.state === "reconnect_required" || s.state === "error") && !connecting && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p role="alert" className="text-sm text-ink-800">{s.lastError?.message ?? t("Google access has expired or was removed.")} {t("Reconnect to continue; nothing else changes.")}</p>
                    <div className="flex shrink-0 gap-2">
                        <Button type="button" onClick={onConnect}><RefreshCw aria-hidden="true" />{t("Reconnect")}</Button>
                        <Button type="button" variant="outline" onClick={onDisconnect}>{t("Disconnect")}</Button>
                    </div>
                </div>
            )}

            {s.state === "connected" && !connecting && (
                <div className="space-y-4">
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">{t("Google account")}</dt>
                            <dd className="break-words font-medium text-ink-900">{s.accountLabel ?? t("Unknown")}</dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">{t("Last synced")}</dt>
                            <dd className="font-medium text-ink-900">{s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString("en-IN") : t("Not yet")}</dd>
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                            <dt className="text-muted-foreground">{t("Change notifications")}</dt>
                            <dd className="text-ink-900">
                                {s.push.active
                                    ? fmt(t("On, renewed automatically (current channel until {date})"), { date: new Date(s.push.expiresAt).toLocaleDateString("en-IN") })
                                    : s.push.reason === "no_public_url"
                                      ? t("Off: this server has no public HTTPS address for Google to notify. Changes made in Google appear after the regular sync or Sync now.")
                                      : s.push.reason === "failed"
                                        ? t("Could not be started. Changes still sync regularly.")
                                        : t("Starting with the next sync.")}
                            </dd>
                        </div>
                    </dl>
                    <div className="space-y-1">
                        <Label htmlFor="gcal-calendar">{t("School calendar")}</Label>
                        {calendars.error ? (
                            <p role="alert" className="text-sm text-destructive">{gcalErrorText(calendars.error, t("Could not list calendars."))}</p>
                        ) : (
                            <select
                                id="gcal-calendar"
                                value={s.calendar?.id ?? ""}
                                disabled={!calendars.data || busy === "select"}
                                onChange={(e) => void choose(e.target.value)}
                                className="focus-ring h-10 w-full rounded-control border border-input bg-background px-3 text-sm sm:max-w-md"
                            >
                                {!s.calendar && <option value="">{t("Choose a calendar")}</option>}
                                {(calendars.data?.calendars ?? (s.calendar ? [{ ...s.calendar, primary: false, selected: true }] : [])).map((c) => (
                                    <option key={c.id} value={c.id}>{c.summary}{c.primary ? ` (${t("primary")})` : ""} · {c.timeZone}</option>
                                ))}
                            </select>
                        )}
                        <p className="text-xs text-muted-foreground">{t("Only calendars this Google account owns are listed.")}</p>
                    </div>
                    {s.lastError && <p className="text-sm text-destructive">{s.lastError.message}</p>}
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={onSync} disabled={busy !== null}>
                            {busy === "sync" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                            {t("Sync now")}
                        </Button>
                        <Button type="button" variant="outline" onClick={onDisconnect} disabled={busy !== null}>
                            <Unplug aria-hidden="true" />
                            {t("Disconnect")}
                        </Button>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

function EventsSection({ orgId, tz, calendarId, mock }: { orgId: string; tz: string; calendarId: string; mock: boolean }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const today = useMemo(() => dayKeyOf(new Date(), tz), [tz]);
    const [month, setMonth] = useState<DayKey>({ year: today.year, month: today.month, day: 1 });
    const range = useMemo(() => {
        const next = month.month === 12 ? { year: month.year + 1, month: 1, day: 1 } : { year: month.year, month: month.month + 1, day: 1 };
        return { from: startOfDay(month, tz), to: startOfDay(next, tz) };
    }, [month, tz]);
    const events = useSamparkQuery((signal) => listGoogleEvents(orgId, range.from, range.to, { signal }), [orgId, calendarId, range.from.getTime()]);
    const [form, setForm] = useState<{ open: boolean; editing: { event: SchoolCalendarEvent; scope: EventScope } | null }>({ open: false, editing: null });
    const [detail, setDetail] = useState<SchoolCalendarEvent | null>(null);

    const byDay = useMemo(() => {
        const map = new Map<string, SchoolCalendarEvent[]>();
        for (const e of events.data?.events ?? []) {
            const k = dayOfEvent(e, tz);
            map.set(k, [...(map.get(k) ?? []), e]);
        }
        return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [events.data, tz]);

    const shift = (d: 1 | -1) => setMonth((m) => {
        const idx = m.month - 1 + d;
        return { year: m.year + Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 + 1, day: 1 };
    });

    async function openEdit(e: SchoolCalendarEvent, scope: EventScope) {
        if (scope === "series" && e.recurringEventId) {
            try {
                const master = await getGoogleEvent(orgId, e.recurringEventId);
                setForm({ open: true, editing: { event: master, scope: "series" } });
            } catch (err) {
                toast({ variant: "destructive", title: t("Could not open the series"), description: gcalErrorText(err, t("Try again.")) });
            }
            return;
        }
        setForm({ open: true, editing: { event: e, scope } });
    }

    const defaultDate = keyString(month.year === today.year && month.month === today.month ? today : month);

    return (
        <section aria-labelledby="gcal-events-heading" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={t("Previous month")} onClick={() => shift(-1)}><ChevronLeft aria-hidden="true" /></Button>
                    <h2 id="gcal-events-heading" className="min-w-40 text-center font-display text-output-title font-semibold text-ink-900" aria-live="polite">{monthLabel(month)}</h2>
                    <Button type="button" variant="outline" size="icon" aria-label={t("Next month")} onClick={() => shift(1)}><ChevronRight aria-hidden="true" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMonth({ year: today.year, month: today.month, day: 1 })}>{t("Today")}</Button>
                </div>
                <Button type="button" onClick={() => setForm({ open: true, editing: null })} className="self-start sm:self-auto">
                    <Plus aria-hidden="true" />
                    {t("New event")}
                </Button>
            </div>

            {events.error && !events.data ? (
                <ErrorPanel error={new Error(gcalErrorText(events.error, t("Could not load events.")))} onRetry={events.reload} />
            ) : !events.data || events.data.from !== range.from.toISOString() ? (
                <LoadingBlock rows={4} />
            ) : byDay.length === 0 ? (
                <EmptyState icon={CalendarDays} title={t("No events this month")} description={t("Events in the school's Google Calendar appear here. Create one, or move to another month.")} />
            ) : (
                <ol className="space-y-3" aria-label={fmt(t("Events in {month}"), { month: monthLabel(month) })}>
                    {byDay.map(([day, items]) => {
                        const [y, m, d] = day.split("-").map(Number);
                        return (
                            <li key={day} className="rounded-tile border border-line-hairline bg-surface-glass-strong p-3">
                                <h3 className={cn("mb-2 text-sm font-semibold", day === keyString(today) ? "text-primary" : "text-ink-900")}>{dayLabel({ year: y, month: m, day: d })}</h3>
                                <ul className="space-y-1">
                                    {items.map((e) => (
                                        <li key={e.id}>
                                            <button
                                                type="button"
                                                onClick={() => setDetail(e)}
                                                className="focus-ring flex w-full min-w-0 items-start gap-3 rounded-row px-2 py-2 text-left hover:bg-milk-300"
                                                aria-label={`${e.summary}, ${eventWhen(t, e, tz)}${e.recurringEventId || e.repeat ? `, ${t("repeating")}` : ""}`}
                                            >
                                                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                                                    {e.allDay ? t("All day") : new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(e.start))}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-ink-900">{e.summary}</span>
                                                    {e.location && <span className="block truncate text-xs text-muted-foreground">{e.location}</span>}
                                                </span>
                                                {(e.recurringEventId || e.repeat) && <Repeat aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ol>
            )}

            <GoogleEventFormDialog
                open={form.open}
                onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
                orgId={orgId}
                defaultTimeZone={tz}
                defaultDate={defaultDate}
                editing={form.editing}
                onSaved={(e, created) => {
                    toast({ title: form.editing ? t("Event updated") : created ? t("Event created") : t("Event already saved"), description: e.summary });
                    events.reload();
                }}
            />
            <EventDetailsDialog
                orgId={orgId}
                event={detail}
                tz={tz}
                mock={mock}
                onClose={() => setDetail(null)}
                onEdit={(e, scope) => {
                    setDetail(null);
                    void openEdit(e, scope);
                }}
                onCancelled={() => {
                    setDetail(null);
                    events.reload();
                }}
            />
        </section>
    );
}

function EventDetailsDialog({
    orgId,
    event: e,
    tz,
    mock,
    onClose,
    onEdit,
    onCancelled,
}: {
    orgId: string;
    event: SchoolCalendarEvent | null;
    tz: string;
    mock: boolean;
    onClose: () => void;
    onEdit: (e: SchoolCalendarEvent, scope: EventScope) => void;
    onCancelled: () => void;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [scope, setScope] = useState<EventScope>("this");
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [series, setSeries] = useState<SchoolCalendarEvent | null>(null);
    const occurrence = Boolean(e?.recurringEventId);

    useEffect(() => {
        setScope("this");
        setConfirming(false);
        setSeries(null);
        if (e?.recurringEventId) getGoogleEvent(orgId, e.recurringEventId).then(setSeries).catch(() => setSeries(null));
    }, [e, orgId]);

    async function cancel() {
        if (!e) return;
        setBusy(true);
        try {
            const r = await cancelGoogleEvent(orgId, e.id, scope);
            toast({ title: r.alreadyCancelled ? t("It was already cancelled") : scope === "series" ? t("Series cancelled") : t("Event cancelled"), description: e.summary });
            onCancelled();
        } catch (err) {
            toast({ variant: "destructive", title: t("Could not cancel"), description: gcalErrorText(err, t("Try again.")) });
        } finally {
            setBusy(false);
        }
    }

    const repeat = series?.repeat ?? e?.repeat ?? null;
    const repeatText = series?.repeatText ?? e?.repeatText ?? null;

    return (
        <Dialog open={e !== null} onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                {e && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="break-words">{e.summary}</DialogTitle>
                            <DialogDescription>{eventWhen(t, e, tz)}</DialogDescription>
                        </DialogHeader>
                        <dl className="space-y-3 text-sm">
                            {(repeat || repeatText || occurrence) && (
                                <div>
                                    <dt className="text-muted-foreground">{t("Repeats")}</dt>
                                    <dd className="text-ink-900">{repeat ? describeRepeat(t, repeat) : repeatText ? t("A custom repeat made in Google Calendar") : t("Part of a repeating series")}</dd>
                                </div>
                            )}
                            {e.location && (
                                <div>
                                    <dt className="text-muted-foreground">{t("Location")}</dt>
                                    <dd className="break-words text-ink-900">{e.location}</dd>
                                </div>
                            )}
                            {e.description && (
                                <div>
                                    <dt className="text-muted-foreground">{t("Details")}</dt>
                                    <dd className="whitespace-pre-wrap break-words text-ink-900">{e.description}</dd>
                                </div>
                            )}
                            {e.htmlLink && !mock && (
                                <div>
                                    <a href={e.htmlLink} target="_blank" rel="noreferrer noopener" className="focus-ring inline-flex items-center gap-1 rounded-xs text-primary underline underline-offset-2">
                                        {t("Open in Google Calendar")}
                                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            )}
                        </dl>
                        {occurrence && (
                            <fieldset className="space-y-2 rounded-tile border border-line-hairline p-3">
                                <legend className="px-1 text-sm font-medium text-foreground">{t("Apply changes to")}</legend>
                                {(["this", "series"] as const).map((v) => (
                                    <label key={v} className="flex min-h-9 items-center gap-2 text-sm text-foreground">
                                        <input type="radio" name="gcal-scope" className="focus-ring h-4 w-4 accent-primary" checked={scope === v} onChange={() => setScope(v)} />
                                        {v === "this" ? t("This event only") : t("All events in the series")}
                                    </label>
                                ))}
                            </fieldset>
                        )}
                        {confirming ? (
                            <div role="alert" className="space-y-3 rounded-tile border border-destructive/40 bg-destructive/10 p-3 text-sm">
                                <p>{scope === "series" ? t("Cancel every event in this series? It is removed from the school's Google Calendar.") : t("Cancel this event? It is removed from the school's Google Calendar.")}</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancel()}>
                                        {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                                        {t("Yes, cancel it")}
                                    </Button>
                                    <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>{t("Keep it")}</Button>
                                </div>
                            </div>
                        ) : (
                            <DialogFooter className="gap-2">
                                <Button type="button" variant="outline" onClick={() => setConfirming(true)}>{t("Cancel event")}</Button>
                                <Button type="button" onClick={() => onEdit(e, occurrence ? scope : "series")}>{t("Edit")}</Button>
                            </DialogFooter>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
