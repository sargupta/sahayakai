import { z } from "zod";
import type { NCERTChapter } from "@/data/ncert";
import type { ResourceLevel } from "@/components/resource-selector";
import type { DifficultyLevel } from "@/components/difficulty-selector";
import { LESSON_PLAN_LANGUAGES, type CreateLessonPlanInput, type LessonPlanResult } from "@/lib/mcp/lesson-planner/schema";

/**
 * Form state of the MCP demo page and its mapping onto the PUBLIC MCP tool
 * arguments of `create_lesson_plan`. Only fields the MCP schema supports are
 * collected (no image upload, no multi-grade).
 */

export type McpLanguage = (typeof LESSON_PLAN_LANGUAGES)[number];
export const MCP_LANGUAGES: readonly McpLanguage[] = LESSON_PLAN_LANGUAGES;

export const mcpDemoFormSchema = z.object({
    topic: z.string().trim().min(3, { message: "Topic must be at least 3 characters." }).max(200),
    gradeLevels: z.array(z.string()).refine((g) => gradeFromLabel(g[0]) !== null, { message: "Please select a class." }),
    subject: z.string().optional(),
    language: z.enum(LESSON_PLAN_LANGUAGES),
});
export type McpDemoFormValues = z.infer<typeof mcpDemoFormSchema>;

export interface McpDemoOptions {
    resourceLevel: ResourceLevel;
    difficultyLevel: DifficultyLevel;
    useLocalContext: boolean;
    chapter: Pick<NCERTChapter, "number" | "title" | "learningOutcomes"> | null;
}

/** "Class 7" → 7 (the app's grade selector values). */
export function gradeFromLabel(label: string | undefined): number | null {
    const m = /(\d{1,2})/.exec(label ?? "");
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/** Build the exact `create_lesson_plan` arguments sent over MCP. */
export function toMcpArguments(values: McpDemoFormValues, options: McpDemoOptions): CreateLessonPlanInput {
    const grade = gradeFromLabel(values.gradeLevels[0]);
    if (grade === null) throw new Error("Please select a class.");
    const subject = values.subject && values.subject !== "General" ? values.subject : undefined;
    return {
        topic: values.topic.trim(),
        grade,
        ...(subject ? { subject } : {}),
        language: values.language,
        classroom_resources: options.resourceLevel,
        difficulty: options.difficultyLevel,
        use_local_context: options.useLocalContext,
        ...(options.chapter
            ? {
                ncert_chapter: {
                    number: options.chapter.number,
                    title: options.chapter.title,
                    learning_outcomes: (options.chapter.learningOutcomes ?? []).slice(0, 10),
                },
            }
            : {}),
    };
}

/** URL prefill (same idea as the app page's ?topic=&grade= params): never auto-submits. */
export function prefillFromSearchParams(params: URLSearchParams): Partial<McpDemoFormValues> & { difficulty?: DifficultyLevel } {
    const out: Partial<McpDemoFormValues> & { difficulty?: DifficultyLevel } = {};
    const topic = params.get("topic")?.trim();
    if (topic) out.topic = topic.slice(0, 200);
    const grade = gradeFromLabel(params.get("grade") ?? undefined);
    if (grade) out.gradeLevels = [`Class ${grade}`];
    const subject = params.get("subject")?.trim();
    if (subject) out.subject = subject;
    const language = MCP_LANGUAGES.find((l) => l.toLowerCase() === params.get("language")?.trim().toLowerCase());
    if (language) out.language = language;
    const difficulty = params.get("difficulty")?.trim().toLowerCase();
    const aliases: Record<string, DifficultyLevel> = { easy: "remedial", remedial: "remedial", medium: "standard", standard: "standard", hard: "advanced", advanced: "advanced" };
    if (difficulty && aliases[difficulty]) out.difficulty = aliases[difficulty];
    return out;
}

/** Plain-text rendering used by the Copy action. */
export function lessonPlanToText(plan: LessonPlanResult): string {
    const lines = [`${plan.title}`, `Class ${plan.grade}${plan.subject ? ` · ${plan.subject}` : ""}${plan.duration ? ` · ${plan.duration}` : ""}`, ""];
    const list = (heading: string, items: string[]) => { if (items.length) lines.push(heading, ...items.map((i) => `- ${i}`), ""); };
    list("Learning objectives", plan.learning_objectives);
    list("Key vocabulary", plan.key_vocabulary.map((v) => `${v.term}: ${v.meaning}`));
    list("Materials", plan.materials);
    if (plan.activities.length) {
        lines.push("Teaching sequence (5E)");
        for (const a of plan.activities) {
            lines.push(`${a.phase} — ${a.name} (${a.duration})`, a.description);
            if (a.teacher_tips) lines.push(`Teacher tip: ${a.teacher_tips}`);
            if (a.understanding_check) lines.push(`Check: ${a.understanding_check}`);
            lines.push("");
        }
    }
    if (plan.assessment) lines.push("Assessment", plan.assessment, "");
    if (plan.homework) lines.push("Homework", plan.homework, "");
    if (plan.curriculum_note) lines.push(`Note: ${plan.curriculum_note}`);
    return lines.join("\n").trim();
}
