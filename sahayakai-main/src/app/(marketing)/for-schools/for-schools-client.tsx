"use client";

import { useMemo, useState } from "react";
import { Calendar, MessageCircle, Play } from "lucide-react";
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
 * /for-schools — the page a school reads together.
 *
 * WHO READS IT (founder review, 2026-11-26)
 * Usually a teacher finds it first and recommends it upward, so the page has
 * to be safe and motivating for a teacher before it is useful to the person
 * who approves the spend. Three rules follow, and copy changes must keep them:
 *   1. The teacher leads. SahayakAI assists and never replaces. No line may
 *      count teachers as a cost, a headcount or a "full-time equivalent".
 *   2. Purpose first: what changes for children, teachers and the school.
 *      The estimate matters but sits lower on the page, not centre stage.
 *   3. Every screen: phone, laptop and the classroom display. Never "phone
 *      only".
 *
 * FIGURES
 * Every hours and price figure comes from the founder-approved model in
 * src/lib/school-pricing.ts. Do not type one into the markup:
 * src/__tests__/landing/time-saved-claims-consistent.test.ts fails the build
 * if one appears. The figures are estimates and are labelled as estimates.
 *
 * NOT ON THIS PAGE
 * No customer testimonial and no usage claim (the design system allows
 * neither without signed consent and measured data). The one quotation is the
 * founder's own stated belief, credited to him. No floating controls: a fixed
 * button covers the content on a phone.
 *
 * IMAGES
 * The three illustrations in /public/images/for-schools were generated with
 * Gemini in the flat style of the SahayakAI film and keep Gemini's mark. They
 * are illustrations, not photographs of a customer. The film opens on
 * YouTube from a local poster, so no third-party frame or script loads here.
 */

const CALENDLY_URL = "https://calendly.com/contact-sargvision/30min";
/** The SahayakAI film on the SARGVISION YouTube channel, and its length. */
const FILM_URL = "https://www.youtube.com/watch?v=Y24Sox3NRGE";
const FILM_LENGTH = "2:43";
const SCEPTICAL_REALISATION = 0.5;
const IMG = "/images/for-schools";

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

/* One card language for the whole page: a soft white tile on an off-white
   ground, a hairline edge, and a gentle lift on hover. */
const TILE = "rounded-[28px] bg-card border border-black/[0.06] shadow-soft overflow-hidden";
const TILE_LIFT = `${TILE} transition duration-small ease-out-quart hover:-translate-y-1 hover:shadow-elevated`;
const EYEBROW = "text-tile font-semibold text-ink-500";
const H2 = "font-headline font-bold tracking-tight text-web-h2 text-ink-900";
const LEAD = "text-base sm:text-web-lead text-ink-600 max-w-[60ch]";
const SECTION = "container-wide py-14 sm:py-20 flex flex-col items-center gap-9 sm:gap-11";
const PRIMARY_CTA =
  "inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors";
const OUTLINE_CTA =
  "inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-card border border-border text-ink-900 hover:bg-milk-300 transition-colors";

export function ForSchoolsClient() {
  const { openAuthModal } = useAuth();
  const demoHref = getWhatsAppDeepLink();

  return (
    <div className="flex flex-col min-h-screen bg-milk-200">
      <LandingNav onAuthClick={openAuthModal} />
      <main>
        <Hero demoHref={demoHref} />
        <Film />
        <Belief />
        <ForTeachers />
        <ForTheSchool />
        <Estimate demoHref={demoHref} />
        <HowToStart />
        <ClosingBand demoHref={demoHref} />
      </main>
      <LandingFooter />
    </div>
  );
}

function ExternalLink({ href, className, children, label }: { href: string; className: string; children: React.ReactNode; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  );
}

/** Centred eyebrow, two-line headline (the second line in saffron), lead. */
function Heading({ eyebrow, line1, line2, lead, as = "h2" }: { eyebrow: string; line1: string; line2?: string; lead?: string; as?: "h1" | "h2" }) {
  const Tag = as;
  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-[860px]">
      <div className={EYEBROW}>{eyebrow}</div>
      <Tag
        className={
          as === "h1"
            ? "font-headline font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-ink-900"
            : H2
        }
      >
        {line1}
        {line2 ? (
          <>
            {" "}
            <span className="text-saffron sm:block">{line2}</span>
          </>
        ) : null}
      </Tag>
      {lead ? <p className={LEAD}>{lead}</p> : null}
    </div>
  );
}

function Hero({ demoHref }: { demoHref: string }) {
  const { t } = useLanguage();
  return (
    <section className="container-wide pt-10 sm:pt-16 pb-14 sm:pb-20 flex flex-col items-center gap-8 sm:gap-10">
      <Heading
        as="h1"
        eyebrow={t("For teachers, parents and the people who lead schools")}
        line1={t("Every child deserves a teacher")}
        line2={t("with time to teach.")}
        lead={t("SahayakAI stands beside the teacher. It drafts the paperwork, keeps parents in the loop and gives the school one clear view, so the day goes back to teaching. On a phone, a laptop or the classroom screen.")}
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <a href="#film" className={PRIMARY_CTA}>
          <Play className="w-4 h-4" fill="currentColor" aria-hidden />
          {t("Watch the film")}
        </a>
        <ExternalLink href={demoHref} className={OUTLINE_CTA}>
          <MessageCircle className="w-4 h-4" strokeWidth={2.2} aria-hidden />
          {t("Book a 30-minute demo")}
        </ExternalLink>
      </div>
      <div className="inline-flex items-center gap-2 text-tile font-medium text-leaf-700 bg-card border border-black/[0.06] rounded-full px-4 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-leaf-500" aria-hidden />
        {t("Built to assist teachers. Never to replace them.")}
      </div>
      <img
        src={`${IMG}/classroom.webp`}
        alt={t("Illustration: a teacher in her classroom with children raising their hands")}
        width={1456}
        height={812}
        className="w-full max-w-[1080px] h-auto rounded-[32px] border border-black/[0.06] shadow-elevated"
      />
    </section>
  );
}

function Film() {
  const { t } = useLanguage();
  return (
    <section id="film" className="scroll-mt-20">
      <div className={SECTION}>
        <Heading
          eyebrow={t("The film")}
          line1={t("One co-pilot for teachers, parents and principals.")}
          lead={t("Under three minutes. Watch a school day with SahayakAI in it.")}
        />
        {/* A local poster that opens YouTube: no third-party frame or script. */}
        <ExternalLink
          href={FILM_URL}
          label={t("Play the SahayakAI film on YouTube")}
          className={`group relative block w-full max-w-[1080px] ${TILE_LIFT}`}
        >
          <img
            src={`${IMG}/staffroom.webp`}
            alt=""
            width={1456}
            height={812}
            loading="lazy"
            className="block w-full h-auto"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-saffron text-white shadow-elevated transition-transform duration-small group-hover:scale-105">
              <Play className="h-8 w-8 sm:h-10 sm:w-10 translate-x-0.5" fill="currentColor" aria-hidden />
            </span>
          </span>
          <span className="absolute left-4 bottom-4 sm:left-6 sm:bottom-6 inline-flex items-center gap-2 rounded-full bg-card/90 backdrop-blur px-4 py-2 text-tile font-semibold text-ink-900">
            {t("Watch the film")} · {FILM_LENGTH}
          </span>
        </ExternalLink>
      </div>
    </section>
  );
}

/** The founder's own stated belief, credited to him. Not a testimonial. */
function Belief() {
  const { t } = useLanguage();
  return (
    <section className="bg-saffron-50">
      <div className="container-wide py-16 sm:py-24 flex flex-col items-center text-center gap-5">
        <div className={EYEBROW}>{t("Why we built it")}</div>
        <p className="font-headline font-bold tracking-tight text-3xl sm:text-5xl leading-[1.1] text-ink-900 max-w-[20ch]">
          {t("A child's future shouldn't be decided by its pincode.")}
        </p>
        <p className="text-sm text-ink-600">{t("Abhishek Gupta, Founder & CEO, SARGVISION")}</p>
      </div>
    </section>
  );
}

function TextTile({ title, body, className = "", orb = false }: { title: string; body: string; className?: string; orb?: boolean }) {
  return (
    <div className={`${TILE_LIFT} p-7 sm:p-9 flex flex-col justify-end gap-3 ${className}`}>
      {orb ? (
        /* VIDYA is drawn as a plain saffron sphere, never with a glyph on it. */
        <span
          aria-hidden
          className="mb-auto h-20 w-20 rounded-full bg-gradient-to-br from-saffron-200 to-saffron shadow-elevated"
        />
      ) : null}
      <h3 className="font-headline font-bold tracking-tight text-2xl sm:text-3xl leading-[1.12] text-ink-900">{title}</h3>
      <p className="text-base leading-[1.6] text-ink-600">{body}</p>
    </div>
  );
}

function ForTeachers() {
  const { t } = useLanguage();
  return (
    <section id="teachers" className="scroll-mt-20">
      <div className={SECTION}>
        <Heading
          eyebrow={t("For your teachers")}
          line1={t("The teacher leads.")}
          line2={t("SahayakAI carries the load.")}
        />
        <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-6 gap-5">
          <div className={`${TILE_LIFT} lg:col-span-4 flex flex-col`}>
            <img
              src={`${IMG}/evening.webp`}
              alt={t("Illustration: a teacher at home in the evening, drawing with her daughter")}
              width={1456}
              height={812}
              loading="lazy"
              className="block w-full h-auto"
            />
            <div className="p-7 sm:p-9 flex flex-col gap-3">
              <h3 className="font-headline font-bold tracking-tight text-2xl sm:text-3xl leading-[1.12] text-ink-900">
                {t("Paperwork done before you leave school.")}
              </h3>
              <p className="text-base leading-[1.6] text-ink-600">
                {t("Less paperwork after the bell. More of the day for teaching.")}
              </p>
            </div>
          </div>
          <TextTile
            className="lg:col-span-2 bg-gradient-to-b from-saffron-50 to-card"
            orb
            title={t("You teach. VIDYA drafts.")}
            body={t("Speak once, in your own language. VIDYA drafts the lesson plan, worksheet or quiz.")}
          />
          <TextTile
            className="lg:col-span-3"
            title={t("You have the final word.")}
            body={t("You review and approve everything. Nothing goes out without you.")}
          />
          <TextTile
            className="lg:col-span-3"
            title={t("Any screen, any language.")}
            body={t("Phone, laptop or the classroom screen, in 11 Indian languages.")}
          />
        </div>
      </div>
    </section>
  );
}

function ForTheSchool() {
  const { t } = useLanguage();
  return (
    <section id="school" className="scroll-mt-20">
      <div className={SECTION}>
        <Heading
          eyebrow={t("For your school")}
          line1={t("Teachers, parents and leaders,")}
          line2={t("moving together.")}
        />
        <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-6 gap-5">
          <TextTile
            className="lg:col-span-3 bg-gradient-to-b from-saffron-50 to-card"
            title={t("Parents in the loop.")}
            body={t("When a child has been away, the school calls to ask if all is well, in the parent's own language.")}
          />
          <TextTile
            className="lg:col-span-3"
            title={t("One view for the school.")}
            body={t("See how many teachers use it and the hours going back to teaching, across the school.")}
          />
          <TextTile
            className="lg:col-span-6"
            title={t("Your board, your textbooks.")}
            body={t("CBSE, ICSE and state boards. Every output names the board and chapter it follows.")}
          />
        </div>
      </div>
    </section>
  );
}

function Estimate({ demoHref }: { demoHref: string }) {
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
  const weeklyPerTeacher = s.hoursPerTeacherPerYear / SAVINGS_MODEL.weeksPerYear;
  const longest = Math.max(...SAVINGS_CAPABILITIES.map((c) => c.hoursPerWeek));

  return (
    <section id="estimate" className="bg-saffron-50 scroll-mt-20">
      <div className={SECTION}>
        <Heading
          eyebrow={t("What it adds up to")}
          line1={t("Time back for teaching,")}
          line2={t("counted for your school.")}
        />

        <div id="savings" className={`w-full max-w-[1080px] ${TILE}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-6 sm:p-9 flex flex-col gap-5 lg:border-r border-black/[0.06]">
              <div className={EYEBROW}>{t("Your school, per year")}</div>
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
              <label className="flex items-center gap-3 min-h-[44px] text-sm text-ink-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sceptical}
                  onChange={(e) => setSceptical(e.target.checked)}
                  className="h-5 w-5 accent-saffron-600"
                />
                {t("Be sceptical: assume only half the hours are saved")}
              </label>
            </div>

            <dl className="p-6 sm:p-9 flex flex-col justify-center border-t lg:border-t-0 border-black/[0.06]" aria-live="polite">
              <LedgerRow label={t("hours returned to teaching")} value={inr(s.hoursReclaimedSchool)} />
              <LedgerRow label={t("per teacher, every week")} value={`${weeklyPerTeacher.toFixed(1)} ${t("hrs")}`} />
              <LedgerRow label={t("what that time is worth")} value={inrCompact(s.valueSchoolPerYear, t)} />
              <LedgerRow label={t("SahayakAI fee, before GST")} value={`− ${inrCompact(s.sahayakaiCostPerYear, t)}`} />
            </dl>
          </div>

          <div className="bg-milk-300 border-y border-black/[0.06] px-6 sm:px-9 py-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Answer value={inrCompact(s.netSavingsPerYear, t)} label={t("worth of teaching time, after the fee")} large />
            <Answer value={`₹${s.roiMultiple.toFixed(1)}`} label={t("back for every ₹1 spent")} />
            <Answer
              value={t("{n} months").replace("{n}", s.paybackMonths > 0 ? s.paybackMonths.toFixed(1) : "0")}
              label={t("to pay back the fee")}
            />
          </div>

          <p className="px-6 sm:px-9 py-5 text-xs leading-[1.5] text-ink-500">
            {t("An estimate from your inputs, not a measured result. Based on {weekly} hours a week across {tools} tools, over {weeks} teaching weeks, valued at salary ÷ {paid} paid hours a month.")
              .replace("{weekly}", SAVINGS_WEEKLY_HOURS.toFixed(1))
              .replace("{tools}", String(SAVINGS_CAPABILITIES.length))
              .replace("{weeks}", String(SAVINGS_MODEL.weeksPerYear))
              .replace("{paid}", String(SAVINGS_MODEL.paidHoursPerMonth))}
          </p>
        </div>

        {/* How the estimate is built: the nine jobs, itemised */}
        <div id="hours" className={`w-full max-w-[1080px] ${TILE} p-6 sm:p-9 flex flex-col gap-5 scroll-mt-24`}>
          <div className="flex flex-col gap-2">
            <div className={EYEBROW}>{t("Where the hours go")}</div>
            <p className="text-base leading-[1.6] text-ink-600 max-w-[62ch]">
              {t("The estimate is itemised, so you can strike out anything your school will not use. The teacher reviews and approves every output.")}
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {SAVINGS_CAPABILITIES.map((c) => (
              <li
                key={c.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_84px] gap-x-4 gap-y-1.5 items-center text-sm sm:text-card-title text-ink-900"
              >
                <span>{t(c.name)}</span>
                <span className="font-semibold sm:order-3 sm:text-right">
                  {c.hoursPerWeek.toFixed(1)} {t("hrs")}
                </span>
                <span aria-hidden className="col-span-2 sm:col-span-1 sm:order-2 block h-2.5 rounded-full bg-milk-400 overflow-hidden">
                  <span
                    className="block h-2.5 rounded-full bg-saffron"
                    style={{ width: `${Math.round((c.hoursPerWeek / longest) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <div className="pt-4 border-t border-black/[0.06] flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm sm:text-card-title font-semibold text-ink-900">
            <span>{t("Total per teacher")}</span>
            <span>
              {t("{weekly} hrs a week · {yearly} hrs a year")
                .replace("{weekly}", SAVINGS_WEEKLY_HOURS.toFixed(1))
                .replace("{yearly}", String(SAVINGS_HOURS_PER_TEACHER_YEAR))}
            </span>
          </div>
        </div>

        <ExternalLink href={demoHref} className={PRIMARY_CTA}>
          <MessageCircle className="w-4 h-4" strokeWidth={2.2} aria-hidden />
          {t("Book a 30-minute demo")}
        </ExternalLink>
      </div>
    </section>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5 border-b border-black/[0.06] last:border-b-0">
      <dt className="text-sm text-ink-600">{label}</dt>
      <dd className="font-headline font-semibold text-card-title sm:text-output-title text-ink-900 tabular-nums whitespace-nowrap">
        {value}
      </dd>
    </div>
  );
}

function Answer({ value, label, large }: { value: string; label: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <div
        className={`font-headline font-bold tracking-tight tabular-nums ${
          large ? "text-4xl sm:text-5xl text-saffron" : "text-3xl sm:text-4xl text-ink-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-tile text-ink-600">{label}</div>
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
        <span className="font-headline font-semibold text-card-title text-ink-900 tabular-nums">{display}</span>
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
    <section id="start" className="scroll-mt-20">
      <div className={SECTION}>
        <Heading eyebrow={t("How to start")} line1={t("Decide on evidence. Not on a sales deck.")} />
        <ol className="w-full max-w-[1080px] grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <li key={s.step} className={`${TILE_LIFT} p-7 flex flex-col gap-2.5`}>
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
    <section id="book-demo" className="container-wide pb-16 sm:pb-24 scroll-mt-20">
      <div className="mx-auto max-w-[1080px] rounded-[36px] bg-saffron px-6 sm:px-11 py-14 sm:py-20 flex flex-col items-center text-center gap-5">
        <h2 className="font-headline font-bold tracking-tight text-web-h2 text-white max-w-[22ch]">
          {t("Transform your school, one staff room at a time.")}
        </h2>
        <p className="text-base leading-[1.6] text-white max-w-[52ch]">
          {t("A 30-minute demo at your school, with the founder, on your own syllabus.")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ExternalLink
            href={demoHref}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full bg-white text-saffron-800 hover:bg-milk-50 transition-colors"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={2.2} aria-hidden />
            {t("Book a 30-minute demo")}
          </ExternalLink>
          <ExternalLink
            href={CALENDLY_URL}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold px-6 rounded-full border border-white/60 text-white hover:bg-saffron-600 transition-colors"
          >
            <Calendar className="w-4 h-4" strokeWidth={2.2} aria-hidden />
            {t("Pick a time on the calendar")}
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}
