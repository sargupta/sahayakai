"use client";

/**
 * GeneratorPage — the presentational shell every generator tool composes.
 *
 * Owns the page frame that quiz/rubric/worksheet/instant-answer/exam-paper
 * each hand-rolled in a drifting dialect: header (icon + title +
 * description + usage badge), UpgradePrompt on limit, the form card with
 * accent bar, the in-flight progress card, the "Result" divider, and the
 * result region. A redesign now lands here once and applies everywhere.
 *
 * Accessibility (proposal 11): the result region is `aria-live="polite"`
 * and `aria-busy` while generating, so screen readers announce both the
 * start and the completion of a generation — previously silent.
 *
 * Mobile (proposal 07): wrap the Generate button in <GeneratorSubmitBar>
 * inside the form slot to keep it sticky in the thumb zone above the
 * bottom nav (h-14 + safe-area inset).
 *
 * See docs/design/proposals/05-frontend-arch.md §2b.
 */

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { GENERATOR_SHELL_COPY } from "../i18n";
import { type GeneratorStatus } from "../types";
import { GeneratorProgress } from "./generator-progress";

/** Structural subset of use-limit-guard's LimitState the shell needs. */
export interface GeneratorLimitState {
    limitReached: boolean;
    upgradeRequired: boolean;
    serviceBusy: boolean;
    message: string | null;
    used: number | null;
    limit: number | null;
}

export interface GeneratorPageProps {
    icon: LucideIcon;
    title: string;
    /** Plain text or rich node (rubric renders an info Dialog inline). */
    description?: ReactNode;
    /** Rendered under the description — e.g. <UsageRemainingBadge />. */
    headerExtra?: ReactNode;
    /** Feature key for the UpgradePrompt (quiz, worksheet, …). */
    feature?: string;
    /** Wire straight from useGenerator().limitState to get UpgradePrompt. */
    limitState?: GeneratorLimitState;
    /** Page width — narrow (672px), default (1024px), wide (1280px). */
    width?: "narrow" | "default" | "wide";
    /** The input panel: fields + submit button (form element included). */
    form: ReactNode;
    status: GeneratorStatus;
    /** Progress hint messages while generating. Falls back to title. */
    progressMessages?: string[];
    /** Optional shape-matched skeleton under the hint (exam-paper). */
    progressSkeleton?: ReactNode;
    /** The rendered output (display component) once status is "done". */
    result?: ReactNode;
    /** Rendered after the result frame — e.g. <ShareToCommunityCTA />. */
    afterResult?: ReactNode;
    /** Label for the divider above the result. Defaults to t("Result"). */
    resultLabel?: string;
    /**
     * Idle-state placeholder in the result region. Defaults to the shared
     * 11-language shell copy; pass `false` to render nothing (old behavior).
     */
    emptyState?: { title: string; description: string } | false;
    className?: string;
}

const WIDTH_CLASS: Record<NonNullable<GeneratorPageProps["width"]>, string> = {
    narrow: "container-narrow",
    default: "container-default",
    wide: "container-wide",
};

function ResultDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="type-caption text-muted-foreground uppercase tracking-widest px-2">
                {label}
            </span>
            <hr className="flex-1 border-border/40" />
        </div>
    );
}

export function GeneratorPage({
    icon: Icon,
    title,
    description,
    headerExtra,
    feature,
    limitState,
    width = "default",
    form,
    status,
    progressMessages,
    progressSkeleton,
    result,
    afterResult,
    resultLabel,
    emptyState,
    className,
}: GeneratorPageProps) {
    const { t, language } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || "en";
    const shellCopy = GENERATOR_SHELL_COPY[uiLangCode] || GENERATOR_SHELL_COPY.en;

    const isGenerating =
        status === "validating" || status === "generating" || status === "streaming";
    const showLimitPrompt =
        !!limitState && (limitState.limitReached || limitState.upgradeRequired);
    const resolvedEmpty =
        emptyState === false
            ? null
            : emptyState ?? {
                title: shellCopy.emptyTitle,
                description: shellCopy.emptyDescription,
            };

    return (
        <div className={cn(WIDTH_CLASS[width], "py-8 space-y-8", className)}>
            {/* ── Input card ──────────────────────────────────────────────── */}
            <section className="rounded-surface-md border border-border bg-card shadow-soft overflow-hidden">
                <div className="card-accent-bar" />
                <div className="p-4 sm:p-6 space-y-6">
                    <header className="text-center space-y-2">
                        <div className="flex justify-center items-center mb-2">
                            <div className="p-3 rounded-full bg-primary/10 text-primary">
                                <Icon className="w-8 h-8" aria-hidden="true" />
                            </div>
                        </div>
                        <h1 className="font-headline text-2xl sm:text-3xl text-foreground">
                            {title}
                        </h1>
                        {description && (
                            <div className="text-sm text-muted-foreground max-w-prose mx-auto">
                                {description}
                            </div>
                        )}
                        {headerExtra}
                    </header>

                    {showLimitPrompt && feature && limitState && (
                        <UpgradePrompt
                            feature={feature}
                            used={limitState.used ?? 0}
                            limit={limitState.limit ?? 0}
                        />
                    )}
                    {limitState?.serviceBusy && limitState.message && (
                        <p className="text-xs text-amber-600 text-center" role="status">
                            {limitState.message}
                        </p>
                    )}

                    {form}
                </div>
            </section>

            {/* ── Result region ───────────────────────────────────────────── */}
            <div aria-live="polite" aria-busy={isGenerating} className="space-y-8">
                {isGenerating && (
                    <GeneratorProgress
                        messages={
                            progressMessages && progressMessages.length > 0
                                ? progressMessages
                                : [title]
                        }
                        skeleton={progressSkeleton}
                    />
                )}

                {!isGenerating && result && (
                    <>
                        <ResultDivider label={resultLabel ?? t("Result")} />
                        <div className="rounded-surface-md border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4">
                            {result}
                        </div>
                        {afterResult}
                    </>
                )}

                {status === "idle" && !result && resolvedEmpty && (
                    <EmptyState
                        icon={Icon}
                        title={resolvedEmpty.title}
                        description={resolvedEmpty.description}
                        className="py-6 md:py-8"
                    />
                )}
            </div>
        </div>
    );
}

/**
 * GeneratorSubmitBar — wraps the Generate button so it stays in the thumb
 * zone on mobile (sticky above the h-14 bottom nav + safe-area inset),
 * and behaves as a normal block on md+ screens. Proposal 07 §quick-wins.
 */
export function GeneratorSubmitBar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-30",
                "md:static md:bottom-auto md:z-auto",
                className,
            )}
        >
            {children}
        </div>
    );
}
