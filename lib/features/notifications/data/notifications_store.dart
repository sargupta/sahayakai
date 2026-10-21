import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/teacher_notification.dart';

/// The device's own record of things worth telling the teacher about.
///
/// WHY THIS IS LOCAL, AND WHAT WOULD MAKE IT NOT LOCAL
///
/// `GET /api/notifications` DOES exist on `origin/main` (with
/// `notifications/mark-read` and `notifications/mark-all-read` beside it). It
/// was read before this was written, and it is the wrong feed: `Notification`
/// in `src/types/index.ts` is a closed union of FOLLOW / NEW_POST /
/// BADGE_EARNED / SYSTEM / LIKE / RESOURCE_SAVED / RESOURCE_USED / COMMENT /
/// CONNECT_REQUEST / CONNECT_ACCEPTED / NEW_TEACHER_JOINED / NEW_GROUP_POST /
/// GROUP_POST_LIKE, and the only writers (`lib/notifications/create.ts`,
/// `fanout.ts`, `server/groups.ts`, `server/messages.ts`) are all social. No
/// call outcome, no attendance signal and no generation event is ever written
/// to that collection. Binding this surface to it would have produced a
/// notifications screen that cannot show a single thing this screen exists to
/// show.
///
/// So the source is what the app already knows first-hand:
///   • the terminal `callStatus` the Parent Hotline polled off
///     `GET /api/attendance/call-summary`;
///   • the `consecutiveAbsences` figure on the monthly rollup the teacher just
///     opened (`GET .../summaries` — computed server-side, never recomputed);
///   • the **202** `generation_in_progress` the exam-paper route answered with.
///
/// Every one of those is a fact the server stated. None of them is polled for
/// in the background, and this store never fetches anything itself — it is
/// written to by the screens that already made those reads.
///
/// WHAT THAT COSTS, HONESTLY
///
/// The feed is per-device and does not sync with the web app; an event that
/// happens while the app is closed is not recorded (there is no push — see
/// `notificationsLocalNote`, which says exactly this on screen); and the
/// exam-paper row can only say the paper is QUEUED, because the 202 carries no
/// poll token and no route reports completion. Turning any of that into a real
/// feed is a server change: a notification type union that includes the call /
/// attendance / generation events, and writers on the routes that already know
/// them.
///
/// WHY IT IS A HAND-WRITTEN PROVIDER
///
/// Same reason as `features/attendance/presentation/attendance_providers.dart`:
/// this unit must not run `build_runner` (the parent serialises codegen), and a
/// hand-written `.g.dart` is a codegen-drift failure waiting to happen. A plain
/// [NotifierProvider] composes the identical seams a `@riverpod` one would and
/// is overridden in a test the same way.
final notificationsProvider =
    NotifierProvider<NotificationsStore, List<TeacherNotification>>(
      NotificationsStore.new,
    );

/// How many unread rows there are — what the hub's bell badges.
final unreadNotificationCountProvider = Provider<int>(
  (ref) => ref.watch(notificationsProvider).where((n) => !n.isRead).length,
);

/// The prefs key. Versioned, so a future shape change starts clean rather than
/// trying to migrate rows whose meaning moved.
const String kNotificationsPrefsKey = 'notifications_feed_v1';

/// Rows kept, newest first. A teacher who never opens the tab must not grow an
/// unbounded blob in shared_preferences.
const int kMaxStoredNotifications = 50;

class NotificationsStore extends Notifier<List<TeacherNotification>> {
  @override
  List<TeacherNotification> build() {
    // Start empty and hydrate asynchronously — the same contract
    // `ThemeModeController` / `LocaleController` use. Anything recorded during
    // that gap is preserved: `_hydrate` MERGES, it does not overwrite.
    unawaited(_hydrate());
    return const <TeacherNotification>[];
  }

  /// Records [notification] unless an event with the same id is already held.
  ///
  /// The dedupe is the whole reason [TeacherNotification.id] is a stable
  /// derivation rather than a random string: the hotline polls one call several
  /// times and the month view is rebuilt on every rebuild, so without it a
  /// single real event would stack a row per rebuild.
  void record(TeacherNotification notification) {
    if (state.any((n) => n.id == notification.id)) return;
    state = _capped(<TeacherNotification>[notification, ...state]);
    unawaited(_persist());
  }

  /// Clears the unread flag on every row. No-op when nothing is unread, so the
  /// button cannot churn a write.
  void markAllRead() {
    if (state.every((n) => n.isRead)) return;
    state = state
        .map((n) => n.isRead ? n : n.markRead())
        .toList(growable: false);
    unawaited(_persist());
  }

  /// Clears the unread flag on one row (what tapping it does).
  void markRead(String id) {
    var changed = false;
    final next = state
        .map((n) {
          if (n.id != id || n.isRead) return n;
          changed = true;
          return n.markRead();
        })
        .toList(growable: false);
    if (!changed) return;
    state = next;
    unawaited(_persist());
  }

  Future<void> _hydrate() async {
    final stored = await _read();
    if (stored.isEmpty) return;
    // Merge rather than assign: `record` may have fired while this was in
    // flight, and the live row is the one with the fresher read state.
    final byId = <String, TeacherNotification>{
      for (final n in stored) n.id: n,
      for (final n in state) n.id: n,
    };
    state = _capped(byId.values.toList());
  }

  Future<List<TeacherNotification>> _read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(kNotificationsPrefsKey);
      if (raw == null || raw.isEmpty) return const <TeacherNotification>[];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const <TeacherNotification>[];
      // Null-aware element: a row that fails to decode is dropped, and only
      // that row.
      return <TeacherNotification>[
        for (final entry in decoded) ?TeacherNotification.fromJson(entry),
      ];
    } catch (_) {
      // A missing plugin (widget tests), unreadable prefs or a corrupt blob
      // must cost the history, never the screen.
      return const <TeacherNotification>[];
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        kNotificationsPrefsKey,
        jsonEncode(state.map((n) => n.toJson()).toList(growable: false)),
      );
    } catch (_) {
      // Same reasoning as _read: losing the write is survivable, throwing out
      // of a fire-and-forget future is not.
    }
  }

  /// Newest first, capped. Sorted on write so the list order never depends on
  /// the order rows happened to arrive from prefs.
  static List<TeacherNotification> _capped(List<TeacherNotification> input) {
    final sorted = input.toList()..sort((a, b) => b.at.compareTo(a.at));
    return List<TeacherNotification>.unmodifiable(
      sorted.take(kMaxStoredNotifications),
    );
  }
}
