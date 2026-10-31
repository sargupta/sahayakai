"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarClock, ClipboardList, MessageSquareWarning, Phone, PhoneCall, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/sampark/states";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { CallbackStatusPill } from "@/components/sampark/callbacks/callback-status";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { CallParentDialog } from "@/components/sampark/demo/call-parent-dialog";
import { audienceText, campaignTitle, factsText } from "@/components/sampark/demo/campaigns";
import { isToday, whenLabel } from "@/components/sampark/demo/demo-labels";
import { AttentionRow, KpiCard, PageHeader, Panel, ProgressBar } from "@/components/sampark/console-ui";
import { studentById, studentSignals } from "@/lib/sampark/demo/school";
import { DEMO_REASONS, REASON_LABEL } from "@/lib/sampark/demo/script";
import type { DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";

function todayLine(): string {
    return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
}

function TeacherOverview({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const params = useSearchParams();
    const teacher = view.teacher!;
    const classes = view.school.classes.filter((c) => teacher.classIds.includes(c.id));
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason | null } | null>(null);
    const [blocked, setBlocked] = useState<string | null>(null);
    const fromSahayak = params.get("from") === "sahayak";

    // Deep link from SahayakAI Attendance: ?student=7A-1&reason=behavioral_concern opens that call.
    useEffect(() => {
        const student = studentById(params.get("student"));
        const reasonParam = params.get("reason") as OutreachReason | null;
        const reason = reasonParam && DEMO_REASONS.includes(reasonParam) ? reasonParam : null;
        if (student) {
            if (teacher.classIds.includes(student.classId)) setCalling({ student, reason });
            else setBlocked(student.classId);
        }
    }, [params, teacher]);

    const calls = view.visibleCalls;
    const week = calls.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86_400_000);
    const reached = week.filter((c) => c.status === "completed").length;
    const complaints = calls.filter((c) => c.complaintStatus === "open");
    const followUps = calls.filter((c) => c.summary?.followUpNeeded && !c.followUpDone && !c.complaintStatus);
    const live = view.visibleCampaigns.find((c) => c.status === "dispatching");

    const needCall = useMemo(() => {
        const called = new Set(calls.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86_400_000).map((c) => c.studentId));
        return view.school.students
            .filter((s) => teacher.classIds.includes(s.classId) && studentSignals(s).length > 0 && !called.has(s.id))
            .sort((a, b) => studentSignals(b).length - studentSignals(a).length || a.classId.localeCompare(b.classId))
            .slice(0, 6);
    }, [calls, view.school.students, teacher]);

    const callbacks = view.visibleCallbacks;
    const waiting = callbacks.filter((c) => c.status === "proposed" || c.status === "missed");
    const upcoming = callbacks.filter((c) => c.status === "scheduled").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")).slice(0, 4);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                eyebrow={todayLine()}
                title={fmt(t("Namaste, {name}"), { name: teacher.name })}
                description={fmt(t("Parent calls for {classes}. Pick a student, choose why you are calling, and the AI calls and brings back a summary."), { classes: classes.map((c) => c.name).join(", ") })}
                actions={
                    <>
                        <Button asChild variant="outline">
                            <Link href={href("/demo/teacher/calendar")}>
                                <CalendarClock aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("My calendar")}
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={href("/demo/teacher/classes")}>
                                <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("Call Parent")}
                            </Link>
                        </Button>
                    </>
                }
            />

            {fromSahayak && (
                <AttentionRow tone="notice">
                    <span className="font-medium">{t("Opened from SahayakAI Attendance.")}</span> {t("Your attendance contacts now open here, with the full call history for your classes.")}
                </AttentionRow>
            )}
            {blocked && (
                <AttentionRow tone="live">
                    <TriangleAlert aria-hidden="true" className="mr-1 inline h-4 w-4 text-sampark-saffron-strong" />
                    {fmt(t("Class {id} is not one of your classes, so you cannot call its parents."), { id: blocked })}
                </AttentionRow>
            )}

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
                            <p className="text-sm text-ink-600">{fmt(t("of {n} parents heard it"), { n: live.counts.guardians - live.counts.blocked })}</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <ProgressBar value={live.counts.heardKeyFact} max={live.counts.guardians - live.counts.blocked} label={t("Parents who heard the notice")} />
                    </div>
                    <Link href={href(`/demo/teacher/outreach/${live.id}`)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sampark-saffron-strong hover:underline">
                        {t("Open the notice")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                </Panel>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t("Calls this week")} value={week.length} icon={PhoneCall} href={href("/demo/teacher/calls")} />
                <KpiCard label={t("Parents reached")} value={reached} sub={week.length ? fmt(t("{pct}% of this week's calls"), { pct: Math.round((reached / week.length) * 100) }) : undefined} icon={Users} tone="done" />
                <KpiCard label={t("Follow-ups open")} value={followUps.length} icon={ClipboardList} tone={followUps.length ? "live" : "plain"} href={href("/demo/teacher/follow-ups")} />
                <KpiCard label={t("Complaints for you")} value={complaints.length} icon={MessageSquareWarning} tone={complaints.length ? "alert" : "done"} href={href("/demo/teacher/follow-ups")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
                <Panel className="lg:col-span-3" title={t("Students who need a call")} description={t("Not called this week, with a reason to call.")} action={<Button asChild variant="ghost" size="sm"><Link href={href("/demo/teacher/classes")}>{t("All students")}</Link></Button>}>
                    {needCall.length === 0 ? (
                        <p className="text-sm text-ink-500">{t("Every student with a reason to call has been called this week.")}</p>
                    ) : (
                        <ul className="divide-y divide-sampark-line">
                            {needCall.map((s) => {
                                const sig = studentSignals(s)[0];
                                return (
                                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-ink-900">
                                                {s.name} <span className="text-xs font-normal text-ink-500">· {fmt(t("Class {id}"), { id: s.classId })}</span>
                                            </p>
                                            <p className="text-xs text-ink-500">
                                                {t(sig.label)} · {s.guardian.name}
                                            </p>
                                        </div>
                                        <Button size="sm" variant={sig.reason === "positive_feedback" ? "outline" : "default"} onClick={() => setCalling({ student: s, reason: sig.reason })}>
                                            <Phone aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                            {t(REASON_LABEL[sig.reason])}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>

                <div className="space-y-4 lg:col-span-2">
                    <Panel title={t("Callbacks")} description={t("Booked calls back to parents.")} action={<Button asChild variant="ghost" size="sm"><Link href={href("/demo/teacher/calendar")}>{t("Calendar")}</Link></Button>}>
                        <div className="space-y-2">
                            {waiting.map((cb) => (
                                <AttentionRow key={cb.id} tone="live" href={href("/demo/teacher/calendar")} trailing={<CallbackStatusPill status={cb.status} />}>
                                    <span className="font-medium">{studentById(cb.studentId)?.guardian.name}</span> · {cb.status === "proposed" ? t("asked to be called back") : t("missed, needs a new time")}
                                </AttentionRow>
                            ))}
                            {upcoming.map((cb) => (
                                <div key={cb.id} className="flex items-center justify-between gap-2 rounded-lg bg-sampark-slate-soft px-3 py-2 text-sm">
                                    <span className="min-w-0">
                                        <span className="font-medium text-ink-900">{studentById(cb.studentId)?.guardian.name}</span>
                                        <span className="block text-xs text-ink-500">{t(REASON_LABEL[cb.reason])}</span>
                                    </span>
                                    <span className={isToday(cb.scheduledAt ?? "") ? "font-medium text-sampark-saffron-strong" : "text-ink-600"}>{whenLabel(cb.scheduledAt ?? "")}</span>
                                </div>
                            ))}
                            {waiting.length + upcoming.length === 0 && <p className="text-sm text-ink-500">{t("No callbacks booked.")}</p>}
                        </div>
                    </Panel>

                    <Panel tone={complaints.length ? "alert" : "plain"} title={t("Parent feedback about your class")} description={t("Complaints are recorded as the parent said them, and reviewed with the principal.")}>
                        {complaints.length === 0 ? (
                            <p className="text-sm text-ink-500">{t("No open complaints.")}</p>
                        ) : (
                            <div className="space-y-2">
                                {complaints.slice(0, 3).map((c) => (
                                    <AttentionRow key={c.id} tone="plain" href={href("/demo/teacher/follow-ups")}>
                                        <span className="font-medium">{studentById(c.studentId)?.name}:</span> <span className="line-clamp-2">{c.summary?.complaintAboutTeacher}</span>
                                    </AttentionRow>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>
            </div>

            <CallParentDialog
                student={calling?.student ?? null}
                initialReason={calling?.reason ?? null}
                open={Boolean(calling)}
                onOpenChange={(open) => !open && setCalling(null)}
                placedBy={{ role: "teacher", name: teacher.name }}
            />
        </div>
    );
}

export default function DemoTeacherPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <DemoRoleGate role="teacher">{(view) => <TeacherOverview view={view} />}</DemoRoleGate>
        </Suspense>
    );
}
