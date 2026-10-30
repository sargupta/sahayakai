"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/sampark/states";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CallList, type CallFilter } from "@/components/sampark/demo/call-list";
import { PageHeader } from "@/components/sampark/console-ui";
import { SargvisionCallLog } from "@/components/sampark/demo/sargvision-call-log";
import { SARGVISION_CLASS_ID } from "@/lib/sampark/sargvision";

const FILTERS: CallFilter[] = ["all", "attention", "complaints", "upset", "unreached"];

function TeacherCalls() {
    const { t } = useLanguage();
    const params = useSearchParams();
    const requested = params.get("filter") as CallFilter | null;
    const initial = requested && FILTERS.includes(requested) ? requested : "all";
    return (
        <DemoRoleGate role="teacher">
            {(view) => (
                <div className="mx-auto max-w-5xl space-y-6">
                    <PageHeader eyebrow={t("Outreach")} title={t("My calls")} description={t("Every call to a parent in your classes, including calls the principal placed. Open a call for the summary, the transcript and any complaint the parent raised.")} />
                    {view.teacher?.classIds.includes(SARGVISION_CLASS_ID) && <SargvisionCallLog />}
                    <CallList calls={view.visibleCalls} viewerRole="teacher" initialFilter={initial} />
                </div>
            )}
        </DemoRoleGate>
    );
}

export default function DemoTeacherCallsPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <TeacherCalls />
        </Suspense>
    );
}
