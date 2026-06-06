#!/usr/bin/env node
// Provision a QA test user against the live sahayakai-b4248 Firebase project.
//
// Usage:
//   node scripts/qa/provision-test-user.mjs \
//     [--uid=<uid>] [--email=<email>] [--password=<pwd>] \
//     [--plan=free|basic|premium|pro|gold] [--role=teacher|principal|vice_principal|admin] \
//     [--state=Karnataka] [--district=Bengaluru] \
//     [--subjects=math,science] [--gradeLevels=6,7,8] \
//     [--schoolName="QA Test School"] [--displayName="QA Tester"] \
//     [--language=en] [--board=cbse]
//
// Emits JSON {uid, email, customToken, idToken, refreshToken, expiresIn} to stdout.
import {
  getAdmin,
  parseArgs,
  randomSuffix,
  FIREBASE_WEB_API_KEY,
  QA_EMAIL_DOMAIN,
  QA_EMAIL_PREFIX,
} from './lib/admin.mjs';

const args = parseArgs(process.argv);

const ts = Date.now();
const rand = randomSuffix();
const email = args.email || `${QA_EMAIL_PREFIX}${ts}-${rand}@${QA_EMAIL_DOMAIN}`;
const plan = (args.plan || 'free').toLowerCase();
const role = (args.role || 'teacher').toLowerCase();
const state = args.state || 'Karnataka';
const district = args.district || 'Bengaluru';
const schoolName = args.schoolName || 'QA Test School';
const displayName = args.displayName || `QA Tester ${rand}`;
const language = args.language || 'en';
const board = args.board || 'cbse';
const subjects = (args.subjects || 'math,science').split(',').map((s) => s.trim()).filter(Boolean);
const gradeLevels = (args.gradeLevels || '6,7,8').split(',').map((s) => s.trim()).filter(Boolean);

const admin = getAdmin();
const auth = admin.auth();
const db = admin.firestore();

async function exchangeCustomTokenForIdToken(customToken) {
  // Firebase Identity Toolkit REST: signInWithCustomToken
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`signInWithCustomToken failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body; // { idToken, refreshToken, expiresIn, ... }
}

async function main() {
  // Create or fetch auth user
  let userRecord;
  if (args.uid) {
    try {
      userRecord = await auth.getUser(String(args.uid));
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }
  }
  if (!userRecord) {
    userRecord = await auth.createUser({
      ...(args.uid ? { uid: String(args.uid) } : {}),
      email,
      emailVerified: true,
      displayName,
      disabled: false,
    });
  }
  const uid = userRecord.uid;

  // Custom claims (plan + role) — middleware reads claim shape; keep both keys for safety
  await auth.setCustomUserClaims(uid, {
    planType: plan,
    plan,
    role,
    qa: true,
  });

  // Firestore users/{uid} doc — onboarding-complete shape
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userDoc = {
    uid,
    email: userRecord.email || email,
    displayName,
    photoURL: '',
    schoolName,
    schoolNormalized: schoolName.toLowerCase().replace(/\s+/g, '-'),
    district,
    state,
    pincode: '560001',
    educationBoard: board.toUpperCase(),
    preferredBoard: board.toLowerCase(),
    verifiedStatus: 'verified',
    bio: 'QA harness user — automated provisioning',
    department: '',
    designation: role === 'teacher' ? 'Teacher' : role.replace(/_/g, ' '),
    badges: [],
    yearsOfExperience: 5,
    administrativeRole: role === 'teacher' ? null : role,
    qualifications: ['B.Ed'],
    gradeLevels,
    teachingGradeLevels: gradeLevels,
    subjects,
    preferredLanguage: language,
    followersCount: 0,
    followingCount: 0,
    createdAt: now,
    lastLogin: now,
    planType: plan,
    hasHeardGreeting: true,
    communityIntroState: 'visited',
    impactScore: 0,
    contentSharedCount: 0,
    onboardingPhase: 'done',
    onboardingCompletedAt: now,
    onboardingComplete: true,
    profileCompletionLevel: 'complete',
    qaTestUser: true,
    qaProvisionedAt: now,
  };
  await db.collection('users').doc(uid).set(userDoc, { merge: true });

  // Mint custom token and exchange for idToken
  const customToken = await auth.createCustomToken(uid, { planType: plan, role, qa: true });
  const exchanged = await exchangeCustomTokenForIdToken(customToken);

  const out = {
    uid,
    email: userRecord.email || email,
    plan,
    role,
    customToken,
    idToken: exchanged.idToken,
    refreshToken: exchanged.refreshToken,
    expiresIn: exchanged.expiresIn,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`[provision-test-user] ${err.stack || err.message || err}\n`);
  process.exit(1);
});
