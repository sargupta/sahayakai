"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One number with its label, for the Today screen and campaign counts. */
export function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
    emphasis = "default",
    className,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon?: LucideIcon;
    emphasis?: "default" | "success" | "warning" | "info";
    className?: string;
}) {
    return (
        <div
            className={cn(
                "rounded-surface-md border border-border bg-card shadow-soft p-4 space-y-2",
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
            <div className="font-headline text-2xl font-semibold leading-normal text-foreground">{value}</div>
            {sub && <div className="type-body text-muted-foreground">{sub}</div>}
        </div>
    );
}
