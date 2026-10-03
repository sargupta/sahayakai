"use client";

import { ArrowUpRight, FileCheck2, NotebookPen, PhoneCall, Users } from "lucide-react";
import { pillars, pillarText } from "./pillar-data";
import { useLanguage } from "@/context/language-context";

/**
 * Feature grid — presents the four flagship, REAL SahayakAI workflows as
 * elegant cards arranged along a teacher's day: before class (Prep Desk),
 * after class (Assess), after school (Parent Hotline), and every day
 * (Staffroom). Prep Desk, Parent Hotline and Staffroom reuse the already-
 * translated pillar copy; Assess is a custom card with its own dictionary
 * strings. Every card links to a shipped route. Keeps `id="product"` so the
 * nav "Product → /#product" anchor still lands here.
 */
export function LandingFeatures() {
  const { t } = useLanguage();

  const features = [
    {
      key: "prep-desk",
      Icon: NotebookPen,
      kicker: t("Before class"),
      title: pillarText(t, pillars[0], "name"),
      desc: pillarText(t, pillars[0], "desc"),
      href: "/lesson-plan",
    },
    {
      key: "assess",
      Icon: FileCheck2,
      kicker: t("After class"),
      title: t("Assess"),
      desc: t("Rubric-based AI grading for homework, papers and worksheets"),
      href: "/assess-assignment",
    },
    {
      key: "parent-hotline",
      Icon: PhoneCall,
      kicker: t("After school"),
      title: pillarText(t, pillars[2], "name"),
      desc: pillarText(t, pillars[2], "desc"),
      href: "/try-call",
    },
    {
      key: "staffroom",
      Icon: Users,
      kicker: t("Every day"),
      title: pillarText(t, pillars[3], "name"),
      desc: pillarText(t, pillars[3], "desc"),
      href: "/community",
    },
  ] as const;

  return (
    <section id="product" className="relative z-10 px-6 sm:px-12 py-16 scroll-mt-24">
      <div className="container-wide">
        <div className="text-center max-w-[36ch] mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
            {t("A teacher's day")}
          </div>
          <h2 className="font-headline font-bold text-[30px] sm:text-[38px] leading-[1.1] tracking-tight text-foreground">
            {t("One professional infrastructure for the entire school day")}
          </h2>
          <p className="font-body text-[15px] sm:text-[16px] text-neutral-600 leading-[1.6] mt-4">
            {t("Built for Indian classrooms — voice-first, offline-capable, on the cheapest smartphones.")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[980px] lg:mx-auto">
          {features.map((f) => {
            const Icon = f.Icon;
            return (
              <a
                key={f.key}
                href={f.href}
                aria-label={`${f.title} — ${f.desc}`}
                className="group flex flex-col gap-4 rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_2px_-1px_hsl(28_30%_30%/0.08),0_10px_24px_-10px_hsl(28_45%_38%/0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:border-saffron-200 hover:shadow-[0_2px_4px_-1px_hsl(28_30%_30%/0.10),0_18px_36px_-14px_hsl(28_45%_38%/0.28)]"
              >
                <div className="w-[44px] h-[44px] rounded-2xl bg-saffron-50 text-saffron-700 flex items-center justify-center group-hover:bg-saffron group-hover:text-white transition-colors">
                  <Icon className="w-[20px] h-[20px]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-saffron-600">
                    {f.kicker}
                  </p>
                  <h3 className="font-headline font-semibold text-[17px] leading-tight text-foreground mt-1">
                    {f.title}
                  </h3>
                  <p className="font-body text-[13px] leading-[1.5] text-neutral-500 mt-1.5">
                    {f.desc}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-saffron-700 mt-auto">
                  {t("Open")}
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}