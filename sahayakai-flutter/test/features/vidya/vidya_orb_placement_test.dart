import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_orb_placement_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The floating orb's placement store — the perch/hand memory and the
/// ready-badge count behind the v3 presence layer. Pure state + prefs; no UI.

ProviderContainer _container() {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  return container;
}

/// Lets the async `_hydrate()` kicked off in build() drain before assertions.
Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('VidyaPerch geometry', () {
    test('side and band decompose correctly', () {
      expect(VidyaPerch.topLeft.isLeft, isTrue);
      expect(VidyaPerch.bottomRight.isLeft, isFalse);
      expect(VidyaPerch.midLeft.band, VidyaPerchBand.mid);
      expect(VidyaPerch.topRight.band, VidyaPerchBand.top);
      expect(VidyaPerch.bottomLeft.band, VidyaPerchBand.bottom);
    });

    test('hand follows the side', () {
      expect(VidyaPerch.midLeft.hand, VidyaHand.left);
      expect(VidyaPerch.midRight.hand, VidyaHand.right);
    });

    test('mirrored flips the side but keeps the band', () {
      expect(VidyaPerch.topLeft.mirrored, VidyaPerch.topRight);
      expect(VidyaPerch.bottomRight.mirrored, VidyaPerch.bottomLeft);
      for (final p in VidyaPerch.values) {
        expect(p.mirrored.band, p.band);
        expect(p.mirrored.isLeft, !p.isLeft);
      }
    });

    test('of(hand, band) selects the matching perch', () {
      expect(
        VidyaPerch.of(VidyaHand.left, VidyaPerchBand.bottom),
        VidyaPerch.bottomLeft,
      );
      expect(
        VidyaPerch.of(VidyaHand.right, VidyaPerchBand.top),
        VidyaPerch.topRight,
      );
    });
  });

  group('placement defaults', () {
    test('starts parked bottom-right on the right hand', () {
      final container = _container();
      final placement = container.read(vidyaOrbPlacementControllerProvider);
      expect(placement.perch, VidyaPerch.bottomRight);
      expect(placement.hand, VidyaHand.right);
      expect(placement.dragging, isFalse);
      expect(placement.readyCount, 0);
    });
  });

  group('drag lifecycle', () {
    test('beginDrag lifts, endDrag settles and remembers the hand', () async {
      final container = _container();
      final notifier = container.read(
        vidyaOrbPlacementControllerProvider.notifier,
      );

      notifier.beginDrag();
      expect(
        container.read(vidyaOrbPlacementControllerProvider).dragging,
        isTrue,
      );

      await notifier.endDrag(VidyaPerch.midLeft);
      final placement = container.read(vidyaOrbPlacementControllerProvider);
      expect(placement.dragging, isFalse);
      expect(placement.perch, VidyaPerch.midLeft);
      expect(placement.hand, VidyaHand.left);
    });

    test('endDrag persists the perch and hand', () async {
      final container = _container();
      await container
          .read(vidyaOrbPlacementControllerProvider.notifier)
          .endDrag(VidyaPerch.topLeft);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('vidya_orb_perch'), 'topLeft');
      expect(prefs.getString('vidya_orb_hand'), 'left');
    });

    test('cancelDrag drops the lift without moving', () {
      final container = _container();
      final notifier = container.read(
        vidyaOrbPlacementControllerProvider.notifier,
      );
      notifier.beginDrag();
      notifier.cancelDrag();
      final placement = container.read(vidyaOrbPlacementControllerProvider);
      expect(placement.dragging, isFalse);
      expect(placement.perch, VidyaPerch.bottomRight); // unchanged
    });
  });

  group('setHand', () {
    test('moves to the chosen hand, keeping the band', () async {
      final container = _container();
      final notifier = container.read(
        vidyaOrbPlacementControllerProvider.notifier,
      );
      // Default is bottomRight; flipping to the left hand keeps the bottom band.
      await notifier.setHand(VidyaHand.left);
      expect(
        container.read(vidyaOrbPlacementControllerProvider).perch,
        VidyaPerch.bottomLeft,
      );
      expect(
        container.read(vidyaOrbPlacementControllerProvider).hand,
        VidyaHand.left,
      );
    });
  });

  group('ready badge', () {
    test('addReady accumulates, clearReady resets', () {
      final container = _container();
      final notifier = container.read(
        vidyaOrbPlacementControllerProvider.notifier,
      );
      notifier.addReady();
      notifier.addReady(2);
      expect(
        container.read(vidyaOrbPlacementControllerProvider).readyCount,
        3,
      );
      notifier.clearReady();
      expect(
        container.read(vidyaOrbPlacementControllerProvider).readyCount,
        0,
      );
    });

    test('addReady ignores non-positive counts', () {
      final container = _container();
      final notifier = container.read(
        vidyaOrbPlacementControllerProvider.notifier,
      );
      notifier.addReady(0);
      notifier.addReady(-3);
      expect(
        container.read(vidyaOrbPlacementControllerProvider).readyCount,
        0,
      );
    });
  });

  group('hydration', () {
    test('restores a persisted perch and hand on build', () async {
      SharedPreferences.setMockInitialValues({
        'vidya_orb_perch': 'midLeft',
        'vidya_orb_hand': 'left',
      });
      final container = _container();
      // Trigger build(), then let the async hydrate drain.
      container.read(vidyaOrbPlacementControllerProvider);
      await _settle();
      final placement = container.read(vidyaOrbPlacementControllerProvider);
      expect(placement.perch, VidyaPerch.midLeft);
      expect(placement.hand, VidyaHand.left);
    });

    test('a corrupt perch pref falls back to the default', () async {
      SharedPreferences.setMockInitialValues({'vidya_orb_perch': 'nonsense'});
      final container = _container();
      container.read(vidyaOrbPlacementControllerProvider);
      await _settle();
      expect(
        container.read(vidyaOrbPlacementControllerProvider).perch,
        VidyaPerch.bottomRight,
      );
    });
  });
}
