"use client";

import { Suspense } from "react";
import { LessonPlanFormSkeleton } from "@/components/skeletons";
import { useMcpLessonPlan } from "@/features/mcp-demo/lesson-planner/use-mcp-lesson-plan";
import { McpLessonPlannerView } from "@/features/mcp-demo/lesson-planner/mcp-lesson-planner-view";

function McpLessonPlannerContent() {
    const state = useMcpLessonPlan();
    return <McpLessonPlannerView {...state} />;
}

/**
 * /mcp-demo/lesson-planner — the Sahayak Lesson Planner consumed through the
 * Sahayak MCP server (create_lesson_plan over Streamable HTTP) instead of the
 * app's own API. The existing /lesson-plan page is untouched.
 * Docs: docs/mcp/lesson-planner/DEMO_UI.md
 */
export default function McpLessonPlannerDemoPage() {
    return (
        <Suspense fallback={<LessonPlanFormSkeleton />}>
            <McpLessonPlannerContent />
        </Suspense>
    );
}
