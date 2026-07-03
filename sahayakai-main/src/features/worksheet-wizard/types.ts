import { z } from "zod";

export const formSchema = z.object({
    imageDataUri: z
        .string({ required_error: "Please upload an image." })
        .min(1, { message: "Please upload an image." }),
    prompt: z.string().min(10, { message: "Prompt must be at least 10 characters." }),
    language: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

/** The generated worksheet body — markdown string from the flow. */
export type WorksheetResult = string;
