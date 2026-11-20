"use client";

/**
 * "Your sheet" — the worksheet being set up, drawn as the top of the printed
 * sheet beside the form: the student-details lines, subject · class ·
 * language, the teacher's request as the working title, the uploaded textbook
 * page, and what every generated sheet contains (objectives, instructions,
 * numbered activities with answer space, an answer key on its own page — the
 * worksheet flow's fixed output, see src/lib/worksheet-structure.ts). Reads
 * form values only; owns nothing.
 */

import { Check, ImageIcon } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

interface WorksheetSheetPreviewProps {
    prompt?: string;
    gradeLevel?: string;
    subject?: string;
    languageLabel?: string;
    imageDataUri?: string;
    className?: string;
}

export function WorksheetSheetPreview({ prompt, gradeLevel, subject, languageLabel, imageDataUri, className }: WorksheetSheetPreviewProps) {
    const { t } = useLanguage();
    const meta = [subject && subject !== "General" ? t(subject) : null, gradeLevel ? t(gradeLevel) : null, languageLabel].filter(Boolean);
    const contents = [
        t("What you will learn"),
        t("Before you begin"),
        t("Numbered activities with room to write"),
        t("An answer key for you"),
    ];

    return (
        <aside className={cn("rounded-panel border border-border bg-milk-200 p-4 sm:p-6", className)} aria-label={t("Your sheet")}>
            <p className="type-eyebrow text-muted-foreground">{t("Your sheet")}</p>

            <div className="paper-sheet relative mt-3 overflow-hidden rounded-xs px-5 pb-6 pt-5 shadow-card ring-1 ring-border">
                <div className="paper-ui grid grid-cols-[1fr_auto] gap-x-3 text-xs paper-muted">
                    <span className="border-b paper-rule pb-1">{t("Name")}:</span>
                    <span className="w-16 border-b paper-rule pb-1">{t("Date")}:</span>
                </div>
                <div className="mt-5 border-b-2 border-ink-900 pb-3">
                    {meta.length > 0 && <p className="paper-ui text-xs font-semibold uppercase tracking-[0.18em] text-saffron-700">{meta.join(" · ")}</p>}
                    <p className={cn("mt-1 line-clamp-3 font-headline text-xl font-semibold leading-snug", !prompt?.trim() && "paper-muted")}>
                        {prompt?.trim() || t("Your worksheet title appears here")}
                    </p>
                </div>
                <div className="mt-4 flex gap-3">
                    <span className="font-headline text-3xl font-semibold leading-none text-saffron-600" aria-hidden="true">
                        01
                    </span>
                    <div className="flex-1 space-y-2 pt-1" aria-hidden="true">
                        <div className="paper-lines h-16" />
                    </div>
                </div>
                {/* Fades the sheet out: this is the top of a page, not the whole page. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-row border border-border bg-card p-2">
                {imageDataUri ? (
                    // A local data: URI preview, so a plain <img> (next/image cannot optimise it).
                    <img src={imageDataUri} alt={t("Textbook Page Image")} className="h-14 w-11 shrink-0 rounded-xs object-cover ring-1 ring-border" />
                ) : (
                    <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-xs border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                )}
                <p className="text-sm text-muted-foreground">
                    {imageDataUri ? t("Made from your textbook page") : t("Upload a textbook page to start")}
                </p>
            </div>

            <ul className="mt-4 space-y-2 text-sm">
                {contents.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        {c}
                    </li>
                ))}
            </ul>
        </aside>
    );
}
