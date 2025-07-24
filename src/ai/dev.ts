import { config } from 'dotenv';
config();

import '@/ai/flows/voice-to-text.ts';
import '@/ai/flows/lesson-plan-generator.ts';
import '@/ai/flows/visual-aid-designer.ts';
import '@/ai/flows/instant-answer.ts';
import '@/ai/tools/google-search.ts';
