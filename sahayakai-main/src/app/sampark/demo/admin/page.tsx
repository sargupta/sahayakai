"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Frown, Megaphone, MessageSquareWarning, Phone, PhoneCall, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/sampark/states";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { CallbackStatusPill } from "@/components/sampark/callbacks/callback-status";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { CallDetailSheet } from "@/components/sampark/demo/call-list";
import { audienceText, campaignTitle, factsText } from "@/components/sampark/demo/campaigns";
import { COMPLAINT_LABEL, COMPLAINT_TONE, SENTIMENT_LABEL, SENTIMENT_TONE, STATUS_LABEL, STATUS_TONE, isToday, needsAttention, whenLabel } from "@/components/sampark/demo/demo-labels";
import { AttentionRow, KpiCard, PageHeader, Panel, ProgressBar } from "@/components/sampark/console-ui";
import { studentById, teacherById } from "@/lib/sampark/demo/school";
import { DEMO_REASONS, REASON_LABEL } from "@/lib/sampark/demo/script";
import type { DemoCall } from "@/lib/sampark/demo/types";

const WEEK = 7 * 86_400_000;

function attentionRank(c: DemoCall): number {
    if (c.complaintStatus === "open") return 0;
    if (c.summary?.parentSentiment === "upset") return 1;
    return 2;
}

function todayLine(): string {
    return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
}

function Monitor({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const [openId, setOpenId] = useState<string | null>(null);
    const calls = view.visibleCalls;
    const now = Date.now();

    const stats = useMemo(() => {
        const week = calls.filter((c) => now - new Date(c.createdAt).getTime() < WEEK);
        const today = calls.filter((c) => isToday(c.createdAt));
        return {
            today: today.length,
            todayReached: today.filter((c) => c.status === "completed").length,
            week: week.length,
            reachedPct: week.length ? Math.round((week.filter((c) => c.status === "completed").length / week.length) * 100) : 0,
            upset: week.filter((c) => c.summary?.parentSentiment === "upset").length,
            complaints: calls.filter((c) => c.complaintStatus === "open").length,
            attention: calls
                .filter((c) => needsAttention(c) && c.complaintStatus !== "resolved" && !(c.followUpDone && !c.complaintStatus))
                .sort((a, b) => attentionRank(a) - attentionRank(b) || b.createdAt.localeCompare(a.createdAt))
                .slice(0, 5),
            byReason: DEMO_REASONS.map((r) => ({ reason: r, count: week.filter((c) => c.reason === r).length })),
            byTeacher: view.school.teachers.map((tc) => {
                const mine = week.filter((c) => c.teacherId === tc.id);
                return {
                    teacher: tc,
                    calls: mine.length,
                    reached: mine.filter((c) => c.status === "completed").length,
                    upset: mine.filter((c) => c.summary?.parentSentiment === "upset").length,
                    complaints: calls.filter((c) => c.teacherId === tc.id && c.complaintStatus === "open").length,
                };
            }),
            recent: [...calls].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
        };
    }, [calls, now, view.school.teachers]);

    const live = view.visibleCampaigns.find((c) => c.status === "dispatching");
    const callbacksToday = view.visibleCallbacks
        .filter((c) => (c.status === "scheduled" && c.scheduledAt && isToday(c.scheduledAt)) || c.status === "proposed" || c.status === "missed")
        .sort((a, b) => (a.scheduledAt ?? "0").localeCompare(b.scheduledAt ?? "0"));
    const maxReason = Math.max(1, ...stats.byReason.map((r) => r.count));
    const open = calls.find((c) => c.id === openId) ?? null;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                eyebrow={todayLine()}
                title={t("Today")}
                description={fmt(t("Every parent call at {school}, by every teacher, and what needs you."), { school: view.school.name })}
                actions={
                    <>
                        <Button asChild variant="outline">
                            <Link href={href("/demo/admin/campaigns")}>
                                <Megaphone aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("Campaigns")}
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={href("/demo/admin/families")}>
                                <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("Call a family")}
                            </Link>
                        </Button>
                    </>
                }
            />

            {live && (
                <Panel tone="live">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <StatusPill tone="warning">{t("Calling now")}</StatusPill>
                            <p className="font-display text-xl font-semibold text-ink-900">
                                {campaignTitle(t, live)} · {audienceText(t, live)}
                            </p>
                            <p className="text-sm text-ink-600">{factsText(t, live)}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-display text-4xl font-semibold leading-none text-ink-900">{live.counts.heardKeyFact}</p>
                            <p className="text-sm text-ink-600">{fmt(t("of {n} families heard it"), { n: live.counts.guardians - live.counts.blocked })}</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <ProgressBar value={live.counts.heardKeyFact} max={live.counts.guardians - live.counts.blocked} label={t("Families who heard the notice")} />
                    </div>
                    <Link href={href(`/demo/admin/campaigns/${live.id}`)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sampark-saffron-strong hover:underline">
                        {t("Open campaign")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                </Panel>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t("Calls today")} value={stats.today} sub={fmt(t("{n} reached"), { n: stats.todayReached })} icon={PhoneCall} href={href("/demo/admin/calls")} />
                <KpiCard label={t("Reached this week")} value={`${stats.reachedPct}%`} sub={fmt(t("of {n} calls"), { n: stats.week })} icon={Users} tone="done" />
                <KpiCard label={t("Upset parents this week")} value={stats.upset} icon={Frown} tone={stats.upset ? "live" : "plain"} href={href("/demo/admin/calls?filter=upset")} />
                <KpiCard label={t("Open complaints")} value={stats.complaints} icon={MessageSquareWarning} tone={stats.complaints > 0 ? "alert" : "done"} href={href("/demo/admin/follow-ups")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
                <Panel
                    className="lg:col-span-3"
                    tone="plain"
                    icon={MessageSquareWarning}
                    title={t("Needs your attention")}
                    description={t("Complaints about teachers first, then upset parents and promised follow-ups.")}
                    action={
                        <Button asChild variant="ghost" size="sm">
                            <Link href={href("/demo/admin/follow-ups")}>
                                {t("See all")} <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
                            </Link>
                        </Button>
                    }
                >
                    {stats.attention.length === 0 ? (
                        <p className="text-sm text-ink-500">{t("Nothing waiting. Every parent concern has been handled.")}</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.attention.map((c) => {
                                const student = studentById(c.studentId);
                                const teacher = teacherById(c.teacherId);
                                return (
                                    <AttentionRow key={c.id} tone={c.complaintStatus === "open" ? "alert" : c.summary?.parentSentiment === "upset" ? "live" : "plain"} onClick={() => setOpenId(c.id)}>
                                        <span className="flex flex-wrap items-center gap-2">
                                            {c.complaintStatus && <StatusPill tone={COMPLAINT_TONE[c.complaintStatus]}>{t(COMPLAINT_LABEL[c.complaintStatus])}</StatusPill>}
                                            {c.summary && !c.complaintStatus && <StatusPill tone={SENTIMENT_TONE[c.summary.parentSentiment]}>{t(SENTIMENT_LABEL[c.summary.parentSentiment])}</StatusPill>}
                                            <span className="font-medium text-ink-900">{student?.name}</span>
                                            <span className="text-xs text-ink-500">
                                                {fmt(t("Class {id}"), { id: c.classId })} · {teacher?.name} · {whenLabel(c.createdAt)}
                                            </span>
                                        </span>
                                        <span className="mt-1 line-clamp-2 block text-ink-700">{c.summary?.complaintAboutTeacher ?? c.summary?.followUpSuggestion ?? c.summary?.parentResponse}</span>
                                    </AttentionRow>
                                );
                            })}
                        </div>
                    )}
                </Panel>

                <Panel
                    className="lg:col-span-2"
                    icon={CalendarClock}
                    title={t("Callbacks today")}
                    description={t("Booked for today, and requests waiting for a time.")}
                    action={
                        <Button asChild variant="ghost" size="sm">
                            <Link href={href("/demo/admin/calendar")}>{t("Calendar")}</Link>
                        </Button>
                    }
                >
                    {callbacksToday.length === 0 ? (
                        <p className="text-sm text-ink-500">{t("No callbacks today.")}</p>
                    ) : (
                        <ul className="space-y-2">
                            {callbacksToday.slice(0, 5).map((cb) => (
                                <li key={cb.id}>
                                    <AttentionRow tone={cb.status === "scheduled" ? "plain" : "live"} href={href("/demo/admin/calendar")} trailing={<CallbackStatusPill status={cb.status} />}>
                                        <span className="font-medium text-ink-900">{studentById(cb.studentId)?.guardian.name}</span>
                                        <span className="block text-xs text-ink-500">
                                            {cb.scheduledAt ? whenLabel(cb.scheduledAt) : t("No time yet")} · {t(REASON_LABEL[cb.reason])}
                                        </span>
                                    </AttentionRow>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
                <Panel
                    className="lg:col-span-3"
                    title={t("Teachers this week")}
                    description={t("Parent calls per teacher, and what came back.")}
                    action={
                        <Button asChild variant="ghost" size="sm">
                            <Link href={href("/demo/admin/classes")}>{t("Classes")}</Link>
                        </Button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[460px] text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                                    <th className="py-2 font-medium">{t("Teacher")}</th>
                                    <th className="py-2 font-medium">{t("Calls")}</th>
                                    <th className="py-2 font-medium">{t("Reached")}</th>
                                    <th className="py-2 font-medium">{t("Upset")}</th>
                                    <th className="py-2 font-medium">{t("Complaints")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sampark-line">
                                {stats.byTeacher.map((row) => (
                                    <tr key={row.teacher.id}>
                                        <td className="py-2.5">
                                            <Link href={href(`/demo/admin/calls?teacher=${row.teacher.id}`)} className="font-medium text-ink-900 hover:underline">
                                                {row.teacher.name}
                                            </Link>
                                            <span className="block text-xs text-ink-500">
                                                {t(row.teacher.subject)} · {row.teacher.classIds.join(", ")}
                                            </span>
                                        </td>
                                        <td className="py-2.5">{row.calls}</td>
                                        <td className="py-2.5">{row.reached}</td>
                                        <td className="py-2.5">{row.upset > 0 ? <StatusPill tone="warning">{row.upset}</StatusPill> : 0}</td>
                                        <td className="py-2.5">{row.complaints > 0 ? <StatusPill tone="danger">{row.complaints}</StatusPill> : 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel className="lg:col-span-2" title={t("Why teachers called")} description={t("This week, by reason.")}>
                    <ul className="space-y-3">
                        {stats.byReason.map((r) => (
                            <li key={r.reason} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-ink-800">{t(REASON_LABEL[r.reason])}</span>
                                    <span className="font-medium text-ink-900">{r.count}</span>
                                </div>
                                <ProgressBar value={r.count} max={maxReason} tone={r.reason === "positive_feedback" ? "done" : r.reason === "behavioral_concern" ? "alert" : "live"} label={t(REASON_LABEL[r.reason])} />
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Panel
                title={t("Live activity")}
                description={t("The latest calls across the school.")}
                action={
                    <Button asChild variant="ghost" size="sm">
                        <Link href={href("/demo/admin/calls")}>{t("All calls")}</Link>
                    </Button>
                }
            >
                <ul className="divide-y divide-sampark-line">
                    {stats.recent.map((c) => {
                        const student = studentById(c.studentId);
                        return (
                            <li key={c.id}>
                                <button type="button" onClick={() => setOpenId(c.id)} className="focus-ring flex w-full flex-wrap items-center gap-3 rounded-md py-2.5 text-left hover:bg-sampark-slate-soft sm:px-2">
                                    <span className="w-28 shrink-0 text-xs text-ink-500">{whenLabel(c.createdAt)}</span>
                                    <span className="min-w-0 flex-1 text-sm">
                                        <span className="font-medium text-ink-900">{student?.guardian.name}</span>
                                        <span className="text-ink-500"> · …{student?.guardian.phoneLast4} · {t(REASON_LABEL[c.reason])}</span>
                                    </span>
                                    <StatusPill tone={STATUS_TONE[c.status]}>{t(STATUS_LABEL[c.status])}</StatusPill>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Panel>

            <CallDetailSheet call={open} viewerRole="admin" onClose={() => setOpenId(null)} />
        </div>
    );
}

export default function DemoAdminPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <DemoRoleGate role="admin">{(view) => <Monitor view={view} />}</DemoRoleGate>
        </Suspense>
    );
}
