import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../vidya_controller.dart';
import '../vidya_presence.dart';
import '../vidya_sheet.dart';
import 'vidya_conversation.dart';
import 'vidya_orb.dart';

/// VIDYA docked in the tab bar, after the four destinations — v2 9a, "VIDYA
/// lives in the tab bar".
///
/// The shell's one orb: while the tab bar is on screen the floating orb hides
/// ([VidyaOverlay]) and this one carries the same state, tap and long-press.
/// The sphere draws at 42px in a 44px touch cell; its float, halo and badge
/// paint outside the cell.
class VidyaDockOrb extends ConsumerWidget {
  const VidyaDockOrb({super.key});

  static const double sphere = 42;
  static const double cell = AppSpacing.dockCell; // 44

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    var visual = ref.watch(vidyaOrbVisualProvider);
    // The docked orb never lifts: drag-to-perch belongs to the floating orb.
    if (visual == VidyaOrbVisual.dragging) visual = VidyaOrbVisual.resting;
    final status = ref.watch(vidyaControllerProvider.select((s) => s.status));
    final readyCount = ref.watch(vidyaReadyCountProvider);

    return SizedBox.square(
      dimension: cell,
      child: OverflowBox(
        maxWidth: double.infinity,
        maxHeight: double.infinity,
        child: VidyaOrb(
          state: visual,
          size: sphere,
          readyCount: readyCount,
          shadows: _shadowFor(visual),
          semanticLabel: context.l10n.appTitle,
          semanticHint: vidyaOrbHintFor(context, visual, status),
          onTap: () => openVidyaFromOrb(context, ref, visual, Routes.home),
          onLongPress: () {
            HapticFeedback.lightImpact();
            showVidyaSheet(context, pagePath: Routes.home);
          },
        ),
      ),
    );
  }

  static List<BoxShadow>? _shadowFor(VidyaOrbVisual visual) {
    switch (visual) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.listening:
      case VidyaOrbVisual.dragging:
        return const [AppShadows.orbDocked];
      case VidyaOrbVisual.working:
        return const [AppShadows.orbDockedWorking];
      case VidyaOrbVisual.ready:
        return const [AppShadows.orbDockedReady];
      case VidyaOrbVisual.offline:
        return null;
    }
  }
}

/// The capsule above the tab bar that says what VIDYA offers here (v2 9a).
///
/// - **Ready**: "Ready · Tap to deliver" with the count — a real button that
///   opens the deliver tray, so a result made on another screen is handed over
///   wherever the teacher is (9a-06).
/// - Otherwise nothing: listening and working speak through the orb and the
///   sheet. Home shows no capsule at all — its big orb carries the words.
class VidyaDockPrompt extends ConsumerWidget {
  const VidyaDockPrompt({super.key, this.showReady = true});

  /// Whether the "Ready · Tap to deliver" capsule shows (off on Home, whose
  /// big orb says it).
  final bool showReady;

  /// Drawn gap between the capsule and the tab bar below it (v2 9a).
  static const double _gap = 10;

  /// The capsule's drawn height: 20px sphere + 7px padding top and bottom.
  static const double _capsuleHeight = 34;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visual = ref.watch(vidyaOrbVisualProvider);
    final readyCount = ref.watch(vidyaReadyCountProvider);
    final conversing = ref.watch(
      vidyaControllerProvider.select((s) => s.conversing),
    );
    final sheetOpen = ref.watch(vidyaSheetOpenProvider);

    // A conversation going on behind a closed sheet: "Mic on · End" above
    // the bar, on every tab including Home.
    if (conversing && !sheetOpen) {
      return const Padding(
        padding: EdgeInsets.only(bottom: _gap),
        child: VidyaMicOnCapsule(),
      );
    }

    // The ready capsule is for the tabs: Home's big orb carries it there.
    if (showReady && visual == VidyaOrbVisual.ready && readyCount > 0) {
      final label = context.l10n.vidyaDockReadyHint;
      // The 44px touch box already centres the capsule with slack below it.
      const slack = (AppSpacing.targetMin - _capsuleHeight) / 2;
      final ready = Semantics(
        button: true,
        label: label,
        value: '$readyCount',
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () =>
              openVidyaFromOrb(context, ref, VidyaOrbVisual.ready, Routes.home),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: AppSpacing.targetMin),
            child: Center(
              widthFactor: 1,
              child: _Capsule(
                state: VidyaOrbVisual.ready,
                label: label,
                textColor: AppColors.textStrong,
                trailing: _CountBadge(count: readyCount),
              ),
            ),
          ),
        ),
      );
      return Padding(
        padding: const EdgeInsets.only(bottom: _gap - slack),
        child: ready,
      );
    }

    return const SizedBox.shrink();
  }
}

/// `surface-capsule` pill: a 20px state sphere and a few words. Words wrap
/// rather than truncate (Indic labels included).
class _Capsule extends StatelessWidget {
  const _Capsule({
    required this.state,
    required this.label,
    required this.textColor,
    this.trailing,
  });

  final VidyaOrbVisual state;
  final String label;
  final Color textColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final bold = MediaQuery.boldTextOf(context);
    final style = Theme.of(context).textTheme.labelMedium!.copyWith(
      color: textColor,
      fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceCapsule,
        borderRadius: AppRadius.rPill,
        border: Border.all(color: AppColors.borderRow),
        boxShadow: const [AppShadows.hint],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(9, 7, 12, 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: VidyaOrb.gradientFor(state),
              ),
              child: const SizedBox.square(dimension: 20),
            ),
            const SizedBox(width: 8),
            Flexible(child: Text(label, style: style)),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

/// The leaf count of ready results, beside the ready capsule's words.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.labelMedium!.copyWith(
      color: AppColors.textOnAccent,
      fontWeight: FontWeight.w700,
      height: 1,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return Container(
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.leaf500,
        borderRadius: AppRadius.rPill,
      ),
      child: Text(count > 9 ? '9+' : '$count', style: style),
    );
  }
}
