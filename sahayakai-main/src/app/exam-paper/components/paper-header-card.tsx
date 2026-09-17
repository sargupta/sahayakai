/**
 * @fileOverview Generated-paper header card: title, duration, max marks, and
 * the general-instructions list. Dumb — receives the paper as a prop.
 */
"use client";

import { Clock, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";

interface PaperHeaderCardProps {
  paper: GeneratedPaper;
}

export function PaperHeaderCard({ paper }: PaperHeaderCardProps) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-lg text-center">
          {paper.title || `${t(paper.board)} ${t(paper.gradeLevel)} ${t(paper.subject)}`}
        </CardTitle>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {typeof paper.duration === 'number' ? `${paper.duration} ${t("min")}` : paper.duration}
          </span>
          <span className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            {paper.maxMarks} {t("marks")}
          </span>
        </div>
      </CardHeader>
      {paper.generalInstructions && paper.generalInstructions.length > 0 && (
        <CardContent className="pt-0">
          <div className="text-sm space-y-1 border-t border-border pt-3">
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {t("General Instructions")}
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              {paper.generalInstructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
