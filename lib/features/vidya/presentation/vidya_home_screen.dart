import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/platform/clock.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_gradients.dart';
import '../../../core/theme/app_icon_size.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_shadows.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../inbox/presentation/widgets/inbox_entry_button.dart';
import '../../profile/presentation/profile_controller.dart';
import 'vidya_controller.dart';
import 'vidya_greeting.dart'
    show maybeSpeakVidyaGreeting; // avoid conflicting export
import 'vidya_nav_dispatcher.dart';

/// VIDYA Home — "The Ledger · Ivory & Ink, Saffron & Pine".
///
/// A warm-ivory paper surface: a quiet app bar carries the wordmark, a scriptural
/// hero owns the top with a time-aware greeting and a saffron masthead rule, and
/// the teaching tools land as a register — one raised feature tile, then refined
/// rows. Nothing here is a placeholder: every value comes from the profile or
/// the clock.
class VidyaHomeScreen extends ConsumerStatefulWidget {
  const VidyaHomeScreen({super.key});

  @override
  ConsumerState<VidyaHomeScreen> createState() => _VidyaHomeScreenState();
}

class _VidyaHomeScreenState extends ConsumerState<VidyaHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final controller = ref.read(vidyaControllerProvider.notifier);
      controller.registerScreenContext('/');
      controller.restoreSession();
      maybeSpeakVidyaGreeting(
        ref,
        motionEnabled: context.motionEnabled,
        greeting: context.l10n.vidyaGreeting,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);

    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
      controller.consumeNavigation();
      VidyaNavDispatcher.dispatch(context, directive);
    });

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final wash = isDark ? AppGradients.darkVignette : AppGradients.lightPaper;
    final glow = isDark ? null : AppGradients.lightHeroWash;

    return DecoratedBox(
      decoration: BoxDecoration(gradient: wash),
      child: Stack(
        children: [
          if (glow != null)
            Positioned(
              top: -46,
              right: -54,
              width: 214,
              height: 214,
              child: DecoratedBox(
                decoration: BoxDecoration(shape: BoxShape.circle, gradient: glow),
              ),
            ),
          Scaffold(
            backgroundColor: Colors.transparent,
            appBar: _VidyaAppBar(
              l10n: l10n,
              state: state,
              controller: controller,
            ),
            body: _VidyaBody(
              state: state,
              controller: controller,
              hasConversation: state.hasConversation,
            ),
          ),
        ],
      ),
    );
  }
}

/// Quiet app-bar: seamless chrome, wordmark, and the actions the home needs.
class _VidyaAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _VidyaAppBar({
    required this.l10n,
    required this.state,
    required this.controller,
  });

  final AppLocalizations l10n;
  final VidyaState state;
  final VidyaController controller;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppBar(
      backgroundColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: Colors.transparent,
      centerTitle: false,
      leading: Padding(
        padding: const EdgeInsets.only(left: AppSpacing.space3),
        child: Center(
          child: Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accentTint,
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.auto_awesome,
              size: 16,
              color: AppColors.saffron600,
            ),
          ),
        ),
      ),
      title: Text(
        'SahayakAI',
        style: text.titleLarge?.copyWith(
          fontFamily: 'Bricolage Grotesque',
          fontWeight: FontWeight.w600,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.public_outlined),
          tooltip: l10n.networkTooltip,
          onPressed: () => context.push(Routes.network),
        ),
        const InboxEntryButton(),
        if (state.hasConversation)
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: l10n.vidyaClearConversation,
            onPressed: controller.clearConversation,
          ),
        IconButton(
          icon: const Icon(Icons.dashboard_outlined),
          tooltip: l10n.vidyaPrepDesk,
          onPressed: () => context.push(Routes.prepDesk),
        ),
        Padding(
          padding: const EdgeInsets.only(right: AppSpacing.space3),
          child: Center(
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: scheme.surfaceContainerHigh,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.person_outline,
                size: 18,
                color: AppColors.textBody,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Scroll body: header row, hero, complete-profile flow, tool register.
class _VidyaBody extends ConsumerWidget {
  const _VidyaBody({
    required this.state,
    required this.controller,
    required this.hasConversation,
  });

  final VidyaState state;
  final VidyaController controller;
  final bool hasConversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final profile = ref.watch(profileControllerProvider).valueOrNull;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenGutter,
          AppSpacing.space2,
          AppSpacing.screenGutter,
          AppSpacing.bottomPad,
        ),
        child: RefreshIndicator(
          onRefresh: () async {
            try {
              await ref.read(profileControllerProvider.notifier).refresh();
            } catch (_) {}
            try {
              await controller.restoreSession();
            } catch (_) {}
          },
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                staggeredItem(context, const _HeaderRow(), index: 0),
                const SizedBox(height: AppSpacing.space4),
                staggeredItem(context, const _HeroHeader(), index: 1),
                const SizedBox(height: AppSpacing.space8), // 32
                if (profile != null && profile.isEmpty) ...[
                  staggeredItem(
                    context,
                    const _CompleteProfileCard(),
                    index: 2,
                  ),
                  const SizedBox(height: AppSpacing.space4),
                ],
                staggeredItem(
                  context,
                  EditorialSectionHeader(l10n.dashboardToolsTitle),
                  index: 3,
                ),
                const SizedBox(height: AppSpacing.space4),
                staggeredItem(
                  context,
                  _TileGrid(state: state),
                  index: 4,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Top row: avatar (40px) · date/name · language pill. Kept so the teacher's
/// identity and the active language stay one tap away.
class _HeaderRow extends ConsumerWidget {
  const _HeaderRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    final profile = ref.watch(profileControllerProvider).valueOrNull;
    final storedName = profile?.displayName?.trim();
    final name = (storedName != null && storedName.isNotEmpty)
        ? storedName
        : l10n.profileNoName;
    final initials = _initialsOf(name);
    final today = _formatToday(context, ref.read(nowProvider)());
    final current = AppLocale.fromCode(
      Localizations.localeOf(context).languageCode,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.85),
            border: Border.all(
              color: AppColors.borderGlass,
              width: 1,
            ),
            boxShadow: const [AppShadows.card],
          ),
          alignment: Alignment.center,
          child: initials == null
              ? const Icon(
                  Icons.person_outline,
                  size: 18,
                  color: AppColors.textBody,
                )
              : Text(
                  initials,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontFamily: 'Instrument Sans',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textBody,
                      ),
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                today,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontFamily: 'Instrument Sans',
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textBody,
                    ),
              ),
              Text(
                name,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontFamily: 'Bricolage Grotesque',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                      letterSpacing: -0.2,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: () => showLanguagePickerSheet(context, ref),
            borderRadius: AppRadius.rPill,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  borderRadius: AppRadius.rPill,
                  color: Colors.white.withValues(alpha: 0.8),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.95),
                    width: 1,
                  ),
                ),
                child: Text(
                  current.nativeLabel,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontFamily: 'Instrument Sans',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.saffron600,
                      ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Hero header: saffron eyebrow (date · school), greeting, saffron rule,
/// and an optional summary strip driven by real profile data.
class _HeroHeader extends ConsumerWidget {
  const _HeroHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final profile = ref.watch(profileControllerProvider).valueOrNull;
    final name = (profile?.displayName?.trim().isNotEmpty ?? false)
        ? profile!.displayName!.trim()
        : 'Teacher';

    final hour = ref.read(nowProvider)().hour;
    String salutation;
    if (hour >= 5 && hour <= 11) {
      salutation = l10n.dashboardGreetingMorning;
    } else if (hour >= 12 && hour <= 16) {
      salutation = l10n.dashboardGreetingAfternoon;
    } else if (hour >= 17 && hour <= 20) {
      salutation = l10n.dashboardGreetingEvening;
    } else {
      salutation = l10n.dashboardGreetingEvening;
    }

    final school = profile?.schoolName?.trim();
    final weekday = DateFormat('EEEE').format(ref.read(nowProvider)());
    final eyebrow = (school != null && school.isNotEmpty)
        ? '$weekday · $school'
        : weekday;

    final gradeLevels = profile?.gradeLevels ?? const <String>[];
    final subjects = profile?.subjects ?? const <String>[];
    final hasSummary = gradeLevels.isNotEmpty || subjects.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space4,
        AppSpacing.space2,
        AppSpacing.space4,
        AppSpacing.space6,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            eyebrow.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.saffron600,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            '$salutation, $name.',
            style: text.displayMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.space3),
          const SizedBox(
            width: 48,
            height: 2,
            child: DecoratedBox(
              decoration: BoxDecoration(gradient: AppGradients.accentBar),
            ),
          ),
          const SizedBox(height: AppSpacing.space3),
          if (hasSummary)
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                Text(
                  '${gradeLevels.join(', ')} · ${subjects.join(', ')}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            )
          else
            Text(
              'Complete your profile to personalize your experience',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
        ],
      ),
    );
  }
}

String _formatToday(BuildContext context, DateTime day) {
  final locale = Localizations.localeOf(context);
  if (locale.languageCode == 'en') {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sept',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${DateFormat('EEE', locale.toString()).format(day)}, '
        '${day.day} ${months[day.month - 1]}';
  }
  return DateFormat('EEE, d MMM', locale.toString()).format(day);
}

String? _initialsOf(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return null;

  final words = trimmed
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .take(2);

  final buffer = StringBuffer();
  for (final word in words) {
    buffer.write(String.fromCharCode(word.runes.first).toUpperCase());
  }
  final initials = buffer.toString();
  return initials.isEmpty ? null : initials;
}

/// 2×2 tile grid, now built on the premium AppCard + IconWell grammar while
/// keeping the runtime type `_Tile` so the grid remains addressable.
class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.state});

  final VidyaState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth = (constraints.maxWidth - AppSpacing.gridGap) / 2;
        return Column(
          children: [
            Row(
              children: [
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    featured: true,
                    icon: LucideIcons.userCheck,
                    title: l10n.homeTileRollCall,
                    subtitle: l10n.homeTileRollCallSub,
                    onTap: () => context.push(Routes.attendance),
                  ),
                ),
                const SizedBox(width: AppSpacing.gridGap),
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    icon: LucideIcons.bookOpen,
                    title: l10n.homeTileLesson,
                    subtitle: l10n.homeTileLessonSub,
                    onTap: () => context.push(Routes.lessonPlan),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.gridGap),
            Row(
              children: [
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    key: const ValueKey('home-tile-scan'),
                    icon: LucideIcons.scanLine,
                    title: l10n.homeTileScan,
                    subtitle: l10n.homeTileScanSub,
                    onTap: () => context.push(Routes.assessmentScanner),
                  ),
                ),
                const SizedBox(width: AppSpacing.gridGap),
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    icon: LucideIcons.phone,
                    title: l10n.homeTileCall,
                    subtitle: l10n.homeTileCallSub,
                    onTap: () => context.push(Routes.parentHotline),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon,
    this.onTap,
    this.featured = false,
  });

  final String title;
  final String subtitle;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    const saffron = AppColors.saffron600;

    if (featured) {
      return AppCard(
        variant: AppCardVariant.elevated,
        accentBar: true,
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                if (icon != null) IconWell(icon: icon!, feature: true),
                const SizedBox(width: AppSpacing.space4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title, style: text.titleLarge),
                      const SizedBox(height: AppSpacing.space1),
                      Text(
                        subtitle,
                        style: text.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space4),
            ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.actionOpen,
                    style: text.labelLarge?.copyWith(color: saffron),
                  ),
                  const SizedBox(width: AppSpacing.space1),
                  Icon(
                    LucideIcons.chevronRight,
                    size: AppIconSize.inline,
                    color: saffron,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          if (icon != null) IconWell(icon: icon!),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  subtitle,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: scheme.surfaceContainerHigh,
            ),
            alignment: Alignment.center,
            child: Icon(
              LucideIcons.chevronRight,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// "Complete your profile" card shown when the teacher's profile is empty.
class _CompleteProfileCard extends StatelessWidget {
  const _CompleteProfileCard();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      variant: AppCardVariant.elevated,
      accentBar: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: AppColors.accent,
              borderRadius: AppRadius.rField,
            ),
            alignment: Alignment.center,
            child: const Icon(
              LucideIcons.userPlus,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Complete your profile',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontFamily: 'Bricolage Grotesque',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textStrong,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Add your name, school, subjects and grade levels to '
                  'personalize VIDYA.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontFamily: 'Instrument Sans',
                        fontSize: 12,
                        color: AppColors.textBody,
                        height: 1.4,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          FilledButton(
            onPressed: () => context.push(Routes.profile),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: const RoundedRectangleBorder(
                borderRadius: AppRadius.rPill,
              ),
            ),
            child: const Text('Complete'),
          ),
        ],
      ),
    );
  }
}

// No extra top-level helpers beyond those already defined.