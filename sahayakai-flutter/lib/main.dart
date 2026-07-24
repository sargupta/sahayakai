import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/firebase/firebase_init.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Register the Noto Sans families so mixed Latin+Indic strings shape before
  // any fallback references them. (google_fonts runtime fetch — bundling the
  // TTFs as offline assets is a deferred hardening task; see BUILD_STATE.json.)
  warmIndicFonts();
  // Real Firebase init (auth handoff landed — see firebase_init.dart). Safe to
  // await unconditionally: it swallows failure and leaves the app in the same
  // signed-out-everywhere state a build with no config would render.
  await FirebaseInit.ensureInitialized();
  runApp(const ProviderScope(child: SahayakApp()));
}
