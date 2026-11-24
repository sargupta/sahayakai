"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { AccessCard, AccessShell, InlineError } from "../access/access-shell";

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

const SELECT_CLASS =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t("Loading...")}
                </div>
            </AccessShell>
        );
    }

    if (!user) {
        return (
            <AccessShell>
                <AccessCard title={t("Request access for your school")}>
                    <p>{t("Sign in first, so that we can link the request to your account.")}</p>
                    <Button type="button" onClick={openAuthModal}>{t("Sign in")}</Button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "error") {
        return (
            <AccessShell>
                <AccessCard title={t("Request access for your school")}>
                    <InlineError message={t("Something went wrong. Please try again.")} />
                    <Button type="button" onClick={() => { void loadExisting(); }}>{t("Try again")}</Button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "submitted") {
        return (
            <AccessShell>
                <AccessCard title={t("Request received")}>
                    <p className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>{t("We verify each school before granting access. You will hear from us by email or phone.")}</span>
                    </p>
                    <Button asChild><Link href="/access">{t("View request status")}</Link></Button>
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
                <AccessCard title={t("Your access request")}>
                    <dl className="space-y-2">
                        <div className="flex justify-between gap-4">
                            <dt>{t("School name")}</dt>
                            <dd className="text-right font-medium text-foreground">{existing.schoolName}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt>{t("Status")}</dt>
                            <dd className="text-right font-medium text-foreground">{label}</dd>
                        </div>
                    </dl>
                    <Button asChild><Link href="/access">{t("View request status")}</Link></Button>
                </AccessCard>
            </AccessShell>
        );
    }

    const bad = (f: AccessRequestField) => invalid.includes(f);
    const busy = phase === "submitting";

    return (
        <AccessShell>
            <AccessCard title={t("Request access for your school")}>
                <p>
                    {lapsed
                        ? t("The access period approved for this account has ended.")
                        : t("Tell us about your school. We verify each school before granting access.")}
                </p>
                {declined ? (
                    <p role="alert" className="text-sm text-destructive">
                        {t("We could not take a new request for this account. Please write to us.")}{" "}
                        <a href="mailto:contact@sargvision.com" className="font-medium underline underline-offset-2">contact@sargvision.com</a>
                    </p>
                ) : null}
                <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={busy}>
                    <Field id="ra-school" label={t("School name")} invalid={bad("schoolName")} hint={t("This field is required.")}>
                        <Input id="ra-school" maxLength={FIELD_LIMITS.schoolName} value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)}
                            autoComplete="organization" required disabled={busy} aria-invalid={bad("schoolName") || undefined} />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field id="ra-role" label={t("Your role at school")} invalid={bad("role")} hint={t("This field is required.")}>
                            <select id="ra-role" className={SELECT_CLASS} value={form.role} onChange={(e) => update("role", e.target.value)}
                                required disabled={busy} aria-invalid={bad("role") || undefined}>
                                <option value="">{t("Select")}</option>
                                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                            </select>
                        </Field>
                        <Field id="ra-board" label={t("Board")} invalid={bad("board")} hint={t("This field is required.")}>
                            <select id="ra-board" className={SELECT_CLASS} value={form.board} onChange={(e) => update("board", e.target.value)}
                                required disabled={busy} aria-invalid={bad("board") || undefined}>
                                <option value="">{t("Select")}</option>
                                {EDUCATION_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                                <option value="Other">{t("Other")}</option>
                            </select>
                        </Field>
                    </div>

                    <Field id="ra-affiliation" label={`${t("Board affiliation number")} (${t("Optional")})`}
                        help={t("For example, the CBSE affiliation number or the CISCE school code. It helps us verify your school sooner.")}>
                        <Input id="ra-affiliation" maxLength={FIELD_LIMITS.affiliationNumber} value={form.affiliationNumber} onChange={(e) => update("affiliationNumber", e.target.value)}
                            autoComplete="off" disabled={busy} aria-describedby="ra-affiliation-help" />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field id="ra-city" label={t("City or town")} invalid={bad("city")} hint={t("This field is required.")}>
                            <Input id="ra-city" maxLength={FIELD_LIMITS.city} value={form.city} onChange={(e) => update("city", e.target.value)}
                                autoComplete="address-level2" required disabled={busy} aria-invalid={bad("city") || undefined} />
                        </Field>
                        <Field id="ra-state" label={t("State")} invalid={bad("state")} hint={t("This field is required.")}>
                            <select id="ra-state" className={SELECT_CLASS} value={form.state} onChange={(e) => update("state", e.target.value)}
                                required disabled={busy} aria-invalid={bad("state") || undefined}>
                                <option value="">{t("Select")}</option>
                                {INDIAN_STATES.map((s) => <option key={s} value={s}>{tState(s, language)}</option>)}
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field id="ra-phone" label={t("Phone number")} invalid={bad("phone")} hint={t("Enter a valid 10-digit mobile number.")}>
                            <Input id="ra-phone" maxLength={FIELD_LIMITS.phone} type="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                                autoComplete="tel" required disabled={busy} aria-invalid={bad("phone") || undefined} />
                        </Field>
                        <Field id="ra-teachers" label={`${t("Number of teachers")} (${t("Optional")})`} invalid={bad("teacherCount")} hint={t("Enter a whole number.")}>
                            <Input id="ra-teachers" type="number" inputMode="numeric" min={1} value={form.teacherCount}
                                onChange={(e) => update("teacherCount", e.target.value)} disabled={busy}
                                aria-invalid={bad("teacherCount") || undefined} />
                        </Field>
                    </div>

                    <Field id="ra-message" label={`${t("Anything else we should know")} (${t("Optional")})`}>
                        <Textarea id="ra-message" rows={3} maxLength={FIELD_LIMITS.message} value={form.message}
                            onChange={(e) => update("message", e.target.value)} disabled={busy} />
                    </Field>

                    <div>
                        <label className="flex items-start gap-2 text-sm text-foreground">
                            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.acceptTerms}
                                onChange={(e) => update("acceptTerms", e.target.checked)} required disabled={busy}
                                aria-invalid={bad("acceptTerms") || undefined} />
                            <span>
                                {t("I have read and accept the")}{" "}
                                <Link href="/terms#evaluation" target="_blank" className="font-medium underline underline-offset-2">
                                    {t("evaluation and pilot terms")}
                                </Link>
                            </span>
                        </label>
                        {bad("acceptTerms") ? (
                            <p className="mt-1 text-sm text-destructive">{t("You must accept the terms to continue.")}</p>
                        ) : null}
                    </div>

                    <InlineError message={error} />

                    <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                        {t("Submit request")}
                    </Button>
                </form>
            </AccessCard>
        </AccessShell>
    );
}

function Field({
    id, label, children, invalid, hint, help,
}: {
    id: string;
    label: string;
    children: React.ReactNode;
    invalid?: boolean;
    /** Shown only when the field is invalid. */
    hint?: string;
    /** Always shown. */
    help?: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-foreground">{label}</Label>
            {children}
            {help ? <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p> : null}
            {invalid && hint ? <p className="text-sm text-destructive">{hint}</p> : null}
        </div>
    );
}
