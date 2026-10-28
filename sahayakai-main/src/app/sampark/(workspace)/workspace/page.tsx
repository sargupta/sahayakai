"use client";

import { useEffect, useState } from "react";
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
import { SamparkFrame } from "@/components/sampark/workspace-frame";
import { useSamparkHref } from "@/components/shell/product-paths";

function SchoolRow({ school }: { school: SamparkMeSchool }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const router = useRouter();
    const [enabling, setEnabling] = useState(false);
    const samparkHref = useSamparkHref();
    const href = samparkHref(`/${encodeURIComponent(school.orgId)}`);

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
        <li className="flex flex-col gap-3 rounded-tile border border-line-glass bg-surface-glass p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-row bg-milk-400 text-ink-600">
                    <School aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                    <p className="font-display text-card-title font-semibold leading-snug text-ink-900 break-words">{school.displayName}</p>
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
    const router = useRouter();
    const samparkHref = useSamparkHref();
    // `?all=1` (the "All schools" switcher) always shows the list. Read after
    // mount, so the page needs no Suspense boundary for useSearchParams.
    const [showAll, setShowAll] = useState(false);
    useEffect(() => {
        setShowAll(new URLSearchParams(window.location.search).get("all") === "1");
    }, []);
    const only = query.data?.length === 1 && query.data[0].enabled ? query.data[0] : null;

    // One school, already switched on: open its workspace instead of a one-row list.
    useEffect(() => {
        if (only && !showAll && new URLSearchParams(window.location.search).get("all") !== "1") {
            router.replace(samparkHref(`/${encodeURIComponent(only.orgId)}`));
        }
    }, [only, showAll, router, samparkHref]);

    return (
        <PageShell
            width="default"
            className="w-full"
            title={t("Your schools")}
            description={t("Call families in their own language with school notices: PTM invitations, event invitations and emergency closures. Parents hear your school name, never ours.")}
        >
            {((query.loading && !query.data) || (only && !showAll)) && <LoadingBlock rows={2} />}

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

            {query.data && query.data.length > 0 && !(only && !showAll) && (
                <SectionCard
                    title={t("Schools you administer")}
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

/** SamparkAI's signed-in entry: the schools this account administers. */
export default function SamparkWorkspacePage() {
    const { t } = useLanguage();
    return (
        <SamparkFrame>
            <SamparkAuthGate
                icon={PhoneCall}
                title={t("School calls")}
                description={t("Sign in with your school administrator account to manage calls to families.")}
            >
                <SamparkHomeContent />
            </SamparkAuthGate>
        </SamparkFrame>
    );
}
