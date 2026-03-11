/**
 * Enhanced validation helper for WorksheetWizardOutputSchema
 */

export function validateWorksheetOutput(rawOutput: any): { valid: boolean; errors: string[]; data?: any } {
    const errors: string[] = [];

    if (!rawOutput.title) errors.push('Missing "title"');
    if (!rawOutput.activities || !Array.isArray(rawOutput.activities) || rawOutput.activities.length === 0) {
        errors.push('Missing or empty "activities" array');
    } else {
        rawOutput.activities.forEach((activity: any, idx: number) => {
            if (!activity.content) errors.push(`Activity ${idx + 1}: Missing "content"`);
            if (!activity.explanation) {
                errors.push(`Activity ${idx + 1}: Missing "explanation"`);
            } else {
                if (activity.explanation.length < 20) {
                    errors.push(`Activity ${idx + 1}: Explanation is too brief`);
                }

                // Bharat-First check
                const westernisms = ['dollar', 'elevator', 'subway', 'snowing', 'pancake', 'skate', 'burger'];
                const found = westernisms.filter(w =>
                    activity.explanation.toLowerCase().includes(w) ||
                    activity.content.toLowerCase().includes(w)
                );
                if (found.length > 0) {
                    errors.push(`Activity ${idx + 1}: Contains non-Bharat westernisms: ${found.join(', ')}`);
                }
            }
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [], data: rawOutput };
}

export function sanitizeWorksheetOutput(rawOutput: any): any {
    const sanitized = { ...rawOutput };

    if (Array.isArray(sanitized.activities)) {
        sanitized.activities = sanitized.activities.map((a: any) => ({
            ...a,
            type: ['question', 'puzzle', 'creative_task'].includes(String(a.type).toLowerCase())
                ? String(a.type).toLowerCase()
                : 'question'
        }));
    }

    return sanitized;
}
