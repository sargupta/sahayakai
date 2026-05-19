"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AssessAssignmentClient from "./assess-client";

/**
 * /assess-assignment — entry page for the AI Assignment Assessor.
 *
 * Lazy-suspended at the client orchestrator so the route shell stays light
 * and the heavy camera + result components only load once the teacher hits
 * the page.
 */
export default function AssessAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AssessAssignmentClient />
    </Suspense>
  );
}
