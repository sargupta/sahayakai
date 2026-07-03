/**
 * Notification type constants — re-exports the source-of-truth enum from
 * `@/types` and provides string-literal helpers for the group-related
 * notification kinds used by `src/server/groups.ts`.
 *
 * Adding a new NotificationType:
 *   1. Add it to the union in `src/types/index.ts`.
 *   2. Add a constant here so call sites can `import { NEW_GROUP_POST } from
 *      '@/lib/notifications/types'` instead of stringly-typing it.
 *   3. Add an i18n dict entry in `./i18n.ts` for all 11 supported languages.
 */

import type { NotificationType } from '@/types';

export type { NotificationType };

// Group activity notification types — used by createGroupPostAction and
// likeGroupPostAction. Kept as `as const` so TS infers the literal type,
// not `string`, when these are passed to createNotification.
export const NEW_GROUP_POST = 'NEW_GROUP_POST' as const satisfies NotificationType;
export const GROUP_POST_LIKE = 'GROUP_POST_LIKE' as const satisfies NotificationType;
