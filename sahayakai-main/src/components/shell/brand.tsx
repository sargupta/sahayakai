import { cn } from "@/lib/utils";

/**
 * Product wordmarks for UI chrome. Per the design system the wordmark is
 * Bricolage Grotesque 600 beside a small resting orb; the raster mark is
 * never redrawn. SamparkAI shares the type and the ink, and is told apart
 * by its name, its leaf "connected" mark (two linked rings) and the
 * "by SahayakAI" endorsement, never by a new colour.
 */

/** The small resting orb that sits beside the SahayakAI wordmark. Decorative: no glyph, no motion. */
export function ChromeOrb({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn("inline-block h-[18px] w-[18px] shrink-0 rounded-pill shadow-orb", className)}
            style={{ background: "var(--orb-resting)" }}
        />
    );
}

export function SahayakWordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-2", className)}>
            <ChromeOrb />
            {compact ? (
                <span className="sr-only">SahayakAI</span>
            ) : (
                <span className="font-display text-brand font-semibold leading-none tracking-[-0.01em] text-ink-900">
                    SahayakAI
                </span>
            )}
        </span>
    );
}

/** SamparkAI's mark: two linked rings in leaf, the "connected" colour. */
export function SamparkMark({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-pill bg-tint-success",
                className,
            )}
        >
            <svg viewBox="0 0 20 20" className="h-[14px] w-[14px] text-leaf-500" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
                <circle cx="7.5" cy="10" r="4.25" />
                <circle cx="12.5" cy="10" r="4.25" />
            </svg>
        </span>
    );
}

export function SamparkWordmark({
    compact = false,
    endorsed = false,
    className,
}: {
    compact?: boolean;
    /** Show "by SahayakAI" under the name (public site, sidebar header). */
    endorsed?: boolean;
    className?: string;
}) {
    return (
        <span className={cn("inline-flex items-center gap-2", className)}>
            <SamparkMark />
            {compact ? (
                <span className="sr-only">SamparkAI</span>
            ) : (
                <span className="flex flex-col">
                    <span className="font-display text-brand font-semibold leading-none tracking-[-0.01em] text-ink-900">
                        SamparkAI
                    </span>
                    {endorsed && <span className="mt-1 text-xs leading-none text-ink-500">by SahayakAI</span>}
                </span>
            )}
        </span>
    );
}
