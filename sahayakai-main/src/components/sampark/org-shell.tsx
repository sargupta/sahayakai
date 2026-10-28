"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Database, PhoneCall } from "lucide-react";
import { PageShell } from "@/components/layout";
import { useSamparkHref } from "@/components/shell/product-paths";
import { SamparkAuthGate } from "@/components/sampark/sampark-auth-gate";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { getSchool, listCampaigns, type SamparkSchoolView } from "@/lib/api/sampark";
import { ModeBanner } from "./mode-banner";
import { PauseBanner, PauseCallsButton } from "./school-pause";
import { SamparkSchoolProvider } from "./school-context";
import { ErrorPanel, LoadingBlock } from "./states";
import { useSamparkQuery } from "./use-sampark-query";
import { safeDecode, useSamparkFormat } from "./format";
import { HOLDABLE_CAMPAIGN_STATUSES, fmt } from "./labels";
import { SamparkFrame, useReportFrameData } from "./workspace-frame";

/** How often the sidebar re-counts live campaigns. A list read, so kept slow. */
const LIVE_COUNT_POLL_MS = 60_000;

function CrmStatus({ school, className }: { school: SamparkSchoolView; className?: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    let text: string;
    if (!school.crm) text = t("School records not connected");
    else if (school.crm.lastImportAt) text = fmt(t("School records synced {when}"), { when: f.relative(school.crm.lastImportAt) });
    else text = t("School records not imported yet");
    return (
        <span className={cn("inline-flex items-start gap-2 type-body text-muted-foreground", className)}>
            <Database aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            {text}
        </span>
    );
}

function OrgShellInner({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    const params = useParams<{ orgId: string }>();
    const orgId = params?.orgId ? safeDecode(params.orgId) : "";

    const schoolQuery = useSamparkQuery<SamparkSchoolView>(
        orgId ? (signal) => getSchool(orgId, { signal }) : null,
        [orgId],
    );
    const { data: school, error, loading, reload, setData } = schoolQuery;

    // "N live" on Campaigns: campaigns the dispatcher can dial (scheduled or calling).
    const campaignsQuery = useSamparkQuery(
        orgId && school ? (signal) => listCampaigns(orgId, { signal }) : null,
        [orgId, !!school],
        { pollMs: LIVE_COUNT_POLL_MS },
    );
    const liveCount = campaignsQuery.data?.filter((c) => HOLDABLE_CAMPAIGN_STATUSES.includes(c.status)).length ?? 0;
    const href = useSamparkHref();
    useReportFrameData({ school: school ?? null, liveCount });

    const setSchool = useCallback((s: SamparkSchoolView) => setData(s), [setData]);
    const ctx = useMemo(
        () => (school ? { orgId, school, setSchool, reloadSchool: reload } : null),
        [orgId, school, setSchool, reload],
    );

    if (!ctx || !school) {
        return (
            <PageShell width="wide" className="w-full">
                <Link
                    href={href("/workspace?all=1")}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-pill type-body text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    {t("All schools")}
                </Link>
                {loading && <LoadingBlock rows={4} />}
                {error && <ErrorPanel error={error} onRetry={reload} />}
            </PageShell>
        );
    }

    return (
        <SamparkSchoolProvider value={ctx}>
            <PageShell width="wide" className="w-full">
                <div className="min-w-0 space-y-6">
                    {/* The school's header: name, records status and the pause control.
                        Sections are in the SamparkAI sidebar (rail on tablets, menu on phones). */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0 space-y-1">
                            <p className="type-eyebrow text-ink-500">{t("School calls")}</p>
                            <h1 className="font-display text-page-title font-bold leading-[1.2] text-ink-900 break-words">{school.displayName}</h1>
                            <CrmStatus school={school} />
                        </div>
                        <PauseCallsButton className="self-start md:self-auto" />
                    </div>

                    <ModeBanner mode={school.mode} isDemo={school.isDemo} testPhoneLast4={school.testPhoneLast4} />
                    {school.pause && <PauseBanner orgId={orgId} pause={school.pause} onChange={setSchool} />}

                    {children}
                </div>
            </PageShell>
        </SamparkSchoolProvider>
    );
}

/** Frame for every /sampark/[orgId] screen: the SamparkAI workspace frame, the school header, the permanent mode banner and the pause banner while paused. */
export function SamparkOrgShell({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    return (
        <SamparkFrame>
            <SamparkAuthGate
                icon={PhoneCall}
                title={t("School calls")}
                description={t("Sign in with your school administrator account to manage calls to families.")}
            >
                <OrgShellInner>{children}</OrgShellInner>
            </SamparkAuthGate>
        </SamparkFrame>
    );
}
