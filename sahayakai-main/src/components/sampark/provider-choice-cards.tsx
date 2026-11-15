"use client";

/**
 * The school's calling-provider choice: ElevenLabs Calls or Vobiz Calls, side by side, each with
 * its price per connected minute, a monthly estimate for this school, and how it differs.
 * Used when a school switches on calls (workspace) and in Settings → Calling provider.
 *
 * Prices come from the deployment (null = "Price not set yet"; never a made-up number). The
 * estimate inputs are the school's own: families, calls per family per month, minutes per call.
 */

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";
import { PROVIDER_LABEL } from "@/lib/sampark/provider-choice";
import { ESTIMATE_LIMITS, estimateMonthlyInr, formatInr, type EstimateInput } from "@/lib/sampark/provider-pricing";
import { cn } from "@/lib/utils";

import { StatusPill } from "./status-pill";

export type ProviderId = "elevenlabs" | "vobiz";

export interface ProviderCardOption {
    id: ProviderId;
    available: boolean;
    price?: { inrPerMinute: number | null; asOf: string | null };
    differences?: string[];
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
    const id = useId();
    return (
        <div className="space-y-1">
            <Label htmlFor={id} className="type-caption text-muted-foreground">{label}</Label>
            <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                value={Number.isFinite(value) ? value : 0}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full sm:w-32"
            />
        </div>
    );
}

export function ProviderChoiceCards({
    options,
    selected,
    current,
    onSelect,
    defaults,
    disabled = false,
}: {
    options: ProviderCardOption[];
    selected: ProviderId | null;
    /** The school's provider today, labelled "Current" (Settings only). */
    current?: ProviderId | null;
    onSelect: (id: ProviderId) => void;
    defaults: EstimateInput;
    disabled?: boolean;
}) {
    const { t } = useLanguage();
    const [estimate, setEstimate] = useState<EstimateInput>(defaults);
    const asOf = options.find((o) => o.price?.asOf)?.price?.asOf ?? null;

    return (
        <div className="space-y-4">
            <fieldset className="space-y-2">
                <legend className="type-body font-semibold text-foreground">{t("Estimate for your school")}</legend>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <NumberField label={t("Families")} value={estimate.families} min={ESTIMATE_LIMITS.families.min} max={ESTIMATE_LIMITS.families.max} step={1} onChange={(n) => setEstimate((e) => ({ ...e, families: n }))} />
                    <NumberField label={t("Calls per family each month")} value={estimate.callsPerFamilyPerMonth} min={ESTIMATE_LIMITS.callsPerFamilyPerMonth.min} max={ESTIMATE_LIMITS.callsPerFamilyPerMonth.max} step={1} onChange={(n) => setEstimate((e) => ({ ...e, callsPerFamilyPerMonth: n }))} />
                    <NumberField label={t("Minutes per call")} value={estimate.minutesPerCall} min={ESTIMATE_LIMITS.minutesPerCall.min} max={ESTIMATE_LIMITS.minutesPerCall.max} step={0.5} onChange={(n) => setEstimate((e) => ({ ...e, minutesPerCall: n }))} />
                </div>
            </fieldset>

            <ul aria-label={t("Calling provider")} className="grid gap-4 md:grid-cols-2" role="radiogroup">
                {options.map((o) => {
                    const perMin = o.price?.inrPerMinute ?? null;
                    const monthly = estimateMonthlyInr(estimate, perMin);
                    const isSelected = selected === o.id;
                    return (
                        <li key={o.id}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={!o.available || disabled}
                                onClick={() => onSelect(o.id)}
                                data-testid={`provider-card-${o.id}`}
                                className={cn(
                                    "focus-ring flex h-full w-full flex-col items-start gap-3 rounded-surface-md border p-4 text-left transition-colors",
                                    !o.available
                                        ? "cursor-not-allowed border-border bg-muted/30 opacity-70"
                                        : isSelected
                                          ? "border-primary bg-primary/5"
                                          : "border-border bg-card hover:border-primary hover:bg-primary/5",
                                )}
                            >
                                <span className="flex w-full flex-wrap items-center gap-2">
                                    <span className="type-body font-semibold text-foreground">{t(PROVIDER_LABEL[o.id])}</span>
                                    {current === o.id && <StatusPill tone="info">{t("Current")}</StatusPill>}
                                    {!o.available && <StatusPill tone="neutral">{t("Not available yet")}</StatusPill>}
                                </span>
                                <span className="type-body text-foreground" data-testid={`provider-price-${o.id}`}>
                                    {perMin === null ? t("Price not set yet") : `${formatInr(perMin)} ${t("per connected minute")}`}
                                </span>
                                {monthly !== null && (
                                    <span className="type-body font-semibold text-foreground" data-testid={`provider-estimate-${o.id}`}>
                                        {t("About")} {formatInr(monthly)} {t("a month")}
                                    </span>
                                )}
                                {o.differences && o.differences.length > 0 && (
                                    <ul className="list-disc space-y-1 pl-5 type-caption text-muted-foreground">
                                        {o.differences.map((d) => (
                                            <li key={d}>{t(d)}</li>
                                        ))}
                                    </ul>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {asOf && <p className="type-caption text-muted-foreground">{t("Prices as of")} {asOf}</p>}
        </div>
    );
}
