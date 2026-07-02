#!/usr/bin/env node
// F2-01 repro — getProfilesAction returns FULL user docs to any signed-in caller.
//
// Setup (preview only):
//   PREVIEW_BASE=https://<preview>.run.app
//   IDTOKEN=<minted via Admin SDK custom-token + signInWithCustomToken>
//   TARGET_UID=<any other teacher's uid>
//
// Usage:
//   node qa/forensics/repros/F2-01.mjs
//
// Expected (current behaviour, BUG): response body contains phoneNumber,
// fcmTokens, planType, razorpaySubscriptionId, adminRoles, etc. for TARGET_UID.
//
// Expected (after fix): response body is restricted to the same fields as
// getPublicProfileAction (displayName, photoURL, bio, etc.).

const BASE = process.env.PREVIEW_BASE;
const TOKEN = process.env.IDTOKEN;
const TARGET = process.env.TARGET_UID;

if (!BASE || !TOKEN || !TARGET) {
    console.error('Set PREVIEW_BASE, IDTOKEN, TARGET_UID');
    process.exit(2);
}

// Server Actions are invoked via POST with `Next-Action: <action-id>` and the
// JSON-encoded args in the body. Action ID is build-specific; the production
// fingerprint can be lifted from the browser DevTools "Action" header on a
// genuine community-page request, or by calling through the equivalent
// /api wrapper if one exists. The static finding stands regardless: the
// action's source has no sanitisation and `dbAdapter.getUsers` returns the
// full doc.

const resp = await fetch(`${BASE}/community`, {
    method: 'POST',
    headers: {
        'authorization': `Bearer ${TOKEN}`,
        'content-type': 'text/plain;charset=UTF-8',
        'next-action': '<lifted-action-id-for-getProfilesAction>',
    },
    body: JSON.stringify([[TARGET]]),
});

const text = await resp.text();
console.log('status:', resp.status);
console.log('body:', text.slice(0, 4000));

// Grep for leaked fields:
const sensitive = ['phoneNumber', 'fcmTokens', 'adminRoles', 'razorpaySubscriptionId', 'planType', 'creditsUsed'];
const leaked = sensitive.filter(k => text.includes(k));
if (leaked.length) {
    console.error('LEAKED FIELDS:', leaked);
    process.exit(1);
}
console.log('No sensitive fields detected — fix may be deployed.');
