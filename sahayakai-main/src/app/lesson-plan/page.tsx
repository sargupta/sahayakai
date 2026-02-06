"use client";

import { useLessonPlan } from "@/features/lesson-planner/hooks/use-lesson-plan";
import { LessonPlanView } from "@/features/lesson-planner/components/lesson-plan-view";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // Added imports for useRouter and useSearchParams

export default function LessonPlanPage() { // Renamed LessonPlanAgentPage to LessonPlanPage
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LessonPlanContent />
    </Suspense>
  );
}

function LessonPlanContent() {
  const router = useRouter(); // Added useRouter hook
  const searchParams = useSearchParams(); // Added useSearchParams hook
  const state = useLessonPlan();
  return <LessonPlanView {...state} />;
}
