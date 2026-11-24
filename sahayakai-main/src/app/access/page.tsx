"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AccessCard, AccessShell, InlineError } from "./access-shell";

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
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t("Checking your access")}
                </div>
            </AccessShell>
        );
    }

    if (!user) {
        return (
            <AccessShell>
                <AccessCard title={t("Access to SahayakAI")}>
                    <p>{t("SahayakAI is provided to schools. Sign in to check your access, request access for your school, or join with an invitation from your school.")}</p>
                    <Button type="button" onClick={openAuthModal}>{t("Sign in")}</Button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "stuck") {
        return (
            <AccessShell>
                <AccessCard title={t("Access to SahayakAI")}>
                    <InlineError message={t("We could not refresh your access. Please sign out and sign in again, or contact us.")} />
                    <ContactLine />
                    <Button type="button" onClick={() => { void load(); }}>{t("Try again")}</Button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "error" || !status) {
        return (
            <AccessShell>
                <AccessCard title={t("Access to SahayakAI")}>
                    <InlineError message={t("We could not check your access. Please try again.")} />
                    <Button type="button" onClick={() => { void load(); }}>{t("Try again")}</Button>
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
            <a href="mailto:contact@sargvision.com" className="font-medium text-foreground underline underline-offset-2">
                contact@sargvision.com
            </a>
        </p>
    );
}

function StatusView({ status, email }: { status: AccessStatus; email: string | null }) {
    const { t } = useLanguage();
    const signedInAs = email ? (
        <p className="text-xs">{t("Signed in as {email}").replace("{email}", email)}</p>
    ) : null;

    if (status.state === "blocked") {
        return (
            <AccessCard title={t("Access withdrawn")}>
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
            <AccessCard title={status.state === "pilot" ? t("Your pilot has ended") : t("Your access has ended")}>
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
            <AccessCard title={t("Your request is under review")}>
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
            <AccessCard title={t("Your access has ended")}>
                <p>{t("The access period approved for this account has ended.")}</p>
                <p>{t("You can submit a new request for your school. If it is not accepted, please write to us.")}</p>
                <Button asChild>
                    <Link href="/request-access?renew=1">{t("Submit a new request")}</Link>
                </Button>
                <ContactLine />
                <JoinCodeField />
                {signedInAs}
            </AccessCard>
        );
    }

    if (status.request?.status === "rejected") {
        return (
            <AccessCard title={t("Request not approved")}>
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
            <Button asChild>
                <Link href="/request-access">{t("Request access for your school")}</Link>
            </Button>
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
        <form onSubmit={onSubmit} className="space-y-2 border-t border-border pt-4" noValidate>
            <Label htmlFor="join-code">{t("Have an invitation from your school?")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    id="join-code"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t("Paste the invitation link or code")}
                    autoComplete="off"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "join-code-error" : undefined}
                />
                <Button type="submit" variant="outline">{t("Continue")}</Button>
            </div>
            {error ? <p id="join-code-error" role="alert" className="text-sm text-destructive">{error}</p> : null}
        </form>
    );
}
