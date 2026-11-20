/**
 * @fileOverview "Your paper" — the paper being configured, summarised live
 * beside the exam-paper form so the teacher sees its structure before
 * generating: board/class/subject, time and marks and the section pattern from
 * the matched official blueprint (or a note that the AI will choose a standard
 * pattern), what it covers, and what it will include. Reads only form state
 * and the blueprint; owns nothing. Replaces the old blueprint badge strip.
 */
"use client";

import { Check, Clock, Award, BookOpen } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { ExamPaperViewModel } from "../hooks/use-exam-paper";

type PaperPlanProps = Pick<
  ExamPaperViewModel,
  | "board" | "gradeLevel" | "subject"
  | "matchedBlueprint" | "formatSectionPreview"
  | "chapters" | "chaptersInput" | "coverageMode"
  | "difficulty" | "language"
  | "includeAnswerKey" | "includeMarkingScheme" | "pyqRatio"
> & { className?: string };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function PaperPlan({
  board, gradeLevel, subject,
  matchedBlueprint, formatSectionPreview,
  chapters, chaptersInput, coverageMode,
  difficulty, language,
  includeAnswerKey, includeMarkingScheme, pyqRatio,
  className,
}: PaperPlanProps) {
  const { t } = useLanguage();
  const bp = matchedBlueprint;
  // Same rule the generator applies: picked chapters, else the typed list.
  const chapterCount = chapters.length || chaptersInput.split(",").map((c) => c.trim()).filter(Boolean).length;
  const includes = [
    includeAnswerKey && t("Answer Key"),
    includeMarkingScheme && t("Marking Scheme"),
    pyqRatio !== undefined && `${t("PYQ Target %")} ${pyqRatio}%`,
  ].filter(Boolean) as string[];

  return (
    <aside className={cn("rounded-panel border border-border bg-milk-200 p-4 sm:p-6", className)} aria-label={t("Your paper")}>
      <p className="type-eyebrow text-muted-foreground">{t("Your paper")}</p>

      {/* A miniature masthead, in the paper's own face. */}
      <div className="paper-sheet mt-3 rounded-xs px-4 py-5 text-center shadow-card ring-1 ring-border">
        <p className="text-xs font-semibold uppercase tracking-[0.22em]">{t(board)}</p>
        <p className="mt-1 text-lg font-bold leading-snug">{subject ? t(subject) : <span className="paper-muted italic">{t("Select subject")}</span>}</p>
        <p className="text-sm italic paper-muted">{t(gradeLevel)}</p>
        {bp && (
          <div className="paper-ui mt-3 flex justify-between border-y paper-rule py-1.5 text-xs font-semibold">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {bp.duration} {t("min")}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              {bp.maxMarks} {t("marks")}
            </span>
          </div>
        )}
      </div>

      {bp ? (
        <ol className="mt-4 space-y-2" aria-label={t("Sections")}>
          {bp.sections.map((sec, i) => (
            <li key={i} className="rounded-row border border-border bg-card px-3 py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{sec.name}</span>
                  <span className="text-muted-foreground"> · {sec.label}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-foreground">{sec.totalMarks}</span>
              </div>
              <p className="text-xs text-muted-foreground">{formatSectionPreview(sec)}</p>
              <span className="mt-2 block h-1 overflow-hidden rounded-pill bg-muted" aria-hidden="true">
                <span className="block h-full rounded-pill bg-primary/70" style={{ width: `${Math.round((sec.totalMarks / bp.maxMarks) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-row border border-dashed border-border bg-card px-3 py-2 text-sm text-muted-foreground indic-text">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {subject
            ? `${t("No blueprint for")} ${t(board)} ${t(gradeLevel)} — ${t("AI will generate a standard pattern.")}`
            : t("Pick a subject to see the paper's pattern.")}
        </p>
      )}

      <dl className="mt-3 divide-y divide-border">
        <Row label={t("Coverage")}>
          {coverageMode === "syllabus"
            ? t("Whole syllabus")
            : chapterCount
              ? t("{count} chapters").replace("{count}", String(chapterCount))
              : <span className="font-normal text-muted-foreground">{t("No chapters yet")}</span>}
        </Row>
        <Row label={t("Difficulty")}>
          <span className="capitalize">{t(difficulty.charAt(0).toUpperCase() + difficulty.slice(1))}</span>
        </Row>
        <Row label={t("Language")}>{t(language)}</Row>
      </dl>

      {includes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {includes.map((label) => (
            <li key={label} className="flex items-center gap-1 rounded-pill bg-tint-success px-2.5 py-1 text-xs font-medium text-success">
              <Check className="h-3 w-3" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
