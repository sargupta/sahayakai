// import { Timestamp } from 'firebase-admin/firestore'; // Removed to prevent client bundle crash

export interface Timestamp {
    seconds: number;
    nanoseconds: number;
    toDate: () => Date;
}

// --- Shared Enumerations ---

export const GRADE_LEVELS = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12',
] as const;
export type GradeLevel = typeof GRADE_LEVELS[number];

export const SUBJECTS = [
    'Mathematics', 'Science', 'Social Science',
    'History', 'Geography', 'Civics',
    'English', 'Hindi', 'Sanskrit', 'Kannada',
    'Computer Science', 'Environmental Studies (EVS)', 'General',
] as const;
export type Subject = typeof SUBJECTS[number];

export const DEPARTMENTS = [
    'Science', 'Mathematics', 'Social Science', 'Languages', 'Primary Education', 'Arts & Physical Education', 'Computer Science & Vocational', 'Administration'
] as const;
export type Department = typeof DEPARTMENTS[number];

export const LANGUAGES = [
    'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Malayalam', 'Odia',
] as const;
export type Language = typeof LANGUAGES[number];

export const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    // Union Territories
    'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
    'Andaman and Nicobar Islands', 'Lakshadweep', 'Dadra and Nagar Haveli and Daman and Diu',
] as const;
export type IndianState = typeof INDIAN_STATES[number];

export const EDUCATION_BOARDS = [
    'CBSE', 'ICSE / ISC',
    // State Boards
    'Andhra Pradesh State Board', 'Assam State Board (SEBA)', 'Bihar State Board (BSEB)',
    'Chhattisgarh State Board (CGBSE)', 'Goa Board of Secondary Education',
    'Gujarat State Board (GSEB)', 'Haryana State Board (HBSE)',
    'Himachal Pradesh State Board (HPBOSE)', 'Jharkhand Academic Council (JAC)',
    'Karnataka State Board (KSEEB)', 'Kerala State Board (SCERT)',
    'Madhya Pradesh State Board (MPBSE)', 'Maharashtra State Board (MSBSHSE)',
    'Manipur State Board (COHSEM)', 'Meghalaya State Board (MBOSE)',
    'Nagaland State Board (NBSE)', 'Odisha State Board (BSE Odisha)',
    'Punjab State Board (PSEB)', 'Rajasthan State Board (RBSE)',
    'Tamil Nadu State Board (SSLC)', 'Telangana State Board (TSBIE)',
    'Tripura State Board (TBSE)', 'UP Board (UPMSP)',
    'Uttarakhand State Board (UBSE)', 'West Bengal State Board (WBBSE)',
    'Delhi Board (DBSE)', 'Puducherry Board',
] as const;
export type EducationBoard = typeof EDUCATION_BOARDS[number];

/** Native-script labels for the language picker (tap-to-select UI) */
export const LANGUAGE_NATIVE_LABELS: Record<Language, string> = {
    'English': 'English',
    'Hindi': 'हिंदी',
    'Kannada': 'ಕನ್ನಡ',
    'Tamil': 'தமிழ்',
    'Telugu': 'తెలుగు',
    'Marathi': 'मराठी',
    'Bengali': 'বাংলা',
    'Gujarati': 'ગુજરાતી',
    'Punjabi': 'ਪੰਜਾਬੀ',
    'Malayalam': 'മലയാളം',
    'Odia': 'ଓଡ଼ିଆ',
};

/** Maps state name → the default state board for cascading board selector */
export const STATE_BOARD_MAP: Record<string, string> = {
    'Andhra Pradesh': 'Andhra Pradesh State Board',
    'Assam': 'Assam State Board (SEBA)',
    'Bihar': 'Bihar State Board (BSEB)',
    'Chhattisgarh': 'Chhattisgarh State Board (CGBSE)',
    'Goa': 'Goa Board of Secondary Education',
    'Gujarat': 'Gujarat State Board (GSEB)',
    'Haryana': 'Haryana State Board (HBSE)',
    'Himachal Pradesh': 'Himachal Pradesh State Board (HPBOSE)',
    'Jharkhand': 'Jharkhand Academic Council (JAC)',
    'Karnataka': 'Karnataka State Board (KSEEB)',
    'Kerala': 'Kerala State Board (SCERT)',
    'Madhya Pradesh': 'Madhya Pradesh State Board (MPBSE)',
    'Maharashtra': 'Maharashtra State Board (MSBSHSE)',
    'Manipur': 'Manipur State Board (COHSEM)',
    'Meghalaya': 'Meghalaya State Board (MBOSE)',
    'Nagaland': 'Nagaland State Board (NBSE)',
    'Odisha': 'Odisha State Board (BSE Odisha)',
    'Punjab': 'Punjab State Board (PSEB)',
    'Rajasthan': 'Rajasthan State Board (RBSE)',
    'Tamil Nadu': 'Tamil Nadu State Board (SSLC)',
    'Telangana': 'Telangana State Board (TSBIE)',
    'Tripura': 'Tripura State Board (TBSE)',
    'Uttar Pradesh': 'UP Board (UPMSP)',
    'Uttarakhand': 'Uttarakhand State Board (UBSE)',
    'West Bengal': 'West Bengal State Board (WBBSE)',
    'Delhi': 'Delhi Board (DBSE)',
    'Puducherry': 'Puducherry Board',
};

export const LANGUAGE_CODE_MAP: Record<string, Language> = {
    'en': 'English', 'hi': 'Hindi', 'kn': 'Kannada', 'ta': 'Tamil',
    'te': 'Telugu', 'mr': 'Marathi', 'bn': 'Bengali',
    'gu': 'Gujarati', 'pa': 'Punjabi', 'ml': 'Malayalam', 'or': 'Odia'
} as const;

export const CONTENT_TYPES = [
    'lesson-plan', 'quiz', 'worksheet', 'visual-aid', 'rubric', 'micro-lesson', 'virtual-field-trip', 'instant-answer', 'teacher-training', 'exam-paper',
] as const;
export type ContentType = typeof CONTENT_TYPES[number];

// --- Teacher Career Stage ---
export const ADMINISTRATIVE_ROLES = ['hod', 'coordinator', 'exam_controller', 'vice_principal', 'principal', 'none'] as const;
export type AdministrativeRole = typeof ADMINISTRATIVE_ROLES[number];

export const QUALIFICATIONS = ['D.El.Ed', 'B.Ed', 'M.Ed', 'B.A', 'M.A', 'B.Sc', 'M.Sc', 'NET', 'Ph.D', 'Other'] as const;
export type Qualification = typeof QUALIFICATIONS[number];

export type TeacherCareerStage = 'early' | 'mid' | 'senior' | 'leadership';

export function getCareerStage(yearsOfExperience: number): TeacherCareerStage {
    // Clamp negatives (malformed data) to 0 so they map to 'early'
    const years = Math.max(0, yearsOfExperience);
    if (years <= 3) return 'early';
    if (years <= 7) return 'mid';
    if (years <= 15) return 'senior';
    return 'leadership';
}

// --- Core Entities ---

export interface UserProfile {
    uid: string;
    email?: string;
    phoneNumber?: string;
    displayName: string;
    photoURL?: string;

    // Professional Profile
    schoolName?: string;
    schoolNormalized?: string; // For fuzzy matching
    district?: string;
    pincode?: string;
    state?: string;
    educationBoard?: string;
    verifiedStatus?: 'none' | 'pending' | 'verified';
    bio?: string;
    department?: string;
    designation?: string;
    badges: string[];

    // Experience & Role (Advisory Council features)
    yearsOfExperience?: number;
    administrativeRole?: AdministrativeRole;
    qualifications?: Qualification[];

    gradeLevels: GradeLevel[];
    /** @deprecated Use gradeLevels — kept for backwards compatibility with AI flows */
    teachingGradeLevels?: GradeLevel[];
    subjects: Subject[];
    preferredLanguage: Language;

    // Social Metadata
    followersCount: number;
    followingCount: number;

    // Usage Metadata
    createdAt: Timestamp;
    lastLogin: Timestamp;
    planType: 'free' | 'pro' | 'gold' | 'premium';

    // UX flags
    hasHeardGreeting?: boolean;
    communityIntroState?: 'none' | 'ready' | 'visited';
    groupsInitialized?: boolean;
    groupIds?: string[];

    // Gamification
    impactScore: number;
    contentSharedCount: number;

    // Onboarding generation counter (client-side tracks, periodically syncs)
    aiGenerationCount?: number;

    // Onboarding — progressive disclosure state machine
    onboardingPhase?: 'setup' | 'first-generation' | 'exploring' | 'completing' | 'done';
    onboardingCompletedAt?: Timestamp;
    firstGenerationContentId?: string;
    firstGenerationTool?: ContentType;
    discoveredFeatures?: string[];
    featureSpotlightsSeen?: string[];
    onboardingChecklistItems?: Record<string, boolean>;
    profileCompletionLevel?: 'basic' | 'complete';
    profileCompletionDismissCount?: number;
    checklistDismissedAt?: Timestamp;
}

export interface BaseContent<T = any> {
    id: string;
    type: ContentType;
    title: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Search/Filter Metadata
    gradeLevel: GradeLevel;
    subject: Subject;
    topic: string;
    language: Language;

    // Status
    isPublic: boolean;
    isDraft: boolean;
    deletedAt?: Timestamp | null;  // null = active, set = soft-deleted
    expiresAt?: Timestamp | null;  // TTL field: Firestore auto-purges 30 days after soft-delete

    // Storage
    storagePath?: string; // Path to full JSON/Markdown in Cloud Storage
    data?: T;             // The specific payload (LessonPlanSchema, QuizSchema, etc.)
}

// --- Feature-Specific Schemas ---

export interface LessonPlanSchema {
    title: string;
    gradeLevel?: string;
    duration?: string;
    subject?: string;
    objectives: string[];
    keyVocabulary?: Array<{
        term: string;
        meaning: string;
    }>;
    materials: string[];
    activities: Activity[];
    assessment?: string;
    homework?: string;
}

export interface Activity {
    phase: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
    name: string;
    description: string;
    duration: string;
    teacherTips?: string;
    understandingCheck?: string;
}

export interface QuizSchema {
    format: 'print' | 'interactive';
    questions: Array<{
        id: string;
        text: string;
        type: 'multiple-choice' | 'fill-in-blank' | 'short-answer' | 'true-false';
        options?: string[];
        correctAnswer: string;
        explanation: string;
        difficulty: 'easy' | 'medium' | 'hard';
        bloomsLevel?: string;
    }>;
    answerKey: Record<string, string>;
}

export interface WorksheetSchema {
    sections: Array<{
        title: string;
        instructions: string;
        items: Array<{
            type: 'text' | 'image' | 'drawing_box' | 'lines';
            content: string;
            spaceAllocated: string;
        }>;
    }>;
    layout: 'portrait' | 'landscape';
    theme?: 'minimal' | 'playful';
}

export interface VisualAidSchema {
    imageDataUri?: string; // Optional (not stored in DB, but passed around)
    storageRef?: string;   // Reference to storage path
    pedagogicalContext: string;
    discussionSpark: string;
}

export interface MicroLessonSchema {
    slides: Array<{
        id: string;
        type: 'title' | 'concept' | 'quiz' | 'video' | 'image';
        content: {
            headline: string;
            bodyText: string;
            mediaUrl?: string;
            bulletPoints?: string[];
        };
        script: string;
        duration: number;
    }>;
}

export interface RubricSchema {
    assignmentTitle: string;
    scale: number;
    criteria: Array<{
        name: string;
        weight?: number;
        levels: Array<{
            score: number;
            label: string;
            descriptor: string;
        }>;
    }>;
}

export interface NewsItemSchema {
    id: string;
    title: string;
    summary: string;
    url: string;
    source: string;
    publishedAt: Timestamp;
    tags: string[];
    relevanceScore: number;
}

export interface UserImpactSchema {
    streakDays: number;
    totalContentGenerated: number;
    badges: Array<{
        id: string;
        name: string;
        awardedAt: Timestamp;
        icon: string;
    }>;
    savings: {
        timeSavedHours: number;
        moneySavedINR: number;
    };
}

// --- Notifications ---

export type NotificationType =
    | 'FOLLOW'
    | 'NEW_POST'
    | 'BADGE_EARNED'
    | 'SYSTEM'
    | 'LIKE'            // someone liked your library resource
    | 'RESOURCE_SAVED'  // someone saved your resource to their personal library
    | 'RESOURCE_USED'   // someone clicked "Use This" on your resource (routed to a tool)
    | 'COMMENT'         // future: someone commented on your resource
    | 'CONNECT_REQUEST' // someone sent a connection request — carries metadata.requestId
    | 'CONNECT_ACCEPTED'; // your request was accepted

export interface Notification {
    id: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
    senderId?: string;
    senderName?: string;
    senderPhotoURL?: string;
    link?: string;
    metadata?: Record<string, string>; // e.g. { requestId } for CONNECT_REQUEST actions
    isRead: boolean;
    createdAt: string;
}

// --- Connections ---

// What the current user's relationship with another teacher looks like from their POV
export type ConnectionStatus =
    | 'none'             // no relationship
    | 'pending_sent'     // current user sent a request, awaiting acceptance
    | 'pending_received' // other teacher sent a request to current user
    | 'connected';       // mutual, accepted connection

export interface ConnectionRequest {
    id: string;          // Firestore docId: `{fromUid}_{toUid}`
    fromUid: string;
    toUid: string;
    createdAt: string;
    expiresAt: string;   // 30 days from creation
}

export interface Connection {
    id: string;          // Firestore docId: sorted `{uid1}_{uid2}`
    uids: [string, string]; // both participants — enables array-contains queries
    initiatedBy: string; // who originally sent the request
    connectedAt: string;
}

// Lightweight bundle the client gets in one round-trip for the teacher directory
export interface MyConnectionData {
    connectedUids: string[];
    sentRequestUids: string[];
    receivedRequests: { uid: string; requestId: string }[];
}

export type { Group, GroupMember, GroupPost, GroupChatMessage, PostType, PostAttachment, FeedItem, FeedItemType, ShareTemplate, GroupType } from './community';
