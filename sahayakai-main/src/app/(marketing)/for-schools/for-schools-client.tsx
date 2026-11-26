"use client";

import { useMemo, useState } from "react";
import { Calendar, MessageCircle } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import {
  SAVINGS_CAPABILITIES,
  SAVINGS_HOURS_PER_TEACHER_YEAR,
  SAVINGS_MODEL,
  SAVINGS_WEEKLY_HOURS,
  SCHOOL_PRICING,
  estimateSchoolSavings,
} from "@/lib/school-pricing";

/**
 * /for-schools — the page for the person who approves the spend (principal,
 * trust, school owner). It leads with the two figures that person decides on,
 * hours and rupees per year, and it computes both from the visitor's own
 * inputs with the founder-approved savings model in src/lib/school-pricing.ts.
 *
 * Every figure on this page comes from that module. Do not type an hours or
 * price number into the markup: src/__tests__/landing/
 * time-saved-claims-consistent.test.ts fails the build if one appears.
 *
 * The figures are estimates and are labelled as estimates. There is no
 * testimonial and no usage claim here: the design system allows neither
 * without signed consent and measured data (guide "The website").
 *
 * No floating controls on this page (no PageAudio, no mic): a fixed button
 * sits on top of the figures on a phone, which is what the founder reported
 * on the homepage on 2026-11-26.
 */

const CALENDLY_URL = "https://calendly.com/contact-sargvision/30min";
const SCEPTICAL_REALISATION = 0.5;

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

/** ₹ in the units an Indian school budget is read in: lakh and crore. */
function inrCompact(n: number, t: (key: string) => string): string {
  const v = Math.round(n);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${t("{n} crore").replace("{n}", (v / 1e7).toFixed(2))}`;
  if (abs >= 1e5) return `₹${t("{n} lakh").replace("{n}", (v / 1e5).toFixed(1))}`;
  return `₹${inr(v)}`;
}

function getWhatsAppDeepLink(): string {
  const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP?.replace(/\D/g, "");
  if (!phone) return CALENDLY_URL;
  const message = encodeURIComponent(
    "Hi, I saw the SahayakAI for Schools page. I would like a 30-minute demo for our school."
  );
  return `https://wa.me/${phone}?text=${message}`;
}

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.16em] text-saffron-700";
const H2 = "font-headline font-bold tracking-tight text-web-h2 text-ink-900 max-w-[22ch]";
const LEAD = "text-base leading-[1.66] text-ink-600 max-w-[62ch]";
const SECTION = "container-wide py-16 sm:py-[88px] flex flex-col gap-9";
const PRIMARY_CTA =
  "inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-saffron-600 text-white shadow-elevated hover:bg-saffron-700 transition-colors";
const OUTLINE_CTA =
  "inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-card border border-border text-ink-900 hover:bg-milk-300 transition-colors";

export function ForSchoolsClient() {
  const { openAuthModal } = useAuth();
  const whatsAppLink = getWhatsAppDeepLink();

  return (
    <div className="flex flex-col min-h-screen bg-milk-200">
      <LandingNav onAuthClick={openAuthModal} />
      <main>
        <HeroWithCalculator demoHref={whatsAppLink} />
        <HoursBreakdown />
        <Oversight />
        <HowToStart />
        <ClosingBand demoHref={whatsAppLink} />
      </main>
      <LandingFooter />
    </div>
  );
}

function DemoLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function HeroWithCalculator({ demoHref }: { demoHref: string }) {
  const { t } = useLanguage();
  return (
    <section className="container-wide pt-12 sm:pt-[72px] pb-16 sm:pb-[84px] grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-14 items-start">
      <div className="flex flex-col gap-6 min-w-0">
        <div className="self-start inline-flex items-center gap-2 text-tile font-medium text-ink-600 bg-card border border-border rounded-full px-[14px] py-[7px]">
          <span className="w-1.5 h-1.5 rounded-full bg-leaf-500" aria-hidden />
          {t("For principals, trusts and school owners")}
        </div>

        <h1 className="font-headline font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-ink-900">
          {t("Your teachers' time is your largest cost.")}{" "}
          <span className="text-saffron-600">{t("See how much of it comes back.")}</span>
        </h1>

        <p className="text-base sm:text-web-lead text-ink-600 max-w-[54ch]">
          {t("SahayakAI takes lesson planning, grading, worksheets and parent calls off each teacher's desk. Enter your school's numbers and see the hours and rupees returned each year, with every assumption shown.")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <DemoLink href={demoHref} className={PRIMARY_CTA}>
            <MessageCircle className="w-4 h-4" strokeWidth={2.2} aria-hidden />
            {t("Book a 30-minute demo")}
          </DemoLink>
          <a href="#hours" className={OUTLINE_CTA}>
            {t("See how the estimate is built")}
          </a>
        </div>

        <dl className="mt-2 pt-4 border-t border-border grid grid-cols-3 gap-4">
          <Fact value={`${SAVINGS_HOURS_PER_TEACHER_YEAR} ${t("hrs")}`} label={t("estimated per teacher, per year")} />
          <Fact value={`₹${inr(SCHOOL_PRICING.annualPerTeacher)}`} label={t("per teacher, per year")} />
          <Fact value="11" label={t("Indian languages")} />
        </dl>
      </div>

      <SavingsCalculator />
    </section>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-headline font-bold text-page-title sm:text-metric text-ink-900">{value}</dt>
      <dd className="mt-1 text-tile text-ink-600">{label}</dd>
    </div>
  );
}

function SavingsCalculator() {
  const [teachers, setTeachers] = useState(50);
  const [salary, setSalary] = useState(30000);
  const [sceptical, setSceptical] = useState(false);
  const { t } = useLanguage();

  const s = useMemo(
    () =>
      estimateSchoolSavings({
        teachers,
        salaryPerMonth: salary,
        realisation: sceptical ? SCEPTICAL_REALISATION : 1,
      }),
    [teachers, salary, sceptical]
  );

  return (
    <div
      id="savings"
      className="min-w-0 scroll-mt-28 rounded-surface-lg bg-card border border-border shadow-elevated p-6 sm:p-7 flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <div className={EYEBROW}>{t("Your school, per year")}</div>
        <h2 className="font-headline font-semibold text-page-title text-ink-900">{t("Savings estimate")}</h2>
      </div>

      <div className="flex flex-col gap-3">
        <Slider
          id="fs-teachers"
          label={t("Teachers")}
          display={inr(teachers)}
          min={10}
          max={300}
          step={5}
          value={teachers}
          onChange={setTeachers}
        />
        <Slider
          id="fs-salary"
          label={t("Average teacher salary, per month")}
          display={`₹${inr(salary)}`}
          min={15000}
          max={80000}
          step={1000}
          value={salary}
          onChange={setSalary}
        />
      </div>

      <div className="rounded-surface-md bg-milk-300 border border-border px-5 py-[18px]" aria-live="polite">
        <div className="text-tile text-ink-600">{t("Net saving after SahayakAI's fee")}</div>
        <div className="mt-1 font-headline font-bold tracking-tight text-4xl sm:text-5xl text-leaf-700">
          {inrCompact(s.netSavingsPerYear, t)}
        </div>
        <div className="mt-1 text-sm text-ink-600">
          {t("₹{roi} of teacher time back for every ₹1 spent").replace("{roi}", s.roiMultiple.toFixed(1))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Result value={inr(s.hoursReclaimedSchool)} label={t("teacher hours returned")} />
        <Result value={s.fteEquivalent.toFixed(1)} label={t("full-time teachers' worth of time")} />
        <Result value={inrCompact(s.valueSchoolPerYear, t)} label={t("value of that time")} />
        <Result value={inrCompact(s.sahayakaiCostPerYear, t)} label={t("SahayakAI fee, before GST")} />
      </dl>

      <p className="pt-4 border-t border-border text-sm text-ink-900">
        {t("Each month you wait is about {amount} of teacher time spent on work SahayakAI can do.").replace(
          "{amount}",
          inrCompact(s.valueSchoolPerYear / 12, t)
        )}
      </p>

      <label className="flex items-center gap-3 min-h-[44px] text-sm text-ink-900 cursor-pointer">
        <input
          type="checkbox"
          checked={sceptical}
          onChange={(e) => setSceptical(e.target.checked)}
          className="h-5 w-5 accent-saffron-600"
        />
        {t("Be sceptical: assume only half the hours are saved")}
      </label>

      <p className="text-xs leading-[1.5] text-ink-500">
        {t("An estimate from your inputs, not a measured result. Based on {weekly} hours a week across {tools} tools, over {weeks} teaching weeks, valued at salary ÷ {paid} paid hours a month.")
          .replace("{weekly}", SAVINGS_WEEKLY_HOURS.toFixed(1))
          .replace("{tools}", String(SAVINGS_CAPABILITIES.length))
          .replace("{weeks}", String(SAVINGS_MODEL.weeksPerYear))
          .replace("{paid}", String(SAVINGS_MODEL.paidHoursPerMonth))}
      </p>
    </div>
  );
}

function Slider({
  id,
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="text-ink-600">
          {label}
        </label>
        <span className="font-semibold text-ink-900">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-11 w-full accent-saffron-600 cursor-pointer"
      />
    </div>
  );
}

function Result({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-headline font-semibold text-page-title text-ink-900">{value}</dt>
      <dd className="mt-0.5 text-tile text-ink-600">{label}</dd>
    </div>
  );
}

function SectionHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={EYEBROW}>{eyebrow}</div>
      <h2 className={H2}>{title}</h2>
      {lead ? <p className={LEAD}>{lead}</p> : null}
    </div>
  );
}

function HoursBreakdown() {
  const { t } = useLanguage();
  const longest = Math.max(...SAVINGS_CAPABILITIES.map((c) => c.hoursPerWeek));
  return (
    <section id="hours" className="bg-milk-400 scroll-mt-20">
      <div className={SECTION}>
        <SectionHeader
          eyebrow={t("Where the hours go")}
          title={t("Nine jobs teachers do after the bell. One assistant that drafts them.")}
          lead={t("The estimate is itemised, so you can strike out anything your school will not use. The teacher reviews and approves every output.")}
        />
        <div className="max-w-[860px] flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {SAVINGS_CAPABILITIES.map((c) => (
              <li
                key={c.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)_84px] gap-x-4 gap-y-1.5 items-center text-sm sm:text-card-title text-ink-900"
              >
                <span>{t(c.name)}</span>
                <span className="font-semibold sm:order-3 sm:text-right">{c.hoursPerWeek.toFixed(1)} {t("hrs")}</span>
                <span
                  aria-hidden
                  className="col-span-2 sm:col-span-1 sm:order-2 block h-2.5 rounded-full bg-border overflow-hidden"
                >
                  <span
                    className="block h-2.5 rounded-full bg-saffron-500"
                    style={{ width: `${Math.round((c.hoursPerWeek / longest) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 pt-3.5 border-t border-border flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm sm:text-card-title font-semibold text-ink-900">
            <span>{t("Total per teacher")}</span>
            <span>
              {t("{weekly} hrs a week · {yearly} hrs a year")
                .replace("{weekly}", SAVINGS_WEEKLY_HOURS.toFixed(1))
                .replace("{yearly}", String(SAVINGS_HOURS_PER_TEACHER_YEAR))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Oversight() {
  const { t } = useLanguage();
  const sample = [
    { label: t("Teachers active this week"), value: "22 / 25" },
    { label: t("Lessons, quizzes and worksheets"), value: "147" },
    { label: t("Hours saved this week"), value: "138" },
    { label: t("Parent calls completed"), value: "64" },
  ];
  return (
    <section id="oversight" className="scroll-mt-20">
      <div className={SECTION}>
        <SectionHeader
          eyebrow={t("Oversight")}
          title={t("You approve the spend. You see what it returns.")}
          lead={t("The school console shows who is using SahayakAI, what they made and the hours it took off their week, so the saving is checked against your own data.")}
        />
        <div className="rounded-surface-lg bg-card border border-border shadow-soft p-6 sm:p-7">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {sample.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-tile text-ink-600">{m.label}</dt>
                <dd className="mt-1 font-headline font-bold text-metric sm:text-3xl text-ink-900">{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 pt-3.5 border-t border-border text-tile text-ink-500">
            {t("Sample figures, to show the layout. Your school's own numbers appear after the first week.")}
          </p>
        </div>
      </div>
    </section>
  );
}

function HowToStart() {
  const { t } = useLanguage();
  const steps = [
    {
      step: t("Step 1 · 30 minutes"),
      title: t("Watch one of your own teachers use it"),
      body: t("We bring the product to your school and run it on your board, your textbook and your classes."),
    },
    {
      step: t("Step 2 · A pilot group"),
      title: t("Measure the hours in your own school"),
      body: t("Start with a group of teachers and compare the console's figures with the estimate above."),
    },
    {
      step: t("Step 3 · A written quote"),
      title: t("Roll out at a price fixed on paper"),
      body: t("₹{price} per teacher per year is the standard rate. Your binding figure is the written quote.").replace(
        "{price}",
        inr(SCHOOL_PRICING.annualPerTeacher)
      ),
    },
  ];
  return (
    <section id="start" className="bg-milk-400 scroll-mt-20">
      <div className={SECTION}>
        <SectionHeader eyebrow={t("How to start")} title={t("Decide on evidence. Not on a sales deck.")} />
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
          {steps.map((s) => (
            <li key={s.step} className="flex flex-col gap-2 border-t-2 border-ink-900 pt-4">
              <span className="text-tile font-semibold text-saffron-700">{s.step}</span>
              <h3 className="font-headline font-semibold text-web-h3 text-ink-900">{s.title}</h3>
              <p className="text-card-title leading-[1.6] text-ink-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClosingBand({ demoHref }: { demoHref: string }) {
  const { t } = useLanguage();
  return (
    <section id="book-demo" className="container-wide py-16 sm:py-[88px] scroll-mt-20">
      <div className="rounded-[36px] bg-saffron-600 px-6 sm:px-11 py-12 sm:py-16 flex flex-col items-center text-center gap-5">
        <h2 className="font-headline font-bold tracking-tight text-web-h2 text-milk-100 max-w-[24ch]">
          {t("Bring your numbers. We will show you ours.")}
        </h2>
        <p className="text-base leading-[1.6] text-milk-100 max-w-[52ch]">
          {t("A 30-minute demo at your school, with the founder, on your own syllabus.")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <DemoLink
            href={demoHref}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-milk-100 text-saffron-800 hover:bg-milk-50 transition-colors"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={2.2} aria-hidden />
            {t("Book a 30-minute demo")}
          </DemoLink>
          <DemoLink
            href={CALENDLY_URL}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full border border-milk-100/50 text-milk-100 hover:bg-saffron-700 transition-colors"
          >
            <Calendar className="w-4 h-4" strokeWidth={2.2} aria-hidden />
            {t("Pick a time on the calendar")}
          </DemoLink>
        </div>
      </div>
    </section>
  );
}
