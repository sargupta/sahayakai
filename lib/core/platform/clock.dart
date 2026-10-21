import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The current wall-clock instant, as an overridable seam.
///
/// WHY THIS EXISTS
/// Both home surfaces greet the teacher by time of day — "Good morning" before
/// noon, "Good afternoon" until 5pm, "Good evening" after. Both called
/// `DateTime.now()` directly, which made the greeting untestable: a widget test
/// asserting the eyebrow passes or fails depending on the hour it runs.
///
/// The golden suite found this the hard way. Baselines captured around 21:00
/// recorded "evening"; the same tests re-run after midnight produced a 0.68%
/// pixel diff isolated to that one word. A baseline that depends on wall-clock
/// time is not a baseline — it would have gone red in CI on the first run at
/// any other hour, and the obvious "fix" of re-baselining would simply have
/// moved the breakage to a different time of day.
///
/// Production reads the real clock. Tests override it with a fixed instant.
final nowProvider = Provider<DateTime Function()>((ref) => DateTime.now);
