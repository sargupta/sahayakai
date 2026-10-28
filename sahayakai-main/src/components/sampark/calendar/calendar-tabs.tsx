"use client";

/**
 * The two calendars of the SamparkAI workspace, one page each: the school schedule
 * (calls, callbacks, campaigns, events, holidays — SamparkAI's own records) and the
 * school's Google Calendar. Links work on both hosts because they are built from the
 * current path, not from a fixed /sampark prefix.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CalendarDays } from "lucide-react";

import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

export function CalendarTabs({ current }: { current: "schedule" | "google" }) {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";
    const root = pathname.replace(/\/calendar(\/google)?\/?$/, "");
    const tabs = [
        { key: "schedule" as const, label: t("School schedule"), icon: CalendarClock, href: `${root}/calendar` },
        { key: "google" as const, label: t("Google Calendar"), icon: CalendarDays, href: `${root}/calendar/google` },
    ];
    return (
        <nav aria-label={t("Calendars")} className="flex gap-1 overflow-x-auto rounded-pill border border-line-hairline bg-surface-glass-strong p-1 sm:self-start">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={tab.key === current ? "page" : undefined}
                    className={cn(
                        "focus-ring inline-flex min-h-9 shrink-0 items-center gap-2 rounded-pill px-3 text-sm font-medium transition-colors duration-small ease-standard",
                        tab.key === current ? "bg-primary text-primary-foreground" : "text-ink-600 hover:bg-milk-300",
                    )}
                >
                    <tab.icon aria-hidden="true" className="h-4 w-4" />
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}
