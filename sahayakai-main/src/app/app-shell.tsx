"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/auth/auth-button";
import { GlobalHooks } from "@/components/global-hooks";
import { OmniOrb } from "@/components/omni-orb";
import { MotherTongueGreeting } from "@/components/mother-tongue-greeting";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { CommandPalette, openCommandPalette } from "@/components/command-palette";
import { LanguagePill } from "@/components/language-pill";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Search } from "lucide-react";
import { useLanguage } from "@/context/language-context";

const MARKETING_PATHS = ["/for-schools", "/pricing", "/privacy-for-teachers", "/terms", "/about"];

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Routes the visitor through one of two layouts:
 *
 * 1. Landing layout — (a) cold visitor on `/`, OR (b) any visitor (auth state
 *    agnostic) on a /(marketing) surface. Renders children directly with no
 *    sidebar / header / global app chrome. Marketing pages bring their own nav
 *    and footer (LandingNav / LandingFooter composition).
 *
 * 2. App layout — every other case. Renders the existing SidebarProvider +
 *    AppSidebar + header + main wrapper, plus the global OmniOrb / GlobalHooks /
 *    MotherTongueGreeting.
 *
 * <AuthDialog /> stays at the layout level OUTSIDE this shell so it can be
 * opened by both layouts (the landing page CTAs need it).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isMarketing = isMarketingPath(pathname);

  // On the home route, wait for auth to resolve before deciding which layout
  // to render. This prevents a landing-page flash for returning authenticated
  // teachers and a dashboard-chrome flash for cold visitors.
  if (isHome && loading) return null;

  // Cold visitor on the home route OR any visitor on a marketing surface
  // → landing layout, no app chrome. Marketing pages always stay chrome-free
  // regardless of auth state since they are for cold buyers and sales demos.
  if ((isHome && !user) || isMarketing) {
    return (
      <>
        {children}
        <PWAInstallPrompt />
      </>
    );
  }

  // All other cases → existing app chrome (mirrors what main's layout.tsx had).
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="md:hidden">
                <Logo />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search trigger — opens command palette (⌘K on desktop) */}
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t("Search")}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-pill bg-muted/60 hover:bg-muted text-muted-foreground transition-colors duration-micro ease-out-quart"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-medium">{t("Search")}</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-surface-sm bg-background text-[10px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <LanguagePill />
              <AuthButton />
            </div>
          </header>
          <main className="flex min-h-[calc(100vh-3.5rem)] w-full max-w-[100vw] overflow-x-hidden flex-col items-center p-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8 md:pb-32">
            <ErrorBoundary>
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Global hooks / orb / greeting / command palette / mobile nav render
          only inside the app shell. Palette binds ⌘K + ctrl+K globally.
          Bottom nav is md:hidden and sits below the OmniOrb (orb repositioned
          to clear it on mobile). */}
      <GlobalHooks />
      <OmniOrb />
      <MotherTongueGreeting />
      <CommandPalette />
      <MobileBottomNav />
      <PWAInstallPrompt />
    </>
  );
}
