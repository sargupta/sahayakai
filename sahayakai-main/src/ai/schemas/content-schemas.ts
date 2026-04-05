
import { z } from 'zod';

// --- Shared Enums ---

// Retaining Enums for UI usage if needed, but relaxing Schema for DB persistence
export const GradeLevelSchema = z.string();
// Previously: z.enum(['Class 5', ...]) - Relaxed because AI output varies (e.g. "5th Grade")

export const SubjectSchema = z.string();
// Previously: z.enum(['Mathematics', ...]) - Relaxed for flexible AI subjects

export const LanguageSchema = z.string();

// --- Core User Schema ---

export const UserProfileSchema = z.object({
    uid: z.string(),
    email: z.string().email().or(z.literal('')).default(''),
    phoneNumber: z.string().optional(),
    displayName: z.string(),
    photoURL: z.string().optional(),

    // Professional Profile
    schoolName: z.string().optional(),
    teachingGradeLevels: z.array(GradeLevelSchema).default([]),
    subjects: z.array(SubjectSchema).default([]),
    preferredLanguage: LanguageSchema.default('en'),

    // Metadata
    planType: z.enum(['free', 'pro', 'gold', 'premium']).default('free'),
    createdAt: z.string().or(z.date()).optional(), // Helper for date handling
    lastLogin: z.string().or(z.date()).optional(),

    // Gamification
    impactScore: z.number().default(0),
    contentSharedCount: z.number().default(0)
});

// --- Base Content Schema ---

export const ContentTypeSchema = z.enum([
    'lesson-plan', 'quiz', 'worksheet', 'visual-aid',
    'rubric', 'micro-lesson', 'virtual-field-trip', 'instant-answer', 'teacher-training', 'exam-paper'
]);

export const BaseContentSchema = z.object({
    id: z.string().uuid(),
    type: ContentTypeSchema,
    title: z.string(),

    // Metadata
    gradeLevel: GradeLevelSchema,
    subject: SubjectSchema,
    topic: z.string(),
    language: LanguageSchema,

    // Status
    isPublic: z.boolean().default(false),
    isDraft: z.boolean().default(false),

    createdAt: z.string().or(z.date()).optional(),
    updatedAt: z.string().or(z.date()).optional(),

    // Storage
    storagePath: z.string().optional(),
});

// --- Feature-Specific Schemas (Standardized to AI Flow Outputs) ---

// 1. Lesson Plan
export const LessonPlanDataSchema = z.object({
    title: z.string(),
    gradeLevel: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    objectives: z.array(z.string()),
    keyVocabulary: z.array(z.object({
        term: z.string(),
        meaning: z.string(),
    })).nullable().optional(),
    materials: z.array(z.string()),
    activities: z.array(z.object({
        phase: z.enum(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']),
        name: z.string(),
        description: z.string(),
        duration: z.string(),
        teacherTips: z.string().nullable().optional(),
        understandingCheck: z.string().nullable().optional(),
    })),
    assessment: z.string().nullable().optional(),
    homework: z.string().nullable().optional(),
    // Optional field for image context used during generation
    imageDataUri: z.string().optional(),
});

// 2. Quiz
export const QuizDataSchema = z.object({
    title: z.string(),
    questions: z.array(z.object({
        questionText: z.string(),
        questionType: z.enum(['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false', 'multiple-choice', 'fill-in-blank', 'short-answer', 'true-false']),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string(),
        explanation: z.string(),
        difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
        bloomsLevel: z.string().optional(),
    })),
    teacherInstructions: z.string().optional(),
    answerKey: z.record(z.string()).optional(), // Retaining for compatibility if needed
});

// 3. Worksheet
export const WorksheetDataSchema = z.object({
    worksheetContent: z.string(), // Standardized to Markdown output
});

// 4. Visual Aid
export const VisualAidDataSchema = z.object({
    imageDataUri: z.string().optional(), // Base64 (usually in runtime)
    storageRef: z.string().optional(),    // Path in Firebase Storage
    pedagogicalContext: z.string(),
    discussionSpark: z.string(),
    // Legacy mapping
    prompt: z.string().optional(),
    style: z.string().optional(),
    imageUrl: z.string().optional(),
});

// 5. Rubric
export const RubricDataSchema = z.object({
    title: z.string(),
    description: z.string(),
    criteria: z.array(z.object({
        name: z.string(),
        description: z.string(),
        levels: z.array(z.object({
            name: z.string(),
            description: z.string(),
            points: z.number(),
        }))
    }))
});

// 6. Virtual Field Trip
export const VirtualFieldTripDataSchema = z.object({
    title: z.string(),
    stops: z.array(z.object({
        name: z.string(),
        description: z.string(),
        educationalFact: z.string(),
        reflectionPrompt: z.string(),
        googleEarthUrl: z.string(),
    }))
});

// 7. Instant Answer
export const InstantAnswerDataSchema = z.object({
    answer: z.string(),
    videoSuggestionUrl: z.string().nullable().optional(),
    question: z.string().optional(),
    sources: z.array(z.string()).optional(),
});

// 8. Teacher Training
export const TeacherTrainingDataSchema = z.object({
    introduction: z.string(),
    advice: z.array(z.object({
        strategy: z.string(),
        pedagogy: z.string(),
        explanation: z.string(),
    })),
    conclusion: z.string()
});

// 9. Micro Lesson (Placeholder for future)
export const MicroLessonDataSchema = z.object({
    slides: z.array(z.any())
});

// 10. Exam Paper
export const ExamPaperDataSchema = z.object({
    title: z.string(),
    board: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
    duration: z.string(),
    maxMarks: z.number(),
    generalInstructions: z.array(z.string()),
    sections: z.array(z.object({
        name: z.string(),
        label: z.string(),
        totalMarks: z.number(),
        questions: z.array(z.object({
            number: z.number(),
            text: z.string(),
            marks: z.number(),
            options: z.array(z.string()).optional(),
            internalChoice: z.string().optional(),
            answerKey: z.string().optional(),
            markingScheme: z.string().optional(),
            source: z.string().default('AI Generated'),
        })),
    })),
    blueprintSummary: z.object({
        chapterWise: z.array(z.object({ chapter: z.string(), marks: z.number() })),
        difficultyWise: z.array(z.object({ level: z.string(), percentage: z.number() })),
    }),
    pyqSources: z.array(z.object({
        id: z.string(),
        year: z.number().nullable(),
        chapter: z.string(),
    })).optional().describe("PYQ source attributions: which prior-year questions were used or adapted."),
});



// --- Combined Schemas for API Validation ---

export const SaveContentSchema = BaseContentSchema.extend({
    data: z.any().describe("The payload data. Kept as z.any() to flexibly accommodate varied and evolving AI definitions like QuizVariantsOutput, TeacherTrainingOutput, etc.")
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type BaseContent = z.infer<typeof BaseContentSchema>;
export type SaveContentRequest = z.infer<typeof SaveContentSchema>;
