import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/platform/clock.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/voice/os_tts_service.dart';
import '../../../shared/voice/tts_language.dart';
import '../../attendance/domain/attendance_date.dart';
import '../../attendance/domain/attendance_record.dart';
import '../../attendance/presentation/attendance_providers.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/domain/teacher_notification.dart'
    show kAbsenceRunThreshold;
import '../../parent_hotline/presentation/hotline_copy.dart' show firstName;
import '../../parent_hotline/presentation/parent_hotline_controller.dart';
import '../../profile/presentation/profile_controller.dart';
import '../../staffroom/data/staffroom_providers.dart';
import '../../staffroom/domain/group.dart';
import '../domain/deliverable.dart';
import 'deliver_tray.dart';
import 'deliverables_controller.dart';

/// One of the teacher's classes as the briefing sees it this morning.
@immutable
class BriefingClass {
  const BriefingClass({
    required this.id,
    required this.name,
    required this.marked,
    required this.absent,
  });

  final String id;
  final String name;

  /// Whether today's register for this class has been saved.
  final bool marked;

  /// Students marked absent in today's saved register.
  final int absent;
}

/// A student who has been absent [days] school days in a row.
@immutable
class BriefingStreak {
  const BriefingStreak({
    required this.studentId,
    required this.name,
    required this.days,
  });

  final String studentId;
  final String name;
  final int days;
}

/// What the "Today's briefing" card says about the teacher's classes.
@immutable
class HomeBriefing {
  const HomeBriefing({required this.classes, required this.streaks});

  static const HomeBriefing empty = HomeBriefing(
    classes: <BriefingClass>[],
    streaks: <BriefingStreak>[],
  );

  final List<BriefingClass> classes;
  final List<BriefingStreak> streaks;

  int get unmarked => classes.where((c) => !c.marked).length;
}

/// The teacher's day from SAVED data only: each class's register today, and
/// the students on an absence run this month. A class whose reads fail is
/// left out rather than failing the card — a briefing never shows an error.
final homeBriefingProvider = FutureProvider<HomeBriefing>((ref) async {
  final classes = await ref.watch(attendanceClassesProvider.future);
  final today = AttendanceDate.fromIstInstant(ref.watch(nowProvider)());
  final out = <BriefingClass>[];
  final streaks = <BriefingStreak>[];
  for (final c in classes) {
    try {
      final register = await ref.watch(
        dailyRegisterProvider((classId: c.id, date: today)).future,
      );
      out.add(
        BriefingClass(
          id: c.id,
          name: c.name,
          marked: register != null,
          absent:
              register?.statuses.values
                  .where((s) => s == AttendanceStatus.absent)
                  .length ??
              0,
        ),
      );
    } catch (_) {
      // Unreadable register: this class is simply not in the briefing.
    }
    try {
      final summaries = await ref.watch(
        monthlySummariesProvider((
          classId: c.id,
          year: today.year,
          month: today.month,
        )).future,
      );
      for (final s in summaries) {
        final run = s.currentAbsenceStreak ?? 0;
        if (run >= kAbsenceRunThreshold) {
          streaks.add(
            BriefingStreak(
              studentId: s.studentId,
              name: s.studentName,
              days: run,
            ),
          );
        }
      }
    } catch (_) {
      // No summaries: no absence runs to report for this class.
    }
  }
  streaks.sort((a, b) => b.days.compareTo(a.days));
  return HomeBriefing(classes: out, streaks: streaks);
});

/// The newest post from the teacher's Daily Briefing group, or null. The
/// feed is optional here: a failed or empty feed just hides the excerpt.
final dailyBriefingPostProvider = FutureProvider<GroupPost?>((ref) async {
  try {
    final feed = await ref.watch(unifiedFeedProvider.future);
    for (final item in feed) {
      final post = item.post;
      if (post == null) continue;
      final group = (item.groupName ?? '').toLowerCase();
      if (group.contains('briefing') ||
          post.authorName.toLowerCase().contains('briefing')) {
        return post;
      }
    }
  } catch (_) {
    // Fall through: no excerpt.
  }
  return null;
});

/// "Today's briefing": Home's first card. It greets the teacher, says how her
/// registers stand, lists what needs her (absences to call, unmarked
/// registers, absence runs, ready results, messages, updates) and quotes the
/// Community Daily Briefing. Listen reads it all aloud with the phone's voice.
///
/// It replaces "Waiting for you": every row that card had is here too.
class HomeBriefingCard extends ConsumerStatefulWidget {
  const HomeBriefingCard({super.key, required this.onOpenTab});

  /// Switches the shell to another tab (Community). Null outside the shell.
  final ValueChanged<int>? onOpenTab;

  /// The shell's Community tab index.
  static const int communityTab = 2;

  @override
  ConsumerState<HomeBriefingCard> createState() => _HomeBriefingCardState();
}

class _HomeBriefingCardState extends ConsumerState<HomeBriefingCard> {
  bool _speaking = false;

  /// Held so a briefing still being read can be stopped when Home goes away
  /// (a provider cannot be read once the element is disposing).
  late final OsTtsService _tts = ref.read(osTtsServiceProvider);

  @override
  void dispose() {
    if (_speaking) unawaited(_tts.stop());
    super.dispose();
  }

  void _openCommunity() {
    final open = widget.onOpenTab;
    if (open != null) {
      open(HomeBriefingCard.communityTab);
    } else {
      context.push(Routes.network);
    }
  }

  Future<void> _toggleListen(String script) async {
    final tts = _tts;
    if (_speaking) {
      await tts.stop();
      if (mounted) setState(() => _speaking = false);
      return;
    }
    setState(() => _speaking = true);
    try {
      final lang = ref.read(localeControllerProvider).code;
      await tts.initialize(vidyaTtsBcp47(lang));
      await tts.speak(script);
    } catch (_) {
      // No voice engine: the card is still there to read.
    }
    if (mounted) setState(() => _speaking = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final briefing = ref
        .watch(homeBriefingProvider)
        .maybeWhen(data: (b) => b, orElse: () => HomeBriefing.empty);
    final post = ref
        .watch(dailyBriefingPostProvider)
        .maybeWhen(data: (p) => p, orElse: () => null);
    final ready = ref.watch(deliverablesControllerProvider);
    final unreadMessages = ref
        .watch(unreadConversationsProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : 0,
          orElse: () => 0,
        );
    final unreadUpdates = ref.watch(unreadNotificationCountProvider);
    final callingStudent = ref.watch(
      parentHotlineControllerProvider.select(
        (s) =>
            s.stage == HotlineStage.calling &&
                (s.outreachId?.isNotEmpty ?? false)
            ? s.studentName?.trim()
            : null,
      ),
    );
    final displayName = ref
        .watch(profileControllerProvider)
        .valueOrNull
        ?.displayName
        ?.trim();

    final greeting = _greeting(l10n, ref.read(nowProvider)());
    final title = (displayName == null || displayName.isEmpty)
        ? greeting
        : l10n.homeGreetingNamed(greeting, firstName(displayName));
    final summary = briefing.classes.isEmpty
        ? null
        : '${l10n.homeBriefingClasses(briefing.classes.length)} '
              '${l10n.homeBriefingToMark(briefing.unmarked)}';

    final rows = <_BriefingRowData>[
      if (callingStudent != null && callingStudent.isNotEmpty)
        _BriefingRowData(
          dot: AppColors.leaf500,
          label: l10n.homeWaitingParentCall(firstName(callingStudent)),
          action: l10n.actionOpen,
          onTap: () => context.push(Routes.parentHotline),
        ),
      for (final c in briefing.classes)
        if (!c.marked)
          _BriefingRowData(
            dot: AppColors.amber500,
            label: l10n.homeBriefingClassNotMarked(c.name),
            action: l10n.homeBriefingActionMark,
            onTap: () => context.push(Routes.attendanceMarkPath(c.id)),
          )
        else if (c.absent > 0)
          _BriefingRowData(
            dot: AppColors.red500,
            label: l10n.homeBriefingClassAbsent(c.name, c.absent),
            action: l10n.homeBriefingActionCall,
            onTap: () => context.push(Routes.parentHotline),
          )
        else
          _BriefingRowData(
            dot: AppColors.leaf500,
            label: l10n.homeBriefingClassAllPresent(c.name),
            action: l10n.actionOpen,
            onTap: () => context.push(Routes.attendance),
          ),
      for (final s in briefing.streaks.take(3))
        _BriefingRowData(
          dot: AppColors.red500,
          label: l10n.homeBriefingStreak(s.name, s.days),
          action: l10n.homeBriefingActionCall,
          onTap: () => context.push(Routes.parentHotline),
        ),
      for (final Deliverable item in ready.reversed.take(3))
        _BriefingRowData(
          dot: AppColors.leaf500,
          label: l10n.homeWaitingReady(item.title),
          action: l10n.actionOpen,
          onTap: () => showDeliverTray(context, item),
        ),
      if (unreadMessages > 0)
        _BriefingRowData(
          dot: AppColors.saffron500,
          label:
              '${l10n.inboxTitle} · ${l10n.inboxUnreadLabel(unreadMessages)}',
          action: l10n.actionOpen,
          onTap: () => context.push(Routes.inbox),
        ),
      if (unreadUpdates > 0)
        _BriefingRowData(
          dot: AppColors.indigo500,
          label: l10n.homeWaitingUpdates(unreadUpdates),
          action: l10n.actionOpen,
          onTap: _openCommunity,
        ),
    ];

    final excerpt = post == null ? null : briefingExcerpt(post.content);
    final script = [
      title,
      ?summary,
      for (final r in rows) r.label,
      if (excerpt != null) '${l10n.homeBriefingCommunityEyebrow}. $excerpt',
    ].join('. ');

    return Container(
      key: const ValueKey('home-briefing'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: AppColors.borderGlass),
        boxShadow: const [AppShadows.card],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: _BriefingEyebrow(l10n.homeBriefingEyebrow),
                ),
              ),
              _ListenButton(
                speaking: _speaking,
                onTap: () => _toggleListen(script),
              ),
            ],
          ),
          Text(
            title,
            style: text.titleLarge?.copyWith(
              fontSize: 20,
              color: AppColors.textStrong,
            ),
          ),
          if (summary != null) ...[
            const SizedBox(height: 2),
            Text(
              summary,
              style: text.bodyMedium?.copyWith(color: AppColors.textBody),
            ),
          ],
          const SizedBox(height: AppSpacing.space2),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
              child: Text(
                l10n.homeWaitingNothing,
                style: text.bodyLarge?.copyWith(color: AppColors.textBody),
              ),
            )
          else
            for (final r in rows) ...[
              const Divider(height: 1, color: AppColors.borderHairline),
              _BriefingRow(data: r),
            ],
          if (excerpt != null) ...[
            const SizedBox(height: AppSpacing.space2),
            _CommunityExcerpt(excerpt: excerpt, onReadMore: _openCommunity),
          ],
        ],
      ),
    );
  }
}

/// Good morning / afternoon / evening by the phone's clock.
String _greeting(AppLocalizations l10n, DateTime now) {
  if (now.hour < 12) return l10n.homeGreetingMorning;
  if (now.hour < 17) return l10n.homeGreetingAfternoon;
  return l10n.homeGreetingEvening;
}

/// The Daily Briefing post cut to about two lines at a word boundary. This
/// shortens the QUOTED post (Read more opens the whole of it); it is not a
/// label being squeezed to fit.
@visibleForTesting
String briefingExcerpt(String content, {int max = 170}) {
  final clean = content.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (clean.length <= max) return clean;
  final cut = clean.substring(0, max);
  final lastSpace = cut.lastIndexOf(' ');
  return '${(lastSpace > 80 ? cut.substring(0, lastSpace) : cut).trim()}…';
}

class _BriefingEyebrow extends StatelessWidget {
  const _BriefingEyebrow(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final latin = Localizations.localeOf(context).languageCode == 'en';
    return Text(
      latin ? label.toUpperCase() : label,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: latin ? 1.7 : 0,
        color: AppColors.textEyebrow,
      ),
    );
  }
}

/// Listen / Stop: reads the briefing aloud. The words and the icon both
/// change, so the state never rests on colour.
class _ListenButton extends StatelessWidget {
  const _ListenButton({required this.speaking, required this.onTap});

  final bool speaking;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final label = speaking ? l10n.homeBriefingStop : l10n.homeBriefingListen;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        key: const ValueKey('home-briefing-listen'),
        borderRadius: AppRadius.rPill,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpacing.targetMin),
          child: Center(
            widthFactor: 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: AppColors.milk50,
                borderRadius: AppRadius.rPill,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    speaking ? LucideIcons.square : LucideIcons.volume2,
                    size: 16,
                    color: AppColors.textLink,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textStrong,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BriefingRowData {
  const _BriefingRowData({
    required this.dot,
    required this.label,
    required this.action,
    required this.onTap,
  });

  final Color dot;
  final String label;
  final String action;
  final VoidCallback onTap;
}

/// One line of the briefing: a meaning dot, what it is, and what a tap does
/// (Call, Mark, Open). The words carry the meaning; the dot only echoes it.
class _BriefingRow extends StatelessWidget {
  const _BriefingRow({required this.data});

  final _BriefingRowData data;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: '${data.label}, ${data.action}',
      excludeSemantics: true,
      child: InkWell(
        onTap: data.onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpacing.targetMin),
          child: Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: data.dot,
                  shape: BoxShape.circle,
                ),
                child: const SizedBox.square(dimension: 8),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    data.label,
                    style: text.bodyLarge?.copyWith(
                      color: AppColors.textStrong,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              Text(
                data.action,
                style: text.labelMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textLink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The Community Daily Briefing, quoted in a cream inset with Read more.
class _CommunityExcerpt extends StatelessWidget {
  const _CommunityExcerpt({required this.excerpt, required this.onReadMore});

  final String excerpt;
  final VoidCallback onReadMore;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      decoration: BoxDecoration(
        color: AppColors.milk300,
        borderRadius: AppRadius.rTile,
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.homeBriefingCommunityEyebrow,
            style: text.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            excerpt,
            style: text.bodyMedium?.copyWith(color: AppColors.textStrong),
          ),
          Semantics(
            button: true,
            label: l10n.homeBriefingReadMore,
            excludeSemantics: true,
            child: InkWell(
              key: const ValueKey('home-briefing-read-more'),
              onTap: onReadMore,
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: AppSpacing.targetMin,
                ),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: 1,
                  child: Text(
                    l10n.homeBriefingReadMore,
                    style: text.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textLink,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
