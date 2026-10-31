"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Bot, CalendarClock, ChevronsUpDown, Megaphone, Menu, Phone, School, Settings, Sun, Users } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { LanguagePill } from "@/components/language-pill";
import { ErrorBoundary } from "@/components/error-boundary";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductSideNav, type NavSection } from "@/components/shell/side-nav";
import { SahayakWordmark, SamparkWordmark } from "@/components/shell/brand";
import { useCollapsedNav } from "@/components/shell/use-collapsed";
import { useSahayakHref, useSamparkHref, useSamparkPathname } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { isExternalUrl } from "@/lib/products";
import type { SamparkSchoolView } from "@/lib/api/sampark";
import { cn } from "@/lib/utils";
import { fmt } from "./labels";
import { safeDecode } from "./format";

/**
 * The SamparkAI workspace frame: its own SideRail, TopBar and content area,
 * built from the same shell components as SahayakAI so the two products
 * share one design language and differ in what they hold.
 *
 *   school switcher           which school this is; all schools
 *   Today · Campaigns · Calls · Families      the communication work
 *   Assistant: Riya calls     calls the Riya voice agent placed
 *              Calendar       every scheduled call and school event
 *   School: Settings          school details, calling mode, records
 *   footer: back to SahayakAI
 *
 * Without an orgId (the school picker) only "Schools" is shown. Access is
 * enforced by the API (org admin only); this frame only renders.
 */

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

interface FrameData {
    school: SamparkSchoolView | null;
    /** Campaigns the dispatcher can dial right now (scheduled or calling). */
    liveCount: number;
}

const FrameDataContext = createContext<((data: FrameData) => void) | null>(null);

/**
 * The school's workspace (org-shell) loads the school and the live campaign
 * count; it reports them here so the sidebar can show the school's name and
 * the Campaigns badge without a second request.
 */
export function useReportFrameData(data: FrameData) {
    const report = useContext(FrameDataContext);
    const { school, liveCount } = data;
    useEffect(() => {
        report?.({ school, liveCount });
    }, [report, school, liveCount]);
}

function useSections(orgId: string | undefined, liveCount: number): NavSection[] {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const current = safeDecode(useSamparkPathname());

    if (!orgId) {
        return [
            {
                key: "workspace",
                tier: "primary",
                items: [{ key: "schools", label: t("Schools"), icon: School, href: href("/workspace?all=1"), active: current === "/workspace" }],
            },
        ];
    }

    const base = `/${encodeURIComponent(orgId)}`;
    const decodedBase = `/${orgId}`;
    const under = (rest: string) => current === `${decodedBase}${rest}` || current.startsWith(`${decodedBase}${rest}/`);

    return [
        {
            key: "work",
            tier: "primary",
            items: [
                { key: "today", label: t("Today"), icon: Sun, href: href(base), active: current === decodedBase || current === `${decodedBase}/` },
                {
                    key: "campaigns",
                    label: t("Campaigns"),
                    icon: Megaphone,
                    href: href(`${base}/campaigns`),
                    active: under("/campaigns"),
                    badge: liveCount > 0 ? { text: String(liveCount), label: fmt(t("{count} live"), { count: liveCount }) } : null,
                },
                { key: "calls", label: t("Calls"), icon: Phone, href: href(`${base}/calls`), active: under("/calls") },
                { key: "families", label: t("Parents"), icon: Users, href: href(`${base}/families`), active: under("/families") },
            ],
        },
        {
            key: "assistant",
            label: t("Assistant"),
            tier: "secondary",
            items: [
                { key: "riya", label: t("Riya calls"), shortLabel: t("Riya"), icon: Bot, href: href(`${base}/riya`), active: under("/riya") },
                { key: "calendar", label: t("Calendar"), icon: CalendarClock, href: href(`${base}/calendar`), active: under("/calendar") || under("/callbacks") },
            ],
        },
        {
            key: "school",
            label: t("School"),
            tier: "secondary",
            items: [{ key: "settings", label: t("Settings"), icon: Settings, href: href(`${base}/settings`), active: under("/settings") }],
        },
    ];
}

export function SamparkFrame({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    const params = useParams<{ orgId?: string }>();
    const orgId = params?.orgId ? safeDecode(params.orgId) : undefined;
    const [data, setData] = useState<FrameData>({ school: null, liveCount: 0 });
    const school = data.school && data.school.orgId === orgId ? data.school : null;
    const liveCount = school ? data.liveCount : 0;
    const href = useSamparkHref();
    const [menuOpen, setMenuOpen] = useState(false);
    const [collapsed, toggleCollapsed] = useCollapsedNav("sampark.sidebar.folded");
    const sections = useSections(orgId, liveCount);
    const teacherHome = useSahayakHref()("/");

    const SchoolsLink = ({ className, children: inner, label }: { className: string; children: ReactNode; label?: string }) => (
        <Link href={href("/workspace?all=1")} className={className} aria-label={label} onClick={() => setMenuOpen(false)}>
            {inner}
        </Link>
    );

    const lead = orgId
        ? (mode: "full" | "rail") => {
              const name = school?.displayName ?? orgId;
              if (mode === "rail") {
                  return (
                      <SchoolsLink label={fmt(t("{school} · all schools"), { school: name })} className="focus-ring flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1">
                          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-row bg-milk-400 font-display text-tile font-semibold text-ink-900">
                              {initials(name)}
                          </span>
                          <span className="text-xs font-medium leading-tight text-ink-600">{t("School")}</span>
                      </SchoolsLink>
                  );
              }
              return (
                  <SchoolsLink className="focus-ring group/school flex min-h-12 items-center gap-3 rounded-field border border-line-glass bg-surface-glass px-3 py-2 transition-colors duration-small ease-standard hover:bg-surface-glass-strong">
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-row bg-milk-400 font-display text-tile font-semibold text-ink-900">
                          {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1">
                          <span className="block break-words font-display text-value font-semibold leading-tight text-ink-900">{name}</span>
                          <span className="block text-xs leading-snug text-ink-500">{t("All schools")}</span>
                      </span>
                      <ChevronsUpDown aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink-500 group-hover/school:text-ink-900" />
                  </SchoolsLink>
              );
          }
        : undefined;

    const TeacherLink = ({ className, children: inner, label }: { className: string; children: ReactNode; label?: string }) =>
        isExternalUrl(teacherHome) ? (
            <a href={teacherHome} className={className} aria-label={label}>
                {inner}
            </a>
        ) : (
            <Link href={teacherHome} className={className} aria-label={label}>
                {inner}
            </Link>
        );

    const footer = (mode: "full" | "rail") =>
        mode === "rail" ? (
            <TeacherLink label={t("Open SahayakAI")} className="focus-ring flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1">
                <SahayakWordmark compact />
                <span className="text-xs font-medium leading-tight text-ink-600">Sahayak</span>
            </TeacherLink>
        ) : (
            <TeacherLink className="focus-ring group/sh flex min-h-12 items-center gap-3 rounded-field px-3 py-2 transition-colors duration-small ease-standard hover:bg-milk-300">
                <SahayakWordmark compact />
                <span className="min-w-0 flex-1">
                    <span className="block font-display text-value font-semibold leading-tight text-ink-900">SahayakAI</span>
                    <span className="block text-xs leading-snug text-ink-500">{t("The teacher's workspace")}</span>
                </span>
                <ArrowUpRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink-500 group-hover/sh:text-ink-900" />
            </TeacherLink>
        );

    const nav = (forceFull: boolean) => (
        <ProductSideNav
            label="SamparkAI"
            brand={<SamparkWordmark />}
            brandCompact={<SamparkWordmark compact />}
            brandHref={href("/")}
            lead={lead}
            sections={sections}
            footer={footer}
            collapsed={forceFull ? false : collapsed}
            onToggleCollapsed={forceFull ? undefined : toggleCollapsed}
            forceFull={forceFull}
            onNavigate={forceFull ? () => setMenuOpen(false) : undefined}
            collapseLabel={t("Fold sidebar")}
            expandLabel={t("Unfold sidebar")}
        />
    );

    return (
        <FrameDataContext.Provider value={setData}>
        <div className="flex min-h-svh w-full bg-milk-200">
            {nav(false)}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-hairline bg-surface-chrome px-3 md:h-topbar md:px-6">
                    <div className="flex min-w-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(true)}
                            aria-label={t("Open menu")}
                            aria-expanded={menuOpen}
                            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink-600 hover:bg-milk-300 hover:text-ink-900 md:hidden"
                        >
                            <Menu aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
                        </button>
                        <Link href={href("/")} className="focus-ring flex min-h-11 items-center rounded-pill px-1 md:hidden">
                            <SamparkWordmark />
                        </Link>
                        <p className={cn("hidden min-w-0 truncate text-tile text-ink-500 md:block")}>
                            {school ? fmt(t("{school} · school workspace"), { school: school.displayName }) : t("School workspace")}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <LanguagePill />
                        <AuthButton />
                    </div>
                </header>
                <main className="w-full max-w-full flex-1 overflow-x-hidden px-3 pb-16 pt-4 sm:px-4 md:px-8 md:pt-8">
                    <ErrorBoundary>{children}</ErrorBoundary>
                </main>
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent side="left" className="w-[min(320px,88vw)] border-r border-line-hairline bg-milk-50 p-0 md:hidden">
                    <SheetTitle className="sr-only">{t("Menu")}</SheetTitle>
                    {nav(true)}
                </SheetContent>
            </Sheet>
        </div>
        </FrameDataContext.Provider>
    );
}
