"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRubricGenerator } from "@/features/rubric-generator/hooks/use-rubric-generator";
import { RubricGeneratorView } from "@/features/rubric-generator/components/rubric-generator-view";

function RubricGeneratorContent() {
  const state = useRubricGenerator();
  return <RubricGeneratorView {...state} />;
}

// Next 15 prerender requires useSearchParams() to be wrapped in a Suspense
// boundary. Logic lives in @/features/rubric-generator (hook + view) — this
// page is a thin composition per docs/design/proposals/05-frontend-arch.md.
export default function RubricGeneratorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <RubricGeneratorContent />
    </Suspense>
  );
}
