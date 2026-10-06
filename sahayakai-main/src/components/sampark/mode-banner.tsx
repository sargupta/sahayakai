"use client";

import { FlaskConical, PhoneCall, PhoneForwarded } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import type { SamparkMode } from "@/types/sampark";
import { modeBannerText, modeDescription } from "./labels";

/**
 * The permanent mode banner (plan §8). It is on every Sampark screen so no one
 * ever has to wonder whether a real parent's phone is about to ring. In Test
 * mode it uses the warning token and names the phone that rings by its last
 * four digits (the full number never reaches the console).
 */
export function ModeBanner({
    mode,
    isDemo,
    testPhoneLast4 = null,
}: {
    mode: SamparkMode;
    isDemo: boolean;
    testPhoneLast4?: string | null;
}) {
    const { t } = useLanguage();
    const Icon = mode === "practice" ? FlaskConical : mode === "test" ? PhoneForwarded : PhoneCall;

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "flex items-start gap-3 rounded-surface-md border p-3 md:p-4",
                mode === "practice" && "border-info/30 bg-info/10",
                mode === "test" && "border-warning/40 bg-warning/10",
                mode === "live" && "border-destructive/40 bg-destructive/10",
            )}
        >
            <Icon
                aria-hidden="true"
                className={cn(
                    "mt-1 h-5 w-5 shrink-0",
                    mode === "practice" && "text-info",
                    mode === "test" && "text-warning",
                    mode === "live" && "text-destructive",
                )}
            />
            <div className="min-w-0 space-y-1">
                <p className="type-body font-semibold text-foreground">{modeBannerText(t, mode, testPhoneLast4)}</p>
                <p className="type-body text-muted-foreground">
                    {modeDescription(t, mode)}
                    {isDemo && (
                        <>
                            {" "}
                            {mode === "test"
                                ? t("This is a demo school: its families' numbers are test numbers and are never called. Only the test phone rings.")
                                : t("This is a demo school: its phone numbers are test numbers and can never be called.")}
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
