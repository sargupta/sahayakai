"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageSquareWarning, Phone, PhoneCall, Smile, TriangleAlert } from "lucide-react";
import { KpiTile } from "@/components/sampark/kpi-tile";
import { LoadingBlock } from "@/components/sampark/states";
import { fmt } from "@/components/sampark/labels";
import { Button } from "@/components/ui/button";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { StudentRoster } from "@/components/sampark/demo/student-roster";
import { CallParentDialog } from "@/components/sampark/demo/call-parent-dialog";
import { needsAttention } from "@/components/sampark/demo/demo-labels";
import { studentById } from "@/lib/sampark/demo/school";
import { DEMO_REASONS } from "@/lib/sampark/demo/script";
import type { DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { cn } from "@/lib/utils";

const ALL = "all";

function TeacherHome({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const params = useSearchParams();
    const teacher = view.teacher!;
    const classes = view.school.classes.filter((c) => teacher.classIds.includes(c.id));
    const [tab, setTab] = useState<string>(ALL);
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason | null } | null>(null);
    const [blocked, setBlocked] = useState<string | null>(null);

    // Deep link from SahayakAI Attendance: ?class=7A&student=7A-1&reason=behavioral_concern
    useEffect(() => {
        const cls = params.get("class");
        const studentId = params.get("student");
        const reasonParam = params.get("reason") as OutreachReason | null;
        const reason = reasonParam && DEMO_REASONS.includes(reasonParam) ? reasonParam : null;
        if (cls) {
            if (teacher.classIds.includes(cls)) setTab(cls);
            else setBlocked(cls);
        }
        const student = studentById(studentId);
        if (student) {
            if (teacher.classIds.includes(student.classId)) setCalling({ student, reason });
            else setBlocked(student.classId);
        }
    }, [params, teacher]);

    const mine = view.visibleCalls;
    const week = mine.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86_400_000);
    const reached = week.filter((c) => c.status === "completed").length;
    const attention = mine.filter(needsAttention).length;
    const complaints = mine.filter((c) => c.complaintStatus === "open").length;
    const shown = useMemo(() => (tab === ALL ? classes : classes.filter((c) => c.id === tab)), [tab, classes]);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t("Parent calls")}</p>
                <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">{fmt(t("Namaste, {name}"), { name: teacher.name })}</h1>
                <p className="text-ink-600">
                    {fmt(t("Your classes: {classes}. Call a parent about absences, studies, behaviour or good news; the AI makes the call and brings back a summary."), {
                        classes: classes.map((c) => c.name).join(", "),
                    })}
                </p>
            </header>

            {blocked && (
                <div role="alert" className="flex items-start gap-2 rounded-surface-md border border-warning/50 bg-warning/10 p-3 text-sm text-ink-800">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    {fmt(t("Class {id} is not one of your classes, so you cannot call its parents. Ask the principal if this family needs a call."), { id: blocked })}
                </div>
            )}

            {complaints > 0 && (
                <Link
                    href={href("/demo/teacher/calls?filter=complaints")}
                    className="focus-ring flex items-center gap-3 rounded-surface-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-ink-800 hover:bg-destructive/10"
                >
                    <MessageSquareWarning aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive" />
                    {fmt(t("{count} parent complaint(s) about your class are waiting for you. Open them"), { count: complaints })} →
                </Link>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiTile label={t("Calls this week")} value={week.length} icon={PhoneCall} />
                <KpiTile label={t("Parents reached")} value={reached} icon={Phone} emphasis="success" />
                <KpiTile label={t("Need follow-up")} value={attention} icon={TriangleAlert} emphasis="warning" />
                <KpiTile label={t("Complaints for you")} value={complaints} icon={complaints > 0 ? MessageSquareWarning : Smile} emphasis={complaints > 0 ? "warning" : "success"} />
            </div>

            <div className="space-y-3">
                <div role="tablist" aria-label={t("Classes")} className="flex flex-wrap gap-2">
                    {[{ id: ALL, label: t("All my classes") }, ...classes.map((c) => ({ id: c.id, label: c.name }))].map((x) => (
                        <Button
                            key={x.id}
                            role="tab"
                            aria-selected={tab === x.id}
                            size="sm"
                            variant={tab === x.id ? "default" : "outline"}
                            onClick={() => setTab(x.id)}
                            className={cn("rounded-pill")}
                        >
                            {x.label}
                        </Button>
                    ))}
                </div>
                <StudentRoster
                    classes={shown}
                    students={view.school.students}
                    calls={mine}
                    showClass={tab === ALL}
                    onCall={(student, reason) => setCalling({ student, reason })}
                />
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
            <DemoRoleGate role="teacher">{(view) => <TeacherHome view={view} />}</DemoRoleGate>
        </Suspense>
    );
}
