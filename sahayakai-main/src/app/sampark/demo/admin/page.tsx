"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Frown, MessageSquareWarning, Phone, PhoneCall } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { KpiTile } from "@/components/sampark/kpi-tile";
import { LoadingBlock } from "@/components/sampark/states";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { Button } from "@/components/ui/button";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { CallDetailSheet } from "@/components/sampark/demo/call-list";
import { COMPLAINT_LABEL, COMPLAINT_TONE, SENTIMENT_LABEL, SENTIMENT_TONE, isToday, needsAttention, whenLabel } from "@/components/sampark/demo/demo-labels";
import { studentById, teacherById } from "@/lib/sampark/demo/school";
import { DEMO_REASONS, REASON_LABEL } from "@/lib/sampark/demo/script";
import type { DemoCall } from "@/lib/sampark/demo/types";

const WEEK = 7 * 86_400_000;

function attentionRank(c: DemoCall): number {
    if (c.complaintStatus === "open") return 0;
    if (c.summary?.parentSentiment === "upset") return 1;
    return 2;
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
                .filter((c) => needsAttention(c) && c.complaintStatus !== "resolved")
                .sort((a, b) => attentionRank(a) - attentionRank(b) || b.createdAt.localeCompare(a.createdAt))
                .slice(0, 6),
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
        };
    }, [calls, now, view.school.teachers]);

    const maxReason = Math.max(1, ...stats.byReason.map((r) => r.count));
    const open = calls.find((c) => c.id === openId) ?? null;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t("School monitor")}</p>
                    <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">{fmt(t("Namaste, {name}"), { name: view.school.admin.name })}</h1>
                    <p className="text-ink-600">{t("What every teacher's parent calls are bringing back, and what needs you today.")}</p>
                </div>
                <Button asChild>
                    <Link href={href("/demo/admin/families")}>
                        <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                        {t("Call a family")}
                    </Link>
                </Button>
            </header>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiTile label={t("Calls today")} value={stats.today} sub={fmt(t("{n} reached"), { n: stats.todayReached })} icon={PhoneCall} />
                <KpiTile label={t("Reached this week")} value={`${stats.reachedPct}%`} sub={fmt(t("of {n} calls"), { n: stats.week })} icon={Phone} emphasis="success" />
                <KpiTile label={t("Upset parents this week")} value={stats.upset} icon={Frown} emphasis="warning" />
                <KpiTile label={t("Open complaints")} value={stats.complaints} icon={MessageSquareWarning} emphasis={stats.complaints > 0 ? "warning" : "success"} />
            </div>

            <SectionCard
                title={t("Needs your attention")}
                description={t("Complaints about teachers first, then upset parents and promised follow-ups.")}
                icon={MessageSquareWarning}
                action={
                    <Button asChild variant="ghost" size="sm">
                        <Link href={href("/demo/admin/calls?filter=attention")}>
                            {t("See all")} <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
                        </Link>
                    </Button>
                }
            >
                {stats.attention.length === 0 ? (
                    <p className="text-sm text-ink-600">{t("Nothing waiting. Every parent concern has been handled.")}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {stats.attention.map((c) => {
                            const student = studentById(c.studentId);
                            const teacher = teacherById(c.teacherId);
                            return (
                                <li key={c.id}>
                                    <button type="button" onClick={() => setOpenId(c.id)} className="focus-ring flex w-full flex-col gap-1 py-3 text-left hover:bg-milk-300 sm:px-2">
                                        <span className="flex flex-wrap items-center gap-2">
                                            {c.complaintStatus && <StatusPill tone={COMPLAINT_TONE[c.complaintStatus]}>{t(COMPLAINT_LABEL[c.complaintStatus])}</StatusPill>}
                                            {c.summary && <StatusPill tone={SENTIMENT_TONE[c.summary.parentSentiment]}>{t(SENTIMENT_LABEL[c.summary.parentSentiment])}</StatusPill>}
                                            <span className="font-medium text-ink-900">{student?.name}</span>
                                            <span className="text-xs text-ink-500">
                                                {fmt(t("Class {id}"), { id: c.classId })} · {teacher?.name} · {whenLabel(c.createdAt)}
                                            </span>
                                        </span>
                                        <span className="line-clamp-2 text-sm text-ink-700">{c.summary?.complaintAboutTeacher ?? c.summary?.followUpSuggestion ?? c.summary?.parentResponse}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-5">
                <SectionCard title={t("Teachers this week")} description={t("Parent calls per teacher, and what came back.")} className="lg:col-span-3">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[460px] text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                                    <th className="py-2 font-medium">{t("Teacher")}</th>
                                    <th className="py-2 font-medium">{t("Calls")}</th>
                                    <th className="py-2 font-medium">{t("Reached")}</th>
                                    <th className="py-2 font-medium">{t("Upset")}</th>
                                    <th className="py-2 font-medium">{t("Complaints")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {stats.byTeacher.map((row) => (
                                    <tr key={row.teacher.id}>
                                        <td className="py-2">
                                            <span className="block font-medium text-ink-900">{row.teacher.name}</span>
                                            <span className="text-xs text-ink-500">
                                                {t(row.teacher.subject)} · {row.teacher.classIds.join(", ")}
                                            </span>
                                        </td>
                                        <td className="py-2">{row.calls}</td>
                                        <td className="py-2">{row.reached}</td>
                                        <td className="py-2">{row.upset > 0 ? <StatusPill tone="warning">{row.upset}</StatusPill> : 0}</td>
                                        <td className="py-2">{row.complaints > 0 ? <StatusPill tone="danger">{row.complaints}</StatusPill> : 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>

                <SectionCard title={t("Why schools called")} description={t("This week, by reason.")} className="lg:col-span-2">
                    <ul className="space-y-3">
                        {stats.byReason.map((r) => (
                            <li key={r.reason} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-ink-800">{t(REASON_LABEL[r.reason])}</span>
                                    <span className="text-ink-500">{r.count}</span>
                                </div>
                                <div className="h-2 rounded-pill bg-milk-300">
                                    <div className="h-2 rounded-pill bg-primary" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            </div>

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
