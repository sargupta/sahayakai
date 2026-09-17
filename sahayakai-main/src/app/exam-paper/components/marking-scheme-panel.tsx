/**
 * @fileOverview Collapsible Marking Scheme panel — derived from the
 * per-question `markingScheme` fields across all sections. Renders nothing
 * when no question carries a scheme. Dumb — receives the paper as a prop.
 */
"use client";

import { Award } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";
import { CollapsiblePanel } from "./collapsible-panel";

interface MarkingSchemePanelProps {
  paper: GeneratedPaper;
}

export function MarkingSchemePanel({ paper }: MarkingSchemePanelProps) {
  const { t } = useLanguage();
  const allQs = paper.sections?.flatMap((s) => s.questions) ?? [];
  const withScheme = allQs.filter((q) => q.markingScheme);
  if (!withScheme.length) return null;

  return (
    <CollapsiblePanel
      title={t("Marking Scheme")}
      icon={<Award className="w-4 h-4" />}
      contentClassName="pt-0 space-y-3"
    >
      {withScheme.map((q, i) => (
        <div key={i} className="text-sm border-b border-border last:border-0 pb-2 last:pb-0">
          <span className="font-medium">Q{q.number ?? q.questionNumber ?? i + 1}:</span>
          <p className="text-muted-foreground ml-4 whitespace-pre-line">{q.markingScheme}</p>
        </div>
      ))}
    </CollapsiblePanel>
  );
}
