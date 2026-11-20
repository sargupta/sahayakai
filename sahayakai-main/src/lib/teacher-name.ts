/**
 * The name a greeting addresses the signed-in teacher by: the first word of
 * the saved profile name, else of the sign-in account's name (the source the
 * sidebar's account row uses). Returns null when neither holds a usable name,
 * so the caller picks its own fallback ("Teacher", translated).
 */
export function greetingFirstName(
    profileName: string | null | undefined,
    accountName: string | null | undefined,
): string | null {
    for (const raw of [profileName, accountName]) {
        const first = raw?.trim().split(/\s+/)[0]?.replace(/[.,]+$/, "");
        if (first) return first;
    }
    return null;
}
