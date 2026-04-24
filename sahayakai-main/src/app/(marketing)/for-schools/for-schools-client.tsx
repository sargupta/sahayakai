"use client";

import { Calendar, MessageCircle, Sparkles } from "lucide-react";
import { useLandingTitleIndex } from "@/hooks/use-landing-title-index";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPillarStrip } from "@/components/landing/landing-pillar-strip";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { useAuth } from "@/context/auth-context";

function getWhatsAppDeepLink(): string {
  const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP?.replace(/\D/g, "");
  if (!phone) return "#book-demo";
  const message = encodeURIComponent(
    "Hi, I saw the SahayakAI for Schools page. I would like a 30-minute demo for our school."
  );
  return `https://wa.me/${phone}?text=${message}`;
}

export function ForSchoolsClient() {
  const titleIndex = useLandingTitleIndex();
  const { openAuthModal } = useAuth();
  const whatsAppLink = getWhatsAppDeepLink();

  return (
    <div className="flex flex-col min-h-screen">
      <LandingNav onAuthClick={openAuthModal} />

      {/* Warm stage: saffron radial glow + ghosted script marks */}
      <div
        className="relative flex-1"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)",
        }}
      >
        <ScriptMarks />

        <ForSchoolsHero whatsAppLink={whatsAppLink} />
        <LandingPillarStrip titleIndex={titleIndex} />
        <PrincipalQuote />
        <DashboardPreview />
        <BookDemoBlock whatsAppLink={whatsAppLink} />
      </div>

      <LandingFooter />
    </div>
  );
}

function ForSchoolsHero({ whatsAppLink }: { whatsAppLink: string }) {
  return (
    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-[68px] pb-10">
      <div className="inline-flex items-center gap-2 text-[12px] font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[14px] py-[6px] mb-7">
        <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
        SahayakAI for Schools
      </div>

      <h1 className="font-headline font-extrabold tracking-tight text-[42px] sm:text-[58px] leading-[1.05] max-w-[22ch] text-foreground">
        The AI your teachers actually use.{" "}
        <span className="italic font-normal text-saffron-700">And the dashboard you actually need.</span>
      </h1>

      <p className="font-body text-[17px] sm:text-[18px] text-neutral-600 leading-[1.55] max-w-[52ch] mt-6 mx-auto">
        Six hours per teacher per week, back in the classroom. Lesson plans, quizzes, worksheets, rubrics &mdash;
        in 11 Indian languages, voice-first, on any Android phone.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center w-full sm:w-auto">
        <a
          href={whatsAppLink}
          target={whatsAppLink.startsWith("http") ? "_blank" : undefined}
          rel={whatsAppLink.startsWith("http") ? "noopener noreferrer" : undefined}
          className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
        >
          <MessageCircle className="w-[15px] h-[15px]" strokeWidth={2.2} />
          Book a 30-minute demo
        </a>
        <a
          href="https://calendly.com/contact-sargvision/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-white/60 backdrop-blur border border-black/15 text-foreground hover:bg-white/90 transition-colors"
        >
          <Calendar className="w-[15px] h-[15px]" strokeWidth={2.2} />
          Schedule a call
        </a>
      </div>

      <p className="mt-4 text-[13px] font-medium text-neutral-500">
        Live with 150 Karnataka teachers since Q4 2025. Now opening to Tier 2 CBSE private schools.
      </p>

      {/* Proof strip */}
      <div className="flex gap-6 sm:gap-7 mt-8 text-[13px] font-medium text-neutral-600 justify-center flex-wrap items-center">
        <ProofStat value="11" label="Indian languages" />
        <ProofStat value="28" label="state boards" />
        <ProofStat value="6 hrs" label="saved per teacher/week" />
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

function PrincipalQuote() {
  return (
    <section className="px-6 sm:px-12 pt-4 pb-12 flex justify-center">
      <figure className="max-w-[720px] w-full bg-white border-l-4 border-saffron-200 rounded-[14px] px-7 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <blockquote className="font-headline font-medium italic text-[18px] leading-[1.55] text-foreground">
          &ldquo;I used to chase teachers for weekly plans over WhatsApp. Now I open one dashboard,
          and see which class got a new quiz, which teacher saved the most time, and where we need
          support. It&rsquo;s the first time I&rsquo;ve felt on top of academics.&rdquo;
        </blockquote>
        <figcaption className="mt-3 text-[12px] font-semibold tracking-wider uppercase text-saffron-700">
          &mdash; Principal, Karnataka Pilot School
        </figcaption>
      </figure>
    </section>
  );
}

function DashboardPreview() {
  const metrics = [
    { label: "Weekly active teachers", value: "22 / 25", note: "+4 vs last week" },
    { label: "Content generated", value: "147", note: "lessons, quizzes, worksheets" },
    { label: "Hours saved", value: "138", note: "across all teachers this week" },
    { label: "Feature adoption", value: "4.2 / 6", note: "average features per teacher" },
  ];

  return (
    <section className="px-6 sm:px-12 pb-16 flex justify-center scroll-mt-24">
      <div className="max-w-[880px] w-full">
        <div className="text-center mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-saffron-700 mb-2">
            Your principal dashboard
          </div>
          <h2 className="font-headline font-extrabold tracking-tight text-[28px] sm:text-[34px] leading-tight text-foreground">
            One view. No spreadsheets. No WhatsApp scrolling.
          </h2>
        </div>

        <div className="rounded-[14px] bg-white border border-black/5 p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400">
                  {m.label}
                </div>
                <div className="font-headline font-extrabold text-[28px] text-foreground">{m.value}</div>
                <div className="text-[12px] text-neutral-500">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-neutral-500 text-center">
          Illustrative sample from a Karnataka pilot school, week 8. Your numbers appear after week one.
        </p>
      </div>
    </section>
  );
}

function BookDemoBlock({ whatsAppLink }: { whatsAppLink: string }) {
  return (
    <section id="book-demo" className="px-6 sm:px-12 pb-20 flex justify-center scroll-mt-24">
      <div className="max-w-[640px] w-full text-center bg-white border border-black/5 rounded-[14px] px-8 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-[12px] py-[5px] mb-5 uppercase tracking-[0.08em]">
          <Sparkles className="w-3 h-3" />
          Talk to the founder
        </div>
        <h2 className="font-headline font-extrabold tracking-tight text-[28px] sm:text-[32px] leading-tight text-foreground">
          Book a 30-minute demo
        </h2>
        <p className="mt-3 text-[15px] text-neutral-600 leading-[1.55] max-w-[46ch] mx-auto">
          We come to you, bring the data, and show one of your own teachers using the product.
          No sales deck.
        </p>
        <div className="mt-6">
          <a
            href={whatsAppLink}
            target={whatsAppLink.startsWith("http") ? "_blank" : undefined}
            rel={whatsAppLink.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex items-center justify-center gap-2 text-[14px] font-medium px-[22px] py-[13px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-[15px] h-[15px]" strokeWidth={2.2} />
            WhatsApp us
          </a>
        </div>
        <p className="mt-4 text-[12px] text-neutral-500">
          Currently booking demos in Karnataka: Mysuru, Hubballi, Mangaluru, Belagavi, Shivamogga.
        </p>
      </div>
    </section>
  );
}
