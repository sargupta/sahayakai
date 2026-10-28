"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/sampark/states";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CallList, type CallFilter } from "@/components/sampark/demo/call-list";

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
                    <header className="space-y-1">
                        <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">{t("My calls")}</h1>
                        <p className="text-ink-600">
                            {t("Every call to a parent in your classes, including calls the principal placed. Open a call for the summary, the transcript and any complaint the parent raised.")}
                        </p>
                    </header>
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
