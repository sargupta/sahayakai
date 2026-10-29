"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Panel } from "@/components/sampark/console-ui";
import { cn } from "@/lib/utils";
import { LoadingBlock } from "@/components/sampark/states";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate, type DemoView } from "@/components/sampark/demo/use-demo";
import { StudentRoster } from "@/components/sampark/demo/student-roster";
import { CallParentDialog } from "@/components/sampark/demo/call-parent-dialog";
import type { DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";

const ALL = "all";

function Families({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const params = useSearchParams();
    const requested = params.get("class");
    const [tab, setTab] = useState(requested && view.school.classes.some((c) => c.id === requested) ? requested : ALL);
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason | null } | null>(null);
    const classes = tab === ALL ? view.school.classes : view.school.classes.filter((c) => c.id === tab);
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader eyebrow={t("Workspace")} title={t("Families")} description={t("Every student and parent in the school. As principal you can call any family; the call also shows in the class teacher's log.")} />
            <Panel>
                <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t("Classes")}>
                    {[{ id: ALL, label: t("Whole school") }, ...view.school.classes.map((c) => ({ id: c.id, label: c.name }))].map((x) => (
                        <button
                            key={x.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === x.id}
                            onClick={() => setTab(x.id)}
                            className={cn("focus-ring rounded-full border px-3.5 py-1.5 text-sm transition-colors", tab === x.id ? "border-sampark-saffron bg-sampark-peach font-medium text-sampark-saffron-strong" : "border-sampark-line bg-card text-ink-600 hover:bg-sampark-slate-soft")}
                        >
                            {x.label}
                        </button>
                    ))}
                </div>
                <StudentRoster classes={classes} students={view.school.students} calls={view.visibleCalls} showClass onCall={(student, reason) => setCalling({ student, reason })} />
            </Panel>
            <CallParentDialog
                student={calling?.student ?? null}
                initialReason={calling?.reason ?? null}
                open={Boolean(calling)}
                onOpenChange={(open) => !open && setCalling(null)}
                placedBy={{ role: "admin", name: view.school.admin.name }}
            />
        </div>
    );
}

export default function DemoAdminFamiliesPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <DemoRoleGate role="admin">{(view) => <Families view={view} />}</DemoRoleGate>
        </Suspense>
    );
}
