"use client";

import { Suspense } from "react";
import { useLessonPlan } from "@/features/lesson-planner/hooks/use-lesson-plan";
import { LessonPlanView } from "@/features/lesson-planner/components/lesson-plan-view";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function LessonPlanContent() {
  const router = useRouter(); // Added useRouter hook
  const searchParams = useSearchParams(); // Added useSearchParams hook
  const state = useLessonPlan();
  return <LessonPlanView {...state} />;
}

export default function LessonPlanAgentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <LessonPlanContent />
    </Suspense>
  );
}
