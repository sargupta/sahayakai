"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { ApiError } from "@/lib/api/client";
import { extractJoinCode, getAccessMode, joinOrganization, resolveExitFromAccessFlow, serverErrorCode } from "@/lib/api/access";
import { AccessCard, AccessShell, InlineError } from "../../access/access-shell";

type Phase = "idle" | "joining" | "joined";

/**
 * /join/[code] — redeem a school invitation link
 * (POST /api/organizations/join, docs/ACCESS_GATE_DESIGN.md).
 */
export default function JoinPage() {
    const params = useParams<{ code: string }>();
    const router = useRouter();
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { t } = useLanguage();
    const [phase, setPhase] = useState<Phase>("idle");
    const [accept, setAccept] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string>("");
    const [stuck, setStuck] = useState(false);

    const code = extractJoinCode(typeof params?.code === "string" ? params.code : "");

    /** Returns false when the fresh token is still not entitled. */
    async function goToApp(uid: string): Promise<boolean> {
        const destination = await resolveExitFromAccessFlow(uid, await getAccessMode());
        if (!destination) return false;
        router.replace(destination);
        return true;
    }

    async function onJoin(e: React.FormEvent) {
        e.preventDefault();
        if (!code || !user) return;
        if (!accept) {
            setError(t("You must accept the terms to continue."));
            return;
        }
        setError(null);
        setPhase("joining");
        try {
            const result = await joinOrganization(code);
            setOrgName(result.orgName);
            setPhase("joined");
            // The join changed this account's claims; mint a token that carries them.
            try { await auth.currentUser?.getIdToken(true); } catch { /* next request retries */ }
            if (!(await goToApp(user.uid))) {
                setStuck(true);
            }
        } catch (err) {
            setPhase("idle");
            const status = err instanceof ApiError ? err.status : 0;
            setError(
                serverErrorCode(err) === "ACCOUNT_BLOCKED" ? t("Access for this account has been withdrawn.")
                : status === 404 ? t("This invitation is not valid. Please ask your school for a new link.")
                : status === 410 ? t("This invitation has expired. Please ask your school for a new link.")
                : status === 409 ? t("This invitation cannot be used. All seats may be taken, or this account already belongs to another school.")
                : t("Something went wrong. Please try again."),
            );
        }
    }

    if (authLoading) {
        return (
            <AccessShell>
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t("Loading...")}
                </div>
            </AccessShell>
        );
    }

    if (!code) {
        return (
            <AccessShell>
                <AccessCard title={t("School invitation")}>
                    <InlineError message={t("This invitation is not valid. Please ask your school for a new link.")} />
                    <Button asChild variant="outline"><Link href="/access">{t("Continue")}</Link></Button>
                </AccessCard>
            </AccessShell>
        );
    }

    if (phase === "joined") {
        return (
            <AccessShell>
                <AccessCard title={t("School invitation")}>
                    <p className="flex items-start gap-2" role="status">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>
                            {stuck
                                ? t("You have joined {school}.").replace("{school}", orgName)
                                : t("You have joined {school}. Taking you to SahayakAI.").replace("{school}", orgName)}
                        </span>
                    </p>
                    {stuck ? (
                        <>
                            <InlineError message={t("We could not refresh your access. Please sign out and sign in again, or contact us.")} />
                            <Button asChild variant="outline"><Link href="/access">{t("Continue")}</Link></Button>
                        </>
                    ) : null}
                </AccessCard>
            </AccessShell>
        );
    }

    return (
        <AccessShell>
            <AccessCard title={t("School invitation")}>
                <p>{t("Your school has invited you to use SahayakAI. Joining links this account to your school's licence.")}</p>
                {!user ? (
                    <>
                        <p>{t("Sign in with the Google account you use for school work, then accept the invitation.")}</p>
                        <Button type="button" onClick={openAuthModal}>{t("Sign in")}</Button>
                    </>
                ) : (
                    <form onSubmit={onJoin} className="space-y-4" noValidate aria-busy={phase === "joining"}>
                        {user.email ? (
                            <p className="text-xs">{t("Signed in as {email}").replace("{email}", user.email)}</p>
                        ) : null}
                        <label className="flex items-start gap-2 text-sm text-foreground">
                            <input type="checkbox" className="mt-1 h-4 w-4" checked={accept}
                                onChange={(e) => setAccept(e.target.checked)} required disabled={phase === "joining"} />
                            <span>
                                {t("I have read and accept the")}{" "}
                                <Link href="/terms#evaluation" target="_blank" className="font-medium underline underline-offset-2">
                                    {t("evaluation and pilot terms")}
                                </Link>
                            </span>
                        </label>
                        <InlineError message={error} />
                        <Button type="submit" disabled={phase === "joining"}>
                            {phase === "joining" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                            {t("Join your school")}
                        </Button>
                    </form>
                )}
            </AccessCard>
        </AccessShell>
    );
}
