import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/deliverable.dart';
import 'deliverables_controller.dart';

/// One generation VIDYA is finishing off-screen (v3 screen 06 "Working ·
/// minimisable to the orb"). Held while the work runs so the floating orb shows
/// its indigo *working* state on every screen; cleared the moment the result
/// lands in the deliver tray (the orb then turns green) or the teacher stops it.
@immutable
class BackgroundGeneration {
  const BackgroundGeneration({required this.label});

  /// A short, honest description of what is being made (e.g. the tool name),
  /// shown against the working orb. Never a fabricated step or percentage — the
  /// backend gives no progress stream, so the surface stays truthful.
  final String label;

  @override
  bool operator ==(Object other) =>
      other is BackgroundGeneration && other.label == label;

  @override
  int get hashCode => label.hashCode;
}

/// The single source of truth for "VIDYA is finishing something in the
/// background". A plain [NotifierProvider] (keepAlive by default) so the working
/// state survives the tool screen being popped — the whole point of minimising.
final backgroundGenerationControllerProvider =
    NotifierProvider<BackgroundGenerationController, BackgroundGeneration?>(
      BackgroundGenerationController.new,
    );

class BackgroundGenerationController extends Notifier<BackgroundGeneration?> {
  @override
  BackgroundGeneration? build() => null;

  /// Mark that a generation is now running off-screen.
  void begin(String label) => state = BackgroundGeneration(label: label);

  /// Stop showing the working state (the result landed, or it was cancelled).
  void clear() => state = null;
}

/// Drives one minimised generation to completion after its tool screen has been
/// left (v3 06 → 07): flags the orb as working, waits for the already-running
/// generation to resolve, lands the result in the deliver tray so the orb turns
/// green, then tidies up regardless of how it ended.
///
/// It is a pure orchestration over injected seams — no `BuildContext`, no
/// Riverpod `Ref` — so it is fully unit-testable: the caller passes the two
/// controllers, the future of the in-flight generation ([awaitResult]), the
/// map from that result to a [Deliverable] ([toDeliverable]), the keep-alive
/// subscription that stops the tool provider being disposed mid-flight
/// ([keepAlive]), and a [onReset] that returns the tool provider to a blank
/// state once the result has been handed off.
///
/// A null result (nothing was produced) or a thrown generation is swallowed:
/// there is simply nothing to deliver, the working state clears, and the orb
/// returns to rest — the teacher is never shown a background error over a
/// screen they have already moved on from.
Future<void> runMinimisedGeneration<T>({
  required BackgroundGenerationController controller,
  required DeliverablesController deliverables,
  required String label,
  required Future<T?> Function() awaitResult,
  required Deliverable Function(T value) toDeliverable,
  ProviderSubscription<Object?>? keepAlive,
  void Function()? onReset,
}) async {
  controller.begin(label);
  try {
    final value = await awaitResult();
    if (value != null) {
      deliverables.add(toDeliverable(value));
    }
  } catch (_) {
    // The background generation failed. Nothing to deliver; the orb quietly
    // returns to rest rather than throwing an error over an unrelated screen.
  } finally {
    controller.clear();
    keepAlive?.close();
    onReset?.call();
  }
}
