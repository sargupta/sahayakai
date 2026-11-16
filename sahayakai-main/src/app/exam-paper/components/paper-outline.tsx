/**
 * @fileOverview The paper at a glance, beside the typeset paper: duration,
 * questions and marks; whether the question marks add up to the paper's
 * maximum (computed from the questions, not trusted from the header); one row
 * per section with its share of the marks and a jump link; and the flow's
 * blueprint summary (chapter-wise marks, difficulty mix). Dumb.
 */
"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { GeneratedPaper } from "../types";
import { sectionAnchor } from "./exam-paper-document";
import { PaperShareCta } from "./paper-actions";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-headline text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function PaperOutline({ paper, className }: { paper: GeneratedPaper; className?: string }) {
  const { t } = useLanguage();
  const sections = paper.sections ?? [];
  const questionCount = sections.reduce((n, s) => n + (s.questions?.length ?? 0), 0);
  const marksSum = sections.reduce((n, s) => n + (s.questions ?? []).reduce((m, q) => m + (Number(q.marks) || 0), 0), 0);
  const addsUp = marksSum === Number(paper.maxMarks);
  const duration = typeof paper.duration === "number" ? `${paper.duration} ${t("min")}` : paper.duration;
  const summary = paper.blueprintSummary;
  const maxChapter = summary && typeof summary !== "string" ? Math.max(1, ...(summary.chapterWise ?? []).map((c) => c.marks)) : 1;

  return (
    <aside className={cn("space-y-4", className)} aria-label={t("Paper outline")}>
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <p className="type-eyebrow text-muted-foreground">{t("Paper outline")}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label={t("Time")} value={duration} />
          <Stat label={t("Questions")} value={questionCount} />
          <Stat label={t("Marks")} value={paper.maxMarks} />
        </div>

        <p
          className={cn(
            "mt-4 flex items-start gap-2 rounded-row px-3 py-2 text-sm",
            addsUp ? "bg-tint-success text-success" : "bg-tint-warning text-warning",
          )}
        >
          {addsUp ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {addsUp
            ? t("Question marks add up to {total}.").replace("{total}", String(paper.maxMarks))
            : t("Question marks add up to {sum}, not {total}.")
                .replace("{sum}", String(marksSum))
                .replace("{total}", String(paper.maxMarks))}
        </p>

        {sections.length > 0 && (
          <ol className="mt-4 space-y-1">
            {sections.map((s, si) => {
              const share = paper.maxMarks ? Math.min(100, Math.round(((s.totalMarks ?? 0) / Number(paper.maxMarks)) * 100)) : 0;
              return (
                <li key={si}>
                  <a
                    href={`#${sectionAnchor(si)}`}
                    className="focus-ring group block rounded-row px-3 py-2 transition-colors duration-micro hover:bg-muted"
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-foreground">{s.name || s.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">{s.totalMarks}</span> {t("marks")}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[s.name && s.label ? s.label : null, `${s.questions?.length ?? 0} ${t("Questions")}`].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-pill bg-muted" aria-hidden="true">
                      <span className="block h-full rounded-pill bg-primary/70" style={{ width: `${share}%` }} />
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {summary && (
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <p className="type-eyebrow text-muted-foreground">{t("Blueprint Summary")}</p>
          {typeof summary === "string" ? (
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          ) : (
            <div className="mt-3 space-y-4">
              {summary.chapterWise?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Chapter-wise")}</p>
                  <ul className="mt-2 space-y-2">
                    {summary.chapterWise.map((c, i) => (
                      <li key={i} className="text-sm">
                        <span className="flex justify-between gap-3">
                          <span className="min-w-0 truncate text-muted-foreground">{c.chapter}</span>
                          <span className="shrink-0 tabular-nums text-foreground">{c.marks}</span>
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-pill bg-muted" aria-hidden="true">
                          <span className="block h-full rounded-pill bg-chart-2" style={{ width: `${(c.marks / maxChapter) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.difficultyWise?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Difficulty")}</p>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-pill bg-muted" aria-hidden="true">
                    {summary.difficultyWise.map((d, i) => (
                      <span
                        key={i}
                        className={cn("h-full", ["bg-leaf-500", "bg-chart-4", "bg-destructive/70", "bg-chart-5"][i % 4])}
                        style={{ width: `${d.percentage}%` }}
                      />
                    ))}
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {summary.difficultyWise.map((d, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-pill", ["bg-leaf-500", "bg-chart-4", "bg-destructive/70", "bg-chart-5"][i % 4])} aria-hidden="true" />
                        <span className="capitalize">{d.level}</span>
                        <span className="tabular-nums text-foreground">{d.percentage}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PaperShareCta />
    </aside>
  );
}
