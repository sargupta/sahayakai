"use client";

import { AlertTriangle, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import type { ScriptPreview } from "@/types/sampark";
import type { AuthedAudio } from "./use-authed-audio";
import { clipKindLabel, fmt, variantLabel } from "./labels";

/** A notice must fit one 60-second billing unit, message and menu together (plan §2, §7). */
export const CALL_SECONDS_BUDGET = 60;

/**
 * What the parent will hear in one language (and one variant, for closures):
 * every clip's exact words, its length, and a play button once the audio has
 * been rendered.
 */
export function ScriptPreviewCard({ preview, audio }: { preview: ScriptPreview; audio: AuthedAudio }) {
    const { t } = useLanguage();
    const info = PARENT_LANGUAGE_INFO[preview.language];
    const overBudget = preview.estimatedSeconds > CALL_SECONDS_BUDGET;
    const variant = variantLabel(t, preview.variant);

    return (
        <div className="rounded-surface-md border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-body font-semibold text-foreground">
                    <span lang={info.code}>{info.nativeLabel}</span>
                    {variant && <span className="text-muted-foreground"> · {variant}</span>}
                </p>
                <p className={cn("type-body", overBudget ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {fmt(t("About {seconds} seconds"), { seconds: Math.round(preview.estimatedSeconds) })}
                </p>
            </div>

            {overBudget && (
                <div className="flex items-start gap-2 rounded-surface-sm border border-destructive/40 bg-destructive/10 p-3">
                    <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-destructive" />
                    <p className="type-body text-foreground">
                        {fmt(t("Longer than the {budget}-second budget. Every call would be billed for two minutes."), { budget: CALL_SECONDS_BUDGET })}
                    </p>
                </div>
            )}

            {preview.warnings.length > 0 && (
                <ul className="space-y-1">
                    {preview.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 type-body text-foreground">
                            <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-warning" />
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
            )}

            <ol className="space-y-3">
                {preview.clips.map((clip, i) => {
                    const key = clip.audioKey;
                    const playing = key !== null && audio.playingKey === key;
                    const loading = key !== null && audio.loadingKey === key;
                    const failed = key !== null && audio.errorKey === key;
                    return (
                        <li key={`${clip.kind}-${i}`} className="space-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-medium leading-normal text-muted-foreground">
                                    {clipKindLabel(t, clip.kind)}
                                    {clip.durationSeconds !== null && (
                                        <> · {fmt(t("{seconds} s"), { seconds: Math.round(clip.durationSeconds) })}</>
                                    )}
                                </p>
                                {key ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => audio.toggle(key)}
                                        aria-label={playing ? t("Stop audio") : t("Play audio")}
                                    >
                                        {loading ? (
                                            <Loader2 aria-hidden="true" className="animate-spin" />
                                        ) : playing ? (
                                            <Pause aria-hidden="true" />
                                        ) : (
                                            <Play aria-hidden="true" />
                                        )}
                                        {playing ? t("Stop") : t("Play")}
                                    </Button>
                                ) : (
                                    <span className="text-xs leading-normal text-muted-foreground">{t("Audio not ready yet")}</span>
                                )}
                            </div>
                            <p lang={info.code} className="type-body-lg text-foreground">
                                {clip.text}
                            </p>
                            {failed && (
                                <p className="type-body text-destructive">{t("This clip could not be played. Try again.")}</p>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
