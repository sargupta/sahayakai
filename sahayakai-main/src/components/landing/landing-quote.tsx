"use client";

import { useLanguage } from "@/context/language-context";

export function LandingQuote() {
  const { t } = useLanguage();
  return (
    <section id="schools" className="px-6 sm:px-12 pb-20 flex justify-center scroll-mt-24">
      <figure className="max-w-[720px] w-full bg-white border-l-4 border-saffron-200 rounded-[14px] px-7 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <blockquote className="font-headline font-medium italic text-[18px] leading-[1.55] text-foreground">
          {t("quote.lakshmi.body")}
        </blockquote>
        <figcaption className="mt-3 text-[12px] font-semibold tracking-wider uppercase text-saffron-700">
          {t("quote.lakshmi.attribution")}
        </figcaption>
      </figure>
    </section>
  );
}
