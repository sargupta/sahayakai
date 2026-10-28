"use client";

/**
 * Callback dialogs: the time picker (typed or picked; ambiguous text asks), the
 * schedule-a-callback dialog and the details dialog (reschedule, confirm a
 * proposal, cancel). Every write previews first: the server runs every Riya check
 * at the chosen instant and the person approves exactly what Riya will say. A time
 * the school's rules refuse is never moved silently: the dialog offers the next
 * permitted time as a choice.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import {
    cancelCallback,
    changeCallbackTime,
    createCallback,
    getCallbackWithHistory,
    parseCallbackTime,
    previewCallback,
    previewCallbackChange,
    type CallbackHistoryEntry,
    type CallbackPreview,
    type CallbackSource,
    type CallbackView,
} from "@/lib/api/sampark-callbacks";
import { formatInZone } from "@/lib/sampark/callbacks/time";
import { cn } from "@/lib/utils";
import { riyaPurposeLabel } from "../riya-call-panel";
import { errorMessage } from "../states";
import { StatusPill } from "../status-pill";
import { fmt } from "../labels";
import { fromLocalInput, toLocalInput } from "./callback-dates";
import { CallbackStatusPill } from "./callback-status";

type Translate = (s: string) => string;

// ── Time picker ─────────────────────────────────────────────────────────────

function ambiguityText(t: Translate, reason: string): string {
    switch (reason) {
        case "am_or_pm": return t("Morning or evening? Choose one.");
        case "part_of_day_only": return t("Choose an exact time.");
        case "time_missing": return t("At what time? Choose one.");
        case "time_passed_today": return t("That time has passed today. Did you mean this?");
        default: return t("Choose a time.");
    }
}

function invalidText(t: Translate, reason: string): string {
    switch (reason) {
        case "in_past": return t("That time has already passed.");
        case "too_far": return t("Callbacks can be up to 30 days ahead.");
        case "bad_time": return t("That is not a valid time.");
        default: return t("Write a time like \"in 20 minutes\", \"tomorrow at 5 PM\" or \"Monday 10:30 AM\".");
    }
}

/** Typed ("in 20 minutes") or picked; the value is a UTC ISO instant or null. */
export function CallbackTimePicker({ orgId, timeZone, value, onChange }: { orgId: string; timeZone: string; value: string | null; onChange: (iso: string | null) => void }) {
    const { t } = useLanguage();
    const textId = useId();
    const pickId = useId();
    const [text, setText] = useState("");
    const [reading, setReading] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [choices, setChoices] = useState<{ iso: string; label: string }[]>([]);

    const read = async () => {
        if (!text.trim()) return;
        setReading(true);
        setHint(null);
        setChoices([]);
        try {
            const r = await parseCallbackTime(orgId, text.trim(), timeZone);
            if (r.parse.status === "exact") {
                onChange(r.parse.at);
                setHint(fmt(t("Understood: {when}"), { when: r.labels[0] ?? "" }));
            } else if (r.parse.status === "ambiguous") {
                onChange(null);
                setHint(ambiguityText(t, r.parse.reason));
                setChoices(r.parse.candidates.map((iso, i) => ({ iso, label: r.labels[i] ?? iso })));
            } else {
                onChange(null);
                setHint(invalidText(t, r.parse.reason));
            }
        } catch (err) {
            setHint(errorMessage(t, err));
        } finally {
            setReading(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label htmlFor={textId}>{t("When to call")}</Label>
                <div className="flex gap-2">
                    <Input
                        id={textId}
                        value={text}
                        placeholder={t("e.g. in 20 minutes, tomorrow at 5 PM")}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void read(); } }}
                        maxLength={200}
                    />
                    <Button type="button" variant="outline" onClick={read} disabled={reading || !text.trim()}>
                        {reading && <Loader2 aria-hidden="true" className="animate-spin" />}
                        {t("Read")}
                    </Button>
                </div>
            </div>
            <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{hint}</p>
            {choices.length > 0 && (
                <div role="group" aria-label={t("Choose a time")} className="flex flex-wrap gap-2">
                    {choices.map((c) => (
                        <Button key={c.iso} type="button" size="sm" variant={value === c.iso ? "default" : "outline"} aria-pressed={value === c.iso} onClick={() => onChange(c.iso)}>
                            {c.label}
                        </Button>
                    ))}
                </div>
            )}
            <div className="space-y-1">
                <Label htmlFor={pickId}>{fmt(t("Or pick a date and time ({zone})"), { zone: timeZone })}</Label>
                <Input
                    id={pickId}
                    type="datetime-local"
                    value={value ? toLocalInput(new Date(value), timeZone) : ""}
                    onChange={(e) => {
                        const at = fromLocalInput(e.target.value, timeZone);
                        onChange(at ? at.toISOString() : null);
                        setChoices([]);
                        setHint(null);
                    }}
                />
            </div>
        </div>
    );
}

// ── Preview ─────────────────────────────────────────────────────────────────

function refusalLine(t: Translate, code: string): string {
    switch (code) {
        case "OUTSIDE_CALLING_HOURS": return t("Outside the school's calling hours");
        case "TOO_SOON": return t("Choose a time at least a minute from now");
        case "TOO_FAR": return t("Callbacks can be up to 30 days ahead");
        case "CALLBACKS_PRACTICE_ONLY": return t("Scheduled callbacks run in Practice mode only for now");
        case "GATE_BLOCKED": return t("This family cannot be called then (opt-out, consent or call limits)");
        case "RECORDING_CONSENT_REQUIRED": return t("This family has not agreed to recorded calls");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school");
        case "FACTS_INVALID": return t("The call's details are no longer valid at that time");
        case "PROVIDER_UNAVAILABLE": return t("Riya calls are not available right now");
        case "LANGUAGE_NOT_SUPPORTED": return t("Riya cannot call this family in their language");
        default: return code;
    }
}

function PreviewBlock({ preview, onUseNext }: { preview: CallbackPreview; onUseNext: (iso: string) => void }) {
    const { t } = useLanguage();
    return (
        <div className="space-y-3 rounded-tile border border-line-hairline bg-milk-300 p-4" aria-live="polite">
            <p className="text-sm text-foreground">
                <span className="font-semibold">{preview.scheduledLabel}</span>
                {preview.recipient && <> · {preview.recipient.guardianDisplayName} ({t("ends")} {preview.recipient.guardianPhoneLast4})</>}
            </p>
            {preview.ok ? (
                <>
                    <p className="text-xs text-muted-foreground">{t("Riya will say")}</p>
                    <blockquote className="border-l-2 border-line-row pl-3 text-sm text-foreground">{preview.announcement}</blockquote>
                    {preview.provider === "simulated" && <StatusPill tone="info">{t("Practice — no phone will ring")}</StatusPill>}
                </>
            ) : (
                <ul className="space-y-1 text-sm text-foreground">
                    {preview.refusals.map((r, i) => (
                        <li key={`${r.code}-${i}`} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-pill bg-destructive" />{refusalLine(t, r.code)}</li>
                    ))}
                </ul>
            )}
            {!preview.ok && preview.nextAllowedAt && (
                <Button type="button" size="sm" variant="outline" onClick={() => onUseNext(preview.nextAllowedAt as string)}>
                    {fmt(t("Use the next permitted time: {when}"), { when: formatInZone(new Date(preview.nextAllowedAt), preview.timeZone) })}
                </Button>
            )}
        </div>
    );
}

// ── Schedule a new callback ─────────────────────────────────────────────────

export function NewCallbackDialog({
    orgId,
    timeZone,
    open,
    onOpenChange,
    sources,
    initialSourceId,
    onCreated,
}: {
    orgId: string;
    timeZone: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: CallbackSource[];
    initialSourceId?: string | null;
    onCreated: (cb: CallbackView) => void;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const sourceId = useId();
    const noteId = useId();
    const [source, setSource] = useState<string>(initialSourceId ?? "");
    const [when, setWhen] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [preview, setPreview] = useState<CallbackPreview | null>(null);
    const [busy, setBusy] = useState<"preview" | "save" | null>(null);
    const [error, setError] = useState<string | null>(null);
    // One key per dialog opening: a double click schedules one callback.
    const requestKey = useMemo(() => (open ? crypto.randomUUID() : ""), [open]);

    useEffect(() => {
        if (open) {
            setSource(initialSourceId ?? "");
            setWhen(null);
            setNote("");
            setPreview(null);
            setError(null);
        }
    }, [open, initialSourceId]);
    useEffect(() => setPreview(null), [source, when]);

    const runPreview = async () => {
        if (!source || !when) return;
        setBusy("preview");
        setError(null);
        try {
            setPreview(await previewCallback(orgId, { sourceCallId: source, scheduledAt: when, timeZone }));
        } catch (err) {
            setError(errorMessage(t, err));
        } finally {
            setBusy(null);
        }
    };

    const save = async () => {
        if (!preview?.ok || !preview.announcement || !when) return;
        setBusy("save");
        setError(null);
        try {
            const res = await createCallback(orgId, { sourceCallId: source, scheduledAt: when, timeZone, requestKey, confirmedAnnouncement: preview.announcement, note: note.trim() || undefined });
            toast({ title: t("Callback scheduled"), description: preview.scheduledLabel });
            onCreated(res.callback);
            onOpenChange(false);
        } catch (err) {
            setError(errorMessage(t, err));
        } finally {
            setBusy(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t("Schedule a callback")}</DialogTitle>
                    <DialogDescription>{t("Riya calls the family back about an earlier call. Nothing rings now; the call starts at the time you choose, if the school's rules allow it then.")}</DialogDescription>
                </DialogHeader>
                {sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No calls to follow up yet. Make a Riya call first, then schedule its callback here.")}</p>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor={sourceId}>{t("Call back about")}</Label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger id={sourceId}><SelectValue placeholder={t("Choose an earlier call")} /></SelectTrigger>
                                <SelectContent>
                                    {sources.map((s) => (
                                        <SelectItem key={s.callId} value={s.callId}>
                                            {s.guardianDisplayName ?? t("Family")} · {s.studentDisplayName ?? ""} · {riyaPurposeLabel(t, s.purpose)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <CallbackTimePicker orgId={orgId} timeZone={timeZone} value={when} onChange={setWhen} />
                        <div className="space-y-1">
                            <Label htmlFor={noteId}>{t("Note for the office (optional)")}</Label>
                            <Input id={noteId} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
                        </div>
                        {preview && <PreviewBlock preview={preview} onUseNext={setWhen} />}
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    </div>
                )}
                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Close")}</Button>
                    {preview?.ok ? (
                        <Button type="button" onClick={save} disabled={busy !== null}>
                            {busy === "save" && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Schedule callback")}
                        </Button>
                    ) : (
                        <Button type="button" onClick={runPreview} disabled={!source || !when || busy !== null}>
                            {busy === "preview" && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Check this time")}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Details: reschedule, confirm, cancel ────────────────────────────────────

function callStateText(t: Translate, state: string | null): string | null {
    if (!state) return null;
    switch (state) {
        case "completed": return t("Riya spoke with the family");
        case "no_answer": return t("No answer");
        case "busy": return t("Busy");
        case "failed": return t("The call failed");
        case "unknown": return t("Outcome not known yet");
        case "initiating":
        case "in_progress": return t("Call in progress");
        default: return state;
    }
}

const HISTORY_ACTION: Record<string, string> = {
    'callback.create': 'Scheduled',
    'callback.proposed': 'Requested by the parent',
    'callback.confirm': 'Confirmed',
    'callback.reschedule': 'Time changed',
    'callback.cancel': 'Cancelled',
    'callback.started': 'Call started',
    'callback.retry': 'Could not start; will retry',
    'callback.failed': 'Failed',
    'callback.missed': 'Missed (time passed)',
};

/** The callback's audit trail, newest first. Reloads when the callback changes. */
function CallbackHistory({ orgId, callbackId, version, people }: { orgId: string; callbackId: string; version: string; people: Record<string, string> }) {
    const { t } = useLanguage();
    const [history, setHistory] = useState<CallbackHistoryEntry[] | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const ctrl = new AbortController();
        setFailed(false);
        getCallbackWithHistory(orgId, callbackId, { signal: ctrl.signal })
            .then((r) => setHistory(r.history))
            .catch((err) => {
                if (!ctrl.signal.aborted) setFailed(Boolean(err));
            });
        return () => ctrl.abort();
    }, [orgId, callbackId, version]);
    if (failed) return <p className="text-xs text-muted-foreground">{t("History could not be loaded.")}</p>;
    if (!history || history.length === 0) return null;
    const who = (actor: string) => (actor === "system" ? t("Scheduler") : actor === "riya" ? t("Riya call") : people[actor] ?? t("A school administrator"));
    return (
        <details className="rounded-row border border-line-hairline p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">{t("History")} ({history.length})</summary>
            <ol className="mt-2 space-y-1" aria-label={t("Callback history")}>
                {history.map((h, i) => (
                    <li key={`${h.at}-${i}`} className="flex flex-wrap gap-x-2 text-xs text-ink-800">
                        <time dateTime={h.at} className="tabular-nums text-muted-foreground">{new Date(h.at).toLocaleString("en-IN")}</time>
                        <span className="font-medium">{t(HISTORY_ACTION[h.action] ?? h.action)}</span>
                        <span className="text-muted-foreground">· {who(h.actor)}</span>
                        {h.attempt !== null && <span className="text-muted-foreground">· {t("attempt")} {h.attempt}</span>}
                        {h.code && <span className="font-mono text-muted-foreground">· {h.code}</span>}
                    </li>
                ))}
            </ol>
        </details>
    );
}

export function CallbackDetailDialog({
    orgId,
    callback,
    onOpenChange,
    onChanged,
    people = {},
}: {
    orgId: string;
    callback: CallbackView | null;
    onOpenChange: (open: boolean) => void;
    onChanged: (cb: CallbackView) => void;
    /** uid → display name, for "Scheduled by". */
    people?: Record<string, string>;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [mode, setMode] = useState<"view" | "time" | "cancel">("view");
    const [when, setWhen] = useState<string | null>(null);
    const [preview, setPreview] = useState<CallbackPreview | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMode(callback?.status === "proposed" ? "time" : "view");
        setWhen(callback?.scheduledAt ?? callback?.candidates[0] ?? null);
        setPreview(null);
        setError(null);
    }, [callback]);
    useEffect(() => setPreview(null), [when]);

    if (!callback) return null;
    const tz = callback.timeZone;
    const open = callback.status === "proposed" || callback.status === "scheduled" || callback.status === "failed" || callback.status === "missed";
    const action = callback.status === "proposed" ? "confirm" : "reschedule";

    const check = async () => {
        if (!when) return;
        setBusy(true);
        setError(null);
        try {
            setPreview(await previewCallbackChange(orgId, callback.id, when, tz));
        } catch (err) {
            setError(errorMessage(t, err));
        } finally {
            setBusy(false);
        }
    };

    const saveTime = async () => {
        if (!when || !preview?.ok || !preview.announcement) return;
        setBusy(true);
        setError(null);
        try {
            const next = await changeCallbackTime(orgId, callback.id, { action, scheduledAt: when, timeZone: tz, confirmedAnnouncement: preview.announcement, expectedVersion: callback.version });
            toast({ title: action === "confirm" ? t("Callback confirmed") : t("Callback moved"), description: preview.scheduledLabel });
            onChanged(next);
        } catch (err) {
            setError(errorMessage(t, err));
        } finally {
            setBusy(false);
        }
    };

    const doCancel = async () => {
        setBusy(true);
        setError(null);
        try {
            const next = await cancelCallback(orgId, callback.id, callback.version);
            toast({ title: t("Callback cancelled") });
            onChanged(next);
        } catch (err) {
            setError(errorMessage(t, err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{callback.guardianDisplayName ?? t("Family")}</DialogTitle>
                    <DialogDescription>
                        {callback.studentDisplayName ?? ""} · {riyaPurposeLabel(t, callback.riyaPurpose)}
                        {callback.guardianPhoneLast4 && <> · {t("phone ending")} {callback.guardianPhoneLast4}</>}
                    </DialogDescription>
                </DialogHeader>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">{t("Status")}</dt>
                    <dd><CallbackStatusPill status={callback.status} /></dd>
                    <dt className="text-muted-foreground">{t("When")}</dt>
                    <dd className="text-foreground">{callback.scheduledAt ? `${formatInZone(new Date(callback.scheduledAt), tz)} (${tz})` : t("Time not chosen yet")}</dd>
                    {callback.requestedText && (
                        <>
                            <dt className="text-muted-foreground">{t("The parent asked")}</dt>
                            <dd className="text-foreground">&ldquo;{callback.requestedText}&rdquo;</dd>
                        </>
                    )}
                    {callback.note && (
                        <>
                            <dt className="text-muted-foreground">{t("Note")}</dt>
                            <dd className="text-foreground break-words">{callback.note}</dd>
                        </>
                    )}
                    <dt className="text-muted-foreground">{t("Scheduled by")}</dt>
                    <dd className="text-foreground">
                        {callback.createdBy === "riya"
                            ? t("The parent, on a Riya call")
                            : people[callback.createdBy] ?? t("A school administrator")}
                        {callback.approvedBy && callback.approvedBy !== callback.createdBy && ` · ${t("approved by")} ${people[callback.approvedBy] ?? t("a school administrator")}`}
                    </dd>
                    {callback.callState && (
                        <>
                            <dt className="text-muted-foreground">{t("Call")}</dt>
                            <dd className="text-foreground">{callStateText(t, callback.callState)}</dd>
                        </>
                    )}
                    {callback.attempts > 0 && (
                        <>
                            <dt className="text-muted-foreground">{t("Attempts")}</dt>
                            <dd className="text-foreground">{callback.attempts}</dd>
                        </>
                    )}
                </dl>
                {callback.lastError && (
                    <p role="status" className="rounded-row border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">{callback.lastError.message}</p>
                )}
                <CallbackHistory orgId={orgId} callbackId={callback.id} version={`${callback.version}:${callback.status}:${callback.updatedAt}`} people={people} />

                {mode === "time" && open && (
                    <div className="space-y-3">
                        <CallbackTimePicker orgId={orgId} timeZone={tz} value={when} onChange={setWhen} />
                        {callback.candidates.length > 0 && !when && <p className="text-xs text-muted-foreground">{t("The parent's request was not exact. Choose the time to call.")}</p>}
                        {preview && <PreviewBlock preview={preview} onUseNext={setWhen} />}
                    </div>
                )}
                {mode === "cancel" && <p className="text-sm text-foreground">{t("Cancel this callback? The family will not be called.")}</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

                <DialogFooter className={cn("flex-wrap gap-2")}>
                    {mode === "view" && open && (
                        <>
                            <Button type="button" variant="outline" onClick={() => setMode("cancel")}>{t("Cancel callback")}</Button>
                            <Button type="button" onClick={() => setMode("time")}>{t("Change time")}</Button>
                        </>
                    )}
                    {mode === "time" && open && (
                        <>
                            <Button type="button" variant="outline" onClick={() => (callback.status === "proposed" ? setMode("cancel") : setMode("view"))}>
                                {callback.status === "proposed" ? t("Decline") : t("Back")}
                            </Button>
                            {preview?.ok ? (
                                <Button type="button" onClick={saveTime} disabled={busy}>
                                    {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                                    {action === "confirm" ? t("Confirm callback") : t("Move callback")}
                                </Button>
                            ) : (
                                <Button type="button" onClick={check} disabled={!when || busy}>
                                    {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                                    {t("Check this time")}
                                </Button>
                            )}
                        </>
                    )}
                    {mode === "cancel" && (
                        <>
                            <Button type="button" variant="outline" onClick={() => setMode(callback.status === "proposed" ? "time" : "view")}>{t("Keep it")}</Button>
                            <Button type="button" variant="destructive" onClick={doCancel} disabled={busy}>
                                {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                                {t("Cancel callback")}
                            </Button>
                        </>
                    )}
                    {!open && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Close")}</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
