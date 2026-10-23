import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/platform/clock.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_glass.dart';
import '../../../core/theme/app_gradients.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_shadows.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/glass_surface.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../inbox/presentation/widgets/inbox_entry_button.dart';
import '../../profile/presentation/profile_controller.dart';
import 'vidya_controller.dart';
import 'vidya_greeting.dart'
    show maybeSpeakVidyaGreeting; // avoid conflicting export
import 'vidya_nav_dispatcher.dart';

/// Voice Home — Design System v3 Screen 02 "Voice home · orb parked bottom-right".
///
/// Layout (verbatim from SahayakAI Mobile v3.dc.html):
/// - Top row: 36px glass avatar (initials from the profile) · today's date
///   (clock) / the teacher's name (profile) · language pill showing the ACTIVE
///   language's endonym, tappable to open the shared language picker
/// - Hero: "Two periods, / one prep gap" (700 26px Bricolage, two lines)
/// - Sub: "Class 7 Maths at 10:20 · Class 5 EVS at 12:00" (middle dot separator)
/// - "Waiting for you" glass card (r20, soft shadow) with eyebrow
///   - Red task: "4 absentees to call" + Open
///   - Amber task: "34 test sheets to scan" + Open
///   - Green task: "Fractions lesson ready" + Open
/// - 2×2 tile grid (r18, .70 glass): Roll call / Make a lesson / Scan a test / Call parents
/// - Orb 56px parked bottom:100 right:16 + hint capsule "Tap to speak"
/// - Floating tab bar (Home active) centred 18px from bottom
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
    // The v3 wash + saffron glow paint the ENTIRE frame — status bar through
    // the bottom edge, behind the transparent app bar and the floating tab
    // bar — so they live OUTSIDE the Scaffold (the same canonical layering
    // tool_scaffold / network hub / me use) instead of inside the body slot,
    // which shrink-wrapped to content and left a milk band below it.
    final wash = isDark ? AppGradients.darkVignette : AppGradients.washDefault;
    final glow = isDark ? null : AppGradients.glowSaffron;

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
            appBar: _HomeAppBar(
              l10n: l10n,
              state: state,
              controller: controller,
            ),
            body: _HomeBody(
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

/// App bar matching the design: transparent, no title, actions only.
class _HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _HomeAppBar({
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
      foregroundColor: Theme.of(context).colorScheme.onSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      shadowColor: Colors.transparent,
      centerTitle: false,
      title: const SizedBox.shrink(),
      actions: [
        // Network hub
        IconButton(
          icon: const Icon(Icons.public_outlined),
          tooltip: l10n.networkTooltip,
          onPressed: () => context.push(Routes.network),
        ),
        // Inbox
        const InboxEntryButton(),
        // Clear conversation
        if (state.hasConversation)
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: l10n.vidyaClearConversation,
            onPressed: controller.clearConversation,
          ),
        // Prep desk
        IconButton(
          icon: const Icon(Icons.dashboard_outlined),
          tooltip: l10n.vidyaPrepDesk,
          onPressed: () => context.push(Routes.prepDesk),
        ),
      ],
    );
  }
}

/// Body with the exact v3 layout: avatar row, hero, task card, tile grid, orb + tab bar.
class _HomeBody extends ConsumerWidget {
  const _HomeBody({
    required this.state,
    required this.controller,
    required this.hasConversation,
  });

  final VidyaState state;
  final VidyaController controller;
  final bool hasConversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Content only: the wash + glow paint the whole frame behind the
    // Scaffold (see the screen root), so this body is free to sit at its
    // natural height at the top of the body slot.
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenGutter, // 20
          AppSpacing.verticalGap, // 14
          AppSpacing.screenGutter,
          AppSpacing.bottomPad, // 96 (clears floating tab bar)
        ),
        // Scrollable (matching the baseline home's scroll body): the
        // fixed chrome — hero, task card and the 2×2 tile grid — is a
        // rigid column that outgrows this viewport when the system
        // text scale climbs toward the §12.9 1.3 gate, so it scrolls
        // instead of overflowing. The trailing Spacer is dropped: it
        // pinned content to the top but never absorbed the deficit
        // (a Spacer can't go below zero), which is what pushed the
        // RenderFlex past its 734px bottom edge at 360dp x 1.3.
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _HeaderRow(),
              const SizedBox(height: AppSpacing.verticalGap), // 14
              const _HeroSection(),
              const SizedBox(height: AppSpacing.verticalGap), // 14
              _WaitingForYouCard(),
              const SizedBox(height: AppSpacing.verticalGap), // 14
              _TileGrid(),
              // Orb + hint is rendered by VidyaOverlay
            ],
          ),
        ),
      ),
    );
  }
}

/// Top row: avatar (36px glass) · date/name · language pill.
///
/// The date comes from [nowProvider] and the name/initials from the profile,
/// so this shows the real teacher and TODAY instead of the mock's fixed
/// persona. The pill is white glass per the design and shows the ACTIVE
/// language's endonym; tapping it opens the shared language picker, so the
/// headline "switch language, the whole app follows" starts right here.
class _HeaderRow extends ConsumerWidget {
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
        // 36px glass avatar circle
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.8),
            border: Border.all(
              color: AppColors.borderGlass,
              width: 1,
            ),
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
        // Date + Name. Expanded (not a bare Column) so at a narrow width or a
        // large text scale the name wraps within the row instead of pushing the
        // language pill past the right gutter (DESIGN_RUBRIC §12.9: no
        // horizontal overflow). The trailing Spacer then yields its space.
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
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textStrong,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        // Language pill — design: rgba(255,255,255,.8) fill, rgba(255,255,255,.95)
        // border, #A5551D 10/600 text, 7px 11px padding. The outer 3×8 padding
        // grows the TAP area to ≥42px tall without changing the pill's visual box.
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

/// Today as the design's date line: `Tue, 18 Sept` in English (the mock spells
/// September out — `DateFormat` would abbreviate it to "Sep"), and the same
/// `EEE, d MMM` shape localized for every other locale. Read through
/// [nowProvider], never a raw `DateTime.now()`, so goldens stay deterministic.
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

/// "Meena Kulkarni" → "MK"; a single-word name → its first letter. Each initial
/// is taken from the first RUNE of its word (never `substring`), so an Indic or
/// astral character is never split in half — the same rule the You tab's
/// `_initialsOf` applies.
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

/// Hero: "Two periods, / one prep gap" + subtitle with middle dot.
///
/// The subtitle now builds from the teacher's own profile (grade levels +
/// subjects set during profile generation), falling back to the static
/// `homeHeroSubtitle` when nothing has been saved yet.
class _HeroSection extends ConsumerWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extras = AppTextExtras.of(context);
    final l10n = context.l10n;
    final profile = ref.watch(profileControllerProvider).valueOrNull;

    // Build the subtitle from the teacher's own classes/subjects so the home
    // screen reflects their actual data instead of a placeholder.
    String subtitle;
    if (profile != null && profile.gradeLevels.isNotEmpty && profile.subjects.isNotEmpty) {
      subtitle = '${profile.gradeLevels.join(", ")} · ${profile.subjects.join(", ")}';
    } else {
      subtitle = l10n.homeHeroSubtitle;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero title — design: 700 26px Bricolage, letter-spacing −.012em
        // (≈ −0.31px at 26), line-height 1.16, the line break built into the copy.
        Text(
          l10n.homeHeroTitle,
          style: extras.displayHero.copyWith(
            fontSize: 26,
            height: 1.16,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.31,
          ),
        ),
        const SizedBox(height: 7),
        // Subtitle — one flat #5C534A line; the design colours the middle dot
        // exactly like the words around it, so there is no muted span here.
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontFamily: 'Instrument Sans',
                fontSize: 12,
                color: AppColors.textBody,
                height: 1.55,
              ),
        ),
      ],
    );
  }
}

/// "Waiting for you" glass card with three task rows
class _WaitingForYouCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final extras = AppTextExtras.of(context);

    // The design's shadow `0 8px 20px rgba(23,19,16,.06)` lives OUTSIDE the
    // glass: GlassSurface clips its child to the squircle, so a shadow declared
    // on an inner box is clipped away instead of falling on the wash.
    return DecoratedBox(
      decoration: const BoxDecoration(
        borderRadius: AppRadius.rPanel,
        boxShadow: [AppShadows.card],
      ),
      child: GlassSurface.flat(
        radius: AppRadius.panel, // 20
        padding: EdgeInsets.zero,
        addSheen: false,
        child: Padding(
          // Design: `padding: 14px 15px`, `gap: 10px` between every child.
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Eyebrow — the design uppercases "Waiting for you" with CSS
              // text-transform; `.toUpperCase()` is a no-op on Indic scripts.
              Text(
                l10n.homeEyebrowWaiting.toUpperCase(),
                style: extras.eyebrow.copyWith(
                  fontSize: 10,
                  height: 1.2,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 10),
              // Three task rows
              _TaskRow(
                dotColor: AppColors.red500,
                label: l10n.homeTaskAbsent,
                actionLabel: l10n.actionOpen,
                onAction: () => context.push(Routes.attendance),
              ),
              const SizedBox(height: 10),
              _TaskRow(
                dotColor: AppColors.amber500,
                label: l10n.homeTaskScanSheets,
                actionLabel: l10n.actionOpen,
                onAction: () => context.push(Routes.assessmentScanner),
              ),
              const SizedBox(height: 10),
              _TaskRow(
                dotColor: AppColors.leaf500,
                label: l10n.homeTaskLessonReady,
                actionLabel: l10n.actionOpen,
                onAction: () => context.push(Routes.lessonPlan),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Task row: status dot + label + saffron "Open" action
class _TaskRow extends StatelessWidget {
  const _TaskRow({
    required this.dotColor,
    required this.label,
    required this.actionLabel,
    required this.onAction,
  });

  final Color dotColor;
  final String label;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    // The design paints "Open" flush to the row's right edge with no padding of
    // its own; instead of a ~14px-tall tap sliver around the word, the WHOLE
    // ROW is the target — same pixels, a wide hit area.
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onAction,
        child: Row(
          children: [
            // 8px status dot
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: dotColor,
              ),
            ),
            const SizedBox(width: 10),
            // Label — design: `500 12px`, full-strength ink (#171310), so the
            // task reads as strongly as the card around it.
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontFamily: 'Instrument Sans',
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textStrong,
                      height: 1.3,
                    ),
              ),
            ),
            // Saffron "Open" action
            Text(
              actionLabel,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontFamily: 'Instrument Sans',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.saffron600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 2×2 tile grid (r18, .70 glass, 13px padding)
class _TileGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth = (constraints.maxWidth - 9) / 2; // 9 = gap
        return Column(
          children: [
            Row(
              children: [
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    title: l10n.homeTileRollCall,
                    subtitle: l10n.homeTileRollCallSub,
                    onTap: () => context.push(Routes.attendance),
                  ),
                ),
                const SizedBox(width: 9),
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    title: l10n.homeTileLesson,
                    subtitle: l10n.homeTileLessonSub,
                    onTap: () => context.push(Routes.lessonPlan),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 9),
            Row(
              children: [
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
                    key: const ValueKey('home-tile-scan'),
                    title: l10n.homeTileScan,
                    subtitle: l10n.homeTileScanSub,
                    onTap: () => context.push(Routes.assessmentScanner),
                  ),
                ),
                const SizedBox(width: 9),
                SizedBox(
                  width: tileWidth,
                  child: _Tile(
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

/// Tile: 70% white glass (`.70 white` + 1px 95%-white border), card radius 18
/// and 13px padding — Screen 02's 2×2 home grid renders its tiles at the CARD
/// radius (18), one step above the generic tile token (16).
class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: isDark ? AppGlass.dFlatFillSoft : AppGlass.lFlatFillSoft,
        borderRadius: AppRadius.rCard, // 18 per Screen 02's tiles
        border: Border.all(
          color: isDark ? AppGlass.dBorderColor : AppGlass.lBorderColor,
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.rCard,
          child: Padding(
            padding: AppSpacing.tilePadding, // 13
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontFamily: 'Bricolage Grotesque',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textStrong,
                        height: 1.3,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontFamily: 'Instrument Sans',
                        fontSize: 11,
                        color: AppColors.textBody, // #5C534A, design-exact
                        height: 1.45,
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