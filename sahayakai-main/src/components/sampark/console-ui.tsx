"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SamparkAI console building blocks, after the design system's Sampark boards
 * ("Sampark · Today", "Campaign live view"): white cards on hairline borders,
 * and colour only where it means something —
 *   live    peach: calling now, needs a person
 *   notice  pale indigo: information, scheduled
 *   done    leaf: reached, synced, resolved
 *   alert   rose: complaints
 * Tokens: globals.css "SamparkAI theme".
 */

export type ConsoleTone = "plain" | "live" | "notice" | "done" | "alert";

const PANEL_TONE: Record<ConsoleTone, string> = {
    plain: "border-sampark-line bg-card",
    live: "border-sampark-peach-border bg-sampark-peach",
    notice: "border-sampark-indigo-border bg-sampark-indigo-soft",
    done: "border-sampark-leaf-border bg-sampark-leaf-soft",
    alert: "border-sampark-rose-border bg-sampark-rose-soft",
};

const TEXT_TONE: Record<ConsoleTone, string> = {
    plain: "text-ink-600",
    live: "text-sampark-saffron-strong",
    notice: "text-sampark-indigo",
    done: "text-sampark-leaf",
    alert: "text-sampark-rose",
};

const ICON_TONE: Record<ConsoleTone, string> = {
    plain: "bg-sampark-slate-soft text-ink-600",
    live: "bg-sampark-peach text-sampark-saffron-strong",
    notice: "bg-sampark-indigo-soft text-sampark-indigo",
    done: "bg-sampark-leaf-soft text-sampark-leaf",
    alert: "bg-sampark-rose-soft text-sampark-rose",
};

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
                {eyebrow && <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{eyebrow}</p>}
                <h1 className="font-display text-2xl font-semibold leading-tight text-ink-900 md:text-3xl">{title}</h1>
                {description && <p className="max-w-3xl text-sm text-ink-500 md:text-base">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}

export function Panel({
    title,
    description,
    icon: Icon,
    action,
    tone = "plain",
    className,
    bodyClassName,
    children,
}: {
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    action?: ReactNode;
    tone?: ConsoleTone;
    className?: string;
    bodyClassName?: string;
    children?: ReactNode;
}) {
    return (
        <section className={cn("rounded-xl border p-4 shadow-sampark-card md:p-6", PANEL_TONE[tone], className)}>
            {(title || action) && (
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        {Icon && (
                            <span aria-hidden="true" className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone === "plain" ? ICON_TONE.plain : cn("bg-card/80", TEXT_TONE[tone]))}>
                                <Icon className="h-4 w-4" strokeWidth={1.8} />
                            </span>
                        )}
                        <div className="min-w-0">
                            {title && <h2 className="font-display text-base font-semibold leading-snug text-ink-900">{title}</h2>}
                            {description && <p className="text-sm text-ink-500">{description}</p>}
                        </div>
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

/** One headline number on a white card, with a coloured icon chip. */
export function KpiCard({
    label,
    value,
    sub,
    icon: Icon,
    tone = "plain",
    href,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon: LucideIcon;
    tone?: ConsoleTone;
    href?: string;
}) {
    const body = (
        <>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-600">{label}</span>
                <span aria-hidden="true" className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ICON_TONE[tone])}>
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold leading-none text-ink-900">{value}</p>
            {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
        </>
    );
    const cls = "block rounded-xl border border-sampark-line bg-card p-4 shadow-sampark-card";
    return href ? (
        <Link href={href} className={cn(cls, "focus-ring transition-shadow hover:shadow-sampark-raised")}>
            {body}
        </Link>
    ) : (
        <div className={cls}>{body}</div>
    );
}

/** A small number inside a card (the boards' grey inner tiles). */
export function MiniStat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
    return (
        <div className={cn("rounded-lg bg-sampark-slate-soft px-3 py-2.5", className)}>
            <p className="text-xs text-ink-500">{label}</p>
            <p className="font-display text-xl font-semibold leading-tight text-ink-900">{value}</p>
            {sub && <p className="text-xs text-ink-500">{sub}</p>}
        </div>
    );
}

/** A row that needs a person: tinted, with a chevron when it opens something. */
export function AttentionRow({
    tone = "live",
    children,
    href,
    onClick,
    trailing,
}: {
    tone?: ConsoleTone;
    children: ReactNode;
    href?: string;
    onClick?: () => void;
    trailing?: ReactNode;
}) {
    const cls = cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm text-ink-800",
        PANEL_TONE[tone],
        (href || onClick) && "focus-ring transition-colors hover:border-ink-400",
    );
    const inner = (
        <>
            <span className="min-w-0 flex-1">{children}</span>
            {trailing}
            {(href || onClick) && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />}
        </>
    );
    if (href) return <Link href={href} className={cls}>{inner}</Link>;
    if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
    return <div className={cls}>{inner}</div>;
}

export function ProgressBar({ value, max, tone = "live", label }: { value: number; max: number; tone?: ConsoleTone; label: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const fill = tone === "done" ? "bg-sampark-leaf" : tone === "notice" ? "bg-sampark-indigo" : tone === "alert" ? "bg-sampark-rose" : "bg-sampark-saffron";
    return (
        <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-sampark-slate-soft">
            <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
        </div>
    );
}

/** A coloured round mark with a glyph, for list rows (reason, event type). */
export function ToneIcon({ icon: Icon, tone = "plain", className }: { icon: LucideIcon; tone?: ConsoleTone; className?: string }) {
    return (
        <span aria-hidden="true" className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone], className)}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
    );
}
