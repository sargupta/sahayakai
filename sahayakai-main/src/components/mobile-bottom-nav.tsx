"use client";

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
