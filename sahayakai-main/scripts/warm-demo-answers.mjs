#!/usr/bin/env node
/**
 * Pre-generates every ON-SCREEN example once, with exactly the request each page sends, so a
 * demo click is answered at once from the local demo answer cache (src/lib/demo-answer-cache.ts).
 * Local development only (the cache is off elsewhere). Already-cached answers return instantly,
 * so re-running costs nothing. The request shapes mirror the hooks:
 *   lesson plan  use-lesson-plan.ts (template: its class as "Class N"; quick idea: named class or Class 6)
 *   quiz         use-quiz-generator.ts (example's class, else Class 6)
 *   rubric       use-rubric-generator.ts (example's class, else the default Class 7)
 *   instant      use-instant-answer.ts (default Class 6, subject General)
 *
 *   node scripts/warm-demo-answers.mjs [--base http://localhost:3000] [--concurrency 2]
 */
const argv = process.argv.slice(2);
const opt = (f, d) => (argv.includes(`--${f}`) ? argv[argv.indexOf(`--${f}`) + 1] : d);
const BASE = opt('base', 'http://localhost:3000');
const CONCURRENCY = Number(opt('concurrency', '2'));

const classOf = (text, fallback) => {
    const m = text.match(/\b(?:grades?|class(?:es)?|std\.?|standard)\s*(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|graders?|class|std)\b/i);
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 12 ? `Class ${n}` : fallback;
};

// src/data/quick-templates.ts (topic, grade)
const LESSON_TEMPLATES = [
    ['Introduction to Fractions using daily life examples', '5th Grade'],
    ['Identifying 2D shapes (Circle, Square, Triangle) in the classroom', '3rd Grade'],
    ['Understanding Profit and Loss using a village market scenario', '7th Grade'],
    ['How plants make food (Photosynthesis) using sunlight', '7th Grade'],
    ['The Water Cycle: Evaporation, Condensation, Precipitation', '6th Grade'],
    ['Human Digestive System and healthy eating habits', '7th Grade'],
    ['The Solar System: Planets and the Sun', '6th Grade'],
    ['States and Capitals of India', '5th Grade'],
    ['Role and functions of Gram Panchayat in villages', '6th Grade'],
    ['Naming words (Nouns): Person, Place, Animal, Thing', '4th Grade'],
];
// src/components/example-prompts.tsx (English)
const LESSON_IDEAS = [
    'Explain photosynthesis using the example of how Pongal is made.',
    'Why is the sky blue?',
    "A lesson on 'Healthy Food' for grades 1, 2, and 3.",
    "Generate a 5-question quiz about India's history.",
];
const QUIZ = [
    'A quiz about the planets in our solar system.',
    'A short quiz on the Indian independence movement.',
    'A quiz on the major organs of the human body for Grade 5.',
    'A simple quiz on addition and subtraction for 1st graders.',
];
const RUBRIC = [
    'A research project on the Chola Dynasty for 8th grade students.',
    'A storytelling assignment for a 3rd grade class.',
    "A debate on 'Is technology good or bad?' for 10th graders.",
    "A poster-making activity on 'Save Water' for Class 5.",
];
const INSTANT = [
    'Why is the sky blue?',
    'Explain photosynthesis using the example of how Pongal is made.',
    'Tell me about the history of Nalanda University.',
    'What are the major rivers in India?',
];

const lessonBody = (topic, grade) => ({ topic, language: 'en', gradeLevels: [grade], imageDataUri: '', useRuralContext: true, resourceLevel: 'low', difficultyLevel: 'standard' });
const jobs = [
    ...LESSON_TEMPLATES.map(([t, g]) => ['lesson-plan', t, lessonBody(t, classOf(g, 'Class 6'))]),
    ...LESSON_IDEAS.map((t) => ['lesson-plan', t, lessonBody(t, classOf(t, 'Class 6'))]),
    ...QUIZ.map((t) => ['quiz', t, { topic: t, numQuestions: 5, questionTypes: ['multiple_choice', 'short_answer'], bloomsTaxonomyLevels: ['Remember', 'Understand'], gradeLevel: classOf(t, 'Class 6'), language: 'en', useRuralContext: true }]),
    ...RUBRIC.map((t) => ['rubric', t, { assignmentDescription: t, language: 'en', gradeLevel: classOf(t, 'Class 7') }]),
    ...INSTANT.map((t) => ['instant-answer', t, { question: t, language: 'en', gradeLevel: 'Class 6', subject: 'General' }]),
];

let done = 0;
let cached = 0;
let failed = 0;
const started = Date.now();
async function run([feature, label, body]) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const t0 = Date.now();
            const r = await fetch(`${BASE}/api/ai/${feature}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: 'auth-token=dev-token' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(180000),
            });
            await r.arrayBuffer();
            if (r.ok) {
                if (r.headers.get('x-sahayak-demo-cache') === 'hit') cached++;
                done++;
                process.stdout.write(`   ${r.headers.get('x-sahayak-demo-cache') === 'hit' ? 'ready ' : 'warmed'} ${feature.padEnd(14)} ${String(Date.now() - t0).padStart(6)}ms  ${label.slice(0, 60)}\n`);
                return;
            }
            if (attempt === 2) { failed++; process.stdout.write(`   FAILED ${feature} HTTP ${r.status}  ${label.slice(0, 60)}\n`); }
        } catch (e) {
            if (attempt === 2) { failed++; process.stdout.write(`   FAILED ${feature} ${e.message}  ${label.slice(0, 60)}\n`); }
        }
    }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await run(queue.shift()); }));
process.stdout.write(`   demo answers: ${done}/${jobs.length} ready (${cached} were already cached, ${failed} failed) in ${Math.round((Date.now() - started) / 1000)} s\n`);
