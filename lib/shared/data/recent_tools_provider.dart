import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kRecentToolsKey = 'recent_tool_ids';

/// How many tools "Recently used" shows.
const int kRecentToolsMax = 3;

/// The tools the teacher opened last, newest first, kept on the phone so the
/// Make hub can offer them again in one tap. Same local-preference shape as
/// `VoiceModeController`: starts empty, hydrates from shared_preferences, and
/// never throws out of a missing plugin.
class RecentTools extends Notifier<List<String>> {
  @override
  List<String> build() {
    _hydrate();
    return const [];
  }

  Future<void> _hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList(_kRecentToolsKey);
      if (stored != null && state.isEmpty) {
        state = List.unmodifiable(stored.take(kRecentToolsMax));
      }
    } catch (_) {
      // No stored list (or no plugin in a plain unit test): nothing recent.
    }
  }

  /// Puts [toolId] first, drops older repeats, keeps [kRecentToolsMax].
  Future<void> record(String toolId) async {
    if (toolId.isEmpty) return;
    state = List.unmodifiable(
      [toolId, ...state.where((id) => id != toolId)].take(kRecentToolsMax),
    );
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_kRecentToolsKey, state);
    } catch (_) {
      // Remembering a tool must never break opening it.
    }
  }
}

final recentToolsProvider = NotifierProvider<RecentTools, List<String>>(
  RecentTools.new,
);
