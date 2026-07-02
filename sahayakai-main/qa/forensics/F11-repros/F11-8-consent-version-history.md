# F11-8 — Consent version-bump overwrites prior acceptance without history

**Severity:** P2
**Class:** compliance evidence

## Repro
1. User accepts `PRIVACY_VERSION = '2026-04-24-v1'` on 2026-04-25. Stored: `privacyAcceptedAt = 2026-04-25`, `privacyVersion = '2026-04-24-v1'`.
2. SahayakAI bumps `PRIVACY_VERSION` to `'2026-08-01-v2'` (privacy page reworded).
3. User next visits `/privacy-for-teachers`. The form prompts to re-accept (assumption — the page would gate on version mismatch).
4. User clicks Accept. `consent-form.tsx:96-99`:
   ```ts
   await updateProfileAction(user.uid, {
       privacyAcceptedAt: now,
       privacyVersion: PRIVACY_VERSION,
   });
   ```
5. Old `privacyAcceptedAt` (the v1 acceptance) is **overwritten**.

## Result
- No record that the user ever accepted v1.
- If a regulator or the user themselves asks "what did I agree to and when?", the answer is "v2, today" — the v1 history is gone.

## Fix
On every acceptance, additionally append an immutable record to `users/{uid}/privacyAcceptances/{autoId}`:
```ts
{ acceptedAt, version, ip?, userAgent? }
```
The mirror on the user doc stays (fast read), but the subcollection is the legal record.
