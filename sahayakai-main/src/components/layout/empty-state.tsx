"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

/**
 * EmptyState — Phase 7 (2026-04-24).
 *
 * Replaces illustration-based "nothing here yet" blocks. Rural users
 * often read illustrations literally ("where is the file cabinet?");
 * urban users tolerate them but find them thin. A labeled Example card
 * shows what's *about* to be here and nudges toward the first action.
 *
 * Structure:
 *   - Icon + short title (what this space shows when filled)
 *   - Description (one sentence, what to do)
 *   - Sample card preview with a clear "Example" badge
 *   - Primary CTA + optional secondary
 *
 * Use `sample` to render a preview of what a populated row/card looks
 * like. The preview is tagged with an "Example" ribbon so users know
 * it's not a real item of theirs.
 */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional sample card preview of a populated item. */
  sample?: ReactNode;
  /** Primary action (e.g. "Create your first lesson plan"). */
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Optional secondary action. */
  secondaryCta?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  sample,
  cta,
  secondaryCta,
  className,
}: EmptyStateProps) {
  const { t } = useLanguage();

  const renderCta = (action: EmptyStateProps["cta"], variant: "primary" | "secondary") => {
    if (!action) return null;
    const classes = cn(
      "rounded-surface-md",
      variant === "primary" && "gap-2 min-h-11 px-5",
    );
    if (action.href) {
      return (
        <Button asChild variant={variant === "primary" ? "default" : "ghost"} className={classes}>
          <a href={action.href}>{action.label}</a>
        </Button>
      );
    }
    return (
      <Button
        type="button"
        onClick={action.onClick}
        variant={variant === "primary" ? "default" : "ghost"}
        className={classes}
      >
        {action.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center py-8 md:py-12 space-y-6",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 max-w-md">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-pill bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="type-h3 text-foreground">{title}</h3>
        <p className="type-body text-muted-foreground">{description}</p>
      </div>

      {sample && (
        <div className="w-full max-w-md relative">
          <div className="absolute -top-2 left-4 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border">
            {t("Example")}
          </div>
          <div className="rounded-surface-md border border-dashed border-border bg-muted/20 p-4">
            {sample}
          </div>
        </div>
      )}

      {(cta || secondaryCta) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {renderCta(secondaryCta, "secondary")}
          {renderCta(cta, "primary")}
        </div>
      )}
    </div>
  );
}
