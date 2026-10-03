"use client";

import { Calendar, Sparkles } from "lucide-react";
import { AnimatedHeadline } from "./animated-headline";
import { LandingVoiceOrb } from "./landing-voice-orb";
import { useLanguage } from "@/context/language-context";

type Props = {
  titleIndex: number;
  onAuthClick: () => void;
};

export function LandingHero({ titleIndex, onAuthClick }: Props) {
  const { t } = useLanguage();

  return (
    <section className="relative z-10 px-4 sm:px-6 pt-8 sm:pt-12 pb-12 lg:pb-16">
      {/* One centred composition: marketing frames VIDYA, VIDYA is the
          interactive presence at its heart. */}
      <div className="container-wide flex flex-col items-center text-center">
        {/* Audience badge */}
        <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
          {t("For schools, chains & governments")}
        </div>

        {/* Headline — the shared rotating pillar headline (same phrases,
            timing and spring as before). Sized so the longest phrase stays on
            one line at every breakpoint. */}
        <AnimatedHeadline
          titleIndex={titleIndex}
          align="center"
          className="text-[32px] leading-[1.06] sm:text-[48px] lg:text-[56px]"
        />

        {/* VIDYA — the single voice entry point on the homepage, centre stage */}
        <div className="relative mt-2 flex w-full justify-center sm:mt-4">
          <LandingVoiceOrb />
        </div>

        {/* Subhead */}
        <p className="font-body text-[16px] sm:text-[17px] text-neutral-600 leading-[1.6] max-w-[58ch] mt-6 mx-auto">
          {t("SahayakAI is the AI co-teacher for Indian educators — plan lessons, create assessments, connect with parents, and save time in 11 languages across 28 state boards.")}
        </p>

        {/* CTA pair */}
        <div className="flex flex-col sm:flex-row gap-3 mt-7 justify-center w-full sm:w-auto">
          <button
            type="button"
            onClick={onAuthClick}
            className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
          >
            <Sparkles className="w-[15px] h-[15px]" strokeWidth={2.2} />
            {t("Start free")}
          </button>
          <a
            href="https://calendly.com/contact-sargvision/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-white/60 backdrop-blur border border-black/15 text-foreground hover:bg-white/90 transition-colors"
          >
            <Calendar className="w-[15px] h-[15px]" strokeWidth={2.2} />
            {t("Book a school demo")}
          </a>
        </div>

        {/* Quiet government link */}
        <a
          href="mailto:contact@sargvision.com?subject=B2G%20inquiry"
          className="mt-4 text-[13px] font-medium text-neutral-500 hover:text-foreground transition-colors"
        >
          {t("For governments →")}
        </a>

        {/* Proof strip — 4 flat stats */}
        <div className="flex gap-6 sm:gap-7 mt-8 text-[13px] font-medium text-neutral-600 justify-center flex-wrap items-center">
          <ProofStat value="11" label={t("Indian languages")} />
          <ProofStat value="28" label={t("state boards")} />
          <ProofStat value={t("2+ hrs")} label={t("saved daily")} />
          <ProofStat value={t("~200 hrs/year")} label={t("per teacher")} />
        </div>
      </div>
    </section>
  );
}

function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-saffron flex-none" />
      <strong className="text-foreground font-bold">{value}</strong>
      <span>{label}</span>
    </span>
  );
}