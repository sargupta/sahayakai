"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, User, Users } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

/**
 * TabBar — the phone's four destinations (design system, decided 26 Oct
 * 2026): Home · Library · Community · Profile, four tabs and never five.
 * It replaces the old Home · Create · Library · Me bar; creation starts
 * from VIDYA and Home, and every tool is in the menu (top bar).
 *
 * A floating capsule (surface-capsule, shadow-float) 18px above the foot,
 * 42px discs, no visible labels but a name on every tab. The active tab is
 * a saffron-500 disc (icon-only, so 3:1 is the bar) plus aria-current.
 * Under 768px only; it slides away while scrolling down and returns on
 * scroll up, as before.
 */

const TABS = [
    { key: "home", icon: Home, i18nKey: "Home", href: "/", match: (p: string) => p === "/" },
    { key: "library", icon: Library, i18nKey: "Library", href: "/my-library", match: (p: string) => p.startsWith("/my-library") },
    { key: "community", icon: Users, i18nKey: "Community", href: "/community", match: (p: string) => p.startsWith("/community") },
    {
        key: "profile",
        icon: User,
        i18nKey: "Profile",
        href: "/my-profile",
        match: (p: string) => p.startsWith("/my-profile") || p.startsWith("/settings") || p.startsWith("/usage"),
    },
] as const;

export function MobileBottomNav() {
    const pathname = usePathname() ?? "";
    const { t } = useLanguage();
    const [hidden, setHidden] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const THRESHOLD = 12; // ignore jitter
        const onScroll = () => {
            const y = window.scrollY;
            const dy = y - lastScrollY.current;
            if (Math.abs(dy) < THRESHOLD) return;
            setHidden(y >= 48 && dy > 0);
            lastScrollY.current = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            aria-label={t("Primary navigation")}
            className={cn(
                "fixed bottom-[calc(18px+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 md:hidden",
                "transition-transform duration-sheet ease-standard motion-reduce:transition-none",
                hidden && "translate-y-[calc(100%+40px)]",
            )}
        >
            <ul className="flex items-center gap-1.5 rounded-pill border border-line-glass bg-surface-capsule p-[7px] shadow-float">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.match(pathname);
                    return (
                        <li key={tab.key}>
                            <Link
                                href={tab.href}
                                aria-label={t(tab.i18nKey)}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    // 42px disc drawn, 44px touch target via the padding ring.
                                    "focus-ring flex h-11 w-11 items-center justify-center rounded-pill",
                                    "transition-colors duration-small ease-standard",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-[42px] w-[42px] items-center justify-center rounded-pill",
                                        active ? "bg-saffron-500 text-white" : "text-ink-500 hover:bg-tint-subtle hover:text-ink-900",
                                    )}
                                >
                                    <Icon aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
