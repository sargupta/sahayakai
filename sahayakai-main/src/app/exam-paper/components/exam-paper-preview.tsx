/**
 * @fileOverview Generated-paper result view: the typeset paper (left) beside a
 * paper outline (right, sticky on wide screens) with the marks check, the
 * per-section jump list and the blueprint summary; the toolbar above the paper
 * carries Print / Save as PDF, Edit (per-question regenerate), Save to Library
 * and Question sets. Dumb container — receives the relevant slice of the
 * useExamPaper view-model. Rendered by the page only when a paper exists and
 * generation has finished.
 */
"use client";

import { useState } from "react";
import { AlertCircle, Pencil, Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { buildExamPaperBodyHtml, openPrintBlob, wrapExamPaperDoc } from "@/lib/exam-paper-print";
import type { ExamPaperViewModel } from "../hooks/use-exam-paper";
import { PaperQualityBanner } from "./paper-quality-banner";
import { ExamPaperDocument } from "./exam-paper-document";
import { PaperOutline } from "./paper-outline";
import { PaperActions } from "./paper-actions";

type ExamPaperPreviewProps = Pick<
  ExamPaperViewModel,
  "paper" | "includeAnswerKey" | "includeMarkingScheme" | "saving" | "saved" | "handleSave" | "regenerateQuestion" | "regeneratingKey"
>;

export function ExamPaperPreview({
  paper,
  includeAnswerKey,
  includeMarkingScheme,
  saving,
  saved,
  handleSave,
  regenerateQuestion,
  regeneratingKey,
}: ExamPaperPreviewProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  if (!paper) return null;

  const hasSections = !!paper.sections?.length;

  // One paper, printed through the same builder as the Library download and the
  // question sets, so every export of a paper looks the same.
  const printPaper = () => {
    if (!hasSections) return;
    const title = paper.title || `${paper.board || ""} ${paper.subject || ""}`.trim() || t("Exam Paper");
    const clean = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "Exam_Paper";
    openPrintBlob(wrapExamPaperDoc(title, buildExamPaperBodyHtml(paper, t)), clean, () =>
      toast({
        title: t("Popup blocked"),
        description: t("Saved as HTML instead. Open the file and press Ctrl/Cmd+P to save as PDF."),
      }),
    );
  };

  return (
    <section aria-label={t("Result")} className="space-y-5">
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <span className="type-eyebrow px-2 text-muted-foreground">{t("Your paper")}</span>
        <hr className="flex-1 border-border" />
      </div>

      <PaperQualityBanner paper={paper} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          {/* Toolbar: the actions a teacher takes on a finished paper. */}
          <div className="flex flex-wrap items-center gap-2 rounded-row border border-border bg-card p-2 shadow-card">
            <Button size="sm" onClick={printPaper} disabled={!hasSections} className="gap-2">
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t("Print / Save as PDF")}
            </Button>
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing((v) => !v)}
              aria-pressed={isEditing}
              className="gap-2"
            >
              {isEditing ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
              {isEditing ? t("Done editing") : t("Edit")}
            </Button>
            <div className="ms-auto flex flex-wrap gap-2">
              <PaperActions saving={saving} saved={saved} onSave={handleSave} paper={paper} />
            </div>
          </div>

          {isEditing && (
            <p className="rounded-row bg-tint-accent-soft px-4 py-2 text-sm text-foreground">
              {t("Regenerate any question you don't like. Its marks stay the same, so the paper still adds up.")}
            </p>
          )}

          {hasSections ? (
            <div className="rounded-panel bg-milk-200 p-2 sm:p-6">
              <ExamPaperDocument
                paper={paper}
                includeAnswerKey={includeAnswerKey}
                includeMarkingScheme={includeMarkingScheme}
                isEditing={isEditing}
                onRegenerateQuestion={regenerateQuestion}
                regeneratingKey={regeneratingKey}
              />
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
              {t("No sections were generated. Please try again.")}
            </div>
          )}
        </div>

        <PaperOutline paper={paper} className="xl:sticky xl:top-24 xl:col-span-4" />
      </div>
    </section>
  );
}
