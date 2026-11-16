/**
 * @fileOverview The generated paper as a typeset examination document — what
 * the teacher will print, previewed on a sheet of paper rather than as a stack
 * of dashboard cards. Board-paper conventions: centred masthead, a time/marks
 * bar between rules, numbered general instructions, centred section headings
 * with their marks, a hanging question number, a right-aligned marks column,
 * "OR" for internal choice, and the answer key / marking scheme each starting
 * on a new page (shown here as a labelled seam).
 *
 * Questions stay read-only. In edit mode each question shows a Regenerate
 * button (the existing per-question LLM regenerate); marks never change, so
 * the sum === maxMarks invariant holds. Dumb: paper + callbacks as props.
 */
"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { GeneratedPaper, GeneratedQuestion } from "../types";

interface ExamPaperDocumentProps {
  paper: GeneratedPaper;
  includeAnswerKey: boolean;
  includeMarkingScheme: boolean;
  isEditing?: boolean;
  onRegenerateQuestion?: (si: number, qi: number) => void;
  /** `"si-qi"` of the question mid-regeneration, or null. */
  regeneratingKey?: string | null;
}

// Options sometimes arrive already labelled by the model ("a) …", "(a) …",
// "a. …", doubled "a) a) …"). Strip the label so the canonical "(x)" below
// doesn't double up. Mirrors the flow's stampObjectiveKeys strip regex
// (exam-paper-generator.ts).
export function stripOptionLabel(opt: string): string {
  return opt.replace(/^(?:\s*(?:\([a-dA-D]\)|[a-dA-D][.)]))+\s*/, "");
}

const qNumber = (q: GeneratedQuestion, fallback: number) => q.number ?? q.questionNumber ?? fallback;

export const sectionAnchor = (si: number) => `paper-section-${si + 1}`;

function PageSeam({ label }: { label: string }) {
  return (
    <div className="paper-break relative my-12 no-print" aria-hidden="true">
      <span className="paper-break-label paper-ui absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function ExamPaperDocument({
  paper,
  includeAnswerKey,
  includeMarkingScheme,
  isEditing = false,
  onRegenerateQuestion,
  regeneratingKey,
}: ExamPaperDocumentProps) {
  const { t } = useLanguage();
  const allQs = paper.sections?.flatMap((s) => s.questions ?? []) ?? [];
  const withAnswers = includeAnswerKey ? allQs.filter((q) => q.answerKey || q.answer) : [];
  const withScheme = includeMarkingScheme ? allQs.filter((q) => q.markingScheme) : [];
  const duration = typeof paper.duration === "number" ? `${paper.duration} ${t("min")}` : paper.duration;
  const heading = paper.title || `${t(paper.board)} ${t(paper.gradeLevel)} ${t(paper.subject)}`;

  return (
    <article
      className="paper-sheet mx-auto w-full max-w-paper rounded-xs px-5 py-8 shadow-float ring-1 ring-border sm:px-12 sm:py-14 indic-text"
      aria-label={heading}
    >
      {/* Masthead */}
      <header className="text-center">
        <div className="paper-ui flex items-center justify-end gap-2 text-xs paper-muted">
          <span>{t("Roll No.")}</span>
          <span className="flex" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-6 w-5 border border-r-0 paper-rule last:border-r" />
            ))}
          </span>
        </div>
        {paper.board && <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em]">{t(paper.board)}</p>}
        <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{heading}</h2>
        <p className="mt-1 text-base italic paper-muted">
          {[t(paper.gradeLevel), t(paper.subject)].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-y-2 border-double paper-rule py-2 text-sm font-semibold sm:text-base">
        <span className="whitespace-nowrap">
          {t("Time allowed")}: {duration}
        </span>
        <span className="whitespace-nowrap">
          {t("Maximum Marks:")} {paper.maxMarks}
        </span>
      </div>

      {paper.generalInstructions?.length > 0 && (
        <section className="mt-6">
          <h3 className="paper-ui text-xs font-semibold uppercase tracking-[0.16em] paper-muted">{t("General Instructions")}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm leading-relaxed sm:text-base">
            {paper.generalInstructions.map((inst, i) => (
              <li key={i}>{inst}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Sections */}
      {paper.sections?.map((section, si) => (
        <section key={si} id={sectionAnchor(si)} className="mt-10 scroll-mt-24">
          <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-[0.18em]">{section.name || section.label}</h3>
            <p className="mt-1 text-sm paper-muted">
              {section.name && section.label ? <span className="italic">{section.label}</span> : null}
              {section.name && section.label && section.totalMarks != null ? " · " : null}
              {section.totalMarks != null ? `${section.totalMarks} ${t("marks")}` : null}
            </p>
            {section.instructions && <p className="mx-auto mt-2 max-w-xl text-sm italic paper-muted">{section.instructions}</p>}
          </div>

          <ol className="mt-5 space-y-5">
            {section.questions?.map((q, qi) => {
              const busy = regeneratingKey === `${si}-${qi}`;
              const isPyq = /^pyq/i.test(q.source ?? "");
              return (
                <li key={qi} className={cn("paper-question grid grid-cols-[2.25rem_1fr_auto] gap-x-2", busy && "opacity-60")}>
                  <span className="font-bold tabular-nums">{qNumber(q, qi + 1)}.</span>
                  <div className="min-w-0">
                    <p className="whitespace-pre-line leading-relaxed">{q.text}</p>
                    {q.options && q.options.length > 0 && (
                      <ol className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                        {q.options.map((opt, oi) => (
                          <li key={oi} className="flex gap-2">
                            <span className="shrink-0">({String.fromCharCode(97 + oi)})</span>
                            <span>{stripOptionLabel(opt)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {q.internalChoice && (
                      <>
                        <p className="my-2 text-center text-sm font-bold tracking-[0.2em]">{t("OR")}</p>
                        <p className="whitespace-pre-line leading-relaxed">{q.internalChoice}</p>
                      </>
                    )}
                    {/* Teacher-only: where the question came from, and the regenerate control. */}
                    <div className="paper-ui no-print mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("rounded-xs px-1.5 py-0.5", isPyq ? "bg-tint-info text-info" : "bg-tint-quiet")}>
                        {isPyq ? q.source : t("New")}
                      </span>
                      {isEditing && onRegenerateQuestion && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!!regeneratingKey}
                          onClick={() => onRegenerateQuestion(si, qi)}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">{busy ? t("Regenerating…") : t("Regenerate")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <span className="text-right font-semibold tabular-nums" aria-label={`${q.marks} ${t("marks")}`}>
                    [{q.marks}]
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <p className="mt-12 text-center text-xs uppercase tracking-[0.3em] paper-muted">✦ {t("End of question paper")} ✦</p>

      {withAnswers.length > 0 && (
        <>
          <PageSeam label={t("New page · Answer Key")} />
          <section aria-label={t("Answer Key")}>
            <h3 className="text-center text-lg font-bold uppercase tracking-[0.18em]">{t("Answer Key")}</h3>
            <p className="mt-1 text-center text-sm italic paper-muted">{heading}</p>
            <dl className="mt-6 grid grid-cols-[2.75rem_1fr] gap-x-2 gap-y-2 text-sm leading-relaxed sm:text-base">
              {withAnswers.map((q, i) => (
                <div key={i} className="contents">
                  <dt className="font-bold tabular-nums">{qNumber(q, i + 1)}.</dt>
                  <dd className="whitespace-pre-line">{q.answerKey ?? q.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      {withScheme.length > 0 && (
        <>
          <PageSeam label={t("New page · Marking Scheme")} />
          <section aria-label={t("Marking Scheme")}>
            <h3 className="text-center text-lg font-bold uppercase tracking-[0.18em]">{t("Marking Scheme")}</h3>
            <p className="mt-1 text-center text-sm italic paper-muted">{heading}</p>
            <dl className="mt-6 space-y-3 text-sm leading-relaxed sm:text-base">
              {withScheme.map((q, i) => (
                <div key={i} className="paper-question grid grid-cols-[2.75rem_1fr_auto] gap-x-2 border-b paper-rule pb-3 last:border-0">
                  <dt className="font-bold tabular-nums">{qNumber(q, i + 1)}.</dt>
                  <dd className="whitespace-pre-line">{q.markingScheme}</dd>
                  <span className="font-semibold tabular-nums">[{q.marks}]</span>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </article>
  );
}
