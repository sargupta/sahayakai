"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Emphasis = "default" | "success" | "warning" | "info";

/** The last bar of a sparkline (today) takes the tile's colour; earlier days stay quiet. */
const SPARK_TODAY: Record<Emphasis, string> = {
    default: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
};

/** Height of the tallest sparkline bar, in px; every other bar is scaled to it (min 4 px so a zero still shows). */
const SPARK_HEIGHT = 32;

/**
 * Seven small bars, oldest first. A null day is one the numbers may not cover (TrendDay.complete
 * false): drawn as an outline, never as a zero. `label` is the chart's spoken form.
 */
export function Sparkline({ values, label, emphasis = "default" }: { values: (number | null)[]; label: string; emphasis?: Emphasis }) {
    const max = Math.max(1, ...values.map((v) => v ?? 0));
    return (
        <div role="img" aria-label={label} className="flex h-10 shrink-0 items-end gap-1">
            {values.map((v, i) => {
                const last = i === values.length - 1;
                if (v === null) {
                    return <span key={i} className="w-2 rounded-surface-sm border border-dashed border-border" style={{ height: 4 }} />;
                }
                return (
                    <span
                        key={i}
                        className={cn("w-2 rounded-surface-sm", last ? SPARK_TODAY[emphasis] : "bg-muted-foreground/25")}
                        style={{ height: Math.max(4, Math.round((v / max) * SPARK_HEIGHT)) }}
                    />
                );
            })}
        </div>
    );
}

/** One number with its label (and optionally its last 7 days), for the Today screen and campaign counts. */
export function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
    emphasis = "default",
    trend,
    className,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon?: LucideIcon;
    emphasis?: Emphasis;
    trend?: { values: (number | null)[]; label: string };
    className?: string;
}) {
    return (
        <div
            className={cn(
                "min-w-0 rounded-surface-md border border-border bg-card shadow-soft p-4 space-y-2",
                emphasis === "success" && "border-success/30",
                emphasis === "warning" && "border-warning/40",
                emphasis === "info" && "border-info/30",
                className,
            )}
        >
            <div className="flex items-center gap-2 text-muted-foreground">
                {Icon && (
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            "h-4 w-4 shrink-0",
                            emphasis === "success" && "text-success",
                            emphasis === "warning" && "text-warning",
                            emphasis === "info" && "text-info",
                        )}
                    />
                )}
                <span className="text-xs font-medium leading-normal">{label}</span>
            </div>
            <div className="flex items-end justify-between gap-3">
                <div className="font-headline text-3xl font-bold leading-normal text-foreground">{value}</div>
                {trend && <Sparkline values={trend.values} label={trend.label} emphasis={emphasis} />}
            </div>
            {sub && <div className="text-xs leading-normal text-muted-foreground">{sub}</div>}
        </div>
    );
}
