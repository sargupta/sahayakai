"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import {
    FIELD_LIMITS,
    isValidEmail,
    isValidIndianPhone,
    normalizePhone,
    serverErrorCode,
    serverErrorText,
    submitQuoteRequest,
    type QuoteEstimate,
} from "@/lib/api/access";
import { tState } from "@/lib/i18n-proper-nouns";
import { EDUCATION_BOARDS, INDIAN_STATES } from "@/types";

/**
 * Formal quote request (replaces the old pre-filled mailto, which let anyone
 * extract a "formal quote" email without naming a school). Posts to the
 * public POST /api/access/quote — see docs/ACCESS_GATE_DESIGN.md.
 *
 * Turnstile follows the /try-call pattern: the widget renders only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is provisioned; the server enforces the
 * matching secret and its own rate limits either way.
 */

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
    render: (el: HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback"?: () => void;
    }) => string;
    reset: (widgetId?: string) => void;
};

/**
 * The estimate as the server accepts it: whole numbers for counts, and the
 * parent-call inputs zeroed when calls are not part of the quote (the server
 * otherwise checks them for consistency against the teacher count).
 */
export function normalizeEstimate(estimate: QuoteEstimate): QuoteEstimate {
    const int = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    const calls = estimate.includeParentCalls;
    return {
        ...estimate,
        teachers: Math.max(1, int(estimate.teachers)),
        students: calls ? int(estimate.students) : 0,
        callsPerStudentPerYear: calls ? int(estimate.callsPerStudentPerYear) : 0,
        avgMinutesPerCall: calls && Number.isFinite(estimate.avgMinutesPerCall) && estimate.avgMinutesPerCall > 0
            ? estimate.avgMinutesPerCall
            : 0,
    };
}
const getTurnstile = (): TurnstileApi | undefined =>
    (window as unknown as { turnstile?: TurnstileApi }).turnstile;

const ROLE_OPTIONS = [
    "Principal",
    "Vice Principal",
    "Academic Coordinator",
    "School owner or trustee",
    "IT administrator",
    "Other",
] as const;

type FieldKey = "schoolName" | "contactName" | "role" | "email" | "phone" | "city" | "state";
type Phase = "idle" | "submitting" | "done";

const INPUT_CLASS =
    "w-full rounded-surface-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600";
const LABEL_CLASS = "block text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5";

export function QuoteRequestForm({ estimate }: { estimate: QuoteEstimate }) {
    const { t, language } = useLanguage();
    const [values, setValues] = useState({
        schoolName: "", contactName: "", role: "", email: "", phone: "",
        board: "", affiliationNumber: "", city: "", state: "",
    });
    const [invalid, setInvalid] = useState<FieldKey[]>([]);
    const [phase, setPhase] = useState<Phase>("idle");
    const [error, setError] = useState<string | null>(null);
    const turnstileToken = useRef<string | null>(null);
    const turnstileEl = useRef<HTMLDivElement | null>(null);
    const turnstileWidget = useRef<string | null>(null);

    /** A Turnstile token is single-use: after any failed submit, get a new one. */
    const resetTurnstile = useCallback(() => {
        turnstileToken.current = null;
        try {
            getTurnstile()?.reset(turnstileWidget.current ?? undefined);
        } catch {
            // Widget not rendered yet; the next render issues a fresh token.
        }
    }, []);

    const renderTurnstile = useCallback(() => {
        const api = getTurnstile();
        if (TURNSTILE_SITE_KEY && api && turnstileEl.current && turnstileEl.current.childElementCount === 0) {
            turnstileWidget.current = api.render(turnstileEl.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token) => { turnstileToken.current = token; },
                "expired-callback": () => { turnstileToken.current = null; },
            });
        }
    }, []);

    // The script may already be on the page (cached from /try-call).
    useEffect(() => { renderTurnstile(); }, [renderTurnstile]);

    function set(key: keyof typeof values, value: string) {
        setValues((prev) => ({ ...prev, [key]: value }));
    }

    function validate(): FieldKey[] {
        const bad: FieldKey[] = [];
        if (values.schoolName.trim().length < 3 || values.schoolName.trim().length > FIELD_LIMITS.schoolName) bad.push("schoolName");
        if (values.contactName.trim().length < 2 || values.contactName.trim().length > FIELD_LIMITS.contactName) bad.push("contactName");
        if (!values.role) bad.push("role");
        if (!isValidEmail(values.email)) bad.push("email");
        if (!isValidIndianPhone(values.phone)) bad.push("phone");
        if (values.city.trim().length < 2 || values.city.trim().length > FIELD_LIMITS.city) bad.push("city");
        if (!values.state) bad.push("state");
        return bad;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const bad = validate();
        setInvalid(bad);
        if (bad.length > 0) {
            setError(t("Please check the highlighted fields."));
            return;
        }
        if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
            setError(t("Please complete the verification check."));
            return;
        }
        setPhase("submitting");
        try {
            await submitQuoteRequest({
                schoolName: values.schoolName.trim(),
                contactName: values.contactName.trim(),
                role: values.role,
                email: values.email.trim(),
                phone: normalizePhone(values.phone),
                board: values.board || undefined,
                affiliationNumber: values.affiliationNumber.trim() || undefined,
                city: values.city.trim(),
                state: values.state,
                estimate: normalizeEstimate(estimate),
                turnstileToken: turnstileToken.current ?? undefined,
            });
            setPhase("done");
        } catch (err) {
            setPhase("idle");
            resetTurnstile();
            const status = err instanceof ApiError ? err.status : 0;
            const code = serverErrorCode(err);
            setError(
                code === "TURNSTILE_FAILED" ? t("The verification check did not pass. Please complete it again and resend.")
                : status === 429 || code === "RATE_LIMITED" ? t("Too many requests. Please try again later.")
                // The server names the field it rejected; show that rather
                // than a generic line with nothing highlighted.
                : status === 400 ? (serverErrorText(err) ?? t("Please check the highlighted fields."))
                : t("Something went wrong. Please try again."),
            );
        }
    }

    if (phase === "done") {
        return (
            <div role="status" className="mt-6 rounded-surface-md border border-saffron-200 bg-saffron-50 p-4 text-sm text-foreground">
                <p className="flex items-start gap-2 font-semibold">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-saffron-700" aria-hidden />
                    {t("Quote request received")}
                </p>
                <p className="mt-1.5 text-muted-foreground leading-[1.5]">
                    {t("Thank you. We will verify the school details and send a written quote to the email address provided.")}
                </p>
            </div>
        );
    }

    const bad = (k: FieldKey) => invalid.includes(k);
    const busy = phase === "submitting";
    const ring = (k: FieldKey) => (bad(k) ? `${INPUT_CLASS} border-destructive` : INPUT_CLASS);

    return (
        <form onSubmit={onSubmit} noValidate aria-busy={busy} className="mt-6 space-y-3 border-t border-border pt-5">
            {TURNSTILE_SITE_KEY ? (
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" onLoad={renderTurnstile} />
            ) : null}
            <p className="text-sm font-semibold text-foreground">{t("Request a formal quote")}</p>
            <p className="text-xs text-muted-foreground leading-[1.5]">
                {t("The quote is prepared for the estimate above. We verify each school before sending it.")}
            </p>

            <div>
                <label htmlFor="q-school" className={LABEL_CLASS}>{t("School name")}</label>
                <input id="q-school" maxLength={FIELD_LIMITS.schoolName} className={ring("schoolName")} value={values.schoolName} required disabled={busy}
                    autoComplete="organization" aria-invalid={bad("schoolName") || undefined}
                    onChange={(e) => set("schoolName", e.target.value)} />
            </div>
            <div>
                <label htmlFor="q-contact" className={LABEL_CLASS}>{t("Contact name")}</label>
                <input id="q-contact" maxLength={FIELD_LIMITS.contactName} className={ring("contactName")} value={values.contactName} required disabled={busy}
                    autoComplete="name" aria-invalid={bad("contactName") || undefined}
                    onChange={(e) => set("contactName", e.target.value)} />
            </div>
            <div>
                <label htmlFor="q-role" className={LABEL_CLASS}>{t("Your role at school")}</label>
                <select id="q-role" className={ring("role")} value={values.role} required disabled={busy}
                    aria-invalid={bad("role") || undefined} onChange={(e) => set("role", e.target.value)}>
                    <option value="">{t("Select")}</option>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="q-email" className={LABEL_CLASS}>{t("Official email")}</label>
                <input id="q-email" maxLength={FIELD_LIMITS.email} type="email" className={ring("email")} value={values.email} required disabled={busy}
                    autoComplete="email" aria-invalid={bad("email") || undefined}
                    onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
                <label htmlFor="q-phone" className={LABEL_CLASS}>{t("Phone number")}</label>
                <input id="q-phone" maxLength={FIELD_LIMITS.phone} type="tel" inputMode="tel" className={ring("phone")} value={values.phone} required disabled={busy}
                    autoComplete="tel" aria-invalid={bad("phone") || undefined}
                    onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
                <label htmlFor="q-board" className={LABEL_CLASS}>{`${t("Board")} (${t("Optional")})`}</label>
                <select id="q-board" className={INPUT_CLASS} value={values.board} disabled={busy}
                    onChange={(e) => set("board", e.target.value)}>
                    <option value="">{t("Select")}</option>
                    {EDUCATION_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    <option value="Other">{t("Other")}</option>
                </select>
            </div>
            <div>
                <label htmlFor="q-affiliation" className={LABEL_CLASS}>{`${t("Board affiliation number")} (${t("Optional")})`}</label>
                <input id="q-affiliation" maxLength={FIELD_LIMITS.affiliationNumber} className={INPUT_CLASS} value={values.affiliationNumber} disabled={busy}
                    autoComplete="off" onChange={(e) => set("affiliationNumber", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="q-city" className={LABEL_CLASS}>{t("City or town")}</label>
                    <input id="q-city" maxLength={FIELD_LIMITS.city} className={ring("city")} value={values.city} required disabled={busy}
                        autoComplete="address-level2" aria-invalid={bad("city") || undefined}
                        onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                    <label htmlFor="q-state" className={LABEL_CLASS}>{t("State")}</label>
                    <select id="q-state" className={ring("state")} value={values.state} required disabled={busy}
                        aria-invalid={bad("state") || undefined} onChange={(e) => set("state", e.target.value)}>
                        <option value="">{t("Select")}</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{tState(s, language)}</option>)}
                    </select>
                </div>
            </div>

            {TURNSTILE_SITE_KEY ? <div ref={turnstileEl} /> : null}

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-6 py-3 rounded-full bg-saffron text-white shadow-elevated hover:bg-saffron-600 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t("Send quote request")}
                {busy ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
        </form>
    );
}
