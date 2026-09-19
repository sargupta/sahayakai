import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kPerchKey = 'vidya_orb_perch';
const String _kHandKey = 'vidya_orb_hand';

/// Which hand the teacher parks VIDYA under. Persisted, and surfaced in Settings
/// ("Orb on the left hand") — v3 §"Orb position is remembered per hand".
enum VidyaHand { left, right }

/// The vertical band a perch sits in. The overlay turns a band into a real
/// y-offset using the live safe-area and a bottom inset that clears the floating
/// nav, so the same six perches land correctly on any device.
enum VidyaPerchBand { top, mid, bottom }

/// The six snap perches the orb rests at — two columns (left / right) × three
/// bands (top / mid / bottom), matching the six dashed targets in v3 screen 03.
enum VidyaPerch {
  topLeft,
  topRight,
  midLeft,
  midRight,
  bottomLeft,
  bottomRight;

  bool get isLeft =>
      this == VidyaPerch.topLeft ||
      this == VidyaPerch.midLeft ||
      this == VidyaPerch.bottomLeft;

  VidyaPerchBand get band {
    switch (this) {
      case VidyaPerch.topLeft:
      case VidyaPerch.topRight:
        return VidyaPerchBand.top;
      case VidyaPerch.midLeft:
      case VidyaPerch.midRight:
        return VidyaPerchBand.mid;
      case VidyaPerch.bottomLeft:
      case VidyaPerch.bottomRight:
        return VidyaPerchBand.bottom;
    }
  }

  VidyaHand get hand => isLeft ? VidyaHand.left : VidyaHand.right;

  /// The same band on the other side — used when the teacher flips hands in
  /// Settings without also re-dragging the orb.
  VidyaPerch get mirrored {
    switch (this) {
      case VidyaPerch.topLeft:
        return VidyaPerch.topRight;
      case VidyaPerch.topRight:
        return VidyaPerch.topLeft;
      case VidyaPerch.midLeft:
        return VidyaPerch.midRight;
      case VidyaPerch.midRight:
        return VidyaPerch.midLeft;
      case VidyaPerch.bottomLeft:
        return VidyaPerch.bottomRight;
      case VidyaPerch.bottomRight:
        return VidyaPerch.bottomLeft;
    }
  }

  static VidyaPerch of(VidyaHand hand, VidyaPerchBand band) {
    final left = hand == VidyaHand.left;
    switch (band) {
      case VidyaPerchBand.top:
        return left ? VidyaPerch.topLeft : VidyaPerch.topRight;
      case VidyaPerchBand.mid:
        return left ? VidyaPerch.midLeft : VidyaPerch.midRight;
      case VidyaPerchBand.bottom:
        return left ? VidyaPerch.bottomLeft : VidyaPerch.bottomRight;
    }
  }
}

/// Where the floating orb lives and what it is doing to itself right now.
/// [perch] and [hand] persist across launches; [dragging] is transient (the
/// teacher's finger is on it) and [readyCount] is session state (results waiting
/// to be delivered), so neither is written to prefs.
@immutable
class VidyaOrbPlacement {
  const VidyaOrbPlacement({
    this.perch = VidyaPerch.bottomRight,
    this.hand = VidyaHand.right,
    this.dragging = false,
    this.readyCount = 0,
  });

  final VidyaPerch perch;
  final VidyaHand hand;
  final bool dragging;
  final int readyCount;

  VidyaOrbPlacement copyWith({
    VidyaPerch? perch,
    VidyaHand? hand,
    bool? dragging,
    int? readyCount,
  }) {
    return VidyaOrbPlacement(
      perch: perch ?? this.perch,
      hand: hand ?? this.hand,
      dragging: dragging ?? this.dragging,
      readyCount: readyCount ?? this.readyCount,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is VidyaOrbPlacement &&
      other.perch == perch &&
      other.hand == hand &&
      other.dragging == dragging &&
      other.readyCount == readyCount;

  @override
  int get hashCode => Object.hash(perch, hand, dragging, readyCount);
}

/// Owns the floating orb's placement and its ready-badge count, held alive so it
/// follows the teacher across every screen (the same "one store, every screen"
/// contract as [VidyaController]).
///
/// Mirrors [ThemeModeController] in `core/theme/theme_mode_provider` in shape —
/// the same keepAlive notifier and the "start at the default, hydrate the
/// persisted choice asynchronously" contract, so a cold launch paints the
/// default perch immediately and settles onto the teacher's remembered side once
/// prefs resolve. Written as a plain [NotifierProvider] (keepAlive by default)
/// rather than a `@riverpod`-generated one: it needs no generated family or
/// argument plumbing, so hand-wiring it keeps the store self-contained with no
/// `.g.dart` part to keep in sync.
final vidyaOrbPlacementControllerProvider =
    NotifierProvider<VidyaOrbPlacementController, VidyaOrbPlacement>(
      VidyaOrbPlacementController.new,
    );

class VidyaOrbPlacementController extends Notifier<VidyaOrbPlacement> {
  @override
  VidyaOrbPlacement build() {
    _hydrate();
    return const VidyaOrbPlacement();
  }

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final storedPerch = prefs.getString(_kPerchKey);
    final storedHand = prefs.getString(_kHandKey);
    final perch = _perchFromName(storedPerch);
    final hand = _handFromName(storedHand);
    if (perch == null && hand == null) return;
    // A drag mid-hydrate would have already moved the orb; never clobber it.
    if (state.dragging) return;
    state = state.copyWith(
      perch: perch ?? (hand != null ? VidyaPerch.of(hand, state.perch.band) : null),
      hand: hand ?? perch?.hand,
    );
  }

  /// The finger went down on the orb — lift it and stop honouring taps as a park.
  void beginDrag() {
    if (state.dragging) return;
    state = state.copyWith(dragging: true);
  }

  /// The finger lifted over [perch] — settle there, remember the hand, persist.
  Future<void> endDrag(VidyaPerch perch) async {
    state = state.copyWith(perch: perch, hand: perch.hand, dragging: false);
    await _persist();
  }

  /// A drag was abandoned (cancel / pointer lost) without a valid perch.
  void cancelDrag() {
    if (!state.dragging) return;
    state = state.copyWith(dragging: false);
  }

  /// Move the orb to the teacher's chosen hand (from Settings), keeping its band.
  Future<void> setHand(VidyaHand hand) async {
    if (state.hand == hand) return;
    state = state.copyWith(hand: hand, perch: VidyaPerch.of(hand, state.perch.band));
    await _persist();
  }

  /// A result finished and is waiting to be delivered — turns the orb green and
  /// bumps its badge. Producers (a tool output screen) call this; the deliver
  /// surface calls [clearReady] once the teacher acts on it.
  void addReady([int count = 1]) {
    if (count <= 0) return;
    state = state.copyWith(readyCount: state.readyCount + count);
  }

  /// Clear the ready badge (the teacher opened / dismissed the waiting results).
  void clearReady() {
    if (state.readyCount == 0) return;
    state = state.copyWith(readyCount: 0);
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPerchKey, state.perch.name);
    await prefs.setString(_kHandKey, state.hand.name);
  }
}

/// Parses a persisted [VidyaPerch.name]; unknown/legacy values yield null so a
/// corrupted pref falls back to the default rather than throwing.
VidyaPerch? _perchFromName(String? name) {
  if (name == null) return null;
  for (final p in VidyaPerch.values) {
    if (p.name == name) return p;
  }
  return null;
}

VidyaHand? _handFromName(String? name) {
  if (name == null) return null;
  for (final h in VidyaHand.values) {
    if (h.name == name) return h;
  }
  return null;
}
