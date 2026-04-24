"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SectionCard — the canonical content container inside a PageShell.
 *
 * Replaces ad-hoc <Card> usage. Standard radius, shadow, padding, and
 * internal vertical rhythm — see docs/DESIGN_TOKENS.md §8.
 *
 * Usage:
 *   <SectionCard title="Class details" description="Tell us about your class">
 *     <FieldRow label="Grade">...</FieldRow>
 *   </SectionCard>
 *
 * For helper / informational blocks: <SectionCard tone="muted">.
 */
export interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Optional action rendered top-right of the card header. */
  action?: ReactNode;
  /** Tone — `default` is white surface; `muted` is for helper blocks. */
  tone?: "default" | "muted";
  className?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  tone = "default",
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-surface-md border border-border shadow-soft p-4 md:p-6 space-y-3",
        tone === "default" ? "bg-card" : "bg-muted/30",
        className,
      )}
    >
      {(title || description || action) && (
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title && (
              <h2 className="type-h3 flex items-center gap-2 text-foreground">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                {title}
              </h2>
            )}
            {description && (
              <p className="type-body text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
