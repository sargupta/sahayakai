"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
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
    const [tab, setTab] = useState(ALL);
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason | null } | null>(null);
    const classes = tab === ALL ? view.school.classes : view.school.classes.filter((c) => c.id === tab);
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-1">
                <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">{t("Families")}</h1>
                <p className="text-ink-600">{t("Every student and parent in the school. As principal you can call any family; the call also shows in the class teacher's log.")}</p>
            </header>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Classes")}>
                {[{ id: ALL, label: t("Whole school") }, ...view.school.classes.map((c) => ({ id: c.id, label: c.name }))].map((x) => (
                    <Button key={x.id} role="tab" aria-selected={tab === x.id} size="sm" variant={tab === x.id ? "default" : "outline"} className="rounded-pill" onClick={() => setTab(x.id)}>
                        {x.label}
                    </Button>
                ))}
            </div>
            <StudentRoster classes={classes} students={view.school.students} calls={view.visibleCalls} showClass onCall={(student, reason) => setCalling({ student, reason })} />
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
