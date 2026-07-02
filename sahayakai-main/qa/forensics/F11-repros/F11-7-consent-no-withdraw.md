# F11-7 — Consent has no withdrawal path

**Severity:** P2
**Class:** compliance / DPDP

## Repro
1. Visit `/privacy-for-teachers`, accept.
2. `users/{uid}.privacyAcceptedAt` + `privacyVersion` are set.
3. As a user, attempt to withdraw consent.

## Result
There is no UI to clear these fields. `PrivacyConsentForm` only renders an Accept button (and a "you accepted on …" status when set). The action layer would not allow clearing them via the standard path because:
- `updateProfileAction` does write through the allowlist, and both keys are in it, but
- there is no UI page that calls it with `{ privacyAcceptedAt: null, privacyVersion: null }`.

## DPDP impact
The DPDP Act 2023 (India) §6(4) and GDPR Art. 7(3) require withdrawal to be as easy as consent. Currently it isn't — withdrawal needs a server-side admin operation.

## Fix
- Add a "Withdraw consent" button to `/privacy-for-teachers/consent-form.tsx` (visible when `acceptedAt` is set).
- Server-side: when withdrawal is recorded, append `{ acceptedAt, version, withdrawnAt: now }` to a `privacyAcceptances` subcollection, AND null the mirror on the user doc.
- Block AI tool access while `privacyAcceptedAt` is null.
