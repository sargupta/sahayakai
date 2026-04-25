/**
 * POST /api/jobs/grow-persona-pool
 *
 * Generates N new AI teacher personas via Gemini and writes them to:
 *   - `ai_teacher_personas_runtime` (full persona profile)
 *   - `users` (so they are discoverable + can post)
 *
 * Designed to run weekly via Cloud Scheduler so the community feed
 * shows believable organic growth (≈5 new teachers/week → ≈260/year).
 *
 * Query params:
 *   ?count=5   — how many to generate (default 5, max 15)
 *
 * Each generated persona matches the AITeacherPersona schema and gets
 * a unique uid `AI_TEACHER_<slug>` based on the generated displayName.
 *
 * Idempotent on uid collision: if a persona with the same uid already
 * exists we skip and continue, returning a per-persona status array.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AITeacherPersona, getPersonaUserDoc } from '@/lib/ai-teacher-personas';
import { invalidatePersonaCache } from '@/lib/ai-persona-runtime';

export const maxDuration = 180;

const RUNTIME_COLLECTION = 'ai_teacher_personas_runtime';
const MAX_PER_RUN = 15;

const ALLOWED_LANGS = [
    'hindi',
    'english',
    'hinglish',
    'tamil_english',
    'malayalam_english',
    'telugu_english',
    'kannada_english',
] as const;

const ALLOWED_DEMOGRAPHICS = [
    'govt_rural',
    'govt_urban',
    'private_budget',
    'private_mid',
    'private_elite',
    'navodaya',
] as const;

const SUBJECT_OPTIONS = [
    'Mathematics', 'Science', 'EVS', 'Physics', 'Chemistry', 'Biology',
    'English', 'Hindi', 'Sanskrit', 'Tamil', 'Telugu', 'Kannada', 'Malayalam',
    'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu', 'Odia',
    'Social Studies', 'History', 'Geography', 'Civics', 'Economics',
    'Computer Science', 'Information Technology',
    'Physical Education', 'Health Education', 'Art', 'Music',
    'All Subjects', 'Primary Education',
];

const STATE_OPTIONS = [
    'Uttar Pradesh', 'Bihar', 'Maharashtra', 'West Bengal', 'Madhya Pradesh',
    'Tamil Nadu', 'Rajasthan', 'Karnataka', 'Gujarat', 'Andhra Pradesh',
    'Odisha', 'Telangana', 'Kerala', 'Jharkhand', 'Assam', 'Punjab',
    'Haryana', 'Chhattisgarh', 'Delhi', 'Uttarakhand',
    'Himachal Pradesh', 'Tripura', 'Meghalaya', 'Manipur',
];

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function buildSchemaInstruction(count: number): string {
    return `Generate ${count} realistic Indian school teacher personas. Each must be a real-feeling K-12 government or private school teacher.

Return ONLY valid JSON — an array of ${count} persona objects. NO prose, NO markdown fences, NO commentary. Just the JSON array.

Each object MUST have these exact fields:
{
  "displayName": "Realistic Indian full name (first + last). Mix gender, region, religion. Use authentic regional names — e.g. Tamil Nadu: Sundaramurthy, Lakshmi Narayanan; Bengal: Subhadeep Roy, Tanusree Banerjee; Kerala: Geetha Pillai, Joseph Vargese; UP: Anita Verma, Rakesh Yadav; Punjab: Harpreet Singh; Andhra: Venkata Rao. NO repetitive surnames like Sharma/Kumar.",
  "photoSeed": "kebab-case-name-teacher",
  "bio": "<60 char one-liner. Subject | Class range | School type | Years | tagline. Like 'Math | Class 8-10 | Govt Bihar | 12 yrs | mehnat se topper'",
  "subjects": ["1-3 subjects from this list: ${SUBJECT_OPTIONS.join(', ')}"],
  "gradeLevels": ["Subset of: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. Realistic for the subject"],
  "board": "CBSE | ICSE | State Board | Bihar Board | Tamil Nadu State Board | etc",
  "school": "Realistic school name. Mix of: Government High School, Kendriya Vidyalaya, Jawahar Navodaya Vidyalaya, DAV Public School, Delhi Public School, Vidya Mandir, Saraswati Vidyalaya, Holy Cross Convent, Zilla Parishad School, etc.",
  "state": "One of: ${STATE_OPTIONS.join(', ')}",
  "city": "Real Indian city or small-town in that state. Mix metros and smaller towns. Examples: Patna, Sangli, Madurai, Kochi, Lucknow, Indore, Warangal, Bhubaneswar, Coimbatore, Gulbarga, Rajkot.",
  "yearsExperience": "Number 2-30",
  "languages": ["2-3 of: Hindi, English, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Urdu, Sanskrit"],
  "primaryWritingLanguage": "ONE of: ${ALLOWED_LANGS.join(', ')}. Pick based on state — Tamil Nadu => tamil_english; Kerala => malayalam_english; Karnataka => kannada_english; Andhra/Telangana => telugu_english; Bihar/UP/MP/Rajasthan => hinglish or hindi; metros + private_elite => english.",
  "demographic": "ONE of: ${ALLOWED_DEMOGRAPHICS.join(', ')}",
  "teachingPhilosophy": "1-2 sentences in the teacher's own voice. Should hint at how they teach — practical, theoretical, story-based, exam-focused, etc. Use natural code-mixing matching their primaryWritingLanguage.",
  "personalityTraits": ["3-5 short trait words like: warm, strict, mentor-type, impatient with paperwork, methodical, theatrical, soft-spoken"],
  "communicationStyle": "150-250 char description of HOW they type online. Cover: language mix percentages, typical sentence length, quirks (uses '...', uses emojis, never starts with 'Hello'), example phrases they use. Be specific to their region/demographic.",
  "backstory": "2-4 sentences. Real-feeling life context: family, hometown, why they teach, their daily reality. Reference real Indian places, jobs, conditions.",
  "typicalTopics": ["4-6 things they regularly post about. Specific and grounded — not 'sharing tips'. Like 'Class 9 quadratic equation tricks', 'mid-day meal complaints', 'pre-board prep stress'"],
  "quirks": ["3-5 small recurring details. Like 'always references morning chai', 'complains about copy-checking', 'mentions her cycling-to-school routine', 'school peon character recurs'"],
  "adminDuties": ["Optional. For govt teachers only. 2-4 real bureaucratic duties: BRC meetings, MDM monitoring, election duty, SSA paperwork, DIET training, CCE documentation"]
}

CONSTRAINTS:
- All ${count} personas must be DIFFERENT — different names, regions, subjects, demographics, voices.
- Spread across at least 4 different states.
- Spread across at least 3 different demographics.
- Mix male and female names roughly 50/50.
- AT MOST 1 with primaryWritingLanguage="english" (most Indian teachers are not English-first).
- Prefer regional language mixes (hinglish, tamil_english, kannada_english, etc).
- Each persona should feel like a SPECIFIC PERSON, not a template.`;
}

function validatePersona(p: any): { ok: true; persona: AITeacherPersona } | { ok: false; reason: string } {
    if (!p || typeof p !== 'object') return { ok: false, reason: 'not an object' };
    if (!p.displayName || typeof p.displayName !== 'string') return { ok: false, reason: 'missing displayName' };
    if (!Array.isArray(p.subjects) || p.subjects.length === 0) return { ok: false, reason: 'missing subjects' };
    if (!Array.isArray(p.gradeLevels) || p.gradeLevels.length === 0) return { ok: false, reason: 'missing gradeLevels' };
    if (!ALLOWED_LANGS.includes(p.primaryWritingLanguage)) {
        return { ok: false, reason: `bad primaryWritingLanguage: ${p.primaryWritingLanguage}` };
    }
    if (!ALLOWED_DEMOGRAPHICS.includes(p.demographic)) {
        return { ok: false, reason: `bad demographic: ${p.demographic}` };
    }

    const slug = slugify(p.displayName);
    if (!slug) return { ok: false, reason: 'name produced empty slug' };

    const persona: AITeacherPersona = {
        id: slug,
        uid: `AI_TEACHER_${slug}`,
        displayName: p.displayName,
        photoSeed: p.photoSeed || `${slug}-teacher`,
        bio: p.bio || '',
        subjects: p.subjects.map(String).slice(0, 4),
        gradeLevels: p.gradeLevels.map(String).slice(0, 6),
        board: p.board || 'State Board',
        school: p.school || 'Government School',
        state: p.state || 'Uttar Pradesh',
        city: p.city || '',
        yearsExperience: Number.isFinite(p.yearsExperience) ? Number(p.yearsExperience) : 5,
        languages: Array.isArray(p.languages) ? p.languages.map(String) : ['Hindi', 'English'],
        primaryWritingLanguage: p.primaryWritingLanguage,
        demographic: p.demographic,
        teachingPhilosophy: p.teachingPhilosophy || '',
        personalityTraits: Array.isArray(p.personalityTraits) ? p.personalityTraits.map(String) : [],
        communicationStyle: p.communicationStyle || '',
        backstory: p.backstory || '',
        typicalTopics: Array.isArray(p.typicalTopics) ? p.typicalTopics.map(String) : [],
        quirks: Array.isArray(p.quirks) ? p.quirks.map(String) : [],
        ...(Array.isArray(p.adminDuties) && p.adminDuties.length > 0
            ? { adminDuties: p.adminDuties.map(String) }
            : {}),
    };

    return { ok: true, persona };
}

function extractJsonArray(raw: string): any[] | null {
    // Strip common Gemini wrappers — ```json ... ``` and prose around the array.
    let s = raw.trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const first = s.indexOf('[');
    const last = s.lastIndexOf(']');
    if (first < 0 || last < 0 || last <= first) return null;
    try {
        return JSON.parse(s.slice(first, last + 1));
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get('count') ?? '5');
    const count = Math.max(1, Math.min(MAX_PER_RUN, Math.floor(requested)));

    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        // Generate via Gemini.
        const { ai, runResiliently } = await import('@/ai/genkit');
        const result = await runResiliently(async (override) => {
            return ai.generate({
                model: 'googleai/gemini-2.0-flash',
                system: 'You generate realistic Indian school teacher persona profiles for a teacher community platform. Output ONLY valid JSON. No markdown, no commentary.',
                prompt: buildSchemaInstruction(count),
                config: {
                    temperature: 1.0, // Maximum diversity across personas
                    maxOutputTokens: 6000,
                    ...override.config,
                },
            });
        });

        const arr = extractJsonArray(result.text);
        if (!arr) {
            logger.error('grow-persona-pool: Gemini did not return parseable JSON', undefined, 'AI_AGENT', { firstChars: result.text.slice(0, 200) });
            return NextResponse.json({ ok: false, error: 'Gemini returned non-JSON' }, { status: 502 });
        }

        const created: string[] = [];
        const skipped: Array<{ name: string; reason: string }> = [];

        for (const raw of arr) {
            const v = validatePersona(raw);
            if (!v.ok) {
                skipped.push({ name: raw?.displayName ?? '<no name>', reason: v.reason });
                continue;
            }
            const persona = v.persona;

            // Idempotency: skip if uid already exists in either runtime collection or users.
            const runtimeRef = db.collection(RUNTIME_COLLECTION).doc(persona.id);
            const userRef = db.collection('users').doc(persona.uid);
            const [runtimeSnap, userSnap] = await Promise.all([runtimeRef.get(), userRef.get()]);

            if (runtimeSnap.exists || userSnap.exists) {
                skipped.push({ name: persona.displayName, reason: 'already exists' });
                continue;
            }

            await runtimeRef.set(persona);
            await userRef.set(getPersonaUserDoc(persona));
            created.push(persona.displayName);
        }

        invalidatePersonaCache();
        logger.info(`grow-persona-pool: created=${created.length} skipped=${skipped.length}`, 'AI_AGENT');

        return NextResponse.json({
            ok: true,
            requested: count,
            created,
            skipped,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('grow-persona-pool: failed', err, 'AI_AGENT');
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
