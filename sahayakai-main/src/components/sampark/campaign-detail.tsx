"use client";

/**
 * The pieces of a campaign's page (src/app/sampark/[orgId]/campaigns/[id]/page.tsx):
 * the five-step progress, the funnel from families to answers, the outcomes so far,
 * the families who will not be called and why, and the latest calls. Everything is
 * derived from the campaign record (status, timestamps, renderProgress, counts), its
 * dry-run audience, and the call log; a step that the records cannot show is left
 * out rather than estimated.
 */
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { useLanguage } from "@/context/language-context";
import { listCalls, type CampaignDetail } from "@/lib/api/sampark";
import { purposeSpec } from "@/lib/sampark/catalogue";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { cn } from "@/lib/utils";
import { callOutcomeClass } from "@/lib/sampark/call-outcome";
import type { BlockReason, Campaign, CampaignHoldReason } from "@/types/sampark";
import { istDate, useSamparkFormat, type SamparkFormat } from "./format";
import {
    LIVE_CAMPAIGN_STATUSES,
    blockReasonLabel,
    fmt,
    outcomeClassLabel,
    outcomeClassTone,
    type Translate,
} from "./labels";
import { OutcomeDonut, OutcomeLegend, campaignOutcome, segmentsSummary } from "./outcome-chart";
import { ErrorPanel, InlineSpinner } from "./states";
import { StatusPill } from "./status-pill";
import { useSamparkQuery } from "./use-sampark-query";

/** Statuses in which audio has passed its checks and calls may have been placed. */
const AUDIO_PASSED: readonly Campaign["status"][] = ["scheduled", "dispatching", "completed"];

function key1MeansHeard(campaign: Pick<Campaign, "purpose">): boolean {
    try {
        return purposeSpec(campaign.purpose).menu?.key1 === "heard";
    } catch {
        return false;
    }
}

// ── Stepper ──────────────────────────────────────────────────────────────────

type StepState = "done" | "current" | "failed" | "stopped" | "upcoming";

interface Step {
    title: string;
    sub: string;
    state: StepState;
}

/**
 * Created → approved → audio checked → calling → done, from the record alone. A cancelled
 * campaign shows how far it got: steps it never reached are "stopped", not "done".
 */
function campaignSteps(t: Translate, f: SamparkFormat, campaign: Campaign, hold: CampaignHoldReason | null): Step[] {
    const s = campaign.status;
    const cancelled = s === "cancelled";
    const rp = campaign.renderProgress;
    const outcome = campaignOutcome(t, campaign.purpose, campaign.counts, LIVE_CAMPAIGN_STATUSES.includes(s));
    const reachedCalls = campaign.counts.guardians > 0;
    const audioDone = AUDIO_PASSED.includes(s) || (cancelled && !!campaign.clipKeys);
    const calledLine = fmt(t("{called} of {total} families called"), { called: f.number(outcome.called), total: f.number(outcome.callable) });

    return [
        { title: t("Created"), sub: f.dateTime(campaign.createdAt), state: "done" },
        {
            title: t("Approved"),
            sub: campaign.approvedAt ? f.dateTime(campaign.approvedAt) : cancelled ? "" : t("Waiting for approval"),
            state: campaign.approvedAt ? "done" : cancelled ? "stopped" : "current",
        },
        {
            title: t("Audio checked"),
            sub: s === "render_failed" ? t("Audio check failed") : rp.total > 0 ? fmt(t("{done} of {total} clips"), { done: rp.done, total: rp.total }) : "",
            state: audioDone ? "done" : s === "rendering" ? "current" : s === "render_failed" ? "failed" : cancelled && campaign.approvedAt ? "stopped" : "upcoming",
        },
        {
            title: t("Calling"),
            sub:
                s === "dispatching"
                    ? hold ? t("On hold") : fmt(t("{count} on a call now"), { count: f.number(campaign.counts.inFlight) })
                    : s === "scheduled"
                      ? hold ? t("On hold") : t("Waiting for the calling window")
                      : reachedCalls ? calledLine : "",
            state: s === "scheduled" || s === "dispatching" ? "current" : s === "completed" ? "done" : cancelled && audioDone ? "stopped" : "upcoming",
        },
        {
            title: t("Done"),
            sub: s === "completed" ? f.dateTime(campaign.updatedAt) : cancelled ? t("Cancelled") : fmt(t("No new calls after {when}"), { when: f.dateTime(campaign.expiresAt) }),
            state: s === "completed" ? "done" : cancelled ? "stopped" : "upcoming",
        },
    ];
}

export function CampaignStepper({ campaign, hold }: { campaign: Campaign; hold: CampaignHoldReason | null }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const steps = campaignSteps(t, f, campaign, hold);
    const stateWords: Record<StepState, string> = {
        done: t("Completed"),
        current: t("In progress"),
        failed: t("Audio check failed"),
        stopped: t("Cancelled"),
        upcoming: t("Not started"),
    };

    return (
        <ol
            aria-label={t("Campaign progress")}
            className="grid divide-y divide-border overflow-hidden rounded-surface-md border border-border bg-card shadow-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x"
        >
            {steps.map((step, i) => (
                <li
                    key={step.title}
                    aria-current={step.state === "current" ? "step" : undefined}
                    className={cn("flex items-start gap-3 p-4", step.state === "current" && "bg-primary/5")}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-xs font-bold leading-normal",
                            step.state === "done" && "bg-success text-success-foreground",
                            step.state === "current" && "bg-primary text-primary-foreground",
                            step.state === "failed" && "bg-destructive text-destructive-foreground",
                            step.state === "stopped" && "bg-muted-foreground/40 text-card",
                            step.state === "upcoming" && "border border-border bg-muted text-muted-foreground",
                        )}
                    >
                        {step.state === "done" ? <Check className="h-4 w-4" /> : step.state === "failed" || step.state === "stopped" ? <X className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                        <span className="block type-body font-semibold text-foreground">{step.title}</span>
                        <span className="sr-only">{stateWords[step.state]}</span>
                        {step.sub && <span className="block text-xs leading-normal text-muted-foreground break-words">{step.sub}</span>}
                    </span>
                </li>
            ))}
        </ol>
    );
}

// ── Funnel and outcomes ──────────────────────────────────────────────────────

export function CampaignFunnel({ campaign, className }: { campaign: Campaign; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const c = campaign.counts;
    const outcome = campaignOutcome(t, campaign.purpose, c, LIVE_CAMPAIGN_STATUSES.includes(campaign.status));
    // Each step is a count the records hold. "Answered" is not one (an early hang-up is in no
    // count), so it is not drawn.
    const rows = [
        { label: t("Families in this campaign"), n: c.guardians, bar: "bg-muted-foreground/30" },
        { label: t("Can be called"), n: outcome.callable, bar: "bg-muted-foreground/50" },
        { label: t("Called so far"), n: outcome.called, bar: "bg-primary/50" },
        { label: t("Heard the key fact"), n: c.heardKeyFact, bar: "bg-primary" },
        { label: key1MeansHeard(campaign) ? t("Confirmed they heard (pressed 1)") : t("Will come (pressed 1)"), n: c.confirmedYes, bar: "bg-success" },
    ];
    const top = Math.max(1, c.guardians);

    return (
        <SectionCard
            title={t("From the class list to a confirmed answer")}
            description={t("Each step counts families, not call attempts.")}
            className={className}
        >
            <ul className="space-y-3">
                {rows.map((r) => (
                    <li key={r.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                        <span className="type-body text-muted-foreground sm:w-48 sm:shrink-0">{r.label}</span>
                        <span className="flex flex-1 items-center gap-3">
                            <span aria-hidden="true" className="h-6 flex-1 overflow-hidden rounded-surface-sm bg-muted/50">
                                <span className={cn("block h-full rounded-surface-sm", r.bar)} style={{ width: `${Math.min(100, (r.n / top) * 100)}%` }} />
                            </span>
                            <span className="w-12 shrink-0 text-right font-headline text-lg font-bold leading-normal text-foreground">{f.number(r.n)}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

export function CampaignOutcomes({ campaign, className }: { campaign: Campaign; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const outcome = campaignOutcome(t, campaign.purpose, campaign.counts, LIVE_CAMPAIGN_STATUSES.includes(campaign.status));
    const heard = campaign.counts.heardKeyFact;

    return (
        <SectionCard title={t("Outcomes so far")} className={className}>
            <div className="flex flex-wrap items-center gap-6">
                <OutcomeDonut
                    segments={outcome.segments}
                    label={segmentsSummary(outcome.segments, f.number)}
                    centre={f.percent(heard, outcome.callable)}
                    caption={t("Heard the key fact")}
                />
                <OutcomeLegend
                    segments={outcome.segments}
                    hideEmpty
                    className="flex-col gap-x-0"
                    extra={campaign.counts.optOuts > 0 ? [{ key: "optOuts", count: campaign.counts.optOuts, label: t("Asked to stop calls") }] : undefined}
                />
            </div>
            <p className="border-t border-border pt-3 type-body text-muted-foreground">
                {fmt(t("No new calls after {when}"), { when: f.dateTime(campaign.expiresAt) })}
            </p>
        </SectionCard>
    );
}

// ── Not called ───────────────────────────────────────────────────────────────

export function NotCalledSection({ detail }: { detail: CampaignDetail }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const a = detail.audience;
    const blocked = (Object.entries(a.blocked) as [BlockReason, number | undefined][])
        .filter(([, n]) => (n ?? 0) > 0)
        .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0));
    const blockedTotal = blocked.reduce((s, [, n]) => s + (n ?? 0), 0);

    return (
        <SectionCard
            title={blockedTotal > 0 ? fmt(t("{count} families will not be called, and why"), { count: f.number(blockedTotal) }) : t("Who will be called")}
            description={
                blockedTotal > 0
                    ? t("Checked against the current school records. The office can reach these families another way.")
                    : undefined
            }
            action={
                blockedTotal > 0 ? (
                    <Link
                        href={`/sampark/${encodeURIComponent(detail.campaign.orgId)}/families`}
                        className="inline-flex min-h-11 items-center gap-1 rounded-surface-sm type-body font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {t("Review families")}
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                ) : undefined
            }
        >
            <p className="type-body-lg text-foreground">
                {fmt(t("{reachable} of {total} families can be called"), {
                    reachable: f.number(Math.max(0, a.guardians - blockedTotal)),
                    total: f.number(a.guardians),
                })}
            </p>
            {blocked.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {blocked.map(([reason, n]) => (
                        <li key={reason} className="flex items-start gap-3 rounded-surface-md border border-border bg-muted/30 p-4">
                            <span className="font-headline text-2xl font-bold leading-normal text-foreground">{f.number(n ?? 0)}</span>
                            <span className="pt-1 type-body text-foreground">{blockReasonLabel(t, reason)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

// ── Latest calls ─────────────────────────────────────────────────────────────

/** How many of the campaign's calls the page lists; the Calls tab has the rest. */
const CALLS_SHOWN = 20;

export function CampaignCallsTable({ campaign, pollMs }: { campaign: Campaign; pollMs: number | null }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const query = useSamparkQuery(
        (signal) => listCalls(campaign.orgId, { campaignId: campaign.id, limit: CALLS_SHOWN }, { signal }),
        [campaign.orgId, campaign.id],
        { pollMs },
    );
    const calls = query.data;
    const today = istDate(new Date());
    const href = `/sampark/${encodeURIComponent(campaign.orgId)}/calls?campaignId=${encodeURIComponent(campaign.id)}`;

    return (
        <SectionCard
            title={t("Calls")}
            action={
                <Link
                    href={href}
                    className="inline-flex min-h-11 items-center gap-1 rounded-surface-sm type-body font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t("See calls")}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
            }
        >
            {!calls && query.loading && <InlineSpinner />}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
            {calls && calls.length === 0 && (
                <p className="rounded-surface-md border border-dashed border-border p-6 text-center type-body text-muted-foreground">{t("No calls yet")}</p>
            )}
            {calls && calls.length > 0 && (
                <div className="w-0 min-w-full overflow-x-auto rounded-surface-md border border-border">
                    {/* w-0 min-w-full: the box fills the card but adds nothing to the page's minimum width, so a
                        wide table scrolls here instead of pushing the whole console past the screen edge. */}
                    <table className="w-full min-w-max text-left type-body">
                        <caption className="sr-only">{t("Call log")}</caption>
                        <thead className="bg-muted/30">
                            <tr className="border-b border-border">
                                {[t("Time"), t("Family"), t("Student"), t("Language"), t("Attempt"), t("Result"), t("Duration")].map((h, i) => (
                                    <th key={h} scope="col" className={cn("px-3 py-2 text-xs font-medium leading-normal text-muted-foreground", i === 6 && "text-right")}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {calls.map((c) => {
                                const info = PARENT_LANGUAGE_INFO[c.language];
                                return (
                                    <tr key={c.id} className="border-b border-border align-top last:border-b-0">
                                        <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">
                                            {istDate(new Date(c.createdAt)) === today ? f.time(c.createdAt) : f.dateTime(c.createdAt)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="font-semibold text-foreground">{c.guardianDisplayName}</span>{" "}
                                            <span aria-hidden="true" className="text-muted-foreground">…{c.phoneLast4}</span>
                                            <span className="sr-only">{fmt(t("Phone ending {last4}"), { last4: c.phoneLast4 })}</span>
                                            {c.destination === "test_phone" && (
                                                <StatusPill tone="warning" className="ml-2">{t("Test phone")}</StatusPill>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-foreground">{c.studentDisplayNames.join(", ") || "—"}</td>
                                        <td className="px-3 py-3 text-foreground">
                                            <span lang={info?.code}>{info?.nativeLabel ?? c.language}</span>
                                        </td>
                                        <td className="px-3 py-3 tabular-nums text-foreground">{f.number(c.attempt)}</td>
                                        <td className="px-3 py-3">
                                            <StatusPill tone={outcomeClassTone(callOutcomeClass(c))}>{outcomeClassLabel(t, c)}</StatusPill>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground">{f.clock(c.durationSeconds)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionCard>
    );
}
