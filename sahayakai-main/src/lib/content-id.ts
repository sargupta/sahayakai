/**
 * Stable Library artifact ids.
 *
 * One generation = one Library record. The client mints a `contentId`
 * per user-initiated submit (`useGenerator` with `persistsArtifact`) and
 * sends it with the generation request. The server files the artifact
 * under that id (`users/{uid}/content/{contentId}`), and the display's
 * Save button upserts the SAME id. Before this, the flow's automatic
 * save used UUID A and every Save click minted UUID B, C, …
 *
 * A retry of the same submit, or the canary-mode background Genkit run
 * racing the sidecar persist, also collapse onto one row because
 * `dbAdapter.saveContent` is `set(..., { merge: true })`.
 *
 * Only a well-formed UUID is accepted. The id addresses a doc inside the
 * caller's own `users/{uid}/content` subcollection, so a client can at
 * worst overwrite its own row — the same capability `/api/content/save`
 * already grants. Non-UUID ids (e.g. `saved_*` community pointers) are
 * never reachable through this path.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isContentId(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value);
}

/** The caller-supplied id when it is a valid UUID, otherwise a fresh one. */
export function resolveContentId(candidate: unknown): string {
    return isContentId(candidate) ? candidate : crypto.randomUUID();
}
