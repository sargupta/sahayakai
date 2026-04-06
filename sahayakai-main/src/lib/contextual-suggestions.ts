import type { ContentType } from '@/types';
import { getChaptersForGrade, type NCERTChapter } from '@/data/ncert/index';
import { quickTemplates } from '@/data/quick-templates';
import { parseGradeNumber } from '@/lib/profile-utils';

export interface ProfileSlice {
    subjects: string[];
    gradeLevels: string[];
    educationBoard?: string;
}

export interface ContextualSuggestion {
    id: string;
    topic: string;
    toolType: ContentType;
    toolLabel: string;
    toolHref: string;
    subject: string;
    gradeLevel: string;
    chapterId?: string;
}

/** Maps UserProfile subject names to NCERT subject names */
const SUBJECT_TO_NCERT: Record<string, string> = {
    'Mathematics': 'Mathematics',
    'Science': 'Science',
    'Social Science': 'Social Studies',
    'History': 'Social Studies',
    'Geography': 'Social Studies',
    'Civics': 'Social Studies',
    'English': 'English',
    'Hindi': 'Hindi',
    'Sanskrit': 'Sanskrit',
    'Kannada': 'Kannada',
    'Computer Science': 'Information Technology',
    'Environmental Studies (EVS)': 'EVS',
    'General': 'Science',
};

const TOOL_ROTATION: { type: ContentType; label: string; href: string }[] = [
    { type: 'lesson-plan', label: 'Lesson Plan', href: '/lesson-plan' },
    { type: 'quiz', label: 'Quiz', href: '/quiz-generator' },
    { type: 'visual-aid', label: 'Visual Aid', href: '/visual-aid-designer' },
];

function chapterToSuggestion(
    ch: NCERTChapter,
    tool: (typeof TOOL_ROTATION)[number],
    gradeLabel: string
): ContextualSuggestion {
    return {
        id: `${ch.id}-${tool.type}`,
        topic: ch.title,
        toolType: tool.type,
        toolLabel: tool.label,
        toolHref: `${tool.href}?topic=${encodeURIComponent(ch.title)}&grade=${encodeURIComponent(gradeLabel)}&subject=${encodeURIComponent(ch.subject)}`,
        subject: ch.subject,
        gradeLevel: gradeLabel,
        chapterId: ch.id,
    };
}

/**
 * Return personalized suggestions by pulling chapters from the teacher's
 * NCERT curriculum data. Falls back to quick templates when NCERT data
 * is unavailable for the given subject/grade combination.
 */
export function getPersonalizedSuggestions(
    profile: ProfileSlice,
    count: number = 3,
    excludeChapterIds: string[] = []
): ContextualSuggestion[] {
    const results: ContextualSuggestion[] = [];
    const usedChapterIds = new Set(excludeChapterIds);

    // Collect all grade numbers the teacher teaches
    const gradeNumbers = profile.gradeLevels
        .map(parseGradeNumber)
        .filter((n): n is number => n !== undefined);

    // Round-robin across subjects for variety
    let toolIdx = 0;

    for (const subject of profile.subjects) {
        if (results.length >= count) break;

        const ncertSubject = SUBJECT_TO_NCERT[subject];
        if (!ncertSubject) continue;

        for (const gradeNum of gradeNumbers) {
            if (results.length >= count) break;

            const chapters = getChaptersForGrade(gradeNum, ncertSubject);
            const available = chapters.filter(c => !usedChapterIds.has(c.id));
            if (available.length === 0) continue;

            // Pick a pseudo-random chapter (varies by day)
            const dayOffset = new Date().getDate();
            const ch = available[dayOffset % available.length];
            usedChapterIds.add(ch.id);

            const tool = TOOL_ROTATION[toolIdx % TOOL_ROTATION.length];
            toolIdx++;

            const gradeLabel = profile.gradeLevels.find(g => parseGradeNumber(g) === gradeNum) || `Class ${gradeNum}`;
            results.push(chapterToSuggestion(ch, tool, gradeLabel));
        }
    }

    // Fallback to quick templates if we didn't fill enough
    if (results.length < count) {
        const remaining = count - results.length;
        const fallbacks = quickTemplates.slice(0, remaining);
        for (const qt of fallbacks) {
            const tool = TOOL_ROTATION[toolIdx % TOOL_ROTATION.length];
            toolIdx++;
            results.push({
                id: qt.id,
                topic: qt.topic,
                toolType: tool.type,
                toolLabel: tool.label,
                toolHref: `${tool.href}?topic=${encodeURIComponent(qt.topic)}`,
                subject: qt.subject,
                gradeLevel: qt.gradeLevel,
            });
        }
    }

    return results.slice(0, count);
}

/**
 * Pick a single topic to use for the onboarding "aha moment" example.
 */
export function getOnboardingExampleTopic(
    profile: ProfileSlice
): { topic: string; subject: string; gradeLevel: string } | null {
    const suggestions = getPersonalizedSuggestions(profile, 1);
    if (suggestions.length === 0) return null;
    return {
        topic: suggestions[0].topic,
        subject: suggestions[0].subject,
        gradeLevel: suggestions[0].gradeLevel,
    };
}
