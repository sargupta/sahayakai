/**
 * GENKIT_MODEL_REMAP — rewrite pinned model names for a project that does not serve them.
 *
 * Several flows pin a model by name ('vertexai/gemini-2.5-flash' for the lesson-plan audit and
 * VIDYA, 'googleai/gemini-2.5-pro' for assignment grading …), so GENKIT_DEFAULT_MODEL alone
 * cannot move them. A Google Cloud project that was never granted those models answers 404 and
 * the feature fails although a newer model is available there. This lever rewrites names in one
 * place, at the Genkit boundary (src/ai/genkit.ts):
 *
 *   GENKIT_MODEL_REMAP="googleai/gemini-2.5-pro=vertexai/gemini-3-flash-preview,*=vertexai/gemini-3-flash-preview"
 *
 * `*` catches every other TEXT model named explicitly. Image, speech and embedding models are
 * never caught by `*` — a text model cannot stand in for them — so remap those by exact name.
 * Unset (production) the map is empty and nothing is wrapped or changed.
 */
export function parseModelRemap(raw: string | undefined): Map<string, string> {
    const map = new Map<string, string>();
    for (const pair of (raw ?? '').split(',')) {
        const [from, to] = pair.split('=').map((s) => s.trim());
        if (from && to) map.set(from, to);
    }
    return map;
}

const NON_TEXT_MODEL = /image|imagen|tts|embedding|veo|lyria/i;

/** The model to use instead of `name`; anything that is not a plain model name passes through. */
export function remapModelName(name: unknown, map: Map<string, string>): unknown {
    if (typeof name !== 'string' || map.size === 0) return name;
    const exact = map.get(name);
    if (exact) return exact;
    const wildcard = map.get('*');
    return wildcard && !NON_TEXT_MODEL.test(name) ? wildcard : name;
}
