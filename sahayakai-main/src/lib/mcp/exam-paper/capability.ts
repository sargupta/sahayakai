import 'server-only';
import type { McpCapabilityDefinition } from '../http-handler';
import { CreateExamPaperInput, ExamPaperResult } from './schema';
import { createExamPaper, renderExamPaperText, type ExamPaperServiceDeps } from './service';

/**
 * Sahayak Exam Paper Generator — public MCP capability #2.
 * Scope: `exam-paper`. One tool: `create_exam_paper`.
 */
export const EXAM_PAPER_VERSION = '1.0.0';

export const CREATE_EXAM_PAPER_DESCRIPTION =
    'Creates a complete, board-pattern exam paper for Indian schools (Class 1–12): general instructions, ' +
    'sections with numbered questions and marks, MCQ options, internal (OR) choices, and optional answer key ' +
    'and step-wise marking scheme. Follows the board blueprint where Sahayak has it (CBSE Class 9–10) and mixes ' +
    'previous-year-style and new questions. Use it for a test or exam paper (unit test, half-yearly, board ' +
    'practice) — not for a quick quiz or a lesson plan. Slow: usually 30–75 seconds; nothing is saved on Sahayak.';

export function examPaperCapability(deps: ExamPaperServiceDeps): McpCapabilityDefinition {
    return {
        scope: 'exam-paper',
        serverInfo: { name: 'sahayak-exam-paper', title: 'Sahayak Exam Paper Generator', version: EXAM_PAPER_VERSION },
        instructions:
            'Sahayak Exam Paper Generator creates board-pattern exam papers for Indian schools (Class 1–12, CBSE / ICSE / ' +
            'state boards, 11 languages). Call create_exam_paper once per paper; it returns the paper as structured data. ' +
            'Allow up to ~2 minutes per call.',
        register(server, ctx) {
            server.registerTool(
                'create_exam_paper',
                {
                    title: 'Create exam paper',
                    description: CREATE_EXAM_PAPER_DESCRIPTION,
                    inputSchema: CreateExamPaperInput,
                    outputSchema: ExamPaperResult,
                    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
                },
                async (args) => ctx.run(
                    'create_exam_paper',
                    ({ principal }) => createExamPaper(args as CreateExamPaperInput, principal, deps),
                    renderExamPaperText,
                ),
            );
        },
    };
}
