"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import {
    FIELD_LIMITS,
    getAccessStatus,
    getMyAccessRequest,
    normalizePhone,
    serverErrorText,
    submitAccessRequest,
    validateAccessRequest,
    type AccessRequestField,
    type AccessRequestRecord,
} from "@/lib/api/access";
import { tState } from "@/lib/i18n-proper-nouns";
import { EDUCATION_BOARDS, INDIAN_STATES } from "@/types";
import {
    ACCESS_PRIMARY, AccessCard, AccessLoading, AccessOrb, AccessPanel, AccessPill, AccessShell,
    FIELD_CONTROL, FieldCard, InlineError,
} from "../access/access-shell";

/** Sent to the server as these English values; labels are translated. */
const ROLE_OPTIONS = [
    "Principal",
    "Vice Principal",
    "Academic Coordinator",
    "Head of Department",
    "Teacher",
    "School owner or trustee",
    "IT administrator",
    "Other",
] as const;

type Phase = "loading" | "form" | "submitting" | "submitted" | "existing" | "error";

interface FormState {
    schoolName: string;
    role: string;
    board: string;
    affiliationNumber: string;
    city: string;
    state: string;
    phone: string;
    teacherCount: string;
    message: string;
    acceptTerms: boolean;
}

const EMPTY: FormState = {
    schoolName: "", role: "", board: "", affiliationNumber: "", city: "",
    state: "", phone: "", teacherCount: "", message: "", acceptTerms: false,
};

export default function RequestAccessPage() {
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { t, language } = useLanguage();
    const [phase, setPhase] = useState<Phase>("loading");
    const [existing, setExisting] = useState<AccessRequestRecord | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [invalid, setInvalid] = useState<AccessRequestField[]>([]);
    const [error, setError] = useState<string | null>(null);
    /** True when an earlier approval has lapsed and a new request is offered. */
    const [lapsed, setLapsed] = useState(false);
    const [declined, setDeclined] = useState(false);

    const loadExisting = useCallback(async () => {
        setPhase("loading");
        try {
            const { request } = await getMyAccessRequest();
            if (!request) {
                setPhase("form");
                return;
            }
            setExisting(request);
            // An approved request whose access period has since ended may be
            // followed by a new one: offer the form, pre-filled.
            if (request.status === "approved") {
                const status = await getAccessStatus().catch(() => null);
                if (status && !status.entitled) {
                    setLapsed(true);
                    setForm((prev) => ({
                        ...prev,
                        schoolName: request.schoolName ?? "",
                        role: request.role ?? "",
                        board: request.board ?? "",
                        affiliationNumber: request.affiliationNumber ?? "",
                        city: request.city ?? "",
                        state: request.state ?? "",
                        phone: request.phone ?? "",
                    }));
                    setPhase("form");
                    return;
                }
            }
            setPhase("existing");
        } catch {
            setPhase("error");
        }
    }, []);

    useEffect(() => {
        if (authLoading || !user) return;
        void loadExisting();
    }, [authLoading, user, loadExisting]);

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const problems = validateAccessRequest(form);
        setInvalid(problems);
        if (problems.length > 0) {
            setError(t("Please check the highlighted fields."));
            return;
        }
        setPhase("submitting");
        try {
            await submitAccessRequest({
                schoolName: form.schoolName.trim(),
                role: form.role,
                board: form.board,
                affiliationNumber: form.affiliationNumber.trim() || undefined,
                city: form.city.trim(),
                state: form.state,
                phone: normalizePhone(form.phone),
                teacherCount: form.teacherCount.trim() ? Number(form.teacherCount) : undefined,
                message: form.message.trim() || undefined,
                acceptTerms: true,
            });
            setPhase("submitted");
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                if (lapsed) {
                    // The server does not take a new request for this account
                    // yet: say so and give the contact address.
                    setDeclined(true);
                    setPhase("form");
                    return;
                }
                // A decision already exists for this account: show it.
                await loadExisting();
                return;
            }
            setPhase("form");
            setError(
                err instanceof ApiError && err.status === 400
                    // The server names the field it rejected.
                    ? (serverErrorText(err) ?? t("Please check the highlighted fields."))
                    : t("Something went wrong. Please try again."),
            );
        }
    }

    if (authLoading || (user && phase === "loading")) {
        return (
            <AccessShell>
                <AccessLoading label={t("Loading...")} />
            </AccessShell>
        );
    }

    if (!user) {
        return (
            <AccessShell>
                <AccessCard title={t("Request access for your school")}>
                    <p>{t("Sign in first, so that we can link the request to your account.")}</p>
                    <button type="button" className={ACCESS_PRIMARY} onClick={openAuthModal}>{t("Sign in")}</button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "error") {
        return (
            <AccessShell>
                <AccessCard tone="ended" title={t("Request access for your school")}>
                    <InlineError message={t("Something went wrong. Please try again.")} />
                    <button type="button" className={ACCESS_PRIMARY} onClick={() => { void loadExisting(); }}>{t("Try again")}</button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "submitted") {
        return (
            <AccessShell>
                <AccessCard tone="ready" title={t("Request received")}>
                    <p className="flex items-start gap-2 rounded-tile border border-tint-success-border bg-tint-success px-4 py-3 font-medium text-leaf-700" role="status">
                        <CheckCircle2 className="mt-0 h-4 w-4 shrink-0" aria-hidden />
                        <span>{t("We verify each school before granting access. You will hear from us by email or phone.")}</span>
                    </p>
                    <Link href="/access" className={ACCESS_PRIMARY}>{t("View request status")}</Link>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "existing" && existing) {
        const label =
            existing.status === "approved" ? t("Approved")
            : existing.status === "rejected" ? t("Not approved")
            : t("Under review");
        return (
            <AccessShell>
                <AccessCard
                    tone={existing.status === "approved" ? "ready" : existing.status === "rejected" ? "ended" : "working"}
                    title={t("Your access request")}
                >
                    <dl className="divide-y divide-line-hairline">
                        <div className="flex justify-between gap-4 py-3">
                            <dt>{t("School name")}</dt>
                            <dd className="text-right font-display font-semibold text-ink-900">{existing.schoolName}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-3">
                            <dt>{t("Status")}</dt>
                            <dd className="text-right font-display font-semibold text-ink-900">{label}</dd>
                        </div>
                    </dl>
                    <Link href="/access" className={ACCESS_PRIMARY}>{t("View request status")}</Link>
                </AccessCard>
            </AccessShell>
        );
    }

    const bad = (f: AccessRequestField) => invalid.includes(f);
    const busy = phase === "submitting";

    const optional = t("Optional");
    // What a school goes through, shown beside the form.
    const steps = [
        { title: t("You send this form"), body: t("It takes about two minutes.") },
        { title: t("We verify the school"), body: t("We check the board affiliation and call the school office.") },
        { title: t("Your pilot opens"), body: t("You invite your teachers with one link.") },
    ];

    return (
        <AccessShell wide>
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
                <section className="flex flex-col gap-6">
                    <div className="flex flex-wrap gap-2">
                        <AccessPill tone="accent">{t("For schools")}</AccessPill>
                    </div>
                    <h1 className="font-display text-web-h1 font-semibold tracking-tight text-ink-900">
                        {t("Request access for your school")}
                    </h1>
                    <div className="flex items-center gap-5">
                        <AccessOrb tone="rest" size="md" />
                        <p className="max-w-md font-display text-web-lead font-medium text-ink-900">
                            {lapsed
                                ? t("The access period approved for this account has ended.")
                                : t("Tell us about your school. We verify each school before granting access.")}
                        </p>
                    </div>
                    <ol aria-label={t("What happens next")} className="flex flex-col gap-2">
                        {steps.map((step, i) => (
                            <li key={step.title} className="flex items-start gap-3 rounded-tile border border-line-glass bg-surface-glass-soft px-4 py-3">
                                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mark border border-tint-info-border bg-tint-info font-display text-sm font-semibold text-indigo-500">
                                    {i + 1}
                                </span>
                                <span>
                                    <span className="block font-display text-card-title font-semibold text-ink-900">{step.title}</span>
                                    <span className="mt-0 block text-web-body text-ink-600">{step.body}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>

                <AccessPanel>
                    {declined ? (
                        <p role="alert" className="mb-4 rounded-tile border border-destructive/30 bg-tint-danger px-4 py-3 text-sm font-medium text-destructive">
                            {t("We could not take a new request for this account. Please write to us.")}{" "}
                            <a href="mailto:contact@sargvision.com" className="focus-ring rounded-xs font-semibold underline underline-offset-2">contact@sargvision.com</a>
                        </p>
                    ) : null}
                    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate aria-busy={busy}>
                        <FieldCard id="ra-school" label={t("School name")} invalid={bad("schoolName")} hint={t("This field is required.")}>
                            <input id="ra-school" className={FIELD_CONTROL} maxLength={FIELD_LIMITS.schoolName} value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)}
                                autoComplete="organization" required disabled={busy} aria-invalid={bad("schoolName") || undefined} />
                        </FieldCard>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <FieldCard id="ra-role" label={t("Your role at school")} invalid={bad("role")} hint={t("This field is required.")}>
                                <select id="ra-role" className={FIELD_CONTROL} value={form.role} onChange={(e) => update("role", e.target.value)}
                                    required disabled={busy} aria-invalid={bad("role") || undefined}>
                                    <option value="">{t("Select")}</option>
                                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                                </select>
                            </FieldCard>
                            <FieldCard id="ra-board" label={t("Board")} invalid={bad("board")} hint={t("This field is required.")}>
                                <select id="ra-board" className={FIELD_CONTROL} value={form.board} onChange={(e) => update("board", e.target.value)}
                                    required disabled={busy} aria-invalid={bad("board") || undefined}>
                                    <option value="">{t("Select")}</option>
                                    {EDUCATION_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                                    <option value="Other">{t("Other")}</option>
                                </select>
                            </FieldCard>
                        </div>

                        <FieldCard id="ra-affiliation" label={t("Board affiliation number")} optional={optional}
                            help={t("For example, the CBSE affiliation number or the CISCE school code. It helps us verify your school sooner.")}>
                            <input id="ra-affiliation" className={FIELD_CONTROL} maxLength={FIELD_LIMITS.affiliationNumber} value={form.affiliationNumber} onChange={(e) => update("affiliationNumber", e.target.value)}
                                autoComplete="off" disabled={busy} aria-describedby="ra-affiliation-help" />
                        </FieldCard>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <FieldCard id="ra-city" label={t("City or town")} invalid={bad("city")} hint={t("This field is required.")}>
                                <input id="ra-city" className={FIELD_CONTROL} maxLength={FIELD_LIMITS.city} value={form.city} onChange={(e) => update("city", e.target.value)}
                                    autoComplete="address-level2" required disabled={busy} aria-invalid={bad("city") || undefined} />
                            </FieldCard>
                            <FieldCard id="ra-state" label={t("State")} invalid={bad("state")} hint={t("This field is required.")}>
                                <select id="ra-state" className={FIELD_CONTROL} value={form.state} onChange={(e) => update("state", e.target.value)}
                                    required disabled={busy} aria-invalid={bad("state") || undefined}>
                                    <option value="">{t("Select")}</option>
                                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{tState(s, language)}</option>)}
                                </select>
                            </FieldCard>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <FieldCard id="ra-phone" label={t("Phone number")} invalid={bad("phone")} hint={t("Enter a valid 10-digit mobile number.")}>
                                <input id="ra-phone" className={FIELD_CONTROL} maxLength={FIELD_LIMITS.phone} type="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                                    autoComplete="tel" required disabled={busy} aria-invalid={bad("phone") || undefined} />
                            </FieldCard>
                            <FieldCard id="ra-teachers" label={t("Number of teachers")} optional={optional} invalid={bad("teacherCount")} hint={t("Enter a whole number.")}>
                                <input id="ra-teachers" className={FIELD_CONTROL} type="number" inputMode="numeric" min={1} value={form.teacherCount}
                                    onChange={(e) => update("teacherCount", e.target.value)} disabled={busy}
                                    aria-invalid={bad("teacherCount") || undefined} />
                            </FieldCard>
                        </div>

                        <FieldCard id="ra-message" label={t("Anything else we should know")} optional={optional}>
                            <textarea id="ra-message" className={`${FIELD_CONTROL} resize-y font-body font-normal`} rows={3} maxLength={FIELD_LIMITS.message} value={form.message}
                                onChange={(e) => update("message", e.target.value)} disabled={busy} />
                        </FieldCard>

                        <div className="mt-2">
                            <label className="flex min-h-11 items-start gap-3 text-sm text-ink-600">
                                <input type="checkbox" className="mt-0 h-5 w-5 shrink-0 accent-leaf-500" checked={form.acceptTerms}
                                    onChange={(e) => update("acceptTerms", e.target.checked)} required disabled={busy}
                                    aria-invalid={bad("acceptTerms") || undefined} />
                                <span>
                                    {t("I have read and accept the")}{" "}
                                    <Link href="/terms#evaluation" target="_blank" className="focus-ring rounded-xs font-semibold text-saffron-600 underline underline-offset-2">
                                        {t("evaluation and pilot terms")}
                                    </Link>
                                </span>
                            </label>
                            {bad("acceptTerms") ? (
                                <p className="mt-1 text-sm font-medium text-destructive">{t("You must accept the terms to continue.")}</p>
                            ) : null}
                        </div>

                        <InlineError message={error} />

                        <button type="submit" disabled={busy} className={`${ACCESS_PRIMARY} mt-1 w-full`}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                            {t("Submit request")}
                        </button>
                    </form>
                </AccessPanel>
            </div>
        </AccessShell>
    );
}
