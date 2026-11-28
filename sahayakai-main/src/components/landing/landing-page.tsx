"use client";

import { HomePage } from "./home/home-page";
import { SignedOutBanner } from "./signed-out-banner";

type Props = {
  onAuthClick: () => void;
};

/**
 * The signed-out homepage: the founder-approved "Homepage v1" design
 * (founder decision, 2026-11-27: v1 goes to production). /for-schools keeps
 * the decision-maker savings story; the homepage calculator reads the same
 * model (src/lib/school-pricing.ts), so the two pages can never disagree.
 */
export function LandingPage({ onAuthClick }: Props) {
  return (
    <>
      <SignedOutBanner />
      <HomePage onAuthClick={onAuthClick} />
    </>
  );
}
