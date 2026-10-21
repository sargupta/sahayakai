import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True while the Assessment Scanner's capture phase (v3 Screen 11) owns the
/// screen — the one route the design ships dark (`#171310`, "orb survives dark
/// mode"). The screen sets it on mount, flips it off while its results (Screen
/// 12, a LIGHT wash) are on screen, and clears it on unmount, so the app
/// renders dark only for the capture phase and returns to the teacher's own
/// theme everywhere else. [SahayakApp] maps it to `themeMode`, which also
/// flips the floating tab bar to its dark-scanner variant.
final scannerDarkProvider = StateProvider<bool>((ref) => false);
