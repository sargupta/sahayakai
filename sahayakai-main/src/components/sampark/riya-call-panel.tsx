"use client";

/**
 * Riya — the school's AI calling assistant (a hosted ElevenLabs conversation agent).
 *
 * One family, one call, one workflow at a time. The person picks a workflow and a
 * family from the school's records, enters the typed facts, sees exactly what Riya
 * will say and which phone will ring, and only then places the call. The browser
 * sends record ids; the server resolves names, class and phone, and applies every
 * calling rule. Practice runs on a simulator; Test rings only the school test phone;
 * Live is not available in this release.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, PhoneCall, RefreshCw } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { listGuardians, type GuardianRow } from "@/lib/api/sampark";
import {
    getRiya,
    getRiyaCall,
    previewRiya,
    reconcileRiya,
    reviewRiya,
    startRiya,
    type ConversationCallView,
    type RiyaCallDetail,
    type RiyaPreview,
} from "@/lib/api/sampark-riya";
import type { CallbackView } from "@/lib/api/sampark-callbacks";
import type { RiyaFacts } from "@/lib/sampark/conversation/facts";
import { CLOSURE_REASONS, EVENT_TYPES, EXAM_SUBJECTS, type ExamSubject, type RiyaPurpose } from "@/lib/sampark/conversation/riya-purposes";
import { SIMULATION_SCENARIOS, type SimulationScenario } from "@/lib/sampark/conversation/simulated-provider";
import type { ConversationCallState } from "@/lib/sampark/conversation/types";
import type { BlockReason, ClosureReason, EventType, SpokenTime } from "@/types/sampark";
import { blockReasonLabel, closureReasonLabel, eventTypeLabel, fmt, modeBannerText, purposeLabel, relationLabel } from "./labels";
import { useSamparkSchool } from "./school-context";
import { ErrorPanel, LoadingBlock, errorMessage } from "./states";
import { StatusPill } from "./status-pill";
import { useSamparkFormat } from "./format";
import { useSamparkQuery } from "./use-sampark-query";

type Translate = (key: string) => string;

const TIMES: SpokenTime[] = Array.from({ length: 28 }, (_, i) => ({ hour: 6 + Math.floor(i / 2), minute: (i % 2 ? 30 : 0) as 0 | 30 }));
const timeKey = (t: SpokenTime) => `${String(t.hour).padStart(2, "0")}:${t.minute === 0 ? "00" : "30"}`;
const parseTime = (k: string): SpokenTime => ({ hour: Number(k.slice(0, 2)), minute: (k.endsWith("30") ? 30 : 0) as 0 | 30 });

export function riyaPurposeLabel(t: Translate, p: RiyaPurpose): string {
    switch (p) {
        case "ptm_invitation": return purposeLabel(t, "ptm_invite");
        case "event_invitation": return purposeLabel(t, "event_invite");
        case "emergency_closure": return purposeLabel(t, "emergency_closure");
        case "holiday_notice": return t("Holiday notice");
        case "exam_schedule_notice": return t("Exam schedule notice");
        case "absence_notice": return t("Absence notice");
        default: return p;
    }
}

/** Human labels for Riya's data-collection answers; free-text answers are shown as said. */
function answerKeyLabel(t: Translate, key: string): string {
    switch (key) {
        case "good_time_to_talk": return t("Good time to talk");
        case "ptm_attendance": return t("Coming to the meeting");
        case "ptm_preferred_time": return t("Preferred meeting time");
        case "ptm_meeting_mode": return t("Meeting type requested");
        case "event_attendance": return t("Coming to the event");
        case "late_return_date": return t("Late return after holidays");
        case "exam_absence_date": return t("Exam that may be missed");
        case "expected_return_date": return t("Expected back on");
        case "child_at_school_during_closure": return t("Child at school now");
        case "recipient_confirmed": return t("Parent confirmed");
        case "callback_requested_time": return t("Asked to be called back");
        case "stop_requested": return t("Asked not to be called");
        default: return key;
    }
}

function answerValueLabel(t: Translate, value: string): string {
    switch (value.trim().toLowerCase()) {
        case "yes": case "true": return t("Yes");
        case "no": case "false": return t("No");
        case "unsure": return t("Not sure");
        case "no_answer": return t("No clear answer");
        case "can_attend": return t("Can attend");
        case "cannot_attend": return t("Cannot attend");
        case "online": return t("Online");
        case "phone": return t("Phone");
        default: return value;
    }
}

function stateLabel(t: Translate, s: ConversationCallState): string {
    switch (s) {
        case "initiating": return t("Initiating Call");
        case "initiated": return t("Call Initiated");
        case "completed": return t("Conversation Ended");
        case "no_answer": return t("No answer");
        case "busy": return t("Busy");
        case "failed": return t("Call Failed");
        case "unknown": return t("Outcome unknown — check before calling again");
        default: return s;
    }
}

function stateTone(s: ConversationCallState) {
    if (s === "completed") return "success" as const;
    if (s === "initiating" || s === "initiated") return "info" as const;
    if (s === "unknown") return "warning" as const;
    if (s === "failed") return "danger" as const;
    return "neutral" as const;
}

function scenarioLabel(t: Translate, s: SimulationScenario): string {
    switch (s) {
        case "answered_positive": return t("Parent answers and agrees");
        case "answered_cannot_attend": return t("Parent cannot attend");
        case "no_answer": return t("No answer");
        case "busy": return t("Busy");
        case "wrong_person": return t("Wrong person answers");
        case "stop_requested": return t("Parent asks to stop calls");
        case "callback_requested": return t("Parent asks to be called back later");
        case "interrupted": return t("Call cut off");
        case "provider_rejected": return t("Calling service refuses");
        case "provider_timeout": return t("Calling service does not reply");
        default: return s;
    }
}

function refusalText(t: Translate, r: RiyaPreview["refusals"][number]): string {
    switch (r.code) {
        case "PURPOSE_NOT_ENABLED": return t("This workflow is not switched on yet.");
        case "FACTS_REQUIRED": return t("Enter the details for this call.");
        case "FACTS_INVALID": return t("Some details are missing, in the past, or not on the school calendar.");
        case "CAMPAIGN_FACTS_UNAVAILABLE": return t("That campaign has no details for this workflow.");
        case "NOT_GUARDIAN_OF_RECORD": return t("This person is not a guardian of record for that student.");
        case "STUDENT_INACTIVE": return t("That student is no longer active in the school records.");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school.");
        case "GATE_BLOCKED": return blockReasonLabel(t, r.reason as BlockReason);
        case "OUTSIDE_CALLING_HOURS": return t("Outside the school calling hours.");
        case "RECORDING_CONSENT_REQUIRED": return t("This parent has not agreed to recorded calls.");
        case "LANGUAGE_NOT_SUPPORTED": return t("Riya speaks English only; this parent is called in another language.");
        case "PROVIDER_UNAVAILABLE": return r.message;
        case "NUMBER_NOT_ALLOWED": return t("This contact's number is not on the list of numbers Riya may call here.");
        default: return t("This call is not allowed.");
    }
}

function today(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

// ── Facts form ───────────────────────────────────────────────────────────────

type ExamRow = { subject: ExamSubject; date: string; time: string };

interface FactsState {
    date: string;
    time: string;
    eventType: EventType;
    holidays: string[];
    exams: ExamRow[];
    reason: ClosureReason;
    buses: "yes" | "no" | "unknown";
}

function factsFor(purpose: RiyaPurpose, f: FactsState): RiyaFacts {
    switch (purpose) {
        case "ptm_invitation": return { purpose, date: f.date, time: parseTime(f.time) };
        case "event_invitation": return { purpose, eventType: f.eventType, date: f.date, time: parseTime(f.time) };
        case "holiday_notice": return { purpose, dates: f.holidays };
        case "exam_schedule_notice":
            return { purpose, entries: f.exams.map((e) => ({ subject: e.subject, date: e.date, time: e.time ? parseTime(e.time) : null })) };
        case "absence_notice": return { purpose, date: f.date };
        case "emergency_closure":
            return { purpose, date: f.date, reason: f.reason, busesRunning: f.buses === "unknown" ? null : f.buses === "yes" };
    }
}

/**
 * What the chosen workflow still needs before a preview can be asked for, or null when complete.
 * The server validates again; this only keeps an incomplete request from being sent.
 */
function missingFact(t: Translate, purpose: RiyaPurpose, f: FactsState): string | null {
    switch (purpose) {
        case "ptm_invitation":
        case "event_invitation":
            return !f.date ? t("Choose the date first.") : !f.time ? t("Choose the time first.") : null;
        case "holiday_notice":
            return f.holidays.length === 0 ? t("Choose at least one holiday from the school calendar. If none are listed, add them in the school's Settings first.") : null;
        case "exam_schedule_notice":
            return f.exams.some((e) => !e.date) ? t("Give every exam a date first.") : null;
        case "absence_notice":
        case "emergency_closure":
            return !f.date ? t("Choose the date first.") : null;
    }
}

function TimeSelect({ id, value, onChange, optional }: { id: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
    const { t } = useLanguage();
    return (
        <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
                {optional && <SelectItem value="none">{t("No time")}</SelectItem>}
                {TIMES.map((tm) => <SelectItem key={timeKey(tm)} value={timeKey(tm)}>{timeKey(tm)}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function FactsFields({ purpose, facts, setFacts, holidays }: { purpose: RiyaPurpose; facts: FactsState; setFacts: (f: FactsState) => void; holidays: string[] }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const set = (patch: Partial<FactsState>) => setFacts({ ...facts, ...patch });
    const upcoming = holidays.filter((d) => d >= today()).sort();

    if (purpose === "holiday_notice") {
        return (
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t("Holidays on the school calendar")}</legend>
                {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{t("No upcoming holidays on the school calendar. Add them in Settings first.")}</p>}
                {upcoming.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={facts.holidays.includes(d)}
                            onCheckedChange={(on) => set({ holidays: on ? [...facts.holidays, d] : facts.holidays.filter((x) => x !== d) })}
                        />
                        {f.day(d)}
                    </label>
                ))}
            </fieldset>
        );
    }

    if (purpose === "exam_schedule_notice") {
        return (
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{t("Exam schedule")}</legend>
                {facts.exams.map((row, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <Select value={row.subject} onValueChange={(v) => set({ exams: facts.exams.map((r, j) => (j === i ? { ...r, subject: v as ExamSubject } : r)) })}>
                            <SelectTrigger aria-label={t("Subject")}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {(Object.keys(EXAM_SUBJECTS) as ExamSubject[]).map((s) => <SelectItem key={s} value={s}>{EXAM_SUBJECTS[s]}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input type="date" aria-label={t("Date")} value={row.date} min={today()} onChange={(e) => set({ exams: facts.exams.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)) })} />
                        <TimeSelect id={`exam-time-${i}`} optional value={row.time} onChange={(v) => set({ exams: facts.exams.map((r, j) => (j === i ? { ...r, time: v } : r)) })} />
                        <Button type="button" variant="ghost" onClick={() => set({ exams: facts.exams.filter((_, j) => j !== i) })} disabled={facts.exams.length === 1}>{t("Remove")}</Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={facts.exams.length >= 8} onClick={() => set({ exams: [...facts.exams, { subject: "english", date: "", time: "" }] })}>
                    {t("Add an exam")}
                </Button>
            </fieldset>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {purpose === "event_invitation" && (
                <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="riya-event">{t("Event")}</Label>
                    <Select value={facts.eventType} onValueChange={(v) => set({ eventType: v as EventType })}>
                        <SelectTrigger id="riya-event"><SelectValue /></SelectTrigger>
                        <SelectContent>{EVENT_TYPES.map((e) => <SelectItem key={e} value={e}>{eventTypeLabel(t, e)}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            )}
            <div className="space-y-1">
                <Label htmlFor="riya-date">{purpose === "absence_notice" ? t("Day of absence") : t("Date")}</Label>
                <Input id="riya-date" type="date" value={facts.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
            {(purpose === "ptm_invitation" || purpose === "event_invitation") && (
                <div className="space-y-1">
                    <Label htmlFor="riya-time">{t("Time")}</Label>
                    <TimeSelect id="riya-time" value={facts.time} onChange={(v) => set({ time: v })} />
                </div>
            )}
            {purpose === "emergency_closure" && (
                <>
                    <div className="space-y-1">
                        <Label htmlFor="riya-reason">{t("Reason")}</Label>
                        <Select value={facts.reason} onValueChange={(v) => set({ reason: v as ClosureReason })}>
                            <SelectTrigger id="riya-reason"><SelectValue /></SelectTrigger>
                            <SelectContent>{CLOSURE_REASONS.map((r) => <SelectItem key={r} value={r}>{closureReasonLabel(t, r)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="riya-buses">{t("School buses")}</Label>
                        <Select value={facts.buses} onValueChange={(v) => set({ buses: v as FactsState["buses"] })}>
                            <SelectTrigger id="riya-buses"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="yes">{t("Buses will run")}</SelectItem>
                                <SelectItem value="no">{t("Buses will not run")}</SelectItem>
                                <SelectItem value="unknown">{t("Do not mention buses")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Call log ─────────────────────────────────────────────────────────────────

/**
 * A listener's request to be called back vs a callback a person has scheduled: never the same thing.
 * `callback` is the callback record that follows this call, if any (school calendar).
 */
function CallbackStatusLine({ call, callback }: { call: ConversationCallView; callback: CallbackView | null }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const requested = callback?.requestedText ?? call.synopsis?.callbackRequest ?? null;
    if (callback?.status === "scheduled" && callback.scheduledAt) {
        return <p className="flex flex-wrap items-center gap-2 text-sm"><StatusPill tone="info">{t("Callback scheduled")}</StatusPill><span className="text-foreground">{f.dateTime(callback.scheduledAt)}</span></p>;
    }
    if (callback && callback.status !== "proposed") {
        return <p className="flex flex-wrap items-center gap-2 text-sm"><StatusPill tone="neutral">{fmt(t("Callback {status}"), { status: t(callback.status) })}</StatusPill></p>;
    }
    if (callback || requested) {
        return (
            <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusPill tone="warning">{t("Callback requested")}</StatusPill>
                {requested && <span className="text-foreground break-words">{fmt(t("asked for: \u201c{text}\u201d"), { text: requested })}</span>}
                <span className="text-muted-foreground">{callback ? t("Not scheduled yet: confirm a time in the calendar.") : t("Not in the calendar yet.")}</span>
            </p>
        );
    }
    return null;
}

function CallRow({ orgId, call, onChange, callback = null }: { orgId: string; call: ConversationCallView; onChange: () => void; callback?: CallbackView | null }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const f = useSamparkFormat();
    const [detail, setDetail] = useState<RiyaCallDetail | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (fn: () => Promise<RiyaCallDetail>) => {
        setBusy(true);
        try {
            setDetail(await fn());
            onChange();
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(false);
        }
    };

    // "not_applicable" is the agent's "this question was not part of the call"; callback and stop have their own lines.
    const answers = Object.entries(call.dataCollection ?? {}).filter(([k, v]) => v && v.trim().toLowerCase() !== "not_applicable" && k !== "callback_requested_time" && k !== "stop_requested");
    const ended = call.state === "completed" || call.state === "no_answer" || call.state === "busy" || call.state === "failed";
    return (
        <li className="space-y-2 border-b border-border py-3 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-medium text-foreground break-words">
                        {riyaPurposeLabel(t, call.riyaPurpose)} · {call.guardianDisplayName ?? "—"}
                        {call.studentDisplayName ? ` (${call.studentDisplayName})` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {f.dateTime(call.createdAt)} · {fmt(t("Phone ending {last4}"), { last4: call.phoneLast4 })}
                        {call.destination === "test_phone" && <> · {t("Test phone")}</>}
                        {call.provider === "simulated" && <> · {t("Simulated")}</>}
                        {call.durationSeconds !== null && <> · {fmt(t("{seconds} s"), { seconds: Math.round(call.durationSeconds) })}</>}
                    </p>
                </div>
                <StatusPill tone={stateTone(call.state)}>{stateLabel(t, call.state)}</StatusPill>
            </div>
            {call.failureReason && <p className="text-xs text-muted-foreground break-words">{fmt(t("Reason: {reason}"), { reason: call.failureReason })}</p>}
            {call.stopRequested && <p className="text-sm text-foreground">{t("The listener asked not to be called again. The office should confirm this with the parent.")}</p>}
            {/* The synopsis, never the transcript: the transcript stays on the server. */}
            {call.synopsis ? (
                <>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground" aria-label={t("Call synopsis")}>
                        {call.synopsis.bullets.map((b, i) => <li key={i} className="break-words">{b}</li>)}
                    </ul>
                    {call.state === "completed" && call.synopsis.status === "provisional" && (
                        <p className="text-xs text-muted-foreground">{t("Provisional: written before the provider sent the conversation. It is replaced when the transcript arrives.")}</p>
                    )}
                </>
            ) : ended && call.provider === "elevenlabs" ? (
                <p className="text-sm text-muted-foreground">{t("The call synopsis is being written…")}</p>
            ) : null}
            {/* Collected answers are their own stored field, not the transcript. */}
            {answers.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-4 text-sm sm:grid-cols-2" aria-label={t("Collected answers")}>
                    {answers.map(([k, v]) => (
                        <div key={k} className="flex gap-2"><dt className="text-muted-foreground">{answerKeyLabel(t, k)}</dt><dd className="text-foreground break-words">{answerValueLabel(t, v ?? "")}</dd></div>
                    ))}
                </dl>
            )}
            <CallbackStatusLine call={call} callback={callback} />
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => run(() => getRiyaCall(orgId, call.id))}>{t("Details")}</Button>
                {/* An unknown call without an id is looked up by our own user id on the server. */}
                {call.provider === "elevenlabs" && (call.state === "unknown" || (call.providerConversationId && call.state === "initiated")) && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run(() => reconcileRiya(orgId, call.id))}>{t("Check status")}</Button>
                )}
                {call.state === "unknown" && !call.reviewedAt && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run(() => reviewRiya(orgId, call.id, "cannot_tell"))}>{t("Mark as checked")}</Button>
                )}
            </div>
            {detail && (
                <div className="space-y-1 rounded-surface-sm border border-border bg-muted/30 p-3 text-xs">
                    <p className="text-muted-foreground">{fmt(t("Agent {agent} · number {number} · conversation {conversation}"), {
                        agent: detail.call.agentId ?? "—",
                        number: detail.call.agentPhoneNumberId ?? "—",
                        conversation: detail.call.providerConversationId ?? "—",
                    })}</p>
                    <p className="text-foreground break-words">{detail.call.announcement}</p>
                    <p className="text-muted-foreground">
                        {detail.call.transcriptExpiresAt && Date.parse(detail.call.transcriptExpiresAt) > Date.now()
                            ? fmt(t("The full transcript is kept securely on the server until {date} and is not shown here."), { date: f.dateTime(detail.call.transcriptExpiresAt) })
                            : t("No transcript is kept for this call.")}
                    </p>
                </div>
            )}
        </li>
    );
}

// ── Live history ─────────────────────────────────────────────────────────────

/**
 * Real calls still worth a provider lookup: ringing, talking, unclear and not yet checked by a
 * person, or (when transcripts are kept) finished in the last 7 days without one.
 */
/** How long after a call ends Check status keeps looking for its transcript and final synopsis. */
const RESULT_WAIT_MS = 24 * 3_600_000;

function pendingRealCalls(calls: ConversationCallView[], storeTranscripts: boolean): ConversationCallView[] {
    const since = Date.now() - RESULT_WAIT_MS;
    return calls.filter((c) => c.provider === "elevenlabs" && (
        c.state === "initiating" || c.state === "initiated" || (c.state === "unknown" && !c.reviewedAt)
        // A finished call whose result is still incomplete: no synopsis, a provisional one, or no transcript yet.
        || (c.state === "completed" && Boolean(c.providerConversationId) && !c.transcriptPurgedAt && Date.parse(c.endedAt ?? c.createdAt) > since
            && (!c.synopsis || c.synopsis.status === "provisional" || (storeTranscripts && !c.transcriptExpiresAt)))
    ));
}

export const LIVE_STATUS_INTERVAL_MS = 15_000;

/**
 * Keeps real calls current without a webhook (a local machine cannot receive one): every 15 s while
 * a call is ringing, talking or unclear, the server's read-only provider lookup ("Check status") runs
 * for it and the list reloads, so the outcome, collected answers, transcript and any callback
 * request appear on their own. Stops as soon as nothing is pending. Never places a call.
 */
function useLiveRiyaStatus(orgId: string, calls: ConversationCallView[], reload: () => void, storeTranscripts: boolean): boolean {
    const pending = pendingRealCalls(calls, storeTranscripts);
    const key = pending.map((c) => `${c.id}:${c.state}`).join(",");
    const latest = useRef({ pending, reload });
    latest.current = { pending, reload };
    useEffect(() => {
        if (!key) return;
        const tick = () => {
            void (async () => {
                for (const c of latest.current.pending) {
                    if (c.state === "initiating") continue;
                    try {
                        await reconcileRiya(orgId, c.id);
                    } catch {
                        // Not found yet / provider busy: the next tick tries again; a person can still "Mark as checked".
                    }
                }
                latest.current.reload();
            })();
        };
        // A finished call missing its transcript is fetched at once; live calls every 15 s.
        const first = setTimeout(tick, 1_000);
        const timer = setInterval(tick, LIVE_STATUS_INTERVAL_MS);
        return () => { clearTimeout(first); clearInterval(timer); };
    }, [orgId, key]);
    return pending.length > 0;
}

/** An org's Riya calls with live status (see useLiveRiyaStatus), outcome, synopsis, answers, callback status and Details (never the transcript). */
export function RiyaCallHistory({ orgId, calls, reload, storeTranscripts = false, callbacks = [] }: { orgId: string; calls: ConversationCallView[]; reload: () => void; storeTranscripts?: boolean; callbacks?: CallbackView[] }) {
    const { t } = useLanguage();
    const live = useLiveRiyaStatus(orgId, calls, reload, storeTranscripts);
    // The callback that follows each call (newest wins).
    const callbackFor = new Map<string, CallbackView>();
    for (const cb of [...callbacks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (cb.sourceCallId) callbackFor.set(cb.sourceCallId, cb);
    if (calls.length === 0) return <p className="text-sm text-muted-foreground">{t("No Riya calls yet.")}</p>;
    return (
        <>
            {live && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />{t("Updating call status every 15 seconds…")}</p>}
            <ul>{calls.map((c) => <CallRow key={c.id} orgId={orgId} call={c} onChange={reload} callback={callbackFor.get(c.id) ?? null} />)}</ul>
        </>
    );
}

// ── Panel ────────────────────────────────────────────────────────────────────

/** One contact chosen elsewhere (e.g. a class roster): the family picker is hidden and history shows only their calls. */
export interface RiyaFixedFamily {
    guardianId: string;
    studentId: string;
}

export function RiyaCallPanel({ fixedFamily }: { fixedFamily?: RiyaFixedFamily } = {}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school } = useSamparkSchool();
    const f = useSamparkFormat();
    const riya = useSamparkQuery((signal) => getRiya(orgId, { signal }), [orgId]);
    const families = useSamparkQuery((signal) => listGuardians(orgId, { limit: 500 }, { signal }), [orgId]);

    const [purpose, setPurpose] = useState<RiyaPurpose | "">("");
    const [familyKey, setFamilyKey] = useState(fixedFamily ? `${fixedFamily.guardianId}|${fixedFamily.studentId}` : "");
    const [query, setQuery] = useState("");
    const [facts, setFacts] = useState<FactsState>({ date: "", time: "10:00", eventType: "annual_day", holidays: [], exams: [{ subject: "english", date: "", time: "" }], reason: "heavy_rain", buses: "unknown" });
    const [scenario, setScenario] = useState<SimulationScenario>("answered_positive");
    const [preview, setPreview] = useState<RiyaPreview | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
    const [busy, setBusy] = useState<"preview" | "start" | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    // Real calls only: the webhook route is checked over this page's own public origin (the URL
    // ElevenLabs posts the result to) every time the confirmation opens.
    const [webhook, setWebhook] = useState<"unchecked" | "checking" | "ok" | "failed">("unchecked");

    const options = useMemo(() => {
        const rows: { key: string; label: string; guardian: GuardianRow; studentId: string }[] = [];
        for (const g of families.data ?? []) {
            for (const s of g.students) {
                rows.push({ key: `${g.id}|${s.id}`, label: `${g.displayName} — ${s.displayName} (${s.grade}${s.section})`, guardian: g, studentId: s.id });
            }
        }
        const q = query.trim().toLowerCase();
        return q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
    }, [families.data, query]);

    if (riya.error) return <ErrorPanel error={riya.error} onRetry={riya.reload} />;
    if (!riya.data) return <LoadingBlock rows={4} />;
    const { availability } = riya.data;
    const calls = fixedFamily ? riya.data.calls.filter((c) => c.guardianId === fixedFamily.guardianId && c.studentId === fixedFamily.studentId) : riya.data.calls;

    if (!availability.enabled) {
        return <EmptyState icon={Bot} title={t("Riya is not switched on for this school yet")} description={t("Your SahayakAI contact switches Riya on when your school is ready to test.")} />;
    }

    const reset = () => { setPreview(null); setIdempotencyKey(null); };
    const selected = options.find((o) => o.key === familyKey) ?? (families.data ?? []).flatMap((g) => g.students.map((s) => ({ key: `${g.id}|${s.id}`, guardian: g, studentId: s.id }))).find((o) => o.key === familyKey);
    const missing = purpose ? missingFact(t, purpose, facts) : null;
    const request = purpose && selected && !missing ? { purpose, guardianId: selected.guardian.id, studentId: selected.studentId, facts: factsFor(purpose, facts) } : null;

    const doPreview = async () => {
        if (!request) return;
        setBusy("preview");
        try {
            const p = await previewRiya(orgId, request);
            setPreview(p);
            // One key per approved preview: a double click or a retried request can never place a second call.
            setIdempotencyKey(globalThis.crypto.randomUUID());
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(null);
        }
    };

    const realCall = availability.provider === "elevenlabs";
    // A real call still ringing, or one whose outcome nobody has checked, blocks the next one.
    const callInProgress = calls.some((c) => c.provider === "elevenlabs" && (c.state === "initiating" || c.state === "initiated" || (c.state === "unknown" && !c.reviewedAt)));
    const realReady = !realCall || (webhook === "ok" && preview?.nonProductionDatabase === true && Boolean(preview?.destinationE164) && !callInProgress);

    const openConfirm = async () => {
        setConfirmOpen(true);
        if (!realCall) return;
        setWebhook("checking");
        try {
            const res = await fetch("/api/webhooks/elevenlabs-riya", { method: "GET", cache: "no-store" });
            setWebhook(res.ok ? "ok" : "failed");
        } catch {
            setWebhook("failed");
        }
    };

    const doStart = async () => {
        if (!request || !preview?.ok || !preview.announcement || !idempotencyKey || !realReady) return;
        setBusy("start");
        try {
            const r = await startRiya(orgId, {
                ...request,
                idempotencyKey,
                confirmedAnnouncement: preview.announcement,
                ...(availability.provider === "simulated" ? { scenario } : {}),
            });
            toast({ title: fmt(t("Call status: {status}"), { status: stateLabel(t, r.call.state) }) });
            reset();
            riya.reload();
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(null);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-4">
            <SectionCard
                icon={Bot}
                title={t("Riya calling assistant")}
                description={t("Riya is an AI assistant that calls one parent about one school notice. She says she is an AI if asked, never shares a child's details before the listener confirms they are the parent or guardian, and only says the facts you enter here.")}
            >
                <p className="text-sm text-foreground">{availability.rosterMode ? t("Local test roster: each call rings the chosen contact's own number, only if it is on this machine's allow-list.") : modeBannerText(t, availability.mode, availability.destinationLast4)}</p>
                {availability.localAfterHoursUntil && (
                    <p className="text-sm font-medium text-destructive">{fmt(t("Local after-hours test window is open until {time}. Real calls can ring outside school calling hours."), { time: f.dateTime(availability.localAfterHoursUntil) })}</p>
                )}
                {availability.blocker && <p className="text-sm text-muted-foreground">{availability.blocker === "LIVE_MODE_NOT_AVAILABLE" ? t("Riya calls run only in Practice or Test mode in this release.") : availability.blocker === "DEMO_SCHOOL_PRACTICE_ONLY" ? t("This is a demo school, so Riya calls stay in Practice. Real test calls need a non-demo school.") : availability.blocker === "TEST_PHONE_NOT_ALLOWED" ? t("The saved test phone is not on this deployment's list of numbers Riya may call.") : fmt(t("Riya cannot place calls yet ({reason})."), { reason: availability.blocker })}</p>}
                {availability.recordingConsentRequired && <p className="text-sm text-muted-foreground">{t("Riya calls are recorded, so only parents who agreed to recorded calls can be called.")}</p>}
            </SectionCard>

            <SectionCard icon={PhoneCall} title={t("New Riya call")}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor="riya-purpose">{t("What is the call about?")}</Label>
                        <Select value={purpose} onValueChange={(v) => { setPurpose(v as RiyaPurpose); reset(); }}>
                            <SelectTrigger id="riya-purpose"><SelectValue placeholder={t("Choose")} /></SelectTrigger>
                            <SelectContent>{availability.purposes.map((p) => <SelectItem key={p} value={p}>{riyaPurposeLabel(t, p)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {!fixedFamily && <div className="space-y-1">
                        <Label htmlFor="riya-family">{t("Parent / Guardian")}</Label>
                        <Input aria-label={t("Search parents")} placeholder={t("Search parents")} value={query} onChange={(e) => setQuery(e.target.value)} />
                        <Select value={familyKey} onValueChange={(v) => { setFamilyKey(v); reset(); }}>
                            <SelectTrigger id="riya-family"><SelectValue placeholder={t("Choose")} /></SelectTrigger>
                            <SelectContent>{options.slice(0, 200).map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>}
                </div>

                {purpose && (
                    <FactsFields purpose={purpose} facts={facts} setFacts={(next) => { setFacts(next); reset(); }} holidays={school.holidays ?? []} />
                )}

                {availability.provider === "simulated" && (
                    <div className="space-y-1">
                        <Label htmlFor="riya-scenario">{t("Practice: what happens on the call")}</Label>
                        <Select value={scenario} onValueChange={(v) => setScenario(v as SimulationScenario)}>
                            <SelectTrigger id="riya-scenario"><SelectValue /></SelectTrigger>
                            <SelectContent>{SIMULATION_SCENARIOS.map((s) => <SelectItem key={s} value={s}>{scenarioLabel(t, s)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {missing && <p className="w-full text-sm text-muted-foreground">{missing}</p>}
                    <Button type="button" variant="outline" disabled={!request || busy !== null} onClick={doPreview}>
                        {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t("Preview what Riya will say")}
                    </Button>
                    <Button type="button" disabled={!preview?.ok || busy !== null} onClick={() => void openConfirm()}>
                        {availability.provider === "simulated" ? t("Run practice call") : t("Call Parent")}
                    </Button>
                </div>

                {preview && (
                    <div className="space-y-2 rounded-surface-sm border border-border p-3 text-sm">
                        {preview.recipient && (
                            <p className="text-foreground">
                                {fmt(t("To: {guardian} ({relation}) about {student}"), {
                                    guardian: preview.recipient.guardianDisplayName,
                                    relation: relationLabel(t, preview.recipient.relation),
                                    student: preview.recipient.studentDisplayName,
                                })}
                            </p>
                        )}
                        {preview.destinationLast4 && (
                            <p className="text-foreground">
                                {preview.destinationE164
                                    ? fmt(t("Number that will ring: {number}"), { number: preview.destinationE164 })
                                    : preview.destination === "test_phone"
                                    ? fmt(t("Rings: the school test phone ending {last4}"), { last4: preview.destinationLast4 })
                                    : fmt(t("Rings: phone ending {last4} (simulated, nothing rings)"), { last4: preview.destinationLast4 })}
                            </p>
                        )}
                        {preview.opening && <p className="text-muted-foreground break-words">“{preview.opening}”</p>}
                        {preview.announcement && <p className="font-medium text-foreground break-words">“{preview.announcement}”</p>}
                        {preview.agentId && <p className="text-xs text-muted-foreground">{fmt(t("Agent {agent} · number {number}"), { agent: preview.agentId, number: preview.agentPhoneNumberId ?? "—" })}</p>}
                        {preview.refusals.length > 0 && (
                            <ul className="list-disc space-y-1 pl-5 text-destructive">
                                {preview.refusals.map((r, i) => <li key={i}>{refusalText(t, r)}</li>)}
                            </ul>
                        )}
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title={t("Recent Riya calls")}
                action={<Button type="button" size="sm" variant="ghost" onClick={riya.reload}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />{t("Refresh")}</Button>}
            >
                <RiyaCallHistory orgId={orgId} calls={calls} reload={riya.reload} storeTranscripts={availability.storeTranscripts} />
            </SectionCard>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{availability.provider === "simulated" ? t("Run a practice call?") : t("Confirm Parent Call")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {availability.provider === "simulated"
                                ? t("Nothing will ring. The result appears in the list below.")
                                : availability.rosterMode
                                ? fmt(t("Riya will call {name} on {number} now and say the lines shown in the preview."), { name: preview?.recipient?.studentDisplayName ?? "", number: preview?.destinationE164 ?? "" })
                                : fmt(t("Riya will call the school test phone ending {last4} now and say the lines shown in the preview."), { last4: preview?.destinationLast4 ?? "" })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {realCall && preview && (
                        <ul className="space-y-1 text-sm text-foreground" aria-label={t("Before the call")}>
                            <li>{fmt(t("Agent {agent} · branch {branch} · number {number}"), { agent: preview.agentId ?? "—", branch: preview.agentBranchId ?? "main", number: preview.agentPhoneNumberId ?? "—" })}</li>
                            <li className="font-medium">{preview.destinationE164 ? fmt(t("Number that will ring: {number}"), { number: preview.destinationE164 }) : t("The number that will ring could not be verified: real calls are refused")}</li>
                            <li>{fmt(t("Purpose: {purpose}"), { purpose: riyaPurposeLabel(t, preview.purpose) })}</li>
                            <li>{preview.nonProductionDatabase ? t("Non-production database") : t("Not the non-production database: real calls are refused")}</li>
                            <li>{preview.testWindowOverride ? fmt(t("Staging test window until {time}"), { time: f.dateTime(preview.testWindowOverride.until) }) : t("Normal calling hours")}</li>
                            <li>{webhook === "ok" ? t("Webhook reachable, signature check on") : webhook === "failed" ? t("Webhook check failed: the call result could not come back") : t("Checking the webhook…")}</li>
                            <li>{callInProgress ? t("Another Riya call is still in progress") : fmt(t("At most {cap} real test call(s) today; no other Riya call is in progress"), { cap: availability.testDailyCap })}</li>
                        </ul>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy === "start"}>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction disabled={busy === "start" || !realReady} onClick={(e) => { e.preventDefault(); void doStart(); }}>
                            {busy === "start" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {availability.provider === "simulated" ? t("Run practice call") : busy === "start" ? t("Initiating Call") : t("Trigger Call")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
