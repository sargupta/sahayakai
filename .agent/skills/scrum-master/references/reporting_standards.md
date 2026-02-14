# Reporting Standards: The "No-Bull" Policy

## 1. Binary Completion
A task is either `Done` or it is `Not Done`. usage of "Almost done", "99% done", or "Just need to test" is strictly forbidden. If tests aren't passing, it is `0% Done`.

## 2. Explicit Blockers
If you are waiting for user input, file analysis, or an API key, you are **BLOCKED**. 
*   **Action:** Mark task with `[?]` or `BLOCKED` tag.
*   **Action:** Immediately notify the user.

## 3. No Future Tense in "Done"
In the "Accomplished" section of a report, never list things you *plan* to do. Only list things that have been committed to code.

## 4. The "Why" Rule
If a task is delayed or deleted, you must explain *Why* in one sentence.
*   *Bad:* "Skipped styling."
*   *Good:* "De-prioritized styling to focus on core validation logic (ADR-001)."
