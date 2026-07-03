/**
 * Labs park — tranche 2 of docs/EXECUTION_PLAN_2026-07.md.
 *
 * The product spine is the lesson-prep loop (lesson-plan → worksheet →
 * quiz/exam/rubric → export/share) plus instant-answer. Everything else
 * generator-shaped is parked here: hidden from primary nav, still fully
 * routable, listed on /labs, and flagged with a LabsBanner on the page.
 *
 * Un-parking a tool = remove its entry from LABS_TOOLS. No other change.
 *
 * Deliberately NOT wired to the Firestore feature-flag doc: nav must render
 * deterministically before any Firestore read, and parking is a product
 * decision that should ship through review, not a runtime toggle.
 */

export type LabsTool = {
    /** Route prefix — matched with startsWith, so subroutes inherit. */
    href: string;
    /** i18n dictionary key for the tool name (existing keys reused). */
    titleKey: string;
    /** i18n dictionary key for the one-line description on /labs. */
    descriptionKey: string;
    /** lucide-react icon name, resolved by the consuming component. */
    icon: 'Video' | 'Globe2' | 'GraduationCap' | 'ScanLine' | 'ScanEye' | 'BookOpen' | 'Images' | 'BarChart';
};

export const LABS_TOOLS: LabsTool[] = [
    { href: '/visual-aid-designer', titleKey: 'Visual Aid Designer', descriptionKey: 'Diagrams & illustrations.', icon: 'Images' },
    { href: '/content-creator', titleKey: 'Content Creator', descriptionKey: 'Stories & visual aids.', icon: 'BookOpen' },
    { href: '/assessment-scanner', titleKey: 'Assessment Scanner', descriptionKey: 'Scan and grade answer sheets.', icon: 'ScanLine' },
    { href: '/assess-assignment', titleKey: 'Assess Work', descriptionKey: 'Grade handwritten work from a photo.', icon: 'ScanEye' },
    { href: '/video-storyteller', titleKey: 'Video Storyteller', descriptionKey: 'Curated videos for your topic.', icon: 'Video' },
    { href: '/virtual-field-trip', titleKey: 'Virtual Field Trip', descriptionKey: 'Explore places from the classroom.', icon: 'Globe2' },
    { href: '/teacher-training', titleKey: 'Teacher Training', descriptionKey: 'Professional development.', icon: 'GraduationCap' },
    { href: '/impact-dashboard', titleKey: 'Impact', descriptionKey: 'Your usage and time saved.', icon: 'BarChart' },
];

export function isLabsRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return LABS_TOOLS.some(
        (tool) => pathname === tool.href || pathname.startsWith(tool.href + '/'),
    );
}
