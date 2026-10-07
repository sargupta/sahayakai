"use client";

/**
 * The cards of the Today screen (src/app/sampark/[orgId]/page.tsx), each drawn from
 * one SamparkOverview. Two rules hold on every card:
 *
 * - Families' numbers (`today`, `familyTrend`, the KPI tiles) are real calls only.
 * - The charts and the feed (`hours`, `todayByLanguage`, `recent`, `trend`) show the
 *   calls of the school's current mode, and say so in their titles ("Test calls by
 *   hour"), so a rehearsal is never presented as a family reached (H9).
 */
import { type ReactNode } from "react";
import Link from "next/link";
import {
    ArrowRight,
    CalendarDays,
    ChevronRight,
    Clock,
    Database,
    FlaskConical,
    Languages,
    Megaphone,
    PhoneForwarded,
    Plus,
    Users,
} from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/context/language-context";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { EMERGENCY_END_HOUR, EMERGENCY_START_HOUR, effectiveRoutineWindow } from "@/lib/sampark/policy/window";
import { cn } from "@/lib/utils";
import { PARENT_LANGUAGES, type ParentLanguage, type SamparkMode, type SamparkOverview, type TrendDay, type UpcomingItem } from "@/types/sampark";
import { useCampaignSummary } from "./campaign-summary";
import { hourLabel, istHour, useSamparkFormat } from "./format";
import { KpiTile } from "./kpi-tile";
import {
    LIVE_CAMPAIGN_STATUSES,
    campaignStatusLabel,
    effectiveHoldReason,
    fmt,
    holdReasonText,
    languageName,
    outcomeClassLabel,
    outcomeClassTone,
    purposeLabel,
    type Translate,
} from "./labels";
import { OutcomeBar, OutcomeLegend, campaignOutcome, segmentsSummary } from "./outcome-chart";
import { useSamparkSchool } from "./school-context";
import { CampaignStatusBadge, ImportStatusBadge, StatusPill } from "./status-pill";

/**
 * Render a translated template with one placeholder drawn large (the hero number),
 * wherever the language puts it. `{name}` must survive fmt() untouched.
 */
function Emphasised({ template, name, value, className }: { template: string; name: string; value: string; className: string }) {
    const at = template.indexOf(`{${name}}`);
    // A translation that dropped the placeholder still shows the number, first.
    if (at < 0) return <><span className={className}>{value}</span> {template}</>;
    return (
        <>
            {template.slice(0, at)}
            <span className={className}>{value}</span>
            {template.slice(at + name.length + 2)}
        </>
    );
}

// ── Next steps ───────────────────────────────────────────────────────────────

export interface NextStep {
    key: "connect" | "import" | "import-failed" | "consent" | "language";
    text: string;
    href: string;
    action: string;
}

/** What the school should do next, from the overview. Records steps go on the records card, family steps on the families card. */
export function nextSteps(t: Translate, o: SamparkOverview, base: string): NextStep[] {
    const steps: NextStep[] = [];
    if (!o.school.crm) {
        steps.push({ key: "connect", text: t("Connect your school records so Sampark knows your classes and families."), href: `${base}/settings`, action: t("Connect records") });
    } else if (!o.lastImport) {
        steps.push({ key: "import", text: t("Import your school data. Nothing can be sent until families are imported."), href: `${base}/settings`, action: t("Import now") });
    } else if (o.lastImport.status === "failed") {
        steps.push({ key: "import-failed", text: t("The last import failed. Check the rejected rows and import again."), href: `${base}/settings`, action: t("See import") });
    }
    const noConsent = o.guardians.total - o.guardians.withNoticesConsent;
    if (o.guardians.total > 0 && noConsent > 0) {
        steps.push({
            key: "consent",
            text: fmt(t("{count} families have no consent recorded for recorded notices. They will not be called."), { count: noConsent }),
            href: `${base}/families`,
            action: t("Review families"),
        });
    }
    const unknownLang = o.guardians.byLanguage.unknown ?? 0;
    if (unknownLang > 0) {
        steps.push({
            key: "language",
            text: fmt(t("{count} families have no language recorded."), { count: unknownLang }),
            href: `${base}/families?language=unknown`,
            action: t("Record languages"),
        });
    }
    return steps;
}

// ── Hero: the campaign calling now ───────────────────────────────────────────

export function LiveCampaignCard({ overview, base, className }: { overview: SamparkOverview; base: string; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { school } = useSamparkSchool();
    const summary = useCampaignSummary();
    const c = overview.liveCampaign;

    if (!c) {
        return (
            <section
                aria-label={t("Campaigns")}
                className={cn("flex flex-col gap-4 rounded-surface-md border border-dashed border-primary/30 bg-primary/5 p-4 md:p-6", className)}
            >
                <Megaphone aria-hidden="true" className="h-6 w-6 text-primary" />
                <p className="type-body-lg text-foreground">
                    {t("No campaign is running. Invite families to a PTM or an event, or send an emergency closure.")}
                </p>
                <Button asChild className="min-h-11 self-start">
                    <Link href={`${base}/campaigns/new`}>
                        <Plus aria-hidden="true" />
                        {t("New campaign")}
                    </Link>
                </Button>
            </section>
        );
    }

    const hold = effectiveHoldReason(c, school.pause);
    const stillCalling = LIVE_CAMPAIGN_STATUSES.includes(c.status);
    const outcome = campaignOutcome(t, c.purpose, c.counts, stillCalling);
    const href = `${base}/campaigns/${encodeURIComponent(c.id)}`;
    const rp = c.renderProgress;

    return (
        <section aria-labelledby="sampark-live-campaign" className={cn("space-y-4 rounded-surface-md border border-primary/20 bg-primary/5 p-4 md:p-6", className)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <CampaignStatusBadge status={c.status} />
                    {hold && <StatusPill tone="warning">{t("On hold")}</StatusPill>}
                    <span className="text-xs leading-normal text-muted-foreground">
                        {fmt(t("No new calls after {when}"), { when: f.dateTime(c.expiresAt) })}
                    </span>
                </div>
                <Link
                    href={href}
                    className="inline-flex min-h-11 items-center gap-2 rounded-surface-sm type-body font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t("Open campaign")}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <h2 id="sampark-live-campaign" className="type-h2 text-foreground break-words">
                        {purposeLabel(t, c.purpose)} · {summary.audience(c.audience)}
                    </h2>
                    <p className="type-body text-foreground">{summary.facts(c.facts, school)}</p>
                </div>
                {c.counts.guardians > 0 && (
                    <p className="type-body text-foreground">
                        <Emphasised
                            template={fmt(t("{called} of {total} families called"), { total: f.number(outcome.callable) })}
                            name="called"
                            value={f.number(outcome.called)}
                            className="font-headline text-4xl font-bold leading-normal text-foreground"
                        />
                    </p>
                )}
            </div>

            {hold && (
                <p role="status" className="rounded-surface-md border border-warning/40 bg-warning/10 p-3 type-body text-foreground">
                    {holdReasonText(t, hold, { mode: c.mode ?? undefined })}
                </p>
            )}

            {c.counts.guardians > 0 ? (
                <div className="space-y-3">
                    <OutcomeBar segments={outcome.segments} label={segmentsSummary(outcome.segments, f.number)} />
                    <OutcomeLegend
                        segments={outcome.segments}
                        hideEmpty
                        extra={c.counts.optOuts > 0 ? [{ key: "optOuts", count: c.counts.optOuts, label: t("Asked to stop calls") }] : undefined}
                    />
                </div>
            ) : c.status === "rendering" ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 type-body">
                        <span className="font-medium text-foreground">{t("Preparing audio")}</span>
                        <span className="text-muted-foreground">{fmt(t("{done} of {total} clips"), { done: rp.done, total: rp.total })}</span>
                    </div>
                    <Progress value={rp.total > 0 ? (rp.done / rp.total) * 100 : 0} aria-label={t("Audio progress")} className="h-2 bg-card" />
                </div>
            ) : (
                <p className="type-body text-muted-foreground">{t("Waiting for the calling window")}</p>
            )}
        </section>
    );
}

// ── Calling window ───────────────────────────────────────────────────────────

export function CallingWindowCard({ overview, now, className }: { overview: SamparkOverview; now: Date; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const w = overview.school.callingWindow;
    const band = effectiveRoutineWindow(w);
    const today = overview.windowToday;
    const opens = today ? new Date(today.opensAt).getTime() : 0;
    const closes = today ? new Date(today.closesAt).getTime() : 0;
    const t0 = now.getTime();
    const state: "open" | "before" | "after" | "closed_day" = !today ? "closed_day" : t0 < opens ? "before" : t0 >= closes ? "after" : "open";
    const nextHoliday = overview.upcoming.find((u): u is Extract<UpcomingItem, { kind: "holidays" }> => u.kind === "holidays");

    let headline: ReactNode;
    if (state === "open") {
        const left = Math.max(0, closes - t0);
        const time = fmt(t("{hours} h {minutes} min"), { hours: Math.floor(left / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) });
        headline = (
            <Emphasised template={t("{time} left today")} name="time" value={time} className="font-headline text-3xl font-bold leading-normal text-foreground" />
        );
    } else if (state === "before") {
        headline = fmt(t("Next opens {when}"), { when: f.time(today!.opensAt) });
    } else {
        headline = overview.nextWindowOpensAt ? fmt(t("Next opens {when}"), { when: f.dateTime(overview.nextWindowOpensAt) }) : t("Closed now");
    }
    const progress = state === "open" ? ((t0 - opens) / (closes - opens)) * 100 : state === "after" ? 100 : 0;

    return (
        <SectionCard
            title={t("Calling window")}
            icon={Clock}
            className={className}
            action={state === "open" ? <StatusPill tone="success">{t("Open now")}</StatusPill> : <StatusPill tone="neutral">{t("Closed now")}</StatusPill>}
        >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-3">
                    <p className={cn("text-foreground", state === "open" ? "type-body text-muted-foreground" : "type-h3")}>{headline}</p>
                    {state === "closed_day" && <p className="type-body text-muted-foreground">{t("No routine calls today")}</p>}
                    {today && (
                        <div className="space-y-1">
                            <Progress value={progress} aria-label={t("Calling window")} className="h-2 bg-muted" />
                            <div className="flex justify-between gap-2 text-xs leading-normal text-muted-foreground">
                                <span>{hourLabel(band.startHour)}</span>
                                {state === "open" && <span className="font-semibold text-foreground">{fmt(t("now {time}"), { time: f.time(now.toISOString()) })}</span>}
                                <span>{hourLabel(band.endHour)}</span>
                            </div>
                        </div>
                    )}
                </div>
                <dl className="space-y-3 type-body">
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                        <dt className="shrink-0 text-muted-foreground sm:w-28">{t("Routine calls")}</dt>
                        <dd className="text-foreground">
                            {fmt(t("{start} to {end} IST"), { start: hourLabel(band.startHour), end: hourLabel(band.endHour) })}
                            {w.offDays.length > 0 && (
                                <span className="block text-muted-foreground">
                                    {fmt(t("No routine calls on {days}"), { days: w.offDays.map((d) => f.weekday(d)).join(", ") })}
                                </span>
                            )}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                        <dt className="shrink-0 text-muted-foreground sm:w-28">{t("Emergency closure")}</dt>
                        <dd className="text-foreground">
                            {fmt(t("{start} to {end} IST"), { start: hourLabel(EMERGENCY_START_HOUR), end: hourLabel(EMERGENCY_END_HOUR) })}
                            <span className="block text-muted-foreground">{t("Any day, including holidays")}</span>
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                        <dt className="shrink-0 text-muted-foreground sm:w-28">{t("School holidays")}</dt>
                        <dd className="text-foreground">
                            {nextHoliday
                                ? nextHoliday.days > 1
                                    ? fmt(t("{from} to {to}"), { from: f.shortDay(nextHoliday.from), to: f.shortDay(nextHoliday.to) })
                                    : f.day(nextHoliday.from)
                                : t("Nothing coming up")}
                        </dd>
                    </div>
                </dl>
            </div>
        </SectionCard>
    );
}

// ── KPI tiles: real calls to families only ───────────────────────────────────

export function TodayKpis({ overview }: { overview: SamparkOverview }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const o = overview;
    const days = o.familyTrend;
    const series = (pick: (d: TrendDay) => number) => days.map((d) => (d.complete ? pick(d) : null));
    const trend = (pick: (d: TrendDay) => number) => {
        const values = series(pick);
        return { values, label: fmt(t("Last 7 days: {values}"), { values: values.map((v) => (v === null ? "—" : f.number(v))).join(", ") }) };
    };
    const week = (pick: (d: TrendDay) => number) => days.filter((d) => d.complete).reduce((s, d) => s + pick(d), 0);

    return (
        // Real calls to families only (H9): rehearsals are counted apart and never as families reached.
        <section aria-label={t("Calls to families today")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
                label={t("Calls to families today")}
                value={f.number(o.today.calls)}
                sub={fmt(t("{count} in the last 7 days"), { count: f.number(week((d) => d.calls)) })}
                trend={trend((d) => d.calls)}
            />
            <KpiTile
                label={t("Heard the key fact")}
                value={o.today.calls > 0 ? f.percent(o.today.heardKeyFact, o.today.calls) : "—"}
                sub={
                    o.today.calls > 0
                        ? fmt(t("{count} of {total} calls"), { count: f.number(o.today.heardKeyFact), total: f.number(o.today.calls) })
                        : t("No calls yet")
                }
                emphasis="success"
                trend={trend((d) => d.heard)}
            />
            <KpiTile
                label={t("Confirmed (pressed 1)")}
                value={f.number(o.today.confirmedYes)}
                sub={fmt(t("{count} in the last 7 days"), { count: f.number(week((d) => d.confirmed)) })}
                emphasis="success"
                trend={trend((d) => d.confirmed)}
            />
            <KpiTile
                label={t("Asked to stop calls")}
                value={f.number(o.today.optOuts)}
                sub={fmt(t("{count} families have stopped calls in all"), { count: f.number(o.guardians.askedToStop) })}
                emphasis={o.today.optOuts > 0 ? "warning" : "default"}
                trend={trend((d) => d.optOuts)}
            />
        </section>
    );
}

// ── Activity: the current mode's calls ──────────────────────────────────────

function activityTitles(t: Translate, mode: SamparkMode) {
    switch (mode) {
        case "test": return { hours: t("Test calls by hour"), feed: t("Latest test calls"), pill: t("Test calls") };
        case "practice": return { hours: t("Practice calls by hour"), feed: t("Latest practice calls"), pill: t("Practice calls") };
        default: return { hours: t("Calls to families by hour"), feed: t("Latest calls to families"), pill: null };
    }
}

/** Shown above the charts in Test and Practice: what they count, and that it is not families. */
export function RehearsalActivityNote({ mode }: { mode: SamparkMode }) {
    const { t } = useLanguage();
    if (mode === "live") return null;
    const Icon = mode === "test" ? PhoneForwarded : FlaskConical;
    return (
        <p className="flex items-start gap-3 rounded-surface-md border border-info/30 bg-info/10 p-3 type-body text-foreground">
            <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-info" />
            <span className="min-w-0">
                <span className="block font-semibold">{mode === "test" ? t("Test: rang only your test phone") : t("Practice: simulated, no phone rang")}</span>
                <span className="block">{t("Rehearsal calls never reach a family, so they are not counted as families reached.")}</span>
            </span>
        </p>
    );
}

/** Bar height of the busiest hour, in px. */
const HOUR_BAR_MAX = 140;

export function HoursCard({ overview, now, className }: { overview: SamparkOverview; now: Date; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const titles = activityTitles(t, overview.activityMode);
    const hours = overview.hours;
    const max = Math.max(1, ...hours.map((h) => h.calls));
    const total = hours.reduce((s, h) => s + h.calls, 0);
    const current = istHour(now);
    const columns = { gridTemplateColumns: `repeat(${Math.max(1, hours.length)}, minmax(0, 1fr))` };
    const spoken = `${titles.hours}: ${hours
        .filter((h) => h.calls > 0)
        .map((h) => fmt(t("{hour}: {calls} calls, {heard} heard"), { hour: hourLabel(h.hour), calls: h.calls, heard: h.heard }))
        .join("; ") || t("No calls yet")}`;

    return (
        <SectionCard title={titles.hours} description={t("Each hour of the calling window, in IST")} className={className}>
            <ul className="flex flex-wrap gap-4 text-xs leading-normal text-muted-foreground">
                <li className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-3 rounded-surface-sm bg-primary" />
                    {t("Heard the key fact")}
                </li>
                <li className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-3 rounded-surface-sm bg-muted-foreground/30" />
                    {t("Did not hear it")}
                </li>
            </ul>
            <div className="relative">
                <div role="img" aria-label={spoken} className="grid items-end gap-2 border-b border-border" style={{ ...columns, height: HOUR_BAR_MAX + 32 }}>
                    {hours.map((h) => (
                        <div key={h.hour} className="flex h-full flex-col items-center justify-end gap-1">
                            {h.calls > 0 && <span className="text-xs font-semibold leading-normal text-foreground">{f.number(h.calls)}</span>}
                            {h.calls > 0 ? (
                                <div
                                    className="flex w-full max-w-11 flex-col justify-end overflow-hidden rounded-t-surface-sm"
                                    style={{ height: Math.max(4, Math.round((h.calls / max) * HOUR_BAR_MAX)) }}
                                >
                                    <span className="bg-muted-foreground/30" style={{ height: `${((h.calls - h.heard) / h.calls) * 100}%` }} />
                                    <span className="bg-primary" style={{ height: `${(h.heard / h.calls) * 100}%` }} />
                                </div>
                            ) : (
                                <div className="w-full max-w-11 rounded-t-surface-sm bg-muted" style={{ height: 4 }} />
                            )}
                        </div>
                    ))}
                </div>
                {total === 0 && (
                    <p className="absolute inset-x-0 top-1/3 text-center type-body text-muted-foreground">{t("No calls yet")}</p>
                )}
            </div>
            <div aria-hidden="true" className="grid gap-2" style={columns}>
                {hours.map((h) => (
                    <span
                        key={h.hour}
                        className={cn("truncate text-center text-xs leading-normal", h.hour === current ? "font-bold text-foreground" : "text-muted-foreground")}
                    >
                        <span className="sm:hidden">{h.hour}</span>
                        <span className="hidden sm:inline">{hourLabel(h.hour)}</span>
                    </span>
                ))}
            </div>
        </SectionCard>
    );
}

const LANGUAGE_BAR: Record<ParentLanguage, string> = {
    Nepali: "bg-chart-1",
    Bengali: "bg-chart-2",
    Hindi: "bg-chart-3",
    English: "bg-info",
};

export function LanguagesCard({ overview, className }: { overview: SamparkOverview; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const titles = activityTitles(t, overview.activityMode);
    const rows = PARENT_LANGUAGES.map((language) => ({ language, ...overview.todayByLanguage[language] })).sort((a, b) => b.calls - a.calls);
    const max = Math.max(1, ...rows.map((r) => r.calls));
    const g = overview.guardians;
    const top = PARENT_LANGUAGES.reduce<ParentLanguage | null>((best, l) => (best === null || (g.byLanguage[l] ?? 0) > (g.byLanguage[best] ?? 0) ? l : best), null);

    return (
        <SectionCard
            title={t("By language")}
            icon={Languages}
            description={t("Calls today, and how many heard the key fact")}
            action={titles.pill ? <StatusPill tone="info">{titles.pill}</StatusPill> : undefined}
            className={cn("flex flex-col", className)}
        >
            <ul className="flex-1 space-y-4">
                {rows.map((r) => {
                    const info = PARENT_LANGUAGE_INFO[r.language];
                    return (
                        <li key={r.language} className="space-y-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="flex items-baseline gap-2">
                                    <span lang={info.code} className="type-body-lg font-semibold text-foreground">{info.nativeLabel}</span>
                                    <span className="text-xs leading-normal text-muted-foreground">{languageName(t, r.language)}</span>
                                </span>
                                <span className="type-body text-muted-foreground">
                                    {fmt(t("{calls} calls · {heard} heard"), { calls: f.number(r.calls), heard: f.number(r.heard) })}
                                </span>
                            </div>
                            <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-muted">
                                <div className={cn("h-full rounded-pill", LANGUAGE_BAR[r.language])} style={{ width: `${(r.calls / max) * 100}%` }} />
                            </div>
                        </li>
                    );
                })}
            </ul>
            {top && g.total > 0 && (g.byLanguage[top] ?? 0) > 0 && (
                <p className="border-t border-border pt-3 text-xs leading-normal text-muted-foreground">
                    {fmt(t("{percent} of families are called in {language}"), { percent: f.percent(g.byLanguage[top] ?? 0, g.total), language: languageName(t, top) })}
                </p>
            )}
        </SectionCard>
    );
}

export function ActivityFeed({ overview, base, className }: { overview: SamparkOverview; base: string; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const titles = activityTitles(t, overview.activityMode);

    return (
        <SectionCard
            title={titles.feed}
            description={t("Refreshes every 30 seconds")}
            className={className}
            action={
                <Link
                    href={`${base}/calls`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-surface-sm type-body font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t("See calls")}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
            }
        >
            {overview.recent.length === 0 ? (
                <p className="rounded-surface-md border border-dashed border-border p-6 text-center type-body text-muted-foreground">{t("No calls yet")}</p>
            ) : (
                <ul>
                    {overview.recent.map((r) => {
                        const info = PARENT_LANGUAGE_INFO[r.language];
                        return (
                            <li key={r.id} className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
                                <time dateTime={r.createdAt} className="w-12 shrink-0 text-xs tabular-nums leading-normal text-muted-foreground">
                                    {f.time(r.createdAt)}
                                </time>
                                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="type-body font-semibold text-foreground break-words">
                                            {r.guardianDisplayName}{" "}
                                            <span aria-hidden="true" className="font-normal text-muted-foreground">· …{r.phoneLast4}</span>
                                            <span className="sr-only">{fmt(t("Phone ending {last4}"), { last4: r.phoneLast4 })}</span>
                                        </p>
                                        <p className="text-xs leading-normal text-muted-foreground">
                                            {purposeLabel(t, r.purpose)} · <span lang={info?.code}>{info?.nativeLabel ?? r.language}</span>
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                                        <StatusPill tone={outcomeClassTone(r.outcomeClass)}>{outcomeClassLabel(t, r)}</StatusPill>
                                        {r.retryAt && (
                                            <span className="text-xs leading-normal text-muted-foreground">
                                                {fmt(t("Calling again at {time}"), { time: f.time(r.retryAt) })}
                                            </span>
                                        )}
                                        {r.destination === "test_phone" && <StatusPill tone="warning">{t("Test phone")}</StatusPill>}
                                        {r.carrier === "simulated" && <StatusPill tone="info">{t("Simulated")}</StatusPill>}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

// ── Families ─────────────────────────────────────────────────────────────────

export function FamiliesCard({ overview, steps, className }: { overview: SamparkOverview; steps: NextStep[]; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const g = overview.guardians;
    const consentPct = g.total > 0 ? Math.round((g.withNoticesConsent / g.total) * 100) : 0;
    const known = g.total - (g.byLanguage.unknown ?? 0);
    const attention = steps.filter((s) => s.key === "consent" || s.key === "language");
    const stats: { label: string; value: string }[] = [
        { label: t("Families"), value: f.number(g.total) },
        { label: t("Language known"), value: g.total > 0 ? f.percent(known, g.total) : "—" },
        { label: t("Asked to stop calls"), value: f.number(g.askedToStop) },
        { label: t("Numbers to fix"), value: f.number(overview.numbersFlagged) },
    ];

    return (
        <SectionCard title={t("Families")} icon={Users} className={className}>
            <div className="flex items-center gap-4">
                <div
                    role="img"
                    aria-label={`${t("Consent for recorded notices")}: ${f.percent(g.withNoticesConsent, g.total)}`}
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-pill"
                    style={{ background: `conic-gradient(hsl(var(--success)) 0% ${consentPct}%, hsl(var(--muted)) ${consentPct}% 100%)` }}
                >
                    <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-card font-headline text-lg font-bold leading-normal text-foreground">
                        {f.percent(g.withNoticesConsent, g.total)}
                    </span>
                </div>
                <div className="min-w-0">
                    <p className="type-body font-semibold text-foreground">{t("Consent for recorded notices")}</p>
                    <p className="type-body text-muted-foreground">
                        {fmt(t("{count} of {total} families"), { count: f.number(g.withNoticesConsent), total: f.number(g.total) })}
                    </p>
                </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
                {stats.map((s) => (
                    <div key={s.label} className="rounded-surface-md bg-muted/50 p-3">
                        <dt className="text-xs leading-normal text-muted-foreground">{s.label}</dt>
                        <dd className="font-headline text-xl font-semibold leading-normal text-foreground">{s.value}</dd>
                    </div>
                ))}
            </dl>
            {attention.length > 0 && (
                <div className="space-y-2">
                    <p className="type-caption text-muted-foreground">{t("Needs attention")}</p>
                    <ul className="space-y-2">
                        {attention.map((s) => (
                            <li key={s.key}>
                                <Link
                                    href={s.href}
                                    className={cn(
                                        "flex min-h-11 items-center justify-between gap-3 rounded-surface-md border p-3 type-body text-foreground",
                                        "transition-colors duration-micro ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        s.key === "consent" ? "border-warning/40 bg-warning/10 hover:bg-warning/20" : "border-border hover:bg-muted",
                                    )}
                                >
                                    <span>{s.text}</span>
                                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="sr-only">{s.action}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </SectionCard>
    );
}

// ── Rehearsals, coming up, school records ────────────────────────────────────

export function RehearsalsCard({ overview, className }: { overview: SamparkOverview; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const r = overview.rehearsal;
    // The 7-day trend follows the current mode; in Test or Practice it belongs on that tile.
    const trendFor = (mode: SamparkMode) =>
        overview.activityMode === mode
            ? {
                  values: overview.trend.map((d) => (d.complete ? d.calls : null)),
                  label: fmt(t("Last 7 days: {values}"), { values: overview.trend.map((d) => (d.complete ? f.number(d.calls) : "—")).join(", ") }),
              }
            : undefined;
    return (
        <SectionCard
            title={t("Rehearsals today")}
            icon={FlaskConical}
            description={t("Rehearsal calls never reach a family, so they are not counted as families reached.")}
            className={className}
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KpiTile
                    label={t("Practice: simulated, no phone rang")}
                    value={f.number(r.practice.calls)}
                    emphasis="info"
                    trend={trendFor("practice")}
                    className="border-dashed shadow-none"
                />
                <KpiTile
                    label={t("Test: rang only your test phone")}
                    value={f.number(r.test.calls)}
                    emphasis="info"
                    trend={trendFor("test")}
                    className="border-dashed shadow-none"
                />
            </div>
        </SectionCard>
    );
}

export function ComingUpCard({ overview, base, className }: { overview: SamparkOverview; base: string; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { school } = useSamparkSchool();
    const summary = useCampaignSummary();

    return (
        <SectionCard title={t("Coming up")} icon={CalendarDays} className={className}>
            {overview.upcoming.length === 0 ? (
                <p className="type-body text-muted-foreground">{t("Nothing coming up")}</p>
            ) : (
                <ul className="space-y-3">
                    {overview.upcoming.map((u) => {
                        const date = u.kind === "holidays" ? u.from : u.date;
                        const chip = (
                            <span aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center rounded-surface-md border border-border py-1">
                                <span className="text-xs font-semibold uppercase leading-normal text-primary">{f.month(date)}</span>
                                <span className="font-headline text-lg font-bold leading-normal text-foreground">{Number(date.slice(8, 10))}</span>
                            </span>
                        );
                        if (u.kind === "holidays") {
                            return (
                                <li key={`h-${u.from}`} className="flex items-center gap-3">
                                    {chip}
                                    <span className="min-w-0">
                                        <span className="block type-body font-semibold text-foreground">{u.days > 1 ? t("School holidays") : t("School holiday")}</span>
                                        <span className="block text-xs leading-normal text-muted-foreground">
                                            {u.days > 1 ? fmt(t("{from} to {to}"), { from: f.shortDay(u.from), to: f.shortDay(u.to) }) : f.day(u.from)} · {t("No routine calls")}
                                        </span>
                                    </span>
                                </li>
                            );
                        }
                        return (
                            <li key={`c-${u.campaignId}`}>
                                <Link
                                    href={`${base}/campaigns/${encodeURIComponent(u.campaignId)}`}
                                    className="flex min-h-11 items-center gap-3 rounded-surface-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {chip}
                                    <span className="min-w-0">
                                        <span className="block type-body font-semibold text-foreground">{purposeLabel(t, u.purpose)}</span>
                                        <span className="block text-xs leading-normal text-muted-foreground break-words">
                                            {summary.facts(u.facts, school)} · {campaignStatusLabel(t, u.status)}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

export function RecordsCard({ overview, steps, base, className }: { overview: SamparkOverview; steps: NextStep[]; base: string; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const imp = overview.lastImport;
    const step = steps.find((s) => s.key === "connect" || s.key === "import" || s.key === "import-failed");

    return (
        <SectionCard
            title={t("School records")}
            icon={Database}
            className={className}
            action={imp ? <ImportStatusBadge status={imp.status} /> : undefined}
        >
            {imp?.finishedAt && (
                <p className="type-body text-muted-foreground">{fmt(t("School records synced {when}"), { when: f.dateTime(imp.finishedAt) })}</p>
            )}
            {imp && (
                <dl className="grid grid-cols-3 gap-3">
                    <div>
                        <dt className="text-xs leading-normal text-muted-foreground">{t("Students")}</dt>
                        <dd className="font-headline text-lg font-semibold leading-normal text-foreground">{f.number(imp.counts.students)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs leading-normal text-muted-foreground">{t("Guardians")}</dt>
                        <dd className="font-headline text-lg font-semibold leading-normal text-foreground">{f.number(imp.counts.guardians)}</dd>
                    </div>
                    <div>
                        <dt className="text-xs leading-normal text-muted-foreground">{t("Rows rejected")}</dt>
                        <dd className="font-headline text-lg font-semibold leading-normal text-foreground">{f.number(imp.counts.rejected)}</dd>
                    </div>
                </dl>
            )}
            {step && <p className="type-body text-foreground">{step.text}</p>}
            <Button asChild variant="outline" className="min-h-11 self-start">
                <Link href={step?.href ?? `${base}/settings`}>{step?.action ?? t("See import")}</Link>
            </Button>
        </SectionCard>
    );
}
