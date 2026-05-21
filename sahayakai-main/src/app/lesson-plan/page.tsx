"use client";

import { Suspense } from "react";
import { useLessonPlan } from "@/features/lesson-planner/hooks/use-lesson-plan";
import { LessonPlanView } from "@/features/lesson-planner/components/lesson-plan-view";
import { LessonPlanFormSkeleton } from "@/components/skeletons";

function LessonPlanContent() {
  const state = useLessonPlan();
  return <LessonPlanView {...state} />;
}

/**
 * /lesson-plan — flagship feature page.
 *
 * NCERT demo polish (2026-05-19): the original Suspense fallback was a
 * single centered spinner. On the demo path this is the first thing the
 * audience sees, so the fallback now renders a shape-matched skeleton
 * (form on top, generate button on the right) so the layout doesn't
 * jump when the real form hydrates.
 *
 * The 20–30s in-flight loading state (after the teacher submits) is
 * handled inside <LessonPlanView /> via <LessonPlanLoadingOverlay />.
 */
export default function LessonPlanAgentPage() {
  return (
    <Suspense fallback={<LessonPlanFormSkeleton />}>
      <LessonPlanContent />
    </Suspense>
  );
}
