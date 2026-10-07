"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft, ChevronsUpDown, Database, Megaphone, Phone, PhoneCall, Settings, Sun, Users, type LucideIcon } from "lucide-react";
import { PageShell } from "@/components/layout";
import { SamparkAuthGate } from "@/components/sampark/sampark-auth-gate";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { getSchool, listCampaigns, type SamparkSchoolView } from "@/lib/api/sampark";
import { ModeBanner } from "./mode-banner";
import { PauseBanner, PauseCallsButton } from "./school-pause";
import { SamparkSchoolProvider } from "./school-context";
import { ErrorPanel, LoadingBlock } from "./states";
import { StatusPill } from "./status-pill";
import { useSamparkQuery } from "./use-sampark-query";
import { safeDecode, useSamparkFormat } from "./format";
import { HOLDABLE_CAMPAIGN_STATUSES, fmt, modeDescription, modeLabel } from "./labels";

/** How often the rail re-counts live campaigns. A list read, so kept slow. */
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

interface Section {
    href: string;
    label: string;
    icon: LucideIcon;
    exact: boolean;
    badge?: string | null;
}

/** The five sections, with the active one worked out from the path (route params may arrive encoded). */
function useSections(orgId: string, liveCount: number): (Section & { active: boolean })[] {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";
    const base = `/sampark/${encodeURIComponent(orgId)}`;
    const decoded = safeDecode(pathname);
    const decodedBase = safeDecode(base);
    const sections: Section[] = [
        { href: base, label: t("Today"), icon: Sun, exact: true },
        { href: `${base}/campaigns`, label: t("Campaigns"), icon: Megaphone, exact: false, badge: liveCount > 0 ? fmt(t("{count} live"), { count: liveCount }) : null },
        { href: `${base}/calls`, label: t("Calls"), icon: Phone, exact: false },
        { href: `${base}/families`, label: t("Families"), icon: Users, exact: false },
        { href: `${base}/settings`, label: t("Settings"), icon: Settings, exact: false },
    ];
    return sections.map((s) => {
        const href = safeDecode(s.href);
        const active = s.exact ? decoded === decodedBase || decoded === `${decodedBase}/` : decoded === href || decoded.startsWith(`${href}/`);
        return { ...s, active };
    });
}

/** Small screens: the sections as a scrolling row of tabs under the header. */
function Tabs({ sections }: { sections: (Section & { active: boolean })[] }) {
    const { t } = useLanguage();
    return (
        <nav aria-label={t("School calls sections")} className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
            <ul className="flex min-w-max gap-1">
                {sections.map((s) => (
                    <li key={s.href}>
                        <Link
                            href={s.href}
                            aria-current={s.active ? "page" : undefined}
                            className={cn(
                                "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium leading-normal",
                                "transition-colors duration-micro ease-out-quart",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-surface-sm",
                                s.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {s.label}
                            {s.badge && <span className="rounded-pill bg-primary px-2 text-xs font-semibold leading-normal text-primary-foreground">{s.badge}</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

/** Large screens: the console's left rail — school, sections, calling mode, pause, records. */
function Rail({ school, sections }: { school: SamparkSchoolView; sections: (Section & { active: boolean })[] }) {
    const { t } = useLanguage();
    return (
        <aside className="hidden xl:flex xl:w-60 xl:shrink-0 xl:flex-col xl:gap-6">
            <Link
                href="/sampark"
                className="flex min-h-11 items-center gap-3 rounded-surface-md border border-border bg-card p-3 shadow-soft transition-colors duration-micro ease-out-quart hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-surface-sm bg-muted text-xs font-semibold leading-normal text-foreground">
                    {initials(school.displayName)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="type-body font-semibold text-foreground break-words">{school.displayName}</span>
                    <span className="text-xs leading-normal text-muted-foreground">{t("School calls")}</span>
                </span>
                <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">{t("All schools")}</span>
            </Link>

            <nav aria-label={t("School calls sections")}>
                <ul className="space-y-1">
                    {sections.map((s) => {
                        const Icon = s.icon;
                        return (
                            <li key={s.href}>
                                <Link
                                    href={s.href}
                                    aria-current={s.active ? "page" : undefined}
                                    className={cn(
                                        "flex min-h-11 items-center gap-3 rounded-surface-md px-3 py-2 type-body",
                                        "transition-colors duration-micro ease-out-quart",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        s.active ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", s.active ? "text-primary" : "text-muted-foreground")} />
                                    <span className="flex-1">{s.label}</span>
                                    {s.badge && (
                                        <span className="rounded-pill bg-primary px-2 text-xs font-semibold leading-normal text-primary-foreground">{s.badge}</span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="space-y-2 rounded-surface-md border border-border bg-card p-4">
                <p className="type-caption text-muted-foreground">{t("Calling mode")}</p>
                <p className="flex items-center gap-2 type-body font-semibold text-foreground">
                    <span
                        aria-hidden="true"
                        className={cn(
                            "h-2 w-2 shrink-0 rounded-pill",
                            school.mode === "live" ? "bg-destructive" : school.mode === "test" ? "bg-warning" : "bg-info",
                        )}
                    />
                    {modeLabel(t, school.mode)}
                </p>
                <p className="text-xs leading-normal text-muted-foreground">{modeDescription(t, school.mode)}</p>
            </div>

            {school.pause ? (
                <StatusPill tone="danger" className="self-start">{t("Calls paused")}</StatusPill>
            ) : (
                <PauseCallsButton className="w-full" />
            )}

            <CrmStatus school={school} className="text-xs leading-normal" />
        </aside>
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
    const sections = useSections(orgId, liveCount);

    const setSchool = useCallback((s: SamparkSchoolView) => setData(s), [setData]);
    const ctx = useMemo(
        () => (school ? { orgId, school, setSchool, reloadSchool: reload } : null),
        [orgId, school, setSchool, reload],
    );

    if (!ctx || !school) {
        return (
            <PageShell width="wide" className="w-full">
                <Link
                    href="/sampark"
                    className="inline-flex min-h-11 items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <div className="xl:flex xl:items-start xl:gap-8">
                    <Rail school={school} sections={sections} />

                    <div className="min-w-0 flex-1 space-y-6">
                        {/* Small screens: a compact header and the sections as tabs (the rail is hidden). */}
                        <div className="space-y-4 xl:hidden">
                            <Link
                                href="/sampark"
                                className="inline-flex min-h-11 items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                                {t("All schools")}
                            </Link>
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="min-w-0 space-y-1">
                                    <p className="type-caption text-muted-foreground">{t("School calls")}</p>
                                    <p className="type-h2 text-foreground break-words">{school.displayName}</p>
                                    <CrmStatus school={school} />
                                </div>
                                <PauseCallsButton className="self-start md:self-auto" />
                            </div>
                        </div>

                        <ModeBanner mode={school.mode} isDemo={school.isDemo} testPhoneLast4={school.testPhoneLast4} />
                        {school.pause && <PauseBanner orgId={orgId} pause={school.pause} onChange={setSchool} />}
                        <div className="xl:hidden">
                            <Tabs sections={sections} />
                        </div>

                        {children}
                    </div>
                </div>
            </PageShell>
        </SamparkSchoolProvider>
    );
}

/** Frame for every /sampark/[orgId] screen: left rail (large screens) or header and tabs, permanent mode banner, pause banner while paused. */
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
