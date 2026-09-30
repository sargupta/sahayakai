"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { setMode } from "@/lib/api/sampark";
import type { SamparkMode } from "@/types/sampark";
import { useSamparkSchool } from "./school-context";
import { StatusPill } from "./status-pill";
import { errorMessage } from "./states";
import { modeDescription, modeLabel } from "./labels";

const MODES: SamparkMode[] = ["practice", "test", "live"];

/**
 * The mode, named in a principal's words. In this release only Practice is
 * possible: Test and Live are shown so the school knows what comes next, and
 * why they are not available yet.
 */
export function ModeSection() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { orgId, school, setSchool } = useSamparkSchool();
    const [saving, setSaving] = useState(false);

    const backToPractice = async () => {
        setSaving(true);
        try {
            setSchool(await setMode(orgId, "practice"));
            toast({ title: t("Switched to Practice mode") });
        } catch (err) {
            toast({ title: t("Could not change the mode"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionCard title={t("Mode")} icon={ShieldCheck} description={t("The mode decides whose phone rings. It is shown on every school calls screen.")}>
            <div role="radiogroup" aria-label={t("Mode")} className="grid gap-3 md:grid-cols-3">
                {MODES.map((m) => {
                    const current = school.mode === m;
                    const available = m === "practice";
                    return (
                        <div
                            key={m}
                            role="radio"
                            aria-checked={current}
                            aria-disabled={!available}
                            className={cn(
                                "space-y-2 rounded-surface-md border p-4",
                                current ? "border-primary bg-primary/10" : "border-border bg-card",
                                !available && "opacity-60",
                            )}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="type-body font-semibold text-foreground">{modeLabel(t, m)}</span>
                                {current && <StatusPill tone="info">{t("Current")}</StatusPill>}
                            </div>
                            <p className="type-body text-muted-foreground">{modeDescription(t, m)}</p>
                            {!available && (
                                <p className="type-body text-foreground">
                                    {t("Not available yet. It needs the phase 2 approvals: a phone number registered to the school, calling rules the school has adopted in writing, and a recorded consent drive.")}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
            {school.mode !== "practice" && (
                <Button type="button" onClick={backToPractice} disabled={saving}>
                    {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Switch to Practice")}
                </Button>
            )}
            <p className="type-body text-muted-foreground">
                {school.emergencyBypassConsent
                    ? t("Emergency closures may reach families who have not given consent for recorded notices.")
                    : t("Emergency closures reach only families who have given consent for recorded notices.")}
            </p>
        </SectionCard>
    );
}
