# SahayakAI Flutter — Handoff (owner actions)

Everything here needs your Google/Firebase accounts and cannot be automated. The app builds, tests,
and renders without it; these unlock live auth + data.

## 1. Firebase wiring (unblocks every network call)
The app currently runs on a **stub auth layer**: `tokenProvider` returns null → no `Authorization:
Bearer` header → middleware injects no `x-user-id` → **every API call 401s at runtime**. UI, DTOs,
error states and tests are all complete and green; only the live wiring waits on this.

Steps:
1. `dart pub global activate flutterfire_cli`
2. `flutterfire configure --project=sahayakai-b4248` → generates `lib/firebase_options.dart` +
   `android/app/google-services.json`.
3. Add deps: `firebase_core`, `firebase_auth`, `firebase_app_check`, `google_sign_in`.
4. Register the Android app `com.sargvision.sahayakai` in Firebase and add its **SHA-1 + SHA-256**
   (from the release keystore) — required for Google Sign-In.
5. Enable **Play Integrity** App Check for the app; keep App Check in **monitor / soft-enforce**
   until verified, or protected routes will hard-block.
6. Replace the stub `tokenProvider` with the real Firebase ID token, and the stub auth controller
   with `firebase_auth` state. Call sites are marked with TODOs.

## 2. Delete-account needs REAL re-auth (not forceRefresh) — important
`POST /api/user/delete-account` checks the ID token's **`auth_time` <= 5 minutes**.
`getIdToken(forceRefresh: true)` mints a new token but **carries the original `auth_time`**, so it
will still be rejected. The real flow must call `reauthenticateWithCredential(...)` before deleting.
Documented at the call site in `lib/features/settings/`.
- Re-auth failure surfaces as **401 `reauth_required`** (not 403). The route has **no 429**.

## 3. Backend contract gotchas already handled (do not "fix" these)
- **Profile board field is `preferredBoard`, NOT `educationBoard`.** The route's allowlist accepts
  only `preferredBoard` and mirrors it into `educationBoard` server-side. Sending `educationBoard`
  is **silently dropped** — the save appears to succeed and changes nothing. Pinned by a test.
- **Quiz question field is `questionType`, not `type`** (per the backend Zod schema).
- `EDUCATION_BOARDS` is **29** entries.
- `targetDifficulty: null` on quiz is what returns all three difficulty variants.

### Library / recent work (`GET /api/content/list`) — found while building P0.3, verified against `route.ts`

The endpoint SCREEN_INVENTORY never names. §P0.3 says the dashboard reads "recent content (library
list, see P1.9)" and there IS no P1.9 (the library is P1.7), and neither section gives a path or a
contract. It is `GET /api/content/list`, and it is what the web's own `content-gallery.tsx` calls
with a plain `Authorization: Bearer` header.

- **`limit` is `.max(20)`, and the route's OWN swagger comment saying "max 50" is WRONG.** The Zod
  schema is `z.coerce.number().min(1).max(20).default(20)`, and `.max()` does not clamp — it
  **rejects**. `?limit=50` returns **400 Invalid Query Parameters**, not 20 items. A client that
  trusted the documented maximum would break its own library screen. `LibraryRepository` clamps to
  20; pinned by a test.
- **The `type` enum has 11 members, not the 8 the swagger comment lists.** `ContentTypeSchema` adds
  `teacher-training`, `exam-paper` and `assessment`. The Zod enum is the truth; all 11 are pinned by
  a test.
- **NOT wrapped in `withPlanCheck`** — unlike every AI endpoint. It reads `x-user-id` directly and
  meters nothing, so there is **no 403 `PLAN_UPGRADE_REQUIRED` and no 429**. Only 401 / 400 / 500.
  Reading your own work is not a metered feature; do not add upgrade or limit states to it.
- Response is `{ items, count, nextCursor }`. `nextCursor` is an **explicit `null`** on the last
  page, not an absent key. `count` is just `items.length` computed server-side — deliberately not
  modelled, so the view cannot disagree with itself.
- `createdAt` arrives as an **ISO 8601 string** (every item is run through `dbAdapter.serialize`,
  which converts Firestore's `{_seconds, _nanoseconds}`), and `BaseContentSchema` marks it optional.
- Soft-deleted items are filtered server-side, so the client needs no `deletedAt` handling.

### Onboarding routing — found while building P0.2, verified against the handlers

- **`GET /api/auth/profile-check?uid=<uid>` is PUBLIC and takes the uid as a QUERY PARAM**, not a
  Bearer token. That is deliberate (it runs immediately after Firebase sign-in, before the app has a
  session), and the route carries a written note accepting the account-enumeration tradeoff. It
  returns `{exists, onboardingComplete}` and is the **only** read that can answer "is this teacher
  new" — there is no `GET /api/user/profile`. It is the seam for sending a RETURNING teacher
  straight to the dashboard instead of to setup; the TODO is on `LoginScreen.destinationFor`.
- **Do NOT call `POST /api/profile/mark-complete` from Flutter.** Its primary effect is issuing the
  httpOnly `sahayakai_profile_complete` cookie that feeds the **Next middleware page gate** — which
  a dio client neither receives usefully nor needs, and which is default-off anyway
  (`ONBOARDING_GATE_ENABLED`). It also **404s** for a teacher with no document and **422
  `PROFILE_INCOMPLETE`** below its 80% threshold. Two ways to fail at something the app is not doing.
- **The onboarding gate must never be re-created client-side.** `src/middleware.ts` still carries the
  incident note: shipping it cookie-only on 2026-06-08 locked out the ENTIRE existing user base.
  Pinned by the `no hard gate` group in `test/features/onboarding/onboarding_screen_test.dart`.
- `computeProfileCompletion` scores **`gradeLevels`**, while `POST /api/user/profile` reads
  **`teachingGradeLevels`** — another arm of the wire-name trap below. The document lane writes
  `gradeLevels`, which is the key that scores. (Confirms the existing P0.8 decision.)

### Login (P0.2) — Google branding asset still needed

The sign-in button uses a Lucide `logIn` glyph as a placeholder. **Lucide has no Google mark**, and
Google's branding terms require their own asset on a Google sign-in button. Ship the official asset
together with the real `google_sign_in` wiring (§1).

### Profile (`users/<uid>`) — found while building P0.8, all verified against the handlers

- **There is NO `GET /api/user/profile`.** The route exposes only `POST` and `PATCH`. The web reads
  the profile through the `getProfileData` **server action** (Next's RSC protocol — a build-specific
  `Next-Action` id, not a stable HTTP contract), which Flutter cannot call. `/api/auth/profile-check`
  returns `{exists, onboardingComplete}` only. So the read is a **direct `users/<uid>` client-SDK
  read**, which `firestore.rules` explicitly allows (`allow read: if isOwner(userId)`). It is behind
  the `ProfileDocSource` seam, pending Firebase.
- **NEVER call `POST /api/user/profile` from the app.** It is unsafe for a profile editor on three
  counts, all verified in `route.ts`:
  1. It Zod-parses through `UserProfileSchema`, which has **no `state`, `district`, `pincode` or
     `boardCategory` key**. Zod strips unknown keys, so those fields are dropped **silently**.
  2. Its schema defaults are applied on every call and written through `dbAdapter.createUser` — a
     `set(merge:true)` that, unlike `updateUser`, does **not** pass the client allowlist. A body
     without `planType` writes `planType: 'free'`, plus `impactScore: 0` and
     `contentSharedCount: 0`. **Saving a display name would downgrade a paying teacher and zero
     their impact score.**
  3. It reads grades from **`teachingGradeLevels`** only; sending `gradeLevels` wipes them to `[]`.
- **`boardCategory` is not a persisted field.** Nothing writes it and nothing stores it (absent from
  `UserProfileSchema`, the PATCH allowlist, `PROFILE_WRITABLE_FIELDS` and the adapter's
  `CLIENT_EDITABLE_USER_FIELDS`); the web keeps it in local React state as a cascading-picker
  helper. SCREEN_INVENTORY P0.2 listing it as a profile field is wrong. It is UI-only here
  (`BoardCategory`, derived from the board on read).
- **`administrativeRole` can only be written over PATCH.** It is in `firestore.rules`'
  `protectedUserFields()`, so a client-SDK write carrying it is rejected — and would take the whole
  merge down with it. Hence the profile save's two lanes (see `ProfileRepository`).
- **`INDIAN_STATES` is 36, not 35.** SCREEN_INVENTORY §0's heading says "35 — 28 states + 7 UTs",
  but the list it prints has 36, and so does the backend's `src/types/index.ts` (8 UTs). Pinned by a
  test against the backend array.
- **Plan badge reads the ID token's `planType` custom claim**, not the profile doc — that is what
  middleware verifies into `x-user-plan` and what the metering enforces, and `planType` is
  rules-protected so the doc can lag. No token (today's stub) renders **"Not available"**, never a
  fabricated "Free".
- Pre-existing **web-side** bug, not ours to fix but worth knowing: `pincode` is in the server
  action's `PROFILE_WRITABLE_FIELDS` but **not** in the adapter's `CLIENT_EDITABLE_USER_FIELDS`, so
  `updateProfileAction` drops it (with a warn log). Onboarding has been sending a pincode that never
  lands. The Flutter document lane writes it directly, so it works here.

### Worksheet Wizard (P1.1) — found while building it, verified against `route.ts` + the Zod schema

`POST /api/ai/worksheet` was verified against `src/app/api/ai/worksheet/route.ts`,
`WorksheetWizardInputSchema` / `WorksheetWizardOutputSchema` in
`src/ai/flows/worksheet-wizard.ts`, and `src/lib/sidecar/worksheet-dispatch.ts` (the dispatcher
does not reshape the payload; it returns the same seven fields).

- **The response field is `learningObjectives`, NOT `objectives`.** SCREEN_INVENTORY §P1.1 prints
  the response with an `objectives` key; the route actually returns `learningObjectives`
  (and `title`, `gradeLevel`, `subject`, `studentInstructions`, `activities`, `answerKey`). The DTO
  and a test pin `learningObjectives`.
- **`answerKey` is `[{ activityIndex: number, answer: string }]`**, where `activityIndex` is
  **0-based**. SCREEN_INVENTORY left the shape as `[ ... ]`. The result view renders it as a 1-based
  "Activity N" (falling back to a bullet when the index is absent). Pinned by a test.
- **`imageDataUri` is REQUIRED and capped by `z.string().max(14_000_000)`.** Zod's `.max()` on a
  string measures the STRING LENGTH of the whole `data:` URI (characters, and a data URI is ASCII so
  chars == bytes) and **rejects** (400) over the cap — it does not clamp. So the client enforces
  `dataUri.length <= 14_000_000` (constant `kMaxImageDataUriBytes` in `lib/shared/media/image_input.dart`)
  and the size counter measures that exact quantity. Because base64 inflates by ~4/3 plus the
  `data:<mime>;base64,` prefix, ~14 MB of URI is ~10.5 MB of raw image. The image is sent verbatim
  under `imageDataUri`; `prompt` is `.max(2000)`; `language` is `.max(50)`; `gradeLevel`/`subject`
  are optional strings. `userId` and `teacherContext` are server-injected and never sent.
- **No `validationWarning` on this endpoint** (unlike lesson-plan / quiz). The worksheet result view
  has no note-banner.
- **Any `data:<mime>;base64,...` is accepted** (the flow only checks the `data:` prefix; the mime is
  passed to Gemini via `{{media url=imageDataUri}}`). The client derives the mime from the picked
  file's extension, defaulting to `image/jpeg` (image_picker re-encodes to JPEG when `imageQuality`
  is set).

## 4. Push notifications (FCM)
The Settings notifications switch is **local-only and defaults OFF** (deliberate: defaulting a
permission-bearing toggle on, or promising undeliverable notifications, is a dark pattern). Wiring
FCM needs `google-services.json` (step 1) plus registering the device token against the existing
`POST /api/fcm/register`. TODO left in the code.

## 5. Fonts (deferred hardening)
Currently `google_fonts` fetches at runtime. For rural/offline users, bundle the Inter/Outfit/Noto
`.ttf`s into `assets/fonts/` and set `GoogleFonts.config.allowRuntimeFetching = false`.

## 6. Device verification (worth a human eye)
`flutter devices` finds none in this environment, so **contrast and dark-mode are verified by
token-only color usage + clean renders in both brightnesses, not by on-device screenshots**. Run the
app on a real handset and eyeball the saffron/dark surfaces before shipping.

## 7. Camera & photo permissions (Worksheet Wizard / Assess Assignment)

The shared `lib/shared/media/image_input.dart` uses `image_picker` (added at `^1.1.2`, resolved to
1.2.3, no dependency conflicts). Owner/runtime items:

- **Android manifest (done):** `android/app/src/main/AndroidManifest.xml` declares
  `android.permission.CAMERA` plus `<uses-feature android:name="android.hardware.camera"
  required="false"/>` (so gallery-only devices still install). Gallery goes through the Android
  **system photo picker**, which needs no storage permission on modern SDKs.
- **Runtime permission flow:** `image_picker` requests CAMERA at first use and surfaces a denial as a
  `PlatformException`; the widget maps that to a dignified "needs permission … allow access in your
  device settings" message (`imageInputPermissionDenied`) and does NOT report an image upward. There
  is no in-app "open settings" deep link yet — if the teacher permanently denies, they must enable it
  in OS settings. A future hardening could add `permission_handler` + an "Open settings" action.
- **iOS (N/A now, needed when an iOS target is added):** add `NSCameraUsageDescription` and
  `NSPhotoLibraryUsageDescription` to `ios/Runner/Info.plist`, or the app crashes on first pick. This
  repo is Android-first; there is no iOS target wired yet.
- **Tests never open a real camera:** the pick source is behind `imagePickerServiceProvider` and is
  overridden with a `FakeImagePickerService` in every test.
