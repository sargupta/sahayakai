"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { auth } from "@/lib/firebase";
import {
    extractJoinCode,
    getAccessStatus,
    resolveExitFromAccessFlow,
    syncAccessClaim,
    type AccessStatus,
} from "@/lib/api/access";
import {
    ACCESS_PRIMARY, ACCESS_SECONDARY, AccessCard, AccessLoading, AccessPill, AccessShell,
    FIELD_CONTROL, FieldCard, InlineError,
} from "./access-shell";

type Phase = "loading" | "ready" | "error" | "stuck";

/**
 * /access — where the middleware sends a signed-in account that is not
 * entitled (docs/ACCESS_GATE_DESIGN.md). On mount: repair the claim, refresh
 * the token, then read the status. An entitled account is sent home.
 */
export default function AccessPage() {
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>("loading");
    const [status, setStatus] = useState<AccessStatus | null>(null);

    const load = useCallback(async () => {
        setPhase("loading");
        try {
            await syncAccessClaim();
            // Always mint a fresh token here: the one in hand may predate an
            // approval, and the middleware decides from the token.
            try { await auth.currentUser?.getIdToken(true); } catch { /* offline: handled below */ }
            const next = await getAccessStatus();
            if (next.entitled || next.mode !== "enforce") {
                // Leave only when the token itself is entitled (or the gate
                // is not enforced). The status endpoint reads Firestore and
                // can be ahead of the token; trusting it alone would bounce
                // between this page and the middleware.
                const uid = auth.currentUser?.uid;
                const destination = uid ? await resolveExitFromAccessFlow(uid, next.mode) : null;
                if (destination) {
                    router.replace(destination);
                    return;
                }
                setStatus(next);
                setPhase("stuck");
                return;
            }
            setStatus(next);
            setPhase("ready");
        } catch {
            setPhase("error");
        }
    }, [router]);

    useEffect(() => {
        if (authLoading || !user) return;
        void load();
    }, [authLoading, user, load]);

    if (authLoading || (user && phase === "loading")) {
        return (
            <AccessShell>
                <AccessLoading label={t("Checking your access")} />
            </AccessShell>
        );
    }

    if (!user) {
        return (
            <AccessShell>
                <AccessCard title={t("Access to SahayakAI")}>
                    <p>{t("SahayakAI is provided to schools. Sign in to check your access, request access for your school, or join with an invitation from your school.")}</p>
                    <button type="button" className={ACCESS_PRIMARY} onClick={openAuthModal}>{t("Sign in")}</button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "stuck") {
        return (
            <AccessShell>
                <AccessCard tone="ended" title={t("Access to SahayakAI")}>
                    <InlineError message={t("We could not refresh your access. Please sign out and sign in again, or contact us.")} />
                    <ContactLine />
                    <button type="button" className={ACCESS_PRIMARY} onClick={() => { void load(); }}>{t("Try again")}</button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "error" || !status) {
        return (
            <AccessShell>
                <AccessCard tone="ended" title={t("Access to SahayakAI")}>
                    <InlineError message={t("We could not check your access. Please try again.")} />
                    <button type="button" className={ACCESS_PRIMARY} onClick={() => { void load(); }}>{t("Try again")}</button>
                </AccessCard>
            </AccessShell>
        );
    }

    return (
        <AccessShell>
            <StatusView status={status} email={user.email} />
        </AccessShell>
    );
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function ContactLine() {
    const { t } = useLanguage();
    return (
        <p>
            {t("For help, write to")}{" "}
            <a href="mailto:contact@sargvision.com" className="focus-ring rounded-xs font-semibold text-saffron-600 underline underline-offset-2">
                contact@sargvision.com
            </a>
        </p>
    );
}

function StatusView({ status, email }: { status: AccessStatus; email: string | null }) {
    const { t } = useLanguage();
    const signedInAs = email ? (
        <p className="text-xs text-ink-500">{t("Signed in as {email}").replace("{email}", email)}</p>
    ) : null;

    if (status.state === "blocked") {
        return (
            <AccessCard tone="ended" title={t("Access withdrawn")}>
                <p>{t("Access for this account has been withdrawn.")}</p>
                <ContactLine />
                {signedInAs}
            </AccessCard>
        );
    }

    if (status.verdict === "expired" || status.state === "pilot" || status.state === "active") {
        // Entitled states that are not entitled any more: the period has ended.
        const ended = formatDate(status.expiresAt);
        return (
            <AccessCard tone="ended" title={status.state === "pilot" ? t("Your pilot has ended") : t("Your access has ended")}>
                <p>
                    {ended
                        ? t("Your school's access ended on {date}.").replace("{date}", ended)
                        : t("Your school's access period has ended.")}
                </p>
                <p>{t("To continue using SahayakAI, ask your school administrator to renew, or contact us.")}</p>
                <ContactLine />
                {signedInAs}
            </AccessCard>
        );
    }

    if (status.request?.status === "pending") {
        const submitted = formatDate(status.request.createdAt);
        return (
            <AccessCard tone="working" pill={<AccessPill tone="info">{t("Under review")}</AccessPill>} title={t("Your request is under review")}>
                <p>
                    {submitted
                        ? t("We received your request on {date}.").replace("{date}", submitted)
                        : t("We have received your request.")}
                </p>
                <p>{t("We verify each school before granting access. You will hear from us by email or phone.")}</p>
                <JoinCodeField />
                {signedInAs}
            </AccessCard>
        );
    }

    if (status.request?.status === "approved") {
        // Approved earlier, pending again: the approved period has lapsed.
        return (
            <AccessCard tone="ended" title={t("Your access has ended")}>
                <p>{t("The access period approved for this account has ended.")}</p>
                <p>{t("You can submit a new request for your school. If it is not accepted, please write to us.")}</p>
                <Link href="/request-access?renew=1" className={ACCESS_PRIMARY}>{t("Submit a new request")}</Link>
                <ContactLine />
                <JoinCodeField />
                {signedInAs}
            </AccessCard>
        );
    }

    if (status.request?.status === "rejected") {
        return (
            <AccessCard tone="ended" title={t("Request not approved")}>
                <p>{t("We could not approve this request. If you believe this is a mistake, please contact us.")}</p>
                <ContactLine />
                <JoinCodeField />
                {signedInAs}
            </AccessCard>
        );
    }

    return (
        <AccessCard title={t("Access to SahayakAI")}>
            <p>{t("SahayakAI is provided to schools. This account does not have access yet.")}</p>
            <Link href="/request-access" className={ACCESS_PRIMARY}>{t("Request access for your school")}</Link>
            <JoinCodeField />
            {signedInAs}
        </AccessCard>
    );
}

function JoinCodeField() {
    const { t } = useLanguage();
    const router = useRouter();
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const code = extractJoinCode(value);
        if (!code) {
            setError(t("That does not look like a valid invitation link or code."));
            return;
        }
        setError(null);
        router.push(`/join/${encodeURIComponent(code)}`);
    }

    return (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-line-hairline pt-5" noValidate>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                    <FieldCard id="join-code" label={t("Have an invitation from your school?")} invalid={Boolean(error)}>
                        <input
                            id="join-code"
                            className={FIELD_CONTROL}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={t("Paste the invitation link or code")}
                            autoComplete="off"
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? "join-code-error" : undefined}
                        />
                    </FieldCard>
                </div>
                <button type="submit" className={`${ACCESS_SECONDARY} sm:mt-2`}>{t("Continue")}</button>
            </div>
            {error ? <p id="join-code-error" role="alert" className="px-1 text-sm font-medium text-destructive">{error}</p> : null}
        </form>
    );
}
