import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/secondary_button.dart';
import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/vidya_orb.dart';

/// True while the VIDYA sheet (v3 Screen 04) is on screen. The floating orb
/// hides underneath it — Screen 04 puts the ONLY orb inside the sheet's header,
/// and a second orb riding over the composer would be a duplicate.
final vidyaSheetOpenProvider = StateProvider<bool>((ref) => false);

/// Opens VIDYA as a modal sheet from anywhere — the "co-teacher on every page"
/// affordance (SPEC §C.6). Reuses the SAME top-level [VidyaController] as the
/// home, so the conversation is continuous across surfaces.
///
/// This is also what Screen 04 "Listening" IS: the sheet over the dimmed page,
/// its header orb pulsing while the mic is hot.
Future<void> showVidyaSheet(BuildContext context, {String? pagePath}) {
  // Captured BEFORE the modal covers the route: the sheet shows which page it
  // is listening "about" (v3 Screen 04's "THIS PAGE" line).
  final path = pagePath ?? GoRouter.maybeOf(context)?.state.uri.path;
  final container = ProviderScope.containerOf(context, listen: false);
  container.read(vidyaSheetOpenProvider.notifier).state = true;
  // Guard: if `showModalBottomSheet` throws synchronously (e.g. the context
  // has no Navigator — the floating overlay's doesn't), reset the flag so the
  // orb is never latched off behind a sheet that never appeared.
  late final Future<void> sheet;
  try {
    sheet = showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      elevation: 0,
      isScrollControlled: true,
      // v3 Screen 04: the page behind recedes — the design dims the content to
      // .34 under a .14 ink scrim. The app can't fade the live page, so the
      // paired washout is approximated with a single ink scrim.
      barrierColor: AppColors.ink900.withValues(alpha: 0.28),
      builder: (_) => VidyaSheet(pagePath: path),
    );
  } catch (_) {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
    rethrow;
  }
  return sheet.whenComplete(() {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
  });
}

/// A small app-bar action that opens the VIDYA sheet. Added to [ToolScaffold]
/// so VIDYA is reachable from every tool screen without going back Home;
/// unobtrusive (one glyph in the app bar), never on the result view.
class VidyaAppBarAction extends StatelessWidget {
  const VidyaAppBarAction({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return IconButton(
      icon: const Icon(LucideIcons.sparkles),
      tooltip: l10n.vidyaOpen,
      onPressed: () => showVidyaSheet(context),
    );
  }
}

/// The VIDYA sheet body — v3 Screen 04 "Listening", a milk (opaque) sheet with
/// a 26px top radius over the receding page:
///   grab handle → header (46px pulsing orb + status title + language subtitle
///   + "Mic on" badge) → THIS PAGE context → the running conversation → the
///   54px composer pill ("Or type what you need…" + 40px saffron mic/send).
/// Terminal states (mic denied / failed / upgrade / limit / signed out) swap
/// the conversation and composer for the dignified panel. A single valid
/// intent routes to its tool (and closes the sheet); a compound intent offers
/// confirm chips.
class VidyaSheet extends ConsumerStatefulWidget {
  const VidyaSheet({super.key, this.pagePath});

  /// The route the sheet was opened over, for the "THIS PAGE" line.
  final String? pagePath;

  @override
  ConsumerState<VidyaSheet> createState() => _VidyaSheetState();
}

class _VidyaSheetState extends ConsumerState<VidyaSheet>
    with SingleTickerProviderStateMixin {
  final TextEditingController _input = TextEditingController();

  /// Composer mic pulse — CSS `micpulse 2.2s` from Screen 04.
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    // `_syncPulse` reads `motionEnabled` (an inherited MediaQuery) — it must
    // run from didChangeDependencies, never from initState.
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPulse();
  }

  void _syncPulse() {
    if (!context.motionEnabled) {
      _pulse.stop();
      _pulse.value = 0;
      return;
    }
    if (!_pulse.isAnimating) _pulse.repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    _input.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text;
    _input.clear();
    if (mounted) setState(() {}); // the send button flips back to the mic
    await ref.read(vidyaControllerProvider.notifier).sendText(text);
  }

  /// The orb's visual for a machine state — same mapping as the floating orb
  /// (the two must not drift), minus placement/ready concerns.
  static VidyaOrbVisual _visualFor(VidyaStatus status) {
    switch (status) {
      case VidyaStatus.requestingPermission:
      case VidyaStatus.listening:
        return VidyaOrbVisual.listening;
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
      case VidyaStatus.speaking:
        return VidyaOrbVisual.working;
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.failed:
        return VidyaOrbVisual.resting;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);
    final terminal = isVidyaTerminal(state.status);
    final title =
        vidyaStateCaption(state.status, l10n) ??
        l10n.vidyaOpen; // terminal states: the panel carries the specifics

    // A single valid intent routes to its tool and closes the sheet. The router
    // is captured before the pop (the sheet's own context is defunct after it).
    ref.listen(vidyaControllerProvider.select((s) => s.pendingNavigation), (
      _,
      directive,
    ) {
      if (directive == null) return;
      final route = VidyaNavDispatcher.routeForFlow(directive.flow);
      controller.consumeNavigation();
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      if (route != null) {
        final prefill = VidyaNavDispatcher.prefillFor(directive.params);
        router.push(route, extra: prefill.isEmpty ? null : prefill);
      }
    });

    final pageLabel = _pageLabelFor(widget.pagePath, l10n);
    final hasText = _input.text.trim().isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.72,
        ),
        // OPAQUE MILK SHEET (design): `#FFFDF9` fill, 26px top radius, and the
        // design's own `0 -14px 40px rgba(23,19,16,.18)` lift — not glass: the
        // page behind is meant to recede, not show through.
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.milk50,
            borderRadius: AppRadius.rSheet,
            boxShadow: [AppShadows.sheet],
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: AppSpacing.sheetPadding, // 14 / 18 / 20 (design)
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _GrabHandle(),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      VidyaOrb(
                        state: _visualFor(state.status),
                        size: AppSpacing.orbListeningSize, // 46 (design)
                        onTap: controller.onMicTap,
                        semanticLabel: l10n.appTitle,
                        semanticHint: title,
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(title, style: text.titleMedium),
                            const SizedBox(height: 1),
                            Text(
                              '${AppLocale.fromCode(Localizations.localeOf(context).languageCode).nativeLabel} — ${l10n.vidyaAboutThisPage}',
                              style: text.bodySmall?.copyWith(
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (state.status == VidyaStatus.listening) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.leaf100,
                            borderRadius: BorderRadius.circular(9999),
                          ),
                          child: Text(
                            l10n.vidyaMicOn,
                            style: text.labelSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.leaf700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (pageLabel != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
                      decoration: BoxDecoration(
                        color: AppColors.milk300,
                        borderRadius: AppRadius.rField, // 14 (design)
                        border: Border.all(
                          color: AppColors.ink900.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.vidyaThisPage.toUpperCase(),
                            style: AppTextExtras.of(context).eyebrow,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            pageLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelMedium?.copyWith(
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (terminal)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _SheetTerminalPanel(
                        status: state.status,
                        controller: controller,
                      ),
                    )
                  else ...[
                    if (state.hasConversation)
                      Flexible(
                        child: ListView.builder(
                          shrinkWrap: true,
                          padding: const EdgeInsets.only(top: 12),
                          itemCount: state.conversation.length,
                          itemBuilder: (context, index) => Padding(
                            padding: EdgeInsets.only(
                              bottom:
                                  index == state.conversation.length - 1
                                      ? 0
                                      : 12,
                            ),
                            child: ConversationBlockView(
                              block: state.conversation[index],
                              onChipTap: controller.dispatchDirective,
                            ),
                          ),
                        ),
                      ),
                    _buildComposer(text, l10n, controller, hasText),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Screen 04's composer: a 54px milk pill with the type field and a 40px
  /// saffron circle that SENDS when there is text and opens the mic when empty
  /// (pulsing `micpulse 2.2s` in mic mode).
  Widget _buildComposer(
    TextTheme text,
    AppLocalizations l10n,
    VidyaController controller,
    bool hasText,
  ) {
    final state = ref.watch(vidyaControllerProvider);
    final isGenerating = state.status == VidyaStatus.thinking ||
        state.status == VidyaStatus.transcribing ||
        state.status == VidyaStatus.speaking;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _input,
              maxLines: 4,
              minLines: 1,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) {
                if (hasText && !isGenerating) unawaited(_send());
              },
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Type your question',
                hintStyle: text.bodyMedium?.copyWith(
                  color: AppColors.textMuted,
                ),
                filled: true,
                fillColor: AppColors.milk300,
                border: const OutlineInputBorder(
                  borderRadius: AppRadius.rField,
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
              style: text.bodyMedium,
            ),
          ),
          const SizedBox(width: 8),
          if (isGenerating)
            SizedBox(
              width: 44,
              height: 44,
              child: IconButton(
                onPressed: () => controller.cancel(),
                icon: const Icon(LucideIcons.square, size: 18),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.saffron500,
                  foregroundColor: Colors.white,
                ),
              ),
            )
          else
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: hasText ? () => unawaited(_send()) : controller.onMicTap,
              child: SizedBox(
                width: 44,
                height: 44,
                child: Center(
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) {
                      final t = _pulse.value;
                      final scale = hasText
                          ? 1.0
                          : 1 + 0.07 * (0.5 - 0.5 * math.cos(2 * math.pi * t));
                      return Transform.scale(scale: scale, child: child);
                    },
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.saffron500,
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x5CC96A28),
                            offset: Offset(0, 5),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                      child: Icon(
                        hasText ? LucideIcons.arrowUp : LucideIcons.mic,
                        size: 18,
                        color: Colors.white,
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

/// The routetete → localized page title map behind Screen 04's "THIS PAGE" line.
/// Unmapped routes hide the box rather than showing English-only copy.
String? _pageLabelFor(String? path, AppLocalizations l10n) {
  if (path == null || path.isEmpty) return null;
  final mapped = <String?>[
    if (path == Routes.home) l10n.navHome,
    if (path.startsWith('/attendance')) l10n.attendanceTitle,
    if (path.startsWith(Routes.lessonPlan)) l10n.lessonPlanTitle,
    if (path.startsWith(Routes.quizGenerator)) l10n.quizTitle,
    if (path.startsWith(Routes.rubricGenerator)) l10n.rubricTitle,
    if (path.startsWith(Routes.worksheetWizard)) l10n.worksheetTitle,
    if (path.startsWith(Routes.examPaper)) l10n.examPaperTitle,
    if (path.startsWith(Routes.assessmentScanner))
      l10n.assessmentScannerTitle,
    if (path.startsWith(Routes.instantAnswer)) l10n.instantAnswerTitle,
    if (path.startsWith(Routes.visualAid)) l10n.visualAidTitle,
    if (path.startsWith(Routes.videoStoryteller))
      l10n.videoStorytellerTitle,
    if (path.startsWith(Routes.virtualFieldTrip))
      l10n.virtualFieldTripTitle,
    if (path.startsWith(Routes.contentCreator)) l10n.contentCreatorTitle,
    if (path.startsWith(Routes.teacherTraining))
      l10n.teacherTrainingTitle,
    if (path.startsWith(Routes.parentMessage)) l10n.parentMessageTitle,
    if (path.startsWith(Routes.parentHotline)) l10n.parentHotlineTitle,
    if (path.startsWith(Routes.inbox)) l10n.inboxTitle,
    if (path.startsWith(Routes.library)) l10n.libraryTitle,
    if (path.startsWith(Routes.settings)) l10n.settingsTitle,
    if (path.startsWith(Routes.staffroom)) l10n.staffroomTitle,
    if (path.startsWith(Routes.network)) l10n.networkTitle,
    if (path.startsWith(Routes.profile)) l10n.navProfile,
  ];
  return mapped.isNotEmpty ? mapped.first : null;
}

/// The dignified terminal panel inside the sheet (mirrors the home's), using the
/// shared status→copy helpers so the two never drift.
class _SheetTerminalPanel extends ConsumerWidget {
  const _SheetTerminalPanel({required this.status, required this.controller});

  final VidyaStatus status;
  final VidyaController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    Widget? action;
    if (status == VidyaStatus.micDenied) {
      action = SecondaryButton(
        label: l10n.vidyaOpenSettings,
        icon: LucideIcons.settings,
        onPressed: controller.openMicSettings,
      );
    } else if (status == VidyaStatus.failed) {
      action = SecondaryButton(
        label: l10n.actionRetry,
        icon: LucideIcons.refreshCw,
        onPressed: controller.onMicTap,
      );
    } else if (status == VidyaStatus.upgradeRequired) {
      // Same non-retryable plan gate as the home panel: the paid voice call
      // would 403 identically, so the action is the pricing page.
      action = SecondaryButton(
        label: l10n.vidyaSeePricing,
        icon: LucideIcons.creditCard,
        onPressed: () => openVidyaPricing(ref),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            vidyaTerminalTitle(status, l10n),
            style: text.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            vidyaTerminalBody(status, l10n),
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.space4),
            action,
          ],
          const SizedBox(height: AppSpacing.space3),
          TextButton(
            onPressed: controller.dismissTerminal,
            child: const Text('Type instead'),
          ),
        ],
      ),
    );
  }
}

class _GrabHandle extends StatelessWidget {
  const _GrabHandle();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space3),
      child: Center(
        child: Container(
          width: 44,
          height: 4,
          decoration: ShapeDecoration(
            color: AppColors.ink900.withValues(alpha: 0.14),
            shape: const StadiumBorder(),
          ),
        ),
      ),
    );
  }
}
