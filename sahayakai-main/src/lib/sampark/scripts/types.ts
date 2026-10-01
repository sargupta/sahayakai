/**
 * Types shared by the Sampark script modules. `AudienceLabel` is re-exported
 * from `render.ts`, which is where the build contract (SLICE1_CONTRACT §4)
 * declares it.
 */

/** Who a class-wide notice is addressed to. Never names a child (plan §1, principle 2). */
export type AudienceLabel = { kind: 'school' } | { kind: 'section'; grade: number; section: string };

/** A fact the template cannot say (bad date, minute not 0/30, unknown venue …). Thrown, never spoken. */
export class ScriptRenderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScriptRenderError';
    }
}
