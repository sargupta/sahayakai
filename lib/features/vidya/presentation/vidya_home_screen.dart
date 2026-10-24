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
import '../../../core/theme/app_radius.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../inbox/presentation/widgets/inbox_entry_button.dart';
import '../../profile/presentation/profile_controller.dart';
import 'vidya_controller.dart';
import 'vidya_greeting.dart' show maybeSpeakVidyaGreeting;
import 'vidya_nav_dispatcher.dart';

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

    return DecoratedBox(
      decoration: BoxDecoration(gradient: wash),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: _VidyaAppBar(l10n: l10n, state: state, controller: controller),
        body: _VidyaBody(state: state, controller: controller),
      ),
    );
  }
}

// ─── App bar: calm, identity left, 3 actions right ──────────────────────────

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
    return AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      title: const Text(
        'SahayakAI',
        style: TextStyle(
          fontFamily: 'Bricolage Grotesque',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: AppColors.textStrong,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.public_outlined, size: 20),
          tooltip: l10n.networkTooltip,
          onPressed: () => context.push(Routes.network),
        ),
        const InboxEntryButton(),
        if (state.hasConversation)
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            tooltip: l10n.vidyaClearConversation,
            onPressed: controller.clearConversation,
          ),
        IconButton(
          icon: const Icon(Icons.dashboard_outlined, size: 20),
          tooltip: l10n.vidyaPrepDesk,
          onPressed: () => context.push(Routes.prepDesk),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Center(
            child: Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.saffron500,
              ),
              alignment: Alignment.center,
              child: const Text(
                'S',
                style: TextStyle(
                  fontFamily: 'Bricolage Grotesque',
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Body ────────────────────────────────────────────────────────────────────

class _VidyaBody extends ConsumerWidget {
  const _VidyaBody({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider).valueOrNull;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
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
              children: [
                const SizedBox(height: 16),
                const _HeaderRow(),
                const SizedBox(height: 24),
                const _Hero(),
                const SizedBox(height: 24),
                if (profile != null && profile.isEmpty) ...[
                  const _CompleteProfileCard(),
                  const SizedBox(height: 24),
                ],
                const _TodayCard(),
                const SizedBox(height: 24),
                const Text(
                  'YOUR TOOLS',
                  style: TextStyle(
                    fontFamily: 'Instrument Sans',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.saffron600,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                _TileGrid(state: state),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Header row: avatar, name, date ─────────────────────────────────────────

class _HeaderRow extends ConsumerWidget {
  const _HeaderRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider).valueOrNull;
    final storedName = profile?.displayName?.trim();
    final name = (storedName != null && storedName.isNotEmpty)
        ? storedName
        : 'Teacher';
    final initials = _initialsOf(name);
    final today = _formatToday(context, ref.read(nowProvider)());
    final current = AppLocale.fromCode(
      Localizations.localeOf(context).languageCode,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.85),
            border: Border.all(color: AppColors.borderGlass, width: 1),
            boxShadow: null,
          ),
          alignment: Alignment.center,
          child: initials == null
              ? const Icon(LucideIcons.user, size: 18, color: AppColors.textBody)
              : Text(
                  initials,
                  style: const TextStyle(
                    fontFamily: 'Instrument Sans',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textBody,
                  ),
                ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                today,
                style: const TextStyle(
                  fontFamily: 'Instrument Sans',
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textBody,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                name,
                style: const TextStyle(
                  fontFamily: 'Bricolage Grotesque',
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textStrong,
                  height: 1.1,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => showLanguagePickerSheet(context, ref),
            borderRadius: AppRadius.rPill,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                style: const TextStyle(
                  fontFamily: 'Instrument Sans',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.saffron600,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Hero (greeting + date) ───────────────────────────────────────────────

class _Hero extends ConsumerWidget {
  const _Hero();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider).valueOrNull;
    final name = profile?.displayName?.trim();

    final hour = ref.read(nowProvider)().hour;
    String salutation;
    if (hour < 12) {
      salutation = 'Good morning';
    } else if (hour < 17) {
      salutation = 'Good afternoon';
    } else {
      salutation = 'Good evening';
    }

    final school = profile?.schoolName?.trim();
    final gradeLevels = profile?.gradeLevels ?? const <String>[];
    final subjects = profile?.subjects ?? const <String>[];
    final hasSummary = gradeLevels.isNotEmpty || subjects.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          name != null && name.isNotEmpty ? '$salutation, ${name.split(' ').first}' : salutation,
          style: const TextStyle(
            fontFamily: 'Bricolage Grotesque',
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: AppColors.textStrong,
            height: 1.15,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _formatTodayFull(context, ref.read(nowProvider)()) +
              (school != null && school.isNotEmpty ? '  ·  $school' : ''),
          style: const TextStyle(
            fontFamily: 'Instrument Sans',
            fontSize: 13,
            fontWeight: FontWeight.w400,
            color: AppColors.textBody,
            height: 1.4,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        if (hasSummary) ...[
          const SizedBox(height: 8),
          Text(
            '${gradeLevels.join(', ')} · ${subjects.join(', ')}',
            style: const TextStyle(
              fontFamily: 'Instrument Sans',
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: AppColors.textBody,
              height: 1.4,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ] else ...[
          const SizedBox(height: 8),
          const Text(
            'Complete your profile to personalize your experience',
            style: TextStyle(
              fontFamily: 'Instrument Sans',
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: AppColors.textMuted,
              height: 1.4,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ],
    );
  }
}

String _formatTodayFull(BuildContext context, DateTime day) {
  final locale = Localizations.localeOf(context);
  if (locale.languageCode == 'en') {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return '${DateFormat('EEEE', locale.toString()).format(day)}, '
        '${day.day} ${months[day.month - 1]}';
  }
  return DateFormat('EEEE, d MMM', locale.toString()).format(day);
}

// ─── Today card (actionable strip) ─────────────────────────────────────────

class _TodayCard extends StatelessWidget {
  const _TodayCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14171310), width: 1),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0x1FFAF1E8),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.clipboardCheck, size: 18, color: AppColors.saffron600),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Today',
                  style: TextStyle(
                    fontFamily: 'Bricolage Grotesque',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                    height: 1.2,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Start with your class roll call',
                  style: TextStyle(
                    fontFamily: 'Instrument Sans',
                    fontSize: 12,
                    color: AppColors.textBody,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

// ─── Tile grid (2x2 equal) ─────────────────────────────────────────────────

class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.state});

  final VidyaState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = (constraints.maxWidth - 10) / 2;
        return Column(
          children: [
            Row(
              children: [
                SizedBox(
                  width: w,
                  child: _Tile(
                    icon: LucideIcons.userCheck,
                    color: const Color(0xFFC96A28),
                    tint: const Color(0x1FC96A28),
                    border: const Color(0x33C96A28),
                    title: l10n.homeTileRollCall,
                    subtitle: 'Speak the names',
                    onTap: () => context.push(Routes.attendance),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: w,
                  child: _Tile(
                    icon: LucideIcons.bookOpen,
                    color: const Color(0xFF2C5F2D),
                    tint: const Color(0x1F2C5F2D),
                    border: const Color(0x332C5F2D),
                    title: l10n.homeTileLesson,
                    subtitle: 'Plan a 5E lesson',
                    onTap: () => context.push(Routes.lessonPlan),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                SizedBox(
                  width: w,
                  child: _Tile(
                    key: const ValueKey('home-tile-scan'),
                    icon: LucideIcons.scanLine,
                    color: const Color(0xFF2A3B8F),
                    tint: const Color(0x1F2A3B8F),
                    border: const Color(0x332A3B8F),
                    title: l10n.homeTileScan,
                    subtitle: 'Check sheets',
                    onTap: () => context.push(Routes.assessmentScanner),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: w,
                  child: _Tile(
                    icon: LucideIcons.users,
                    color: const Color(0xFFB45309),
                    tint: const Color(0x1FB45309),
                    border: const Color(0x33B45309),
                    title: l10n.homeTileCall,
                    subtitle: 'Reach parents',
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
    required this.icon,
    required this.color,
    required this.tint,
    required this.border,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final Color tint;
  final Color border;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: color.withValues(alpha: 0.08),
        highlightColor: color.withValues(alpha: 0.04),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0x12171310), width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: tint,
                  border: Border.all(color: border, width: 1),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Bricolage Grotesque',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textStrong,
                  height: 1.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontFamily: 'Instrument Sans',
                  fontSize: 11,
                  fontWeight: FontWeight.w400,
                  color: AppColors.textBody,
                  height: 1.3,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Complete profile ─────────────────────────────────────────────────────

class _CompleteProfileCard extends StatelessWidget {
  const _CompleteProfileCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.accentTintBorder, width: 1),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.accentTint,
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.userPlus, size: 18, color: AppColors.saffron600),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Complete your profile',
                  style: TextStyle(
                    fontFamily: 'Bricolage Grotesque',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textStrong,
                    height: 1.2,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Add name, school, subjects, grades',
                  style: TextStyle(
                    fontFamily: 'Instrument Sans',
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textBody,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => context.push(Routes.profile),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.saffron500,
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'Setup',
                style: TextStyle(
                  fontFamily: 'Instrument Sans',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
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
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
    ];
    return '${DateFormat('EEE', locale.toString()).format(day)}, '
        '${day.day} ${months[day.month - 1]}';
  }
  return DateFormat('EEE, d MMM', locale.toString()).format(day);
}

String? _initialsOf(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return null;
  final words = trimmed.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2);
  final buffer = StringBuffer();
  for (final word in words) {
    buffer.write(String.fromCharCode(word.runes.first).toUpperCase());
  }
  final initials = buffer.toString();
  return initials.isEmpty ? null : initials;
}
