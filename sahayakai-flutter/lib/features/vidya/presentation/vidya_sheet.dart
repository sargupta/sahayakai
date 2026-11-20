import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/glass_surface.dart';
import '../../../shared/widgets/secondary_button.dart';
import 'vidya_controller.dart';
import 'vidya_nav_dispatcher.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart';
import 'widgets/seal_mic.dart';

/// Opens VIDYA as a modal sheet over the current page — what a tap on the orb
/// does (design system v2 `Orb`: "a tap opens the voice sheet"). Reuses the
/// SAME top-level [VidyaController] as the home, so the conversation is
/// continuous across surfaces.
Future<void> showVidyaSheet(BuildContext context) {
  return showVidyaSurface(
    context,
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      elevation: 0,
      isScrollControlled: true,
      builder: (_) => const VidyaSheet(),
    ),
  );
}

/// True while one of VIDYA's own sheets (the voice sheet, the deliver tray) is
/// up. The parked orb hides meanwhile: the sheet is VIDYA, and design system
/// v2 never shows two VIDYAs on one screen.
final vidyaSurfaceOpenProvider = StateProvider<bool>((ref) => false);

/// Marks [sheet] as a VIDYA surface for as long as it is open.
Future<T?> showVidyaSurface<T>(BuildContext context, Future<T?> sheet) {
  final open = ProviderScope.containerOf(
    context,
    listen: false,
  ).read(vidyaSurfaceOpenProvider.notifier);
  open.state = true;
  return sheet.whenComplete(() => open.state = false);
}

/// The VIDYA sheet body, drawn as the design system v2 `Sheet`: solid
/// `surface-card`, `radius-sheet` top corners, `shadow-sheet`, a 44 × 4 handle
/// and a 14/600 display title, holding the running conversation (if any), the
/// Seal Mic and its caption, and the dignified terminal panels. A single valid intent routes
/// to its tool (and closes the sheet); a compound intent offers confirm chips.
class VidyaSheet extends ConsumerStatefulWidget {
  const VidyaSheet({super.key});

  @override
  ConsumerState<VidyaSheet> createState() => _VidyaSheetState();
}

class _VidyaSheetState extends ConsumerState<VidyaSheet> {
  static final BorderRadius _sheetRadius = BorderRadius.only(
    topLeft: AppRadius.rSheet.topLeft,
    topRight: AppRadius.rSheet.topRight,
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(vidyaControllerProvider);
    final controller = ref.read(vidyaControllerProvider.notifier);

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

    final maxHeight = MediaQuery.sizeOf(context).height * 0.72;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        // Shadow-only carrier: `GlassSurface` casts no shadow of its own.
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: _sheetRadius,
            boxShadow: AppShadows.e4,
          ),
          // A sheet is solid (`surface-card`), never glass: the page behind
          // it must not show through what VIDYA is saying. Top corners only;
          // the bottom sits flush with the screen edge.
          child: GlassSurface(
            borderRadius: _sheetRadius,
            fill: AppColors.surfaceCard,
            padding: EdgeInsets.zero,
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _GrabHandle(
                    color: AppColors.borderControl,
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                    child: Text(
                      l10n.vidyaOpen,
                      style: AppTypeTokens.of(context).value,
                    ),
                  ),
                  if (state.hasConversation)
                    Flexible(
                      child: ListView.builder(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.space4,
                          AppSpacing.space2,
                          AppSpacing.space4,
                          AppSpacing.space2,
                        ),
                        itemCount: state.conversation.length,
                        itemBuilder: (context, index) => Padding(
                          padding: EdgeInsets.only(
                            bottom: index == state.conversation.length - 1
                                ? 0
                                : AppSpacing.space3,
                          ),
                          child: ConversationBlockView(
                            block: state.conversation[index],
                            onChipTap: controller.dispatchDirective,
                          ),
                        ),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.space4,
                      AppSpacing.space4,
                      AppSpacing.space4,
                      AppSpacing.space6,
                    ),
                    child: _SheetMic(state: state, controller: controller),
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

/// The seal + its caption (or a terminal panel) inside the sheet.
class _SheetMic extends StatelessWidget {
  const _SheetMic({required this.state, required this.controller});

  final VidyaState state;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final caption = vidyaStateCaption(state.status, l10n);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SealMic(
          state: sealStateForStatus(state.status),
          amplitude: state.amplitude,
          size: 104,
          onTap: controller.onMicTap,
          semanticLabel: l10n.vidyaOpen,
          semanticHint: caption ?? vidyaTerminalTitle(state.status, l10n),
        ),
        const SizedBox(height: AppSpacing.space4),
        if (isVidyaTerminal(state.status))
          _SheetTerminalPanel(status: state.status, controller: controller)
        else
          Text(
            caption ?? l10n.vidyaStateIdle,
            style: text.titleMedium,
            textAlign: TextAlign.center,
          ),
      ],
    );
  }
}

/// The dignified terminal panel inside the sheet (mirrors the home's), using the
/// shared status→copy helpers so the two never drift.
class _SheetTerminalPanel extends StatelessWidget {
  const _SheetTerminalPanel({required this.status, required this.controller});

  final VidyaStatus status;
  final VidyaController controller;

  @override
  Widget build(BuildContext context) {
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
        ],
      ),
    );
  }
}

class _GrabHandle extends StatelessWidget {
  const _GrabHandle({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Center(
        child: Container(
          width: 44,
          height: 4,
          decoration: ShapeDecoration(
            color: color,
            shape: const StadiumBorder(),
          ),
        ),
      ),
    );
  }
}
