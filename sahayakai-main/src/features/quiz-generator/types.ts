import { z } from "zod";
import {
    BarChart2,
    BotMessageSquare,
    Brain,
    BrainCircuit,
    CheckSquare,
    CircleHelp,
    DraftingCompass,
    MessageSquare,
    Pencil,
    Search,
} from "lucide-react";

// labelKey resolved via translate() at render time (Wave 6 i18n).
export const questionTypesData = [
    { id: "multiple_choice", labelKey: "Multiple Choice", icon: BarChart2 },
    { id: "true_false", labelKey: "True/False", icon: CheckSquare },
    { id: "fill_in_the_blanks", labelKey: "Fill in the Blanks", icon: Pencil },
    { id: "short_answer", labelKey: "Short Answer", icon: MessageSquare },
] as const;

export const bloomsLevelsData = [
    { id: "Remember", icon: Brain },
    { id: "Understand", icon: Search },
    { id: "Apply", icon: DraftingCompass },
    { id: "Analyze", icon: BrainCircuit },
    { id: "Evaluate", icon: CircleHelp },
    { id: "Create", icon: BotMessageSquare },
];

export const formSchema = z.object({
    topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
    imageDataUri: z.string().optional(),
    numQuestions: z.coerce.number().min(1).max(20).default(5),
    questionTypes: z
        .array(z.enum(["multiple_choice", "fill_in_the_blanks", "short_answer", "true_false"]))
        .min(1, {
            message: "You have to select at least one question type.",
        }),
    bloomsTaxonomyLevels: z.array(z.string()).optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
    language: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;
