"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useInstantAnswer } from "@/features/instant-answer/hooks/use-instant-answer";
import { InstantAnswerView } from "@/features/instant-answer/components/instant-answer-view";

function InstantAnswerContent() {
  const state = useInstantAnswer();
  return <InstantAnswerView {...state} />;
}

// Next 15 prerender requires useSearchParams() to be wrapped in a Suspense
// boundary. Logic lives in @/features/instant-answer (hook + view) — this
// page is a thin composition per docs/design/proposals/05-frontend-arch.md.
export default function InstantAnswerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <InstantAnswerContent />
    </Suspense>
  );
}
