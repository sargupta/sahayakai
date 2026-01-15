"use client";

import { useLessonPlan } from "@/features/lesson-planner/hooks/use-lesson-plan";
import { LessonPlanView } from "@/features/lesson-planner/components/lesson-plan-view";

export default function LessonPlanAgentPage() {
  const state = useLessonPlan();

  return <LessonPlanView {...state} />;
}
