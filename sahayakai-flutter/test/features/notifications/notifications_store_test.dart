import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/notifications/data/notifications_store.dart';
import 'package:sahayakai/features/notifications/domain/teacher_notification.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The Updates store: the on-device record behind the Network hub's third tab.
///
/// The properties that matter are the ones that keep it HONEST — one real event
/// yields exactly one row however many times the screen that saw it rebuilds,
/// a corrupt persisted row costs that row alone, and nothing is invented on the
/// way back in.

TeacherNotification _call({
  String id = 'hotline:o1:callCompleted',
  String student = 'Asha Devi',
  DateTime? at,
  bool isRead = false,
}) => TeacherNotification(
  id: id,
  kind: TeacherNotificationKind.callCompleted,
  at: at ?? DateTime.utc(2026, 8, 18, 10),
  label: student,
  isRead: isRead,
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  ProviderContainer makeContainer() {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    return container;
  }

  /// Lets the store's fire-and-forget `_hydrate()` land before asserting.
  Future<void> hydrate(ProviderContainer container) async {
    container.read(notificationsProvider);
    await pumpEventQueue();
  }

  group('recording', () {
    test('starts empty', () {
      expect(makeContainer().read(notificationsProvider), isEmpty);
    });

    test('records a row and counts it unread', () {
      final container = makeContainer();
      container.read(notificationsProvider.notifier).record(_call());

      expect(container.read(notificationsProvider), hasLength(1));
      expect(container.read(unreadNotificationCountProvider), 1);
    });

    test('the same id twice is one row (the rebuild guard)', () {
      final container = makeContainer();
      final store = container.read(notificationsProvider.notifier);
      store.record(_call());
      store.record(_call());
      store.record(_call());

      expect(container.read(notificationsProvider), hasLength(1));
    });

    test('newest first, whatever order the rows arrive in', () {
      final container = makeContainer();
      final store = container.read(notificationsProvider.notifier);
      store.record(_call(id: 'old', at: DateTime.utc(2026, 8, 1)));
      store.record(_call(id: 'new', at: DateTime.utc(2026, 8, 18)));
      store.record(_call(id: 'middle', at: DateTime.utc(2026, 8, 10)));

      expect(
        container.read(notificationsProvider).map((n) => n.id).toList(),
        <String>['new', 'middle', 'old'],
      );
    });

    test('caps the history so prefs cannot grow without bound', () {
      final container = makeContainer();
      final store = container.read(notificationsProvider.notifier);
      for (var i = 0; i < kMaxStoredNotifications + 20; i++) {
        store.record(
          _call(
            id: 'n$i',
            at: DateTime.utc(2026, 8, 18).add(Duration(minutes: i)),
          ),
        );
      }
      final rows = container.read(notificationsProvider);
      expect(rows, hasLength(kMaxStoredNotifications));
      // The cap drops the OLDEST, never the newest.
      expect(rows.first.id, 'n${kMaxStoredNotifications + 19}');
    });
  });

  group('read state', () {
    test('markRead clears one row', () {
      final container = makeContainer();
      final store = container.read(notificationsProvider.notifier);
      store.record(_call(id: 'a'));
      store.record(_call(id: 'b', at: DateTime.utc(2026, 8, 17)));

      store.markRead('a');
      expect(container.read(unreadNotificationCountProvider), 1);
      expect(
        container
            .read(notificationsProvider)
            .firstWhere((n) => n.id == 'a')
            .isRead,
        isTrue,
      );
    });

    test('markAllRead clears every row', () {
      final container = makeContainer();
      final store = container.read(notificationsProvider.notifier);
      store.record(_call(id: 'a'));
      store.record(_call(id: 'b', at: DateTime.utc(2026, 8, 17)));

      store.markAllRead();
      expect(container.read(unreadNotificationCountProvider), 0);
    });

    test('markRead on an unknown id changes nothing', () {
      final container = makeContainer();
      container.read(notificationsProvider.notifier)
        ..record(_call())
        ..markRead('not-a-row');
      expect(container.read(unreadNotificationCountProvider), 1);
    });
  });

  group('persistence', () {
    test('survives a restart, read state included', () async {
      final first = makeContainer();
      first.read(notificationsProvider.notifier)
        ..record(_call(id: 'a'))
        ..record(
          TeacherNotification(
            id: 'absence:c1:2026-8:s1:4',
            kind: TeacherNotificationKind.absenceRun,
            at: DateTime.utc(2026, 8, 17),
            label: 'Ravi',
            className: 'Class 8 Science',
            classId: 'c1',
            count: 4,
          ),
        )
        ..markRead('a');
      await pumpEventQueue();

      // A new container is a new app launch reading the same store.
      final second = makeContainer();
      await hydrate(second);

      final rows = second.read(notificationsProvider);
      expect(rows, hasLength(2));
      expect(rows.firstWhere((n) => n.id == 'a').isRead, isTrue);
      final absence = rows.firstWhere(
        (n) => n.kind == TeacherNotificationKind.absenceRun,
      );
      expect(absence.count, 4);
      expect(absence.classId, 'c1');
      expect(absence.className, 'Class 8 Science');
      expect(second.read(unreadNotificationCountProvider), 1);
    });

    test('a row recorded before hydration lands is not lost', () async {
      final seeded = makeContainer();
      seeded.read(notificationsProvider.notifier).record(_call(id: 'stored'));
      await pumpEventQueue();

      final next = makeContainer();
      // Record BEFORE draining the queue: this is the real race, the teacher
      // acting on the first frame after launch.
      next
          .read(notificationsProvider.notifier)
          .record(_call(id: 'live', at: DateTime.utc(2026, 8, 18, 11)));
      await pumpEventQueue();

      expect(
        next.read(notificationsProvider).map((n) => n.id).toSet(),
        <String>{'stored', 'live'},
      );
    });

    test('a corrupt blob costs the history, not the screen', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        kNotificationsPrefsKey: 'not json at all',
      });
      final container = makeContainer();
      await hydrate(container);
      expect(container.read(notificationsProvider), isEmpty);
    });

    test('one unusable row is dropped; its siblings survive', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        kNotificationsPrefsKey: jsonEncode(<Object>[
          // An unknown kind: a row the app cannot render must be dropped, never
          // defaulted into some other kind.
          <String, Object>{
            'id': 'x',
            'kind': 'parentCalledBack',
            'at': '2026-08-18T10:00:00Z',
            'label': 'Asha',
          },
          <String, Object>{
            'id': 'no-timestamp',
            'kind': 'callFailed',
            'label': 'B',
          },
          _call(id: 'good').toJson(),
        ]),
      });
      final container = makeContainer();
      await hydrate(container);

      final rows = container.read(notificationsProvider);
      expect(rows, hasLength(1));
      expect(rows.single.id, 'good');
    });
  });

  group('codec', () {
    test('round-trips every kind', () {
      for (final kind in TeacherNotificationKind.values) {
        final source = TeacherNotification(
          id: 'id-${kind.wire}',
          kind: kind,
          at: DateTime.utc(2026, 8, 18, 9, 30),
          label: 'Label',
          className: 'Class 6 Maths',
          classId: 'c9',
          count: 3,
          isRead: true,
        );
        final decoded = TeacherNotification.fromJson(
          jsonDecode(jsonEncode(source.toJson())),
        );
        expect(decoded, source, reason: kind.wire);
      }
    });

    test('a non-map entry decodes to null rather than throwing', () {
      expect(TeacherNotification.fromJson('nonsense'), isNull);
      expect(TeacherNotification.fromJson(null), isNull);
    });
  });
}
