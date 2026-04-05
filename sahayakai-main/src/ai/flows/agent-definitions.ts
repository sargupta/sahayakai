import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the possible agent types
const AgentTypeSchema = z.enum([
  'lessonPlan',
  'quiz',
  'visualAid',
  'worksheet',
  'virtualFieldTrip',
  'teacherTraining',
  'rubric',
  'examPaper',
  'instantAnswer',
  'videoStoryteller',
  'unknown'
]);

// Input schema for the router
const AgentRouterInputSchema = z.object({
  prompt: z.string().describe('The user request.'),
  language: z.string().optional().describe('The language of the request.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the content.'),
  imageDataUri: z.string().optional().describe('An optional image data URI.'),
  userId: z.string().optional().describe('The ID of the user.'),
});
export type AgentRouterInput = z.infer<typeof AgentRouterInputSchema>;

// Output schema for the router
const AgentRouterOutputSchema = z.object({
  type: AgentTypeSchema.describe('The type of agent that handled the request.'),
  topic: z.string().optional().describe('The extracted topic.'),
  gradeLevel: z.string().optional().describe('The extracted grade level (e.g., "Class 7").'),
  subject: z.string().optional().describe('The extracted subject.'),
  language: z.string().optional().describe('The detected language.'),
  result: z.any().describe('The output from the selected agent.'),
});
export type AgentRouterOutput = z.infer<typeof AgentRouterOutputSchema>;


// 1. Determine the user's intent and extract parameters
const intentPrompt = ai.definePrompt({
  name: 'intentClassifier',
  input: { schema: z.object({ prompt: z.string() }) },
  output: {
    schema: z.object({
      intent: AgentTypeSchema,
      topic: z.string().optional(),
      gradeLevel: z.string().optional(),
      subject: z.string().optional(),
      language: z.string().optional()
    })
  },
  prompt: `Analyze the user prompt to determine the intended tool and extract key parameters.
  
        INTENT CLASSIFICATION:
        - 'lessonPlan': Creating lessons, lesson plans (लेसन प्लान), unit plans, "teach this", "help me teach".
        - 'quiz': Creating quizzes (क्विज), tests, assessments, exam questions.
        - 'visualAid': finding/creating images, diagrams (चित्र), flashcards.
        - 'worksheet': Creating worksheets, exercises, assignments.
        - 'virtualFieldTrip': Planning virtual field trips, "take me to...".
        - 'teacherTraining': Professional development, classroom management (मैनेजमेंट), coaching.
        - 'rubric': Creating grading rubrics, assessment criteria.
        - 'examPaper': Creating board exam papers, question papers (प्रश्न पत्र), "CBSE paper", "board pattern paper", "sample paper", "previous year paper", "model paper", "pre-board paper".
        - 'instantAnswer': Direct questions (What is...), definitions, quick facts.
        - 'videoStoryteller': Finding educational videos, YouTube.
        - 'unknown': If the intent is unclear or just a greeting.

        PARAMETER EXTRACTION:
        - topic: The core subject matter. STRIP conversational markers (e.g., "Hey", "Can you make", "कसा है") and metadata that belongs in other fields (e.g., strip "Class 5" if gradeLevel is Class 5).
        - gradeLevel: Mandatory "Bharat-First" mapping. You MUST map "grade X", "class X", "कक्षा X", or "Xth grade" to "Class X" format. Valid: "Class 1" to "Class 12".
        - subject: The academic subject area.
        - language: The language requested. Map to codes: hi (Hindi), en (English), bn, te, mr, ta, gu, kn, pa, ml.

        SPECIAL INSTRUCTION FOR CONVERSATIONAL HINDI/URDU:
        - Handle mixed scripts (Devanagari/Perso-Arabic) and colloquialisms (e.g., "banana hai", "chahiye", "de sakti ho").
        - If the user asks for a specific tool (e.g., "lesson plan") but provides no topic, set intent correctly but topic to null.

        Prompt: {{{prompt}}}

        Prompt: {{{prompt}}}
        `,
});

// The main router flow
export const agentRouterFlow = ai.defineFlow(
  {
    name: 'agentRouter',
    inputSchema: AgentRouterInputSchema,
    outputSchema: AgentRouterOutputSchema,
  },
  async (input) => {
    const { runResiliently } = await import('@/ai/genkit');
    // 1. Determine the user's intent
    const { output: intentOutput } = await runResiliently(async (resilienceConfig) => {
      return await intentPrompt({ prompt: input.prompt }, resilienceConfig);
    }, 'intent.classify');

    const intent = intentOutput?.intent || 'unknown';
    const topic = intentOutput?.topic;
    const gradeLevel = intentOutput?.gradeLevel;
    const subject = intentOutput?.subject;
    const language = intentOutput?.language;

    // The actual execution or navigation logic will be handled by the server action
    // that calls this flow (or by the client using the returned type).
    // For now, this flow just returns the intent and extracted params.

    return {
      type: intent,
      topic,
      gradeLevel,
      subject,
      language,
      result: null,
    };
  }
);