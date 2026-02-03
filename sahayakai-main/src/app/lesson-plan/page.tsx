"use client";

import { useLessonPlan } from "@/features/lesson-planner/hooks/use-lesson-plan";
import { LessonPlanView } from "@/features/lesson-planner/components/lesson-plan-view";

import { Suspense } from "react";

export default function LessonPlanAgentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LessonPlanContent />
    </Suspense>
  );
}

function LessonPlanContent() {
  const state = useLessonPlan();
  return <LessonPlanView {...state} />;
}
