"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { LoadingBlock } from "@/components/sampark/states";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { StudentRoster } from "@/components/sampark/demo/student-roster";
import { CallParentDialog } from "@/components/sampark/demo/call-parent-dialog";
import { PageHeader, Panel } from "@/components/sampark/console-ui";
import { studentById } from "@/lib/sampark/demo/school";
import { DEMO_REASONS } from "@/lib/sampark/demo/script";
import type { DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { cn } from "@/lib/utils";

const ALL = "all";

function TeacherClasses({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const params = useSearchParams();
    const teacher = view.teacher!;
    const classes = view.school.classes.filter((c) => teacher.classIds.includes(c.id));
    const [tab, setTab] = useState<string>(ALL);
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason | null } | null>(null);
    const [blocked, setBlocked] = useState<string | null>(null);

    // Deep link (e.g. from SahayakAI Attendance): ?class=7A&student=7A-1&reason=behavioral_concern
    useEffect(() => {
        const cls = params.get("class");
        const student = studentById(params.get("student"));
        const reasonParam = params.get("reason") as OutreachReason | null;
        const reason = reasonParam && DEMO_REASONS.includes(reasonParam) ? reasonParam : null;
        if (cls) {
            if (teacher.classIds.includes(cls)) setTab(cls);
            else setBlocked(cls);
        }
        if (student) {
            if (teacher.classIds.includes(student.classId)) setCalling({ student, reason });
            else setBlocked(student.classId);
        }
    }, [params, teacher]);

    const shown = useMemo(() => (tab === ALL ? classes : classes.filter((c) => c.id === tab)), [tab, classes]);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                eyebrow={t("Workspace")}
                title={t("My classes")}
                description={fmt(t("{classes} · students who need a call come first. Tap a tag to start that call."), { classes: classes.map((c) => c.name).join(", ") })}
            />

            {blocked && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-sampark-peach-border bg-sampark-peach p-3 text-sm text-ink-800">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sampark-saffron-strong" />
                    {fmt(t("Class {id} is not one of your classes, so you cannot call its parents. Ask the principal if this family needs a call."), { id: blocked })}
                </div>
            )}

            <Panel>
                <div role="tablist" aria-label={t("Classes")} className="mb-4 flex flex-wrap gap-2">
                    {[{ id: ALL, label: t("All my classes") }, ...classes.map((c) => ({ id: c.id, label: c.name }))].map((x) => (
                        <button
                            key={x.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === x.id}
                            onClick={() => setTab(x.id)}
                            className={cn(
                                "focus-ring rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                                tab === x.id ? "border-sampark-saffron bg-sampark-peach font-medium text-sampark-saffron-strong" : "border-sampark-line bg-card text-ink-600 hover:bg-sampark-slate-soft",
                            )}
                        >
                            {x.label}
                        </button>
                    ))}
                </div>
                <StudentRoster classes={shown} students={view.school.students} calls={view.visibleCalls} showClass={tab === ALL} onCall={(student, reason) => setCalling({ student, reason })} />
            </Panel>

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

export default function DemoTeacherClassesPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <DemoRoleGate role="teacher">{(view) => <TeacherClasses view={view} />}</DemoRoleGate>
        </Suspense>
    );
}
