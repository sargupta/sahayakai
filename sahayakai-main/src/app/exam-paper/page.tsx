/**
 * @fileOverview Board Exam Paper Generator page. Thin, dumb shell: the
 * `useExamPaper` hook is the brain (auth, form, blueprint, generate/save API);
 * this file only wires the view-model into presentational components. See
 * `hooks/use-exam-paper.ts` and `components/` in this directory.
 */
"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useExamPaper } from "./hooks/use-exam-paper";
import { ExamPaperLoading, ExamPaperLoginPrompt, ExamPaperLoadError, ExamPaperInProgress } from "./components/exam-paper-states";
import { ExamPaperHeader } from "./components/exam-paper-header";
import { ExamPaperForm } from "./components/exam-paper-form";
import { ExamPaperSkeleton } from "./components/exam-paper-skeleton";
import { ExamPaperPreview } from "./components/exam-paper-preview";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/language-context";

// Next 15 prerender requires useSearchParams() (read inside useExamPaper) to be
// wrapped in a Suspense boundary; otherwise the page falls back to client-side
// rendering at build time and errors out. Inner component holds the hook;
// default export wraps it.
export default function ExamPaperPage() {
  return (
    <Suspense fallback={null}>
      <ExamPaperPageInner />
    </Suspense>
  );
}

function ExamPaperPageInner() {
  const vm = useExamPaper();
  const { t } = useLanguage();

  if (vm.loading) return <ExamPaperLoading />;
  if (!vm.authed) return <ExamPaperLoginPrompt />;

  // View mode: a saved paper opened from My Library (`?id=`). The generate
  // form is irrelevant here — the teacher came to read/print the paper, not
  // configure a new one — so we hide it and show only the paper (or a load
  // error), plus a way back to generating a fresh one.
  if (vm.viewingSaved) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <ExamPaperHeader />
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/exam-paper">
              <Plus className="w-4 h-4 mr-1.5" />
              {t("Create a new paper")}
            </Link>
          </Button>
        </div>
        {vm.hydrating && <ExamPaperSkeleton />}
        {vm.paper && !vm.hydrating && <ExamPaperPreview {...vm} />}
        {!vm.paper && !vm.hydrating && vm.inProgress && <ExamPaperInProgress message={vm.inProgress} />}
        {!vm.paper && !vm.hydrating && !vm.inProgress && vm.error && <ExamPaperLoadError message={vm.error} />}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <ExamPaperHeader />
      <ExamPaperForm {...vm} />
      {vm.generating && <ExamPaperSkeleton />}
      {vm.paper && !vm.generating && <ExamPaperPreview {...vm} />}
    </div>
  );
}
