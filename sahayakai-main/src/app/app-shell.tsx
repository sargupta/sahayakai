"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import dynamic from "next/dynamic";
import { Menu, Search } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthButton } from "@/components/auth/auth-button";
import { GlobalHooks } from "@/components/global-hooks";
// OmniOrb (VIDYA) is a ~924-line floating widget with speech + jarvis-store +
// action machinery. It is NOT needed for first paint, so we load it client-side
// AFTER the page is interactive. This strips it (and its deps) out of the
// initial bundle — the home page renders and reacts sooner, and VIDYA snaps in
// a beat later. Its action/prefill contracts are unchanged. (perf, 2026-07-05)
const OmniOrb = dynamic(() => import("@/components/omni-orb").then((m) => m.OmniOrb), {
  ssr: false,
  loading: () => null,
});
import { TamilKeyboard } from "@/components/tamil-keyboard";
import { MotherTongueGreeting } from "@/components/mother-tongue-greeting";
import { VoiceQuotaToastListener } from "@/components/voice-quota-toast-listener";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { CommandPalette, openCommandPalette } from "@/components/command-palette";
import { LanguagePill } from "@/components/language-pill";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { LabsBanner } from "@/components/labs/labs-banner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SahayakWordmark } from "@/components/shell/brand";
import { useCollapsedNav } from "@/components/shell/use-collapsed";
import { useLanguage } from "@/context/language-context";
// GlobalVoiceInterface (voice input for unauthenticated visitors) is loaded
// client-side only on the landing page to avoid adding its dependencies to
// the initial bundle unnecessarily. Its action/prefill contracts are unchanged.
const GlobalVoiceInterface = dynamic(() => import("@/components/global-voice-interface").then((m) => m.GlobalVoiceInterface), {
  ssr: false,
  loading: () => null,
});

const MARKETING_PATHS = ["/for-schools", "/pricing", "/school-pricing", "/privacy-for-teachers", "/terms", "/about"];

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Routes the visitor through one of three layouts:
 *
 * 1. SamparkAI — anything under the `sampark` route segment. Detected from
 *    the route tree, not the URL, so it also holds on a SamparkAI host where
 *    the middleware rewrites `/x` to `/sampark/x`. SamparkAI brings its own
 *    chrome (src/app/sampark/…): the public site, or the workspace shell.
 *    None of SahayakAI's teacher chrome (sidebar, VIDYA orb, greeting,
 *    command palette) renders there.
 *
 * 2. Landing layout — (a) cold visitor on `/`, OR (b) any visitor (auth state
 *    agnostic) on a /(marketing) surface. Renders children directly with no
 *    sidebar / header / global app chrome.
 *
 * 3. App layout — every other case: the SahayakAI SideRail (rail 768–1023px,
 *    sidebar from 1024px), the TopBar, the content, and on phones the
 *    TabBar capsule plus a menu sheet with the full sidebar.
 *
 * <AuthDialog /> stays at the layout level OUTSIDE this shell so it can be
 * opened by every layout (the landing page CTAs need it).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useCollapsedNav("sahayak.sidebar.folded");
  const isHome = pathname === "/";
  const isMarketing = isMarketingPath(pathname);

  // The floating VIDYA orb sits above every layer (z-90); while the phone
  // menu sheet is open it hides (globals.css), without unmounting a voice
  // session in progress.
  useEffect(() => {
    document.body.toggleAttribute("data-nav-sheet-open", menuOpen);
    return () => document.body.removeAttribute("data-nav-sheet-open");
  }, [menuOpen]);

  if (segment === "sampark") {
    return <>{children}</>;
  }

  // On the home route, wait for auth to resolve before deciding which layout
  // to render. This prevents a landing-page flash for returning authenticated
  // teachers and a dashboard-chrome flash for cold visitors.
  if (isHome && loading) return null;

  if ((isHome && !user) || isMarketing) {
    return (
      <>
        {children}
        <PWAInstallPrompt />
        <GlobalVoiceInterface />
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-svh w-full bg-wash-screen">
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-hairline bg-surface-chrome px-3 md:h-topbar md:px-6">
            {/* Phone: menu + wordmark. Tablet/desktop: search. */}
            <div className="flex min-w-0 items-center gap-1 md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t("Open menu")}
                aria-expanded={menuOpen}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink-600 hover:bg-tint-subtle hover:text-ink-900"
              >
                <Menu aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
              </button>
              <Link href="/" className="focus-ring flex min-h-11 items-center rounded-pill px-1">
                <SahayakWordmark />
              </Link>
            </div>
            <button
              type="button"
              onClick={openCommandPalette}
              className="focus-ring hidden h-11 w-full max-w-sm items-center gap-2 rounded-pill border border-line-glass bg-surface-glass px-4 text-left text-ink-500 transition-colors duration-small ease-standard hover:bg-surface-glass-strong hover:text-ink-600 md:inline-flex"
            >
              <Search aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-tile">{t("Search tools and your work")}</span>
              <kbd className="rounded-xs bg-tint-quiet px-1.5 py-0.5 text-xs font-medium text-ink-500">⌘K</kbd>
            </button>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t("Search")}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink-600 hover:bg-tint-subtle hover:text-ink-900 md:hidden"
              >
                <Search aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
              </button>
              <LanguagePill />
              <AuthButton />
            </div>
          </header>

          <main className="flex w-full max-w-full flex-1 flex-col items-center overflow-x-hidden px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 sm:px-4 md:px-8 md:pb-24 md:pt-8">
            {/* Self-hides on non-Labs routes; parked pages need no edits. */}
            <LabsBanner />
            <ErrorBoundary>
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Phone: the full sidebar in a sheet from the left. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[min(320px,88vw)] border-r border-line-hairline bg-milk-50 p-0 md:hidden">
          <SheetTitle className="sr-only">{t("Menu")}</SheetTitle>
          <AppSidebar forceFull onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Global hooks / orb / greeting / command palette / phone tab bar
          render only inside the app shell. Palette binds ⌘K + ctrl+K. */}
      <GlobalHooks />
      <OmniOrb />
      <TamilKeyboard />
      <MotherTongueGreeting />
      <CommandPalette />
      <MobileBottomNav />
      <PWAInstallPrompt />
      <VoiceQuotaToastListener />
    </>
  );
}
