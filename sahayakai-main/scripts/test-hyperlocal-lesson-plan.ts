/**
 * Hyperlocal lesson plan smoke test.
 *
 * Runs the lesson plan flow directly against the 4 canonical NCERT
 * demo cases. Bypasses Firestore profile fetch by passing state/
 * district/language explicitly on the input — exercises the same
 * prompt path the API route hits in production.
 */

import 'dotenv/config';
import { generateLessonPlan, type LessonPlanInput } from '../src/ai/flows/lesson-plan-generator';

// Suppress noisy structured logger output during the run
process.env.LOG_LEVEL = 'warn';

interface TestCase {
    label: string;
    expectedAnchor: RegExp;
    input: LessonPlanInput;
}

const CASES: TestCase[] = [
    {
        label: 'Karnataka / Class 5 Science / Gravity / Kannada',
        expectedAnchor: /(ತೆಂಗು|ತೆಂಗಿ|coconut|gravity|ಗುರು|ಜಗ|ಮಲ್ಲಿ|ಆಡು)/i,
        input: {
            topic: 'Gravity',
            language: 'kn',
            gradeLevels: ['Class 5'],
            subject: 'Science',
            resourceLevel: 'low',
            useRuralContext: true,
            state: 'Karnataka',
            district: 'Mysuru',
        },
    },
    {
        label: 'West Bengal / Class 7 Science / Photosynthesis / Bengali',
        expectedAnchor: /(ধান|পাট|সরিষা|paddy|mustard|jute|সুন্দরবন|ক্লোরোফিল|চা)/i,
        input: {
            topic: 'Photosynthesis',
            language: 'bn',
            gradeLevels: ['Class 7'],
            subject: 'Science',
            resourceLevel: 'low',
            useRuralContext: true,
            state: 'West Bengal',
            district: 'Bardhaman',
        },
    },
    {
        label: 'Tamil Nadu / Class 6 Maths / Multiplication with money / Tamil',
        expectedAnchor: /(₹|ரூ|முருக்கு|murukku|கோயம்பேடு|koyambedu|தென்னை|வாழை|தேங்காய்|பழம்|சந்தை)/i,
        input: {
            topic: 'Multiplication with money',
            language: 'ta',
            gradeLevels: ['Class 6'],
            subject: 'Mathematics',
            resourceLevel: 'low',
            useRuralContext: true,
            state: 'Tamil Nadu',
            district: 'Madurai',
        },
    },
    {
        label: 'Punjab / Class 4 Science / Seasons / Punjabi',
        expectedAnchor: /(ਕਣਕ|ਸਰਸੋਂ|ਲੋਹੜੀ|ਵਿਸਾਖੀ|wheat|sarson|lohri|baisakhi|monsoon|ਮਾਨਸੂਨ|ਗੰਨਾ)/i,
        input: {
            topic: 'Seasons',
            language: 'pa',
            gradeLevels: ['Class 4'],
            subject: 'Science',
            resourceLevel: 'low',
            useRuralContext: true,
            state: 'Punjab',
            district: 'Ludhiana',
        },
    },
];

function summarise(plan: any): string {
    // Stitch together the title + first 2 objectives + Engage description
    const parts: string[] = [];
    parts.push(`TITLE: ${plan.title}`);
    if (plan.objectives?.length) {
        parts.push(`OBJECTIVES:\n  - ${plan.objectives.slice(0, 3).join('\n  - ')}`);
    }
    const engage = plan.activities?.find((a: any) => a.phase === 'Engage');
    if (engage) {
        parts.push(`ENGAGE (${engage.name}, ${engage.duration}):\n${engage.description}`);
    }
    const elaborate = plan.activities?.find((a: any) => a.phase === 'Elaborate');
    if (elaborate) {
        parts.push(`ELABORATE (${elaborate.name}):\n${elaborate.description}`);
    }
    return parts.join('\n\n');
}

function verifyFiveE(plan: any): { ok: boolean; missing: string[] } {
    const required = ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'];
    const seen = new Set((plan.activities || []).map((a: any) => a.phase));
    const missing = required.filter(p => !seen.has(p));
    return { ok: missing.length === 0, missing };
}

async function main() {
    console.log(`\nHYPERLOCAL LESSON PLAN SMOKE TEST — ${CASES.length} cases\n`);
    const results: Array<{ label: string; ok: boolean; preview: string; anchorHit: boolean; fiveE: boolean }> = [];

    for (const c of CASES) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`▶ ${c.label}`);
        console.log('='.repeat(80));
        try {
            const t0 = Date.now();
            const plan = await generateLessonPlan(c.input);
            const elapsed = Date.now() - t0;
            const preview = summarise(plan);
            const fullText = JSON.stringify(plan);
            const anchorHit = c.expectedAnchor.test(fullText);
            const fiveE = verifyFiveE(plan);

            console.log(`\n[${elapsed}ms]`);
            console.log(preview);
            console.log(`\n5E phases present: ${fiveE.ok ? 'YES' : 'NO — missing ' + fiveE.missing.join(', ')}`);
            console.log(`Hyperlocal anchor matched: ${anchorHit ? 'YES' : 'NO'}`);

            results.push({
                label: c.label,
                ok: true,
                preview,
                anchorHit,
                fiveE: fiveE.ok,
            });
        } catch (err: any) {
            console.error(`\nFAILED: ${err.message}`);
            console.error(err.stack);
            results.push({ label: c.label, ok: false, preview: err.message, anchorHit: false, fiveE: false });
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log('='.repeat(80));
    for (const r of results) {
        const status = r.ok ? (r.anchorHit && r.fiveE ? 'PASS' : 'PARTIAL') : 'FAIL';
        console.log(`${status}: ${r.label}`);
    }
    process.exit(0);
}

main().catch((e) => {
    console.error('fatal:', e);
    process.exit(1);
});
