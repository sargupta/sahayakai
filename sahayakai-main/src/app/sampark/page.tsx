"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, PhoneCall, School } from "lucide-react";
import { PageShell, SectionCard, EmptyState } from "@/components/layout";
import { SamparkAuthGate } from "@/components/sampark/sampark-auth-gate";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { ApiError, enableSampark, getMySchools, type SamparkMeSchool } from "@/lib/api/sampark";
import { StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock, errorMessage } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";

function SchoolRow({ school }: { school: SamparkMeSchool }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const router = useRouter();
    const [enabling, setEnabling] = useState(false);
    const href = `/sampark/${encodeURIComponent(school.orgId)}`;

    const enable = async () => {
        setEnabling(true);
        try {
            await enableSampark(school.orgId, school.displayName);
            toast({ title: t("School calls switched on in Practice mode") });
            router.push(href);
        } catch (err) {
            toast({ title: t("Could not switch on school calls"), description: errorMessage(t, err), variant: "destructive" });
            setEnabling(false);
        }
    };

    return (
        <li className="flex flex-col gap-3 rounded-surface-md border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
                    <School aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                    <p className="type-body-lg text-foreground break-words">{school.displayName}</p>
                    {school.enabled ? (
                        <StatusPill tone="success">{t("Switched on")}</StatusPill>
                    ) : (
                        <StatusPill tone="neutral">{t("Not switched on")}</StatusPill>
                    )}
                </div>
            </div>
            {school.enabled ? (
                <Button asChild variant="outline" className="shrink-0">
                    <Link href={href}>
                        {t("Open")}
                        <ChevronRight aria-hidden="true" />
                    </Link>
                </Button>
            ) : (
                <Button type="button" onClick={enable} disabled={enabling} className="shrink-0">
                    {enabling && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Enable school calls")}
                </Button>
            )}
        </li>
    );
}

function SamparkHomeContent() {
    const { t } = useLanguage();
    const query = useSamparkQuery((signal) => getMySchools({ signal }), []);
    const featureOff = query.error instanceof ApiError && query.error.status === 404;

    return (
        <PageShell
            width="default"
            className="w-full"
            title={t("School calls")}
            description={t("Call families in their own language with school notices: PTM invitations, event invitations and emergency closures. Parents hear your school name, never ours.")}
        >
            {query.loading && !query.data && <LoadingBlock rows={2} />}

            {featureOff && (
                <SectionCard tone="muted">
                    <EmptyState
                        icon={PhoneCall}
                        title={t("School calls are not switched on yet")}
                        description={t("This feature is being prepared for pilot schools. Your SahayakAI contact will let you know when it is ready for your school.")}
                    />
                </SectionCard>
            )}

            {query.error && !featureOff && <ErrorPanel error={query.error} onRetry={query.reload} />}

            {query.data && query.data.length === 0 && (
                <SectionCard tone="muted">
                    <EmptyState
                        icon={School}
                        title={t("No schools to show")}
                        description={t("This page lists the schools you administer. Only a school administrator, usually the principal, can set up calls to families. If you run a school and see nothing here, ask your SahayakAI contact to link your account to your school.")}
                    />
                </SectionCard>
            )}

            {query.data && query.data.length > 0 && (
                <SectionCard
                    title={t("Your schools")}
                    description={t("Schools where you are an administrator. Every school starts in Practice mode, where no real calls are made.")}
                >
                    <ul className="space-y-3">
                        {query.data.map((s) => (
                            <SchoolRow key={s.orgId} school={s} />
                        ))}
                    </ul>
                </SectionCard>
            )}
        </PageShell>
    );
}

export default function SamparkHomePage() {
    const { t } = useLanguage();
    return (
        <SamparkAuthGate
            icon={PhoneCall}
            title={t("School calls")}
            description={t("Sign in with your school administrator account to manage calls to families.")}
        >
            <SamparkHomeContent />
        </SamparkAuthGate>
    );
}
