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
import dynamic from "next/dynamic";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { LabsBanner } from "@/components/labs/labs-banner";
import { Search } from "lucide-react";
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
  // GlobalVoiceInterface is shown on the home landing page for voice input
  // from unauthenticated visitors (stores transcript for post-auth submission).
  if ((isHome && !user) || isMarketing) {
    return (
      <>
        {children}
        <PWAInstallPrompt />
        <GlobalVoiceInterface />
      </>
    );
  }

  // All other cases → existing app chrome (mirrors what main's layout.tsx had).
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Phone budget (320px): menu + logo mark on the left, four 36–40px
              controls on the right. Below `sm` the logo goes compact, search
              and language become icon squares, and the controls never shrink.
              The logo slot is `w-0 flex-1` below `sm`: it fills whatever is
              left and contributes 0 to the header's min-content width.
              (min-w-0 alone is not enough — SidebarInset is a flex item with
              min-width:auto, so it grows to the header's min-content, which
              still counted the full wordmark; CI fonts made that 363px at
              360px.) So the logo can only truncate, never widen the page.
              The sign-in label waits for `md` (AuthButton). From `md` up the
              classes resolve to the original desktop layout; the gap stops at
              `md` because at 768px, beside the 256px sidebar, the header has
              only ~2px to spare. Guarded by qa/e2e/phone-overflow.spec.ts. */}
          <header
            data-testid="app-header"
            className="flex h-14 items-center justify-between gap-2 md:gap-0 border-b bg-background px-3 sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-2 max-sm:flex-1 sm:gap-4">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0 max-sm:w-0 max-sm:flex-1 md:hidden">
                <Logo compact />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              {/* Search trigger — opens command palette (⌘K on desktop) */}
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t("Search")}
                className="inline-flex items-center justify-center gap-2 h-9 w-9 sm:w-auto sm:px-3 rounded-pill bg-muted/60 hover:bg-muted text-muted-foreground transition-colors duration-micro ease-out-quart"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-medium">{t("Search")}</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-surface-sm bg-background text-[10px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <ThemeToggle />
              <LanguagePill />
              <AuthButton />
            </div>
          </header>
          <main className="flex min-h-[calc(100vh-3.5rem)] w-full max-w-[100vw] overflow-x-hidden flex-col items-center p-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8 md:pb-32">
            {/* Self-hides on non-Labs routes; parked pages need no edits. */}
            <LabsBanner />
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
      <TamilKeyboard />
      <MotherTongueGreeting />
      <CommandPalette />
      <MobileBottomNav />
      <PWAInstallPrompt />
      <VoiceQuotaToastListener />
    </>
  );
}
