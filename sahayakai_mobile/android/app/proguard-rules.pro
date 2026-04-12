# ─────────────────── SahayakAI ProGuard Rules ───────────────────

# Flutter (keep all Flutter-related classes)
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }
-dontwarn io.flutter.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# Dio / OkHttp / Retrofit
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Isar (native library — critical to keep)
-keep class dev.isar.** { *; }
-dontwarn dev.isar.**

# Keep Dart/Flutter generated code (Riverpod generators, etc.)
-keep class **.generated.** { *; }

# Google Sign-In
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }

# FlutterSound (audio recording/playback)
-keep class com.dooboolab.** { *; }
-dontwarn com.dooboolab.**

# share_plus
-keep class dev.fluttercommunity.plus.share.** { *; }

# Suppress common warnings from third-party libs
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
