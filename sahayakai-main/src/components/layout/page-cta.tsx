"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PageCTA — the canonical primary action bar for a page or section.
 *
 * Enforces "one primary action per screen" — the secondary action is
 * always a quieter affordance. On mobile, set sticky=true to dock the
 * bar to the bottom of the viewport (above the bottom nav, which lands
 * in Phase 4).
 *
 * Usage:
 *   <PageCTA
 *     primary={{ label: t("Generate"), onClick: handleGenerate, loading }}
 *     secondary={{ label: t("Cancel"), onClick: handleCancel }}
 *     sticky
 *   />
 */
export interface CTAAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
}

export interface PageCTAProps {
  primary: CTAAction;
  secondary?: CTAAction;
  /** When true, the bar fixes to the bottom of the viewport on mobile. */
  sticky?: boolean;
  /** Helper text rendered to the left of the buttons. */
  helper?: ReactNode;
  className?: string;
}

export function PageCTA({
  primary,
  secondary,
  sticky = false,
  helper,
  className,
}: PageCTAProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 justify-end flex-wrap",
        sticky && [
          // Mobile: fix to bottom, full width, raised surface.
          "fixed inset-x-0 bottom-0 z-30 px-4 py-3 bg-background/95 backdrop-blur",
          "border-t border-border shadow-floating",
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          // Desktop: revert to inline.
          "md:static md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none md:border-0 md:shadow-none md:pb-0",
        ],
        className,
      )}
    >
      {helper && (
        <div className="type-body text-muted-foreground mr-auto">{helper}</div>
      )}
      {secondary && (
        <Button
          type="button"
          variant="ghost"
          onClick={secondary.onClick}
          disabled={secondary.disabled || secondary.loading}
          className="rounded-surface-md"
        >
          {secondary.icon}
          {secondary.label}
        </Button>
      )}
      <Button
        type="button"
        onClick={primary.onClick}
        disabled={primary.disabled || primary.loading}
        className="rounded-surface-md gap-2 min-h-11 px-5"
      >
        {primary.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          primary.icon
        )}
        {primary.label}
      </Button>
    </div>
  );
}
