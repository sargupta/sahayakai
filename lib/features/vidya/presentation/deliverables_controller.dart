import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/deliverable.dart';

/// The results VIDYA is holding, ready to deliver — the single source of truth
/// behind the orb's green "ready" badge (its count) and the deliver tray (its
/// payloads). Held alive so it follows the teacher across every screen, the same
/// "one store, every screen" contract as the other VIDYA stores.
///
/// A plain [NotifierProvider] (keepAlive by default): it holds a list and needs
/// no generated family, so hand-wiring keeps it self-contained with no `.g.dart`.
final deliverablesControllerProvider =
    NotifierProvider<DeliverablesController, List<Deliverable>>(
      DeliverablesController.new,
    );

class DeliverablesController extends Notifier<List<Deliverable>> {
  @override
  List<Deliverable> build() => const [];

  /// The most recently produced result — what the orb's ready tap opens first.
  Deliverable? get latest => state.isEmpty ? null : state.last;

  /// Register a produced result. Idempotent on [Deliverable.id], so a result
  /// view that rebuilds does not double-count the badge.
  void add(Deliverable deliverable) {
    if (state.any((d) => d.id == deliverable.id)) return;
    state = [...state, deliverable];
  }

  /// Drop one result (delivered, or its screen left).
  void remove(String id) {
    if (!state.any((d) => d.id == id)) return;
    state = state.where((d) => d.id != id).toList(growable: false);
  }

  /// Clear everything (e.g. a sign-out, or "deliver all" done).
  void clear() {
    if (state.isEmpty) return;
    state = const [];
  }
}
