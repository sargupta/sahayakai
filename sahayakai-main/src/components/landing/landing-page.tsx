"use client";

import { SchoolsStory } from "@/app/(marketing)/for-schools/for-schools-client";
import { LandingNav } from "./landing-nav";
import { LandingFooter } from "./landing-footer";
import { SignedOutBanner } from "./signed-out-banner";

type Props = {
  onAuthClick: () => void;
};

/**
 * The signed-out homepage. It shows the same story as /for-schools
 * (founder decision, 2026-11-27: the page people land on is the new design,
 * not a separate older one), so the two addresses can never disagree.
 */
export function LandingPage({ onAuthClick }: Props) {
  return (
    <div className="force-light flex flex-col min-h-screen bg-milk-50">
      <SignedOutBanner />
      <LandingNav onAuthClick={onAuthClick} />
      <SchoolsStory />
      <LandingFooter />
    </div>
  );
}
