/**
 * @fileOverview H1 (forensic EPG-2026-07-17): quality/warnings banner.
 * The flow already computes marks-drift, answer-key-completeness, "New"-novelty
 * and NCERT-chapter reports and ships them to the client — but nothing rendered
 * them, so a paper with drifted marks or placeholder keys looked identical to a
 * clean one. This surfaces the review signals to the teacher. Dumb component:
 * reads the report fields off the already-passed `paper` prop, renders nothing
 * when every report is clean/absent.
 */
"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";

export function PaperQualityBanner({ paper }: { paper: GeneratedPaper }) {
  const { t } = useLanguage();

  const messages: string[] = [];

  // Marks drifted and the bounded repair did NOT fix it.
  const marks = paper.marksReconciliation;
  if (marks && !marks.repaired && marks.actual !== marks.expected) {
    messages.push(
      t("Total marks are {{actual}} but should be {{expected}} — please review before use.")
        .replace("{{actual}}", String(marks.actual))
        .replace("{{expected}}", String(marks.expected)),
    );
  }

  // An answer key / marking scheme had to be floored with a placeholder.
  const keys = paper.answerKeyCompleteness;
  if (keys && keys.filledByPlaceholder > 0) {
    messages.push(
      t("{{count}} answer key(s) or marking scheme(s) use a placeholder and need review.")
        .replace("{{count}}", String(keys.filledByPlaceholder)),
    );
  }

  // A "New"-tagged question turned out to duplicate a past-paper question.
  const novelty = paper.newVerification;
  if (novelty && novelty.relabeled > 0) {
    messages.push(
      t("{{count}} question(s) marked \"New\" matched a past-paper question and were relabeled.")
        .replace("{{count}}", String(novelty.relabeled)),
    );
  }

  // NCERT chapter warnings. The message text itself is server-generated content
  // (like the questions), so it isn't t()-wrapped; the heading is.
  const chapterWarnings = (paper.validationWarnings ?? []).filter((w) => w.invalid);

  if (messages.length === 0 && chapterWarnings.length === 0) return null;

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="pt-6 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium text-warning dark:text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {t("Review this paper")}
        </div>
        <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
          {messages.map((m, i) => (
            <li key={`m${i}`}>{m}</li>
          ))}
          {chapterWarnings.map((w, i) => (
            <li key={`w${i}`}>
              <span className="font-medium">{t("Chapter check")}: </span>
              {w.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
