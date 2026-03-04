/**
 * Trusted Indian Educational YouTube Channel Registry
 * 
 * These channels are authoritative, high-quality sources for Indian teachers.
 * Organized by pedagogical category and subject area.
 * 
 * All Channel IDs below are VERIFIED against the YouTube API.
 * RSS feeds for these channels are free, require no API key, and have no quota limits.
 */

export interface ChannelDefinition {
    id: string;
    name: string;
    description: string;
    subjects?: string[]; // e.g. ['Math', 'Science'] - for subject-aware routing
}

// 100% verified IDs
const CHANNELS = {
    NCERT: 'UCT0s92hGjqLX6p7qY9BBrSA',
    MINISTRY_OF_ED: 'UCp2smQxAyu_09vXiPJ3vTTg',
    KHAN_ACADEMY: 'UCR3ZOcUoPHiFGd-Q9FwV-yA',
    UNACADEMY: 'UCx1VY57UmjU76Tgq8YwkklA'
};

/** Map of category → list of channel definitions */
export const INDIAN_EDU_CHANNELS: Record<string, ChannelDefinition[]> = {
    /**
     * Government pedagogy, NEP 2020, NCF, DIKSHA, NCERT official content
     */
    pedagogy: [
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official',
            description: 'National Council of Educational Research and Training'
        },
        {
            id: CHANNELS.MINISTRY_OF_ED,
            name: 'Ministry of Education India',
            description: 'Official channel - Ministry of Education, Govt of India'
        },
    ],

    /**
     * Subject storytelling, animated concept explainers, narrative learning
     */
    storytelling: [
        {
            id: CHANNELS.KHAN_ACADEMY,
            name: 'Khan Academy India',
            description: 'World-class education in Hindi and English for Indian students'
        },
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official',
            description: 'NCERT-based educational concepts'
        },
    ],

    /**
     * Government education updates, ministry announcements, SWAYAM, policy news
     */
    govtUpdates: [
        {
            id: CHANNELS.MINISTRY_OF_ED,
            name: 'Ministry of Education India',
            description: 'Official government digital content and announcements'
        },
        {
            id: CHANNELS.NCERT,
            name: 'NCERT',
            description: 'Authoritative academic content and updates'
        },
    ],

    /**
     * Professional teacher development, training, classroom management
     */
    courses: [
        {
            id: CHANNELS.UNACADEMY,
            name: 'Unacademy',
            description: 'Comprehensive teacher training and subject courses'
        },
        {
            id: CHANNELS.KHAN_ACADEMY,
            name: 'Khan Academy India',
            description: 'Teacher community, training, and classroom strategies'
        },
    ],

    /**
     * Top recommended: mix of popular, high-quality Indian education channels
     */
    topRecommended: [
        {
            id: CHANNELS.KHAN_ACADEMY,
            name: 'Khan Academy India',
            description: 'Best multi-subject educational content in Hindi and English'
        },
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official',
            description: 'The gold standard of Indian curriculum content'
        },
        {
            id: CHANNELS.UNACADEMY,
            name: 'Unacademy',
            description: 'Top courses and training material for Indian educators'
        },
    ],
};

/**
 * Subject-specific channel overrides.
 * When a teacher's subject is known, we prioritize these channels for that subject
 * in the storytelling and topRecommended categories.
 */
export const SUBJECT_CHANNEL_MAP: Record<string, ChannelDefinition[]> = {
    'Mathematics': [
        { id: CHANNELS.UNACADEMY, name: 'Unacademy Math', description: 'Comprehensive Math lessons' },
        { id: CHANNELS.KHAN_ACADEMY, name: 'Khan Academy India', description: 'Math storytelling for Indian schools' },
    ],
    'Science': [
        { id: CHANNELS.KHAN_ACADEMY, name: 'Khan Academy India', description: 'Physics, Chemistry, Biology' },
        { id: CHANNELS.NCERT, name: 'NCERT Science', description: 'NCERT Science Classes 5-12' },
    ],
    'Hindi': [
        { id: CHANNELS.NCERT, name: 'NCERT', description: 'Hindi language and literature' },
        { id: CHANNELS.UNACADEMY, name: 'Unacademy Hindi', description: 'Hindi curriculum coverage' },
    ],
    'Social Science': [
        { id: CHANNELS.NCERT, name: 'NCERT', description: 'History, Geography, Civics' },
        { id: CHANNELS.KHAN_ACADEMY, name: 'Khan Academy India', description: 'Social science stories and explanations' },
    ],
    'English': [
        { id: CHANNELS.KHAN_ACADEMY, name: 'Khan Academy India', description: 'English language and literature' },
    ],
    'General': [
        { id: CHANNELS.KHAN_ACADEMY, name: 'Khan Academy India', description: 'Multi-subject learning' },
        { id: CHANNELS.NCERT, name: 'NCERT Official', description: 'All subjects NCERT based' },
    ],
};
