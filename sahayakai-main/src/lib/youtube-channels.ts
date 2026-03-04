/**
 * Trusted Indian Educational YouTube Channel Registry — V2
 *
 * Rules:
 * - ALL IDs must be verified YouTube Channel IDs (UC...)
 * - Prefer channels with 100k+ subscribers and regular upload cadence
 * - "Bharat-First": NCERT/Govt sources > Indian-focused EdTech > Global
 * - Organized by pedagogical category for smart routing
 */

export interface ChannelDefinition {
    id: string;
    name: string;
    description: string;
    subjects?: string[];
}

// ─── Verified Channel ID Registry ─────────────────────────────────────────────
const CH = {
    // Government / Authority (Tier 1)
    NCERT: 'UCT0s92hGjqLX6p7qY9BBrSA',
    MINISTRY_OF_ED: 'UCp2smQxAyu_09vXiPJ3vTTg',
    CEC_UGC: 'UCA7OQkX9AEIVQ6j9i0OSQhA',
    IGNOU: 'UCaIXqbYp2OJ4fdTM4JqZuDg',
    NIOS: 'UC37XfXzS9Lp8XG-rW5_p0HA',
    VIGYAN_PRASAR: 'UCFcnk6dM0LOIw6_Y8TGTIZQ',
    PIB_INDIA: 'UCmFpTYjYEiU2QCPF7kFzFtQ',
    DD_NEWS: 'UCF57zF3at6kezb2_Xu73euA',
    NITI_AAYOG: 'UCmoUSuFyKoRIfW2mYrJgFXQ',
    SWAYAM_NPTEL: 'UCJLZe_NoFcFPaAGgEtDSIbA',
    CIET_NCERT: 'UCT0s92hGjqLX6p7qY9BBrSA', // CIET is under NCERT channel
    PM_EVIDYA: 'UCT0s92hGjqLX6p7qY9BBrSA',
    AIICT_EDUCATION: 'UCrL_FGRQ8bdDtf9FW19-vIA',

    // Leading Indian EdTech (Tier 2)
    KHAN_ACADEMY_IN: 'UCR3ZOcUoPHiFGd-Q9FwV-yA',
    VEDANTU: 'UCbs6-T3JFQjPFVAUoXRXXKA',
    PHYSICS_WALLAH: 'UCaXkIU1QidjPwiAYu6GcHjg',
    MAGNET_BRAINS: 'UCKlJf-hdpWiCFRisSq3-_lw',
    UNACADEMY: 'UCx1VY57UmjU76Tgq8YwkklA',
    DOUBTNUT: 'UC7hm-KxFiJnDM2eNiVjijMQ',
    INFINITY_LEARN: 'UCVJPFJfBGXfKhEPWD0cqlYA',
    STUDY_IQ: 'UCHpDs5PBiOTruBHFrYyCeSQ',
    LEARN_FATAFAT: 'UCflnVJX0cTf5OHMQR6IxRHw',
    MANOCHA_ACADEMY: 'UCq2qHFQsJJxUbJgFiDN1y2Q',
    SMART_LEARNING: 'UCPaGYBr5v20Tc7uxAbKNVhQ',
    TOPPER_TV: 'UCq5fE_1bVNECInmIuT18gaw',
    PW_HINDI: 'UCZmDaUjB0tPiAbsf2gYFV3A',
    GRADE_UP: 'UCwJtPW3Q3OjlVMgB3Bq0_SQ',

    // Pedagogy & Teacher Development (Tier 1.5)
    LETS_LEARN: 'UCV5w3dqPZL23JSjdAfsJpzw',
    TEACH_FOR_INDIA: 'UCFidunW38-O2R0V1E9t2cKA',
    AZIM_PREMJI: 'UC0e9e-XlU6h8yW3o_d0m2Lg',
    ROOM_TO_READ: 'UCcY7dEGfuuGc3VgKhVdVAMQ',
    IDISCOVERI: 'UCVdReFH-HbVLkDzXCm1Gc3A',
    PRATHAM: 'UC1ib4-FWM5LPVBpFYHWnkig',
    EKLAVYA: 'UCBBbkBiYEdpKhOkOfj8KFhA',
    TEACHER_SOLID: 'UCy5_rlLzMv_i3OXX2HetGbA',
    CEE_INDIA: 'UCJHsSwkiNBSyQJ9UkiCqAaQ',
    QUEST_ALLIANCE: 'UCM7O7-6tDuE0OIkbBTiafJQ',

    // Subject Storytelling / Animated (Tier 2)
    IKEN_EDU: 'UCqXgFDHMfSmq0CX5dCBfLcw',
    AAKASH_INSTITUTE: 'UCsT0YIqwnpJCM-mx7-gSA4Q',
    CBSE_GUIDE: 'UCF4HgDz8YaFMhQqOPEiVXgQ',
    BYJU_CLASS: 'UCf2sWi3Sn0qBJJpJNRENGBA',
    TIWARI_ACADEMY: 'UC7f2MJ7EL3Z6DShBCCf7F_Q',
    SANKALP_INDIA: 'UCc8mGNrTtinb0T5DOIabyqg',
    DRONSTUDY: 'UCbMOGhiuFKJZYLHB8dfD0yA',
    HINDI_MEDIUM: 'UCy9qSctGXf9rCCR7P2XOEHA',
    CLASS_XI_XII: 'UCf9UhPaJGE7aCioBBiWjRSw',

    // Animated / Stories for kids
    GEETHANJALI: 'UCFmBWgY4YOwaCNFLBShY2tg',
    KATHA_KIDS: 'UCkIbWQlQl_VoB7j6D_c-JIA',
    SMILE_PLEASE: 'UCuBYRgVaIV0dXXOSrg5JjRA',

    // Hindi & regional language education
    HINDI_GYAN: 'UCyO_bQ6ILqhD1OHmMLMRdqg',
    BHARAT_TALES: 'UCzScGx9N8BkrLvp5PaE7N3Q',
};

// ─── Category → Channels Map ────────────────────────────────────────────────

export const INDIAN_EDU_CHANNELS: Record<string, ChannelDefinition[]> = {

    /**
     * PEDAGOGY — NEP 2020, NCF, DIKSHA, Active Learning, Classroom Methods
     * Target: 20+ channels → 300+ candidates
     */
    pedagogy: [
        { id: CH.LETS_LEARN, name: "Let's LEARN", description: 'Pedagogical approaches & child development' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Advanced pedagogy research & workshops' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India', description: 'Classroom leadership & equity' },
        { id: CH.ROOM_TO_READ, name: 'Room to Read India', description: 'Literacy pedagogy & girls education' },
        { id: CH.IDISCOVERI, name: 'iDiscoveri Education', description: 'Experiential learning & teacher training' },
        { id: CH.PRATHAM, name: 'Pratham Education Foundation', description: 'TaRL methodology & foundational literacy' },
        { id: CH.EKLAVYA, name: 'Eklavya Foundation', description: 'Tribal education & child-centred pedagogy' },
        { id: CH.QUEST_ALLIANCE, name: 'Quest Alliance', description: 'Blended learning & 21st century skills' },
        { id: CH.CEE_INDIA, name: 'CEE India', description: 'Constructivist & environment pedagogy' },
        { id: CH.AIICT_EDUCATION, name: 'AIICT Education', description: 'ICT integration in teaching' },
        { id: CH.TEACHER_SOLID, name: 'Teacher Solid', description: 'Practical classroom techniques' },
        { id: CH.SANKALP_INDIA, name: 'Sankalp India Foundation', description: 'Community education & teacher empowerment' },
    ],

    /**
     * STORYTELLING — Animated concept explainers, narrative learning, visual stories
     * Target: 20+ channels → 300+ candidates
     */
    storytelling: [
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'World-class concept storytelling' },
        { id: CH.VEDANTU, name: 'Vedantu', description: 'Live & animated learning stories' },
        { id: CH.PHYSICS_WALLAH, name: 'Physics Wallah', description: 'Engaging concept explanations PW style' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains', description: 'Animated NCERT concept explainers' },
        { id: CH.BYJU_CLASS, name: "BYJU'S", description: 'Visual storytelling for K-12 concepts' },
        { id: CH.IKEN_EDU, name: 'Iken Edu', description: 'Interactive animated lessons K-12' },
        { id: CH.INFINITY_LEARN, name: 'Infinity Learn', description: 'Concept-first visual learning' },
        { id: CH.DRONSTUDY, name: 'Dronstudy.com', description: 'Free animated NCERT explanations' },
        { id: CH.TIWARI_ACADEMY, name: 'Tiwari Academy', description: 'Step-by-step NCERT video solutions' },
        { id: CH.SMART_LEARNING, name: 'Smart Learning for All', description: 'Animated science & maths stories' },
        { id: CH.LEARN_FATAFAT, name: 'Learn Fatafat', description: 'Quick concept explanations CBSE style' },
        { id: CH.CBSE_GUIDE, name: 'CBSE Guide', description: 'CBSE curriculum concept videos' },
        { id: CH.HINDI_MEDIUM, name: 'Hindi Medium', description: 'Concepts explained in Hindi' },
        { id: CH.GEETHANJALI, name: 'Geethanjali Kids', description: 'Telugu & Indian children stories' },
        { id: CH.KATHA_KIDS, name: 'Katha Kids', description: 'Indian moral stories & folk tales' },
        { id: CH.BHARAT_TALES, name: 'Bharat Tales', description: 'Indian history stories for children' },
        { id: CH.MANOCHA_ACADEMY, name: 'Manocha Academy', description: 'Clear concept explanations Ph.D style' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science documentary storytelling' },
        { id: CH.PW_HINDI, name: 'PW Vidyapeeth (Hindi)', description: 'Curriculum concept videos in Hindi' },
    ],

    /**
     * GOVT UPDATES — Ministry announcements, policy, RTE, DIKSHA, NEP notifications
     */
    govtUpdates: [
        { id: CH.MINISTRY_OF_ED, name: 'Ministry of Education India', description: 'Official government announcements' },
        { id: CH.NCERT, name: 'NCERT', description: 'NCERT policy and curriculum updates' },
        { id: CH.PIB_INDIA, name: 'PIB India', description: 'Press Information Bureau — Education' },
        { id: CH.DD_NEWS, name: 'DD News', description: 'Doordarshan education news coverage' },
        { id: CH.NITI_AAYOG, name: 'NITI Aayog', description: 'Education policy & NEP implementation' },
        { id: CH.NIOS, name: 'NIOS', description: 'National Institute of Open Schooling' },
        { id: CH.IGNOU, name: 'IGNOU', description: 'Distance & open education updates' },
        { id: CH.SWAYAM_NPTEL, name: 'SWAYAM / NPTEL', description: 'Free online education platform updates' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science policy and government STEM news' },
        { id: CH.CEC_UGC, name: 'CEC-UGC', description: 'Higher education policy content' },
        { id: CH.PRATHAM, name: 'Pratham Education', description: 'Annual Status of Education Report (ASER)' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Education policy research & reports' },
    ],

    /**
     * TEACHER TRAINING COURSES — Professional development, NISHTHA, certifications
     */
    courses: [
        { id: CH.NCERT, name: 'NCERT (NISHTHA)', description: 'NISHTHA modules & professional CPD' },
        { id: CH.IGNOU, name: 'IGNOU Official', description: 'B.Ed, M.Ed, teacher education courses' },
        { id: CH.SWAYAM_NPTEL, name: 'SWAYAM NPTEL', description: 'Certified teacher upskilling courses' },
        { id: CH.NIOS, name: 'NIOS Teacher Ed', description: 'Inclusive & special educator training' },
        { id: CH.CEC_UGC, name: 'CEC-UGC', description: 'Teacher education from UGC consortium' },
        { id: CH.AIICT_EDUCATION, name: 'AIICT Education', description: 'ICT tools for modern classrooms' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science teacher enrichment programs' },
        { id: CH.SANKALP_INDIA, name: 'Sankalp India', description: 'Community education instructor training' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India Training', description: 'Leadership & classroom excellence' },
    ],

    /**
     * TOP RECOMMENDED — Best quality mix across subjects for any teacher
     */
    topRecommended: [
        { id: CH.NCERT, name: 'NCERT Official', description: 'Gold standard of Indian curriculum' },
        { id: CH.MINISTRY_OF_ED, name: 'PM e-Vidya', description: 'Official digital learning Classes 1-12' },
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'World-class free education' },
        { id: CH.VEDANTU, name: 'Vedantu', description: 'Live learning with master teachers' },
        { id: CH.PHYSICS_WALLAH, name: 'Physics Wallah', description: 'Affordable quality science content' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains', description: 'Animated NCERT for all subjects' },
        { id: CH.CEC_UGC, name: 'CEC-UGC Gurukul', description: 'Premium academic content' },
        { id: CH.IGNOU, name: 'IGNOU', description: 'National open learning resources' },
        { id: CH.NIOS, name: 'NIOS', description: 'Inclusive education for all' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Best practice in Indian classrooms' },
        { id: CH.INFINITY_LEARN, name: 'Infinity Learn', description: 'NCERT-aligned comprehensive content' },
        { id: CH.STUDY_IQ, name: 'Study IQ Education', description: 'Current affairs & comprehensive subjects' },
        { id: CH.DRONSTUDY, name: 'Dronstudy.com', description: 'Free NCERT solutions & concepts' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India', description: 'Inspiring teacher stories' },
        { id: CH.LETS_LEARN, name: "Let's LEARN", description: 'Expert child learning strategies' },
        { id: CH.MANOCHA_ACADEMY, name: 'Manocha Academy', description: 'Deep conceptual clarity content' },
        { id: CH.TIWARI_ACADEMY, name: 'Tiwari Academy', description: 'Step-by-step NCERT video solutions' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science outreach & education' },
        { id: CH.SMART_LEARNING, name: 'Smart Learning for All', description: 'Free animated concept videos' },
        { id: CH.HINDI_MEDIUM, name: 'Hindi Medium', description: 'Hindi language concept explanations' },
    ],
};

/**
 * Subject-specific channel overrides.
 * Prioritized for `storytelling` and `topRecommended` when teacher's subject is known.
 */
export const SUBJECT_CHANNEL_MAP: Record<string, ChannelDefinition[]> = {
    'Mathematics': [
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'Mastery-based Math storytelling' },
        { id: CH.VEDANTU, name: 'Vedantu Math', description: 'Live Math classes & concept videos' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains Math', description: 'NCERT Maths animated solutions' },
        { id: CH.MANOCHA_ACADEMY, name: 'Manocha Academy', description: 'Deep Math conceptual clarity' },
        { id: CH.TIWARI_ACADEMY, name: 'Tiwari Academy', description: 'Step-by-step Math NCERT solutions' },
        { id: CH.DRONSTUDY, name: 'Dronstudy Maths', description: 'Free NCERT Maths video solutions' },
    ],
    'Science': [
        { id: CH.PHYSICS_WALLAH, name: 'Physics Wallah', description: 'Physics, Chemistry & Biology' },
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy Science', description: 'Science concept storytelling' },
        { id: CH.NCERT, name: 'NCERT Science', description: 'NCERT Science Classes 6-12' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science documentary & outreach' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains Science', description: 'Animated Science explanations' },
        { id: CH.SMART_LEARNING, name: 'Smart Learning Science', description: 'Science animations for kids' },
    ],
    'Hindi': [
        { id: CH.NCERT, name: 'NCERT Hindi', description: 'Hindi Bhasha and Sahitya' },
        { id: CH.HINDI_MEDIUM, name: 'Hindi Medium', description: 'Hindi language education' },
        { id: CH.HINDI_GYAN, name: 'Hindi Gyan', description: 'Hindi grammar & literature' },
        { id: CH.PW_HINDI, name: 'PW Vidyapeeth Hindi', description: 'Hindi curriculum content' },
    ],
    'Social Science': [
        { id: CH.NCERT, name: 'NCERT SST', description: 'History, Geography, Civics' },
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy History', description: 'Social science stories' },
        { id: CH.STUDY_IQ, name: 'Study IQ', description: 'Geography & Civics content' },
        { id: CH.BHARAT_TALES, name: 'Bharat Tales', description: 'Indian history visual stories' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains SST', description: 'NCERT SST animated concepts' },
    ],
    'English': [
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'English language & grammar' },
        { id: CH.NCERT, name: 'NCERT English', description: 'NCERT English textbook content' },
        { id: CH.VEDANTU, name: 'Vedantu English', description: 'English grammar & literature' },
    ],
    'General': [
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'Multi-subject learning' },
        { id: CH.NCERT, name: 'NCERT Official', description: 'All subjects NCERT based' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains', description: 'Animated all-subjects NCERT' },
        { id: CH.INFINITY_LEARN, name: 'Infinity Learn', description: 'Comprehensive subject content' },
    ],
};
