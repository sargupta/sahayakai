# Release builds — SahayakAI Android

Written by loop unit U0.4, 2026-08-17. Every claim here is checkable by a command in this file.

---

## The one thing to understand first

A release build that succeeds tells you nothing about whether the artifact is signed correctly.

Before U0.4 this project shipped the untouched Flutter template:

```kotlin
release {
    // TODO: Add your own signing config for the release build.
    signingConfig = signingConfigs.getByName("debug")
}
```

That compiles, installs on a device, and runs. It is rejected only at Play upload — long after anyone is watching. The debug fallback still exists deliberately (a keyless checkout must still build), so the question "is this artifact signed with the upload key?" is never answered by the build exit code. **Assert it:**

```bash
bash scripts/loop/verify_aab_signer.sh
```

It compares the AAB's signer certificate against the keystore's and exits non-zero on a mismatch. The loop's `release` gate profile runs it on every band exit.

---

## Key identity

This app shares its upload key with the Capacitor wrap at `sahayakai-android/`, because both declare `applicationId com.sargvision.sahayakai` and Play permits one app per package name. One key means one set of fingerprints in Firebase and one `assetlinks.json` entry, instead of two that silently disagree.

| | |
|---|---|
| Keystore (canonical) | `sahayakai-android/mobile/android/app/upload.keystore` |
| Local copy used by Gradle | `android/app/upload.keystore` — gitignored by `**/*.keystore` |
| Credentials | `android/key.properties` — gitignored; see `android/key.properties.example` |
| Alias | `sahayakai` |
| Type | PKCS12, 1 entry, issued 2026-07-17 |
| **Upload cert SHA-256** | `09:3E:4C:1A:71:2D:6D:40:A0:B6:A6:4B:56:F8:6F:67:00:10:16:C9:ED:44:6E:79:F2:DC:A8:DB:CF:E6:35:C3` |
| **Upload cert SHA-1** | `96:13:21:91:C3:F6:0E:50:05:3C:E3:20:DA:62:C3:CF:21:39:F0:A0` |

Back the keystore up. It exists in two places on one machine and nowhere else.

---

## Building

```bash
flutter build appbundle --release          # -> build/app/outputs/bundle/release/app-release.aab
bash scripts/loop/verify_aab_signer.sh     # -> MATCH, or it tells you what is wrong
```

With `android/key.properties` absent, the same command still succeeds and produces a **debug-signed** artifact. `verify_aab_signer.sh` reports `MISMATCH` for it. That combination is the point: the build never blocks a contributor without the key, and the artifact is never mistaken for shippable.

---

## versionCode

Sourced from `pubspec.yaml`'s `version:` field (`1.0.0+2` → versionName `1.0.0`, versionCode `2`).

It starts at **2**, not 1. The Capacitor wrap declares the same `applicationId` and built its AAB at versionCode 1. That artifact was never uploaded — Play publish is still an open handoff step in `sahayakai-android/docs/HANDOFF.md` §5 — so 1 is not genuinely burned. But two distinct artifacts sharing an applicationId and a versionCode is an ambiguity with no upside.

**Provisional until H3.** Play rejects a duplicate versionCode, so before the first upload, confirm the highest versionCode Play has seen for `com.sargvision.sahayakai` and set the floor above it. Every subsequent release increments it; Play never accepts a repeat.

---

## What still blocks a shippable release

These are human-only. The loop records them and does not attempt them.

**H4 — register the upload key's fingerprints in Firebase.** Add both the SHA-1 and SHA-256 above to `com.sargvision.sahayakai` in the Firebase console, then re-download `google-services.json`.

Only the *debug* keystore's SHA-1 (`2B:38:C2:3A:…`) is registered today. Until this is done, **a signed release build's Google Sign-In returns `DEVELOPER_ERROR` on every device.** No code change works around it, and nothing in the build or the test suite detects it — the failure appears only when a real user taps Sign in on a real release build.

**H2 — Play App Signing.** Play re-signs uploads with its own key. After enabling App Signing, take the Play signing SHA-256 from Play Console → Setup → App signing and register that *too*, in Firebase and in `assetlinks.json`. Skipping this is the classic post-launch break: sign-in and App Links both work in internal testing and both fail in production.

**H3 — confirm the versionCode floor** (above).

**H9 — CI signing.** The GitHub Actions release job needs `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEY_PROPERTIES` as repo secrets. Local signed builds do not.

---

## Not done here, deliberately

**No `autoVerify` App Links intent-filter.** It belongs with `assetlinks.json` (unit U0.15), and shipping it early is worse than not shipping it: Android caches a *failed* verification, and re-verification is not immediate. The manifest gains it only once the file is live at `https://sahayakai.com/.well-known/assetlinks.json` with both fingerprints.

**No R8 / `isMinifyEnabled`.** Firebase plus Flutter needs proguard rules, and a stripped release that fails at runtime is a separate blast radius from a signing change. Its own unit, with its own on-device check.
