"use client";

import { Suspense } from "react";
import { useQuizGenerator } from "@/features/quiz-generator/hooks/use-quiz-generator";
import { QuizGeneratorView } from "@/features/quiz-generator/components/quiz-generator-view";

function QuizGeneratorContent() {
  const state = useQuizGenerator();
  return <QuizGeneratorView {...state} />;
}

// Next 15 prerender requires useSearchParams() to be wrapped in a Suspense
// boundary. Logic lives in @/features/quiz-generator (hook + view) — this
// page is a thin composition per docs/design/proposals/05-frontend-arch.md.
export default function QuizGeneratorPage() {
  return (
    <Suspense fallback={<div>{/* i18n-exempt: pre-context fallback */}Loading…</div>}>
      <QuizGeneratorContent />
    </Suspense>
  );
}
