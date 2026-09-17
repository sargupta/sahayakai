/**
 * @fileOverview Generated-paper result view: header card, per-section cards,
 * the answer-key + marking-scheme collapsibles, the blueprint summary, and the
 * action bar. Dumb container — receives the relevant slice of the useExamPaper
 * view-model. Rendered by the page only when a paper exists and generation has
 * finished.
 */
"use client";

import { useState } from "react";
import { AlertCircle, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/language-context";
import type { ExamPaperViewModel } from "../hooks/use-exam-paper";
import { PaperHeaderCard } from "./paper-header-card";
import { PaperQualityBanner } from "./paper-quality-banner";
import { PaperSectionCard } from "./paper-section-card";
import { AnswerKeyPanel } from "./answer-key-panel";
import { MarkingSchemePanel } from "./marking-scheme-panel";
import { BlueprintSummary } from "./blueprint-summary";
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
  const [isEditing, setIsEditing] = useState(false);
  if (!paper) return null;

  return (
    <div className="space-y-4">
      <div className="my-8 flex items-center gap-3">
        <hr className="flex-1 border-border/40" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{t("Result")}</span>
        <hr className="flex-1 border-border/40" />
      </div>
      <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4 space-y-4">
        {/* Paper Header */}
        <PaperHeaderCard paper={paper} />

        {/* H1: quality/warnings banner (renders only when a report is non-clean) */}
        <PaperQualityBanner paper={paper} />

        {/* Edit toggle — reveals a per-question Regenerate button (questions
            themselves stay read-only). A regenerate sets saved=false, re-enabling
            Save below. */}
        <div className="flex justify-end">
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? <Check className="w-4 h-4 mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
            {isEditing ? t("Done editing") : t("Edit")}
          </Button>
        </div>

        {/* Sections with Questions */}
        {(!paper.sections || paper.sections.length === 0) && (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground py-8">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t("No sections were generated. Please try again.")}
            </CardContent>
          </Card>
        )}
        {paper.sections?.map((section, si) => (
          <PaperSectionCard
            key={si}
            section={section}
            sectionIndex={si}
            isEditing={isEditing}
            onRegenerateQuestion={regenerateQuestion}
            regeneratingKey={regeneratingKey}
          />
        ))}

        {/* Answer Key + Marking Scheme (derived from per-question fields) */}
        {includeAnswerKey && <AnswerKeyPanel paper={paper} />}
        {includeMarkingScheme && <MarkingSchemePanel paper={paper} />}

        {/* Blueprint Summary */}
        {paper.blueprintSummary && <BlueprintSummary summary={paper.blueprintSummary} />}

        {/* Action buttons */}
        <PaperActions saving={saving} saved={saved} onSave={handleSave} paper={paper} />
      </div>
    </div>
  );
}
