import { config } from 'dotenv';
config();

import '@/ai/flows/voice-to-text.ts';
import '@/ai/flows/lesson-plan-generator.ts';
import '@/ai/flows/visual-aid-designer.ts';
import '@/ai/flows/instant-answer.ts';
import '@/ai/tools/google-search.ts';
import '@/ai/flows/worksheet-wizard.ts';
import '@/ai/flows/virtual-field-trip.ts';
import '@/ai/flows/teacher-training.ts';
import '@/ai/flows/rubric-generator.ts';
import '@/ai/flows/quiz-generator.ts';
import '@/ai/schemas/quiz-generator-schemas.ts';
import '@/ai/flows/avatar-generator.ts';
