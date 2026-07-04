"use client";

/**
 * GeneratorProgress — the in-flight card every generator shows during the
 * 20–30s AI wait.
 *
 * Same visual grammar as <RotatingProgressHint /> (Sparkles + fade-in
 * rotation, aria-live) but takes the tool's own messages instead of the
 * lesson-plan-specific hardcoded hints — a quiz must never say "Generating
 * your lesson plan…". When only one message is supplied it simply holds
 * (visually identical to the old static spinner cards on worksheet /
 * rubric / instant-answer).
 *
 * Respects prefers-reduced-motion via the `motion-safe:` prefix on the
 * spin/pulse animations (proposal 05 §5).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GeneratorProgressProps {
    /** Messages to rotate through. One message = static (no rotation). */
    messages: string[];
    /** Rotation cadence. Matches RotatingProgressHint's 6s default. */
    intervalMs?: number;
    /** Optional shape-matched skeleton rendered under the hint (exam-paper). */
    skeleton?: ReactNode;
    className?: string;
}

export function GeneratorProgress({
    messages,
    intervalMs = 6000,
    skeleton,
    className,
}: GeneratorProgressProps) {
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (messages.length <= 1) return;
        const timer = window.setInterval(() => {
            setIdx((i) => (i + 1) % messages.length);
        }, intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs, messages.length]);

    return (
        <div
            className={cn(
                "w-full rounded-surface-md border border-border bg-card shadow-soft",
                "p-8 md:p-12 flex flex-col items-center justify-center gap-4",
                "animate-in fade-in duration-300",
                className,
            )}
        >
            <Loader2 className="h-12 w-12 text-primary motion-safe:animate-spin" />
            <div
                className="flex items-center gap-2 text-sm font-medium text-primary"
                aria-live="polite"
            >
                <Sparkles className="h-4 w-4 shrink-0 motion-safe:animate-pulse" />
                <span
                    key={idx}
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-500"
                >
                    {messages[idx % messages.length]}
                </span>
            </div>
            {skeleton && <div className="w-full pt-2">{skeleton}</div>}
        </div>
    );
}
