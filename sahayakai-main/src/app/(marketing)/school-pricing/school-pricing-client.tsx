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
    TrendingUp,
    Clock,
    Eye,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ScriptMarks } from "@/components/landing/script-marks";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import {
    estimateSchoolCost,
    estimateSchoolSavings,
    SCHOOL_PRICING,
    SAVINGS_CAPABILITIES,
    SAVINGS_HOURS_PER_TEACHER_YEAR,
    SAVINGS_WEEKLY_HOURS,
    type Billing,
} from "@/lib/school-pricing";

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
/** Compact ₹ for large sums: ₹18.0L / ₹1.4Cr. */
const inrShort = (n: number) => {
    if (n >= 1e7) return `${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr`;
    if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
    return inr(n);
};
const GST_PCT = Math.round(SCHOOL_PRICING.gstRate * 100);

export function SchoolPricingClient() {
    const { openAuthModal } = useAuth();
    const { t } = useLanguage();

    const [teachers, setTeachers] = useState(50);
    const [billing, setBilling] = useState<Billing>("annual");
    const [includeCalls, setIncludeCalls] = useState(true);
    const [students, setStudents] = useState(400);
    const [callsPerYear, setCallsPerYear] = useState(6);
    const [avgMinutes, setAvgMinutes] = useState(3);
    const [salary, setSalary] = useState(30000);

    const calc = useMemo(
        () =>
            estimateSchoolCost({
                teachers,
                billing,
                includeParentCalls: includeCalls,
                students,
                callsPerStudentPerYear: callsPerYear,
                avgMinutesPerCall: avgMinutes,
            }),
        [teachers, billing, includeCalls, students, callsPerYear, avgMinutes]
    );

    const savings = useMemo(
        () => estimateSchoolSavings({ teachers, salaryPerMonth: salary }),
        [teachers, salary]
    );

    const quoteHref = useMemo(() => {
        const lines = [
            "Hello SARGVISION team,",
            "",
            "We would like a formal quote for SahayakAI. Our estimate from the calculator:",
            "",
            `Teachers: ${calc.teachers}`,
            `Billing: ${billing === "annual" ? "Annual (Rs 10,000/teacher/year)" : "Monthly (Rs 1,600/teacher/month)"}`,
            `Teacher subtotal: Rs ${inr(calc.teacherSubtotal)}/year`,
            includeCalls
                ? `Parent calls: ${students} students x ${callsPerYear} calls/yr x ${avgMinutes} min = ${inr(
                      calc.parentCallMinutesPerYear
                  )} min/yr -> Rs ${inr(calc.parentCallCostPerYear)}/year`
                : "Parent calls: not included",
            `Subtotal: Rs ${inr(calc.subtotalPerYear)}/year (excl. GST)`,
            `With ${GST_PCT}% GST: Rs ${inr(calc.totalPerYearInclGst)}/year`,
            "",
            "We understand chains and large schools are quoted a further discount. Please share a formal quote and next steps.",
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
                            {t("₹10,000 per teacher a year — about ₹833 a month, billed annually. Prefer month-to-month, no commitment? ₹1,600 per teacher a month. Add AI parent calls at ₹4 a minute. Chains and large schools get a further discount, confirmed in a written quote.")}
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
                                        ariaLabel={t("Number of teachers")}
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
                                                label={`${t("Annual")} · ₹${inr(SCHOOL_PRICING.annualPerTeacher)}`}
                                            />
                                            <TogglePill
                                                active={billing === "monthly"}
                                                onClick={() => setBilling("monthly")}
                                                label={`${t("Monthly")} · ₹${inr(SCHOOL_PRICING.monthlyPerTeacher)}`}
                                            />
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground leading-[1.5]">
                                            {billing === "annual"
                                                ? `₹${inr(SCHOOL_PRICING.annualPerTeacher)}${t("/teacher/year")} · ≈ ₹${inr(
                                                      SCHOOL_PRICING.annualPerTeacher / 12
                                                  )}${t("/month, billed annually")}`
                                                : `₹${inr(SCHOOL_PRICING.monthlyPerTeacher)}${t("/teacher/month")} · ${t("no annual commitment")}`}
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
                                        {`${t("AI parent calls are billed on usage at")} ₹${SCHOOL_PRICING.parentCallRatePerMin}${t("/minute")}. ${t("Size them from your student count.")}`}
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
                                                {`${inr(calc.parentCallMinutesPerYear)} ${t("minutes / year")}`}
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
                                            label={t("Annual rate")}
                                            value={`₹${inr(SCHOOL_PRICING.annualPerTeacher)}${t("/teacher/year")}`}
                                        />
                                        <Row
                                            label={t("Monthly rate")}
                                            value={`₹${inr(SCHOOL_PRICING.monthlyPerTeacher)}${t("/teacher/month")}`}
                                        />
                                        <Row
                                            label={t("Parent-call rate")}
                                            value={`₹${SCHOOL_PRICING.parentCallRatePerMin}${t("/minute")}`}
                                        />
                                        <Row label={t("GST")} value={`${GST_PCT}%`} />
                                    </dl>
                                    <p className="mt-3 text-xs text-muted-foreground leading-[1.5]">
                                        {t("Chains and large schools are quoted a further discount off the annual rate. The final figure is set in your written quote.")}
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
                                        label={`${inr(calc.teachers)} ${t("teachers")} × ₹${inr(calc.perTeacherPerYear)}`}
                                        value={`₹${inr(calc.teacherSubtotal)}`}
                                    />
                                    {billing === "monthly" && calc.annualSavingVsMonthly > 0 && (
                                        <p className="mt-1 text-sm text-saffron-700 font-medium">
                                            {`${t("Pay annually and save")} ₹${inr(calc.annualSavingVsMonthly)}${t("/year")}`}
                                        </p>
                                    )}

                                    {includeCalls && (
                                        <div className="mt-3">
                                            <SummaryLine
                                                label={`${t("Parent calls")} · ${inr(calc.parentCallMinutesPerYear)} ${t("min")}`}
                                                value={`₹${inr(calc.parentCallCostPerYear)}`}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-border">
                                        <SummaryLine label={t("Subtotal (excl. GST)")} value={`₹${inr(calc.subtotalPerYear)}`} />
                                        <div className="mt-1.5">
                                            <SummaryLine label={`${t("GST")} ${GST_PCT}%`} value={`₹${inr(calc.gst)}`} />
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-border">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-medium text-muted-foreground">{t("Total per year")}</span>
                                            <span className="font-headline font-extrabold tracking-tight text-4xl text-saffron-700 leading-none">
                                                ₹{inr(calc.totalPerYearInclGst)}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {`${t("incl. GST")} · ≈ ₹${inr(calc.totalPerYearInclGst / 12)} ${t("/ month")}`}
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

                    {/* ── What your school gets back (value / savings) ── */}
                    <section className="relative z-10 px-6 sm:px-12 pb-16 flex justify-center">
                        <div className="max-w-5xl w-full rounded-surface-lg bg-card border border-border p-6 sm:p-8 shadow-elevated">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-saffron-700 mb-3">
                                <TrendingUp className="h-3.5 w-3.5" />
                                {t("What your school gets back")}
                            </div>
                            <h2 className="font-headline font-extrabold tracking-tight text-2xl sm:text-3xl text-foreground max-w-[26ch] leading-tight">
                                {t("Every teacher gets time back — worth far more than the plan costs.")}
                            </h2>

                            {/* Salary control — the saving scales with it */}
                            <div className="mt-6 rounded-surface-md bg-muted border border-border p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <label htmlFor="salary" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        {t("Average teacher salary")}
                                    </label>
                                    <span className="text-sm font-semibold text-foreground">₹{inr(salary)}{t("/month")}</span>
                                </div>
                                <input
                                    id="salary"
                                    type="range"
                                    aria-label={t("Average teacher salary per month")}
                                    min={15000}
                                    max={80000}
                                    step={1000}
                                    value={Math.min(80000, Math.max(15000, Number.isFinite(salary) ? salary : 30000))}
                                    onChange={(e) => setSalary(Number(e.target.value))}
                                    className="mt-3 w-full accent-saffron-600 cursor-pointer"
                                />
                                <p className="mt-1.5 text-xs text-muted-foreground leading-[1.5]">
                                    {t("Set it to your school's average — the value scales with what your teachers' time is worth.")}
                                </p>
                            </div>

                            {/* Headline stats */}
                            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="rounded-surface-md bg-saffron-50 border border-saffron-200 p-5">
                                    <div className="font-headline font-extrabold tracking-tight text-3xl sm:text-4xl text-saffron-700 leading-none">
                                        ₹{inrShort(savings.netSavingsPerYear)}
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-muted-foreground leading-[1.4]">
                                        {t("saved every year, after the plan")}
                                    </div>
                                </div>
                                <StatTile
                                    icon={Clock}
                                    value={inr(savings.hoursReclaimedSchool)}
                                    label={`${t("hours back a year")} · ≈ ${savings.fteEquivalent.toFixed(1)} ${t("full teachers' time")}`}
                                />
                                <StatTile
                                    icon={TrendingUp}
                                    value={`${savings.roiMultiple.toFixed(1)}×`}
                                    label={t("value for every ₹1 on the plan")}
                                />
                                <StatTile
                                    icon={Calculator}
                                    value={`${savings.paybackMonths < 10 ? savings.paybackMonths.toFixed(1) : Math.round(savings.paybackMonths)} ${t("months")}`}
                                    label={t("to pay for itself")}
                                />
                            </div>

                            <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* The arithmetic */}
                                <div className="rounded-surface-md border border-border p-5">
                                    <div className="text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-3">
                                        {t("How the saving is worked out")}
                                    </div>
                                    <div className="space-y-1.5">
                                        <SummaryLine
                                            label={`${inr(savings.teachers)} ${t("teachers")} × ${SAVINGS_HOURS_PER_TEACHER_YEAR} ${t("hrs each")}`}
                                            value={`${inr(savings.hoursReclaimedSchool)} ${t("hrs")}`}
                                        />
                                        <SummaryLine label={t("Value of that time")} value={`₹${inr(savings.valueSchoolPerYear)}`} />
                                        <SummaryLine label={t("You pay SahayakAI")} value={`− ₹${inr(savings.sahayakaiCostPerYear)}`} />
                                        <div className="mt-2 pt-2 border-t border-border">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-sm font-semibold text-foreground">{t("Your school keeps")}</span>
                                                <span className="font-headline font-extrabold tracking-tight text-xl text-saffron-700 whitespace-nowrap">
                                                    ₹{inr(savings.netSavingsPerYear)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Where the hours come from */}
                                <div className="rounded-surface-md border border-border p-5">
                                    <div className="text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-3">
                                        {t("Where the hours come from")}
                                    </div>
                                    <dl className="space-y-1.5 text-sm text-muted-foreground leading-[1.5]">
                                        {SAVINGS_CAPABILITIES.map((c) => (
                                            <Row key={c.name} label={t(c.name)} value={`${c.hoursPerWeek} ${t("hrs/wk")}`} />
                                        ))}
                                        <div className="pt-2 mt-1 border-t border-border">
                                            <Row
                                                label={t("Total per teacher")}
                                                value={`${SAVINGS_WEEKLY_HOURS.toFixed(1)} ${t("hrs/wk")}`}
                                            />
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            {/* Accountability */}
                            <div className="mt-6 rounded-surface-md bg-saffron-50 border border-saffron-200 p-5">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-saffron-700 mb-2">
                                    <Eye className="h-3.5 w-3.5" />
                                    {t("And you can see it working")}
                                </div>
                                <p className="text-sm text-muted-foreground leading-[1.55]">
                                    {t("The principal dashboard shows what each teacher actually produces — lesson plans, quizzes and worksheets, aligned to your board. You can see who is preparing proper material and who needs support, so the time saved becomes better teaching, not guesswork.")}
                                </p>
                            </div>

                            {/* How it's calculated */}
                            <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground leading-[1.5]">
                                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-saffron-700" />
                                {t("Based on 410 hours saved per teacher a year across 9 tools (10.8 hrs/week × 38 teaching weeks), valued at each teacher's own cost of time (salary ÷ 176 paid hours). Deliberately conservative; the plan price is confirmed in your written quote.")}
                            </p>
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
    ariaLabel,
    value,
    onChange,
    min,
    max,
    step,
    unit,
}: {
    id: string;
    ariaLabel: string;
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
                        aria-label={ariaLabel}
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
                aria-label={ariaLabel}
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

function StatTile({
    icon: Icon,
    value,
    label,
}: {
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    label: string;
}) {
    return (
        <div className="rounded-surface-md bg-card border border-border p-5">
            <div className="flex items-center gap-1.5 text-saffron-700 mb-1.5">
                <Icon className="h-4 w-4" />
            </div>
            <div className="font-headline font-extrabold tracking-tight text-2xl sm:text-3xl text-foreground leading-none">
                {value}
            </div>
            <div className="mt-2 text-xs font-medium text-muted-foreground leading-[1.4]">{label}</div>
        </div>
    );
}
