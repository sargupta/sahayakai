import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../domain/deliverable.dart';
import 'background_generation_controller.dart';
import 'deliver_tray.dart';
import 'deliverables_controller.dart';
import 'vidya_controller.dart';
import 'vidya_orb_placement_controller.dart';
import 'vidya_sheet.dart';
import 'widgets/vidya_orb.dart';

/// A finished tool result that is on screen right now (UX map: "while a result
/// is on screen it counts as a deliverable"). Set by the tool's Output screen
/// while it shows, cleared when it leaves; kept apart from the background
/// results in [deliverablesControllerProvider], so leaving the screen never
/// leaves a stale badge behind.
final visibleDeliverableProvider =
    NotifierProvider<VisibleDeliverableController, Deliverable?>(
      VisibleDeliverableController.new,
    );

class VisibleDeliverableController extends Notifier<Deliverable?> {
  @override
  Deliverable? build() => null;

  /// Marks [deliverable] as the result on screen.
  void show(Deliverable deliverable) => state = deliverable;

  /// Clears the on-screen result, but only if it is still [deliverable]: a
  /// screen leaving late must not clear the next screen's result.
  void hide(Deliverable deliverable) {
    if (state?.id == deliverable.id) state = null;
  }
}

/// How many results are ready to deliver: finished background generations
/// plus the result on screen. Drives the orb's count badge.
final vidyaReadyCountProvider = Provider<int>((ref) {
  final background = ref.watch(
    deliverablesControllerProvider.select((d) => d.length),
  );
  final visible = ref.watch(visibleDeliverableProvider) != null ? 1 : 0;
  return background + visible;
});

/// What VIDYA's one orb shows right now, wherever it is drawn: floating over a
/// tool screen ([VidyaOverlay]) or docked in the tab bar ([VidyaDockOrb]).
///
/// Only the phase drives it — not the per-frame amplitude, which would rebuild
/// every orb on each listening tick.
final vidyaOrbVisualProvider = Provider<VidyaOrbVisual>((ref) {
  return vidyaOrbVisualFor(
    status: ref.watch(vidyaControllerProvider.select((s) => s.status)),
    dragging: ref.watch(
      vidyaOrbPlacementControllerProvider.select((p) => p.dragging),
    ),
    readyCount: ref.watch(vidyaReadyCountProvider),
    // VIDYA is finishing a minimised generation off-screen (v3 06): the orb
    // rides on to show its progress.
    bgActive: ref.watch(backgroundGenerationControllerProvider) != null,
  );
});

/// Maps VIDYA's phase onto the orb's colour-is-state visual.
VidyaOrbVisual vidyaOrbVisualFor({
  required VidyaStatus status,
  required bool dragging,
  required int readyCount,
  required bool bgActive,
}) {
  if (dragging) return VidyaOrbVisual.dragging;
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
      // A minimised generation still running shows the working orb even while
      // VIDYA's own turn is idle; a finished one shows the green ready badge.
      if (bgActive) return VidyaOrbVisual.working;
      return readyCount > 0 ? VidyaOrbVisual.ready : VidyaOrbVisual.resting;
  }
}

/// The orb's accessible hint: what a tap does in this state.
String vidyaOrbHintFor(
  BuildContext context,
  VidyaOrbVisual visual,
  VidyaStatus status,
) {
  final l10n = context.l10n;
  switch (visual) {
    case VidyaOrbVisual.listening:
      return l10n.vidyaStateListening;
    case VidyaOrbVisual.working:
      return status == VidyaStatus.speaking
          ? l10n.vidyaStateSpeaking
          : l10n.vidyaStateThinking;
    case VidyaOrbVisual.ready:
      return l10n.vidyaDockReadyHint;
    case VidyaOrbVisual.dragging:
    case VidyaOrbVisual.resting:
      return l10n.vidyaStateIdle;
    case VidyaOrbVisual.offline:
      return l10n.stateOfflineTitle;
  }
}

/// The orb's tap, shared by every place the orb is drawn.
///
/// Green (ready) opens the one deliver tray for the latest background result,
/// or else the result on screen; any other state opens the VIDYA sheet over
/// [pagePath] and starts listening in the same gesture (v3 Screen 04).
/// [navContext] must sit under the app Navigator.
void openVidyaFromOrb(
  BuildContext navContext,
  WidgetRef ref,
  VidyaOrbVisual visual,
  String pagePath,
) {
  if (visual == VidyaOrbVisual.ready) {
    final latest =
        ref.read(deliverablesControllerProvider.notifier).latest ??
        ref.read(visibleDeliverableProvider);
    if (latest != null) {
      showDeliverTray(navContext, latest);
    }
    return;
  }
  showVidyaSheet(navContext, pagePath: pagePath);
  ref.read(vidyaControllerProvider.notifier).onMicTap();
}
