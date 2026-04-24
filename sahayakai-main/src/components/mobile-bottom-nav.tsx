"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Sparkles, Library, User } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { openCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom tab nav — Phase 4 (2026-04-24).
 *
 * Fixed to the viewport bottom on mobile (md:hidden). Four tabs:
 *   Home   (/)                 — dashboard / landing
 *   Create (opens ⌘K palette)  — search-driven tool selection
 *   Library (/my-library)      — saved work
 *   Me     (/my-profile)       — profile
 *
 * VIDYA voice assistant lives in the floating OmniOrb (bottom-right, above
 * this nav). This nav owns navigation intent; voice is always one orb-tap
 * away.
 *
 * Active tab: saffron icon + label. Others: muted.
 * Safe-area-inset-bottom padding for devices with home indicators.
 */

type Tab = {
  key: string;
  icon: typeof Home;
  label: string;
  i18nKey: string;
} & (
  | { kind: "nav"; href: string }
  | { kind: "action"; onClick: () => void }
);

const TABS: Tab[] = [
  {
    kind: "nav",
    key: "home",
    icon: Home,
    label: "Home",
    i18nKey: "Home",
    href: "/",
  },
  {
    kind: "action",
    key: "create",
    icon: Sparkles,
    label: "Create",
    i18nKey: "Create",
    onClick: openCommandPalette,
  },
  {
    kind: "nav",
    key: "library",
    icon: Library,
    label: "Library",
    i18nKey: "My Library",
    href: "/my-library",
  },
  {
    kind: "nav",
    key: "me",
    icon: User,
    label: "Me",
    i18nKey: "My Profile",
    href: "/my-profile",
  },
];

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  // Scroll-hide behaviour: slide the nav down on scroll-down, back up on
  // scroll-up. Gives more vertical space for long-form content on mobile
  // (lesson plans, quiz results) while keeping the nav one swipe away.
  useEffect(() => {
    const THRESHOLD = 12; // ignore jitter
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY.current;
      if (Math.abs(dy) < THRESHOLD) return;
      if (y < 48) {
        setHidden(false);
      } else if (dy > 0) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (tab: Tab) => {
    if (tab.kind !== "nav") return false;
    if (tab.href === "/") return pathname === "/";
    return pathname.startsWith(tab.href);
  };

  return (
    <nav
      aria-label={t("Primary navigation")}
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40",
        "flex items-stretch justify-around",
        "h-14 pb-[env(safe-area-inset-bottom)]",
        "bg-background/95 backdrop-blur-md border-t border-border",
        "shadow-floating",
        "transition-transform duration-small ease-out-quart",
        hidden && "translate-y-full",
      )}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab);
        const handleClick = () => {
          if (tab.kind === "nav") {
            router.push(tab.href);
          } else {
            tab.onClick();
          }
        };

        return (
          <button
            key={tab.key}
            type="button"
            onClick={handleClick}
            aria-label={t(tab.i18nKey)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5",
              "transition-colors duration-micro ease-out-quart",
              "active:bg-primary/5",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "scale-110")} />
            <span className={cn("text-[10px] font-medium leading-none", active && "font-semibold")}>
              {t(tab.i18nKey)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
