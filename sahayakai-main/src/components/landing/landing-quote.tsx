"use client";

import { useLanguage } from "@/context/language-context";

// English source copy. Locales translate these under the same keys in
// src/locales/*.json; English has no dictionary, so t() returns the raw
// key on a miss — fall back to the English string when that happens.
const EN = {
  "quote.lakshmi.body":
    "“I knew what to teach but couldn't write it in English reports. Now I just speak in Kannada, and it creates the plan for me.”",
  "quote.lakshmi.attribution": "— Lakshmi, Teacher, Raichur District",
} as const;

export function LandingQuote() {
  const { t } = useLanguage();
  const tr = (key: keyof typeof EN) => {
    const v = t(key);
    return v === key ? EN[key] : v;
  };
  return (
    <section id="schools" className="px-6 sm:px-12 pb-20 flex justify-center scroll-mt-24">
      <figure className="max-w-[720px] w-full bg-white border-l-4 border-saffron-200 rounded-[14px] px-7 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <blockquote className="font-headline font-medium italic text-[18px] leading-[1.55] text-foreground">
          {tr("quote.lakshmi.body")}
        </blockquote>
        <figcaption className="mt-3 text-[12px] font-semibold tracking-wider uppercase text-saffron-700">
          {tr("quote.lakshmi.attribution")}
        </figcaption>
      </figure>
    </section>
  );
}
