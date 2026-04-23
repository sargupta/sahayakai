"use client";

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
 */
export default function HomePage() {
  const { user, loading, openAuthModal } = useAuth();

  // Briefly render nothing while Firebase auth resolves so returning
  // authenticated teachers never see the landing page flash.
  if (loading) return null;

  if (!user) {
    return <LandingPage onAuthClick={openAuthModal} />;
  }

  return <DashboardHome />;
}
