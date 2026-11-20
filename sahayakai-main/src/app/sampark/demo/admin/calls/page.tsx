"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/sampark/states";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { SargvisionCallLog } from "@/components/sampark/demo/sargvision-call-log";
import { SARGVISION_CLASS_ID } from "@/lib/sampark/sargvision";
import { CallList, type CallFilter } from "@/components/sampark/demo/call-list";
import { PageHeader } from "@/components/sampark/console-ui";

const FILTERS: CallFilter[] = ["all", "attention", "complaints", "upset", "unreached"];

function AdminCalls() {
    const { t } = useLanguage();
    const params = useSearchParams();
    const requested = params.get("filter") as CallFilter | null;
    const initial = requested && FILTERS.includes(requested) ? requested : "all";
    return (
        <DemoRoleGate role="admin">
            {(view) => (
                <div className="mx-auto max-w-5xl space-y-6">
                    <PageHeader eyebrow={t("Outreach")} title={t("All calls")} description={t("Every parent call in the school, by any teacher or by you. Filter by teacher or reason, and open a call to review it.")} />
                    {view.school.classes.some((c) => c.id === SARGVISION_CLASS_ID) && <SargvisionCallLog />}
                    <CallList calls={view.visibleCalls} viewerRole="admin" teachers={view.school.teachers} initialFilter={initial} initialTeacher={params.get("teacher")} />
                </div>
            )}
        </DemoRoleGate>
    );
}

export default function DemoAdminCallsPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <AdminCalls />
        </Suspense>
    );
}
