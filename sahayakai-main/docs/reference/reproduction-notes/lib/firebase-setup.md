# Lib: Firebase Setup

**Verified:** 2026-06-10

---

## Client SDK - src/lib/firebase.ts

Initializes Firebase for browser use.

```ts
const app = initializeApp(firebaseConfig);  // config from NEXT_PUBLIC_FIREBASE_* env

// Firestore with persistent multi-tab IndexedDB cache
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage, rtdb };
```

Notes:
- Uses `initializeFirestore` (not `getFirestore`) to enable persistent IndexedDB caching with multi-tab support.
- `authDomain` defaults to `www.sahayakai.com` (`process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "www.sahayakai.com"`) so the auth cookie shares the app's eTLD+1.
- Also exports `rtdb` (Realtime Database handle) alongside Firestore.

---

## Admin SDK - src/lib/firebase-admin.ts

Lazy-initialized server-side Admin SDK. Caches the init promise; on failure it clears the cache so a later call can retry.

### Exported Functions (all async)

```ts
export async function initializeFirebase(): Promise<void>
export async function getDb()              // Firestore
export async function getAuthInstance()    // Admin Auth
export async function getStorageInstance() // Admin Storage
```

Always `await getDb()` (etc.) before use in a server action. Never import `firebase-admin` directly from an action - go through these helpers. Service-account credentials come from `FIREBASE_SERVICE_ACCOUNT_KEY` env, falling back to Google Secret Manager when the env var is absent.

---

## Auth Token Helpers - src/lib/get-auth-token.ts

Client-side ID-token helpers (NOT in `auth-utils.ts`):

```ts
export async function getAuthToken(): Promise<string | null>      // auth.currentUser.getIdToken(), try/catch
export async function forceTokenRefresh(): Promise<string | null> // getIdToken(true)
```

The ID token is attached as `Authorization: Bearer` on API calls and mirrored into the `auth-token` cookie for page/server-action requests.

---

## Admin Check Utils - src/lib/auth-utils.ts

`auth-utils.ts` is the admin-authorization helper (it does NOT mint/clear cookies):

```ts
export async function isAdmin(userId: string): Promise<boolean>
export async function validateAdmin(userId: string): Promise<void>  // throws if not admin
```

Used by admin routes/actions (cost + log dashboards).
