"use client";

/**
 * Principal cards for Today, carried over from the SamparkAI demo school's
 * principal monitor (src/app/sampark/demo/admin/page.tsx) onto real data.
 *
 *   WhyTeachersCalledCard — the school's teacher Contact calls this week, by
 *                           reason (GET teacher-calls; reason only, no names).
 *   CallbacksTodayCard    — callbacks booked for today, plus requests waiting
 *                           for a person (GET callbacks for today's IST day).
 *
 * Read-only: neither card starts, moves or confirms anything. Links go to the
 * calendar and the calls screen, where those actions already live.
 *
 *   TeachersThisWeekCard  — parent calls per teacher in the last 7 days, and how
 *                           many reached the parent (teacher names: school
 *                           admins only, founder decision 21 Nov 2026).
 *
 * Deliberately NOT carried over yet (see "Sampark: what to build next"):
 *   - Upset parents / open complaints / needs your attention: no complaint
 *     record exists in Sampark yet.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import { listCallbacks, type CallbackView } from "@/lib/api/sampark-callbacks";
import type { TeacherCallEntry, TeacherCallReason } from "@/types/sampark";
import { teacherReasonLabel } from "./call-source";
import { CallbackStatusPill } from "./callbacks/callback-status";
import { istDate, istToday, useSamparkFormat } from "./format";
import { ErrorPanel } from "./states";
import { useSamparkQuery } from "./use-sampark-query";

const WEEK_MS = 7 * 86_400_000;

/** Fixed order, so the bars do not jump as counts change. "other" shows only when present. */
const REASON_ORDER: readonly TeacherCallReason[] = ["consecutive_absences", "poor_performance", "behavioral_concern", "positive_feedback"];

export interface ReasonCount {
    reason: TeacherCallReason;
    count: number;
}

/** Teacher calls placed in the 7 days up to `nowMs`, counted by reason. */
export function teacherReasonsThisWeek(calls: readonly TeacherCallEntry[], nowMs: number): ReasonCount[] {
    const counts = new Map<TeacherCallReason, number>();
    for (const c of calls) {
        const at = Date.parse(c.createdAt);
        if (Number.isNaN(at) || at > nowMs || nowMs - at >= WEEK_MS) continue;
        counts.set(c.reason, (counts.get(c.reason) ?? 0) + 1);
    }
    const rows: ReasonCount[] = REASON_ORDER.map((reason) => ({ reason, count: counts.get(reason) ?? 0 }));
    const other = counts.get("other") ?? 0;
    if (other > 0) rows.push({ reason: "other", count: other });
    return rows;
}

export interface TeacherWeekRow {
    teacherUid: string;
    teacherName: string | null;
    calls: number;
    reached: number;
}

/** Teacher calls in the 7 days up to `nowMs`, per teacher: most calls first, then by name. */
export function teachersThisWeek(calls: readonly TeacherCallEntry[], nowMs: number): TeacherWeekRow[] {
    const rows = new Map<string, TeacherWeekRow>();
    for (const c of calls) {
        const at = Date.parse(c.createdAt);
        if (!c.teacherUid || Number.isNaN(at) || at > nowMs || nowMs - at >= WEEK_MS) continue;
        const row = rows.get(c.teacherUid) ?? { teacherUid: c.teacherUid, teacherName: null, calls: 0, reached: 0 };
        row.calls += 1;
        if (c.outcome === "completed") row.reached += 1;
        // Calls arrive newest first, so the first name seen is the teacher's latest.
        row.teacherName = row.teacherName ?? c.teacherName;
        rows.set(c.teacherUid, row);
    }
    return [...rows.values()].sort(
        (a, b) => b.calls - a.calls || (a.teacherName ?? "\uffff").localeCompare(b.teacherName ?? "\uffff") || a.teacherUid.localeCompare(b.teacherUid),
    );
}

/** IST midnight of `day` (YYYY-MM-DD) as an instant. */
export function istDayStart(day: string): Date {
    return new Date(`${day}T00:00:00+05:30`);
}

/**
 * What the principal needs today: callbacks scheduled for today (IST) that are
 * still to happen or just missed, and every proposal waiting for a person.
 * Proposals first, then by time.
 */
export function callbacksForToday(callbacks: readonly CallbackView[], proposed: readonly CallbackView[], today: string): CallbackView[] {
    const seen = new Set<string>();
    const out: CallbackView[] = [];
    for (const cb of [...proposed, ...callbacks]) {
        if (seen.has(cb.id)) continue;
        const dueToday = cb.scheduledAt !== null && istDate(new Date(cb.scheduledAt)) === today;
        const keep = cb.status === "proposed" || (dueToday && (cb.status === "scheduled" || cb.status === "running" || cb.status === "missed"));
        if (!keep) continue;
        seen.add(cb.id);
        out.push(cb);
    }
    const rank = (cb: CallbackView) => (cb.status === "proposed" ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.id.localeCompare(b.id));
}

/** A 404 from a Sampark route means the feature is not switched on for this deployment or school. */
export function isSwitchedOff(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404;
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1 rounded-surface-sm type-body font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {children}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
    );
}

/** A card's body while its data is missing: the error with a retry, or a placeholder while it
 *  loads. Never "No calls yet", which would read as "nobody called" (review of #214). */ // design-token-allow: "#214" is a PR reference in a comment, not a color
function NotLoaded({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
    if (error) return <ErrorPanel error={error} onRetry={onRetry} />;
    return (
        <div aria-busy="true" className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
        </div>
    );
}

export function WhyTeachersCalledCard({
    teacherCalls,
    error,
    onRetry,
    base,
    nowMs,
    className,
}: {
    /** The school's teacher calls, newest first (any window; this card keeps the last 7 days). */
    teacherCalls: readonly TeacherCallEntry[] | undefined;
    error?: Error | null;
    onRetry?: () => void;
    base: string;
    nowMs: number;
    className?: string;
}) {
    const { t } = useLanguage();
    const rows = teacherReasonsThisWeek(teacherCalls ?? [], nowMs);
    const total = rows.reduce((n, r) => n + r.count, 0);
    const max = Math.max(1, ...rows.map((r) => r.count));

    return (
        <SectionCard
            title={t("Why teachers called")}
            description={t("This week, by reason.")}
            className={className}
            action={<CardLink href={`${base}/calls`}>{t("See calls")}</CardLink>}
        >
            {!teacherCalls ? (
                <NotLoaded error={error} onRetry={onRetry} />
            ) : total === 0 ? (
                <p className="rounded-surface-md border border-dashed border-border p-6 text-center type-body text-muted-foreground">{t("No calls yet")}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map((r) => {
                        const label = teacherReasonLabel(t, r.reason);
                        return (
                            <li key={r.reason} className="space-y-1">
                                <div className="flex justify-between gap-3 type-body">
                                    <span className="text-foreground">{label}</span>
                                    <span className="font-semibold tabular-nums text-foreground">{r.count}</span>
                                </div>
                                <Progress value={Math.round((r.count / max) * 100)} aria-label={label} className="h-2 bg-muted" />
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

export function CallbacksTodayCard({ orgId, base, className }: { orgId: string; base: string; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const today = istToday();
    const query = useSamparkQuery(
        (signal) => {
            const from = istDayStart(today);
            const to = new Date(from.getTime() + 86_400_000);
            return listCallbacks(orgId, from, to, { signal });
        },
        [orgId, today],
        { pollMs: 60_000 },
    );
    const rows = query.data ? callbacksForToday(query.data.callbacks, query.data.proposed, today) : [];
    // Callbacks ride on Riya calls; a deployment without them answers 404. Show nothing, not an error.
    if (isSwitchedOff(query.error)) return null;

    return (
        <SectionCard
            title={t("Callbacks today")}
            description={t("Booked for today, and requests waiting for a time.")}
            className={className}
            action={<CardLink href={`${base}/calendar`}>{t("Calendar")}</CardLink>}
        >
            {!query.data ? (
                <NotLoaded error={query.error} onRetry={query.reload} />
            ) : rows.length === 0 ? (
                <p className="rounded-surface-md border border-dashed border-border p-6 text-center type-body text-muted-foreground">{t("No callbacks today.")}</p>
            ) : (
                <ul>
                    {rows.slice(0, 5).map((cb) => (
                        <li key={cb.id} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
                            <div className="min-w-0">
                                <p className="type-body font-semibold text-foreground break-words">
                                    {cb.guardianDisplayName ?? cb.studentDisplayName ?? "—"}
                                    {cb.guardianPhoneLast4 && <span className="font-normal text-muted-foreground"> · …{cb.guardianPhoneLast4}</span>}
                                </p>
                                <p className="text-xs leading-normal text-muted-foreground">{cb.scheduledAt ? f.time(cb.scheduledAt) : t("No time yet")}</p>
                            </div>
                            <CallbackStatusPill status={cb.status} />
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function TeachersThisWeekCard({
    teacherCalls,
    error,
    onRetry,
    base,
    nowMs,
    className,
}: {
    teacherCalls: readonly TeacherCallEntry[] | undefined;
    error?: Error | null;
    onRetry?: () => void;
    base: string;
    nowMs: number;
    className?: string;
}) {
    const { t } = useLanguage();
    const rows = teachersThisWeek(teacherCalls ?? [], nowMs);

    return (
        <SectionCard
            title={t("Teachers this week")}
            description={t("Parent calls per teacher, and what came back.")}
            className={className}
            action={<CardLink href={`${base}/calls`}>{t("See calls")}</CardLink>}
        >
            {!teacherCalls ? (
                <NotLoaded error={error} onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <p className="rounded-surface-md border border-dashed border-border p-6 text-center type-body text-muted-foreground">{t("No calls yet")}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] type-body">
                        <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                                <th scope="col" className="py-2 font-medium">{t("Teacher")}</th>
                                <th scope="col" className="py-2 text-right font-medium">{t("Calls")}</th>
                                <th scope="col" className="py-2 text-right font-medium">{t("Reached")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.teacherUid} className="border-t border-border">
                                    <td className="py-2 font-semibold text-foreground break-words">{r.teacherName ?? t("Teacher")}</td>
                                    <td className="py-2 text-right tabular-nums text-foreground">{r.calls}</td>
                                    <td className="py-2 text-right tabular-nums text-foreground">{r.reached}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionCard>
    );
}
