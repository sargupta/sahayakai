import { z } from 'genkit';

export const VideoStorytellerInputSchema = z.object({
    subject: z.string().describe('The academic subject taught by the teacher.'),
    gradeLevel: z.string().describe('The target grade level or class (e.g., Class 5, Grade 10).'),
    topic: z.string().optional().describe('An optional specific chapter or topic within the subject.'),
    language: z.string().optional().describe('The preferred language for the content (e.g., Hindi, Tamil, English).'),
    userId: z.string().optional().describe('The ID of the user for personalization context.'),
    state: z.string().optional().describe('The Indian state or UT the teacher is from (e.g., Maharashtra, Tamil Nadu).'),
    educationBoard: z.string().optional().describe('The education board the teacher follows (e.g., CBSE, Maharashtra State Board).'),
});

export const VideoStorytellerOutputSchema = z.object({
    categories: z.object({
        pedagogy: z.array(z.string()).describe('Search queries for government-instructed pedagogy and teaching techniques.'),
        storytelling: z.array(z.string()).describe('Search queries for storytelling videos of chapters/subjects.'),
        govtUpdates: z.array(z.string()).describe('Search queries for personalized government related updates or educational news for teachers.'),
        courses: z.array(z.string()).describe('Search queries for relevant professional development courses for the teacher.'),
        topRecommended: z.array(z.string()).describe('Search queries for top recommended educational content for the subject and class.'),
    }),
    personalizedMessage: z.string().describe('A brief, supportive message explaining why these videos were chosen for this specific teacher.'),
});

export const VideoCandidateSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    channelTitle: z.string(),
    channelId: z.string().optional(),
    thumbnail: z.string(),
    publishedAt: z.string(),
});

export const VideoRankingSchema = z.object({
    rankedVideos: z.array(z.object({
        id: z.string(),
        categoryScores: z.object({
            storytelling: z.number().min(0).max(10),
            pedagogy: z.number().min(0).max(10),
            courses: z.number().min(0).max(10),
            govtUpdates: z.number().min(0).max(10),
            topRecommended: z.number().min(0).max(10),
        }),
        isForTeachers: z.boolean(),
        relevanceReason: z.string().optional(),
    }))
});

export type VideoStorytellerInput = z.infer<typeof VideoStorytellerInputSchema>;
export type VideoStorytellerOutput = z.infer<typeof VideoStorytellerOutputSchema>;
export type VideoCandidate = z.infer<typeof VideoCandidateSchema>;
export type VideoRanking = z.infer<typeof VideoRankingSchema>;
