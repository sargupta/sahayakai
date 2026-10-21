import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Reads google-services.json (present at android/app/) — real Firebase
    // config, not the U-SI0 stub. See docs/flutter/HANDOFF.md §1.
    id("com.google.gms.google-services")
}

// Release signing credentials. android/key.properties is GITIGNORED and absent
// from any clean checkout, so this has to degrade rather than fail: CI, a fresh
// clone, and any contributor without the key still need
// `flutter build apk --release` to work.
//
// storeFile is resolved below with file(), which is relative to this module
// directory (android/app/), so key.properties carries `storeFile=upload.keystore`.
val keystorePropertiesFile = rootProject.file("key.properties")
val hasKeystore = keystorePropertiesFile.exists()
val keystoreProperties = Properties().apply {
    if (hasKeystore) FileInputStream(keystorePropertiesFile).use { load(it) }
}

android {
    namespace = "com.sargvision.sahayakai"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.sargvision.sahayakai"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Sourced from pubspec.yaml's `version:` field. See docs/flutter/RELEASE.md
        // for the versionCode rule and why this app starts at 2, not 1.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasKeystore) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Signed with the upload key when key.properties is present, and
            // with the debug key otherwise.
            //
            // The debug fallback is not a leftover of the template's TODO — it
            // is deliberate, so a keyless checkout can still build. But it is
            // also the failure mode that matters most here: a debug-signed
            // release AAB compiles cleanly, installs cleanly, and is rejected
            // only at Play upload, long after anyone was watching. Never infer
            // from "the build succeeded" that the artifact is signed correctly.
            // Assert it — scripts/loop/verify_aab_signer.sh compares the AAB's
            // signer certificate against the keystore's, and the loop's
            // `release` gate profile runs it on every band exit.
            signingConfig = if (hasKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}
