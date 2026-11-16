/**
 * The one authorised real test phone, read only from the operator's shell (RIYA_REAL_TEST_NUMBER).
 *
 * Every script mode that can ring a real phone takes its destination from here, and there is no
 * fallback. The repository is public, so the number is never committed. A made-up stand-in on a
 * real path is worse than no number: the script allow-lists its own value, so the stand-in would
 * really be rung, and a made-up Indian mobile can belong to a stranger.
 * Gate: src/__tests__/scripts/real-call-modes-need-the-operators-number.test.ts.
 *
 * Pure: reads only the env it is given.
 */

export const REAL_TEST_NUMBER_FORMAT = /^\+91[6-9]\d{9}$/;

/** The operator's authorised test phone in E.164, or throws: `mode` names the flag that needs it. */
export function realTestNumber(mode: string, env: Record<string, string | undefined> = process.env): string {
    const number = env.RIYA_REAL_TEST_NUMBER?.trim() ?? '';
    if (!REAL_TEST_NUMBER_FORMAT.test(number)) {
        throw new Error(`${mode} needs RIYA_REAL_TEST_NUMBER in this shell: the one authorised test phone, as +91 and ten digits. Refusing: nothing is dialled or seeded without it.`);
    }
    return number;
}
