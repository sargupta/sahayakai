"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useWorksheetWizard } from "@/features/worksheet-wizard/hooks/use-worksheet-wizard";
import { WorksheetWizardView } from "@/features/worksheet-wizard/components/worksheet-wizard-view";

function WorksheetWizardContent() {
  const state = useWorksheetWizard();
  return <WorksheetWizardView {...state} />;
}

// Next 15 prerender requires useSearchParams() to be wrapped in a Suspense
// boundary. Logic lives in @/features/worksheet-wizard (hook + view) — this
// page is a thin composition per docs/design/proposals/05-frontend-arch.md.
export default function WorksheetWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <WorksheetWizardContent />
    </Suspense>
  );
}
