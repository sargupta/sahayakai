"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Smartphone, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/layout";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { ApiError, setMode, updateSchool, type SamparkSchoolView } from "@/lib/api/sampark";
import type { SamparkMode } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { StatusPill } from "./status-pill";
import { errorMessage } from "./states";
import { hourLabel } from "./format";
import { fmt, liveDialBlockerText, modeDescription, modeLabel, serverErrorText } from "./labels";

const MODES: SamparkMode[] = ["practice", "test", "live"];

/** Enough digits to be worth sending; the server does the real check (Indian mobile only). */
function looksLikePhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
}

/** One mode, with what it means, whether it is possible here, and the action that switches to it. */
function ModeOption({
    mode,
    school,
    busy,
    onPractice,
    onTest,
}: {
    mode: SamparkMode;
    school: SamparkSchoolView;
    busy: boolean;
    onPractice: () => void;
    onTest: () => void;
}) {
    const { t } = useLanguage();
    const current = school.mode === mode;
    const last4 = school.testPhoneLast4;
    const testUnavailable = mode === "test" && !school.liveDialAvailable;
    const unavailable = mode === "live" || testUnavailable;

    return (
        <li
            aria-current={current ? "true" : undefined}
            className={cn(
                "flex flex-col gap-2 rounded-surface-md border p-4",
                current ? "border-primary bg-primary/10" : unavailable ? "border-border bg-muted/30" : "border-border bg-card",
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="type-body font-semibold text-foreground">{modeLabel(t, mode)}</span>
                {current && <StatusPill tone="info">{t("Current")}</StatusPill>}
                {!current && unavailable && <StatusPill tone="neutral">{t("Not available yet")}</StatusPill>}
            </div>
            <p className="type-body text-muted-foreground">{modeDescription(t, mode)}</p>

            {mode === "test" && testUnavailable && school.liveDialBlocker && (
                <p className="type-body text-foreground">{liveDialBlockerText(t, school.liveDialBlocker)}</p>
            )}
            {mode === "test" && !testUnavailable && !last4 && (
                <p className="type-body text-foreground">{t("Save a test phone below to use Test mode.")}</p>
            )}
            {mode === "test" && !testUnavailable && last4 && (
                <p className="type-body text-foreground">{fmt(t("Calls ring the phone ending {last4}."), { last4 })}</p>
            )}
            {mode === "live" && (
                <p className="type-body text-foreground">
                    {t("Calling families needs approvals first: a phone number registered to the school, calling rules the school has adopted in writing, and a recorded consent drive.")}
                </p>
            )}

            {mode === "practice" && !current && (
                <Button type="button" variant="outline" className="mt-auto self-start" onClick={onPractice} disabled={busy}>
                    {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Switch to Practice")}
                </Button>
            )}
            {mode === "test" && !current && !testUnavailable && last4 && (
                <Button type="button" variant="outline" className="mt-auto self-start" onClick={onTest} disabled={busy}>
                    {t("Switch to Test")}
                </Button>
            )}
        </li>
    );
}

/**
 * The school's test phone: typed once, then shown only as "ending 1234". The
 * full number goes to the server and is never shown, kept in state, or logged
 * after a successful save.
 */
function TestPhoneField() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool } = useSamparkSchool();
    const last4 = school.testPhoneLast4;
    const inTest = school.mode === "test";
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [removeOpen, setRemoveOpen] = useState(false);
    const [removing, setRemoving] = useState(false);
    const showInput = !last4 || editing;

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!looksLikePhone(value)) {
            setError(serverErrorText(t, "TEST_PHONE_INVALID"));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const next = await updateSchool(orgId, { testPhone: value });
            setSchool(next);
            setValue("");
            setEditing(false);
            toast({
                title: t("Test phone saved"),
                description: next.mode !== school.mode ? t("The school is back in Practice mode. Switch to Test again to use the new number.") : undefined,
            });
        } catch (err) {
            if (err instanceof ApiError && err.status === 400 && err.message === "TEST_PHONE_INVALID") {
                setError(serverErrorText(t, err.message));
            } else {
                toast({ title: t("Could not save the test phone"), description: errorMessage(t, err), variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            setSchool(await updateSchool(orgId, { testPhone: null }));
            setRemoveOpen(false);
            setEditing(false);
            setValue("");
            toast({ title: t("Test phone removed") });
        } catch (err) {
            toast({ title: t("Could not remove the test phone"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setRemoving(false);
        }
    };

    const cancelEdit = () => {
        setEditing(false);
        setValue("");
        setError(null);
    };

    return (
        <div className="space-y-3 rounded-surface-md border border-border bg-muted/30 p-4">
            <div className="space-y-1">
                <h3 className="flex items-center gap-2 type-body font-semibold text-foreground">
                    <Smartphone aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {t("Test phone")}
                </h3>
                <p className="type-body text-muted-foreground">
                    {t("In Test mode every call rings this phone instead of a family. Use a mobile you can answer during calling hours.")}
                </p>
            </div>

            {!showInput && last4 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-body font-medium text-foreground">{fmt(t("Test phone ending {last4}"), { last4 })}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} disabled={removing}>
                            {t("Change")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(true)} disabled={removing}>
                            {t("Remove")}
                        </Button>
                    </div>
                </div>
            )}

            {showInput && (
                <form onSubmit={save} noValidate className="space-y-2">
                    <Label htmlFor="sampark-test-phone">{t("Indian mobile number")}</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <Input
                            id="sampark-test-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            maxLength={32}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                if (error) setError(null);
                            }}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? "sampark-test-phone-help sampark-test-phone-error" : "sampark-test-phone-help"}
                            className="sm:w-64"
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={saving || value.trim() === ""}>
                                {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                                {t("Save test phone")}
                            </Button>
                            {last4 && (
                                <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                                    {t("Cancel")}
                                </Button>
                            )}
                        </div>
                    </div>
                    <p id="sampark-test-phone-help" className="type-body text-muted-foreground">
                        {last4 && inTest
                            ? t("Saving a different number returns the school to Practice mode. Switch to Test again to confirm the new number.")
                            : t("After saving, only the last four digits are shown.")}
                    </p>
                    {error && (
                        <p id="sampark-test-phone-error" role="alert" className="type-body font-medium text-destructive">
                            {error}
                        </p>
                    )}
                </form>
            )}

            <AlertDialog open={removeOpen} onOpenChange={(o) => !removing && setRemoveOpen(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Remove the test phone?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {inTest
                                ? t("The school goes back to Practice mode, so no phone rings until you save a test phone and switch to Test again.")
                                : t("Test mode cannot be used until you save a test phone again.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removing}>{t("Not now")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={removing}
                            onClick={(e) => {
                                e.preventDefault();
                                void remove();
                            }}
                        >
                            {removing && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Remove")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/**
 * The mode, named in a principal's words. Practice is always possible. Test
 * (every call rings only the school's test phone) is possible once this
 * deployment can place real calls and a test phone is saved; switching to it
 * asks for confirmation naming the phone. Live is shown so the school knows
 * what comes next, and stays unavailable in this release.
 */
export function ModeSection() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool } = useSamparkSchool();
    const [busy, setBusy] = useState(false);
    const [confirmTest, setConfirmTest] = useState(false);
    const last4 = school.testPhoneLast4;
    const w = school.callingWindow;

    const switchTo = async (mode: SamparkMode) => {
        setBusy(true);
        try {
            setSchool(await setMode(orgId, mode));
            setConfirmTest(false);
            toast({ title: mode === "test" ? t("Switched to Test mode") : t("Switched to Practice mode") });
        } catch (err) {
            toast({ title: t("Could not change the mode"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <SectionCard title={t("Mode")} icon={ShieldCheck} description={t("The mode decides whose phone rings. It is shown on every school calls screen.")}>
            <ul aria-label={t("Mode")} className="grid gap-3 md:grid-cols-3">
                {MODES.map((m) => (
                    <ModeOption
                        key={m}
                        mode={m}
                        school={school}
                        busy={busy}
                        onPractice={() => void switchTo("practice")}
                        onTest={() => setConfirmTest(true)}
                    />
                ))}
            </ul>

            <TestPhoneField />

            <p className="type-body text-muted-foreground">
                {school.emergencyBypassConsent
                    ? t("Emergency closures may reach families who have not given consent for recorded notices.")
                    : t("Emergency closures reach only families who have given consent for recorded notices.")}
            </p>

            <AlertDialog open={confirmTest} onOpenChange={(o) => !busy && setConfirmTest(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Switch to Test mode?")}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 type-body text-muted-foreground">
                                <p className="font-medium text-foreground">
                                    {fmt(t("Every call this school places will ring only the phone ending {last4}, and only inside calling hours."), { last4: last4 ?? "" })}
                                </p>
                                <p>
                                    {fmt(t("Calls are placed only inside the calling window, {start} to {end} IST, and never on off days or school holidays."), {
                                        start: hourLabel(w.startHour),
                                        end: hourLabel(w.endHour),
                                    })}
                                </p>
                                <p>{t("No family is called. A campaign makes one call to this phone for every family it would reach, one call at a time, so try it with one class first.")}</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t("Not now")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy || !last4}
                            onClick={(e) => {
                                e.preventDefault();
                                void switchTo("test");
                            }}
                        >
                            {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Switch to Test")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SectionCard>
    );
}
