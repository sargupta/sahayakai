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
    <div className="force-light flex flex-col min-h-screen">
      <SignedOutBanner />
      <LandingNav onAuthClick={onAuthClick} />

      {/* Warm stage: a breathing saffron glow, floating Indian-script marks,
          and a fine film-grain overlay — layered behind the content. */}
      <div className="relative flex-1 overflow-hidden bg-[hsl(40_20%_99.5%)]">
        <div className="ambient-glow" aria-hidden />
        <ScriptMarks />
        <div className="ambient-grain" aria-hidden />
        <LandingHero titleIndex={titleIndex} onAuthClick={onAuthClick} />
        <LandingPillarStrip titleIndex={titleIndex} />
        <LandingQuote />
      </div>

      <LandingFooter />
    </div>
  );
}
