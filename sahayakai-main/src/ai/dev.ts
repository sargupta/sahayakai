import { config } from 'dotenv';
config();

// Telemetry — must init before flows register
import { initTelemetry } from '@/ai/genkit';
initTelemetry();

// AI Flows
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
import '@/ai/flows/exam-paper-generator.ts';
import '@/ai/flows/video-storyteller.ts';
import '@/ai/flows/parent-message-generator.ts';
import '@/ai/flows/parent-call-agent.ts';
import '@/ai/flows/avatar-generator.ts';

// Evaluators
import '@/ai/evaluators/index';

