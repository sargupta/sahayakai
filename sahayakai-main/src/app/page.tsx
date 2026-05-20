"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { LandingPage } from "@/components/landing/landing-page";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

/**
 * Auth-conditional homepage.
 *
 * - Cold visitors (school admins, chains, governments, organic teachers): see
 *   <LandingPage /> — the B2B marketing page with the rotating 6-pillar
 *   headline, CTAs, proof strip, and Lakshmi/Raichur quote.
 * - Authenticated teachers: see <DashboardHome /> — the existing Namaste
 *   dashboard with voice input, quick actions, suggestions, and onboarding.
 *
 * Single URL (`/`) for both audiences. Auth-sticky via Firebase cookie:
 * returning teachers go straight to the dashboard without ever flashing the
 * landing page.
 *
 * Sidebar visibility is handled in the root layout via <AppShell />.
 *
 * **Phase U.zeta — landing-flash bug fix.** On mobile sign-in via
 * `signInWithRedirect`, the page reloads after the OAuth round-trip. For
 * 200-800 ms the Firebase SDK reports `loading=false, user=null` while
 * `getRedirectResult()` is still hydrating in `auth-context`. The previous
 * code rendered <LandingPage /> in that window, so a teacher who'd JUST
 * signed in saw the marketing page flash and assumed sign-in had failed
 * or routed them somewhere wrong.
 *
 * Fix: detect a pending-sign-in flag in sessionStorage (set by
 * `signInWithGoogle` before it calls `signInWithRedirect`). When present,
 * suppress LandingPage and render blank until auth-context completes the
 * redirect handler and routes to /onboarding or /. The flag is cleared
 * inside `consumePendingSignIn()` so it never sticks.
 */
// MUST match `PENDING_KEY` in `src/lib/sign-in-with-google.ts:67`.
// If you rename it there, rename it here too — the flash-suppression
// only fires when the keys match.
const PENDING_SIGN_IN_KEY = "sahayakai-pending-signin-flow";

function hasPendingSignIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PENDING_SIGN_IN_KEY) !== null;
  } catch {
    return false;
  }
}

export default function HomePage() {
  const { user, loading, openAuthModal } = useAuth();

  // Hydration: avoid SSR/CSR mismatch on the pending flag — only check
  // once on the client after first paint.
  const [pendingChecked, setPendingChecked] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setPending(hasPendingSignIn());
    setPendingChecked(true);
  }, []);

  // Belt-and-braces: if the pending flag is still set but Firebase auth
  // didn't deliver a user within 5 seconds (iOS Safari ITP, third-party
  // cookie block, or any silent getRedirectResult failure), force-clear
  // the flag so the landing page renders instead of a permanent blank.
  // The primary fix is in sign-in-with-google.ts (clear on null result)
  // but this guard catches any future regression or edge case where the
  // sessionStorage flag outlives the auth attempt.
  useEffect(() => {
    if (!pending || user) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.removeItem(PENDING_SIGN_IN_KEY);
      } catch {
        // ignore — storage access can throw in incognito/locked-down browsers
      }
      setPending(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [pending, user]);

  // Briefly render nothing while Firebase auth resolves so returning
  // authenticated teachers never see the landing page flash. Also cover
  // the post-redirect window when `loading=false, user=null` is a lie.
  if (loading || !pendingChecked) return null;
  if (pending && !user) return null;

  if (!user) {
    return <LandingPage onAuthClick={openAuthModal} />;
  }

  return <DashboardHome />;
}
