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
    /**
     * Whether a real search backend supplied sources for this answer. Only an
     * explicit `true` counts — an older saved answer has no such field, and
     * "unknown" must read as ungrounded rather than as grounded by default.
     */
    grounded?: boolean;
};
