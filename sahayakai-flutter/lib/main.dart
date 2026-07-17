import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Register the Noto Sans families so mixed Latin+Indic strings shape before
  // any fallback references them. (google_fonts runtime fetch — bundling the
  // TTFs as offline assets is a deferred hardening task; see BUILD_STATE.json.)
  warmIndicFonts();
  // TODO(P0.2): await Firebase.initializeApp + FirebaseAppCheck.activate here
  // before runApp, once flutterfire configure has produced firebase_options.dart.
  runApp(const ProviderScope(child: SahayakApp()));
}
