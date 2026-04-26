"use client";

import { motion } from "motion/react";
import { pillars } from "./pillar-data";
import { useLanguage } from "@/context/language-context";

type Props = {
  titleIndex: number;
};

export function LandingPillarStrip({ titleIndex }: Props) {
  const { t } = useLanguage();
  return (
    <section id="product" className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center scroll-mt-24">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 max-w-[880px] w-full">
        {pillars.map((pillar, i) => {
          const active = i === titleIndex;
          const Icon = pillar.Icon;
          return (
            <motion.div
              key={pillar.number}
              initial={false}
              animate={{
                y: active ? -4 : 0,
                opacity: active ? 1 : 0.55,
              }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className={`p-[14px] pr-3 rounded-[14px] border flex flex-col gap-2 items-start transition-colors duration-500 ${
                active
                  ? "bg-gradient-to-br from-saffron to-saffron-600 border-transparent text-white shadow-[0_20px_38px_-16px_hsl(28_70%_42%/0.5)]"
                  : "bg-white border-black/5"
              }`}
            >
              <div
                className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-colors duration-500 ${
                  active
                    ? "bg-white/25 text-white"
                    : "bg-saffron-50 text-saffron-700"
                }`}
              >
                <Icon className="w-[15px] h-[15px]" strokeWidth={2.2} />
              </div>
              <div
                className={`text-[9px] font-bold uppercase tracking-[0.08em] ${
                  active ? "text-white/85" : "text-neutral-400"
                }`}
              >
                {pillar.number}
              </div>
              <div
                className={`font-headline font-semibold text-[13px] leading-tight ${
                  active ? "text-white" : "text-foreground"
                }`}
              >
                {t(`pillar.${pillar.id}.name`)}
              </div>
              <div
                className={`text-[10px] leading-[1.4] ${
                  active ? "text-white/85" : "text-neutral-500"
                }`}
              >
                {t(`pillar.${pillar.id}.desc`)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
