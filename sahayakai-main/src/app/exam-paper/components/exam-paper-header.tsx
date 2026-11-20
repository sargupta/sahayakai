/**
 * @fileOverview Page header for the exam-paper generator — the shared tool
 * header (icon tile, eyebrow, title, purpose). Dumb.
 */
"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { GeneratorHeader } from "@/features/generator";

export function ExamPaperHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <GeneratorHeader
      icon={FileText}
      eyebrow={t("Make")}
      title={t("Board Exam Paper Generator")}
      description={t("Generate board-pattern question papers with answer keys")}
      actions={actions}
    />
  );
}
