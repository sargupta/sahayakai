"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock } from "@/components/sampark/states";
import { useLanguage } from "@/context/language-context";
import { DemoRoleGate } from "@/components/sampark/demo/use-demo";
import { CallList, type CallFilter } from "@/components/sampark/demo/call-list";

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
                    <header className="space-y-1">
                        <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">{t("All calls")}</h1>
                        <p className="text-ink-600">{t("Every parent call in the school, by any teacher or by you. Filter by teacher or reason, and open a call to review it.")}</p>
                    </header>
                    <CallList calls={view.visibleCalls} viewerRole="admin" teachers={view.school.teachers} initialFilter={initial} />
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
