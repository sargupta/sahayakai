# Lib: Firebase Setup

---

## Client SDK — src/lib/firebase.ts

Initializes Firebase for browser use.

```ts
// Config from env vars (NEXT_PUBLIC_FIREBASE_*)
const app = initializeApp(firebaseConfig);

// Firestore with offline persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()  // multi-tab support
  })
});

const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
```

**Key:** Uses `initializeFirestore` (not `getFirestore`) to enable persistent IndexedDB caching. Multi-tab manager prevents cache conflicts when app is open in multiple tabs.

---

## Admin SDK — src/lib/firebase-admin.ts

Lazy-initialized server-side Admin SDK. Handles secret retrieval.

### Initialization Pattern

```ts
let firebasePromise: Promise<void> | null = null;

async function initializeFirebase(): Promise<void> {
  if (firebasePromise) return firebasePromise;
  firebasePromise = _init().catch(err => {
    firebasePromise = null;  // allow retry on failure
    throw err;
  });
  return firebasePromise;
}

async function _init() {
  // Try env var first
  let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // Fallback: fetch from Google Secret Manager
  if (!serviceAccount) {
    serviceAccount = await fetchFromSecretManager();
  }

  initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
}
```

### Exported Functions (all async)

```ts
export async function getDb(): Promise<Firestore>
export async function getAuthInstance(): Promise<Auth>
export async function getStorageInstance(): Promise<Storage>
```

Always `await getDb()` before using Firestore in server actions. Never import `admin` directly from a server action — use these functions.

---

## Auth Utils — src/lib/auth-utils.ts

Client-side auth utilities.

```ts
// Get current user's ID token (refreshes if needed)
export async function getIdToken(): Promise<string | null>

// Set token in cookie
export function setAuthCookie(token: string): void

// Clear auth cookie on signout
export function clearAuthCookie(): void
```

Token cookie name: `auth-token`. Secure, HttpOnly, SameSite=Strict in production.
