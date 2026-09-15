/**
 * @fileOverview Blueprint preview strip — duration, max marks, and a badge per
 * section — shown under the subject field when an official blueprint matches.
 * Dumb: receives the matched blueprint + the section formatter as props.
 */
"use client";

import { Clock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/language-context";
import type { ExamBlueprint, SectionBlueprint } from "@/ai/data/board-blueprints";

interface BlueprintPreviewProps {
  blueprint: ExamBlueprint;
  formatSectionPreview: (section: SectionBlueprint) => string;
}

export function BlueprintPreview({ blueprint, formatSectionPreview }: BlueprintPreviewProps) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-4 h-4" />
          {blueprint.duration} {t("min")}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Award className="w-4 h-4" />
          {blueprint.maxMarks} {t("marks")}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {blueprint.sections.map((sec, i) => (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {sec.name}: {formatSectionPreview(sec)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
