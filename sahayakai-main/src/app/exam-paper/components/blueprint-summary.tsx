/**
 * @fileOverview Renders the paper's blueprint summary — either a free-text
 * string or the structured chapter-wise / difficulty-wise breakdown. Dumb.
 */
"use client";

import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";

interface BlueprintSummaryProps {
  summary: NonNullable<GeneratedPaper["blueprintSummary"]>;
}

export function BlueprintSummary({ summary }: BlueprintSummaryProps) {
  const { t } = useLanguage();
  return (
    <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border border-border">
      <p className="font-medium mb-1">{t("Blueprint Summary")}</p>
      {typeof summary === 'string' ? (
        <p>{summary}</p>
      ) : (
        <div className="space-y-2">
          {summary.chapterWise?.length > 0 && (
            <div>
              <p className="font-medium text-foreground/70 mb-0.5">{t("Chapter-wise")}</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.chapterWise.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border">{c.chapter}: {c.marks}m</span>
                ))}
              </div>
            </div>
          )}
          {summary.difficultyWise?.length > 0 && (
            <div>
              <p className="font-medium text-foreground/70 mb-0.5">{t("Difficulty")}</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.difficultyWise.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border">{d.level}: {d.percentage}%</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
