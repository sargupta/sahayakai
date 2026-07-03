import { z } from "zod";

export const formSchema = z.object({
    question: z.string().min(5, { message: "Question must be at least 5 characters." }),
    language: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export type Answer = z.infer<typeof formSchema> & {
    answer: string;
    videoSuggestionUrl?: string;
};
