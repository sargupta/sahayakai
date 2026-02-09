/**
 * Utility functions for grade/class level parsing and normalization
 */

/**
 * Extracts grade level from natural language topic.
 * Patterns: "class 4", "grade 5", "for 3rd graders", "Class 3 students", "to class 6"
 * 
 * @param topic - The topic string to parse
 * @returns The normalized grade string (e.g., "Class 5") or null if no grade found
 */
export function extractGradeFromTopic(topic: string): string | null {
    const patterns = [
        /class\s*(\d+)/i,
        /grade\s*(\d+)/i,
        /(\d+)(?:th|st|nd|rd)\s*grade/i,
        /for\s*(?:class\s*)?(\d+)\s*students/i,
        /(?:to|for)\s*class\s*(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = topic.match(pattern);
        if (match && match[1]) {
            return `Class ${match[1]}`;
        }
    }
    return null;
}
