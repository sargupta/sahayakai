"use client";

/**
 * GeneratorPage — the presentational shell every generator tool composes.
 *
 * Owns the page frame that quiz/rubric/worksheet/instant-answer/exam-paper
 * each hand-rolled in a drifting dialect: page header (icon tile + eyebrow +
 * title + description + usage badge), UpgradePrompt on limit, the form card,
 * the in-flight progress card, the "Result" divider, and the result region.
 * A redesign now lands here once and applies everywhere.
 *
 * Layout (2026-11 redesign): the header sits on the page ground, left-aligned
 * like the rest of the app, so the form card holds only the form. Views split
 * their form into numbered <GeneratorSection>s and end it with
 * <GeneratorSubmitBar> — a card footer with the action on the right on md+.
 * Result displays bring their own card (ResultShell), so the shell no longer
 * wraps them in a second tinted frame.
 *
 * Accessibility (proposal 11): the result region is `aria-live="polite"`
 * and `aria-busy` while generating, so screen readers announce both the
 * start and the completion of a generation — previously silent.
 *
 * Mobile (proposal 07): <GeneratorSubmitBar> keeps the Generate button
 * sticky in the thumb zone above the bottom nav (h-14 + safe-area inset).
 *
 * See docs/design/proposals/05-frontend-arch.md §2b.
 */

import { useId, type ReactNode } from "react";
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
    /** Small label above the title. Defaults to t("Make") (the sidebar group). */
    eyebrow?: string;
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
            <span className="type-eyebrow text-saffron-700 indic-text">{label}</span>
            <hr className="flex-1 border-border" />
        </div>
    );
}

/**
 * Page header shared by every tool page (generators, exam paper, AI Coach):
 * a saffron icon tile, an eyebrow naming the sidebar group, the title and a
 * one-line purpose. `actions` sits top-right on wide screens.
 */
export function GeneratorHeader({
    icon: Icon,
    eyebrow,
    title,
    description,
    extra,
    actions,
    className,
}: {
    icon: LucideIcon;
    eyebrow?: string;
    title: string;
    description?: ReactNode;
    extra?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5", className)}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-tint-accent-soft text-saffron-600 ring-1 ring-primary/15 shadow-current sm:h-14 sm:w-14">
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                {eyebrow && <p className="type-eyebrow text-saffron-700 indic-text">{eyebrow}</p>}
                <h1 className="font-headline text-3xl font-semibold leading-tight tracking-tight text-foreground indic-text md:text-4xl">
                    {title}
                </h1>
                {description && (
                    <div className="max-w-2xl text-base leading-relaxed text-muted-foreground indic-text">
                        {description}
                    </div>
                )}
                {extra && <div className="pt-1">{extra}</div>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2 sm:pt-1">{actions}</div>}
        </header>
    );
}

/**
 * One numbered group of fields inside the form card ("1 Describe it",
 * "2 Details"). Sections are separated by a hairline; the number is
 * decorative (the heading carries the meaning for screen readers).
 */
export function GeneratorSection({
    step,
    title,
    description,
    aside,
    children,
    className,
}: {
    step?: number;
    title: string;
    description?: ReactNode;
    /** Right-aligned next to the heading (e.g. an info button). */
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const headingId = useId();
    return (
        <section
            aria-labelledby={headingId}
            className={cn("space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0 md:pt-8", className)}
        >
            <div className="flex items-start gap-3">
                {step != null && (
                    <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-saffron-50 text-xs font-semibold text-saffron-700 ring-1 ring-primary/20"
                    >
                        {step}
                    </span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                    <h2 id={headingId} className="font-headline text-lg font-semibold leading-snug text-foreground indic-text">
                        {title}
                    </h2>
                    {description && <p className="text-sm text-muted-foreground indic-text">{description}</p>}
                </div>
                {aside}
            </div>
            <div className={cn(step != null && "md:pl-10")}>{children}</div>
        </section>
    );
}

export function GeneratorPage({
    icon,
    title,
    eyebrow,
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
        <div className={cn(WIDTH_CLASS[width], "space-y-8 py-6 md:py-10", className)}>
            <GeneratorHeader
                icon={icon}
                eyebrow={eyebrow ?? t("Make")}
                title={title}
                description={description}
                extra={headerExtra}
            />

            {showLimitPrompt && feature && limitState && (
                <UpgradePrompt
                    feature={feature}
                    used={limitState.used ?? 0}
                    limit={limitState.limit ?? 0}
                />
            )}
            {limitState?.serviceBusy && limitState.message && (
                <p className="rounded-row border border-warning/30 bg-tint-warning px-4 py-3 text-sm text-warning" role="status">
                    {limitState.message}
                </p>
            )}

            {/* ── Input card ──────────────────────────────────────────────── */}
            <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <div className="card-accent-bar" />
                <div className="p-4 sm:p-6 md:p-8">{form}</div>
            </section>

            {/* ── Result region ───────────────────────────────────────────── */}
            <div aria-live="polite" aria-busy={isGenerating} className="space-y-6">
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
                        <div>{result}</div>
                        {afterResult}
                    </>
                )}

                {status === "idle" && !result && resolvedEmpty && (
                    <EmptyState
                        icon={icon}
                        title={resolvedEmpty.title}
                        description={resolvedEmpty.description}
                        className="rounded-card border border-dashed border-border bg-surface-segment py-8 md:py-10"
                    />
                )}
            </div>
        </div>
    );
}

/**
 * GeneratorSubmitBar — the form card's footer: an optional hint (e.g. why AI
 * is unavailable) and the Generate button, right-aligned on md+. On mobile it
 * stays sticky in the thumb zone above the h-14 bottom nav + safe-area inset
 * (proposal 07 §quick-wins).
 */
export function GeneratorSubmitBar({
    children,
    hint,
    className,
}: {
    children: ReactNode;
    hint?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-30",
                "md:static md:bottom-auto md:z-auto",
                "md:flex md:items-center md:justify-end md:gap-4 md:border-t md:border-border md:pt-6",
                className,
            )}
        >
            {hint && <div className="mb-2 text-center text-xs text-warning md:mb-0 md:mr-auto md:text-left">{hint}</div>}
            {children}
        </div>
    );
}

/** The Generate button's classes, shared so every tool's primary action matches. */
export const GENERATOR_SUBMIT_CLASS =
    "h-12 w-full px-8 text-base font-headline shadow-cta transition-shadow duration-micro ease-out-quart md:w-auto md:min-w-56";
