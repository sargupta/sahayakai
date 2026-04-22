"use client";

/**
 * ResultShell — unified wrapper for AI-generated content display.
 *
 * Purpose: every output page (lesson plan, quiz, rubric, worksheet, visual
 * aid, field trip, teacher advice, instant answer) previously re-invented
 * its own header, action bar, padding and shadow. At 375×812 this produced
 * a "scattered, unprofessional" feel. ResultShell centralises that chrome
 * so the content changes between tools but the frame does not.
 *
 * Mobile-first: header stacks vertically below 640px, actions wrap to a
 * new row, title scales `text-xl → 2xl → 3xl`. Actions render at 40px min
 * height so they clear the iOS HIG touch-target floor on phones.
 *
 * See outputs/ux_review_2026_04_21/DISPLAY_CONSISTENCY_AUDIT.md §3 for the
 * contract shape this implements.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ResultShellAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    variant?: "default" | "outline" | "ghost" | "destructive";
    loading?: boolean;
}

export interface ResultShellMeta {
    icon?: React.ReactNode;
    label?: string;
    value: string;
    variant?: "default" | "secondary" | "outline";
}

export type ResultShellSize = "compact" | "default";
export type ResultShellVariant = "solid" | "glass";

export interface ResultShellProps {
    /** Stable DOM id used by exportElementToPdf (e.g. "lesson-plan-pdf"). */
    id: string;
    /** Heading shown at top-left. */
    title: string;
    /** Optional subtitle beneath the title. */
    description?: string;
    /** Icon left of the title. */
    icon?: React.ReactNode;
    /** Optional badges (grade, subject, difficulty, duration…). */
    meta?: ResultShellMeta[];
    /** Buttons rendered top-right (top-of-card on mobile). */
    actions?: ResultShellAction[];
    /**
     * Max-width of the card. `default` = `max-w-4xl` (forms, lesson plans,
     * quizzes), `compact` = `max-w-2xl` (image-heavy or list-style outputs
     * like visual aids, field trips, teacher advice).
     */
    size?: ResultShellSize;
    /**
     * Surface treatment.
     * - `solid` (default): white card with soft shadow. Best legibility.
     * - `glass`: translucent `bg-white/60 backdrop-blur` + primary-tinted
     *   header gradient. Use for "creative" outputs where the content is
     *   visual (images, maps, answers with callouts).
     */
    variant?: ResultShellVariant;
    /** Main body. */
    children: React.ReactNode;
    /** Optional footer (FeedbackDialog etc.). */
    footer?: React.ReactNode;
    /** Override the outer Card className. */
    className?: string;
    /** Override the body padding. Defaults to `p-4 sm:p-6 md:p-8`. */
    contentClassName?: string;
}

const sizeClass: Record<ResultShellSize, string> = {
    compact: "max-w-2xl",
    default: "max-w-4xl",
};

const variantCardClass: Record<ResultShellVariant, string> = {
    solid: "bg-white",
    glass: "bg-white/70 backdrop-blur-lg border-white/60",
};

const variantHeaderClass: Record<ResultShellVariant, string> = {
    solid: "",
    glass: "bg-gradient-to-r from-primary/10 to-transparent",
};

export function ResultShell({
    id,
    title,
    description,
    icon,
    meta,
    actions,
    size = "default",
    variant = "solid",
    children,
    footer,
    className,
    contentClassName,
}: ResultShellProps) {
    return (
        <Card
            id={id}
            className={cn(
                "mt-6 w-full animate-fade-in-up overflow-hidden",
                sizeClass[size],
                variantCardClass[variant],
                className,
            )}
        >
            <CardHeader
                className={cn(
                    "gap-4 border-b border-border",
                    "flex flex-col sm:flex-row sm:items-start sm:justify-between",
                    "p-4 sm:p-6",
                    variantHeaderClass[variant],
                )}
            >
                <div className="flex-1 min-w-0 space-y-2">
                    <CardTitle className="font-headline text-xl sm:text-2xl md:text-3xl flex items-center gap-2">
                        {icon ? (
                            <span className="text-primary flex-shrink-0 [&>svg]:h-6 [&>svg]:w-6 sm:[&>svg]:h-7 sm:[&>svg]:w-7">
                                {icon}
                            </span>
                        ) : null}
                        <span className="break-words">{title}</span>
                    </CardTitle>

                    {description ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {description}
                        </p>
                    ) : null}

                    {meta && meta.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {meta.map((m, i) => (
                                <Badge
                                    key={i}
                                    variant={m.variant ?? "secondary"}
                                    className="flex items-center gap-1 text-xs font-normal"
                                >
                                    {m.icon}
                                    {m.label ? (
                                        <span className="text-muted-foreground">
                                            {m.label}:
                                        </span>
                                    ) : null}
                                    <span>{m.value}</span>
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                </div>

                {actions && actions.length > 0 ? (
                    <div className="no-print flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-shrink-0">
                        {actions.map((a, i) => (
                            <Button
                                key={i}
                                type="button"
                                variant={a.variant ?? "outline"}
                                onClick={a.onClick}
                                disabled={a.disabled || a.loading}
                                aria-busy={a.loading ? true : undefined}
                                // h-10 (40px) clears the iOS HIG touch-target
                                // floor on mobile while staying visually paired
                                // with the title on desktop.
                                className="h-10 px-3.5 text-sm"
                            >
                                {a.loading ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : a.icon ? (
                                    <span className="mr-1.5 [&>svg]:h-4 [&>svg]:w-4">
                                        {a.icon}
                                    </span>
                                ) : null}
                                {a.label}
                            </Button>
                        ))}
                    </div>
                ) : null}
            </CardHeader>

            <CardContent className={cn("p-4 sm:p-6 md:p-8", contentClassName)}>
                {children}
            </CardContent>

            {footer ? (
                <div className="no-print flex justify-end border-t border-border p-3 sm:p-4">
                    {footer}
                </div>
            ) : null}
        </Card>
    );
}
