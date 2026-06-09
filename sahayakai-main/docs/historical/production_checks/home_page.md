# Production Safety Check: Home Page

**Date**: Dec 15, 2025

## 6.1 Failure State Visibility
-   **Rate Limit Hit**: Verified. Limits to 5 requests/10min. Shows "Slow Down" toast.
-   **Safety Violation**: Verified. Shows "Topic Rejected" toast for blocked keywords.
-   **Network Error**: Handled by existing `useEffect` offline listener (shows "You are Offline" toast).
-   **Backend Error**: `useLessonPlan` catch block shows "Generation Failed" toast.

## 6.2 Rollback Path
-   **Client Logic**: Features are contained in `use-lesson-plan.ts` (safety) and `page.tsx` (UI).
-   **Toggle**: Safety features can be disabled by setting `SAFETY_CONFIG.MAX_REQUESTS` to infinity in `src/lib/safety.ts`.

## 6.3 Logs & Observability
-   **Console Logs**: Rate limiter errors are logged. Telemetry events are queued in IndexedDB.
-   **Privacy**: PII is scrubbed from cache keys (verified in `src/app/actions/lesson-plan.ts`).
