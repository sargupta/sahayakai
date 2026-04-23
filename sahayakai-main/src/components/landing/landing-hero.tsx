"use client";

import { Calendar, Sparkles } from "lucide-react";
import { AnimatedHeadline } from "./animated-headline";

type Props = {
  titleIndex: number;
  onAuthClick: () => void;
};

export function LandingHero({ titleIndex, onAuthClick }: Props) {
  return (
    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-[68px] pb-10">
      {/* Audience badge */}
      <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-7">
        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
        For schools, chains &amp; governments
      </div>

      {/* Headline */}
      <AnimatedHeadline titleIndex={titleIndex} />

      {/* Subhead */}
      <p className="font-body text-[17px] sm:text-[18px] text-neutral-600 leading-[1.55] max-w-[52ch] mt-6 mx-auto">
        Not just a lesson plan generator.{" "}
        <strong className="text-foreground font-semibold">SahayakAI</strong> is the
        professional infrastructure Indian educators never had — in 11 languages, across
        28 state boards, on the cheapest smartphones.
      </p>

      {/* CTA pair */}
      <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center w-full sm:w-auto">
        <button
          type="button"
          onClick={onAuthClick}
          className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
        >
          <Sparkles className="w-[15px] h-[15px]" strokeWidth={2.2} />
          Start free
        </button>
        <a
          href="https://calendly.com/contact-sargvision/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-white/60 backdrop-blur border border-black/15 text-foreground hover:bg-white/90 transition-colors"
        >
          <Calendar className="w-[15px] h-[15px]" strokeWidth={2.2} />
          Book a school demo
        </a>
      </div>

      {/* Quiet government link */}
      <a
        href="mailto:contact@sargvision.com?subject=B2G%20inquiry"
        className="mt-4 text-[13px] font-medium text-neutral-500 hover:text-foreground transition-colors"
      >
        For governments →
      </a>

      {/* Proof strip — 4 flat stats */}
      <div className="flex gap-6 sm:gap-7 mt-8 text-[13px] font-medium text-neutral-600 justify-center flex-wrap items-center">
        <ProofStat value="11" label="Indian languages" />
        <ProofStat value="28" label="state boards" />
        <ProofStat value="2+ hrs" label="saved daily" />
        <ProofStat value="~200 hrs/year" label="per teacher" />
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
