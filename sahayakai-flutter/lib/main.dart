import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/firebase/firebase_init.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // No font warm-up. The Latin and Noto Sans Indic families are bundled in the
  // APK (pubspec.yaml `flutter.fonts`) and registered by the engine at startup.
  // This previously called warmIndicFonts() to pre-fetch faces over the
  // network, so a first launch without connectivity rendered fallback boxes for
  // every Indic script. See lib/core/theme/app_text.dart.
  //
  // Real Firebase init (auth handoff landed — see firebase_init.dart). Safe to
  // await unconditionally: it swallows failure and leaves the app in the same
  // signed-out-everywhere state a build with no config would render.
  await FirebaseInit.ensureInitialized();
  runApp(const ProviderScope(child: SahayakApp()));
}
