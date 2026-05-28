"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

interface BackButtonProps {
    /**
     * Explicit parent route to return to. ALWAYS prefer this — it makes the
     * back action deterministic ("revert to the right page, not a random one").
     * e.g. a teacher profile sets `to="/community"`.
     */
    to?: string;
    /**
     * Imperative handler for in-page view toggles (e.g. community sub-views
     * that flip local state rather than navigate). When provided, `to` is
     * ignored.
     */
    onBack?: () => void;
    /** Override the visible label (defaults to t("Back")). */
    label?: string;
    className?: string;
}

/**
 * Shared, consistently-styled back affordance.
 *
 * Navigation rules (deterministic, never a "random" page):
 *   1. `onBack` provided  → call it (in-page view toggle).
 *   2. `to` provided      → navigate straight to that parent route.
 *   3. neither            → router.back() ONLY if we have same-origin history;
 *                           otherwise fall back to "/" so a fresh tab / deep
 *                           link doesn't dead-end or leave the app.
 *
 * Visual: a clear outline pill (not a faint ghost) that is legible in both
 * light and dark themes.
 */
export function BackButton({ to, onBack, label, className }: BackButtonProps) {
    const router = useRouter();
    const { t } = useLanguage();

    const handleClick = () => {
        if (onBack) { onBack(); return; }
        if (to) { router.push(to); return; }
        // No explicit target — use history only when it's safe.
        if (typeof window !== "undefined") {
            const sameOriginHistory =
                window.history.length > 1 &&
                document.referrer &&
                new URL(document.referrer).origin === window.location.origin;
            if (sameOriginHistory) { router.back(); return; }
        }
        router.push("/");
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            aria-label={label ?? t("Back")}
            className={cn(
                "gap-1.5 rounded-full border-border bg-background/80 backdrop-blur-sm",
                "text-foreground font-semibold shadow-soft",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                className
            )}
        >
            <ArrowLeft className="h-4 w-4" />
            {label ?? t("Back")}
        </Button>
    );
}
