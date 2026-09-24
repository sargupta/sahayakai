/**
 * @fileOverview Page title + subtitle for the exam-paper generator. Dumb.
 */
"use client";

import { FileText } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function ExamPaperHeader() {
  const { t } = useLanguage();
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-headline tracking-tight flex items-center gap-2">
        <FileText className="w-6 h-6 text-primary" />
        {t("Board Exam Paper Generator")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("Generate board-pattern question papers with answer keys")}
      </p>
    </div>
  );
}
