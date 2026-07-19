import 'dart:async';

// fake_async ships transitively via flutter_test; imported directly to drive the
// keep-warm cadence under fake time without real delays (pubspec is out of scope).
// ignore: depend_on_referenced_packages
import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/data/chat_stream_provider.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/persona_pulse.dart';

import '../../support/fake_block_c_transports.dart';

/// U-SI3 — the persona-pulse keep-warm timer discipline (SPEC §A1.4 / §A3.2).
///
/// Fake time drives the cadence (`package:fake_async`) so nothing waits on real
/// minutes; the [FakeStaffroomTransport] stands in for the REST route so nothing
/// opens a socket. Each test pins a rule: the polite interval, the 503-stop, the
/// error-stop, cancel-on-dispose (including a pulse in flight), and that a group
/// chat never arms it — the honest-timer contract (no spam, no leak).
void main() {
  const community = ChatRoom.community();
  const group = ChatRoom.group('g1');
  const aPulse = PersonaPulse(message: 'Namaste! Try a chapati fraction demo.');

  ProviderContainer makeContainer(FakeStaffroomTransport fake) {
    final container = ProviderContainer(
      overrides: [staffroomTransportProvider.overrideWithValue(fake)],
    );
    // A test may dispose the container early (cancel-on-dispose); guard the
    // teardown so a second dispose is a no-op rather than a throw.
    addTearDown(() {
      try {
        container.dispose();
      } catch (_) {}
    });
    return container;
  }

  /// Arm the controller by listening (its `build` schedules the first timer).
  void arm(ProviderContainer container, ChatRoom room) {
    container.listen(personaPulseControllerProvider(room), (_, _) {});
  }

  test('does not fire before the interval, then fires and reschedules on a 200',
      () {
    fakeAsync((async) {
      final fake = FakeStaffroomTransport()..personaPulseResult = aPulse;
      final container = makeContainer(fake);
      arm(container, community);
      async.flushMicrotasks();

      expect(fake.personaPulses, isEmpty, reason: 'nothing before the interval');
      async.elapse(kPersonaPulseInterval - const Duration(seconds: 1));
      expect(fake.personaPulses, isEmpty, reason: 'still waiting');

      async.elapse(const Duration(seconds: 1)); // == interval
      expect(fake.personaPulses, hasLength(1), reason: 'first pulse at interval');

      async.elapse(kPersonaPulseInterval); // a 200 → one more
      expect(fake.personaPulses, hasLength(2), reason: '200 reschedules a pulse');

      expect(
        container.read(personaPulseControllerProvider(community)),
        PersonaPulseStatus.warmed,
      );
    });
  });

  test('a null result (503) permanently disarms the timer', () {
    fakeAsync((async) {
      final fake = FakeStaffroomTransport()..personaPulseResult = null; // 503
      final container = makeContainer(fake);
      arm(container, community);
      async.flushMicrotasks();

      async.elapse(kPersonaPulseInterval);
      expect(fake.personaPulses, hasLength(1), reason: 'it fired once');

      // …then never again — the 503 stopped the loop for the session.
      async.elapse(kPersonaPulseInterval * 5);
      expect(fake.personaPulses, hasLength(1), reason: '503 stops the loop');
      expect(
        container.read(personaPulseControllerProvider(community)),
        PersonaPulseStatus.stopped,
      );
    });
  });

  test('a thrown error (deferred transport / 401 on the stub) also stops it', () {
    fakeAsync((async) {
      final fake = FakeStaffroomTransport()
        ..personaPulseResult = aPulse
        ..personaPulseError = StateError('401 on the persona-pulse stub');
      final container = makeContainer(fake);
      arm(container, community);
      async.flushMicrotasks();

      async.elapse(kPersonaPulseInterval);
      expect(fake.personaPulses, hasLength(1));
      async.elapse(kPersonaPulseInterval * 5);
      expect(fake.personaPulses, hasLength(1), reason: 'an error stops the loop');
      expect(
        container.read(personaPulseControllerProvider(community)),
        PersonaPulseStatus.stopped,
      );
    });
  });

  test('disposing (leaving the screen) cancels the timer — no fire afterwards',
      () {
    fakeAsync((async) {
      final fake = FakeStaffroomTransport()..personaPulseResult = aPulse;
      final container = makeContainer(fake);
      arm(container, community);
      async.flushMicrotasks();

      async.elapse(kPersonaPulseInterval);
      expect(fake.personaPulses, hasLength(1)); // one fire

      container.dispose(); // leaving the screen
      async.elapse(kPersonaPulseInterval * 3);
      expect(fake.personaPulses, hasLength(1), reason: 'no fire after dispose');
    });
  });

  test('disposing WITH a pulse in flight blocks the reschedule (post-await guard)',
      () {
    fakeAsync((async) {
      // The gate holds pulse #1 suspended (request already recorded, before the
      // result resolves) precisely while we dispose. The result is a 200, so IF
      // the `_disposed || gen != _gen` guard in `_fire` were removed, the
      // continuation would `_schedule` a new timer post-dispose and the elapse
      // would drive the count past 1. The guard is what freezes it.
      final gate = Completer<void>();
      final fake = FakeStaffroomTransport()
        ..personaPulseResult = aPulse
        ..personaPulseGate = gate;
      final container = makeContainer(fake);
      arm(container, community);
      async.flushMicrotasks();

      async.elapse(kPersonaPulseInterval); // pulse #1 fires → suspends on the gate
      async.flushMicrotasks();
      expect(fake.personaPulses, hasLength(1), reason: 'pulse #1 is IN FLIGHT');

      container.dispose(); // dispose WHILE the pulse awaits the transport

      gate.complete(); // the in-flight triggerPersonaPulse resolves, post-dispose
      async.flushMicrotasks(); // its continuation runs → must hit the guard
      async.elapse(kPersonaPulseInterval * 3); // no rescheduled pulse may fire

      expect(fake.personaPulses, hasLength(1),
          reason: 'the guarded continuation must not reschedule a pulse');
    });
  });

  test('a group chat never arms the persona pulse', () {
    fakeAsync((async) {
      final fake = FakeStaffroomTransport()..personaPulseResult = aPulse;
      final container = makeContainer(fake);
      arm(container, group);
      async.flushMicrotasks();

      async.elapse(kPersonaPulseInterval * 3);
      expect(fake.personaPulses, isEmpty,
          reason: 'the persona pulse writes community_chat only');
      expect(
        container.read(personaPulseControllerProvider(group)),
        PersonaPulseStatus.idle,
      );
    });
  });
}
