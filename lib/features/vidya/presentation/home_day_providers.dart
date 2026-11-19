import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/platform/clock.dart';
import '../../../shared/data/library_items_provider.dart';
import '../../../shared/domain/library_dedupe.dart';
import '../../../shared/domain/library_item.dart';
import '../../attendance/domain/attendance_date.dart';
import '../../attendance/domain/attendance_record.dart';
import '../../attendance/presentation/attendance_providers.dart';
import '../../staffroom/data/staffroom_providers.dart';
import '../../staffroom/domain/community_post.dart';
import '../../staffroom/domain/daily_briefing.dart';
import '../domain/home_day.dart';

/// Today's IST calendar day, from the injected clock.
final homeTodayProvider = Provider<AttendanceDate>(
  (ref) => AttendanceDate.fromIstInstant(ref.watch(nowProvider)()),
);

/// The teacher's classes with where each register stands today, by name.
///
/// Reads only saved registers. A register that cannot be read shows as still
/// to mark: the mark screen it opens reads the true state, and Home never
/// shows an error for a reminder.
final todayClassesProvider = FutureProvider<List<TodayClass>>((ref) async {
  final classes = await ref.watch(attendanceClassesProvider.future);
  final today = ref.watch(homeTodayProvider);
  final out = <TodayClass>[];
  for (final c in classes) {
    DailyAttendance? register;
    try {
      register = await ref.watch(
        dailyRegisterProvider((classId: c.id, date: today)).future,
      );
    } catch (_) {
      register = null;
    }
    final absent =
        register?.statuses.values
            .where((s) => s == AttendanceStatus.absent)
            .length ??
        0;
    out.add(
      TodayClass(
        classId: c.id,
        name: c.name,
        subject: c.subject,
        absent: absent,
        state: register == null
            ? ClassDayState.toMark
            : absent > 0
            ? ClassDayState.absences
            : ClassDayState.marked,
      ),
    );
  }
  out.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return out;
});

/// The This week strip: days the teacher saved something to My work, plus
/// today once any register is saved. Registers from earlier days are not
/// read here (one request per class per day would slow Home down).
final weekStreakProvider = Provider<WeekStreak>((ref) {
  final today = ref.watch(homeTodayProvider);
  final active = <AttendanceDate>{
    for (final item
        in ref.watch(libraryItemsProvider).valueOrNull ?? const <LibraryItem>[])
      if (item.createdAt != null)
        AttendanceDate.fromIstInstant(item.createdAt!),
  };
  final classes = ref.watch(todayClassesProvider).valueOrNull;
  if (classes != null && classes.any((c) => c.state != ClassDayState.toMark)) {
    active.add(today);
  }
  return buildWeekStreak(today, active);
});

/// The newest saved work, at most four, each plan once.
final recentWorkProvider = Provider<List<LibraryItem>>((ref) {
  final items = ref.watch(libraryItemsProvider).valueOrNull;
  if (items == null || items.isEmpty) return const [];
  final sorted = [...withoutSavedTwice(items)]
    ..sort((a, b) {
      final at = a.createdAt, bt = b.createdAt;
      if (at == null && bt == null) return 0;
      if (at == null) return 1;
      if (bt == null) return -1;
      return bt.compareTo(at);
    });
  return sorted.take(4).toList(growable: false);
});

/// Who posted in the staff room today, and the post Home shows.
class StaffRoomGlance {
  const StaffRoomGlance({required this.postedToday, required this.lead});

  /// Distinct authors of today's group posts, newest first.
  final List<String> postedToday;

  /// The post to show: the Daily Briefing when there is one, else the newest
  /// group post. Null when the feed has none.
  final FeedItem? lead;
}

final staffRoomGlanceProvider = Provider<StaffRoomGlance?>((ref) {
  final feed = ref.watch(unifiedFeedProvider).valueOrNull;
  if (feed == null) return null;
  final today = ref.watch(homeTodayProvider);
  final authors = <String>[];
  final seen = <String>{};
  FeedItem? newest;
  FeedItem? briefing;
  for (final item in feed) {
    final post = item.post;
    if (item.type != FeedItemType.groupPost || post == null) continue;
    newest ??= item;
    if (briefing == null && parseDailyBriefing(post.content) != null) {
      briefing = item;
    }
    final at = DateTime.tryParse(post.createdAt ?? '');
    if (at == null || AttendanceDate.fromIstInstant(at) != today) continue;
    final name = post.authorName.trim();
    if (name.isEmpty || !seen.add(post.authorUid)) continue;
    authors.add(name);
  }
  final lead = briefing ?? newest;
  if (lead == null) return null;
  return StaffRoomGlance(postedToday: authors, lead: lead);
});
