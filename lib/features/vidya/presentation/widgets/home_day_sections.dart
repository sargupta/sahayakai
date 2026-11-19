import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/domain/library_item.dart';
import '../../../../shared/widgets/library_item_row.dart' show typeLabel;
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../../shared/widgets/tool_tint.dart';
import '../../../staffroom/data/staffroom_providers.dart';
import '../../../staffroom/domain/staffroom_results.dart';
import '../../../staffroom/presentation/widgets/feed_item_view.dart';
import '../../domain/home_day.dart';
import '../home_day_providers.dart';

// Home, below VIDYA: the teacher's day. Today (her classes and their
// registers), This week (days in a row), Pick up where you left off (her
// newest saved work) and From the staff room (who posted today and the Daily
// Briefing). Every number is real; a section with nothing to show is left out
// rather than drawn empty, except Today, which tells a new teacher how to
// start.

/// The registers' amber and the "Now" ink of the Today card.
const Color _toMarkFill = Color(0xFFF8E1B7);
const Color _toMarkInk = Color(0xFF7A4206);

/// A tracked eyebrow: uppercase in Latin script only, never for Indic text.
class HomeEyebrow extends StatelessWidget {
  const HomeEyebrow(
    this.label, {
    super.key,
    this.color = AppColors.textEyebrow,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final latin = Localizations.localeOf(context).languageCode == 'en';
    return Text(
      latin ? label.toUpperCase() : label,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: latin ? 1.7 : 0,
        color: color,
      ),
    );
  }
}

/// An eyebrow with something on its right: a count or a link.
class _EyebrowRow extends StatelessWidget {
  const _EyebrowRow({required this.label, this.trailing});

  final String label;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    // Centred, so a 44dp link sits level with the eyebrow's line.
    return Row(
      children: [
        Expanded(child: HomeEyebrow(label)),
        ?trailing,
      ],
    );
  }
}

/// "Community ›", "My work ›": a quiet link beside an eyebrow, 44dp tall.
class _EyebrowLink extends StatelessWidget {
  const _EyebrowLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.rPill,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textEyebrow,
                  ),
                ),
                const Icon(
                  LucideIcons.chevronRight,
                  size: 15,
                  color: AppColors.textEyebrow,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

BoxDecoration _cardDecoration({double radius = 24}) => BoxDecoration(
  color: AppColors.surfaceCard.withValues(alpha: 0.96),
  borderRadius: BorderRadius.circular(radius),
  border: Border.all(color: AppColors.borderGlass),
  boxShadow: const [
    BoxShadow(color: Color(0x12171310), blurRadius: 24, offset: Offset(0, 8)),
  ],
);

/// A small pill button (Mark now, Add your classes).
class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.onTap,
    this.fill = AppColors.tileSaffronBg,
    this.ink = AppColors.tileAmberInk,
  });

  final String label;
  final VoidCallback onTap;
  final Color fill;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: fill,
        borderRadius: AppRadius.rPill,
        child: InkWell(
          borderRadius: AppRadius.rPill,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40, minWidth: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Center(
                widthFactor: 1,
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Today ──────────────────────────────────────────────────────────────────

/// The day at a glance: the weekday and date, how many classes and registers
/// to mark, each class as a block coloured by its register, and the reminder
/// to mark the next one. A teacher with no classes is shown how to add them.
class HomeTodayCard extends ConsumerWidget {
  const HomeTodayCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toString();
    final today = ref.watch(homeTodayProvider);
    final day = DateTime(today.year, today.month, today.day);
    final classes = ref.watch(todayClassesProvider).valueOrNull;
    final toMark =
        classes?.where((c) => c.state == ClassDayState.toMark).toList() ??
        const <TodayClass>[];

    final weekday = DateFormat('EEEE', locale).format(day);
    final latin = Localizations.localeOf(context).languageCode == 'en';

    final children = <Widget>[
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  latin ? weekday.toUpperCase() : weekday,
                  style: text.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: latin ? 2 : 0,
                    color: AppColors.textEyebrow,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('d MMM', locale).format(day),
                  style: text.headlineMedium?.copyWith(
                    fontSize: 30,
                    height: 1.05,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: AppColors.textStrong,
                  ),
                ),
              ],
            ),
          ),
          if (classes != null && classes.isNotEmpty) ...[
            const SizedBox(width: AppSpacing.space3),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    l10n.homeTodayClasses(classes.length),
                    textAlign: TextAlign.end,
                    style: text.titleLarge?.copyWith(
                      fontSize: 15,
                      color: AppColors.textStrong,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    toMark.isEmpty
                        ? l10n.homeTodayAllMarked
                        : l10n.homeTodayToMark(toMark.length),
                    textAlign: TextAlign.end,
                    style: text.bodySmall?.copyWith(
                      fontSize: 12.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ];

    if (classes != null && classes.isEmpty) {
      children.addAll([
        const SizedBox(height: AppSpacing.space3),
        Text(
          l10n.homeTodayNewBody,
          style: text.bodyMedium?.copyWith(color: AppColors.textBody),
        ),
        const SizedBox(height: AppSpacing.space3),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: _PillButton(
            label: l10n.homeTodayAddClasses,
            fill: AppColors.saffron600,
            ink: AppColors.milk100,
            onTap: () => context.push(Routes.attendanceNewClass),
          ),
        ),
      ]);
    } else if (classes != null) {
      children.addAll([
        const SizedBox(height: AppSpacing.space4),
        _ClassStrip(classes: classes),
        const SizedBox(height: AppSpacing.space3),
        if (toMark.isNotEmpty)
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFFD9932F),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  toMark.length == 1
                      ? l10n.homeTodayUnmarkedOne(toMark.first.name)
                      : l10n.homeTodayUnmarkedMany(toMark.length),
                  style: text.bodyMedium?.copyWith(
                    fontSize: 13.5,
                    color: AppColors.textBody,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              // Flexible: a long translation wraps inside the pill instead
              // of pushing the row past the card.
              Flexible(
                child: _PillButton(
                  label: l10n.homeTodayMarkNow,
                  ink: AppColors.saffron700,
                  onTap: () => context.push(
                    Routes.attendanceMarkPath(toMark.first.classId),
                  ),
                ),
              ),
            ],
          )
        else
          Row(
            children: [
              const Icon(
                LucideIcons.checkCircle,
                size: 16,
                color: AppColors.tileLeafInk,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.homeTodayEveryMarked,
                  style: text.bodyMedium?.copyWith(
                    fontSize: 13.5,
                    color: AppColors.textBody,
                  ),
                ),
              ),
            ],
          ),
      ]);
    }

    return Semantics(
      container: true,
      child: Container(
        key: const ValueKey('home-today'),
        padding: const EdgeInsets.all(18),
        decoration: _cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
}

/// The classes as blocks, side by side; more than fit scroll sideways.
class _ClassStrip extends StatelessWidget {
  const _ClassStrip({required this.classes});

  final List<TodayClass> classes;

  @override
  Widget build(BuildContext context) {
    final blocks = [for (final c in classes) _ClassBlock(item: c)];
    if (classes.length <= 3) {
      return IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < blocks.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(child: blocks[i]),
            ],
            for (var i = blocks.length; i < 3; i++) ...[
              const SizedBox(width: 6),
              const Expanded(child: SizedBox()),
            ],
          ],
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < blocks.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              SizedBox(width: 104, child: blocks[i]),
            ],
          ],
        ),
      ),
    );
  }
}

/// One class: its register state on top (with an icon, never colour alone)
/// and its name and subject beneath. Tapping opens its register.
class _ClassBlock extends StatelessWidget {
  const _ClassBlock({required this.item});

  final TodayClass item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final (fill, ink, icon, status) = switch (item.state) {
      ClassDayState.toMark => (
        _toMarkFill,
        _toMarkInk,
        LucideIcons.circleDashed,
        l10n.homeTodayClassToMark,
      ),
      ClassDayState.absences => (
        AppColors.tileSaffronBg,
        AppColors.tileSaffronInk,
        LucideIcons.userX,
        l10n.homeTodayClassAbsent(item.absent),
      ),
      ClassDayState.marked => (
        AppColors.tileLeafBg,
        AppColors.tileLeafInk,
        LucideIcons.checkCircle,
        l10n.homeTodayClassMarked,
      ),
    };
    final subject = item.subject.trim();
    return Semantics(
      button: true,
      label: [item.name, if (subject.isNotEmpty) subject, status].join(', '),
      excludeSemantics: true,
      child: Material(
        color: fill,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push(Routes.attendanceMarkPath(item.classId)),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    children: [
                      Icon(icon, size: 12, color: ink),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          status,
                          style: text.labelSmall?.copyWith(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subject.isEmpty ? item.name : '${item.name} · $subject',
                    style: text.labelLarge?.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: ink,
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

// ─── This week ──────────────────────────────────────────────────────────────

/// Monday to Saturday as circles: ticked on a day she made something or
/// marked a register, ringed for today, faint for the days ahead.
class HomeWeekStrip extends ConsumerWidget {
  const HomeWeekStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toString();
    final streak = ref.watch(weekStreakProvider);
    final today = ref.watch(homeTodayProvider);
    final weekday = DateTime.utc(today.year, today.month, today.day).weekday;
    final monday = today.addDays(1 - weekday);
    final footer = streak.doneToday
        ? l10n.homeWeekDoneToday
        : l10n.homeWeekKeepGoing;

    String dayName(int i) {
      if (i == streak.todayIndex) return l10n.libraryDayToday;
      final d = monday.addDays(i);
      return DateFormat('EEE', locale).format(DateTime(d.year, d.month, d.day));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _EyebrowRow(
          label: l10n.homeEyebrowWeek,
          trailing: streak.run > 0
              ? Text(
                  l10n.homeWeekRun(streak.run),
                  style: text.labelLarge?.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.tileLeafInk,
                  ),
                )
              : null,
        ),
        const SizedBox(height: AppSpacing.space2),
        Semantics(
          container: true,
          label: [
            if (streak.run > 0) l10n.homeWeekRun(streak.run),
            footer,
          ].join('. '),
          excludeSemantics: true,
          child: Container(
            key: const ValueKey('home-week'),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            decoration: _cardDecoration(radius: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (var i = 0; i < 6; i++)
                      Expanded(
                        child: _DayDot(
                          mark: streak.days[i],
                          label: dayName(i),
                          isToday: i == streak.todayIndex,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space3),
                Text(
                  footer,
                  style: text.bodyMedium?.copyWith(
                    fontSize: 13.5,
                    color: AppColors.textBody,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DayDot extends StatelessWidget {
  const _DayDot({
    required this.mark,
    required this.label,
    required this.isToday,
  });

  final WeekDayMark mark;
  final String label;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final (fill, border, check) = switch (mark) {
      WeekDayMark.done => (AppColors.tileLeafBg, null, AppColors.tileLeafInk),
      WeekDayMark.todayOpen => (
        Colors.transparent,
        Border.all(color: AppColors.saffron400, width: 2),
        null,
      ),
      WeekDayMark.missed => (AppColors.mapOptionIdle, null, null),
      WeekDayMark.ahead => (
        Colors.transparent,
        Border.all(color: AppColors.mapToggleOff, width: 1.5),
        null,
      ),
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: fill,
            shape: BoxShape.circle,
            border: border,
          ),
          child: check == null
              ? null
              : Icon(LucideIcons.check, size: 15, color: check),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            fontSize: 11.5,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w600,
            color: isToday ? AppColors.textEyebrow : AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

// ─── Pick up where you left off ─────────────────────────────────────────────

/// The newest saved work as cards with a coloured band (the type's tint and
/// name), the title and when it was made; then "Make something new".
/// Left out while My work is empty or loading.
class HomePickUp extends ConsumerWidget {
  const HomePickUp({super.key, required this.onOpenMyWork});

  final VoidCallback onOpenMyWork;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(recentWorkProvider);
    if (items.isEmpty) return const SizedBox.shrink();
    final l10n = context.l10n;
    // The gap below is the section's own, so an empty section leaves none.
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _EyebrowRow(
            label: l10n.homeEyebrowPickUp,
            trailing: _EyebrowLink(
              label: l10n.libraryMyWork,
              onTap: onOpenMyWork,
            ),
          ),
          const SizedBox(height: AppSpacing.space1),
          SingleChildScrollView(
            key: const ValueKey('home-pick-up'),
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final item in items) ...[
                    SizedBox(width: 176, child: _WorkCard(item: item)),
                    const SizedBox(width: 10),
                  ],
                  SizedBox(width: 132, child: _MakeNewCard()),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

MapTint _typeTint(ContentType type) => switch (type) {
  ContentType.assessment ||
  ContentType.assessmentSubmission ||
  ContentType.rubric => MapTint.amber,
  _ => toolTint(type.wire),
};

class _WorkCard extends StatelessWidget {
  const _WorkCard({required this.item});

  final LibraryItem item;

  String _when(BuildContext context) {
    final l10n = context.l10n;
    final created = item.createdAt;
    if (created == null) return l10n.libraryDayEarlier;
    final now = DateTime.now();
    final local = created.toLocal();
    final days = DateTime(
      now.year,
      now.month,
      now.day,
    ).difference(DateTime(local.year, local.month, local.day)).inDays;
    if (days == 0) return l10n.libraryDayToday;
    if (days == 1) return l10n.libraryDayYesterday;
    return MaterialLocalizations.of(context).formatShortMonthDay(local);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final tint = _typeTint(item.type);
    final type = typeLabel(l10n, item.type);
    final meta = [
      if ((item.gradeLevel ?? '').trim().isNotEmpty) item.gradeLevel!.trim(),
      _when(context),
    ].join(' · ');
    return Semantics(
      button: true,
      label: '$type, ${item.title}, $meta',
      excludeSemantics: true,
      child: Material(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.libraryDetailPath(item.id)),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderGlass),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  color: tint.fill,
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  child: Row(
                    children: [
                      Icon(item.type.icon, size: 17, color: tint.ink),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          type,
                          style: text.labelMedium?.copyWith(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: tint.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: text.titleLarge?.copyWith(
                          fontSize: 15,
                          height: 1.3,
                          color: AppColors.textStrong,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        meta,
                        style: text.bodySmall?.copyWith(
                          fontSize: 12.5,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MakeNewCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final label = context.l10n.homeMakeNew;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: AppColors.surfaceGlass,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => context.push(Routes.prepDesk),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderHairline),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.tileSaffronBg,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    LucideIcons.plus,
                    size: 22,
                    color: AppColors.tileSaffronInk,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── From the staff room ────────────────────────────────────────────────────

/// Who posted today (initials, then the count) and one post: the Daily
/// Briefing when there is one. Left out until the feed has a post.
class HomeStaffRoom extends ConsumerWidget {
  const HomeStaffRoom({super.key, required this.onOpenCommunity});

  final VoidCallback onOpenCommunity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final glance = ref.watch(staffRoomGlanceProvider);
    final lead = glance?.lead;
    if (glance == null || lead == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final liked =
        ref.watch(likedItemIdsProvider).valueOrNull ?? const LikedItemIds();
    final posted = glance.postedToday;
    // The gap above is the section's own, so an empty section leaves none.
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _EyebrowRow(
            label: l10n.homeEyebrowStaffRoom,
            trailing: _EyebrowLink(
              label: l10n.communityTitle,
              onTap: onOpenCommunity,
            ),
          ),
          if (posted.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space1),
            Semantics(
              label: l10n.homeStaffPostedToday(posted.length),
              excludeSemantics: true,
              child: Row(
                children: [
                  _AvatarStack(names: posted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l10n.homeStaffPostedToday(posted.length),
                      style: text.bodyMedium?.copyWith(
                        fontSize: 13.5,
                        color: AppColors.textBody,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.space3),
          KeyedSubtree(
            key: const ValueKey('home-staff-room-post'),
            child: FeedItemView(item: lead, likedIds: liked),
          ),
        ],
      ),
    );
  }
}

/// Up to three initials circles, overlapping, then "+N".
class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.names});

  final List<String> names;

  static const _tints = [MapTint.indigo, MapTint.saffron, MapTint.leaf];

  static String _initials(String name) {
    final words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2);
    return words
        .map((w) => String.fromCharCode(w.runes.first).toUpperCase())
        .join();
  }

  @override
  Widget build(BuildContext context) {
    final shown = names.take(3).toList();
    final extra = names.length - shown.length;
    final style = Theme.of(context).textTheme.labelSmall?.copyWith(
      fontSize: 10.5,
      fontWeight: FontWeight.w700,
    );
    final circles = <Widget>[
      for (var i = 0; i < shown.length; i++)
        _circle(
          fill: _tints[i].fill,
          child: Text(
            _initials(shown[i]),
            style: style?.copyWith(color: _tints[i].ink),
          ),
        ),
      if (extra > 0)
        _circle(
          fill: AppColors.ink900,
          child: Text(
            '+$extra',
            style: style?.copyWith(color: AppColors.milk100),
          ),
        ),
    ];
    return SizedBox(
      height: 30,
      width: 30.0 + 20.0 * (circles.length - 1),
      child: Stack(
        children: [
          for (var i = 0; i < circles.length; i++)
            PositionedDirectional(start: 20.0 * i, child: circles[i]),
        ],
      ),
    );
  }

  static Widget _circle({required Color fill, required Widget child}) =>
      Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: fill,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.milk50, width: 2),
        ),
        child: child,
      );
}
