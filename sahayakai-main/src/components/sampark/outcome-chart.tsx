"use client";

/**
 * A campaign's outcomes, drawn as one partition of the families who can be called
 * (the Today hero bar, the campaign page's donut). CampaignCounts are separate
 * metrics, not a partition (dispatch/counts.ts), so the parts are derived here:
 *
 *   confirmed   pressed 1                     confirmedYes
 *   declined    pressed 2 and never 1         declinedOrOther
 *   heard       heard, but pressed neither    heardKeyFact − confirmed − declined
 *   on a call   claimed, not yet settled      inFlight
 *   no answer   not reached; rang out / busy  noAnswer
 *   failed      not reached; failed or lost   failed
 *   the rest    not called yet (or, once the campaign has stopped, never called)
 *
 * The rest is what is left of the callable families, so the parts always add up to
 * them; nothing is counted twice and nothing is invented. Opt-outs overlap the parts
 * (a family can hear the message and then press 9), so they are listed beside them.
 */
import { purposeSpec } from "@/lib/sampark/catalogue";
import { cn } from "@/lib/utils";
import type { CampaignCounts, PurposeId } from "@/types/sampark";
import { useSamparkFormat } from "./format";
import type { Translate } from "./labels";

export type OutcomeKey = "confirmed" | "declined" | "heard" | "on_call" | "no_answer" | "failed" | "rest";

export interface OutcomeSegment {
    key: OutcomeKey;
    count: number;
    label: string;
    /** Tailwind token class for swatches and bar segments. */
    className: string;
    /** The same token as a CSS colour, for the donut's conic gradient. */
    color: string;
}

const SEGMENT_STYLE: Record<OutcomeKey, { className: string; color: string }> = {
    confirmed: { className: "bg-success", color: "hsl(var(--success))" },
    declined: { className: "bg-warning", color: "hsl(var(--warning))" },
    heard: { className: "bg-info", color: "hsl(var(--info))" },
    on_call: { className: "bg-primary", color: "hsl(var(--primary))" },
    no_answer: { className: "bg-muted-foreground/50", color: "hsl(var(--muted-foreground) / 0.5)" },
    failed: { className: "bg-destructive", color: "hsl(var(--destructive))" },
    rest: { className: "bg-border", color: "hsl(var(--border))" },
};

function key1MeansHeard(purpose: PurposeId): boolean {
    try {
        return purposeSpec(purpose).menu?.key1 === "heard";
    } catch {
        return false;
    }
}

export interface CampaignOutcome {
    segments: OutcomeSegment[];
    /** Families the gates allow (guardians − blocked). The segments add up to this. */
    callable: number;
    /** Families with at least one call placed. */
    called: number;
}

/**
 * The partition above for one campaign. `stillCalling` names the rest "Waiting to call"
 * while the campaign can still dial, and "Not called" once it has stopped.
 */
export function campaignOutcome(t: Translate, purpose: PurposeId, counts: CampaignCounts, stillCalling: boolean): CampaignOutcome {
    const callable = Math.max(0, counts.guardians - counts.blocked);
    const confirmed = counts.confirmedYes;
    const declined = counts.declinedOrOther;
    const heard = Math.max(0, counts.heardKeyFact - confirmed - declined);
    const parts: [OutcomeKey, number, string][] = [
        ["confirmed", confirmed, key1MeansHeard(purpose) ? t("Confirmed they heard (pressed 1)") : t("Will come (pressed 1)")],
        ["declined", declined, t("Cannot come (pressed 2)")],
        ["heard", heard, t("Heard, did not reply")],
        ["on_call", counts.inFlight, t("On a call now")],
        ["no_answer", counts.noAnswer, t("No answer")],
        ["failed", counts.failed, t("Could not connect")],
    ];
    const called = Math.min(callable, parts.reduce((s, [, n]) => s + n, 0));
    parts.push(["rest", Math.max(0, callable - called), stillCalling ? t("Waiting to call") : t("Not called")]);
    return {
        callable,
        called,
        segments: parts.map(([key, count, label]) => ({ key, count, label, ...SEGMENT_STYLE[key] })),
    };
}

/** "19 Will come (pressed 1), 5 Cannot come (pressed 2), …" — the spoken form of a chart. */
export function segmentsSummary(segments: OutcomeSegment[], number: (n: number) => string): string {
    return segments.filter((s) => s.count > 0).map((s) => `${number(s.count)} ${s.label}`).join(", ");
}

/** The segmented bar: one part per non-empty segment, widths in proportion. */
export function OutcomeBar({ segments, label, className }: { segments: OutcomeSegment[]; label: string; className?: string }) {
    const shown = segments.filter((s) => s.count > 0);
    return (
        <div role="img" aria-label={label} className={cn("flex h-3 gap-1 overflow-hidden rounded-pill bg-card", className)}>
            {shown.map((s) => (
                <span key={s.key} className={cn("h-full", s.className)} style={{ flexGrow: s.count, flexBasis: 0 }} />
            ))}
        </div>
    );
}

/** Swatch, number and words for each segment (and any extra rows, such as opt-outs). */
export function OutcomeLegend({
    segments,
    extra,
    hideEmpty = false,
    className,
}: {
    segments: OutcomeSegment[];
    extra?: { key: string; count: number; label: string }[];
    hideEmpty?: boolean;
    className?: string;
}) {
    const f = useSamparkFormat();
    const shown = hideEmpty ? segments.filter((s) => s.count > 0) : segments;
    return (
        <ul className={cn("flex flex-wrap gap-x-6 gap-y-2", className)}>
            {shown.map((s) => (
                <li key={s.key} className="inline-flex items-center gap-2 type-body text-muted-foreground">
                    <span aria-hidden="true" className={cn("h-3 w-3 shrink-0 rounded-surface-sm", s.className)} />
                    <span className="font-semibold text-foreground">{f.number(s.count)}</span>
                    <span>{s.label}</span>
                </li>
            ))}
            {extra?.map((x) => (
                <li key={x.key} className="inline-flex items-center gap-2 type-body text-muted-foreground">
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-surface-sm border border-border" />
                    <span className="font-semibold text-foreground">{f.number(x.count)}</span>
                    <span>{x.label}</span>
                </li>
            ))}
        </ul>
    );
}

/** A ring of the segments with a figure in the middle (the campaign page's "Outcomes so far"). */
export function OutcomeDonut({ segments, label, centre, caption }: { segments: OutcomeSegment[]; label: string; centre: string; caption: string }) {
    const total = segments.reduce((s, x) => s + x.count, 0);
    let at = 0;
    const stops = total > 0
        ? segments
              .filter((s) => s.count > 0)
              .map((s) => {
                  const from = at;
                  at += (s.count / total) * 100;
                  return `${s.color} ${from}% ${at}%`;
              })
              .join(", ")
        : "hsl(var(--border)) 0% 100%";
    return (
        <div className="flex shrink-0 flex-col items-center gap-2">
            <div
                role="img"
                aria-label={label}
                className="flex h-32 w-32 items-center justify-center rounded-pill"
                style={{ background: `conic-gradient(${stops})` }}
            >
                <div className="flex h-24 w-24 items-center justify-center rounded-pill bg-card">
                    <span className="font-headline text-2xl font-bold leading-normal text-foreground">{centre}</span>
                </div>
            </div>
            <span className="max-w-32 text-center text-xs leading-normal text-muted-foreground">{caption}</span>
        </div>
    );
}
