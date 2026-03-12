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
    language?: string; // Primary content language
    tier?: 1 | 2 | 3;  // 1=State/Central Govt, 2=NGO, 3=Quality EdTech
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

    // ── State SCERT / State Education Department channels ─────────────────────
    // These are STATE GOVERNMENT channels — equal tier to central govt for their state.
    // Language in parentheses = primary content language.
    MAHARASHTRA_SCERT: 'UCMBqaUcHMZMzPESmB9GXRWA',  // Marathi — Maharashtra SCERT/Balbharati
    KERALA_SCERT: 'UCKe9f9xU4nzXpSoLGFHJLwg',         // Malayalam — Kerala SCERT
    KARNATAKA_DSERT: 'UCEuMGDfGkL_xZqRqpHJ0Kzw',      // Kannada — Karnataka DSERT / KTBS
    TAMILNADU_SCERT: 'UCN4DCiSAnCg4RnDQzCHf8Kw',      // Tamil — Tamil Nadu SCERT
    AP_SCERT: 'UCjpyTm5Nk5gT0FtCj9mifJg',             // Telugu — Andhra Pradesh SCERT
    TELANGANA_SCERT: 'UCvKo9GHDPWGmK-MBfKFYCYQ',      // Telugu — Telangana SCERT
    GUJARAT_GCERT: 'UCMkqMuC3GpPIHFpN6A5H8Ug',        // Gujarati — GCERT Gujarat
    RAJASTHAN_SCERT: 'UCTuJpGBqP7g2UGBV2Q9HPPA',      // Hindi — Rajasthan SCERT SIERT
    UP_SCERT: 'UCnIBBgcY7c5EBuJWCKHLv-w',             // Hindi — SCERT UP
    WB_SCERT: 'UCcZkua98s7EBgM7JvHx_kxA',             // Bengali — West Bengal SCERT
    PUNJAB_SCERT: 'UCJJzz4M1KLmWlGWtA2Tze7Q',         // Punjabi — Punjab SCERT
    ODISHA_SCERT: 'UC2y0GHgQ_DTqTsEcT5jJtmQ',         // Odia — Odisha SCERT
    ASSAM_SCERT: 'UCqS9WZ7dqwH5uGmqmfJc6hQ',          // Assamese — SCERT Assam
    // DD regional channels (Doordarshan state)
    DD_SAHYADRI: 'UCrP1-MtNhpHJ2Qf0TdHKS4Q',          // Marathi — DD Sahyadri Maharashtra
    DD_CHANDANA: 'UCK0aqc0zr9pJTVmHUAYNiVA',          // Kannada — DD Chandana Karnataka
    DD_PODHIGAI: 'UCJMpPpRtVGUyMTfH8MVGXCA',          // Tamil — DD Podhigai Tamil Nadu
    DD_YADAGIRI: 'UCbA4HlEVXBT-0OfmyAJHxwA',          // Telugu — DD Yadagiri AP/Telangana
    DD_BANGLA: 'UCWwnQPMqnkUWCt4mUc3acHQ',            // Bengali — DD Bangla West Bengal
};

// ─── Category → Channels Map ────────────────────────────────────────────────

export const INDIAN_EDU_CHANNELS: Record<string, ChannelDefinition[]> = {

    /**
     * PEDAGOGY — NEP 2020, NCF, DIKSHA, Active Learning, Classroom Methods
     * School teacher-focused ONLY. CEC-UGC/IGNOU/SWAYAM-NPTEL excluded here
     * (they produce college-level content, not primary/secondary pedagogy).
     */
    pedagogy: [
        { id: CH.NCERT, name: 'NCERT Official (DIKSHA)', description: 'DIKSHA & NISHTHA teacher training' },
        { id: CH.MINISTRY_OF_ED, name: 'Ministry of Education India', description: 'NEP 2020, NCF, official policy content' },
        { id: CH.LETS_LEARN, name: "Let's LEARN", description: 'Pedagogical approaches & child development' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Advanced pedagogy research & workshops' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India', description: 'Classroom leadership & equity' },
        { id: CH.ROOM_TO_READ, name: 'Room to Read India', description: 'Literacy pedagogy & girls education' },
        { id: CH.IDISCOVERI, name: 'iDiscoveri Education', description: 'Experiential learning & teacher training' },
        { id: CH.PRATHAM, name: 'Pratham Education Foundation', description: 'TaRL methodology & foundational literacy' },
        { id: CH.EKLAVYA, name: 'Eklavya Foundation', description: 'Tribal education & child-centred pedagogy' },
        { id: CH.QUEST_ALLIANCE, name: 'Quest Alliance', description: 'Blended learning & 21st century skills' },
        { id: CH.CEE_INDIA, name: 'CEE India', description: 'Constructivist & environment pedagogy' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science communication & inquiry-based learning' },
        { id: CH.NIOS, name: 'NIOS', description: 'Open schooling & inclusive education' },
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'Mastery-based learning methodology' },
        { id: CH.AIICT_EDUCATION, name: 'AIICT Education', description: 'ICT integration in teaching' },
        { id: CH.TEACHER_SOLID, name: 'Teacher Solid', description: 'Practical classroom techniques' },
        { id: CH.SANKALP_INDIA, name: 'Sankalp India Foundation', description: 'Community education & teacher empowerment' },
    ],

    /**
     * STORYTELLING — Animated concept explainers, narrative learning, visual stories
     * School level (Class 1-12) ONLY.
     * Removed: BYJU_CLASS (student exam-prep, not teacher content),
     *          AAKASH_INSTITUTE (JEE/NEET coaching, irrelevant to school teachers).
     */
    storytelling: [
        { id: CH.NCERT, name: 'NCERT Official', description: 'NCERT textbook concepts visualized' },
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'World-class concept storytelling K-12' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains', description: 'Animated NCERT concept explainers' },
        { id: CH.IKEN_EDU, name: 'Iken Edu', description: 'Interactive animated lessons K-12' },
        { id: CH.INFINITY_LEARN, name: 'Infinity Learn', description: 'Concept-first visual learning K-12' },
        { id: CH.DRONSTUDY, name: 'Dronstudy.com', description: 'Free animated NCERT explanations' },
        { id: CH.TIWARI_ACADEMY, name: 'Tiwari Academy', description: 'Step-by-step NCERT video solutions' },
        { id: CH.SMART_LEARNING, name: 'Smart Learning for All', description: 'Animated science & maths stories' },
        { id: CH.LEARN_FATAFAT, name: 'Learn Fatafat', description: 'Quick concept explanations CBSE style' },
        { id: CH.CBSE_GUIDE, name: 'CBSE Guide', description: 'CBSE curriculum concept videos' },
        { id: CH.HINDI_MEDIUM, name: 'Hindi Medium', description: 'Concepts explained in Hindi' },
        { id: CH.GEETHANJALI, name: 'Geethanjali Kids', description: 'Telugu & Indian children stories' },
        { id: CH.KATHA_KIDS, name: 'Katha Kids', description: 'Indian moral stories & folk tales' },
        { id: CH.BHARAT_TALES, name: 'Bharat Tales', description: 'Indian history stories for children' },
        { id: CH.MANOCHA_ACADEMY, name: 'Manocha Academy', description: 'Clear concept explanations Class 9-12' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science documentary storytelling' },
        { id: CH.PW_HINDI, name: 'PW Vidyapeeth (Hindi)', description: 'Curriculum concept videos in Hindi' },
    ],

    /**
     * GOVT UPDATES — Ministry announcements, school policy, RTE, DIKSHA, NEP notifications
     * School/primary/secondary education focus ONLY.
     * Removed: CEC-UGC (university grants, college policy), IGNOU (open university updates),
     *          SWAYAM/NPTEL (engineering/college platform).
     */
    govtUpdates: [
        { id: CH.MINISTRY_OF_ED, name: 'Ministry of Education India', description: 'Official school education announcements' },
        { id: CH.NCERT, name: 'NCERT', description: 'NCERT school curriculum policy updates' },
        { id: CH.PIB_INDIA, name: 'PIB India', description: 'Press Information Bureau — School Education' },
        { id: CH.DD_NEWS, name: 'DD News', description: 'Doordarshan school education news' },
        { id: CH.NITI_AAYOG, name: 'NITI Aayog', description: 'NEP 2020, school education policy' },
        { id: CH.NIOS, name: 'NIOS', description: 'Open schooling & secondary education updates' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science education policy & STEM news' },
        { id: CH.PRATHAM, name: 'Pratham Education', description: 'ASER report — annual school education data' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'School education policy research & reports' },
    ],

    /**
     * TEACHER TRAINING COURSES — Professional development, NISHTHA, certifications
     */
    courses: [
        { id: CH.NCERT, name: 'NCERT (NISHTHA)', description: 'NISHTHA modules & professional CPD' },
        { id: CH.IGNOU, name: 'IGNOU Official', description: 'B.Ed, M.Ed, teacher education courses' },
        { id: CH.MINISTRY_OF_ED, name: 'Ministry of Education India', description: 'Official teacher frameworks & training' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India', description: 'Leadership & classroom excellence' },
        { id: CH.SWAYAM_NPTEL, name: 'SWAYAM', description: 'SWAYAM teacher CPD & certification courses (school-level)' },
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Pedagogical research training' },
        { id: CH.LETS_LEARN, name: "Let's LEARN", description: 'Child development & learning science' },
        { id: CH.PRATHAM, name: 'Pratham Education', description: 'TaRL-based teacher training' },
        { id: CH.ROOM_TO_READ, name: 'Room to Read', description: 'Literacy skill development training' },
        { id: CH.IDISCOVERI, name: 'iDiscoveri Education', description: 'Experiential learning teacher courses' },
        { id: CH.QUEST_ALLIANCE, name: 'Quest Alliance', description: '21st century skills & digital tools' },
        { id: CH.EKLAVYA, name: 'Eklavya Foundation', description: 'Community & tribal teacher training' },
        { id: CH.SANKALP_INDIA, name: 'Sankalp India', description: 'Community education instructor training' },
        { id: CH.NIOS, name: 'NIOS', description: 'Inclusive & special educator training' },
        { id: CH.AIICT_EDUCATION, name: 'AIICT Education', description: 'ICT tools for modern classrooms' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science teacher enrichment programs' },
    ],

    /**
     * TOP RECOMMENDED — School teacher content: Govt > NGO > Quality EdTech.
     * College-focused channels (CEC-UGC, IGNOU, SWAYAM/NPTEL) excluded — they serve
     * university students and professors, not primary/secondary school teachers.
     */
    topRecommended: [
        // Tier 1: Government / Formal school education
        { id: CH.NCERT, name: 'NCERT Official', description: 'Gold standard of Indian school curriculum' },
        { id: CH.MINISTRY_OF_ED, name: 'PM e-Vidya / MoE', description: 'Official digital learning Classes 1-12' },
        { id: CH.NIOS, name: 'NIOS', description: 'Inclusive school education for all learners' },
        { id: CH.VIGYAN_PRASAR, name: 'Vigyan Prasar', description: 'Science outreach & STEM education K-12' },
        // Tier 2: NGO / Community (relatable, classroom-grounded)
        { id: CH.AZIM_PREMJI, name: 'Azim Premji Foundation', description: 'Best practice in Indian classrooms' },
        { id: CH.TEACH_FOR_INDIA, name: 'Teach For India', description: 'Teacher leadership & classroom excellence' },
        { id: CH.LETS_LEARN, name: "Let's LEARN", description: 'Child learning strategies for teachers' },
        { id: CH.PRATHAM, name: 'Pratham Education', description: 'TaRL & foundational literacy methods' },
        // Tier 3: Quality-aligned EdTech (NCERT-aligned or vernacular)
        { id: CH.KHAN_ACADEMY_IN, name: 'Khan Academy India', description: 'World-class free concept videos' },
        { id: CH.SMART_LEARNING, name: 'Smart Learning for All', description: 'Free animated concept videos' },
        { id: CH.MAGNET_BRAINS, name: 'Magnet Brains', description: 'Animated NCERT for all subjects' },
        { id: CH.HINDI_MEDIUM, name: 'Hindi Medium', description: 'Hindi language concept explanations' },
        { id: CH.TIWARI_ACADEMY, name: 'Tiwari Academy', description: 'Step-by-step NCERT video solutions' },
        { id: CH.DRONSTUDY, name: 'Dronstudy.com', description: 'Free NCERT solutions & concepts' },
        { id: CH.MANOCHA_ACADEMY, name: 'Manocha Academy', description: 'Deep conceptual clarity' },
        { id: CH.KATHA_KIDS, name: 'Katha Kids', description: 'Indian stories for classroom read-alouds' },
        { id: CH.BHARAT_TALES, name: 'Bharat Tales', description: 'Indian history visual stories' },
    ],
};

/**
 * Language-specific channel map.
 * Used to inject state govt + vernacular channels when the teacher's language is known.
 * State SCERT channels get Tier 1 authority (equal to central govt for their state's teachers).
 * These are PREPENDED to the category channel list so they appear first in ranking.
 *
 * NOTE: Channel IDs for state SCERTs should be verified periodically — state channels
 * occasionally migrate. Central govt channels (NCERT, MoE) are stable.
 */
export const LANGUAGE_CHANNEL_MAP: Record<string, ChannelDefinition[]> = {
    'Hindi': [
        { id: CH.UP_SCERT,        name: 'SCERT Uttar Pradesh',    description: 'UP state curriculum in Hindi',   language: 'Hindi', tier: 1 },
        { id: CH.RAJASTHAN_SCERT, name: 'SCERT Rajasthan (SIERT)',description: 'Rajasthan state content in Hindi', language: 'Hindi', tier: 1 },
        { id: CH.NCERT,           name: 'NCERT Official',          description: 'Central govt — primarily Hindi', language: 'Hindi', tier: 1 },
        { id: CH.HINDI_MEDIUM,    name: 'Hindi Medium',            description: 'Concepts explained in Hindi',    language: 'Hindi', tier: 3 },
        { id: CH.HINDI_GYAN,      name: 'Hindi Gyan',              description: 'Hindi grammar & literature',     language: 'Hindi', tier: 3 },
        { id: CH.MAGNET_BRAINS,   name: 'Magnet Brains',           description: 'NCERT concepts in Hindi',        language: 'Hindi', tier: 3 },
        { id: CH.DRONSTUDY,       name: 'Dronstudy',               description: 'Free NCERT solutions in Hindi',  language: 'Hindi', tier: 3 },
    ],
    'Marathi': [
        { id: CH.MAHARASHTRA_SCERT, name: 'Maharashtra SCERT / Balbharati', description: 'Maharashtra state curriculum in Marathi', language: 'Marathi', tier: 1 },
        { id: CH.DD_SAHYADRI,       name: 'DD Sahyadri',                    description: 'Doordarshan Maharashtra in Marathi',      language: 'Marathi', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Marathi)',   description: 'Concept videos in Marathi',              language: 'Marathi', tier: 3 },
    ],
    'Tamil': [
        { id: CH.TAMILNADU_SCERT,   name: 'Tamil Nadu SCERT',       description: 'TN state curriculum in Tamil',   language: 'Tamil', tier: 1 },
        { id: CH.DD_PODHIGAI,       name: 'DD Podhigai',            description: 'Doordarshan Tamil Nadu',          language: 'Tamil', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Tamil)', description: 'Concept videos in Tamil',    language: 'Tamil', tier: 3 },
    ],
    'Telugu': [
        { id: CH.AP_SCERT,          name: 'AP SCERT',               description: 'Andhra Pradesh curriculum in Telugu',  language: 'Telugu', tier: 1 },
        { id: CH.TELANGANA_SCERT,   name: 'Telangana SCERT',        description: 'Telangana curriculum in Telugu',       language: 'Telugu', tier: 1 },
        { id: CH.DD_YADAGIRI,       name: 'DD Yadagiri',            description: 'Doordarshan Telugu',                   language: 'Telugu', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Telugu)', description: 'Concept videos in Telugu',    language: 'Telugu', tier: 3 },
    ],
    'Kannada': [
        { id: CH.KARNATAKA_DSERT,   name: 'Karnataka DSERT / KTBS', description: 'Karnataka state curriculum in Kannada', language: 'Kannada', tier: 1 },
        { id: CH.DD_CHANDANA,       name: 'DD Chandana',            description: 'Doordarshan Karnataka in Kannada',      language: 'Kannada', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Kannada)', description: 'Concept videos in Kannada',  language: 'Kannada', tier: 3 },
    ],
    'Malayalam': [
        { id: CH.KERALA_SCERT,      name: 'Kerala SCERT',           description: 'Kerala state curriculum in Malayalam', language: 'Malayalam', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Malayalam)', description: 'Concept videos in Malayalam', language: 'Malayalam', tier: 3 },
    ],
    'Bengali': [
        { id: CH.WB_SCERT,          name: 'West Bengal SCERT',      description: 'WB state curriculum in Bengali',       language: 'Bengali', tier: 1 },
        { id: CH.DD_BANGLA,         name: 'DD Bangla',              description: 'Doordarshan Bengali',                  language: 'Bengali', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Bengali)', description: 'Concept videos in Bengali',  language: 'Bengali', tier: 3 },
    ],
    'Gujarati': [
        { id: CH.GUJARAT_GCERT,     name: 'GCERT Gujarat',          description: 'Gujarat state curriculum in Gujarati', language: 'Gujarati', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India (Gujarati)', description: 'Concept videos in Gujarati', language: 'Gujarati', tier: 3 },
    ],
    'Punjabi': [
        { id: CH.PUNJAB_SCERT,      name: 'Punjab SCERT',           description: 'Punjab state curriculum in Punjabi',  language: 'Punjabi', tier: 1 },
    ],
    'Odia': [
        { id: CH.ODISHA_SCERT,      name: 'Odisha SCERT',           description: 'Odisha state curriculum in Odia',     language: 'Odia', tier: 1 },
    ],
    'Assamese': [
        { id: CH.ASSAM_SCERT,       name: 'SCERT Assam',            description: 'Assam state curriculum in Assamese',  language: 'Assamese', tier: 1 },
    ],
    'English': [
        { id: CH.NCERT,             name: 'NCERT Official',          description: 'NCERT English-medium school content',  language: 'English', tier: 1 },
        { id: CH.KHAN_ACADEMY_IN,   name: 'Khan Academy India',     description: 'World-class K-12 content in English', language: 'English', tier: 3 },
        { id: CH.SMART_LEARNING,    name: 'Smart Learning for All', description: 'Animated K-12 concept videos',        language: 'English', tier: 3 },
    ],
};

/**
 * Maps each Indian state to its education configuration.
 * Used to inject the right SCERT channels and infer language defaults
 * when a teacher selects their state.
 *
 * scertChannelIds: IDs of state SCERT + regional DD channels.
 * These get stateBoost (+12) in the ranker when the teacher is from that state.
 * primaryLanguage: Default instruction language for that state's govt schools.
 * defaultBoard: Most common board for govt school teachers in that state.
 */
export interface StateEducationConfig {
    primaryLanguage: string;
    defaultBoard: string;
    scertChannelIds: string[];
}

export const STATE_EDUCATION_CONFIG: Record<string, StateEducationConfig> = {
    'Andhra Pradesh':    { primaryLanguage: 'Telugu',    defaultBoard: 'Andhra Pradesh State Board',    scertChannelIds: ['UCjpyTm5Nk5gT0FtCj9mifJg', 'UCbA4HlEVXBT-0OfmyAJHxwA'] },
    'Assam':             { primaryLanguage: 'Assamese',  defaultBoard: 'Assam State Board (SEBA)',       scertChannelIds: ['UCqS9WZ7dqwH5uGmqmfJc6hQ'] },
    'Bihar':             { primaryLanguage: 'Hindi',     defaultBoard: 'Bihar State Board (BSEB)',       scertChannelIds: [] },
    'Chhattisgarh':      { primaryLanguage: 'Hindi',     defaultBoard: 'Chhattisgarh State Board (CGBSE)', scertChannelIds: [] },
    'Delhi':             { primaryLanguage: 'Hindi',     defaultBoard: 'CBSE',                          scertChannelIds: [] },
    'Goa':               { primaryLanguage: 'English',   defaultBoard: 'Goa Board of Secondary Education', scertChannelIds: [] },
    'Gujarat':           { primaryLanguage: 'Gujarati',  defaultBoard: 'Gujarat State Board (GSEB)',    scertChannelIds: ['UCMkqMuC3GpPIHFpN6A5H8Ug'] },
    'Haryana':           { primaryLanguage: 'Hindi',     defaultBoard: 'Haryana State Board (HBSE)',    scertChannelIds: [] },
    'Himachal Pradesh':  { primaryLanguage: 'Hindi',     defaultBoard: 'Himachal Pradesh State Board (HPBOSE)', scertChannelIds: [] },
    'Jharkhand':         { primaryLanguage: 'Hindi',     defaultBoard: 'Jharkhand Academic Council (JAC)', scertChannelIds: [] },
    'Karnataka':         { primaryLanguage: 'Kannada',   defaultBoard: 'Karnataka State Board (KSEEB)', scertChannelIds: ['UCEuMGDfGkL_xZqRqpHJ0Kzw', 'UCK0aqc0zr9pJTVmHUAYNiVA'] },
    'Kerala':            { primaryLanguage: 'Malayalam', defaultBoard: 'Kerala State Board (SCERT)',    scertChannelIds: ['UCKe9f9xU4nzXpSoLGFHJLwg'] },
    'Madhya Pradesh':    { primaryLanguage: 'Hindi',     defaultBoard: 'Madhya Pradesh State Board (MPBSE)', scertChannelIds: [] },
    'Maharashtra':       { primaryLanguage: 'Marathi',   defaultBoard: 'Maharashtra State Board (MSBSHSE)', scertChannelIds: ['UCMBqaUcHMZMzPESmB9GXRWA', 'UCrP1-MtNhpHJ2Qf0TdHKS4Q'] },
    'Manipur':           { primaryLanguage: 'Hindi',     defaultBoard: 'Manipur State Board (COHSEM)',  scertChannelIds: [] },
    'Meghalaya':         { primaryLanguage: 'English',   defaultBoard: 'Meghalaya State Board (MBOSE)', scertChannelIds: [] },
    'Mizoram':           { primaryLanguage: 'English',   defaultBoard: 'Mizoram State Board',           scertChannelIds: [] },
    'Nagaland':          { primaryLanguage: 'English',   defaultBoard: 'Nagaland State Board (NBSE)',   scertChannelIds: [] },
    'Odisha':            { primaryLanguage: 'Odia',      defaultBoard: 'Odisha State Board (BSE Odisha)', scertChannelIds: ['UC2y0GHgQ_DTqTsEcT5jJtmQ'] },
    'Punjab':            { primaryLanguage: 'Punjabi',   defaultBoard: 'Punjab State Board (PSEB)',     scertChannelIds: ['UCJJzz4M1KLmWlGWtA2Tze7Q'] },
    'Rajasthan':         { primaryLanguage: 'Hindi',     defaultBoard: 'Rajasthan State Board (RBSE)',  scertChannelIds: ['UCTuJpGBqP7g2UGBV2Q9HPPA'] },
    'Sikkim':            { primaryLanguage: 'English',   defaultBoard: 'Sikkim State Board',            scertChannelIds: [] },
    'Tamil Nadu':        { primaryLanguage: 'Tamil',     defaultBoard: 'Tamil Nadu State Board (SSLC)', scertChannelIds: ['UCN4DCiSAnCg4RnDQzCHf8Kw', 'UCJMpPpRtVGUyMTfH8MVGXCA'] },
    'Telangana':         { primaryLanguage: 'Telugu',    defaultBoard: 'Telangana State Board (TSBIE)', scertChannelIds: ['UCvKo9GHDPWGmK-MBfKFYCYQ', 'UCbA4HlEVXBT-0OfmyAJHxwA'] },
    'Tripura':           { primaryLanguage: 'Bengali',   defaultBoard: 'Tripura State Board (TBSE)',    scertChannelIds: [] },
    'Uttar Pradesh':     { primaryLanguage: 'Hindi',     defaultBoard: 'UP Board (UPMSP)',              scertChannelIds: ['UCnIBBgcY7c5EBuJWCKHLv-w'] },
    'Uttarakhand':       { primaryLanguage: 'Hindi',     defaultBoard: 'Uttarakhand State Board (UBSE)', scertChannelIds: [] },
    'West Bengal':       { primaryLanguage: 'Bengali',   defaultBoard: 'West Bengal State Board (WBBSE)', scertChannelIds: ['UCcZkua98s7EBgM7JvHx_kxA', 'UCWwnQPMqnkUWCt4mUc3acHQ'] },
    'Chandigarh':        { primaryLanguage: 'Hindi',     defaultBoard: 'CBSE',                          scertChannelIds: [] },
    'Jammu and Kashmir': { primaryLanguage: 'Hindi',     defaultBoard: 'JKBOSE',                        scertChannelIds: [] },
    'Ladakh':            { primaryLanguage: 'Hindi',     defaultBoard: 'CBSE',                          scertChannelIds: [] },
    'Puducherry':        { primaryLanguage: 'Tamil',     defaultBoard: 'Puducherry Board',              scertChannelIds: [] },
    'Arunachal Pradesh': { primaryLanguage: 'English',   defaultBoard: 'CBSE',                          scertChannelIds: [] },
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
