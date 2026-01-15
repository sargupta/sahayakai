import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../tokens/studio_token_loader.dart';
import '../extensions/sahayak_theme.dart';

/// Provider for the currently active Studio ID (default: wizard)
final studioProvider = StateProvider<String>((ref) => 'wizard');

/// Provider for the currently active Locale code (default: hi)
final localeProvider = StateProvider<String>((ref) => 'hi');

/// Asynchronous provider that loads the full [SahayakTheme] based on Studio + Locale.
/// Retriggers automatically when studio or locale changes.
final sahayakThemeProvider = FutureProvider<SahayakTheme>((ref) async {
  final studio = ref.watch(studioProvider);
  final locale = ref.watch(localeProvider);
  return StudioTokenLoader.load(studio, locale);
});
