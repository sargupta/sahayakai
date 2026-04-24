"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageShell — the canonical page container.
 *
 * Replaces ad-hoc `<div className="max-w-[*] mx-auto px-*">` patterns
 * across pages. Three widths only — see docs/DESIGN_TOKENS.md §5.
 *
 * Standard usage:
 *   <PageShell title="Lesson Plan" breadcrumb="Create" width="default">
 *     <SectionCard>...</SectionCard>
 *     <SectionCard>...</SectionCard>
 *   </PageShell>
 *
 * Sections inside use vertical rhythm `space-y-8`.
 */
export interface PageShellProps {
  /** Container width — narrow (672px), default (1024px), wide (1280px). */
  width?: "narrow" | "default" | "wide";
  /** Page title (rendered as h1). Omit if you want a fully custom header. */
  title?: string;
  /** Optional eyebrow above the title (e.g. "Create > Lesson Plan"). */
  breadcrumb?: string;
  /** Optional subtitle / description under the title. */
  description?: string;
  /** Optional page-level CTA(s) rendered top-right of the header. */
  cta?: ReactNode;
  /** Custom className appended to the outer container. */
  className?: string;
  children: ReactNode;
}

const WIDTH_CLASS: Record<NonNullable<PageShellProps["width"]>, string> = {
  narrow: "container-narrow",
  default: "container-default",
  wide: "container-wide",
};

export function PageShell({
  width = "default",
  title,
  breadcrumb,
  description,
  cta,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn(WIDTH_CLASS[width], "py-6 md:py-10 space-y-8", className)}>
      {(title || breadcrumb || cta) && (
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {breadcrumb && (
              <div className="type-caption text-muted-foreground">{breadcrumb}</div>
            )}
            {title && <h1 className="type-h1 text-foreground">{title}</h1>}
            {description && (
              <p className="type-body-lg text-muted-foreground max-w-prose">
                {description}
              </p>
            )}
          </div>
          {cta && <div className="shrink-0">{cta}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
