/**
 * A Storage object path that belongs to `userId`: `users/<userId>/...`.
 *
 * Every server writer of a content `storagePath` (the generation flows and
 * /api/content/save) puts the file under `users/<uid>/`. A path that does not
 * is client-supplied and must never be signed, downloaded or exported: it
 * would let any signed-in user read another user's (or any) bucket object by
 * saving a library item that points at it.
 */
export function isOwnedStoragePath(userId: string, path: unknown): path is string {
    if (typeof userId !== 'string' || !userId || userId.includes('/')) return false;
    if (typeof path !== 'string' || path.length > 1024) return false;
    if (path.includes('..') || path.includes('\\') || path.includes('//') || /[\u0000-\u001f%]/.test(path)) return false;
    const prefix = `users/${userId}/`;
    return path.startsWith(prefix) && path.length > prefix.length;
}
