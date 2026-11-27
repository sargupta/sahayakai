"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLanguage } from "@/context/language-context";
import {
  SAVINGS_HOURS_PER_TEACHER_YEAR,
  SAVINGS_MODEL,
  SAVINGS_WEEKLY_HOURS,
  SAVINGS_CAPABILITIES,
  SCHOOL_PRICING,
  estimateSchoolSavings,
} from "@/lib/school-pricing";
import { HOME_FONT_VARS } from "./home-fonts";
import { HomeFooter, HomeHeader } from "./home-chrome";
import { HomeCapabilities, HomeNep, HomeQuote } from "./home-sections";
import { COMMUNITY_URL, FILM_ID, FILM_LENGTH, demoHref } from "./home-links";
import {
  MotionProvider,
  MotionToggle,
  useInView,
  useMotionRoot,
  useMotionStopped,
} from "./home-motion";
import "./home.css";

/*
 * The signed-out homepage: founder-approved design "Homepage v1"
 * (Claude Design, 2026-11-27). Order sells the feeling first (the hero and
 * the pincode quote), then what SahayakAI does, then the numbers.
 *
 * Every figure on this page is read from src/lib/school-pricing.ts; nothing
 * is typed (class gate: src/__tests__/landing/time-saved-claims-consistent.test.ts).
 */

type Props = { onAuthClick: () => void };

export function HomePage({ onAuthClick }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const motion = useMotionRoot(root, ".hero-try, .quote, .card, .film, .stage");
  return (
    <MotionProvider value={motion}>
      <div
        ref={root}
        className={`hpv1 force-light ${HOME_FONT_VARS}${motion.paused || motion.hidden ? " hp-paused" : ""}`}
      >
        <HomeHeader onAuthClick={onAuthClick} />
        <main>
          <Hero />
          <HomeQuote />
          <HomeCapabilities />
          <Film />
          <HomeNep />
          <Calculator />
          <Community />
        </main>
        <HomeFooter />
      </div>
    </MotionProvider>
  );
}

/* ------------------------------------------------------------------ hero */

/** The three sample requests; built with literal t() calls so Gate 9 can check every key. */
function demos(t: (k: string) => string) {
  return [
    {
      key: "call",
      label: t("Parent call"),
      said: t(
        "Please check on the students who have been absent for three days.",
      ),
      result: t(
        "Four families reached in English, Hindi and Kannada. A summary is with the class teacher.",
      ),
    },
    {
      key: "paper",
      label: t("Exam paper"),
      said: t("Prepare a 40-mark paper on fractions for Class 7 Mathematics."),
      result: t(
        "Question paper, blueprint and answer key are ready for your review.",
      ),
    },
    {
      key: "mentor",
      label: t("AI Mentor"),
      said: t(
        "My Class 6 students lose focus after lunch. What would you suggest?",
      ),
      result: t("Three classroom strategies, grounded in NEP 2020, are ready."),
    },
  ];
}
const DEMO_COUNT = 3;

const WAVE = [40, 80, 55, 100, 65, 90, 45, 75, 60, 95, 50, 85, 35, 70, 55, 90];

/**
 * All variants laid in one grid cell; only the active one is visible. The
 * box keeps the height of the longest, so the page below never jumps while
 * the requests cycle.
 */
function Stacked({ items, active }: { items: string[]; active: number }) {
  return (
    <span style={{ display: "grid" }}>
      {items.map((text, i) => (
        <span
          key={i}
          aria-hidden={i === active ? undefined : true}
          style={{
            gridArea: "1 / 1",
            visibility: i === active ? "visible" : "hidden",
          }}
        >
          {text}
        </span>
      ))}
    </span>
  );
}

export function Orb({
  size,
  pulse = false,
}: {
  size: number;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        flex: "none",
        display: "inline-block",
        width: size,
        height: size,
      }}
    >
      {pulse && (
        <>
          <span
            className="pulse"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 9999,
              background: "rgba(255,139,43,.35)",
            }}
          />
          <span
            className="pulse"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 9999,
              background: "rgba(255,139,43,.35)",
              animationDelay: "-1.2s",
            }}
          />
        </>
      )}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at 32% 26%,var(--hp-saffron-94-2) 0%,var(--hp-saffron-78) 26%,var(--hp-saffron) 62%,var(--hp-saffron-deep) 100%)",
          boxShadow:
            "0 6px 18px rgba(255,120,30,.45), inset 0 -4px 10px rgba(150,60,0,.25)",
        }}
      />
    </span>
  );
}

function Hero() {
  const { t } = useLanguage();
  const stopped = useMotionStopped();
  const panel = useRef<HTMLDivElement>(null);
  const inView = useInView(panel);
  const [pick, setPick] = useState(0);
  // Once the visitor picks a request, the cycle stops and the result is announced.
  const [touched, setTouched] = useState(false);
  // Hovering or focusing the panel holds the current request.
  const [held, setHeld] = useState(false);

  // Cycle the three requests while nobody is reading or using the panel.
  useEffect(() => {
    if (stopped || touched || held || !inView) return;
    const id = window.setInterval(
      () => setPick((p) => (p + 1) % DEMO_COUNT),
      5500,
    );
    return () => window.clearInterval(id);
  }, [stopped, touched, held, inView]);

  const list = demos(t);
  const d = list[pick];
  const chip = (on: boolean): CSSProperties =>
    on
      ? {
          background: "var(--hp-ink)",
          color: "var(--hp-paper)",
          border: "1px solid var(--hp-ink)",
        }
      : {
          background: "rgba(255,255,255,.75)",
          color: "var(--hp-ink)",
          border: "1px solid rgba(23,19,16,.2)",
        };

  return (
    <section
      className="wrap"
      style={{ paddingTop: "56px", paddingBottom: "40px" }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(44px, 7.4vw, 104px)",
          lineHeight: 1,
          maxWidth: "1040px",
        }}
      >
        {t("Quality education for every classroom in India.")}
      </h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "40px",
          marginTop: "44px",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1 1 340px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            alignItems: "flex-start",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "20px",
              lineHeight: 1.55,
              color: "var(--hp-body)",
            }}
          >
            {t(
              "India's voice-first AI assistant for teachers, parents and school leaders.",
            )}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <a
              href={demoHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="hp-btn hp-btn-saffron"
            >
              {t("Book a demo")}
            </a>
            <a href="#film" className="hp-link">
              {t("Watch the film")}
            </a>
          </div>
          <MotionToggle />
        </div>
        <div
          ref={panel}
          className="hero-try"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setHeld(false);
          }}
          style={{
            flex: "2 1 560px",
            minWidth: 0,
            position: "relative",
            overflow: "hidden",
            borderRadius: "32px",
            padding: "36px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            background:
              "radial-gradient(45% 55% at 85% 12%, rgba(255,139,43,.34), transparent 62%), radial-gradient(55% 65% at 0% 100%, var(--hp-indigo-92), transparent 62%), radial-gradient(40% 50% at 100% 100%, var(--hp-green-86), transparent 60%), var(--hp-cream)",
            boxShadow:
              "inset 0 0 0 1px rgba(23,19,16,.05), 0 40px 80px -40px rgba(122,60,10,.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Orb size={64} pulse />
            <div>
              <h2
                className="d"
                style={{ margin: 0, fontSize: "28px", lineHeight: 1.1 }}
              >
                {t("Try VIDYA")}
              </h2>
              <div style={{ fontSize: "15px", color: "var(--hp-body)" }}>
                {t("Pick something a teacher might say.")}
              </div>
            </div>
          </div>
          <div
            role="group"
            aria-label={t("Try a request")}
            style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
          >
            {list.map((demo, i) => (
              <button
                key={demo.key}
                type="button"
                aria-pressed={i === pick}
                onClick={() => {
                  setTouched(true);
                  setPick(i);
                }}
                style={{
                  borderRadius: 9999,
                  padding: "8px 16px",
                  fontSize: "15px",
                  fontWeight: 600,
                  minHeight: "44px",
                  ...chip(i === pick),
                }}
              >
                {demo.label}
              </button>
            ))}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div
              style={{
                background: "var(--hp-white)",
                borderRadius: "22px 22px 22px 6px",
                padding: "20px 22px",
                boxShadow: "0 20px 44px -18px rgba(122,60,10,.3)",
              }}
            >
              <p
                className="d"
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 2.4vw, 30px)",
                  lineHeight: 1.22,
                }}
              >
                <Stacked items={list.map((x) => `“${x.said}”`)} active={pick} />
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--hp-accent-deep)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    height: "20px",
                  }}
                >
                  {WAVE.map((h, i) => (
                    <span
                      key={i}
                      className="wv"
                      style={{
                        width: "3px",
                        height: `${h}%`,
                        background: "var(--hp-accent)",
                        animationDelay: `-${((i * 0.13) % 1.04).toFixed(2)}s`,
                      }}
                    />
                  ))}
                </span>
                {t("VIDYA is listening")}
              </div>
            </div>
            <div
              key={d.key}
              className="tryres"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                background: "rgba(255,255,255,.82)",
                border: "1px solid rgba(255,255,255,.95)",
                borderRadius: "18px",
                padding: "14px 16px",
                boxShadow: "0 14px 30px -16px rgba(122,60,10,.3)",
              }}
            >
              <span
                style={{
                  flex: "none",
                  width: "30px",
                  height: "30px",
                  borderRadius: 9999,
                  background: "var(--hp-success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: "var(--hp-white)" }}
                >
                  <path d="M4 10.5l4 4 8-9" />
                </svg>
              </span>
              <div className="rv" aria-live={touched ? "polite" : "off"}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  <Stacked items={list.map((x) => x.result)} active={pick} />
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--hp-body)",
                    marginTop: "2px",
                  }}
                >
                  {t("Sample. Sent only after the teacher approves.")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ film */

/** Plays in the page (founder rule, 2026-11-27): nothing loads from YouTube until the visitor presses play. */
const FILM_EMBED_URL = `https://www.youtube-nocookie.com/embed/${FILM_ID}?autoplay=1&rel=0&playsinline=1`;

function Play({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ fill: fill, stroke: fill }}
    >
      <path d="M7 5l8 5-8 5z" />
    </svg>
  );
}

/** The film plays here, in the page (founder rule, 2026-11-27); nothing loads from YouTube until the visitor presses play. */
function Film() {
  const { t } = useLanguage();
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLIFrameElement>(null);
  const [m, s] = FILM_LENGTH.split(":");
  const length = t("{m} min {s} s")
    .replace("{m}", String(Number(m)))
    .replace("{s}", s);
  // The button disappears when the film starts: hand focus to the player.
  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);

  return (
    <section
      id="film"
      className="wrap"
      style={{
        paddingTop: "96px",
        paddingBottom: "96px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        scrollMarginTop: "80px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "clamp(32px, 4.2vw, 56px)",
          lineHeight: 1.05,
        }}
      >
        {t("A school day with SahayakAI.")}
      </h2>
      {playing ? (
        <div className="film-player">
          <iframe
            ref={player}
            src={FILM_EMBED_URL}
            title={t("The SahayakAI film")}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          className="film"
          onClick={() => setPlaying(true)}
          aria-label={`${t("Watch the film")}, ${length}`}
        >
          <div
            className="fit"
            style={{
              justifyContent: "space-between",
              gap: "40px",
              padding: "48px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                maxWidth: "440px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Orb size={30} />
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--hp-accent-deep)",
                  }}
                >
                  {t("The SahayakAI film")}
                </span>
              </div>
              <div
                className="d"
                style={{
                  fontSize: "clamp(34px, 4.4vw, 58px)",
                  lineHeight: 1.02,
                }}
              >
                {t("The AI co-pilot for your whole school.")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginTop: "10px",
                }}
              >
                <span
                  className="playb"
                  style={{
                    width: "72px",
                    height: "72px",
                    flex: "none",
                    borderRadius: 9999,
                    background: "var(--hp-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 18px 40px rgba(23,19,16,.3)",
                  }}
                >
                  <Play size={26} fill="var(--hp-white)" />
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "16px", fontWeight: 600 }}>
                    {t("Watch the film")}
                  </span>
                  <span style={{ fontSize: "14px", color: "var(--hp-body)" }}>
                    {length}
                  </span>
                </span>
              </div>
            </div>
            <div
              className="film-photo"
              style={{
                position: "relative",
                flex: "none",
                width: "400px",
                height: "380px",
              }}
            >
              <img
                src="/images/home/film-cover.webp"
                alt={t("A teacher with a tablet leading her class")}
                width={568}
                height={600}
                loading="lazy"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "60% 30%",
                  borderRadius: "26px",
                  border: "6px solid var(--hp-white)",
                  boxSizing: "border-box",
                  boxShadow: "0 34px 70px -24px rgba(122,60,10,.5)",
                }}
              />
              <span
                className="playb"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "76px",
                  height: "76px",
                  margin: "-38px 0 0 -38px",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,.92)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 14px 34px rgba(23,19,16,.28)",
                }}
              >
                <Play size={28} fill="var(--hp-ink)" />
              </span>
              <span
                style={{ position: "absolute", left: "-22px", bottom: "-22px" }}
              >
                <Orb size={70} pulse />
              </span>
              <span
                style={{
                  position: "absolute",
                  right: "16px",
                  bottom: "16px",
                  background: "rgba(23,19,16,.55)",
                  color: "var(--hp-white)",
                  fontSize: "12px",
                  borderRadius: 9999,
                  padding: "3px 10px",
                }}
              >
                {t("Illustrative image")}
              </span>
            </div>
          </div>
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ calculator */

const TEACHERS_DEFAULT = 60;
const SALARY_DEFAULT = 30000;
const CONSERVATIVE_REALISATION = 0.5;
/** Salary slider range in ₹ a month (the number box accepts any value). */
const SALARY_SLIDER = { min: 10_000, max: 100_000, step: 1_000 };
const TEACHER_SLIDER = { min: 5, max: 300 };
/** Upper bounds for the number boxes, so a typo cannot produce absurd figures. */
const MAX_TEACHERS = 20_000;
const MAX_SALARY = 2_000_000;

/** Keep digits only and cap the value; an empty box stays empty while typing. */
function clampInput(raw: string, max: number): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  return String(Math.min(max, Number(digits)));
}

/** ₹ the way an Indian school budget is read: lakh and crore, one decimal at most. */
function money(x: number, t: (k: string) => string): string {
  const a = Math.abs(x);
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  if (a >= 1e7) return "₹" + t("{n} crore").replace("{n}", trim(a / 1e7));
  if (a >= 1e5) return "₹" + t("{n} lakh").replace("{n}", trim(a / 1e5));
  if (a >= 1000)
    return "₹" + (Math.round(a / 1000) * 1000).toLocaleString("en-IN");
  return "₹" + Math.round(a).toLocaleString("en-IN");
}

const roundHours = (h: number) =>
  h >= 1000 ? Math.round(h / 100) * 100 : Math.round(h / 10) * 10;

function Calculator() {
  const { t } = useLanguage();
  const [teachersIn, setTeachersIn] = useState(String(TEACHERS_DEFAULT));
  const [salaryIn, setSalaryIn] = useState(String(SALARY_DEFAULT));
  const [conservative, setConservative] = useState(false);

  const r = useMemo(
    () =>
      estimateSchoolSavings({
        teachers: Number(teachersIn) || 0,
        salaryPerMonth: Number(salaryIn) || 0,
        realisation: conservative ? CONSERVATIVE_REALISATION : 1,
      }),
    [teachersIn, salaryIn, conservative],
  );

  const price = SCHOOL_PRICING.annualPerTeacher.toLocaleString("en-IN");
  const fte = Math.round(r.fteEquivalent);
  const perRupee =
    r.roiMultiple >= 2
      ? Math.round(r.roiMultiple).toLocaleString("en-IN")
      : r.roiMultiple.toFixed(1);
  const paybackMonths = Math.round(r.paybackMonths);
  const has = r.teachers > 0 && r.valueSchoolPerYear > 0;

  const netValue = has
    ? (r.netSavingsPerYear < 0 ? "−" : "") + money(r.netSavingsPerYear, t)
    : "₹0";
  const back = (line: string) => line.replace("{x}", perRupee);
  const roiLine = !has
    ? t("Enter the number of teachers and their average salary.")
    : r.roiMultiple < 1
      ? t(
          "At this salary, the subscription costs more than the value of the time it returns.",
        )
      : r.paybackMonths < 1
        ? back(
            t(
              "About ₹{x} back for every ₹1 spent. The subscription pays for itself in under a month.",
            ),
          )
        : back(
            t(
              "About ₹{x} back for every ₹1 spent. The subscription pays for itself in about {payback}.",
            ),
          ).replace(
            "{payback}",
            paybackMonths <= 1
              ? t("a month")
              : t("{n} months").replace("{n}", String(paybackMonths)),
          );
  // Per-teacher hours are shown exactly; the "time of N teachers" framing only
  // from two full-time teachers up (one full-time teacher = SAVINGS_MODEL.fteHoursPerYear).
  const hoursNote =
    fte >= 2
      ? t("About {h} hours per teacher, the time of {n} full-time teachers")
          .replace("{h}", String(r.hoursPerTeacherPerYear))
          .replace("{n}", fte.toLocaleString("en-IN"))
      : t("About {h} hours per teacher").replace(
          "{h}",
          String(r.hoursPerTeacherPerYear),
        );
  const method = t(
    "An estimate from your inputs, not a measured result. ₹{price} is SahayakAI’s yearly price per teacher; it is not a salary. Time saved is {hw} hours a week per teacher across {tools} tools, over {weeks} teaching weeks, valued at salary ÷ {paid} paid hours a month.",
  )
    .replace("{price}", price)
    .replace("{hw}", String(Math.round(SAVINGS_WEEKLY_HOURS * 10) / 10))
    .replace("{tools}", String(SAVINGS_CAPABILITIES.length))
    .replace("{weeks}", String(SAVINGS_MODEL.weeksPerYear))
    .replace("{paid}", String(SAVINGS_MODEL.paidHoursPerMonth));

  // One short sentence for screen readers, after typing settles (the panel itself is not live).
  const summary = `${t("Net value to the school, per year")}: ${netValue}. ${roiLine}`;
  const [announce, setAnnounce] = useState("");
  const firstSummary = useRef(summary);
  useEffect(() => {
    if (summary === firstSummary.current) return; // nothing to announce until the visitor changes an input
    firstSummary.current = "";
    const id = window.setTimeout(() => setAnnounce(summary), 700);
    return () => window.clearTimeout(id);
  }, [summary]);

  const field: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--hp-white)",
    border: "1px solid rgba(23,19,16,.16)",
    borderRadius: "12px",
    padding: "6px 10px",
    minHeight: "44px",
    boxSizing: "border-box",
  };
  const input: CSSProperties = {
    width: "96px",
    border: 0,
    font: "inherit",
    fontSize: "18px",
    fontWeight: 700,
    textAlign: "right",
    background: "transparent",
    color: "var(--hp-ink)",
  };
  const tileLabel: CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--hp-muted)",
  };

  return (
    <section
      id="calculator"
      className="wrap"
      style={{
        paddingTop: "96px",
        paddingBottom: "96px",
        scrollMarginTop: "80px",
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: "clamp(32px, 4.2vw, 56px)",
          lineHeight: 1.05,
        }}
      >
        {t("What your school gets back.")}
      </h2>
      <p
        style={{
          margin: "0 0 36px",
          fontSize: "20px",
          color: "var(--hp-body)",
        }}
      >
        {t("Enter your own numbers.")}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        <div
          className="aw"
          style={{
            flex: "1 1 360px",
            minWidth: 0,
            alignSelf: "flex-start",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "26px",
          }}
        >
          <div className="calc-f">
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "10px",
              }}
            >
              <label
                htmlFor="hp-teachers"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("Number of teachers")}
              </label>
              <span style={field}>
                <input
                  id="hp-teachers"
                  className="calc-in num"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TEACHERS}
                  value={teachersIn}
                  onChange={(e) =>
                    setTeachersIn(clampInput(e.target.value, MAX_TEACHERS))
                  }
                  style={input}
                />
              </span>
            </span>
            <input
              type="range"
              min={TEACHER_SLIDER.min}
              max={TEACHER_SLIDER.max}
              step={1}
              value={Math.min(
                TEACHER_SLIDER.max,
                Math.max(
                  TEACHER_SLIDER.min,
                  Number(teachersIn) || TEACHER_SLIDER.min,
                ),
              )}
              onChange={(e) => setTeachersIn(e.target.value)}
              aria-label={t("Number of teachers, slider")}
              className="calc-r"
            />
          </div>
          <div className="calc-f">
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "10px",
              }}
            >
              <label
                htmlFor="hp-salary"
                style={{ fontSize: "15px", fontWeight: 600 }}
              >
                {t("Average teacher salary, per month")}
              </label>
              <span style={field}>
                <span
                  aria-hidden="true"
                  style={{ fontSize: "18px", fontWeight: 700 }}
                >
                  ₹
                </span>
                <input
                  id="hp-salary"
                  className="calc-in num"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_SALARY}
                  step={SALARY_SLIDER.step}
                  value={salaryIn}
                  onChange={(e) =>
                    setSalaryIn(clampInput(e.target.value, MAX_SALARY))
                  }
                  style={input}
                />
              </span>
            </span>
            <input
              type="range"
              min={SALARY_SLIDER.min}
              max={SALARY_SLIDER.max}
              step={SALARY_SLIDER.step}
              value={Math.min(
                SALARY_SLIDER.max,
                Math.max(
                  SALARY_SLIDER.min,
                  Number(salaryIn) || SALARY_SLIDER.min,
                ),
              )}
              onChange={(e) => setSalaryIn(e.target.value)}
              aria-label={t("Average teacher salary, per month, slider")}
              className="calc-r"
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            <input
              type="checkbox"
              checked={conservative}
              onChange={(e) => setConservative(e.target.checked)}
              style={{
                width: "20px",
                height: "20px",
                flex: "none",
                accentColor: "var(--hp-success)",
              }}
            />
            {t("Be conservative: count only half the time saved")}
          </label>
        </div>
        <div
          style={{
            flex: "1.4 1 460px",
            minWidth: 0,
            borderRadius: "28px",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            background:
              "radial-gradient(60% 80% at 100% 0%, rgba(255,139,43,.28), transparent 60%), var(--hp-cream)",
            boxShadow: "inset 0 0 0 1px rgba(23,19,16,.05)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--hp-success-deep)",
              }}
            >
              {t("Net value to the school, per year")}
            </div>
            <div
              className="d num"
              style={{
                fontSize: "clamp(48px, 6.4vw, 84px)",
                lineHeight: 1,
                marginTop: "6px",
              }}
            >
              {netValue}
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "var(--hp-body)",
                marginTop: "8px",
              }}
            >
              {roiLine}
            </div>
          </div>
          <div className="calc-g">
            <div className="calc-t">
              <div style={tileLabel}>{t("Teacher time returned")}</div>
              <div
                className="d num"
                style={{ fontSize: "30px", lineHeight: 1.1 }}
              >
                {t("{n} hours").replace(
                  "{n}",
                  roundHours(r.hoursReclaimedSchool).toLocaleString("en-IN"),
                )}
              </div>
              <div style={{ fontSize: "13px", color: "var(--hp-muted)" }}>
                {hoursNote}
              </div>
            </div>
            <div className="calc-t">
              <div style={tileLabel}>{t("Value of that time")}</div>
              <div
                className="d num"
                style={{ fontSize: "30px", lineHeight: 1.1 }}
              >
                {money(r.valueSchoolPerYear, t)}
              </div>
              <div style={{ fontSize: "13px", color: "var(--hp-muted)" }}>
                {t("At your salary figure")}
              </div>
            </div>
            <div className="calc-t">
              <div style={tileLabel}>{t("SahayakAI subscription")}</div>
              <div
                className="d num"
                style={{ fontSize: "30px", lineHeight: 1.1 }}
              >
                {money(r.sahayakaiCostPerYear, t)}
              </div>
              <div style={{ fontSize: "13px", color: "var(--hp-muted)" }}>
                {t("₹{price} per teacher a year, GST extra").replace(
                  "{price}",
                  price,
                )}
              </div>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.5,
              color: "var(--hp-muted)",
            }}
          >
            {method}
          </p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      <p
        style={{
          marginTop: "18px",
          fontSize: "15px",
          color: "var(--hp-muted)",
        }}
      >
        {t("Per teacher, that is about {h} hours a year.").replace(
          "{h}",
          String(
            conservative
              ? r.hoursPerTeacherPerYear
              : SAVINGS_HOURS_PER_TEACHER_YEAR,
          ),
        )}{" "}
        <a href="/for-schools">{t("See the full savings method")}</a>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------ community */

function Community() {
  const { t } = useLanguage();
  return (
    <section
      id="community"
      className="wrap"
      style={{ paddingBottom: "96px", scrollMarginTop: "80px" }}
    >
      <div
        id="demo"
        style={{
          background:
            "radial-gradient(70% 120% at 90% 0%, var(--hp-saffron-70), transparent 60%), var(--hp-saffron-84)",
          borderRadius: "32px",
          boxShadow: "0 40px 80px -30px rgba(200,100,20,.45)",
          padding: "52px",
          display: "flex",
          flexWrap: "wrap",
          gap: "36px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: "2 1 420px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            alignItems: "flex-start",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(32px, 4.2vw, 56px)",
              lineHeight: 1.05,
            }}
          >
            {t("Bring SahayakAI to your school.")}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "20px",
              color: "var(--hp-saffron-22)",
              maxWidth: "520px",
            }}
          >
            {t("Book a demo, or join the Teachers Community.")}
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <a
              href={demoHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="hp-btn hp-btn-ink"
            >
              {t("Book a demo")}
            </a>
            <a
              href={COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hp-link"
            >
              {t("Join the community")}
            </a>
          </div>
        </div>
        <div
          style={{
            flex: "0 1 200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            background: "var(--hp-white)",
            borderRadius: "24px",
            padding: "16px 16px 14px",
            boxShadow: "0 24px 50px -20px rgba(122,60,10,.4)",
          }}
        >
          <img
            src="/images/home/community-qr.png"
            width={168}
            height={168}
            alt={t(
              "QR code to join the SahayakAI Teachers Community on WhatsApp",
            )}
            style={{
              width: "168px",
              height: "168px",
              display: "block",
              imageRendering: "pixelated",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--hp-ink)",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            {t("Scan to join the Teachers Community")}
          </span>
        </div>
      </div>
    </section>
  );
}
