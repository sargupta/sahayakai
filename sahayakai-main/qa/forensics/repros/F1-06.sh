#!/usr/bin/env bash
# F1-06 — syncUserAction trusts client-supplied email. NOT a curl repro; requires a real session.
# Steps:
#  1. Sign in as user A (verified via Firebase, real email a@x.com)
#  2. From browser devtools, invoke the server action with:
#       syncUserAction({ uid: A_UID, email: "victim@school.org", displayName: "...", photoURL: "..." })
#  3. Read Firestore: db.collection('users').doc(A_UID).get() → email field is now "victim@school.org"
#  4. Confirm via Admin SDK that auth.getUser(A_UID).email is still a@x.com (token claim is untouched)
# Source: src/app/actions/auth.ts:23-58
echo "Manual repro — see comment block." 1>&2
