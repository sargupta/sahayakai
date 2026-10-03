/**
 * SahayakAI application manifest — what exists in the app, where it lives,
 * and what VIDYA may help the teacher do there.
 *
 * Single typed source for VIDYA's product knowledge. Derived from the real
 * navigation (`app-sidebar.tsx` groups, `command-palette.tsx` ROUTES,
 * `mobile-bottom-nav.tsx` TABS) and on-screen labels — NOT invented.
 * `src/__tests__/lib/vidya/app-manifest.test.ts` pins every route to an
 * existing `src/app/**\/page.tsx` and every command-palette route to a
 * section here, so the manifest cannot drift into sections that do not
 * exist.
 *
 * Static data only: no per-user state lives here. Live screen state comes
 * from `useVidyaScreenContext` / the capability registry at request time.
 *
 * Safe to import from both client and server code (no React, no Node APIs).
 */

export type VidyaSectionId =
    | 'home'
    | 'lesson-plan'
    | 'worksheet-wizard'
    | 'quiz-generator'
    | 'rubric-generator'
    | 'exam-paper'
    | 'attendance'
    | 'community'
    | 'instant-answer'
    | 'my-library'
    | 'messages'
    | 'notifications'
    | 'labs'
    | 'visual-aid-designer'
    | 'content-creator'
    | 'video-storyteller'
    | 'virtual-field-trip'
    | 'teacher-training'
    | 'assessment-scanner'
    | 'impact-dashboard'
    | 'my-profile'
    | 'settings'
    | 'privacy'
    | 'pricing';

export interface VidyaSection {
    id: VidyaSectionId;
    /** English label as shown in the sidebar / command palette. */
    label: string;
    route: string;
    /** Sidebar group it appears under ("Create", "Assess", …). */
    group: string;
    /** What the teacher does here, one line. */
    purpose: string;
    /** How to reach it in the UI, in the teacher's terms. */
    whereToFind: string;
}

export interface VidyaWorkflow {
    id: string;
    section: VidyaSectionId;
    title: string;
    /** Ordered steps using the real on-screen labels. */
    steps: string[];
}

export type VidyaCapabilityKind =
    /** Changes only what is on screen (open a form, switch a tab, filter). */
    | 'ui'
    /** Persists data through the app's existing API. Always confirmed first. */
    | 'mutation';

export interface VidyaCapability {
    id: string;
    section: VidyaSectionId;
    kind: VidyaCapabilityKind;
    /** What the action does, for the model and the confirm prompt. */
    description: string;
    /** Named params the handler accepts (all strings). */
    params?: string[];
}

const PALETTE_HINT = 'or press Ctrl/⌘+K (the search button in the header) and type its name';
const ADVANCED_HINT = 'New teachers may need to tap "See all tools" in the sidebar first';

export const VIDYA_SECTIONS: readonly VidyaSection[] = [
    { id: 'home', label: 'Home', route: '/', group: 'Home', purpose: 'Dashboard: ask VIDYA, see recent work, start any tool.', whereToFind: 'Sidebar → Home, or the Home tab in the mobile bottom bar.' },
    { id: 'lesson-plan', label: 'Lesson Plan', route: '/lesson-plan', group: 'Create', purpose: 'Generate a 5E lesson plan (NCERT-aware).', whereToFind: `Sidebar → Create → Lesson Plan, ${PALETTE_HINT}.` },
    { id: 'worksheet-wizard', label: 'Worksheet Wizard', route: '/worksheet-wizard', group: 'Create', purpose: 'Generate a printable worksheet.', whereToFind: `Sidebar → Create → Worksheet Wizard, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'quiz-generator', label: 'Quiz Generator', route: '/quiz-generator', group: 'Assess', purpose: 'Generate easy/medium/hard quiz variants.', whereToFind: `Sidebar → Assess → Quiz Generator, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'rubric-generator', label: 'Rubric Generator', route: '/rubric-generator', group: 'Assess', purpose: 'Generate a grading rubric.', whereToFind: `Sidebar → Assess → Rubric Generator, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'exam-paper', label: 'Exam Paper', route: '/exam-paper', group: 'Assess', purpose: 'Generate a board-pattern exam paper with answer key.', whereToFind: `Sidebar → Assess → Exam Paper, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'attendance', label: 'Attendance', route: '/attendance', group: 'Assess', purpose: 'Classes, student rosters, daily attendance, monthly reports and parent contact. This is where students are added (there is no separate Students page).', whereToFind: `Sidebar → Assess → Attendance, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'community', label: 'Community', route: '/community', group: 'Community', purpose: 'Teacher community: feed, groups, chat, teacher directory and shared resources.', whereToFind: `Sidebar → Community, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'instant-answer', label: 'Instant Answer', route: '/instant-answer', group: 'Ask', purpose: 'Ask a factual question and get a quick answer. Answers are saved to My Library only when you press Save.', whereToFind: `Sidebar → Ask → Instant Answer, ${PALETTE_HINT}.` },
    { id: 'my-library', label: 'My Library', route: '/my-library', group: 'My work', purpose: 'Two tabs. Generations: everything you generated or saved (lesson plans, worksheets, quizzes, rubrics, exam papers, …) to open, download or delete. Conversations: every chat with VIDYA (typed or spoken), kept automatically; bookmark one to keep it permanently. Chat never appears under Generations.', whereToFind: `Sidebar → My work → My Library, the Library tab in the mobile bottom bar, ${PALETTE_HINT}.` },
    { id: 'messages', label: 'Messages', route: '/messages', group: 'My work', purpose: 'Direct and group messages with other teachers.', whereToFind: `Sidebar → My work → Messages, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'notifications', label: 'Notifications', route: '/notifications', group: 'My work', purpose: 'Your notifications.', whereToFind: `Sidebar → My work → Notifications, ${PALETTE_HINT}.` },
    { id: 'labs', label: 'Labs', route: '/labs', group: 'Labs', purpose: 'Experimental tools (visual aids, field trips, teacher training, video, assessment scanner, impact).', whereToFind: `Sidebar → Labs, ${PALETTE_HINT}. ${ADVANCED_HINT}.` },
    { id: 'visual-aid-designer', label: 'Visual Aid Designer', route: '/visual-aid-designer', group: 'Labs', purpose: 'Generate a teaching diagram or illustration.', whereToFind: `Labs → Visual Aid Designer, ${PALETTE_HINT}.` },
    { id: 'content-creator', label: 'Content Creator', route: '/content-creator', group: 'Labs', purpose: 'Hub linking the visual, field-trip and video tools.', whereToFind: `Labs, ${PALETTE_HINT}.` },
    { id: 'video-storyteller', label: 'Video Storyteller', route: '/video-storyteller', group: 'Labs', purpose: 'Find curated educational videos for a topic.', whereToFind: `Labs → Video Storyteller, ${PALETTE_HINT}.` },
    { id: 'virtual-field-trip', label: 'Virtual Field Trip', route: '/virtual-field-trip', group: 'Labs', purpose: 'Plan a virtual field trip with tour stops.', whereToFind: `Labs → Virtual Field Trip, ${PALETTE_HINT}.` },
    { id: 'teacher-training', label: 'Teacher Training', route: '/teacher-training', group: 'Labs', purpose: 'Professional-development and classroom-management advice.', whereToFind: `Labs → Teacher Training, ${PALETTE_HINT}.` },
    { id: 'assessment-scanner', label: 'Assessment Scanner', route: '/assessment-scanner', group: 'Labs', purpose: 'Scan and grade handwritten answer sheets.', whereToFind: `Labs → Assessment Scanner, ${PALETTE_HINT}.` },
    { id: 'impact-dashboard', label: 'Impact', route: '/impact-dashboard', group: 'Labs', purpose: 'Your teaching impact and activity stats.', whereToFind: `Labs → Impact, ${PALETTE_HINT}.` },
    { id: 'my-profile', label: 'My Profile', route: '/my-profile', group: 'Account', purpose: 'Your teacher profile.', whereToFind: `Sidebar → Account → My Profile, the Me tab in the mobile bottom bar, ${PALETTE_HINT}.` },
    { id: 'settings', label: 'Settings', route: '/settings', group: 'Account', purpose: 'Language, theme, data export and account settings.', whereToFind: `Sidebar → Account → Settings, ${PALETTE_HINT}.` },
    { id: 'privacy', label: 'Privacy', route: '/privacy-for-teachers', group: 'Account', purpose: 'Privacy explanation and consent.', whereToFind: `Sidebar → Account → Privacy, ${PALETTE_HINT}.` },
    { id: 'pricing', label: 'Pricing', route: '/pricing', group: 'Account', purpose: 'Plans and upgrades.', whereToFind: PALETTE_HINT.replace(/^or /, '') + '.' },
] as const;

export const VIDYA_WORKFLOWS: readonly VidyaWorkflow[] = [
    {
        id: 'attendance.mark',
        section: 'attendance',
        title: 'Take attendance',
        steps: [
            'Open Attendance and tap the class card',
            'Stay on the "Today" tab — everyone starts as present',
            'Tap a student to cycle present → absent → late, or tap "All Present"',
            'Tap "Submit Attendance" (nothing is saved until you submit)',
        ],
    },
    {
        id: 'students.add',
        section: 'attendance',
        title: 'Add a student',
        steps: [
            'Open Attendance and tap the class card (create one with "New Class" if needed)',
            'Open the "Students" tab',
            'Tap "Add Student", fill in the details, and tap "Add Student" to save',
        ],
    },
    {
        id: 'attendance.report',
        section: 'attendance',
        title: 'See monthly attendance',
        steps: ['Open Attendance and tap the class card', 'Open the "Reports" tab'],
    },
    {
        id: 'artifact.find',
        section: 'my-library',
        title: 'Find something you generated',
        steps: [
            'Every lesson plan, worksheet, quiz, rubric and exam paper you generate is saved automatically',
            'Open My Library → the "Generations" tab, and use the search box or the type filter',
        ],
    },
    {
        id: 'conversation.save',
        section: 'my-library',
        title: 'Find or keep a VIDYA conversation',
        steps: [
            'Every chat with VIDYA (typed or spoken) is kept automatically',
            'Open My Library → the "Conversations" tab to see your recent conversations',
            'Tap the bookmark on one to keep it permanently (recent ones are otherwise replaced over time)',
        ],
    },
] as const;

export const VIDYA_CAPABILITIES: readonly VidyaCapability[] = [
    { id: 'attendance.open_class', section: 'attendance', kind: 'ui', description: 'Open one of your classes by name.', params: ['className'] },
    { id: 'attendance.create_class', section: 'attendance', kind: 'ui', description: 'Open the New Class form.' },
    { id: 'class.show_tab', section: 'attendance', kind: 'ui', description: 'Switch the class page to the Today, Students or Reports tab.', params: ['tab'] },
    { id: 'students.open_add', section: 'attendance', kind: 'ui', description: 'Open the Add Student form for this class.' },
    { id: 'attendance.mark_all_present', section: 'attendance', kind: 'ui', description: 'Mark every student present on screen (not saved until submitted).' },
    { id: 'attendance.submit', section: 'attendance', kind: 'mutation', description: "Submit today's attendance for this class." },
    { id: 'library.filter', section: 'my-library', kind: 'ui', description: 'Show only one type of item in My Library.', params: ['type'] },
    { id: 'library.open_item', section: 'my-library', kind: 'ui', description: 'Open an item in My Library by its title.', params: ['title'] },
    { id: 'library.show_tab', section: 'my-library', kind: 'ui', description: 'Switch My Library to the Generations or Conversations tab.', params: ['tab'] },
] as const;

export type VidyaCapabilityId = (typeof VIDYA_CAPABILITIES)[number]['id'];

const SECTION_BY_ID = new Map(VIDYA_SECTIONS.map((s) => [s.id, s]));
const CAPABILITY_BY_ID = new Map(VIDYA_CAPABILITIES.map((c) => [c.id, c]));

export function getSection(id: string): VidyaSection | undefined {
    return SECTION_BY_ID.get(id as VidyaSectionId);
}

export function getCapability(id: string): VidyaCapability | undefined {
    return CAPABILITY_BY_ID.get(id);
}

export interface VidyaScreenLocation {
    section: VidyaSection | null;
    /** Finer-grained screen id, e.g. `attendance.class` for a class page. */
    screenId: string;
}

/**
 * Resolve a pathname to its manifest section and screen. Longest route
 * prefix wins; `/` only matches exactly.
 */
export function locateScreen(pathname: string | null | undefined): VidyaScreenLocation {
    const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
    let best: VidyaSection | null = null;
    for (const section of VIDYA_SECTIONS) {
        const matches = section.route === '/'
            ? path === '/'
            : path === section.route || path.startsWith(`${section.route}/`);
        if (matches && (!best || section.route.length > best.route.length)) best = section;
    }
    if (!best) return { section: null, screenId: 'unknown' };
    if (best.id === 'attendance') {
        if (/^\/attendance\/[^/]+\/marks$/.test(path)) return { section: best, screenId: 'attendance.marks' };
        if (/^\/attendance\/[^/]+$/.test(path)) return { section: best, screenId: 'attendance.class' };
        return { section: best, screenId: 'attendance.classes' };
    }
    return { section: best, screenId: best.id };
}

/**
 * Compact, prompt-ready description of the app (static — identical for
 * every teacher). Kept terse: it rides on every VIDYA text turn.
 */
export function renderManifestForPrompt(): string {
    const sections = VIDYA_SECTIONS
        .map((s) => `- ${s.id} | ${s.label} (${s.route}) — ${s.purpose} Where: ${s.whereToFind}`)
        .join('\n');
    const workflows = VIDYA_WORKFLOWS
        .map((w) => `- ${w.title} [${w.section}]: ${w.steps.join(' → ')}`)
        .join('\n');
    return `SahayakAI sections (id | label (route) — purpose. Where to find it):\n${sections}\n\nWorkflows:\n${workflows}`;
}
