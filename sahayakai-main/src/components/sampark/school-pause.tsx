"use client";

import { useId, useState } from "react";
import { CirclePause, Loader2, Play } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { setPause, type SamparkSchoolView } from "@/lib/api/sampark";
import type { SchoolPause } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { useSamparkFormat } from "./format";
import { fmt, pauseScopeLabel } from "./labels";
import { errorMessage } from "./states";

/** The server's limit on a pause reason (PauseSchema). */
const MAX_REASON = 200;
const SCOPES: SchoolPause["scope"][] = ["all", "routine"];

/**
 * The persistent pause banner (H3). While the school is paused it sits under the
 * mode banner on every school-calls screen and says who paused, when, why and
 * what is stopped, with the one action that matters: Resume.
 */
export function PauseBanner({
    orgId,
    pause,
    onChange,
}: {
    orgId: string;
    pause: SchoolPause;
    onChange: (school: SamparkSchoolView) => void;
}) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { toast } = useToast();
    const { user } = useAuth();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const when = f.dateTime(pause.at);
    const who =
        user?.uid && user.uid === pause.by
            ? fmt(t("You paused calls on {when}."), { when })
            : fmt(t("Another school administrator paused calls on {when}."), { when });

    const resume = async () => {
        setBusy(true);
        try {
            onChange(await setPause(orgId, { paused: false }));
            setConfirmOpen(false);
            toast({ title: t("Calls resumed") });
        } catch (err) {
            toast({ title: t("Could not resume calls"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-surface-md border border-destructive/40 bg-destructive/10 p-3 md:flex-row md:items-start md:justify-between md:p-4">
            <div className="flex min-w-0 items-start gap-3">
                <CirclePause aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-1">
                    <p className="type-body font-semibold text-foreground">
                        {pause.scope === "all"
                            ? t("All school calls are paused")
                            : t("Routine calls are paused. Emergency closures still go out.")}
                    </p>
                    <p className="type-body text-foreground">{who}</p>
                    <p className="type-body break-words text-foreground">{fmt(t("Reason: {reason}"), { reason: pause.reason })}</p>
                    <p className="type-body text-muted-foreground">
                        {t("No new call starts while calls are paused. Phones that were ringing were hung up; a call already on the line finishes its message.")}
                    </p>
                </div>
            </div>
            <Button type="button" className="shrink-0 self-start" onClick={() => setConfirmOpen(true)} disabled={busy}>
                <Play aria-hidden="true" />
                {t("Resume calls")}
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Resume school calls?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("Campaigns on hold continue from where they stopped, inside calling hours.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t("Not now")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            onClick={(e) => {
                                e.preventDefault();
                                void resume();
                            }}
                        >
                            {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Resume calls")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/**
 * "Pause all calls": one button, then a confirmation that asks why (staff-only text)
 * and what to stop — every call, or everything except emergency closures. Renders
 * nothing while paused; the banner then offers Resume. Used in the console's rail,
 * its compact header on small screens, and on a campaign that is calling.
 */
export function PauseCallsButton({ className, size }: { className?: string; size?: "default" | "sm" }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool } = useSamparkSchool();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [scope, setScope] = useState<SchoolPause["scope"]>("all");
    const [busy, setBusy] = useState(false);
    const reasonId = useId();

    if (school.pause) return null;
    const trimmed = reason.trim();

    const pause = async () => {
        if (!trimmed) return;
        setBusy(true);
        try {
            setSchool(await setPause(orgId, { paused: true, reason: trimmed, scope }));
            setOpen(false);
            setReason("");
            setScope("all");
            toast({ title: t("Calls paused") });
        } catch (err) {
            toast({ title: t("Could not pause calls"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button type="button" variant="outline" size={size} className={cn("min-h-11", className)} onClick={() => setOpen(true)}>
                <CirclePause aria-hidden="true" />
                {t("Pause all calls")}
            </Button>

            <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Pause all calls?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("No new call starts until you resume, and phones that are still ringing are hung up.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`${reasonId}-reason`}>{t("Why are you pausing calls?")}</Label>
                            <Textarea
                                id={`${reasonId}-reason`}
                                value={reason}
                                maxLength={MAX_REASON}
                                rows={3}
                                className="min-h-20"
                                aria-describedby={`${reasonId}-help`}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <p id={`${reasonId}-help`} className="type-body text-muted-foreground">
                                {t("Staff see this reason. Families never hear it.")}
                            </p>
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="type-body font-medium text-foreground">{t("What to pause")}</legend>
                            <RadioGroup value={scope} onValueChange={(v) => setScope(v as SchoolPause["scope"])}>
                                {SCOPES.map((s) => (
                                    <div key={s} className="flex items-center gap-2">
                                        <RadioGroupItem id={`${reasonId}-scope-${s}`} value={s} />
                                        <Label htmlFor={`${reasonId}-scope-${s}`} className="font-normal">
                                            {pauseScopeLabel(t, s)}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </fieldset>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t("Not now")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy || !trimmed}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => {
                                e.preventDefault();
                                void pause();
                            }}
                        >
                            {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Pause calls")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
