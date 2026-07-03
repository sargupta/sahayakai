/**
 * Typed client wrappers for the profile API routes (tranche 5 migration of
 * src/app/actions/profile.ts). Signatures are IDENTICAL to the old server
 * actions so call sites only change their import path.
 *
 * Error contracts preserved:
 *  - getProfileData / getPublicProfileAction throw only for Forbidden/
 *    Unauthorized/Invalid-target; adapter failures already degrade to
 *    `{ profile: null, certifications: [] }` server-side.
 *  - updateProfileAction / addCertificationAction / markChecklistItemAction
 *    throw ApiError with the service's original message strings.
 *  - lookupSchoolDominantLocationAction returns null on any failure.
 */
import { apiFetch } from '@/lib/api/client';

export async function getProfileData(
    _userId?: string,
): Promise<{ profile: any; certifications: any[] }> {
    const query = _userId ? `?uid=${encodeURIComponent(_userId)}` : '';
    return apiFetch<{ profile: any; certifications: any[] }>(`/api/profile${query}`);
}

export async function getPublicProfileAction(
    targetUid: string,
): Promise<{ profile: any; certifications: any[] }> {
    return apiFetch<{ profile: any; certifications: any[] }>(
        `/api/profile/public/${encodeURIComponent(targetUid)}`,
    );
}

/**
 * Keeps the historic FormData signature (the credential form builds one);
 * fields are transported as JSON.
 */
export async function addCertificationAction(formData: FormData): Promise<void> {
    await apiFetch(`/api/profile/certifications`, {
        method: 'POST',
        body: {
            certName: (formData.get('certName') as string) ?? '',
            issuingBody: (formData.get('issuingBody') as string) ?? '',
            issueDate: (formData.get('issueDate') as string) ?? '',
        },
    });
}

export async function updateProfileAction(
    _userId: string,
    data: any,
): Promise<{ profileCompletionLevel: number }> {
    return apiFetch<{ profileCompletionLevel: number }>(`/api/profile`, {
        method: 'PUT',
        body: { uid: _userId, data },
    });
}

export async function markChecklistItemAction(_userId: string, itemId: string): Promise<void> {
    // Parity with the action: empty itemId is a silent no-op.
    if (!itemId) return;
    await apiFetch(`/api/profile/checklist`, {
        method: 'POST',
        body: { uid: _userId, itemId },
    });
}

export async function lookupSchoolDominantLocationAction(
    schoolName: string,
): Promise<{ state?: string; district?: string; matchCount: number } | null> {
    try {
        const { result } = await apiFetch<{
            result: { state?: string; district?: string; matchCount: number } | null;
        }>(`/api/profile/school-location?schoolName=${encodeURIComponent(schoolName)}`);
        return result;
    } catch {
        // Action contract: lookup failures degrade to null (form just skips
        // the pre-fill).
        return null;
    }
}

export async function getDailyCostsAction(days: number = 7) {
    return apiFetch<any>(`/api/profile/daily-costs?days=${encodeURIComponent(String(days))}`);
}
