import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/notifications/data/notifications_store.dart';
import 'package:sahayakai/features/notifications/domain/teacher_notification.dart';
import 'package:sahayakai/features/notifications/presentation/notifications_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-SI5 — the Network hub's **Updates** pane.
///
/// The surface has to earn its place three ways: it says what it actually is
/// (a local record, no push), it shows a teacher the three real things the app
/// observed, and every row leads somewhere that can keep the row's promise.

/// A marker each deep link resolves to, so a route assertion does not drag a
/// whole destination screen's provider graph into this suite (same shape as
/// network_hub_test.dart's `_DestMarker`).
class _DestMarker extends StatelessWidget {
  const _DestMarker(this.id);

  final String id;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(child: Text('DEST', key: Key('dest-$id'))),
  );
}

final _now = DateTime.utc(2026, 8, 18, 12);

TeacherNotification _callCompleted() => TeacherNotification(
  id: 'hotline:o1:callCompleted',
  kind: TeacherNotificationKind.callCompleted,
  at: _now.subtract(const Duration(minutes: 5)),
  label: 'Asha Devi',
);

TeacherNotification _callFailed() => TeacherNotification(
  id: 'hotline:o2:callFailed',
  kind: TeacherNotificationKind.callFailed,
  at: _now.subtract(const Duration(hours: 2)),
  label: 'Ravi Kumar',
);

TeacherNotification _absence() => TeacherNotification(
  id: 'absence:c1:2026-8:s7:4',
  kind: TeacherNotificationKind.absenceRun,
  at: _now.subtract(const Duration(days: 1)),
  label: 'Meena',
  className: 'Class 8 Science',
  classId: 'c1',
  count: 4,
);

TeacherNotification _paper() => TeacherNotification(
  id: 'exam-paper:2026-08-17T09:00:00.000Z',
  kind: TeacherNotificationKind.examPaperQueued,
  at: _now.subtract(const Duration(days: 2)),
  label: 'Mathematics',
);

Future<ProviderContainer> _pumpView(
  WidgetTester tester, {
  List<TeacherNotification> seed = const [],
}) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final container = ProviderContainer();
  addTearDown(container.dispose);
  final store = container.read(notificationsProvider.notifier);
  for (final n in seed) {
    store.record(n);
  }

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => Scaffold(body: NotificationsView(now: _now)),
      ),
      GoRoute(
        path: Routes.parentHotline,
        builder: (_, _) => const _DestMarker('hotline'),
      ),
      GoRoute(
        path: Routes.attendanceMonthPattern,
        builder: (_, state) =>
            _DestMarker('month-${state.pathParameters['classId']}'),
      ),
      GoRoute(
        path: Routes.library,
        builder: (_, _) => const _DestMarker('library'),
      ),
    ],
  );

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  final l10n = _en();

  group('empty state', () {
    testWidgets('names what will appear here, and still admits there is no '
        'push', (tester) async {
      await _pumpView(tester);

      expect(find.text(l10n.notificationsEmptyTitle), findsOneWidget);
      expect(find.text(l10n.notificationsEmptyBody), findsOneWidget);
      expect(find.byIcon(LucideIcons.bell), findsOneWidget);
      // The honesty line is present in the empty state too — that is precisely
      // where a teacher would otherwise conclude "nothing has happened" rather
      // than "nothing was recorded while I had the app open".
      expect(find.text(l10n.notificationsLocalNote), findsOneWidget);
      // Nothing to mark, so no action.
      expect(find.text(l10n.notificationsMarkAllRead), findsNothing);
    });
  });

  group('rows', () {
    testWidgets('renders the three real kinds with their own copy', (
      tester,
    ) async {
      await _pumpView(
        tester,
        seed: [_callCompleted(), _callFailed(), _absence(), _paper()],
      );

      expect(
        find.text(l10n.notificationCallCompletedTitle('Asha Devi')),
        findsOneWidget,
      );
      expect(find.text(l10n.notificationCallCompletedBody), findsOneWidget);
      expect(
        find.text(l10n.notificationCallFailedTitle('Ravi Kumar')),
        findsOneWidget,
      );
      expect(
        find.text(l10n.notificationAbsenceTitle('Meena', 4)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.notificationAbsenceBody('Class 8 Science')),
        findsOneWidget,
      );
      expect(
        find.text(l10n.notificationExamPaperTitle('Mathematics')),
        findsOneWidget,
      );
      // The 202 promises a Library save, never an arrival — the copy must not
      // claim the paper is ready.
      expect(find.text(l10n.notificationExamPaperBody), findsOneWidget);
    });

    testWidgets('newest first', (tester) async {
      await _pumpView(tester, seed: [_paper(), _absence(), _callCompleted()]);

      final titles = tester
          .widgetList<Text>(find.byType(Text))
          .map((t) => t.data)
          .whereType<String>()
          .toList();
      expect(
        titles.indexOf(l10n.notificationCallCompletedTitle('Asha Devi')),
        lessThan(
          titles.indexOf(l10n.notificationExamPaperTitle('Mathematics')),
        ),
      );
    });

    testWidgets('the relative timestamp comes off the injected clock', (
      tester,
    ) async {
      await _pumpView(tester, seed: [_callCompleted()]);
      expect(find.text(l10n.inboxTimeMinutes(5)), findsOneWidget);
    });
  });

  group('read state', () {
    testWidgets('mark all as read clears the unread count and the action', (
      tester,
    ) async {
      final container = await _pumpView(
        tester,
        seed: [_callCompleted(), _absence()],
      );
      expect(container.read(unreadNotificationCountProvider), 2);

      await tester.tap(find.text(l10n.notificationsMarkAllRead));
      await tester.pumpAndSettle();

      expect(container.read(unreadNotificationCountProvider), 0);
      expect(find.text(l10n.notificationsMarkAllRead), findsNothing);
    });

    testWidgets('tapping a row marks that row read', (tester) async {
      final container = await _pumpView(
        tester,
        seed: [_callCompleted(), _absence()],
      );

      await tester.tap(
        find.text(l10n.notificationCallCompletedTitle('Asha Devi')),
      );
      await tester.pumpAndSettle();

      expect(container.read(unreadNotificationCountProvider), 1);
    });
  });

  group('every row leads somewhere that can keep its promise', () {
    testWidgets('a call outcome opens the Parent Hotline', (tester) async {
      await _pumpView(tester, seed: [_callFailed()]);
      await tester.tap(
        find.text(l10n.notificationCallFailedTitle('Ravi Kumar')),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-hotline')), findsOneWidget);
    });

    testWidgets("an absence run opens that class's month view", (tester) async {
      await _pumpView(tester, seed: [_absence()]);
      await tester.tap(find.text(l10n.notificationAbsenceTitle('Meena', 4)));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-month-c1')), findsOneWidget);
    });

    testWidgets('a queued exam paper opens the Library', (tester) async {
      await _pumpView(tester, seed: [_paper()]);
      await tester.tap(
        find.text(l10n.notificationExamPaperTitle('Mathematics')),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dest-library')), findsOneWidget);
    });
  });
}
