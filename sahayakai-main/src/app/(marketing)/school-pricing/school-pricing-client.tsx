"use client";

import { useMemo, useState } from "react";
import {
    ArrowRight,
    Calculator,
    Users,
    Phone,
    Building2,
    Info,
    Calendar,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";

/**
 * School / chain pricing calculator (marketing, public).
 *
 * This is an ESTIMATOR and deliberately NOT the billing source of truth. The
 * canonical billed amounts live in src/lib/plan-config.ts; while pricing is
 * custom-quoted, the public tier prices are hidden and this page produces an
 * indicative annual figure a school can take into a formal quote.
 *
 * Pricing model (confirmed with founder, 2026-09-09):
 *   - Standard school annual rate : ₹10,000 / teacher / year (after the annual
 *     discount — roughly 48% off paying month-to-month).
 *   - Month-to-month list rate    : ₹1,600 / teacher / month.
 *   - Parent calls                : ₹4 / minute, sized by the school from
 *     student count × calls per student per year × average call length.
 *
 * Chain volume discount steps down the per-teacher annual rate for larger
 * rollouts. These steps are indicative — the final rate is set in the quote.
 */
const ANNUAL_PER_TEACHER = 10000; // ₹/teacher/year
const MONTHLY_PER_TEACHER = 1600; // ₹/teacher/month
const PARENT_CALL_RATE_PER_MIN = 4; // ₹/minute

type VolumeTier = { min: number; max: number | null; discount: number; label: string };

// Indicative chain volume discount off the standard annual per-teacher rate.
const VOLUME_TIERS: VolumeTier[] = [
    { min: 1, max: 49, discount: 0, label: "1–49 teachers" },
    { min: 50, max: 199, discount: 0.1, label: "50–199 teachers" },
    { min: 200, max: 499, discount: 0.15, label: "200–499 teachers" },
    { min: 500, max: null, discount: 0.2, label: "500+ teachers" },
];

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

function tierFor(teachers: number): VolumeTier {
    return (
        VOLUME_TIERS.find((tier) => teachers >= tier.min && (tier.max === null || teachers <= tier.max)) ??
        VOLUME_TIERS[0]
    );
}

export function SchoolPricingClient() {
    const { openAuthModal } = useAuth();
    const { t } = useLanguage();

    const [teachers, setTeachers] = useState(25);
    const [billing, setBilling] = useState<"annual" | "monthly">("annual");
    const [includeCalls, setIncludeCalls] = useState(true);
    const [students, setStudents] = useState(400);
    const [callsPerYear, setCallsPerYear] = useState(6);
    const [avgMinutes, setAvgMinutes] = useState(3);

    const calc = useMemo(() => {
        const safeTeachers = Math.max(0, Math.floor(teachers) || 0);
        const tier = tierFor(safeTeachers || 1);
        const effAnnualPerTeacher = Math.round(ANNUAL_PER_TEACHER * (1 - tier.discount));

        // Annualise both cadences so totals are comparable.
        const teacherAnnual = safeTeachers * effAnnualPerTeacher;
        const teacherMonthlyAnnualised = safeTeachers * MONTHLY_PER_TEACHER * 12;
        const teacherSubtotal = billing === "annual" ? teacherAnnual : teacherMonthlyAnnualised;

        const safeStudents = Math.max(0, Math.floor(students) || 0);
        const safeCalls = Math.max(0, Math.floor(callsPerYear) || 0);
        const safeAvg = Math.max(0, avgMinutes || 0);
        const callMinutesPerYear = includeCalls ? safeStudents * safeCalls * safeAvg : 0;
        const callCostPerYear = callMinutesPerYear * PARENT_CALL_RATE_PER_MIN;

        const totalPerYear = teacherSubtotal + callCostPerYear;

        // Annual saving vs paying month-to-month for the same teacher count.
        const annualSavingVsMonthly = Math.max(0, teacherMonthlyAnnualised - teacherAnnual);
        const annualSavingPct =
            teacherMonthlyAnnualised > 0
                ? Math.round((annualSavingVsMonthly / teacherMonthlyAnnualised) * 100)
                : 0;

        return {
            safeTeachers,
            tier,
            effAnnualPerTeacher,
            teacherSubtotal,
            teacherAnnual,
            teacherMonthlyAnnualised,
            callMinutesPerYear,
            callCostPerYear,
            totalPerYear,
            annualSavingVsMonthly,
            annualSavingPct,
        };
    }, [teachers, billing, includeCalls, students, callsPerYear, avgMinutes]);

    const quoteHref = useMemo(() => {
        const lines = [
            "Hello SARGVISION team,",
            "",
            "We would like a formal quote for SahayakAI. Our estimate from the calculator:",
            "",
            `Teachers: ${calc.safeTeachers}`,
            `Billing: ${billing === "annual" ? "Annual" : "Monthly"}`,
            `Effective rate: ₹${inr(calc.effAnnualPerTeacher)}/teacher/year (${calc.tier.label})`,
            `Teacher subtotal: ₹${inr(calc.teacherSubtotal)}/year`,
            includeCalls
                ? `Parent calls: ${students} students × ${callsPerYear} calls/yr × ${avgMinutes} min = ${inr(
                      calc.callMinutesPerYear
                  )} min/yr → ₹${inr(calc.callCostPerYear)}/year`
                : "Parent calls: not included",
            `Estimated total: ₹${inr(calc.totalPerYear)}/year`,
            "",
            "Please share a formal quote and next steps.",
        ];
        return `mailto:contact@sargvision.com?subject=${encodeURIComponent(
            "SahayakAI school quote request"
        )}&body=${encodeURIComponent(lines.join("\n"))}`;
    }, [calc, billing, includeCalls, students, callsPerYear, avgMinutes]);

    return (
        <div className="flex flex-col min-h-screen">
            <LandingNav onAuthClick={openAuthModal} />

            <div
                className="relative flex-1"
                style={{
                    background:
                        "radial-gradient(ellipse 90% 70% at 50% 40%, hsl(28 75% 94%) 0%, hsl(34 60% 97%) 32%, hsl(40 20% 99.5%) 64%, hsl(40 20% 99.5%) 100%)",
                }}
            >
                <ScriptMarks />

                <main>
                    {/* Hero */}
                    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 sm:px-12 pt-14 pb-6">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-saffron-700 bg-saffron-50 border border-saffron-200 rounded-full px-4 py-1.5 mb-6">
                            <Calculator className="w-3.5 h-3.5" strokeWidth={2.2} />
                            {t("School pricing calculator")}
                        </div>
                        <h1 className="font-headline font-extrabold tracking-tight text-4xl sm:text-5xl leading-tight max-w-[22ch] text-foreground">
                            {t("Size SahayakAI for your school")}{" "}
                            <span className="italic font-normal text-saffron-700">{t("or your whole chain.")}</span>
                        </h1>
                        <p className="font-body text-base sm:text-lg text-muted-foreground leading-[1.6] max-w-[56ch] mt-5 mx-auto">
                            {t("Per-teacher pricing with volume discounts, plus optional AI parent calls billed by the minute. This is an indicative figure — your final rate is confirmed in a written quote.")}
                        </p>
                    </section>

                    {/* Calculator grid */}
                    <section className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center">
                        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {/* Inputs */}
                            <div className="lg:col-span-3 flex flex-col gap-6">
                                {/* Teachers + billing */}
                                <div className="rounded-surface-lg bg-card border border-border p-6 shadow-soft">
                                    <SectionHeader icon={Users} label={t("Teachers")} />
                                    <NumberSlider
                                        id="teachers"
                                        value={teachers}
                                        onChange={setTeachers}
                                        min={1}
                                        max={1000}
                                        step={1}
                                        unit={t("teachers")}
                                    />

                                    <div className="mt-5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                                            {t("Billing")}
                                        </div>
                                        <div className="inline-flex items-center rounded-full border border-border bg-muted p-0.5">
                                            <TogglePill
                                                active={billing === "annual"}
                                                onClick={() => setBilling("annual")}
                                                label={t("Annual")}
                                            />
                                            <TogglePill
                                                active={billing === "monthly"}
                                                onClick={() => setBilling("monthly")}
                                                label={t("Monthly")}
                                            />
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground leading-[1.5]">
                                            {billing === "annual"
                                                ? `${t("Standard school rate")}: ₹${inr(ANNUAL_PER_TEACHER)}${t("/teacher/year")}`
                                                : `${t("Month-to-month rate")}: ₹${inr(MONTHLY_PER_TEACHER)}${t("/teacher/month")}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Parent calls */}
                                <div className="rounded-surface-lg bg-card border border-border p-6 shadow-soft">
                                    <div className="flex items-center justify-between">
                                        <SectionHeader icon={Phone} label={t("Parent calls")} />
                                        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={includeCalls}
                                                onChange={(e) => setIncludeCalls(e.target.checked)}
                                                className="h-4 w-4 rounded-surface-sm accent-saffron-600 cursor-pointer"
                                            />
                                            {t("Include")}
                                        </label>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground leading-[1.5]">
                                        {`${t("AI parent calls are billed at")} ₹${PARENT_CALL_RATE_PER_MIN}${t("/minute")}. ${t("Size them from your student count.")}`}
                                    </p>

                                    <div
                                        className={`mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 ${
                                            includeCalls ? "" : "opacity-40 pointer-events-none"
                                        }`}
                                        aria-hidden={!includeCalls}
                                    >
                                        <MiniNumber
                                            id="students"
                                            label={t("Students")}
                                            value={students}
                                            onChange={setStudents}
                                            min={0}
                                            step={10}
                                        />
                                        <MiniNumber
                                            id="callsPerYear"
                                            label={t("Calls / student / year")}
                                            value={callsPerYear}
                                            onChange={setCallsPerYear}
                                            min={0}
                                            step={1}
                                        />
                                        <MiniNumber
                                            id="avgMinutes"
                                            label={t("Avg minutes / call")}
                                            value={avgMinutes}
                                            onChange={setAvgMinutes}
                                            min={0}
                                            step={0.5}
                                        />
                                    </div>

                                    {includeCalls && (
                                        <p className="mt-4 text-sm text-muted-foreground leading-[1.5]">
                                            {`${inr(students)} × ${callsPerYear} × ${avgMinutes} = `}
                                            <span className="font-semibold text-foreground">
                                                {`${inr(calc.callMinutesPerYear)} ${t("minutes / year")}`}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                {/* How it's calculated */}
                                <div className="rounded-surface-lg bg-saffron-50 border border-saffron-200 p-6">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-3">
                                        <Info className="h-3.5 w-3.5" />
                                        {t("How this is calculated")}
                                    </div>
                                    <dl className="space-y-2 text-sm text-muted-foreground leading-[1.5]">
                                        <Row
                                            label={t("Your volume tier")}
                                            value={`${calc.tier.label}${
                                                calc.tier.discount > 0 ? ` · ${Math.round(calc.tier.discount * 100)}% ${t("off")}` : ""
                                            }`}
                                        />
                                        <Row
                                            label={t("Effective per-teacher rate")}
                                            value={`₹${inr(calc.effAnnualPerTeacher)}${t("/teacher/year")}`}
                                        />
                                        <Row label={t("Parent-call rate")} value={`₹${PARENT_CALL_RATE_PER_MIN}${t("/minute")}`} />
                                    </dl>
                                    <p className="mt-3 text-xs text-muted-foreground leading-[1.5]">
                                        {t("Volume tiers are indicative. Larger chains and government tenders are quoted individually.")}
                                    </p>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="lg:col-span-2">
                                <div className="lg:sticky lg:top-24 rounded-surface-lg bg-card border border-border p-6 shadow-elevated">
                                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700 mb-4">
                                        {t("Your estimate")}
                                    </div>

                                    <SummaryLine
                                        label={`${inr(calc.safeTeachers)} ${t("teachers")} × ₹${inr(
                                            billing === "annual" ? calc.effAnnualPerTeacher : MONTHLY_PER_TEACHER * 12
                                        )}`}
                                        value={`₹${inr(calc.teacherSubtotal)}`}
                                    />
                                    {billing === "annual" && calc.annualSavingPct > 0 && (
                                        <p className="mt-1 text-sm text-saffron-700 font-medium">
                                            {`${t("Saves")} ₹${inr(calc.annualSavingVsMonthly)} (${calc.annualSavingPct}%) ${t("vs paying monthly")}`}
                                        </p>
                                    )}

                                    {includeCalls && (
                                        <div className="mt-3">
                                            <SummaryLine
                                                label={`${t("Parent calls")} · ${inr(calc.callMinutesPerYear)} ${t("min")}`}
                                                value={`₹${inr(calc.callCostPerYear)}`}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-5 pt-5 border-t border-border">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-medium text-muted-foreground">{t("Total per year")}</span>
                                            <span className="font-headline font-extrabold tracking-tight text-4xl text-saffron-700 leading-none">
                                                ₹{inr(calc.totalPerYear)}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {`≈ ₹${inr(calc.totalPerYear / 12)} ${t("/ month")}`}
                                        </p>
                                    </div>

                                    <a
                                        href={quoteHref}
                                        className="mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors cursor-pointer"
                                    >
                                        {t("Get a formal quote")}
                                        <ArrowRight className="h-4 w-4" />
                                    </a>
                                    <a
                                        href="https://calendly.com/contact-sargvision/30min"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2.5 w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-card border border-border text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Calendar className="h-4 w-4" strokeWidth={2.2} />
                                        {t("Book a school demo")}
                                    </a>

                                    <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground leading-[1.5]">
                                        <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-saffron-700" />
                                        {t("Indicative only. Final pricing is set in a written quote after a short call.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>

            <LandingFooter />
        </div>
    );
}

// ---- sub-components ----

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-surface-md bg-saffron-50 text-saffron-700">
                <Icon className="h-4 w-4" />
            </span>
            <span className="font-headline font-semibold text-lg text-foreground">{label}</span>
        </div>
    );
}

function NumberSlider({
    id,
    value,
    onChange,
    min,
    max,
    step,
    unit,
}: {
    id: string;
    value: number;
    onChange: (n: number) => void;
    min: number;
    max: number;
    step: number;
    unit: string;
}) {
    return (
        <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min={min}
                        value={Number.isFinite(value) ? value : ""}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-24 rounded-surface-md border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
                    />
                    <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
            </div>
            <input
                type="range"
                aria-label={id}
                min={min}
                max={max}
                step={step}
                value={Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-3 w-full accent-saffron-600 cursor-pointer"
            />
        </div>
    );
}

function MiniNumber({
    id,
    label,
    value,
    onChange,
    min,
    step,
}: {
    id: string;
    label: string;
    value: number;
    onChange: (n: number) => void;
    min: number;
    step: number;
}) {
    return (
        <div>
            <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
                {label}
            </label>
            <input
                id={id}
                type="number"
                inputMode="decimal"
                min={min}
                step={step}
                value={Number.isFinite(value) ? value : ""}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full rounded-surface-md border border-border bg-background px-3 py-2 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
            />
        </div>
    );
}

function TogglePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors cursor-pointer ${
                active ? "bg-saffron text-white shadow-soft" : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
        </button>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt>{label}</dt>
            <dd className="font-semibold text-foreground whitespace-nowrap">{value}</dd>
        </div>
    );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground whitespace-nowrap">{value}</span>
        </div>
    );
}
