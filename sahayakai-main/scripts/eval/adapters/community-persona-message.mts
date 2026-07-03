/**
 * Adapter: generateCommunityPersonaMessage takes POSITIONAL args
 * (persona: PersonaDef, recentMessages, mode) while dataset cases use the
 * flow's flat input schema. Field mapping per the dataset meta.json.
 */
type FlatInput = {
    personaName: string;
    personaState?: string;
    personaSubject?: string;
    personaGradeLevel?: string;
    personaVoiceTone?: string;
    preferredLanguage?: string;
    yearsExperience?: number;
    recentMessages?: unknown[];
    mode?: string;
};

export default async function invoke(mod: Record<string, unknown>, input: unknown): Promise<unknown> {
    const flat = input as FlatInput;
    const persona = {
        id: 'eval-persona',
        avatarSeed: 'eval-persona',
        displayName: flat.personaName,
        state: flat.personaState,
        subject: flat.personaSubject,
        gradeLevel: flat.personaGradeLevel,
        voiceTone: flat.personaVoiceTone,
        preferredLanguage: flat.preferredLanguage,
        yearsExperience: flat.yearsExperience,
    };
    const fn = mod.generateCommunityPersonaMessage as (p: unknown, m: unknown[], mode?: string) => Promise<unknown>;
    // The wrapper already returns PersonaMessageOutput ({ message }) — pass
    // it through untouched so outputScriptFields ["message"] resolves.
    return fn(persona, flat.recentMessages ?? [], flat.mode);
}
