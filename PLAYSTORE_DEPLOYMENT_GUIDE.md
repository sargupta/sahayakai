# 🚀 SahayakAI — Google Play Store Deployment Guide

**App:** SahayakAI (`com.sargvision.sahayakai`)
**Flutter:** 3.41.6 via FVM
**Target:** Android only (iOS/web not configured)
**Date:** Fri Oct 23, 2026

---

## ✅ What's Already Done (Code-Fixes Applied)

### 1. Manifest fixes (`android/app/src/main/AndroidManifest.xml`)
| Setting | Before | After |
|---------|--------|-------|
| `android:label` | `sahayakai` | `SahayakAI` |
| `android:allowBackup` | *(absent)* | `false` |
| `android:enableOnBackInvokedCallback` | *(absent)* | `true` |
| `android:icon` | `@mipmap/ic_launcher` | *(unchanged)* |

### 2. Dark mode fix (`assessment_scanner_screen.dart`)
- `_disposed` flag + `_darkSyncEpoch` epoch guard on all deferred writes to `scannerDarkProvider`
- `dispose()` sets `_disposed = true`, bumps epoch, then sets `scannerDarkProvider = false`
- Dark only asserted during capture/idle phase (`!hasResult && !isLoading && !hasError`)

### 3. Home page dynamic data (`vidya_home_screen.dart`)
- `_HeroSection` converted from `StatelessWidget` → `ConsumerWidget`
- Watches `profileControllerProvider`; builds subtitle from `gradeLevels` + `subjects`
- Falls back to `homeHeroSubtitle` when profile is empty/loading/error

### 4. Icon fix (`assets/branding/app_icon.png`)
- Converted from JPEG to valid PNG (724,090 bytes, 1024×1024 RGB)

### 5. Privacy screen (`privacy_screen.dart`)
- New screen at `/privacy-for-teachers` route
- In-app explainer covering Google sign-in, no data sale, student name protection

---

## 📋 Play Store Pre-Submission Checklist

### Phase 1: Code & Config (MUST do before build)

#### 1.1 Version & signing
**File:** `pubspec.yaml`
```
version: 1.0.0+2   # versionName=1.0.0, versionCode=2
```
- **Action:** Confirm highest `versionCode` Play Console has seen for this app. If this is the first upload, `+2` is fine. If there were prior uploads, increment `versionCode` monotonically.
- **Action:** Ensure `key.properties` exists with release keystore credentials (never commit to git).

**File:** `android/app/build.gradle.kts`
- Verify `signingConfig` references `release` keystore when `key.properties` exists
- Verify `minSdkVersion` ≥ 21 (check current value)
- Verify `targetSdkVersion` = 34 (API 34 emulator target)

#### 1.2 Permissions (`AndroidManifest.xml`)
- **Declared:** INTERNET, RECORD_AUDIO, CAMERA — all actively used ✅
- **Missing:** `POST_NOTIFICATIONS` — NOT needed yet (FCM not wired)
- **When adding FCM later:** Add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />` + runtime request on API 33+

#### 1.3 R8 / ProGuard (recommended but optional)
**Status:** `minifyEnabled` NOT set (defaults to `false`). Build works without R8.
- **Optional:** Add `android/app/proguard-rules.pro` with rules for Firebase + Flutter + plugins
- **Required before enabling:** On-device smoke test (Google Sign-In, Firestore, camera, voice, share)

#### 1.4 App icons
**Status:** Valid PNG, adaptive icon configured (background `#F3EEE4` + foreground)
- **Missing:** Monochrome icon layer for Android 13+ themed icons
- **To add:** Provide `adaptive_icon_monochrome` PNG (single color + alpha) in `flutter_launcher_icons.yaml`, regenerate icons

#### 1.5 Privacy & Data Safety
**Hosted privacy policy:** `https://sahayakai.com/privacy-for-teachers` ✅ (exists and loads)
- **Play Console:** Set privacy policy URL to `https://sahayakai.com/privacy-for-teachers` (NOT `/privacy` — 404s)
- **Account deletion:** Supported in-app (Settings → Delete Account → POST `/api/user/delete-account`) ✅
- **Data Safety form:** Declare personal info (name, email via Google sign-in), audio (voice), photos (camera pages), phone numbers (parent contacts), app activity (lesson plans); sharing with Firebase/Google Cloud, Gemini, Sarvam, Razorpay; retention up to 180 days post-cancellation
- **Recommended:** Complete `PrivacyScreen` (localize via ARB, link to hosted policy, add "Last updated", state 18+ / no student personal data)

---

### Phase 2: Build the release artifact

```bash
# 1. Generate icons (if monochrome added)
flutter pub run flutter_launcher_icons

# 2. Run codegen
dart run build_runner build --delete-conflicting-outputs

# 3. Analyze
flutter analyze --fatal-infos

# 4. Build AAB (recommended over APK for Play Store)
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols

# 5. Build APK (alternative, for sideload testing)
flutter build apk --release --obfuscate --split-debug-info=build/symbols
```

**Artifacts:**
- AAB: `build/app/outputs/bundle/release/app-release.aab` ← upload to Play Console
- APK: `build/app/outputs/flutter-apk/app-release.apk` ← for sideload testing
- Symbols: `build/symbols/` ← archive for crash symbolication

---

### Phase 3: Play Console setup (manual, cannot be automated)

| Item | Where | Notes |
|------|-------|-------|
| App name | Play Console → Store presence → Main store listing | "SahayakAI" |
| Short description | Store listing | Max 80 chars |
| Full description | Store listing | Max 4000 chars |
| Privacy policy URL | App content → Privacy policy | `https://sahayakai.com/privacy-for-teachers` |
| Data safety form | App content → Data safety | Declare all data types & sharing |
| Content rating | Store presence → Content rating | Complete questionnaire |
| Screenshots | Store listing → Screenshots | Phone (required), 7-inch tablet |
| Feature graphic | Store listing → Main store listing | 1024×500 PNG |
| App icon | Store listing → Main store listing | 512×512 PNG |
| Release | Releases → Production → Create release | Upload AAB, add release notes |
| Countries/regions | Pricing & distribution | Select India + target markets |

---

### Phase 4: Post-submission

1. **Wait for review** (typically 24-48 hours)
2. **Symbolicate crashes:** Use `build/symbols/` to deobfuscate stack traces from Play Console
3. **Monitor:** Android Vitals, crash-free user rate, ANR rate
4. **Version bumps:** Increment `versionCode` for every upload (never reuse)

---

## 🔧 Remaining Issues to Address Before Ship

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| High | Register debug keystore SHA in Firebase Console (for Google Sign-In in emulator) | Firebase Console | 5 min |
| High | Complete `PrivacyScreen` localization + hosted policy link | `privacy_screen.dart` | 1 hour |
| Medium | Add `POST_NOTIFICATIONS` permission when FCM wired | `AndroidManifest.xml` | 15 min |
| Medium | Add monochrome icon for Android 13+ themed icons | `flutter_launcher_icons.yaml` | 30 min |
| Low | Enable R8/ProGuard for release | `build.gradle.kts` + `proguard-rules.pro` | 2 hours + testing |
| Low | Verify `targetSdkVersion` = 34 | `build.gradle.kts` | 5 min |

---

## 🧪 Test Before Submitting

1. **Cold boot:** Kill app, restart emulator, open app — should NOT require re-login (if debug SHA registered)
2. **Scan flow:** Open scan from home → should show dark surface during capture → return to home → should restore teacher's theme
3. **Home page:** Should display teacher's actual grade levels + subjects, not static "Class 7 Maths"
4. **Google Sign-In:** Tap "Continue with Google" → account picker → sign in → navigate to dashboard
5. **Privacy:** Open Settings → Privacy → screen renders, hosted policy link works

---

## 📁 Files Modified This Session

| File | Change |
|------|--------|
| `lib/features/vidya/presentation/vidya_home_screen.dart` | `_HeroSection` → `ConsumerWidget`, dynamic subtitle from profile |
| `lib/core/theme/scanner_dark_provider.dart` | Doc comment added clarifying lifecycle guard requirement |
| `lib/features/assessment_scanner/presentation/assessment_scanner_screen.dart` | `_disposed`/`_darkSyncEpoch` guard on dark writes |
| `android/app/src/main/AndroidManifest.xml` | Label → "SahayakAI", `allowBackup=false`, `enableOnBackInvokedCallback=true` |
| `assets/branding/app_icon.png` | JPEG → PNG conversion |
| `lib/features/settings/presentation/privacy_screen.dart` | New privacy screen |
| `lib/core/router/routes.dart` + `app_router.dart` | Added `/privacy-for-teachers` route |
