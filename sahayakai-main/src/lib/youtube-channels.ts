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
    UNACADEMY: 'UCx1VY57UmjU76Tgq8YwkklA',
    IGNOU: 'UCaIXqbYp2OJ4fdTM4JqZuDg',
    CEC_UGC: 'UCA7OQkX9AEIVQ6j9i0OSQhA'
};

/** Map of category → list of channel definitions */
export const INDIAN_EDU_CHANNELS: Record<string, ChannelDefinition[]> = {
    /**
     * Government pedagogy, NEP 2020, NCF, DIKSHA, NCERT official content
     */
    pedagogy: [
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official (DIKSHA)',
            description: 'National Council of Educational Research and Training - DIKSHA Portal'
        },
        {
            id: CHANNELS.MINISTRY_OF_ED,
            name: 'Ministry of Education India',
            description: 'Official channel - Ministry of Education, Govt of India'
        },
        {
            id: CHANNELS.CEC_UGC,
            name: 'CEC-UGC',
            description: 'Consortium for Educational Communication - Undergraduate Education'
        },
    ],

    /**
     * Subject storytelling, animated concept explainers, narrative learning
     */
    storytelling: [
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official',
            description: 'NCERT-based educational concepts and stories'
        },
        {
            id: CHANNELS.KHAN_ACADEMY,
            name: 'Khan Academy India',
            description: 'World-class education in Hindi and English for Indian students'
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
            id: CHANNELS.NCERT,
            name: 'NCERT Official (Nishtha)',
            description: 'Nishtha modules and professional development courses'
        },
        {
            id: CHANNELS.IGNOU,
            name: 'IGNOU Official',
            description: 'Indira Gandhi National Open University - Teacher Education & Training'
        },
        {
            id: CHANNELS.MINISTRY_OF_ED,
            name: 'Ministry of Education India',
            description: 'Official announcements and teacher training frameworks'
        },
    ],

    /**
     * Top recommended: mix of popular, high-quality Indian education channels
     */
    topRecommended: [
        {
            id: CHANNELS.NCERT,
            name: 'NCERT Official',
            description: 'The gold standard of Indian curriculum content'
        },
        {
            id: CHANNELS.MINISTRY_OF_ED,
            name: 'PM e-Vidya',
            description: 'Official digital learning channel for Classes 1-12'
        },
        {
            id: CHANNELS.CEC_UGC,
            name: 'CEC-UGC Gurukul',
            description: 'Premium undergraduate and teacher training content'
        },
        {
            id: CHANNELS.IGNOU,
            name: 'IGNOU',
            description: 'National resources for open and distance learning'
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
