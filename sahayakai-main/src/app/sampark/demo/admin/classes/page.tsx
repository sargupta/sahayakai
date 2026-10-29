"use client";

import Link from "next/link";
import { Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { MiniStat, PageHeader, Panel, ProgressBar } from "@/components/sampark/console-ui";
import { studentSignals, teacherById } from "@/lib/sampark/demo/school";

const WEEK = 7 * 86_400_000;

function ClassesAndTeachers({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const now = Date.now();
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                eyebrow={t("Workspace")}
                title={t("Classes & teachers")}
                description={t("Every class, its class teacher, and how its parent calls are going this week.")}
            />
            <div className="grid gap-4 md:grid-cols-2">
                {view.school.classes.map((cls) => {
                    const teacher = teacherById(cls.teacherId);
                    const students = view.school.students.filter((s) => s.classId === cls.id);
                    const needCall = students.filter((s) => studentSignals(s).some((x) => x.reason !== "positive_feedback")).length;
                    const calls = view.visibleCalls.filter((c) => c.classId === cls.id && now - new Date(c.createdAt).getTime() < WEEK);
                    const reached = calls.filter((c) => c.status === "completed").length;
                    const complaints = view.visibleCalls.filter((c) => c.classId === cls.id && c.complaintStatus === "open").length;
                    const attendance = Math.round(students.reduce((a, s) => a + s.attendancePct, 0) / Math.max(1, students.length));
                    return (
                        <Panel
                            key={cls.id}
                            title={cls.name}
                            description={`${teacher?.name ?? ""} · ${t(cls.subject)}`}
                            action={complaints > 0 ? <StatusPill tone="danger">{fmt(t("{n} complaint(s)"), { n: complaints })}</StatusPill> : undefined}
                        >
                            <div className="grid grid-cols-3 gap-2">
                                <MiniStat label={t("Students")} value={students.length} sub={fmt(t("{pct}% attendance"), { pct: attendance })} />
                                <MiniStat label={t("Need a call")} value={needCall} />
                                <MiniStat label={t("Calls this week")} value={calls.length} sub={fmt(t("{n} reached"), { n: reached })} />
                            </div>
                            <div className="mt-3">
                                <ProgressBar value={reached} max={Math.max(calls.length, 1)} tone="done" label={t("Parents reached this week")} />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button asChild size="sm">
                                    <Link href={href(`/demo/admin/families?class=${cls.id}`)}>
                                        <Phone aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        {t("Call a family")}
                                    </Link>
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                    <Link href={href(`/demo/admin/calls?teacher=${cls.teacherId}`)}>
                                        <Users aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        {fmt(t("{name}'s calls"), { name: teacher?.name.split(" ")[0] ?? "" })}
                                    </Link>
                                </Button>
                            </div>
                        </Panel>
                    );
                })}
            </div>
        </div>
    );
}

export default function DemoAdminClassesPage() {
    return <DemoRoleGate role="admin">{(view) => <ClassesAndTeachers view={view} />}</DemoRoleGate>;
}
