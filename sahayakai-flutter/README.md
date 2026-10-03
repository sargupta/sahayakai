# sahayakai

SahayakAI — native Android app (SARGVISION Intelligence)

## Choosing a backend

The app talks to the production API (`https://sahayakai.com`) by default. Point a
build or run at another tier — UAT, a preview, or a local server — with a
`--dart-define`, no code change needed:

```bash
flutter run        --dart-define=API_BASE_URL=https://<your-uat-host>
flutter build apk  --dart-define=API_BASE_URL=https://<your-uat-host>
```

Omit the flag to use production. A trailing slash on the URL is trimmed
automatically. See `lib/core/network/dio_config.dart`.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
