"use client";

import { Suspense } from "react";
import { useExamPaper } from "@/features/exam-paper/hooks/use-exam-paper";
import { ExamPaperView } from "@/features/exam-paper/components/exam-paper-view";

function ExamPaperContent() {
  const state = useExamPaper();
  return <ExamPaperView {...state} />;
}

// Next 15 prerender requires useSearchParams() to be wrapped in a
// Suspense boundary; otherwise the page falls back to client-side
// rendering at build time and errors out. Logic lives in
// @/features/exam-paper (hook + form + preview components) — this page
// is a thin composition per docs/design/proposals/05-frontend-arch.md.
export default function ExamPaperPage() {
  return (
    <Suspense fallback={null}>
      <ExamPaperContent />
    </Suspense>
  );
}
