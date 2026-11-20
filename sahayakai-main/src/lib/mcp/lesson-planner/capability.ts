import 'server-only';
import type { McpCapabilityDefinition } from '../http-handler';
import { CreateLessonPlanInput, LessonPlanResult } from './schema';
import { renderLessonPlanText, toDispatchInput, toLessonPlanResult, type LessonPlanDispatcher } from './service';

/**
 * Sahayak Lesson Planner — public MCP capability #1.
 * Scope: `lesson-planner`. One tool: `create_lesson_plan`.
 */
export const LESSON_PLANNER_VERSION = '1.0.0';

export const CREATE_LESSON_PLAN_DESCRIPTION =
    'Creates a classroom-ready lesson plan for one topic and one grade (Class 1–12), designed for Indian ' +
    'classrooms: measurable learning objectives, key vocabulary, materials, a timed 5E teaching sequence ' +
    '(Engage, Explore, Explain, Elaborate, Evaluate) with teacher tips and understanding checks, an ' +
    'assessment and homework. Adapts to the classroom\'s resources, difficulty level and language (11 Indian ' +
    'languages), and can align to an NCERT chapter. Use it when a teacher needs a structured plan to teach ' +
    'from — not for a quick explanation, a quiz or a worksheet. Takes roughly 10–40 seconds. Nothing is ' +
    'saved on Sahayak; the plan is returned to you.';

export function lessonPlannerCapability(dispatch: LessonPlanDispatcher): McpCapabilityDefinition {
    return {
        scope: 'lesson-planner',
        serverInfo: { name: 'sahayak-lesson-planner', title: 'Sahayak Lesson Planner', version: LESSON_PLANNER_VERSION },
        instructions:
            'Sahayak Lesson Planner generates structured, classroom-ready lesson plans for Indian schools (Class 1–12, ' +
            '11 languages). Call create_lesson_plan once per topic and grade; it returns the plan as structured data.',
        register(server, ctx) {
            server.registerTool(
                'create_lesson_plan',
                {
                    title: 'Create lesson plan',
                    description: CREATE_LESSON_PLAN_DESCRIPTION,
                    inputSchema: CreateLessonPlanInput,
                    outputSchema: LessonPlanResult,
                    annotations: {
                        readOnlyHint: true,      // writes nothing on Sahayak
                        destructiveHint: false,
                        idempotentHint: false,   // AI generation: each call may differ
                        openWorldHint: false,
                    },
                },
                async (args) => ctx.run(
                    'create_lesson_plan',
                    async () => {
                        const input = args as CreateLessonPlanInput;
                        const plan = await dispatch(toDispatchInput(input));
                        return toLessonPlanResult(plan, input);
                    },
                    renderLessonPlanText,
                ),
            );
        },
    };
}
