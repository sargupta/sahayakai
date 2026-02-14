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

export const LANGUAGE_CODE_MAP: Record<string, Language> = {
    'en': 'English', 'hi': 'Hindi', 'kn': 'Kannada', 'ta': 'Tamil',
    'te': 'Telugu', 'mr': 'Marathi', 'bn': 'Bengali',
    'gu': 'Gujarati', 'pa': 'Punjabi', 'ml': 'Malayalam', 'or': 'Odia'
} as const;

export const CONTENT_TYPES = [
    'lesson-plan', 'quiz', 'worksheet', 'visual-aid', 'rubric', 'micro-lesson', 'virtual-field-trip', 'instant-answer', 'teacher-training',
] as const;
export type ContentType = typeof CONTENT_TYPES[number];

// --- Core Entities ---

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;

    // Professional Profile
    schoolName?: string;
    schoolNormalized?: string; // For fuzzy matching
    district?: string;
    pincode?: string;
    verifiedStatus?: 'none' | 'pending' | 'verified';
    bio?: string;
    department?: string;
    designation?: string;
    badges: string[];

    teachingGradeLevels: GradeLevel[];
    subjects: Subject[];
    preferredLanguage: Language;

    // Social Metadata
    followersCount: number;
    followingCount: number;

    // Usage Metadata
    createdAt: Timestamp;
    lastLogin: Timestamp;
    planType: 'free' | 'pro' | 'institution';

    // Gamification
    impactScore: number;
    contentSharedCount: number;
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
