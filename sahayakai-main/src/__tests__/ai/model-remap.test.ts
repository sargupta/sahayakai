/**
 * GENKIT_MODEL_REMAP: the one place a pinned model name is rewritten for a Google Cloud
 * project that does not serve it (src/ai/genkit.ts).
 *
 * Class gate for "every AI tool answers 404 on this project": flows pin models by name, so
 * GENKIT_DEFAULT_MODEL alone cannot move them. These rules keep the lever safe: it is inert
 * when unset, exact entries win, and `*` never sends an image / speech / embedding model to a
 * text model.
 */
import { parseModelRemap, remapModelName } from '@/ai/model-remap';

describe('GENKIT_MODEL_REMAP', () => {
    it('is empty, and changes nothing, when unset', () => {
        const map = parseModelRemap(undefined);
        expect(map.size).toBe(0);
        expect(remapModelName('vertexai/gemini-2.5-flash', map)).toBe('vertexai/gemini-2.5-flash');
    });

    it('parses pairs and ignores malformed ones', () => {
        const map = parseModelRemap(' a/x = b/y , broken, =z, c/q=d/r ');
        expect([...map.entries()]).toEqual([['a/x', 'b/y'], ['c/q', 'd/r']]);
    });

    it('prefers an exact entry over the wildcard', () => {
        const map = parseModelRemap('googleai/gemini-2.5-pro=vertexai/pro-here,*=vertexai/flash-here');
        expect(remapModelName('googleai/gemini-2.5-pro', map)).toBe('vertexai/pro-here');
        expect(remapModelName('vertexai/gemini-2.5-flash', map)).toBe('vertexai/flash-here');
    });

    it('never sends image, speech or embedding models to the wildcard text model', () => {
        const map = parseModelRemap('*=vertexai/gemini-3-flash-preview');
        for (const name of [
            'googleai/gemini-2.5-flash-image',
            'googleai/gemini-3-pro-image-preview',
            'vertexai/imagen-4',
            'gemini-2.5-flash-tts',
            'vertexai/text-embedding-005',
        ]) {
            expect(remapModelName(name, map)).toBe(name);
        }
    });

    it('remaps an image model only by its exact name', () => {
        const map = parseModelRemap('googleai/gemini-3-pro-image-preview=vertexai/gemini-2.5-flash-image,*=vertexai/t');
        expect(remapModelName('googleai/gemini-3-pro-image-preview', map)).toBe('vertexai/gemini-2.5-flash-image');
    });

    it('passes model references that are not plain names through untouched', () => {
        const map = parseModelRemap('*=vertexai/t');
        const ref = { name: 'vertexai/gemini-2.5-flash' };
        expect(remapModelName(ref, map)).toBe(ref);
        expect(remapModelName(undefined, map)).toBeUndefined();
    });
});
