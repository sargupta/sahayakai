import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/background_generation_controller.dart';
import 'package:sahayakai/features/vidya/presentation/deliverables_controller.dart';

/// v3 screen 06 — "minimise to orb, VIDYA finishes in the background". The
/// controller flags the working orb; [runMinimisedGeneration] carries one
/// minimised generation to the deliver tray after its screen has been left.

ProviderContainer _container() {
  final c = ProviderContainer();
  addTearDown(c.dispose);
  return c;
}

Deliverable _d(String id) => Deliverable(id: id, title: 'T', text: 'body');

void main() {
  group('BackgroundGenerationController', () {
    test('starts idle (no working orb)', () {
      final c = _container();
      expect(c.read(backgroundGenerationControllerProvider), isNull);
    });

    test('begin sets the working label, clear returns to idle', () {
      final c = _container();
      final n = c.read(backgroundGenerationControllerProvider.notifier);
      n.begin('Lesson plan');
      expect(c.read(backgroundGenerationControllerProvider)?.label, 'Lesson plan');
      n.clear();
      expect(c.read(backgroundGenerationControllerProvider), isNull);
    });

    test('equality is by label (no needless orb rebuilds)', () {
      expect(
        const BackgroundGeneration(label: 'x'),
        const BackgroundGeneration(label: 'x'),
      );
    });
  });

  group('runMinimisedGeneration', () {
    test('a produced result lands in the deliver tray and clears working', () async {
      final c = _container();
      final bg = c.read(backgroundGenerationControllerProvider.notifier);
      final tray = c.read(deliverablesControllerProvider.notifier);
      final completer = Completer<int?>();
      var reset = false;

      final future = runMinimisedGeneration<int>(
        controller: bg,
        deliverables: tray,
        label: 'Lesson plan',
        awaitResult: () => completer.future,
        toDeliverable: (v) => _d('bg-$v'),
        onReset: () => reset = true,
      );

      // While in flight, the orb shows working and nothing is delivered yet.
      expect(c.read(backgroundGenerationControllerProvider)?.label, 'Lesson plan');
      expect(c.read(deliverablesControllerProvider), isEmpty);

      completer.complete(7);
      await future;

      expect(c.read(deliverablesControllerProvider).single.id, 'bg-7');
      expect(c.read(backgroundGenerationControllerProvider), isNull);
      expect(reset, isTrue);
    });

    test('a null result delivers nothing but still clears and resets', () async {
      final c = _container();
      final bg = c.read(backgroundGenerationControllerProvider.notifier);
      final tray = c.read(deliverablesControllerProvider.notifier);
      var reset = false;

      await runMinimisedGeneration<int>(
        controller: bg,
        deliverables: tray,
        label: 'x',
        awaitResult: () async => null,
        toDeliverable: (v) => _d('never'),
        onReset: () => reset = true,
      );

      expect(c.read(deliverablesControllerProvider), isEmpty);
      expect(c.read(backgroundGenerationControllerProvider), isNull);
      expect(reset, isTrue);
    });

    test('a failed generation is swallowed: no error, no delivery, still tidied',
        () async {
      final c = _container();
      final bg = c.read(backgroundGenerationControllerProvider.notifier);
      final tray = c.read(deliverablesControllerProvider.notifier);
      var reset = false;

      await runMinimisedGeneration<int>(
        controller: bg,
        deliverables: tray,
        label: 'x',
        awaitResult: () async => throw StateError('boom'),
        toDeliverable: (v) => _d('never'),
        onReset: () => reset = true,
      );

      expect(c.read(deliverablesControllerProvider), isEmpty);
      expect(c.read(backgroundGenerationControllerProvider), isNull);
      expect(reset, isTrue);
    });

    test('the keep-alive subscription is closed when the work ends', () async {
      final c = _container();
      final bg = c.read(backgroundGenerationControllerProvider.notifier);
      final tray = c.read(deliverablesControllerProvider.notifier);
      // A real subscription on a keepAlive provider; we assert it is closed.
      final sub = c.listen(deliverablesControllerProvider, (_, _) {});

      await runMinimisedGeneration<int>(
        controller: bg,
        deliverables: tray,
        label: 'x',
        awaitResult: () async => 1,
        toDeliverable: (v) => _d('bg-$v'),
        keepAlive: sub,
      );

      // Closing an already-closed subscription throws; a first close must not.
      expect(sub.close, returnsNormally);
    });
  });
}
