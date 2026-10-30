"use client";

import { registerSargvisionRoster } from "@/lib/sampark/demo/school";
import type { SargvisionContact } from "@/lib/sampark/sargvision";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowUpRight, CalendarDays, ClipboardList, GraduationCap, LayoutDashboard, Megaphone, Menu, MessageSquareWarning, Phone, PhoneCall, School, Sun, Users } from "lucide-react";
import { LanguagePill } from "@/components/language-pill";
import { ErrorBoundary } from "@/components/error-boundary";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductSideNav, type NavSection } from "@/components/shell/side-nav";
import { SahayakWordmark, SamparkWordmark } from "@/components/shell/brand";
import { useCollapsedNav } from "@/components/shell/use-collapsed";
import { useSahayakHref, useSamparkHref, useSamparkPathname } from "@/components/shell/product-paths";
import { isExternalUrl } from "@/lib/products";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { istDate } from "@/lib/sampark/demo/seed-planning";
import { useDemo } from "./use-demo";

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

/**
 * The SamparkAI frame for the demo school: the same side rail and top bar as
 * the school workspace, with the sections of whoever is signed in. A teacher
 * sees their classes and calls; the admin sees the whole school.
 */
export function DemoFrame({ children, sargvision = [] }: { children: ReactNode; sargvision?: SargvisionContact[] }) {
    // Before anything reads the school: the Sargvision class exists only when the server sent its roster.
    registerSargvisionRoster(sargvision);
    const { t } = useLanguage();
    const view = useDemo();
    const href = useSamparkHref();
    const sahayakHref = useSahayakHref();
    const current = useSamparkPathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [collapsed, toggleCollapsed] = useCollapsedNav("sampark.demo.sidebar.folded");

    const under = (p: string) => current === p || current.startsWith(`${p}/`);
    const calls = view?.visibleCalls ?? [];
    const callbacks = view?.visibleCallbacks ?? [];
    const openComplaints = calls.filter((c) => c.complaintStatus === "open").length;
    const openFollowUps = calls.filter((c) => c.complaintStatus === "open" || (c.summary?.followUpNeeded && !c.followUpDone && !c.complaintStatus)).length;
    const needsTime = callbacks.filter((c) => c.status === "proposed" || c.status === "missed" || c.status === "failed").length;
    // "Today" in India time, whatever the viewer's own time zone.
    const today = istDate(Date.now(), 0);
    const dueToday = callbacks.filter((c) => c.status === "scheduled" && c.scheduledAt && istDate(new Date(c.scheduledAt).getTime(), 0) === today).length;
    const liveCampaigns = (view?.visibleCampaigns ?? []).filter((c) => c.status === "dispatching").length;
    const badge = (n: number, label: string, tone: "accent" | "danger" = "accent") => (n > 0 ? { text: String(n), label: fmt(t(label), { count: n }), tone } : null);

    const sections: NavSection[] =
        view?.role === "admin"
            ? [
                  {
                      key: "workspace",
                      label: t("Workspace"),
                      tier: "primary",
                      items: [
                          { key: "monitor", label: t("School monitor"), shortLabel: t("Monitor"), icon: LayoutDashboard, href: href("/demo/admin"), active: current === "/demo/admin" },
                          { key: "classes", label: t("Classes & teachers"), shortLabel: t("Classes"), icon: School, href: href("/demo/admin/classes"), active: under("/demo/admin/classes") },
                          { key: "families", label: t("Families"), icon: Users, href: href("/demo/admin/families"), active: under("/demo/admin/families") },
                      ],
                  },
                  {
                      key: "outreach",
                      label: t("Outreach"),
                      tier: "primary",
                      items: [
                          { key: "calls", label: t("All calls"), shortLabel: t("Calls"), icon: Phone, href: href("/demo/admin/calls"), active: under("/demo/admin/calls") },
                          { key: "campaigns", label: t("Campaigns"), icon: Megaphone, href: href("/demo/admin/campaigns"), active: under("/demo/admin/campaigns"), badge: badge(liveCampaigns, "{count} live") },
                      ],
                  },
                  {
                      key: "planning",
                      label: t("Planning"),
                      tier: "secondary",
                      items: [{ key: "calendar", label: t("Calendar & callbacks"), shortLabel: t("Calendar"), icon: CalendarDays, href: href("/demo/admin/calendar"), active: under("/demo/admin/calendar"), badge: badge(needsTime, "{count} callbacks need a time") }],
                  },
                  {
                      key: "monitoring",
                      label: t("Monitoring"),
                      tier: "secondary",
                      items: [{ key: "followups", label: t("Complaints & follow-ups"), shortLabel: t("Follow-ups"), icon: MessageSquareWarning, href: href("/demo/admin/follow-ups"), active: under("/demo/admin/follow-ups"), badge: badge(openFollowUps, "{count} open", openComplaints > 0 ? "danger" : "accent") }],
                  },
              ]
            : view?.role === "teacher"
              ? [
                    {
                        key: "workspace",
                        label: t("Workspace"),
                        tier: "primary",
                        items: [
                            { key: "overview", label: t("Overview"), icon: Sun, href: href("/demo/teacher"), active: current === "/demo/teacher" },
                            { key: "classes", label: t("My classes"), shortLabel: t("Classes"), icon: GraduationCap, href: href("/demo/teacher/classes"), active: under("/demo/teacher/classes") },
                        ],
                    },
                    {
                        key: "outreach",
                        label: t("Outreach"),
                        tier: "primary",
                        items: [
                            { key: "calls", label: t("My calls"), shortLabel: t("Calls"), icon: PhoneCall, href: href("/demo/teacher/calls"), active: under("/demo/teacher/calls") },
                            { key: "followups", label: t("Follow-ups"), icon: ClipboardList, href: href("/demo/teacher/follow-ups"), active: under("/demo/teacher/follow-ups"), badge: badge(openFollowUps, "{count} open", openComplaints > 0 ? "danger" : "accent") },
                            { key: "outreach", label: t("Class notices"), shortLabel: t("Notices"), icon: Megaphone, href: href("/demo/teacher/outreach"), active: under("/demo/teacher/outreach"), badge: badge(liveCampaigns, "{count} live") },
                        ],
                    },
                    {
                        key: "planning",
                        label: t("Planning"),
                        tier: "secondary",
                        items: [{ key: "calendar", label: t("My calendar"), shortLabel: t("Calendar"), icon: CalendarDays, href: href("/demo/teacher/calendar"), active: under("/demo/teacher/calendar"), badge: badge(dueToday + needsTime, "{count} callbacks today or waiting") }],
                    },
                ]
              : [];

    const lead = view?.role
        ? (mode: "full" | "rail") => {
              const roleLabel = view.role === "admin" ? t(view.school.admin.title) : t("Class teacher");
              const avatar = (
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-row bg-milk-400 font-display text-tile font-semibold text-ink-900">
                      {initials(view.actorName)}
                  </span>
              );
              if (mode === "rail") {
                  return (
                      <Link href={href("/demo")} aria-label={t("Switch role")} className="focus-ring flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1">
                          {avatar}
                          <span className="text-xs font-medium leading-tight text-ink-600">{roleLabel}</span>
                      </Link>
                  );
              }
              return (
                  <Link
                      href={href("/demo")}
                      onClick={() => setMenuOpen(false)}
                      className="focus-ring group/role flex min-h-12 items-center gap-3 rounded-field border border-line-glass bg-surface-glass px-3 py-2 transition-colors duration-small ease-standard hover:bg-surface-glass-strong"
                  >
                      {avatar}
                      <span className="min-w-0 flex-1">
                          <span className="block break-words font-display text-value font-semibold leading-tight text-ink-900">{view.actorName}</span>
                          <span className="block text-xs leading-snug text-ink-500">{roleLabel}</span>
                      </span>
                      <ArrowLeftRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink-500 group-hover/role:text-ink-900" />
                  </Link>
              );
          }
        : undefined;

    // Back to SahayakAI, as the signed-in workspace frame does.
    const sahayakHome = sahayakHref("/");
    const SahayakLink = ({ className, children: inner, label }: { className: string; children: ReactNode; label?: string }) =>
        isExternalUrl(sahayakHome) ? (
            <a href={sahayakHome} className={className} aria-label={label}>
                {inner}
            </a>
        ) : (
            <Link href={sahayakHome} className={className} aria-label={label}>
                {inner}
            </Link>
        );

    const footer = (mode: "full" | "rail") =>
        mode === "rail" ? (
            <SahayakLink label={t("Open SahayakAI")} className="focus-ring flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1">
                <SahayakWordmark compact />
                <span className="text-xs font-medium leading-tight text-ink-600">Sahayak</span>
            </SahayakLink>
        ) : (
            <div className="space-y-2">
                <div className="rounded-field px-3 py-1 text-xs leading-snug text-ink-500">
                    <span className="block font-display text-value font-semibold leading-tight text-ink-900">{view?.school.name ?? ""}</span>
                    {t("Demo school · every name is made up")}
                </div>
                <SahayakLink className="focus-ring group/sh flex min-h-12 items-center gap-3 rounded-field px-3 py-2 transition-colors duration-small ease-standard hover:bg-milk-300">
                    <SahayakWordmark compact />
                    <span className="min-w-0 flex-1">
                        <span className="block font-display text-value font-semibold leading-tight text-ink-900">SahayakAI</span>
                        <span className="block text-xs leading-snug text-ink-500">{t("The teacher's workspace")}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink-500 group-hover/sh:text-ink-900" />
                </SahayakLink>
            </div>
        );

    const nav = (forceFull: boolean) => (
        <ProductSideNav
            label="SamparkAI"
            brand={<SamparkWordmark />}
            brandCompact={<SamparkWordmark compact />}
            brandHref={href("/demo")}
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
        <div className="theme-sampark flex min-h-svh w-full bg-milk-200">
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
                        <p className="hidden min-w-0 truncate text-tile text-ink-500 md:block">
                            {view ? `${view.school.name}, ${view.school.city}` : t("Demo school")}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        {sargvision.length > 0 ? (
                            <StatusPill tone="warning" title={t("Demo classes play in the browser. The Sargvision sample class places REAL calls by Riya to its allow-listed contacts, after confirmation, on this local machine only.")}>
                                {t("Demo · Sargvision rings real phones")}
                            </StatusPill>
                        ) : (
                            <StatusPill tone="brand" title={t("Calls in this demo are played in the browser. No phone rings and no real family is contacted.")}>
                                {t("Demo · no phone rings")}
                            </StatusPill>
                        )}
                        <LanguagePill />
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
    );
}
