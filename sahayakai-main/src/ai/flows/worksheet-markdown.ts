/**
 * Canonical Markdown renderer for a generated worksheet.
 *
 * `worksheetContent` is the only field the worksheet UI actually renders
 * (`worksheet-display.tsx` returns null without it) and the only field
 * `WorksheetDataSchema` requires on a persisted worksheet — the structured
 * fields are metadata wrapped around it. It used to be assembled by a
 * template literal buried inside the Genkit flow, so every other path that
 * produced a worksheet produced one with no body. Both paths render here now.
 *
 * The output is byte-identical to the template this replaced; downstream
 * consumers (the Markdown download, the Storage `.md` artefact, the PDF
 * logic) see no change.
 */

/**
 * The structural minimum needed to render. Deliberately not
 * `WorksheetWizardOutput` — the sidecar wire type (`WorksheetResponse` in
 * `types.generated.ts`) is a separate declaration with the same shape, and
 * both must be renderable without importing Genkit into the dispatcher.
 */
export interface WorksheetMarkdownSource {
    title: string;
    gradeLevel: string;
    subject: string;
    learningObjectives: string[];
    studentInstructions: string;
    activities: Array<{ content: string; explanation: string }>;
    answerKey: Array<{ activityIndex: number; answer: string }>;
}

export function renderWorksheetMarkdown(source: WorksheetMarkdownSource): string {
    const objectives = (source.learningObjectives ?? []).map((o) => `- ${o}`).join('\n');
    const activities = (source.activities ?? [])
        .map((a, i) => `### Activity ${i + 1}\n${a.content}\n\n*${a.explanation}*`)
        .join('\n\n');
    const answerKey = (source.answerKey ?? [])
        .map((ak) => `**Activity ${ak.activityIndex + 1}**: ${ak.answer}`)
        .join('\n');

    return `# ${source.title}\n\n**Class**: ${source.gradeLevel} | **Subject**: ${source.subject}\n\n## I. Learning Objectives\n${objectives}\n\n## II. Student Instructions\n${source.studentInstructions}\n\n---\n\n## III. Activities\n${activities}\n\n---\n\n## IV. Answer Key\n${answerKey}`;
}
