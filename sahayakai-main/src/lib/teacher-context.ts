/**
 * Teacher Context Enrichment
 *
 * Provides career-stage-aware context strings that AI flows can inject
 * into their system prompts. This makes AI responses more relevant
 * to experienced vs. early-career teachers.
 */

import { dbAdapter } from '@/lib/db/adapter';
import { getCareerStage, type TeacherCareerStage } from '@/types';

export interface TeacherContext {
    careerStage: TeacherCareerStage;
    yearsOfExperience: number;
    administrativeRole: string;
    contextPrompt: string;
}

const STAGE_PROMPTS: Record<TeacherCareerStage, string> = {
    early: `This teacher is in the early stage of their career (0-3 years). They benefit from:
- Detailed explanations and step-by-step guidance
- Classroom management tips alongside content
- Encouragement and scaffolded approaches
- References to NCERT guidelines and pedagogy basics`,

    mid: `This teacher is in the consolidation stage (4-7 years). They benefit from:
- Practical, ready-to-use content with minimal explanation
- Differentiation strategies for mixed-ability classrooms
- Assessment-focused suggestions
- Efficiency tips to save preparation time`,

    senior: `This teacher is a senior educator (8-15 years). They:
- Already know their subject deeply — do NOT over-explain basics
- Want concise, actionable output — no pedagogical hand-holding
- Value board-pattern accuracy and assessment quality
- Need help with administrative tasks (report cards, papers, data) more than content creation
- Appreciate when AI respects their expertise`,

    leadership: `This teacher is in a leadership role (16+ years). They:
- May be a Head of Department, coordinator, or senior administrator
- Need institutional-level outputs (department reports, exam paper moderation, curriculum mapping)
- Want executive-style summaries, not detailed explanations
- Value data-driven insights over content generation
- Are evaluating this tool for their entire department or school`,
};

/**
 * Fetch teacher context for AI prompt enrichment.
 * Returns null if user not found or no experience data available.
 */
export async function getTeacherContext(userId: string): Promise<TeacherContext | null> {
    try {
        const profile = await dbAdapter.getUser(userId);
        if (!profile?.yearsOfExperience) return null;

        const stage = getCareerStage(profile.yearsOfExperience);

        return {
            careerStage: stage,
            yearsOfExperience: profile.yearsOfExperience,
            administrativeRole: profile.administrativeRole || 'none',
            contextPrompt: STAGE_PROMPTS[stage],
        };
    } catch {
        return null;
    }
}

/**
 * Get a one-line context injection for AI prompts.
 * Safe to call even if no profile data exists (returns empty string).
 */
export async function getTeacherContextLine(userId: string): Promise<string> {
    const ctx = await getTeacherContext(userId);
    if (!ctx) return '';

    const roleLabel = ctx.administrativeRole !== 'none'
        ? ` and serves as ${ctx.administrativeRole.replace('_', ' ')}`
        : '';

    return `\n\nTeacher Profile Context: This teacher has ${ctx.yearsOfExperience} years of experience${roleLabel}. ${ctx.contextPrompt}\n`;
}
