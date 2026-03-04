/**
 * Trusted Indian Educational YouTube Channel Registry
 * 
 * These channels are authoritative, high-quality sources for Indian teachers.
 * Organized by pedagogical category and subject area.
 * 
 * Channel IDs are stable - they don't change even if channel names change.
 * RSS feeds for these channels are free, require no API key, and have no quota limits.
 */

export interface ChannelDefinition {
    id: string;
    name: string;
    description: string;
    subjects?: string[]; // e.g. ['Math', 'Science'] - for subject-aware routing
}

/** Map of category → list of channel definitions */
export const INDIAN_EDU_CHANNELS: Record<string, ChannelDefinition[]> = {
    /**
     * Government pedagogy, NEP 2020, NCF, DIKSHA, NCERT official content
     */
    pedagogy: [
        {
            id: 'UCrhOHCn57xhYhJOimVbPtJQ',
            name: 'NCERT Official',
            description: 'National Council of Educational Research and Training'
        },
        {
            id: 'UCcxzGBOlJ3OwSAXMpTy-f7A',
            name: 'DIKSHA',
            description: 'Digital Infrastructure for Knowledge Sharing - Government of India'
        },
        {
            id: 'UCuVDMLByFzIa1Ps0F0ufJaQ',
            name: 'Ministry of Education India',
            description: 'Official channel - Ministry of Education, Govt of India'
        },
    ],

    /**
     * Subject storytelling, animated concept explainers, narrative learning
     */
    storytelling: [
        {
            id: 'UC1mITbFJjhqbC2LVMn3Bpeg',
            name: 'Khan Academy India',
            description: 'World-class education in Hindi and English for Indian students'
        },
        {
            id: 'UC0RhatS1pyxInC00YKjjBqQ',
            name: 'Magnet Brains',
            description: 'NCERT-based animated concept explanations for Classes 5-12'
        },
        {
            id: 'UCF6EaS1Hiv63bm5GVQM4Oqg',
            name: 'Lets Tute',
            description: 'Story-based learning for Indian school students'
        },
    ],

    /**
     * Government education updates, ministry announcements, SWAYAM, policy news
     */
    govtUpdates: [
        {
            id: 'UC_-5OhJMCLHHe3P3KPW5WFg',
            name: 'SWAYAM NPTEL',
            description: 'Free online courses from IITs and IISc for Indian teachers'
        },
        {
            id: 'UCcxzGBOlJ3OwSAXMpTy-f7A',
            name: 'DIKSHA Portal',
            description: 'Official government digital content for teachers and students'
        },
        {
            id: 'UCrhOHCn57xhYhJOimVbPtJQ',
            name: 'NCERT',
            description: 'Authoritative academic content and teacher resources'
        },
    ],

    /**
     * Professional teacher development, training, classroom management
     */
    courses: [
        {
            id: 'UC_-wRChKLkuH_jXWb1e-hCw',
            name: 'Vedantu',
            description: 'Live teaching and recorded courses across all subjects'
        },
        {
            id: 'UCPd0bTklnA_kSMHrU24fKKQ',
            name: 'Unacademy',
            description: 'Comprehensive teacher training and subject courses'
        },
        {
            id: 'UCiP8Mv3xJpFSvnuFPpKuDdw',
            name: 'Teach For India',
            description: 'Teacher community, training, and classroom strategies for India'
        },
    ],

    /**
     * Top recommended: mix of popular, high-quality Indian education channels
     */
    topRecommended: [
        {
            id: 'UC1mITbFJjhqbC2LVMn3Bpeg',
            name: 'Khan Academy India',
            description: 'Best multi-subject educational content in Hindi and English'
        },
        {
            id: 'UC0RhatS1pyxInC00YKjjBqQ',
            name: 'Magnet Brains',
            description: 'Comprehensive NCERT curriculum coverage for Indian schools'
        },
        {
            id: 'UCrhOHCn57xhYhJOimVbPtJQ',
            name: 'NCERT Official',
            description: 'The gold standard of Indian curriculum content'
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
        { id: 'UC0RhatS1pyxInC00YKjjBqQ', name: 'Magnet Brains', description: 'NCERT Math - Classes 5-12' },
        { id: 'UC_-wRChKLkuH_jXWb1e-hCw', name: 'Vedantu Math', description: 'Live and recorded Math lessons' },
        { id: 'UCF6EaS1Hiv63bm5GVQM4Oqg', name: 'Lets Tute', description: 'Math storytelling for Indian schools' },
    ],
    'Science': [
        { id: 'UC1mITbFJjhqbC2LVMn3Bpeg', name: 'Khan Academy India', description: 'Physics, Chemistry, Biology' },
        { id: 'UC0RhatS1pyxInC00YKjjBqQ', name: 'Magnet Brains Science', description: 'NCERT Science Classes 5-12' },
    ],
    'Hindi': [
        { id: 'UCrhOHCn57xhYhJOimVbPtJQ', name: 'NCERT', description: 'Hindi language and literature' },
        { id: 'UC0RhatS1pyxInC00YKjjBqQ', name: 'Magnet Brains Hindi', description: 'Hindi curriculum coverage' },
    ],
    'Social Science': [
        { id: 'UCrhOHCn57xhYhJOimVbPtJQ', name: 'NCERT', description: 'History, Geography, Civics' },
        { id: 'UCF6EaS1Hiv63bm5GVQM4Oqg', name: 'Lets Tute', description: 'Social science stories and explanations' },
    ],
    'English': [
        { id: 'UC1mITbFJjhqbC2LVMn3Bpeg', name: 'Khan Academy India', description: 'English language and literature' },
    ],
    'General': [
        { id: 'UC1mITbFJjhqbC2LVMn3Bpeg', name: 'Khan Academy India', description: 'Multi-subject learning' },
        { id: 'UC0RhatS1pyxInC00YKjjBqQ', name: 'Magnet Brains', description: 'All subjects NCERT based' },
    ],
};
