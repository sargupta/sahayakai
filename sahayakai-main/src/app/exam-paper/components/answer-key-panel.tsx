/**
 * @fileOverview Collapsible Answer Key panel — derived from the per-question
 * `answerKey`/`answer` fields across all sections. Renders nothing when no
 * question carries an answer. Dumb — receives the paper as a prop.
 */
"use client";

import { BookOpen } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";
import { CollapsiblePanel } from "./collapsible-panel";

interface AnswerKeyPanelProps {
  paper: GeneratedPaper;
}

export function AnswerKeyPanel({ paper }: AnswerKeyPanelProps) {
  const { t } = useLanguage();
  const allQs = paper.sections?.flatMap((s) => s.questions) ?? [];
  const withAnswers = allQs.filter((q) => q.answerKey || q.answer);
  if (!withAnswers.length) return null;

  return (
    <CollapsiblePanel
      title={t("Answer Key")}
      icon={<BookOpen className="w-4 h-4" />}
      contentClassName="pt-0 space-y-2"
    >
      {withAnswers.map((q, i) => (
        <div key={i} className="text-sm flex gap-2">
          <span className="font-medium shrink-0">Q{q.number ?? q.questionNumber ?? i + 1}:</span>
          <span className="text-muted-foreground">{q.answerKey ?? q.answer}</span>
        </div>
      ))}
    </CollapsiblePanel>
  );
}
