/**
 * @fileOverview Orchestrator hook for the exam-paper feature — the single
 * "brain" the page consumes. Composes the auth, form, and generation hooks,
 * wires the teacher's preferred board into the form, and exposes a zero-arg
 * `generate()` that feeds the current form values to the generation hook so
 * the presentational components stay dumb. The page types its view-model as
 * `ReturnType<typeof useExamPaper>`.
 */
"use client";

import { useCallback } from "react";
import { useExamPaperAuth } from "./use-exam-paper-auth";
import { useExamPaperForm } from "./use-exam-paper-form";
import { useExamPaperGeneration } from "./use-exam-paper-generation";

export function useExamPaper() {
  const { authed, loading, preferredBoard } = useExamPaperAuth();
  const form = useExamPaperForm(preferredBoard);
  const generation = useExamPaperGeneration();

  // Zero-arg generate: snapshot the current form values and hand them to the
  // generation hook. Keeps the component a pure `onClick={generate}`.
  const generate = useCallback(() => {
    return generation.handleGenerate({
      board: form.board,
      gradeLevel: form.gradeLevel,
      subject: form.subject,
      chapters: form.chapters,
      chaptersInput: form.chaptersInput,
      coverageMode: form.coverageMode,
      difficulty: form.difficulty,
      language: form.language,
      includeAnswerKey: form.includeAnswerKey,
      includeMarkingScheme: form.includeMarkingScheme,
      pyqRatio: form.pyqRatio,
      hasBlueprint: !!form.matchedBlueprint,
    });
  }, [
    generation,
    form.board, form.gradeLevel, form.subject, form.chapters, form.chaptersInput,
    form.coverageMode,
    form.difficulty, form.language, form.includeAnswerKey, form.includeMarkingScheme,
    form.pyqRatio,
    form.matchedBlueprint,
  ]);

  return {
    // Auth gate
    authed,
    loading,
    // Form state + derived data (board, setBoard, …, matchedBlueprint, etc.)
    ...form,
    // Generation state + network (generating, error, paper, saving, saved, canUseAI, …)
    ...generation,
    // Zero-arg generate wrapper (overrides the raw handleGenerate for the UI)
    generate,
  };
}

export type ExamPaperViewModel = ReturnType<typeof useExamPaper>;
