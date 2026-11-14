"use client";

/**
 * Class-wide outreach: one teacher action, one independent Riya call per eligible family.
 *
 *   1. Configure  — reason (generic class announcements only), its typed facts, language.
 *   2. Review     — totals (students, eligible, missing phone, opted out, other), what Riya will
 *                   say, every family with its eligibility; the teacher can remove families.
 *   3. Confirm    — an explicit confirmation; for real calls a second "real phones will ring" check.
 *   4. Campaign   — live progress, pause / resume / cancel pending, retry unsuccessful families,
 *                   each family's outcome and each call's synopsis and answers.
 *
 * The browser sends the class, the reason, typed facts and family ids. The server resolves names,
 * numbers and lines from school records and applies every calling rule to every call.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Megaphone, Pause, Play, RefreshCw, RotateCcw, Users, XCircle } from "lucide-react";
import { SectionCard } from "@/components/layout";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import {
    actOnBatch,
    getBatchDetail,
    getBatchOverview,
    previewBatch,
    startBatch,
    type BatchCampaignView,
    type BatchDetail,
    type BatchPreview,
    type BatchRequest,
} from "@/lib/api/sampark-batch";
import { BATCH_REASONS, INDIVIDUAL_ONLY_PURPOSES, batchReason, type BatchReasonId } from "@/lib/sampark/batch/reasons";
import type { BatchExclusionReason, BatchRecipientStatus } from "@/lib/sampark/batch/types";
import { SIMULATION_SCENARIOS, type SimulationScenario } from "@/lib/sampark/conversation/simulated-provider";
import { MiniStat, ProgressBar } from "./console-ui";
import { fmt } from "./labels";
import { emptyFactsState, factsFor, FactsFields, missingFact, refusalText, RiyaCallHistory, riyaPurposeLabel, scenarioLabel, type FactsState } from "./riya-call-panel";
import { useSamparkSchool } from "./school-context";
import { ErrorPanel, LoadingBlock, errorMessage } from "./states";
import { StatusPill } from "./status-pill";
import { useSamparkFormat } from "./format";
import { useSamparkQuery } from "./use-sampark-query";

type Translate = (key: string) => string;

/** While a campaign runs and its page is open, the queue is advanced from here as well as by the scheduler. */
export const BATCH_POLL_MS = 5_000;

export function batchReasonLabel(t: Translate, id: BatchReasonId): string {
    return t(batchReason(id).label);
}

function exclusionLabel(t: Translate, r: BatchExclusionReason): string {
    switch (r) {
        case "missing_phone": return t("Missing or invalid phone number");
        case "opted_out": return t("Opted out / do not call");
        case "no_consent": return t("No consent for recorded calls");
        case "not_allow_listed": return t("Not on the real-call allow-list");
        case "language": return t("Riya speaks English only");
        case "inactive": return t("Not active in school records");
        case "sensitive": return t("Restricted: the office contacts this family");
        case "frequency_cap": return t("Called too often recently");
        case "same_family": return t("Same parent as another child here (one call per family)");
        case "already_called": return t("Already called about this");
        case "teacher_excluded": return t("Removed by you");
        default: return t("Not allowed by the calling rules");
    }
}

function recipientStatusLabel(t: Translate, s: BatchRecipientStatus): string {
    switch (s) {
        case "pending": return t("Waiting");
        case "dialing": return t("Dialling");
        case "in_progress": return t("In progress");
        case "completed": return t("Completed");
        case "no_answer": return t("No answer");
        case "busy": return t("Busy");
        case "failed": return t("Failed");
        case "unknown": return t("Outcome unknown");
        case "skipped": return t("Skipped");
        case "cancelled": return t("Not called (cancelled)");
    }
}

function recipientTone(s: BatchRecipientStatus) {
    if (s === "completed") return "success" as const;
    if (s === "dialing" || s === "in_progress") return "info" as const;
    if (s === "unknown" || s === "no_answer" || s === "busy") return "warning" as const;
    if (s === "failed") return "danger" as const;
    return "neutral" as const;
}

function waitingLabel(t: Translate, code: string | null): string | null {
    switch (code) {
        case null: return null;
        case "OUTSIDE_CALLING_HOURS": return t("Waiting for the school calling hours. Calls start automatically when the window opens.");
        case "SCHOOL_PAUSED": return t("Calls are paused for this school. Calls start when the school pause is lifted.");
        case "REAL_BATCH_DISABLED": return t("Real class-wide calls are switched off on this deployment.");
        case "DAILY_LIMIT_REACHED": return t("Today's limit for class-wide calls has been reached. Calls continue tomorrow.");
        case "CONCURRENCY_FULL": return t("Every calling slot is busy. The next family is called as soon as one of these calls ends.");
        case "WAITING_FOR_INTERVAL": return t("Waiting for the minimum gap between calls.");
        case "PROVIDER_RATE_LIMITED": return t("The calling service asked us to slow down. Calls continue automatically after a short wait.");
        default: return code;
    }
}

function pauseLabel(t: Translate, code: string | null): string | null {
    switch (code) {
        case null: return null;
        case "PAUSED_BY_STAFF": return t("Paused. Calls already ringing finish; no new calls start until you resume.");
        case "CREATOR_NOT_AUTHORISED": return t("Paused: the person who started it no longer manages this class.");
        case "PROVIDER_CHANGED": return t("Paused: the school's calling provider or mode changed since the start.");
        default: return code;
    }
}

/** Why this campaign runs at the number of slots it does, when something lowered it. */
function capacityNote(t: Translate, c: BatchCampaignView): string | null {
    if (c.concurrencySource === "provider") return t("limited by the calling account");
    if (c.concurrencySource === "ai") return t("limited by the voice service");
    return null;
}

function providerText(t: Translate, p: BatchPreview["provider"]): string {
    if (p === "vobiz") return t("Vobiz (real calls)");
    if (p === "elevenlabs") return t("ElevenLabs (real calls)");
    if (p === "simulated") return t("Practice (simulated, nothing rings)");
    return t("Not available");
}

/**
 * The campaign's calling slots, straight from the server: one box per slot the scheduler may use,
 * filled by the families whose calls are actually in flight. Nothing here is simulated or animated.
 */
function ConcurrencySlots({ t, slots, active }: { t: Translate; slots: number; active: { id: string; studentDisplayName: string; status: BatchRecipientStatus }[] }) {
    const boxes = Array.from({ length: Math.max(1, slots) }, (_, i) => active[i] ?? null);
    return (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{fmt(t("{n} of {max} calling slots in use"), { n: String(active.length), max: String(slots) })}</p>
            <ul className="grid gap-2 sm:grid-cols-3">
                {boxes.map((r, i) => (
                    <li key={r?.id ?? `free-${i}`} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                        {r ? (
                            <>
                                <span className="block truncate text-foreground">{r.studentDisplayName}</span>
                                <span className="text-muted-foreground">{recipientStatusLabel(t, r.status)}</span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">{t("Free")}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Setup + review ───────────────────────────────────────────────────────────

interface ClassRef {
    grade: number;
    section: string;
    label: string;
}

function ClassOutreachSetup({ cls, onStarted }: { cls: ClassRef; onStarted: (campaign: BatchCampaignView) => void }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school } = useSamparkSchool();
    const [reason, setReason] = useState<BatchReasonId | "">("");
    const [facts, setFacts] = useState<FactsState>(emptyFactsState);
    const [scenario, setScenario] = useState<SimulationScenario>("answered_positive");
    const [preview, setPreview] = useState<BatchPreview | null>(null);
    const [excluded, setExcluded] = useState<{ guardianId: string; studentId: string }[]>([]);
    const [busy, setBusy] = useState<"preview" | "start" | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [realAck, setRealAck] = useState(false);
    const requestKey = useRef<string | null>(null);

    const spec = reason ? batchReason(reason) : null;
    const purpose = spec?.purpose ?? null;
    const missing = purpose ? missingFact(t, purpose, facts) : null;
    const request: BatchRequest | null = reason && purpose && !missing ? { grade: cls.grade, section: cls.section, reason, facts: factsFor(purpose, facts), excluded } : null;

    const reset = () => { setPreview(null); requestKey.current = null; };

    const runPreview = async (req: BatchRequest) => {
        setBusy("preview");
        try {
            setPreview(await previewBatch(orgId, req));
            // One key per reviewed preview: a double click can never start two campaigns.
            requestKey.current = globalThis.crypto.randomUUID();
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(null);
        }
    };

    const toggle = (guardianId: string, studentId: string, on: boolean) => {
        if (!request) return;
        const next = on ? excluded.filter((e) => !(e.guardianId === guardianId && e.studentId === studentId)) : [...excluded, { guardianId, studentId }];
        setExcluded(next);
        void runPreview({ ...request, excluded: next });
    };

    const doStart = async () => {
        if (!request || !preview?.ok || !preview.sampleAnnouncement || !requestKey.current) return;
        setBusy("start");
        try {
            const r = await startBatch(orgId, {
                ...request,
                requestKey: requestKey.current,
                confirmedRecipientCount: preview.totals.eligible,
                confirmedSampleAnnouncement: preview.sampleAnnouncement,
                confirmRealCalls: preview.realCalls && realAck,
                ...(preview.provider === "simulated" ? { scenario } : {}),
            });
            toast({ title: fmt(t("Batch started: {n} families will be called"), { n: String(r.campaign.recipients.length) }) });
            setConfirmOpen(false);
            onStarted(r.campaign);
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(null);
        }
    };

    const eligible = preview?.recipients.filter((r) => r.eligible) ?? [];
    const notEligible = preview?.recipients.filter((r) => !r.eligible && r.exclusion && r.exclusion.reason !== "teacher_excluded") ?? [];
    const removed = preview?.recipients.filter((r) => r.exclusion?.reason === "teacher_excluded") ?? [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label htmlFor="batch-reason">{t("Outreach reason")}</Label>
                    <Select value={reason} onValueChange={(v) => { setReason(v as BatchReasonId); setExcluded([]); reset(); }}>
                        <SelectTrigger id="batch-reason"><SelectValue placeholder={t("Choose")} /></SelectTrigger>
                        <SelectContent>
                            {BATCH_REASONS.map((r) => (
                                <SelectItem key={r.id} value={r.id} disabled={!r.purpose}>
                                    {t(r.label)}{!r.purpose ? ` · ${t("not available yet")}` : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {spec && <p className="text-xs text-muted-foreground">{t(spec.hint)}</p>}
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{t("Language")}</p>
                    <p className="text-sm text-muted-foreground">{t("English. Riya speaks English only; families called in another language are not included.")}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                {fmt(t("Only general class announcements can be sent to a whole class. Individual matters ({list}) and personal PTM slots stay on each family's call page."), {
                    list: INDIVIDUAL_ONLY_PURPOSES.map((p) => riyaPurposeLabel(t, p)).join(", "),
                })}
            </p>

            {purpose && <FactsFields purpose={purpose} facts={facts} setFacts={(next) => { setFacts(next); reset(); }} holidays={school.holidays ?? []} />}

            <div className="flex flex-wrap gap-2">
                {missing && <p className="w-full text-sm text-muted-foreground">{missing}</p>}
                <Button type="button" variant="outline" disabled={!request || busy !== null} onClick={() => request && void runPreview(request)}>
                    {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t("Preview message and families")}
                </Button>
            </div>

            {preview && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label={t("Recipients")}>
                        <MiniStat label={t("Total students")} value={preview.totals.students} />
                        <MiniStat label={t("Eligible contacts")} value={preview.totals.eligible} />
                        <MiniStat label={t("Missing phone number")} value={preview.totals.missingPhone} />
                        <MiniStat label={t("Opted out")} value={preview.totals.optedOut} />
                        <MiniStat label={t("Otherwise excluded")} value={preview.totals.otherExcluded + preview.totals.teacherExcluded} />
                    </div>

                    <div className="space-y-2 rounded-surface-sm border border-border p-3 text-sm">
                        <p className="font-medium text-foreground">{t("What Riya will say")}</p>
                        {preview.opening && <p className="text-muted-foreground break-words">“{preview.opening}”</p>}
                        {preview.sampleAnnouncement && <p className="font-medium text-foreground break-words">“{preview.sampleAnnouncement}”</p>}
                        <p className="text-xs text-muted-foreground">{t("Each parent gets their own call. Riya confirms she is speaking to the parent of that child, uses the child's name from school records, and says only these facts.")}</p>
                        <p className="text-xs text-muted-foreground">{fmt(t("Calling with: {provider} · {n} call(s) at a time"), { provider: providerText(t, preview.provider), n: String(preview.concurrency) })}</p>
                    </div>

                    {preview.blockers.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive" aria-label={t("Why this batch cannot start")}>
                            {preview.blockers.map((b) => <li key={b.code}>{t(b.message)}</li>)}
                            {preview.refusals.map((r, i) => <li key={`r${i}`}>{refusalText(t, r)}</li>)}
                        </ul>
                    )}
                    {preview.waiting && <p className="text-sm text-foreground">{waitingLabel(t, preview.waiting.code)}</p>}

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">{fmt(t("Families to call ({n})"), { n: String(eligible.length) })}</p>
                        <p className="text-xs text-muted-foreground">{t("Untick a family to leave them out of this batch.")}</p>
                        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-surface-sm border border-border">
                            {[...eligible, ...removed].map((r) => (
                                <li key={r.studentId} className="flex items-center gap-3 px-3 py-2 text-sm">
                                    <Checkbox
                                        aria-label={fmt(t("Include {name}"), { name: r.studentDisplayName })}
                                        checked={r.eligible}
                                        disabled={busy !== null || !r.guardianId}
                                        onCheckedChange={(on) => r.guardianId && toggle(r.guardianId, r.studentId, Boolean(on))}
                                    />
                                    <span className="min-w-0 flex-1 break-words text-foreground">{r.studentDisplayName}</span>
                                    <span className="text-muted-foreground">{r.guardianDisplayName ?? "—"}</span>
                                    {r.phoneLast4 && <span className="text-xs text-muted-foreground">{fmt(t("ending {last4}"), { last4: r.phoneLast4 })}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {notEligible.length > 0 && (
                        <details className="rounded-surface-sm border border-border p-3 text-sm">
                            <summary className="cursor-pointer font-medium text-foreground">{fmt(t("Not included ({n})"), { n: String(notEligible.length) })}</summary>
                            <ul className="mt-2 space-y-1">
                                {notEligible.map((r) => (
                                    <li key={r.studentId} className="flex flex-wrap justify-between gap-2">
                                        <span className="text-foreground">{r.studentDisplayName}</span>
                                        <span className="text-muted-foreground">{r.exclusion ? exclusionLabel(t, r.exclusion.reason) : ""}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {preview.provider === "simulated" && (
                        <div className="space-y-1">
                            <Label htmlFor="batch-scenario">{t("Practice: what happens on each call")}</Label>
                            <Select value={scenario} onValueChange={(v) => setScenario(v as SimulationScenario)}>
                                <SelectTrigger id="batch-scenario"><SelectValue /></SelectTrigger>
                                <SelectContent>{SIMULATION_SCENARIOS.map((s) => <SelectItem key={s} value={s}>{scenarioLabel(t, s)}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button type="button" disabled={!preview.ok || busy !== null} onClick={() => { setRealAck(false); setConfirmOpen(true); }}>
                        <Megaphone className="mr-2 h-4 w-4" aria-hidden="true" />
                        {fmt(t("Start Batch Calls ({n})"), { n: String(preview.totals.eligible) })}
                    </Button>
                </div>
            )}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{preview?.realCalls ? t("Start real class-wide calls?") : t("Start practice class-wide calls?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {fmt(t("{cls} · {reason}: Riya will call {n} families, one call each, a few at a time."), {
                                cls: cls.label,
                                reason: reason ? batchReasonLabel(t, reason) : "",
                                n: String(preview?.totals.eligible ?? 0),
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {preview?.realCalls ? (
                        <label className="flex items-start gap-2 text-sm font-medium text-foreground">
                            <Checkbox checked={realAck} onCheckedChange={(on) => setRealAck(Boolean(on))} />
                            {fmt(t("I confirm {n} real phones will ring through {provider}, only numbers allowed for real calls."), { n: String(preview.totals.eligible), provider: providerText(t, preview.provider) })}
                        </label>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t("Nothing rings in Practice. The results appear in the campaign view.")}</p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy === "start"}>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction disabled={busy === "start" || (Boolean(preview?.realCalls) && !realAck)} onClick={(e) => { e.preventDefault(); void doStart(); }}>
                            {busy === "start" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {t("Start Batch Calls")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Campaign view ────────────────────────────────────────────────────────────

export function BatchCampaignPanel({ campaignId }: { campaignId: string }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId } = useSamparkSchool();
    const f = useSamparkFormat();
    const detail = useSamparkQuery((signal) => getBatchDetail(orgId, campaignId, { signal }), [orgId, campaignId], { pollMs: BATCH_POLL_MS });
    const [busy, setBusy] = useState<string | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const open = detail.data?.campaign.open ?? false;
    const running = detail.data?.campaign.status === "running";
    // The server's own next-launch time, so the page asks for a pass exactly when one is due
    // instead of waiting out a fixed poll (the scheduler tick and call webhooks do the same).
    const dueAt = detail.data?.campaign.nextLaunchAt ?? null;

    // While the page is open and the campaign runs, advance the queue (the scheduler does the same).
    const latest = useRef(detail);
    latest.current = detail;
    useEffect(() => {
        if (!running) return;
        const advance = () => void actOnBatch(orgId, campaignId, { action: "advance" }).then((d) => latest.current.setData(d)).catch(() => undefined);
        const id = setInterval(advance, BATCH_POLL_MS * 2);
        // One extra pass the moment the launch interval expires: no call waits for the next poll.
        const wait = dueAt ? Date.parse(dueAt) - Date.now() : NaN;
        const due = Number.isFinite(wait) && wait > 0 ? setTimeout(advance, wait + 250) : null;
        return () => {
            clearInterval(id);
            if (due) clearTimeout(due);
        };
    }, [orgId, campaignId, running, dueAt]);

    const act = async (action: Parameters<typeof actOnBatch>[2], label: string) => {
        setBusy(label);
        try {
            detail.setData(await actOnBatch(orgId, campaignId, action));
            if (action.action === "retry") setSelected([]);
        } catch (err) {
            toast({ variant: "destructive", title: errorMessage(t, err) });
        } finally {
            setBusy(null);
        }
    };

    if (detail.error) return <ErrorPanel error={detail.error} onRetry={detail.reload} />;
    if (!detail.data) return <LoadingBlock rows={4} />;
    const { campaign, calls } = detail.data as BatchDetail;
    const p = campaign.progress;
    const inFlight = campaign.recipients.filter((r) => r.status === "dialing" || r.status === "in_progress");
    const nextLaunch = p.pending > 0 ? campaign.nextLaunchAt ?? campaign.backoffUntil ?? null : null;
    const retryable = campaign.recipients.filter((r) => ["no_answer", "busy", "failed"].includes(r.status) && !r.stopRequested && !r.callbackRequested && r.attempts < 3);

    return (
        <div className="space-y-4">
            <SectionCard
                icon={Users}
                title={`${campaign.classLabel} — ${batchReasonLabel(t, campaign.reason)}`}
                description={fmt(t("Started {time} · {provider}"), { time: f.dateTime(campaign.startedAt), provider: providerText(t, campaign.provider) })}
                action={<Button type="button" size="sm" variant="ghost" onClick={detail.reload}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />{t("Refresh")}</Button>}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={campaign.status === "completed" ? "success" : campaign.status === "running" ? "info" : campaign.status === "paused" ? "warning" : "neutral"}>
                        {campaign.status === "running" ? t("Running") : campaign.status === "paused" ? t("Paused") : campaign.status === "completed" ? t("Completed") : t("Cancelled")}
                    </StatusPill>
                    {open && campaign.status !== "running" && p.inProgress > 0 && <span className="text-xs text-muted-foreground">{t("Calls already ringing are finishing.")}</span>}
                </div>
                <ProgressBar value={p.total - p.pending - p.inProgress} max={Math.max(1, p.total)} label={t("Campaign progress")} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <MiniStat label={t("Total recipients")} value={p.total} />
                    <MiniStat label={t("Active calls")} value={`${p.inProgress}/${campaign.concurrency}`} sub={capacityNote(t, campaign) ?? undefined} />
                    <MiniStat label={t("Pending")} value={p.pending} sub={p.retrying ? fmt(t("{n} retrying"), { n: String(p.retrying) }) : undefined} />
                    <MiniStat label={t("Completed")} value={p.completed} />
                    <MiniStat label={t("No answer / busy")} value={p.noAnswer + p.busy} />
                    <MiniStat label={t("Failed")} value={p.failed} sub={p.unknown ? fmt(t("{n} unknown"), { n: String(p.unknown) }) : undefined} />
                </div>
                <ConcurrencySlots t={t} slots={campaign.concurrency} active={inFlight} />
                {campaign.status === "running" && nextLaunch && (
                    <p className="text-sm text-muted-foreground">{fmt(t("Next call at {time}"), { time: f.dateTime(nextLaunch) })}</p>
                )}
                {(p.callbackRequested > 0 || p.stopRequested > 0 || p.skipped > 0 || p.cancelled > 0) && (
                    <p className="text-sm text-muted-foreground">
                        {fmt(t("Callback requests: {cb} · Do-not-call requests: {stop} · Skipped: {skip} · Not called (cancelled): {cancel}"), { cb: String(p.callbackRequested), stop: String(p.stopRequested), skip: String(p.skipped), cancel: String(p.cancelled) })}
                    </p>
                )}
                {campaign.status === "running" && campaign.waitingReason && <p className="text-sm text-foreground">{waitingLabel(t, campaign.waitingReason)}</p>}
                {campaign.status === "paused" && <p className="text-sm text-foreground">{pauseLabel(t, campaign.pauseReason)}</p>}
                <p className="text-sm text-muted-foreground break-words">“{campaign.sampleAnnouncement}”</p>
                <div className="flex flex-wrap gap-2">
                    {campaign.status === "running" && (
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void act({ action: "pause" }, "pause")}><Pause className="mr-2 h-4 w-4" aria-hidden="true" />{t("Pause")}</Button>
                    )}
                    {campaign.status === "paused" && (
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void act({ action: "resume" }, "resume")}><Play className="mr-2 h-4 w-4" aria-hidden="true" />{t("Resume")}</Button>
                    )}
                    {(campaign.status === "running" || campaign.status === "paused") && (
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void act({ action: "cancel" }, "cancel")}><XCircle className="mr-2 h-4 w-4" aria-hidden="true" />{t("Cancel pending calls")}</Button>
                    )}
                    {campaign.status !== "cancelled" && retryable.length > 0 && (
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void act(selected.length ? { action: "retry", recipientIds: selected } : { action: "retry" }, "retry")}>
                            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                            {selected.length ? fmt(t("Retry selected ({n})"), { n: String(selected.length) }) : fmt(t("Retry unsuccessful ({n})"), { n: String(retryable.length) })}
                        </Button>
                    )}
                </div>
            </SectionCard>

            <SectionCard title={t("Families")}>
                <ul className="divide-y divide-border">
                    {campaign.recipients.map((r) => {
                        const canRetry = retryable.some((x) => x.id === r.id);
                        return (
                            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                                {canRetry && campaign.status !== "cancelled" ? (
                                    <Checkbox aria-label={fmt(t("Select {name} to retry"), { name: r.studentDisplayName })} checked={selected.includes(r.id)} onCheckedChange={(on) => setSelected(on ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                                ) : <span className="w-4" aria-hidden="true" />}
                                <span className="min-w-0 flex-1 break-words text-foreground">{r.studentDisplayName} · {r.guardianDisplayName}</span>
                                <span className="text-xs text-muted-foreground">{fmt(t("ending {last4}"), { last4: r.phoneLast4 })}{r.attempts > 1 ? ` · ${fmt(t("{n} attempts"), { n: String(r.attempts) })}` : ""}</span>
                                {r.callbackRequested && <StatusPill tone="warning">{t("Callback requested")}</StatusPill>}
                                {r.stopRequested && <StatusPill tone="danger">{t("Do not call")}</StatusPill>}
                                <StatusPill tone={recipientTone(r.status)}>{recipientStatusLabel(t, r.status)}</StatusPill>
                                {r.lastError && <span className="w-full text-xs text-muted-foreground break-words">{r.lastError.message}</span>}
                            </li>
                        );
                    })}
                </ul>
                {campaign.excluded.length > 0 && (
                    <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">{fmt(t("Not included at the start ({n})"), { n: String(campaign.excluded.length) })}</summary>
                        <ul className="mt-2 space-y-1">
                            {campaign.excluded.map((e) => (
                                <li key={e.studentId} className="flex flex-wrap justify-between gap-2"><span className="text-foreground">{e.studentDisplayName}</span><span className="text-muted-foreground">{exclusionLabel(t, e.reason)}</span></li>
                            ))}
                        </ul>
                    </details>
                )}
            </SectionCard>

            <SectionCard title={t("Call results")} description={t("Each call's outcome, Riya's summary and the parent's answers. Full transcripts stay securely on the server.")}>
                <RiyaCallHistory orgId={orgId} calls={calls} reload={detail.reload} storeTranscripts={false} />
            </SectionCard>
        </div>
    );
}

// ── History + entry ──────────────────────────────────────────────────────────

function CampaignList({ campaigns, onOpen }: { campaigns: BatchCampaignView[]; onOpen: (id: string) => void }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    if (!campaigns.length) return <p className="text-sm text-muted-foreground">{t("No class-wide campaigns yet.")}</p>;
    return (
        <ul className="divide-y divide-border">
            {campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 break-words text-foreground">{c.classLabel} — {batchReasonLabel(t, c.reason)}</span>
                    <span className="text-xs text-muted-foreground">{f.dateTime(c.createdAt)}</span>
                    <span className="text-xs text-muted-foreground">{fmt(t("{done}/{total} completed"), { done: String(c.progress.completed), total: String(c.progress.total) })}</span>
                    <StatusPill tone={c.status === "completed" ? "success" : c.status === "running" ? "info" : c.status === "paused" ? "warning" : "neutral"}>{t(c.status === "running" ? "Running" : c.status === "paused" ? "Paused" : c.status === "completed" ? "Completed" : "Cancelled")}</StatusPill>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(c.id)}>{t("Open")}</Button>
                </li>
            ))}
        </ul>
    );
}

/**
 * The whole class-wide outreach flow for ONE class, inside a dialog: new campaign (setup + review +
 * confirm) or an existing campaign's live view, plus this class's campaign history.
 */
export function ClassOutreachDialog({ grade, section, label, open, onOpenChange, initialCampaignId = null }: { grade: number; section: string; label: string; open: boolean; onOpenChange: (open: boolean) => void; initialCampaignId?: string | null }) {
    const { t } = useLanguage();
    const { orgId } = useSamparkSchool();
    const [view, setView] = useState<{ kind: "new" } | { kind: "campaign"; id: string }>(initialCampaignId ? { kind: "campaign", id: initialCampaignId } : { kind: "new" });
    const overview = useSamparkQuery(open ? (signal) => getBatchOverview(orgId, { signal }) : null, [orgId, open]);
    const mine = useMemo(() => (overview.data?.campaigns ?? []).filter((c) => c.grade === grade && c.section === section), [overview.data, grade, section]);
    const allowed = overview.data?.classes.some((c) => c.grade === grade && c.section === section) ?? null;
    const active = mine.find((c) => c.status === "running" || c.status === "paused");

    // Opening with a campaign still running shows it first.
    useEffect(() => {
        if (open && active && view.kind === "new") setView({ kind: "campaign", id: active.id });
    }, [open, active?.id]);

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setView({ kind: "new" }); }}>
            <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{fmt(t("{cls} — Class-Wide Outreach"), { cls: label })}</DialogTitle>
                    <DialogDescription>{t("One action for the whole class: every eligible parent gets their own call from Riya about a general class announcement.")}</DialogDescription>
                </DialogHeader>
                {overview.error ? <ErrorPanel error={overview.error} onRetry={overview.reload} />
                    : allowed === null ? <LoadingBlock rows={3} />
                    : !allowed ? <p className="text-sm text-foreground">{t("You can only call the parents of classes you manage.")}</p>
                    : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant={view.kind === "new" ? "default" : "outline"} onClick={() => setView({ kind: "new" })}>{t("New announcement")}</Button>
                                {mine.length > 0 && <span className="self-center text-xs text-muted-foreground">{fmt(t("{n} earlier campaign(s) below"), { n: String(mine.length) })}</span>}
                            </div>
                            {view.kind === "new"
                                ? <ClassOutreachSetup cls={{ grade, section, label }} onStarted={(c) => { overview.reload(); setView({ kind: "campaign", id: c.id }); }} />
                                : <BatchCampaignPanel campaignId={view.id} />}
                            <SectionCard title={t("Class-wide campaigns for this class")}>
                                <CampaignList campaigns={mine} onOpen={(id) => setView({ kind: "campaign", id })} />
                            </SectionCard>
                        </div>
                    )}
            </DialogContent>
        </Dialog>
    );
}

/** A button that opens class-wide outreach for one class (used on class pages and the console). */
export function ClassOutreachButton({ grade, section, label, size = "sm" }: { grade: number; section: string; label: string; size?: "sm" | "default" }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button type="button" size={size} variant="outline" onClick={() => setOpen(true)}>
                <Megaphone className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("Class-Wide Outreach")}
            </Button>
            {open && <ClassOutreachDialog grade={grade} section={section} label={label} open={open} onOpenChange={setOpen} />}
        </>
    );
}

/** The console section: every class this person manages, each with its outreach button, and recent campaigns. */
export function ClassOutreachSection() {
    const { t } = useLanguage();
    const { orgId } = useSamparkSchool();
    const overview = useSamparkQuery((signal) => getBatchOverview(orgId, { signal }), [orgId]);
    const [openId, setOpenId] = useState<string | null>(null);
    const opened = overview.data?.campaigns.find((c) => c.id === openId) ?? null;
    if (overview.error) return <ErrorPanel error={overview.error} onRetry={overview.reload} />;
    if (!overview.data) return <LoadingBlock rows={3} />;
    return (
        <SectionCard icon={Megaphone} title={t("Class-Wide Outreach")} description={t("Send one general announcement to a whole class: Riya calls every eligible parent individually.")}>
            {overview.data.classes.length === 0 ? <p className="text-sm text-muted-foreground">{t("No classes with active students that you manage.")}</p> : (
                <ul className="divide-y divide-border">
                    {overview.data.classes.map((c) => (
                        <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <span className="text-foreground">{c.label} · {fmt(t("{n} students"), { n: String(c.students) })}</span>
                            <ClassOutreachButton grade={c.grade} section={c.section} label={c.label} />
                        </li>
                    ))}
                </ul>
            )}
            <CampaignList campaigns={overview.data.campaigns} onOpen={setOpenId} />
            {opened && <ClassOutreachDialog grade={opened.grade} section={opened.section} label={opened.classLabel} initialCampaignId={opened.id} open onOpenChange={(o) => { if (!o) { setOpenId(null); overview.reload(); } }} />}
        </SectionCard>
    );
}
