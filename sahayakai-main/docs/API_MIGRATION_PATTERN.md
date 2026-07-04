# Server-action → API-route migration pattern (tranche 5)

Founder-ratified: **API routes are the single backend boundary.** Mobile
(Flutter, P1) consumes the same surface. No new files in `src/app/actions/`
(CI Gate 10 enforces this); existing modules migrate out using this pattern.

## Per action-function recipe

1. **Route**: `src/app/api/<domain>/<resource>/route.ts` (RESTish nouns;
   one route file may host GET/POST/PUT/DELETE for a resource).
2. **Auth**: read `const userId = req.headers.get('x-user-id')` — set only
   by the middleware after Firebase token verification. Missing → 401.
   NEVER trust ids from the body for authorization; ownership checks stay
   exactly as strict as the action they replace (F1/F2 forensic fixes must
   survive verbatim).
3. **Validation**: Zod-parse the body/search-params at the top:
   `const parsed = Schema.safeParse(await req.json().catch(() => null));`
   → 400 with `{ error }` on failure. Reuse existing schemas from
   `src/types` / flow files when they exist.
4. **Logic**: move the action body into `src/server/<domain>.ts`
   (plain server module, takes `userId` + validated input). The route is a
   thin shell: auth → validate → call service → JSON. If other server code
   imported the action, point it at the service module.
5. **Response**: `NextResponse.json(data)`; errors
   `NextResponse.json({ error: '<safe message>' }, { status })` — never leak
   internals; keep messages consistent with the old action's error strings
   where client code matches on them.
6. **Client**: replace the action import with `apiFetch` from
   `@/lib/api/client` (typed): a small typed wrapper per domain in
   `src/lib/api/<domain>.ts` exporting functions with the SAME signatures
   the components already call — components change imports, not logic.
7. **Caching semantics**: server actions ran on POST semantics; reads that
   used `unstable_cache` keep their caching inside the service module.
   `revalidatePath` calls: replace with the equivalent client-side refresh
   the page already performs (or router.refresh() at the call site) — note
   each in the PR description.
8. **Tests**: existing `src/__tests__/actions/<x>.test.ts` migrate to
   `src/__tests__/api/<domain>/…` targeting the service/route (keep every
   security assertion; the forensic F-series tests are the spec). Add a 401
   no-header test per route.
9. **Delete** the migrated functions from the action module; delete the
   module when empty. `middleware.ts` public-route lists and rate limits
   apply automatically to `/api/*` — check the route is NOT accidentally in
   a public list.

## Auth edge cases

- Actions that read `x-user-email` / `x-user-name` (auth.ts sync): the same
  headers are set by middleware for API routes too — same trust model.
- Cron/admin-only actions: keep the existing `cron-auth.ts` /
  admin-claim checks — copy them into the route unchanged.
