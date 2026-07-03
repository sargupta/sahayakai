import { z } from "zod";

export const formSchema = z.object({
    assignmentDescription: z
        .string()
        .min(10, { message: "Description must be at least 10 characters." }),
    language: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;
