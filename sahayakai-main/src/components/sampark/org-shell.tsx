"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft, Database, PhoneCall } from "lucide-react";
import { PageShell } from "@/components/layout";
import { SamparkAuthGate } from "@/components/sampark/sampark-auth-gate";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { getSchool } from "@/lib/api/sampark";
import type { SamparkSchool } from "@/types/sampark";
import { ModeBanner } from "./mode-banner";
import { SamparkSchoolProvider } from "./school-context";
import { ErrorPanel, LoadingBlock } from "./states";
import { useSamparkQuery } from "./use-sampark-query";
import { safeDecode, useSamparkFormat } from "./format";
import { fmt } from "./labels";

function CrmStatus({ school }: { school: SamparkSchool }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    let text: string;
    if (!school.crm) text = t("School records not connected");
    else if (school.crm.lastImportAt) text = fmt(t("School records synced {when}"), { when: f.relative(school.crm.lastImportAt) });
    else text = t("School records not imported yet");
    return (
        <span className="inline-flex items-center gap-2 type-body text-muted-foreground">
            <Database aria-hidden="true" className="h-4 w-4 shrink-0" />
            {text}
        </span>
    );
}

function Tabs({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";
    const base = `/sampark/${encodeURIComponent(orgId)}`;
    const tabs = [
        { href: base, label: t("Today"), exact: true },
        { href: `${base}/approvals`, label: t("Approvals"), exact: false },
        { href: `${base}/campaigns`, label: t("Campaigns"), exact: false },
        { href: `${base}/calls`, label: t("Calls"), exact: false },
        { href: `${base}/families`, label: t("Families"), exact: false },
        { href: `${base}/rules`, label: t("Rules"), exact: false },
        { href: `${base}/settings`, label: t("Settings"), exact: false },
    ];
    const decoded = safeDecode(pathname);
    const decodedBase = safeDecode(base);
    return (
        <nav aria-label={t("School calls sections")} className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
            <ul className="flex min-w-max gap-1">
                {tabs.map((tab) => {
                    const href = safeDecode(tab.href);
                    const active = tab.exact
                        ? decoded === decodedBase || decoded === `${decodedBase}/`
                        : decoded === href || decoded.startsWith(`${href}/`);
                    return (
                        <li key={tab.href}>
                            <Link
                                href={tab.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 py-2 text-sm font-medium leading-normal",
                                    "transition-colors duration-micro ease-out-quart",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-surface-sm",
                                    active
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {tab.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

function OrgShellInner({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    const params = useParams<{ orgId: string }>();
    const orgId = params?.orgId ? safeDecode(params.orgId) : "";

    const schoolQuery = useSamparkQuery<SamparkSchool>(
        orgId ? (signal) => getSchool(orgId, { signal }) : null,
        [orgId],
    );
    const { data: school, error, loading, reload, setData } = schoolQuery;

    const setSchool = useCallback((s: SamparkSchool) => setData(s), [setData]);
    const ctx = useMemo(
        () => (school ? { orgId, school, setSchool, reloadSchool: reload } : null),
        [orgId, school, setSchool, reload],
    );

    return (
        <PageShell width="default" className="w-full">
            <div className="space-y-4">
                <Link
                    href="/sampark"
                    className="inline-flex items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    {t("All schools")}
                </Link>

                {school && (
                    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-1 min-w-0">
                            <p className="type-caption text-muted-foreground">{t("School calls")}</p>
                            <h1 className="type-h1 text-foreground break-words">{school.displayName}</h1>
                        </div>
                        <CrmStatus school={school} />
                    </header>
                )}

                {school && <ModeBanner mode={school.mode} isDemo={school.isDemo} />}
                {orgId && <Tabs orgId={orgId} />}
            </div>

            {!school && loading && <LoadingBlock rows={4} />}
            {!school && error && <ErrorPanel error={error} onRetry={reload} />}
            {ctx && <SamparkSchoolProvider value={ctx}>{children}</SamparkSchoolProvider>}
        </PageShell>
    );
}

/** Frame for every /sampark/[orgId] screen: header, permanent mode banner, CRM status, tabs. */
export function SamparkOrgShell({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    return (
        <SamparkAuthGate
            icon={PhoneCall}
            title={t("School calls")}
            description={t("Sign in with your school administrator account to manage calls to families.")}
        >
            <OrgShellInner>{children}</OrgShellInner>
        </SamparkAuthGate>
    );
}
