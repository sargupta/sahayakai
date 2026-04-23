"use client";

import { useLandingTitleIndex } from "@/hooks/use-landing-title-index";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingPillarStrip } from "./landing-pillar-strip";
import { LandingQuote } from "./landing-quote";
import { LandingFooter } from "./landing-footer";
import { ScriptMarks } from "./script-marks";
import { SignedOutBanner } from "./signed-out-banner";

type Props = {
  onAuthClick: () => void;
};

export function LandingPage({ onAuthClick }: Props) {
  const titleIndex = useLandingTitleIndex();

  return (
    <div className="flex flex-col min-h-screen">
      <SignedOutBanner />
      <LandingNav onAuthClick={onAuthClick} />

      {/* Warm stage: saffron radial glow + ghosted Indian-script marks */}
      <div
        className="relative flex-1"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)",
        }}
      >
        <ScriptMarks />
        <LandingHero titleIndex={titleIndex} onAuthClick={onAuthClick} />
        <LandingPillarStrip titleIndex={titleIndex} />
        <LandingQuote />
      </div>

      <LandingFooter />
    </div>
  );
}
